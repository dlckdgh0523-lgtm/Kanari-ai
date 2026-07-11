import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { SyntheticCheck } from '../checks/synthetic-check.entity';
import { ProjectsModule } from '../projects/projects.module';
import { ErrorEvent } from './error-event.entity';
import { ErrorGroup } from './error-group.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ErrorGroup, ErrorEvent, SyntheticCheck]),
    AuthModule, // JwtAuthGuard
    ProjectsModule, // 소유권 검사
  ],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
