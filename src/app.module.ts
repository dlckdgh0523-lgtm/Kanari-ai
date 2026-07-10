import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from './projects/projects.module';
import { IngestModule } from './ingest/ingest.module';
import { EventsModule } from './events/events.module';
import { ChecksModule } from './checks/checks.module';

@Module({
  imports: [
    // .env 파일을 읽어 process.env 로 올려준다. isGlobal이라 다른 모듈에서 import 불필요
    ConfigModule.forRoot({ isGlobal: true }),

    TypeOrmModule.forRoot({
      type: 'mysql',
      host: process.env.DB_HOST ?? 'localhost',
      port: Number(process.env.DB_PORT ?? 3306),
      username: process.env.DB_USER ?? 'root',
      password: process.env.DB_PASSWORD ?? 'kanari-dev',
      database: process.env.DB_NAME ?? 'kanari',
      autoLoadEntities: true,
      // 개발 단계에서만 스키마 자동 반영. 운영에서는 migration으로 바꿔야 한다 (Phase 6에서 전환)
      synchronize: true,
    }),

    ProjectsModule,
    IngestModule,
    EventsModule,
    ChecksModule,
  ],
})
export class AppModule {}
