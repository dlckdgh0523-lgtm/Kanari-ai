import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

// 콘솔(웹 대시보드)에 로그인하는 사용자.
// SDK가 쓰는 API 키 인증과는 별개다: API 키는 이벤트를 보내는 권한,
// 이 계정은 자기 프로젝트를 보고 관리하는 권한이다.
@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Index({ unique: true })
  @Column({ length: 200 })
  email: string;

  // 비밀번호는 bcrypt 해시로만 저장한다. 원문은 어디에도 남지 않는다
  @Column({ length: 100 })
  passwordHash: string;

  @CreateDateColumn()
  createdAt: Date;
}
