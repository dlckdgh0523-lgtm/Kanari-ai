import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { EventsService } from './events.service';

class ResolveDto {
  // 원인과 조치를 한 줄로. 예: RDS 커넥션 풀 고갈. max_connections 20 -> 50 상향
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}

// 대시보드가 사용하는 조회 API.
// 지금은 인증이 없다 - 대시보드(Phase 7)를 붙일 때 관리자 인증을 함께 단다.
@Controller()
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  // GET /projects/1/groups?status=open
  @Get('projects/:projectId/groups')
  findGroups(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Query('status') status?: string,
  ) {
    return this.eventsService.findGroups(projectId, status);
  }

  // GET /groups/10
  @Get('groups/:id')
  findGroupDetail(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.findGroupDetail(id);
  }

  // PATCH /groups/10/resolve  { "note": "원인과 조치 메모" }
  @Patch('groups/:id/resolve')
  resolve(@Param('id', ParseIntPipe) id: number, @Body() dto: ResolveDto) {
    return this.eventsService.resolveGroup(id, dto.note);
  }
}
