import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// 합성 테스트(Synthetic Check): 등록해 둔 핵심 API를 카나리가 주기적으로 실제 호출해 본다.
//
// 왜 필요한가: 에러 수집(SDK)은 코드가 예외를 던져야만 잡힌다.
// 서버가 살아있고 HTTP 200을 주지만 내용이 깨진 장애, 아예 요청이 도달 못 하는 장애는
// 능동적으로 호출해 보지 않으면 알 수 없다. 수동 수집과 능동 감시는 서로의 사각지대를 메운다.
@Entity('synthetic_checks')
export class SyntheticCheck {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  projectId: number;

  @Column({ length: 100 })
  name: string;

  @Column({ length: 1000 })
  url: string;

  @Column({ length: 10, default: 'GET' })
  method: string;

  @Column({ default: 200 })
  expectedStatus: number;

  // 실행 주기(초). 기본 5분. 실무 사례에서 확인한 값이다 (핑보다 촘촘할 필요는 없다)
  @Column({ default: 300 })
  intervalSec: number;

  @Column({ default: true })
  enabled: boolean;

  @Column({ length: 20, default: 'unknown' }) // unknown | ok | fail
  lastStatus: string;

  // 연속 실패 횟수. 일시적인 네트워크 흔들림 오탐을 막기 위해
  // 2회 연속 실패했을 때만 알람을 보낸다
  @Column({ default: 0 })
  failStreak: number;

  // 실패 알람을 보낸 시각. 값이 있으면 지금 장애 상태라는 뜻이고,
  // 다시 성공하면 회복 알림을 보내고 비운다
  @Column({ type: 'datetime', nullable: true })
  alertedAt: Date | null;

  @Column({ type: 'datetime', nullable: true })
  lastCheckedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}
