import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Repository } from 'typeorm';
import { CheckResult, CheckRunnerService } from './check-runner.service';
import { SyntheticCheck } from './synthetic-check.entity';

class CreateCheckDto {
  @IsString()
  @MaxLength(100)
  name: string;

  // 로컬 개발에서 localhost를 등록할 수 있게 require_tld를 끈다
  @IsUrl({ require_tld: false })
  @MaxLength(1000)
  url: string;

  @IsOptional()
  @IsIn(['GET', 'POST', 'HEAD'])
  method?: string;

  @IsOptional()
  @IsInt()
  @Min(100)
  @Max(599)
  expectedStatus?: number;

  @IsOptional()
  @IsInt()
  @Min(60) // 1분보다 촘촘한 주기는 받지 않는다. 워치독 자체가 1분 주기라 의미가 없다
  intervalSec?: number;
}

@Controller()
export class ChecksController {
  constructor(
    @InjectRepository(SyntheticCheck)
    private readonly checkRepo: Repository<SyntheticCheck>,
    private readonly checkRunner: CheckRunnerService,
  ) {}

  // POST /projects/1/checks  { "name": "메인 API", "url": "https://..." }
  @Post('projects/:projectId/checks')
  create(
    @Param('projectId', ParseIntPipe) projectId: number,
    @Body() dto: CreateCheckDto,
  ) {
    return this.checkRepo.save({ projectId, ...dto });
  }

  @Get('projects/:projectId/checks')
  findAll(@Param('projectId', ParseIntPipe) projectId: number) {
    return this.checkRepo.findBy({ projectId });
  }

  @Delete('checks/:id')
  async remove(@Param('id', ParseIntPipe) id: number) {
    await this.checkRepo.delete(id);
    return { deleted: id };
  }

  // POST /checks/1/run - 주기를 기다리지 않고 즉시 1회 실행
  @Post('checks/:id/run')
  async runNow(@Param('id', ParseIntPipe) id: number) {
    const check = await this.checkRepo.findOneBy({ id });
    if (!check) throw new NotFoundException(`check ${id} not found`);
    return this.checkRunner.runOne(check);
  }

  // POST /projects/1/checks/run-all - 배포 스모크 테스트용.
  // 배포 파이프라인 마지막 단계에서 이 API를 한 번 호출하면
  // 핵심 기능이 배포 직후에 살아있는지 즉시 확인된다
  @Post('projects/:projectId/checks/run-all')
  async runAll(@Param('projectId', ParseIntPipe) projectId: number) {
    const checks = await this.checkRepo.findBy({ projectId, enabled: true });
    const results: CheckResult[] = [];
    for (const check of checks) {
      results.push(await this.checkRunner.runOne(check));
    }
    return { total: results.length, results };
  }
}
