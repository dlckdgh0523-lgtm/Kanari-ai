import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// 배포 기록(마커). CI(GitHub Actions)나 SDK가 "방금 배포했다"고 알려주면 남긴다.
// 배포 시각을 기준으로 "배포 직후 에러가 급증했는가"를 판단해 롤백 신호를 준다.
@Entity('deploys')
export class Deploy {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column()
  projectId: number;

  // 배포한 버전 (git SHA, 태그 등)
  @Column({ length: 100 })
  release: string;

  // 배포 직후 이 배포에서 처음 생긴 신규 에러 그룹 수. 워치독이 갱신한다
  @Column({ default: 0 })
  newErrorCount: number;

  @CreateDateColumn()
  deployedAt: Date;
}
