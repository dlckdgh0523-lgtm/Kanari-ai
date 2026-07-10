import {
  Body,
  Controller,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../common/api-key.guard';
import { Project } from '../projects/project.entity';
import { IngestBatchDto } from './dto/ingest.dto';
import { IngestService } from './ingest.service';

@Controller('ingest')
export class IngestController {
  constructor(private readonly ingestService: IngestService) {}

  // POST /ingest
  // 헤더: x-kanari-key: kn_xxxx
  // 바디: { "events": [ { "name": "TypeError", "message": "...", "stack": "..." } ] }
  @Post()
  @HttpCode(202) // 202 Accepted: 받았고, 처리는 뒤에서 한다는 뜻. 200(처리 완료)과 구분된다
  @UseGuards(ApiKeyGuard)
  async ingest(@Body() dto: IngestBatchDto, @Req() req: { project: Project }) {
    await this.ingestService.publish(req.project.id, dto.events);
    return { accepted: dto.events.length };
  }
}
