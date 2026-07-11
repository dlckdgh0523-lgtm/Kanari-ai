import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import * as bcrypt from 'bcrypt';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(email: string, password: string) {
    const exists = await this.userRepo.findOneBy({ email });
    if (exists) throw new ConflictException('이미 가입된 이메일입니다');

    const user = await this.userRepo.save({
      email,
      // 10라운드: bcrypt 기본 권장값. 숫자가 클수록 느려져서 무차별 대입이 힘들어진다
      passwordHash: await bcrypt.hash(password, 10),
    });

    return this.issueToken(user);
  }

  async login(email: string, password: string) {
    const user = await this.userRepo.findOneBy({ email });

    // 이메일이 틀렸는지 비밀번호가 틀렸는지 구분해서 알려주지 않는다.
    // 구분해 주면 공격자가 가입된 이메일 목록을 수집할 수 있다
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 맞지 않습니다');
    }

    return this.issueToken(user);
  }

  private issueToken(user: User) {
    return {
      token: this.jwtService.sign({ sub: user.id, email: user.email }),
      email: user.email,
    };
  }
}
