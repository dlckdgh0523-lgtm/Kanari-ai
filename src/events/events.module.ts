import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ErrorEvent } from './error-event.entity';
import { ErrorGroup } from './error-group.entity';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [TypeOrmModule.forFeature([ErrorGroup, ErrorEvent])],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
