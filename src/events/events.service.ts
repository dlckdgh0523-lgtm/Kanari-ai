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
  // 이 메모들이 유사 장애 검색(RAG)의 지식베이스가 된다
  async resolveGroup(groupId: number) {
    const group = await this.groupRepo.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException(`group ${groupId} not found`);

    await this.groupRepo.update(groupId, { status: 'resolved' });
    return { id: groupId, status: 'resolved' };
  }
}
