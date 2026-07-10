import {
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { EventsService } from './events.service';

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

  // PATCH /groups/10/resolve
  @Patch('groups/:id/resolve')
  resolve(@Param('id', ParseIntPipe) id: number) {
    return this.eventsService.resolveGroup(id);
  }
}
