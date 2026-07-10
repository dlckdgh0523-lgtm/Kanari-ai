import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SyntheticCheck } from '../checks/synthetic-check.entity';
import { ErrorGroup } from '../events/error-group.entity';
import { Project } from '../projects/project.entity';

// Discord 웹훅 알람 담당. 알람 종류는 4가지다.
//   🐤 신규 에러 그룹   📈 기존 에러 급증   🔴 합성 테스트 실패   🟢 회복
//
// 원칙 1: 알람 발송이 실패해도 본 처리 흐름을 막지 않는다 (throw 하지 않고 로그만)
// 원칙 2: 알람은 판단에 필요한 정보(무엇이, 어디서, 얼마나)를 한 화면에 담는다.
//         새벽에 알람을 받은 사람이 노트북을 열지 말지 이걸 보고 결정한다
@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async notifyNewGroup(group: ErrorGroup) {
    await this.send(group.projectId, [
      `🐤 새로운 에러가 발견됐습니다 (그룹 #${group.id})`,
      '```',
      `${group.name}: ${group.message.slice(0, 300)}`,
      group.topFrame ? `위치: ${group.topFrame}` : '',
      `첫 발생: ${group.firstSeenAt.toISOString()}`,
      '```',
    ]);
  }

  async notifySpike(group: ErrorGroup, recentCount: number, baseline: number) {
    await this.send(group.projectId, [
      `📈 에러가 급증하고 있습니다 (그룹 #${group.id})`,
      '```',
      `${group.name}: ${group.message.slice(0, 300)}`,
      `최근 5분: ${recentCount}건 (평소 5분당 약 ${baseline}건)`,
      group.topFrame ? `위치: ${group.topFrame}` : '',
      '```',
    ]);
  }

  async notifyCheckFailed(
    check: SyntheticCheck,
    result: { statusCode?: number; error?: string; ms: number },
  ) {
    await this.send(check.projectId, [
      `🔴 합성 테스트 연속 실패: ${check.name}`,
      '```',
      `${check.method} ${check.url}`,
      result.statusCode !== undefined
        ? `응답: ${result.statusCode} (기대: ${check.expectedStatus})`
        : `연결 실패: ${result.error}`,
      `소요: ${result.ms}ms`,
      '```',
    ]);
  }

  async notifyCheckRecovered(check: SyntheticCheck) {
    await this.send(check.projectId, [
      `🟢 회복됐습니다: ${check.name} (${check.method} ${check.url})`,
    ]);
  }

  // 공통 발송부. 프로젝트 전용 웹훅이 있으면 그걸, 없으면 .env의 기본 웹훅을 쓴다
  private async send(projectId: number, lines: (string | false)[]) {
    const project = await this.projectRepo.findOneBy({ id: projectId });
    const webhookUrl =
      project?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: lines.filter(Boolean).join('\n') }),
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) {
        // Discord 웹훅은 분당 요청 제한이 있다(429). 알람이 밀릴 정도로 잦다면
        // 알람 정책이 잘못된 것이므로, 여기서 재시도하지 않고 정책을 고치는 게 맞다
        this.logger.warn(`discord webhook responded ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(`discord webhook failed: ${err}`);
    }
  }
}
