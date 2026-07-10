import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorEvent } from '../events/error-event.entity';
import { ErrorGroup } from '../events/error-group.entity';
import { IngestEventDto } from '../ingest/dto/ingest.dto';
import { AlertService } from './alert.service';
import { computeFingerprint } from './fingerprint';

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
        });
        // 알람은 그룹이 처음 만들어질 때 딱 한 번. 같은 에러 1,000건 = 알람 1건
        await this.alertService.notifyNewGroup(group);
      } catch (err) {
        // 컨슈머가 여러 개일 때 같은 지문을 동시에 저장하면 unique 제약에 걸린다.
        // 그 경우 먼저 저장된 쪽을 다시 읽어서 이어간다 (에러가 아니라 정상 경합)
        group = await this.groupRepo.findOneBy({ projectId, fingerprint });
        if (!group) throw err;
      }
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
      occurredAt,
    });

    this.logger.debug(`event -> group ${group.id} (${fingerprint.slice(0, 8)})`);
  }
}
