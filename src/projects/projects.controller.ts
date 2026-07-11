import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectsService } from './projects.service';

class CreateProjectDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsUrl()
  discordWebhookUrl?: string;
}

class UpdateWebhookDto {
  // 빈 문자열을 보내면 웹훅을 해제한다
  @IsOptional()
  @IsString()
  @MaxLength(500)
  discordWebhookUrl?: string;
}

type AuthedRequest = { user: { id: number; email: string } };

// 콘솔 전용 API. 전부 로그인이 필요하고, 자기 프로젝트만 다룰 수 있다
@Controller('projects')
@UseGuards(JwtAuthGuard)
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // POST /projects  { "name": "jinro-backend" }
  // 응답에 apiKey가 들어 있다. 이 값을 SDK 설정에 넣으면 된다
  @Post()
  create(@Body() dto: CreateProjectDto, @Req() req: AuthedRequest) {
    return this.projectsService.create(req.user.id, dto.name, dto.discordWebhookUrl);
  }

  @Get()
  findAll(@Req() req: AuthedRequest) {
    return this.projectsService.findAllByOwner(req.user.id);
  }

  // PATCH /projects/1/webhook  { "discordWebhookUrl": "https://discord.com/api/webhooks/..." }
  @Patch(':id/webhook')
  updateWebhook(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateWebhookDto,
    @Req() req: AuthedRequest,
  ) {
    return this.projectsService.updateWebhook(
      id,
      req.user.id,
      dto.discordWebhookUrl || null,
    );
  }
}
