import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { Between } from 'typeorm';
import { p95FromBuckets, BUCKET_EDGES } from '../apm/apm.service';
import { RouteStat } from '../apm/route-stat.entity';
import { CheckRunnerService } from '../checks/check-runner.service';
import { Deploy } from '../events/deploy.entity';
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
    @InjectRepository(RouteStat)
    private readonly statRepo: Repository<RouteStat>,
    @InjectRepository(Deploy)
    private readonly deployRepo: Repository<Deploy>,
    private readonly alertService: AlertService,
    private readonly checkRunner: CheckRunnerService,
  ) {}

  // 롤백 신호를 이미 보낸 배포는 다시 보내지 않는다 (배포 id 기억)
  private rollbackAlerted = new Set<number>();

  // 지연 급증 알람의 쿨다운 (프로젝트:라우트 -> 마지막 알람 시각).
  // 메모리에 두는 트레이드오프: 워커가 재시작하면 쿨다운이 풀려 한 번 더
  // 울릴 수 있다. 워커 1대 운영에서는 감수하고, 스케일 아웃하면 DB로 옮긴다
  private slowdownAlertAt = new Map<string, number>();

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

  // 배포 후 감시: 방금 배포한 버전에서 신규 에러가 쏟아지면 "롤백 고려" 신호.
  // 금요일 배포 공포의 핵심 - 배포가 부작용을 냈는지 배포 시각 기준으로 판단한다.
  @Cron(CronExpression.EVERY_MINUTE)
  async watchDeploys() {
    const now = Date.now();
    // 최근 30분 안의 배포만 감시한다 (그 이후 에러는 배포 탓이라 보기 어렵다)
    const thirtyMinAgo = new Date(now - 30 * 60 * 1000);
    const recentDeploys = await this.deployRepo.findBy({
      deployedAt: MoreThan(thirtyMinAgo),
    });

    for (const deploy of recentDeploys) {
      if (this.rollbackAlerted.has(deploy.id)) continue;

      // 이 배포 시각 이후에 처음 생긴 에러 그룹 수를 센다
      const newErrors = await this.groupRepo.countBy({
        projectId: deploy.projectId,
        firstSeenAt: MoreThan(deploy.deployedAt),
      });

      await this.deployRepo.update(deploy.id, { newErrorCount: newErrors });

      // 배포 후 신규 에러 그룹이 3개 이상이면 롤백을 고려하라고 알린다.
      // 배포 직후 잠깐(2분)은 기다린다 - 앱이 뜨는 중의 일시적 에러 오탐 방지
      const sinceDeploy = now - deploy.deployedAt.getTime();
      if (newErrors >= 3 && sinceDeploy > 2 * 60 * 1000) {
        this.logger.warn(
          `deploy ${deploy.release} caused ${newErrors} new errors`,
        );
        await this.alertService.notifyBadDeploy(
          deploy.projectId,
          deploy.release,
          newErrors,
        );
        this.rollbackAlerted.add(deploy.id);
      }
    }
  }

  @Cron(CronExpression.EVERY_MINUTE)
  async runSyntheticChecks() {
    const ran = await this.checkRunner.runDueChecks();
    if (ran > 0) this.logger.debug(`synthetic checks ran: ${ran}`);
  }

  // 성능 워치독: 라우트별 응답시간(p95)이 평소보다 크게 나빠졌는가?
  // 에러 급증 탐지와 같은 철학이다 - 절대 기준(300ms 이상)과
  // 상대 기준(기준선의 2.5배)을 둘 다 넘어야 울린다
  @Cron(CronExpression.EVERY_MINUTE)
  async detectSlowdowns() {
    const now = Date.now();
    const fiveMinAgo = new Date(now - 5 * 60 * 1000);
    const hourAgo = new Date(now - 65 * 60 * 1000);

    const recentRows = await this.statRepo.findBy({
      minute: MoreThan(fiveMinAgo),
    });
    if (recentRows.length === 0) return;

    const baselineRows = await this.statRepo.findBy({
      minute: Between(hourAgo, fiveMinAgo),
    });

    // 프로젝트+라우트 단위로 분포를 합친다
    const sum = (rows: RouteStat[]) => {
      const map = new Map<string, { buckets: number[]; count: number; projectId: number; label: string }>();
      for (const r of rows) {
        const key = `${r.projectId}|${r.method} ${r.route}`;
        let e = map.get(key);
        if (!e) {
          e = {
            buckets: new Array(BUCKET_EDGES.length + 1).fill(0),
            count: 0,
            projectId: r.projectId,
            label: `${r.method} ${r.route}`,
          };
          map.set(key, e);
        }
        e.count += r.count;
        r.buckets.forEach((v, i) => (e!.buckets[i] += v));
      }
      return map;
    };

    const recent = sum(recentRows);
    const baseline = sum(baselineRows);

    for (const [key, r] of recent) {
      // 표본이 적으면 p95가 요동친다. 최근 5분에 20건은 있어야 판단한다
      if (r.count < 20) continue;

      const last = this.slowdownAlertAt.get(key) ?? 0;
      if (now - last < 30 * 60 * 1000) continue; // 30분 쿨다운

      const recentP95 = p95FromBuckets(r.buckets);
      // 기준선이 없으면(방금 붙인 서비스) 50ms를 가정한다.
      // 처음부터 느린 서비스도 잡아주는 쪽이 놓치는 쪽보다 낫다
      const baseP95 = Math.max(
        baseline.has(key) ? p95FromBuckets(baseline.get(key)!.buckets) : 0,
        50,
      );

      if (recentP95 >= 300 && recentP95 >= baseP95 * 2.5) {
        this.logger.warn(
          `slowdown: ${key} p95=${recentP95}ms baseline=${baseP95}ms n=${r.count}`,
        );
        await this.alertService.notifySlowdown(
          r.projectId,
          r.label,
          recentP95,
          baseP95,
          r.count,
        );
        this.slowdownAlertAt.set(key, now);
      }
    }
  }
}
