import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorGroup } from '../events/error-group.entity';
import { Project } from '../projects/project.entity';

// Discord 웹훅으로 알람을 보낸다.
// 원칙: 알람 발송이 실패해도 이벤트 처리 흐름을 막지 않는다.
// 알람은 부가 기능이고, 저장이 본 기능이기 때문이다. 그래서 throw 하지 않고 로그만 남긴다.
@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  // 지금은 신규 에러 그룹이 생겼을 때만 알람을 보낸다.
  // 급증 탐지 알람은 Phase 3에서 추가한다.
  async notifyNewGroup(group: ErrorGroup) {
    const project = await this.projectRepo.findOneBy({ id: group.projectId });

    const webhookUrl =
      project?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return; // 웹훅 미설정이면 조용히 넘어간다

    const lines = [
      `🐤 새로운 에러가 발견됐습니다 — ${project?.name ?? group.projectId}`,
      '```',
      `${group.name}: ${group.message.slice(0, 300)}`,
      group.topFrame ? `위치: ${group.topFrame}` : '',
      `첫 발생: ${group.firstSeenAt.toISOString()}`,
      '```',
    ].filter(Boolean);

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ content: lines.join('\n') }),
      });
      if (!res.ok) {
        this.logger.warn(`discord webhook responded ${res.status}`);
      }
    } catch (err) {
      this.logger.warn(`discord webhook failed: ${err}`);
    }
  }
}
