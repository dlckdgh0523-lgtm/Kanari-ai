import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AlertService } from '../grouping/alert.service';
import { SyntheticCheck } from './synthetic-check.entity';

export interface CheckResult {
  checkId: number;
  name: string;
  ok: boolean;
  statusCode?: number;
  ms: number;
  error?: string;
}

// 합성 테스트 실행기. 등록된 URL을 실제로 호출해서 기대한 응답이 오는지 본다.
// 이 클래스에는 스케줄(@Cron)이 없다 - 주기 실행은 워커의 WatchdogService가,
// 즉시 실행(배포 스모크)은 API의 컨트롤러가 각각 이 실행기를 호출한다.
@Injectable()
export class CheckRunnerService {
  private readonly logger = new Logger(CheckRunnerService.name);

  constructor(
    @InjectRepository(SyntheticCheck)
    private readonly checkRepo: Repository<SyntheticCheck>,
    private readonly alertService: AlertService,
  ) {}

  // 실행 시각이 된 체크들을 찾아 전부 실행한다 (워커가 1분마다 호출)
  async runDueChecks() {
    const now = Date.now();
    const checks = await this.checkRepo.findBy({ enabled: true });

    // 주기가 아직 안 된 체크는 걸러낸다
    const due = checks.filter(
      (c) =>
        !c.lastCheckedAt ||
        now - c.lastCheckedAt.getTime() >= c.intervalSec * 1000,
    );

    for (const check of due) {
      await this.runOne(check);
    }
    return due.length;
  }

  // 체크 하나를 실행하고 상태 전환에 따라 알람을 처리한다
  async runOne(check: SyntheticCheck): Promise<CheckResult> {
    const result = await this.execute(check);

    if (result.ok) {
      // 장애 상태였다가 살아났으면 회복 알림을 보낸다.
      // 알람만 보내고 회복을 안 알려주면, 받는 사람은 아직 장애인 줄 알고 불안해한다
      if (check.alertedAt) {
        await this.alertService.notifyCheckRecovered(check);
      }
      await this.checkRepo.update(check.id, {
        lastStatus: 'ok',
        failStreak: 0,
        alertedAt: null,
        lastCheckedAt: new Date(),
      });
    } else {
      const failStreak = check.failStreak + 1;

      // 연속 2회 실패했고 아직 알람을 안 보냈을 때만 보낸다.
      // 1회 실패에 바로 울리면 일시적 네트워크 흔들림에도 알람이 와서
      // 양치기 소년이 된다. 알람은 믿을 수 있어야 알람이다
      const shouldAlert = failStreak >= 2 && !check.alertedAt;
      if (shouldAlert) {
        await this.alertService.notifyCheckFailed(check, result);
      }

      await this.checkRepo.update(check.id, {
        lastStatus: 'fail',
        failStreak,
        alertedAt: shouldAlert ? new Date() : check.alertedAt,
        lastCheckedAt: new Date(),
      });
    }

    this.logger.log(
      `check ${check.name}: ${result.ok ? 'ok' : 'FAIL'} (${result.ms}ms)`,
    );
    return result;
  }

  // 순수한 HTTP 호출 부분. 성공/실패 판정만 하고 상태는 건드리지 않는다
  private async execute(check: SyntheticCheck): Promise<CheckResult> {
    const startedAt = Date.now();
    try {
      // 저장된 헤더/바디를 실어 보낸다. JSON 파싱이 깨지면 무시하고 진행한다
      let headers: Record<string, string> | undefined;
      if (check.requestHeaders) {
        try {
          headers = JSON.parse(check.requestHeaders);
        } catch {
          headers = undefined;
        }
      }

      const res = await fetch(check.url, {
        method: check.method,
        headers,
        body:
          check.method === 'GET' || check.method === 'HEAD'
            ? undefined
            : (check.requestBody ?? undefined),
        // 5초 넘게 걸리는 응답은 사실상 장애로 본다
        signal: AbortSignal.timeout(5000),
      });
      return {
        checkId: check.id,
        name: check.name,
        ok: res.status === check.expectedStatus,
        statusCode: res.status,
        ms: Date.now() - startedAt,
      };
    } catch (err) {
      // 연결 거부, DNS 실패, 타임아웃 전부 여기로 온다
      return {
        checkId: check.id,
        name: check.name,
        ok: false,
        ms: Date.now() - startedAt,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
