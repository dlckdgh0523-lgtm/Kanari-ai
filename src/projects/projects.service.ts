import { Injectable, NotFoundException } from '@nestjs/common';
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

  async create(name: string, discordWebhookUrl?: string) {
    const apiKey = this.generateApiKey();

    const project = await this.projectRepo.save({
      name,
      apiKeyHash: this.hashApiKey(apiKey),
      discordWebhookUrl: discordWebhookUrl ?? null,
    });

    // 원문 키는 이 응답에서 단 한 번만 내려간다. 다시 조회할 방법은 없다(분실 시 재발급).
    return { id: project.id, name: project.name, apiKey };
  }

  async findAll() {
    return this.projectRepo.find({
      select: ['id', 'name', 'createdAt'], // 키 해시는 목록에 내려주지 않는다
      order: { id: 'DESC' },
    });
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
