import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// 콘솔 API 보호 가드. Authorization: Bearer <token> 을 검증하고
// request.user = { id, email } 을 실어준다.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const header: string | undefined = request.headers['authorization'];

    if (!header?.startsWith('Bearer ')) {
      throw new UnauthorizedException('로그인이 필요합니다');
    }

    try {
      const payload = await this.jwtService.verifyAsync(header.slice(7));
      request.user = { id: payload.sub, email: payload.email };
      return true;
    } catch {
      throw new UnauthorizedException('세션이 만료됐습니다. 다시 로그인해 주세요');
    }
  }
}
