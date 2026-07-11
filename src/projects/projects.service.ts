import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { createHash, randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { Project } from './project.entity';

@Injectable()
export class ProjectsService {
  constructor(
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
  ) {}

  // 키 형식: kn_ + 랜덤 32자리 hex. 접두사를 붙여두면
  // 로그나 코드에 키가 실수로 노출됐을 때 검색으로 찾기 쉽다.
  private generateApiKey(): string {
    return 'kn_' + randomBytes(16).toString('hex');
  }

  private hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex');
  }

  async create(ownerId: number | null, name: string, discordWebhookUrl?: string) {
    const apiKey = this.generateApiKey();

    const project = await this.projectRepo.save({
      name,
      ownerId,
      apiKeyHash: this.hashApiKey(apiKey),
      discordWebhookUrl: discordWebhookUrl ?? null,
    });

    // 원문 키는 이 응답에서 단 한 번만 내려간다. 다시 조회할 방법은 없다(분실 시 재발급).
    return { id: project.id, name: project.name, apiKey };
  }

  // 내 프로젝트만 보인다. 남의 프로젝트는 존재조차 알 수 없어야 한다
  async findAllByOwner(ownerId: number) {
    return this.projectRepo.find({
      where: { ownerId },
      select: ['id', 'name', 'discordWebhookUrl', 'repoUrl', 'createdAt'],
      order: { id: 'DESC' },
    });
  }

  // 다른 모듈(에러 조회, 합성 테스트)이 공용으로 쓰는 소유권 검사.
  // ownerId가 null인 프로젝트는 콘솔 도입 전 개발 데이터라 접근 허용(로컬 한정)
  async assertOwner(projectId: number, userId: number) {
    const project = await this.projectRepo.findOneBy({ id: projectId });
    if (!project) throw new NotFoundException(`project ${projectId} not found`);
    if (project.ownerId !== null && project.ownerId !== userId) {
      throw new ForbiddenException('내 프로젝트가 아닙니다');
    }
    return project;
  }

  async updateWebhook(projectId: number, userId: number, url: string | null) {
    await this.assertOwner(projectId, userId);
    await this.projectRepo.update(projectId, { discordWebhookUrl: url });
    return { id: projectId, discordWebhookUrl: url };
  }

  async updateRepo(projectId: number, userId: number, repoUrl: string | null) {
    await this.assertOwner(projectId, userId);
    await this.projectRepo.update(projectId, { repoUrl });
    return { id: projectId, repoUrl };
  }

  // 인증 가드가 사용한다. 클라이언트가 보낸 키를 해시해서 DB의 해시와 비교
  async findByApiKey(apiKey: string): Promise<Project | null> {
    return this.projectRepo.findOneBy({ apiKeyHash: this.hashApiKey(apiKey) });
  }

  async findByIdOrFail(id: number): Promise<Project> {
    const project = await this.projectRepo.findOneBy({ id });
    if (!project) throw new NotFoundException(`project ${id} not found`);
    return project;
  }
}
