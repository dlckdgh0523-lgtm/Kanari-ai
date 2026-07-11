import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { MoreThan, Repository } from 'typeorm';
import { SyntheticCheck } from '../checks/synthetic-check.entity';
import { ProjectsService } from '../projects/projects.service';
import { ErrorEvent } from './error-event.entity';
import { ErrorGroup } from './error-group.entity';

@Injectable()
export class EventsService {
  constructor(
    @InjectRepository(ErrorGroup)
    private readonly groupRepo: Repository<ErrorGroup>,
    @InjectRepository(ErrorEvent)
    private readonly eventRepo: Repository<ErrorEvent>,
    @InjectRepository(SyntheticCheck)
    private readonly checkRepo: Repository<SyntheticCheck>,
    private readonly projectsService: ProjectsService,
  ) {}

  // 프로젝트 통합 개요: 한 화면에서 서비스 건강 상태를 보여준다.
  // 여러 페이지에 흩어진 핵심 숫자를 여기 한 번에 모은다
  async overview(projectId: number, userId: number) {
    await this.projectsService.assertOwner(projectId, userId);
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const openGroups = await this.groupRepo.countBy({ projectId, status: 'open' });
    const events24h = await this.eventRepo.countBy({
      projectId,
      occurredAt: MoreThan(dayAgo),
    });

    const checks = await this.checkRepo.findBy({ projectId });
    const failingChecks = checks.filter((c) => c.lastStatus === 'fail').length;

    // 가장 시끄러운 열린 에러 5개 (횟수 순)
    const topErrors = await this.groupRepo.find({
      where: { projectId, status: 'open' },
      order: { count: 'DESC' },
      take: 5,
    });

    // 최근 이벤트 8건 (미니 로그)
    const recentEvents = await this.eventRepo.find({
      where: { projectId },
      order: { occurredAt: 'DESC' },
      take: 8,
    });

    // 한 줄 건강 판정
    let health: 'ok' | 'warn' | 'danger' = 'ok';
    if (failingChecks > 0 || openGroups >= 10) health = 'danger';
    else if (openGroups > 0) health = 'warn';

    return {
      health,
      openGroups,
      events24h,
      totalChecks: checks.length,
      failingChecks,
      topErrors,
      recentEvents,
    };
  }

  // 대시보드 첫 화면: 프로젝트의 에러 그룹 목록 (최근 발생 순)
  async findGroups(projectId: number, userId: number, status?: string) {
    await this.projectsService.assertOwner(projectId, userId);

    return this.groupRepo.find({
      where: status ? { projectId, status } : { projectId },
      order: { lastSeenAt: 'DESC' },
      take: 100,
    });
  }

  // 터미널 로그 뷰: 최근 이벤트를 시간 역순으로 (tail -f 의 재료)
  async findRecentEvents(projectId: number, userId: number) {
    await this.projectsService.assertOwner(projectId, userId);

    return this.eventRepo.find({
      where: { projectId },
      order: { occurredAt: 'DESC' },
      take: 100,
    });
  }

  // 그룹 상세: 요약 + 최근 이벤트 원본 20건 (스택, traceId 포함)
  async findGroupDetail(groupId: number, userId: number) {
    const group = await this.groupRepo.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException(`group ${groupId} not found`);
    await this.projectsService.assertOwner(group.projectId, userId);

    const recentEvents = await this.eventRepo.find({
      where: { groupId },
      order: { occurredAt: 'DESC' },
      take: 20,
    });

    return { group, recentEvents };
  }

  // 이 메모들이 유사 장애 검색의 지식베이스가 된다.
  // 메모 없이 resolve만 하면 지식이 안 쌓이므로, 화면에서는 메모 입력을 유도한다
  async resolveGroup(groupId: number, userId: number, note?: string) {
    const group = await this.groupRepo.findOneBy({ id: groupId });
    if (!group) throw new NotFoundException(`group ${groupId} not found`);
    await this.projectsService.assertOwner(group.projectId, userId);

    await this.groupRepo.update(groupId, {
      status: 'resolved',
      resolveNote: note ?? null,
      resolvedAt: new Date(),
    });
    return { id: groupId, status: 'resolved', resolveNote: note ?? null };
  }
}
