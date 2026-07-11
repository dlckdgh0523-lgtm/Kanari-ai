import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectsModule } from './projects/projects.module';
import { IngestModule } from './ingest/ingest.module';
import { EventsModule } from './events/events.module';
import { AuthModule } from './auth/auth.module';
import { ChecksModule } from './checks/checks.module';
import { MetricsModule } from './metrics/metrics.module';

@Module({
  imports: [
    // .env 파일을 읽어 process.env 로 올려준다. isGlobal이라 다른 모듈에서 import 불필요
    ConfigModule.forRoot({ isGlobal: true }),

    // IP당 분당 요청 수 제한. 키를 훔치지 못한 공격자가 무차별 요청으로
    // 서버를 괴롭히거나(DoS), 키를 무작위 대입하는 것을 느리게 만든다
    ThrottlerModule.forRoot({ throttlers: [{ ttl: 60_000, limit: 120 }] }),

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

    AuthModule,
    ProjectsModule,
    IngestModule,
    EventsModule,
    ChecksModule,
    MetricsModule,
  ],
  providers: [
    // 레이트리밋을 모든 라우트에 기본 적용한다
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
