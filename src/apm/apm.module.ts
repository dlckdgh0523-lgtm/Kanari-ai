import { Controller, Get, Module, Param, ParseIntPipe, Req, UseGuards } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsModule } from '../projects/projects.module';
import { ApmService } from './apm.service';
import { RouteStat } from './route-stat.entity';
import { SlowSample } from './slow-sample.entity';

type AuthedRequest = { user: { id: number; email: string } };

// 콘솔 APM 화면용 조회 API
@Controller()
@UseGuards(JwtAuthGuard)
class ApmController {
  constructor(private readonly apmService: ApmService) {}

  // GET /projects/1/apm - 최근 1시간 라우트별 성능 + 느린 요청 샘플
  @Get('projects/:projectId/apm')
  overview(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Req() req: AuthedRequest,
  ) {
    return this.apmService.overview(projectId, req.user.id);
  }
}

@Module({
  imports: [
    TypeOrmModule.forFeature([RouteStat, SlowSample]),
    AuthModule,
    ProjectsModule,
  ],
  controllers: [ApmController],
  providers: [ApmService],
  exports: [ApmService],
})
export class ApmModule {}
