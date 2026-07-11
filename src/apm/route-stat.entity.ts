import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

// 라우트별 1분 단위 성능 집계.
// SDK가 원시 요청을 다 보내는 게 아니라 분포(버킷)로 압축해 보내고,
// 서버는 그 분포에서 p95 같은 지표를 계산한다. APM의 표준 절충이다.
@Entity('route_stats')
@Index(['projectId', 'minute'])
export class RouteStat {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  @Column({ length: 10 })
  method: string;

  // 라우트 패턴 (/users/:id). 실제 경로가 아니라서 종류가 폭발하지 않는다
  @Column({ length: 300 })
  route: string;

  // 이 집계가 속한 분 (초 이하 절삭). 같은 분에 여러 번 오면 합산한다
  @Column()
  minute: Date;

  @Column({ default: 0 })
  count: number;

  @Column({ default: 0 })
  errorCount: number;

  @Column({ default: 0 })
  totalMs: number;

  @Column({ default: 0 })
  maxMs: number;

  // 응답시간 분포. BUCKET_EDGES(10,25,50,100,250,500,1000,3000) + 초과 = 9칸
  @Column({ type: 'json' })
  buckets: number[];
}
