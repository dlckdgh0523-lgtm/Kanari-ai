import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Between } from 'typeorm';
import { CheckRunnerService } from '../checks/check-runner.service';
import { ErrorEvent } from '../events/error-event.entity';
import { ErrorGroup } from '../events/error-group.entity';
import { AlertService } from './alert.service';

// 워치독: 워커 프로세스에서 1분마다 도는 감시 루프 두 개.
//   1) 급증 탐지 - 이미 아는 에러가 평소보다 훨씬 자주 나기 시작했는가?
//   2) 합성 테스트 - 실행 주기가 된 체크들을 돌린다
//
// 신규 에러 알람은 그룹핑 시점에 즉시 나가지만(grouping.service),
// 급증은 흐름을 지켜봐야 알 수 있어서 이렇게 주기 스캔으로 잡는다.
@Injectable()
export class WatchdogService {
  private readonly logger = new Logger(WatchdogService.name);

  constructor(
    @InjectRepository(ErrorGroup)
    private readonly groupRepo: Repository<ErrorGroup>,
    @InjectRepository(ErrorEvent)
    private readonly eventRepo: Repository<ErrorEvent>,
    private readonly alertService: AlertService,
    private readonly checkRunner: CheckRunnerService,
  ) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async detectSpikes() {
    const now = Date.now();
    const fiveMinAgo = new Date(now - 5 * 60 * 1000);
    const hourAgo = new Date(now - 65 * 60 * 1000);

    // 최근 5분 안에 발생이 있었던 열린 그룹만 본다 (조용한 그룹은 볼 필요가 없다)
    const activeGroups = await this.groupRepo.findBy({
      status: 'open',
      lastSeenAt: MoreThan(fiveMinAgo),
    });

    for (const group of activeGroups) {
      // 쿨다운: 같은 그룹의 급증 알람은 30분에 한 번만.
      // 급증이 계속되는 동안 1분마다 울리면 알람이 소음이 된다
      if (
        group.lastSpikeAlertAt &&
        now - group.lastSpikeAlertAt.getTime() < 30 * 60 * 1000
      ) {
        continue;
      }

      const recentCount = await this.eventRepo.countBy({
        groupId: group.id,
        occurredAt: MoreThan(fiveMinAgo),
      });

      // 기준선: 직전 1시간(최근 5분 제외)의 5분당 평균 발생량
      const pastCount = await this.eventRepo.countBy({
        groupId: group.id,
        occurredAt: Between(hourAgo, fiveMinAgo),
      });
      const baseline = Math.max(Math.round(pastCount / 12), 1);

      // 급증 판정: 절대량(10건 이상)과 상대량(평소의 3배 이상)을 둘 다 요구한다.
      // 절대량만 보면 트래픽 많은 서비스에서 오탐, 상대량만 보면 2건->6건 같은
      // 사소한 변화에도 울린다. 두 조건의 AND가 실용적인 절충이다
      if (recentCount >= 10 && recentCount >= baseline * 3) {
        this.logger.warn(
          `spike: group ${group.id} recent=${recentCount} baseline=${baseline}`,
        );
        await this.alertService.notifySpike(group, recentCount, baseline);
        await this.groupRepo.update(group.id, {
          lastSpikeAlertAt: new Date(),
        });
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async runSyntheticChecks() {
    const ran = await this.checkRunner.runDueChecks();
    if (ran > 0) this.logger.debug(`synthetic checks ran: ${ran}`);
  }
}
