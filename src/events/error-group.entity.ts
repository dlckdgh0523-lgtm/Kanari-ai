import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// 같은 원인으로 판정된 에러들의 묶음.
// TypeError가 1,000번 나도 그룹은 1개, count가 1000이 된다.
// 알람은 이벤트가 아니라 그룹 기준으로 울린다. 이게 알람 스팸을 막는 핵심 구조다.
@Entity('error_groups')
// 같은 프로젝트 안에서 fingerprint는 하나뿐이어야 한다.
// 컨슈머 두 개가 동시에 같은 에러를 처리해도 DB가 중복 생성을 막아준다.
@Index(['projectId', 'fingerprint'], { unique: true })
export class ErrorGroup {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  projectId: number;

  // 스택트레이스에서 뽑은 지문. 계산 방법은 grouping/fingerprint.ts 참조
  @Column({ length: 40 })
  fingerprint: string;

  // 에러 클래스 이름 (예: TypeError)
  @Column({ length: 200 })
  name: string;

  // 이 그룹을 처음 만든 이벤트의 메시지. 목록 화면에서 대표로 보여준다
  @Column({ length: 2000 })
  message: string;

  // 스택 최상단의 우리 코드 위치 (예: src/users/users.service.ts). 어디가 터졌는지 한눈에 보기용
  @Column({ length: 500, default: '' })
  topFrame: string;

  @Column({ length: 20, default: 'open' }) // open | resolved
  status: string;

  @Column({ default: 0 })
  count: number;

  @Column()
  firstSeenAt: Date;

  @Column()
  lastSeenAt: Date;

  // 마지막으로 급증 알람을 보낸 시각. 워치독이 30분 쿨다운 판단에 쓴다
  @Column({ type: 'datetime', nullable: true })
  lastSpikeAlertAt: Date | null;

  // 해결하면서 남기는 원인/조치 메모. 이 메모가 쌓이면
  // 다음에 비슷한 에러가 왔을 때 "지난번엔 이렇게 고쳤다"를 알려주는 지식베이스가 된다
  @Column({ type: 'text', nullable: true })
  resolveNote: string | null;

  @Column({ type: 'datetime', nullable: true })
  resolvedAt: Date | null;

  // 이 에러가 처음 나타난 배포 버전. "어느 배포에서 생겼나"를 답한다
  @Column({ type: 'varchar', length: 100, nullable: true })
  firstRelease: string | null;

  // resolved된 에러가 다시 나타나면 회귀(regression)다. 재발 여부와 시각을 기록한다
  @Column({ default: false })
  regressed: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
