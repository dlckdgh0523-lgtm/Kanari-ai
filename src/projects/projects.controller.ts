import { Body, Controller, Get, Post } from '@nestjs/common';
import { IsOptional, IsString, IsUrl, MaxLength } from 'class-validator';
import { ProjectsService } from './projects.service';

class CreateProjectDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsUrl()
  discordWebhookUrl?: string;
}

@Controller('projects')
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  // POST /projects  { "name": "jinro-backend" }
  // 응답에 apiKey가 들어 있다. 이 값을 SDK 설정에 넣으면 된다.
  @Post()
  create(@Body() dto: CreateProjectDto) {
    return this.projectsService.create(dto.name, dto.discordWebhookUrl);
  }

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }
}
