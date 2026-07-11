import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// 임계치(기본 1초)를 넘긴 느린 요청의 개별 기록.
// 집계는 "무엇이 느린가"를, 샘플은 "예를 들면 이 요청"을 보여준다.
@Entity('slow_samples')
export class SlowSample {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  projectId: number;

  @Column({ length: 10 })
  method: string;

  @Column({ length: 300 })
  route: string;

  @Column()
  durationMs: number;

  @Column()
  statusCode: number;

  @Column({ type: 'varchar', length: 100, nullable: true })
  traceId: string | null;

  @Column()
  occurredAt: Date;

  @CreateDateColumn()
  createdAt: Date;
}
