import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CheckRunnerService } from '../checks/check-runner.service';
import { SyntheticCheck } from '../checks/synthetic-check.entity';
import { ErrorEvent } from '../events/error-event.entity';
import { ErrorGroup } from '../events/error-group.entity';
import { Project } from '../projects/project.entity';
import { AlertService } from './alert.service';
import { GroupingService } from './grouping.service';
import { SimilarIncidentsService } from './similar-incidents.service';
import { WatchdogService } from './watchdog.service';

// 컨슈머 프로세스 전용 모듈. HTTP 컨트롤러가 없다.
// API 서버(app.module)와 분리해서, 워커가 웹 서버 없이 가볍게 뜨게 한다.
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3306),
      username: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? 'kanari-dev',
      database: process.env.DB_NAME ?? 'kanari',
      autoLoadEntities: true,
      synchronize: true,
    }),
    // 워치독(@Cron)이 동작하려면 스케줄 모듈이 필요하다.
    // API가 아니라 워커에만 다는 이유: 두 프로세스에 다 달면 같은 감시가 두 번 돈다
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([ErrorGroup, ErrorEvent, Project, SyntheticCheck]),
  ],
  providers: [
    GroupingService,
    AlertService,
    WatchdogService,
    CheckRunnerService,
    SimilarIncidentsService,
  ],
})
export class WorkerModule {}
