import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// 카나리를 붙이는 서비스 하나가 프로젝트 하나다. (예: jinro-backend, chungaba-backend)
@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  // 이 프로젝트를 만든 콘솔 사용자. null이면 콘솔 도입 전에 만든 개발용 데이터
  @Column({ type: 'int', nullable: true })
  ownerId: number | null;

  // API 키 원문은 저장하지 않는다. 발급 순간에 한 번 보여주고, DB에는 SHA-256 해시만 남긴다.
  // DB가 유출되어도 키를 복원할 수 없게 하기 위해서다.
  @Index({ unique: true })
  @Column({ length: 64 })
  apiKeyHash: string;

  // 프로젝트 전용 Discord 웹훅. 비어 있으면 .env의 기본 웹훅을 쓴다.
  @Column({ type: 'varchar', length: 500, nullable: true })
  discordWebhookUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
