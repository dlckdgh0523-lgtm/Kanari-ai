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
//
// 포맷은 Discord 임베드를 쓴다. 왼쪽 색상 바로 심각도가 한눈에 구분되고
// (노랑=신규, 빨강=급증/실패, 초록=회복), 필드 구조라 텍스트 덩어리보다 읽기 쉽다
@Injectable()
export class AlertService {
  private readonly logger = new Logger(AlertService.name);

  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  async notifyNewGroup(
    group: ErrorGroup,
    similar: ErrorGroup[] = [],
    release?: string,
  ) {
    const fields: { name: string; value: string }[] = [];

    if (group.topFrame) {
      fields.push({ name: '위치', value: '`' + group.topFrame + '`' });
    }
    // 배포 버전이 있으면 "어느 배포에서 생겼나"를 알람에 박는다.
    // 방금 배포한 버전이면 이게 그 배포의 부작용이라는 강력한 신호다
    if (release) {
      fields.push({ name: '배포', value: '`' + release + '`' });
    }

    // 과거에 해결한 비슷한 장애가 있으면 해결 메모를 함께 보여준다.
    // 이게 있으면 조사를 처음부터 다시 시작하지 않아도 된다
    for (const past of similar) {
      fields.push({
        name: `📚 비슷한 과거 장애 #${past.id}`,
        value:
          past.message.slice(0, 150) +
          '\n**해결:** ' +
          (past.resolveNote ?? '').slice(0, 300),
      });
    }

    await this.send(group.projectId, {
      title: `🐤 새로운 에러 · 그룹 #${group.id}`,
      color: 0xf6c744, // 노랑: 새로 등장, 아직 규모는 모름
      description:
        '```' + `${group.name}: ${group.message.slice(0, 400)}` + '```',
      fields,
      timestamp: group.firstSeenAt.toISOString(),
    });
  }

  async notifySpike(group: ErrorGroup, recentCount: number, baseline: number) {
    await this.send(group.projectId, {
      title: `📈 에러 급증 · 그룹 #${group.id}`,
      color: 0xef4444, // 빨강: 지금 커지고 있는 문제
      description:
        '```' + `${group.name}: ${group.message.slice(0, 400)}` + '```',
      fields: [
        {
          name: '규모',
          value: `최근 5분 **${recentCount}건** (평소 5분당 약 ${baseline}건)`,
        },
        ...(group.topFrame
          ? [{ name: '위치', value: '`' + group.topFrame + '`' }]
          : []),
      ],
      timestamp: new Date().toISOString(),
    });
  }

  async notifyCheckFailed(
    check: SyntheticCheck,
    result: { statusCode?: number; error?: string; ms: number },
  ) {
    await this.send(check.projectId, {
      title: `🔴 합성 테스트 연속 실패 · ${check.name}`,
      color: 0xef4444,
      description: '`' + `${check.method} ${check.url}` + '`',
      fields: [
        {
          name: '결과',
          value:
            result.statusCode !== undefined
              ? `응답 **${result.statusCode}** (기대 ${check.expectedStatus}) · ${result.ms}ms`
              : `연결 실패: ${result.error} · ${result.ms}ms`,
        },
      ],
      timestamp: new Date().toISOString(),
    });
  }

  // 배포 후 신규 에러 급증: 방금 배포가 부작용을 냈다. 롤백을 고려하라는 신호
  async notifyBadDeploy(projectId: number, release: string, newErrors: number) {
    await this.send(projectId, {
      title: `⚠️ 배포 직후 새 에러가 쏟아집니다 — 롤백을 고려하세요`,
      color: 0xe4572e,
      description: '`' + release + '` 배포 이후 새로 생긴 에러 그룹',
      fields: [
        {
          name: '신규 에러',
          value: `배포 후 **${newErrors}종**의 새로운 에러가 발생했습니다`,
        },
      ],
      timestamp: new Date().toISOString(),
    });
  }

  // 회귀: 고쳤던 에러가 다시 나타났을 때. 가장 뼈아픈 종류 - 고친 게 풀렸다
  async notifyRegression(group: ErrorGroup, release?: string) {
    await this.send(group.projectId, {
      title: `🔴 회귀 · 고쳤던 에러가 다시 났습니다 (그룹 #${group.id})`,
      color: 0xe4572e, // 위험(진한 빨강): resolved가 풀린 최우선 사안
      description:
        '```' + `${group.name}: ${group.message.slice(0, 300)}` + '```',
      fields: [
        ...(group.topFrame
          ? [{ name: '위치', value: '`' + group.topFrame + '`' }]
          : []),
        ...(release ? [{ name: '재발 배포', value: '`' + release + '`' }] : []),
        ...(group.resolveNote
          ? [{ name: '지난번 해결', value: group.resolveNote.slice(0, 200) }]
          : []),
      ],
      timestamp: new Date().toISOString(),
    });
  }

  // 성능 워치독: 라우트 응답이 평소보다 크게 느려졌을 때
  async notifySlowdown(
    projectId: number,
    routeLabel: string,
    recentP95: number,
    baselineP95: number,
    count: number,
  ) {
    await this.send(projectId, {
      title: `🐢 응답이 느려지고 있습니다`,
      color: 0xe8a33d, // 경보(앰버): 죽진 않았지만 사용자는 이미 체감 중
      description: '`' + routeLabel + '`',
      fields: [
        {
          name: '지연',
          value: `최근 5분 p95 **${recentP95}ms** (평소 약 ${baselineP95}ms) · 요청 ${count}건`,
        },
      ],
      timestamp: new Date().toISOString(),
    });
  }

  async notifyCheckRecovered(check: SyntheticCheck) {
    await this.send(check.projectId, {
      title: `🟢 회복 · ${check.name}`,
      color: 0x10b981,
      description: '`' + `${check.method} ${check.url}` + '`',
      timestamp: new Date().toISOString(),
    });
  }

  // 공통 발송부. 프로젝트 전용 웹훅이 있으면 그걸, 없으면 .env의 기본 웹훅을 쓴다
  private async send(
    projectId: number,
    embed: {
      title: string;
      color: number;
      description?: string;
      fields?: { name: string; value: string }[];
      timestamp?: string;
    },
  ) {
    const project = await this.projectRepo.findOneBy({ id: projectId });
    const webhookUrl =
      project?.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;
    if (!webhookUrl) return;

    // 프로젝트명을 제목에 박는다. 여러 서비스를 한 채널로 받는 사람이
    // 제목만 보고 어느 서비스의 알람인지 구분할 수 있어야 한다
    const title = project?.name
      ? embed.title.replace(/^(\S+)\s/, `$1 [${project.name}] `)
      : embed.title;

    try {
      const res = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          embeds: [{ ...embed, title, footer: { text: project?.name ?? '' } }],
        }),
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
