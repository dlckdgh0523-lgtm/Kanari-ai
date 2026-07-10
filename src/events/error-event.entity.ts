import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// 에러 발생 한 건 한 건의 원본 기록.
// 그룹이 요약이라면 이벤트는 증거다. 상세 화면에서 실제 스택과 컨텍스트를 보여줄 때 쓴다.
@Entity('error_events')
export class ErrorEvent {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  groupId: number;

  @Column()
  projectId: number;

  @Column({ length: 20, default: 'error' })
  level: string;

  @Column({ length: 2000 })
  message: string;

  @Column({ type: 'text', nullable: true })
  stack: string | null;

  // 요청 경로, 사용자 ID 해시 같은 부가 정보. JSON 그대로 보관
  @Column({ type: 'json', nullable: true })
  context: Record<string, unknown> | null;

  @Index()
  @Column({ type: 'varchar', length: 100, nullable: true })
  traceId: string | null;

  @Column()
  occurredAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
