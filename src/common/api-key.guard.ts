import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ProjectsService } from '../projects/projects.service';

// SDK가 보내는 x-kanari-key 헤더를 검사하는 인증 가드.
// 키가 맞으면 어느 프로젝트의 요청인지 찾아서 request.project 에 실어준다.
// 이후 컨트롤러는 헤더를 다시 볼 필요 없이 request.project 만 쓰면 된다.
@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly projectsService: ProjectsService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = request.headers['x-kanari-key'];

    if (!apiKey || typeof apiKey !== 'string') {
      throw new UnauthorizedException('x-kanari-key header is required');
    }

    const project = await this.projectsService.findByApiKey(apiKey);
    if (!project) {
      throw new UnauthorizedException('invalid api key');
    }

    request.project = project;
    return true;
  }
}
