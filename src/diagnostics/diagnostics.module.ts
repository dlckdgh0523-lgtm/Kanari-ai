import {
  Body,
  Controller,
  Module,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsInt, IsOptional, IsUrl, Max, Min } from 'class-validator';
import { AuthModule } from '../auth/auth.module';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsModule } from '../projects/projects.module';
import { ProjectsService } from '../projects/projects.service';
import { DiagnosticsService } from './diagnostics.service';

class ScanDto {
  @IsUrl({ require_tld: false })
  url: string;
}

class LoadTestDto {
  @IsUrl({ require_tld: false })
  url: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  concurrency?: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(500)
  totalRequests?: number;
}

type AuthedRequest = { user: { id: number; email: string } };

@Controller('projects/:projectId/diagnostics')
@UseGuards(JwtAuthGuard)
class DiagnosticsController {
  constructor(
    private readonly diagnostics: DiagnosticsService,
    private readonly projectsService: ProjectsService,
  ) {}

  // POST /projects/1/diagnostics/security  { url }
  @Post('security')
  async security(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: ScanDto,
    @Req() req: AuthedRequest,
  ) {
    await this.projectsService.assertOwner(projectId, req.user.id);
    const findings = await this.diagnostics.securityScan(dto.url);
    return { findings };
  }

  // POST /projects/1/diagnostics/load  { url, concurrency, totalRequests }
  @Post('load')
  async load(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: LoadTestDto,
    @Req() req: AuthedRequest,
  ) {
    await this.projectsService.assertOwner(projectId, req.user.id);
    return this.diagnostics.loadTest(
      dto.url,
      dto.concurrency ?? 10,
      dto.totalRequests ?? 100,
    );
  }
}

@Module({
  imports: [AuthModule, ProjectsModule],
  controllers: [DiagnosticsController],
  providers: [DiagnosticsService],
})
export class DiagnosticsModule {}
