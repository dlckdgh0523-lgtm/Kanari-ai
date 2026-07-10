import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorEvent } from '../events/error-event.entity';
import { ErrorGroup } from '../events/error-group.entity';
import { Project } from '../projects/project.entity';
import { AlertService } from './alert.service';
import { GroupingService } from './grouping.service';

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
    TypeOrmModule.forFeature([ErrorGroup, ErrorEvent, Project]),
  ],
  providers: [GroupingService, AlertService],
})
export class WorkerModule {}
