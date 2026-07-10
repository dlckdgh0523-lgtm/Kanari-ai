import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { IngestController } from './ingest.controller';
import { IngestService } from './ingest.service';

@Module({
  imports: [ProjectsModule], // ApiKeyGuard가 ProjectsService를 주입받기 위해 필요
  controllers: [IngestController],
  providers: [IngestService],
})
export class IngestModule {}
