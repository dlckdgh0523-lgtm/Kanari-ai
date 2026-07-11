import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventsService } from './events.service';

class ResolveDto {
  // 원인과 조치를 한 줄로. 예: RDS 커넥션 풀 고갈. max_connections 20 -> 50 상향
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

type AuthedRequest = { user: { id: number; email: string } };

// 대시보드가 사용하는 조회 API. 전부 로그인 + 자기 프로젝트만
@Controller()
@UseGuards(JwtAuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // GET /projects/1/overview - 통합 개요 (프로젝트 첫 화면)
  @Get('projects/:projectId/overview')
  overview(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: AuthedRequest,
  ) {
    return this.eventsService.overview(projectId, req.user.id);
  }

  // GET /projects/1/groups?status=open
  @Get('projects/:projectId/groups')
  findGroups(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: AuthedRequest,
    @Query('status') status?: string,
  ) {
    return this.eventsService.findGroups(projectId, req.user.id, status);
  }

  // GET /projects/1/events - 터미널 로그 뷰용 최근 이벤트 흐름
  @Get('projects/:projectId/events')
  findRecentEvents(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: AuthedRequest,
  ) {
    return this.eventsService.findRecentEvents(projectId, req.user.id);
  }

  // GET /groups/10
  @Get('groups/:id')
  findGroupDetail(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthedRequest,
  ) {
    return this.eventsService.findGroupDetail(id, req.user.id);
  }

  // GET /groups/10/suspect - 코드 링크 + 용의자 커밋 (GitHub 연결 시)
  @Get('groups/:id/suspect')
  findSuspect(
    @Param('id', ParseIntPipe) id: number,
    @Req() req: AuthedRequest,
  ) {
    return this.eventsService.findSuspect(id, req.user.id);
  }

  // PATCH /groups/10/resolve  { "note": "원인과 조치 메모" }
  @Patch('groups/:id/resolve')
  resolve(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResolveDto,
    @Req() req: AuthedRequest,
  ) {
    return this.eventsService.resolveGroup(id, req.user.id, dto.note);
  }
}
