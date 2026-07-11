import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorEvent } from '../events/error-event.entity';
import { ErrorGroup } from '../events/error-group.entity';
import { IngestEventDto } from '../ingest/dto/ingest.dto';
import { AlertService } from './alert.service';
import { computeFingerprint } from './fingerprint';
import { SimilarIncidentsService } from './similar-incidents.service';

// Kafka에서 꺼낸 이벤트 한 건을 처리하는 흐름:
// 1) 지문 계산  2) 그룹 찾기(없으면 생성 + 알람)  3) 카운트 갱신  4) 원본 이벤트 저장
@Injectable()
export class GroupingService {
  private readonly logger = new Logger(GroupingService.name);

  constructor(
    @InjectRepository(ErrorGroup)
    private readonly groupRepo: Repository<ErrorGroup>,
    @InjectRepository(ErrorEvent)
    private readonly eventRepo: Repository<ErrorEvent>,
    private readonly alertService: AlertService,
    private readonly similarIncidents: SimilarIncidentsService,
  ) {}

  async handleEvent(projectId: number, event: IngestEventDto) {
    const { fingerprint, topFrame } = computeFingerprint(
      event.name,
      event.message,
      event.stack,
    );
    const occurredAt = event.occurredAt ? new Date(event.occurredAt) : new Date();

    let group = await this.groupRepo.findOneBy({ projectId, fingerprint });

    if (!group) {
      try {
        group = await this.groupRepo.save({
          projectId,
          fingerprint,
          name: event.name,
          message: event.message,
          topFrame,
          count: 0,
          firstSeenAt: occurredAt,
          lastSeenAt: occurredAt,
          firstRelease: event.release ?? null,
        });
        // 알람은 그룹이 처음 만들어질 때 딱 한 번. 같은 에러 1,000건 = 알람 1건.
        // 과거에 해결한 비슷한 장애가 있으면 해결 메모와 함께 붙여준다
        const similar = await this.similarIncidents.findSimilar(
          projectId,
          event.name,
          event.message,
          topFrame,
        );
        await this.alertService.notifyNewGroup(group, similar, event.release);
      } catch (err) {
        // 컨슈머가 여러 개일 때 같은 지문을 동시에 저장하면 unique 제약에 걸린다.
        // 그 경우 먼저 저장된 쪽을 다시 읽어서 이어간다 (에러가 아니라 정상 경합)
        group = await this.groupRepo.findOneBy({ projectId, fingerprint });
        if (!group) throw err;
      }
    } else if (group.status === 'resolved') {
      // 회귀 감지: 고쳤다고 표시한(resolved) 에러가 다시 나타났다.
      // 로컬 테스트로는 절대 못 잡는 것 - 실제 배포된 코드에서만 드러난다.
      // 다시 열고, 이번엔 어느 배포에서 재발했는지와 함께 알린다
      await this.groupRepo.update(group.id, {
        status: 'open',
        regressed: true,
      });
      await this.alertService.notifyRegression(group, event.release);
      this.logger.warn(`regression: group ${group.id} reopened`);
    }

    // count = count + 1 을 DB에서 계산하게 한다.
    // 읽어서 +1 해서 다시 쓰면, 동시에 두 컨슈머가 처리할 때 한 번이 사라진다
    await this.groupRepo.update(group.id, {
      count: () => 'count + 1',
      lastSeenAt: occurredAt,
    });

    await this.eventRepo.save({
      groupId: group.id,
      projectId,
      level: event.level ?? 'error',
      message: event.message,
      stack: event.stack ?? null,
      context: event.context ?? null,
      traceId: event.traceId ?? null,
      release: event.release ?? null,
      occurredAt,
    });

    this.logger.debug(`event -> group ${group.id} (${fingerprint.slice(0, 8)})`);
  }
}
