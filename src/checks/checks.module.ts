import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Project } from '../projects/project.entity';
import { ProjectsModule } from '../projects/projects.module';
import { AlertService } from '../grouping/alert.service';
import { CheckRunnerService } from './check-runner.service';
import { ChecksController } from './checks.controller';
import { SyntheticCheck } from './synthetic-check.entity';

@Module({
  // AlertService가 프로젝트별 웹훅을 찾을 때 Project 레포지토리를 쓴다
  imports: [
    TypeOrmModule.forFeature([SyntheticCheck, Project]),
    AuthModule,
    ProjectsModule,
  ],
  controllers: [ChecksController],
  providers: [CheckRunnerService, AlertService],
})
export class ChecksModule {}
