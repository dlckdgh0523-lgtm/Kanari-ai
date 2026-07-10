import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ErrorEvent } from './error-event.entity';
import { ErrorGroup } from './error-group.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(ErrorGroup)
    private readonly groupRepo: Repository<ErrorGroup>,
    @InjectRepository(ErrorEvent)
    private readonly eventRepo: Repository<ErrorEvent>,
  ) {}

  // 대시보드 첫 화면: 프로젝트의 에러 그룹 목록 (최근 발생 순)
  async findGroups(projectId: number, status?: string) {
    return this.groupRepo.find({
      where: status ? { projectId, status } : { projectId },
      order: { lastSeenAt: 'DESC' },
      take: 100,
    });
  }

  // 그룹 상세: 요약 + 최근 이벤트 원본 20건 (스택, traceId 포함)
  async findGroupDetail(groupId: number) {
    const group = await this.groupRepo.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException(`group ${groupId} not found`);

    const recentEvents = await this.eventRepo.find({
      where: { groupId },
      order: { occurredAt: 'DESC' },
      take: 20,
    });

    return { group, recentEvents };
  }

  // 그룹을 해결 처리한다. Phase 4에서 해결 메모가 추가되면
  // 이 메모들이 유사 장애 검색의 지식베이스가 된다.
  // 메모 없이 resolve만 하면 지식이 안 쌓이므로, 화면(Phase 7)에서는 메모 입력을 유도한다
  async resolveGroup(groupId: number, note?: string) {
    const group = await this.groupRepo.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException(`group ${groupId} not found`);

    await this.groupRepo.update(groupId, {
      status: 'resolved',
      resolveNote: note ?? null,
      resolvedAt: new Date(),
    });
    return { id: groupId, status: 'resolved', resolveNote: note ?? null };
  }
}
