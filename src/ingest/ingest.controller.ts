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

  // POST /ingest/metrics - SDK(KanariMetrics)가 60초마다 보내는 성능 집계.
  // 구조 검증은 컨슈머 쪽에서 관대하게 처리한다 (분포 숫자 배열이라 DTO가 과함)
  @Post('metrics')
  @HttpCode(202)
  @UseGuards(ApiKeyGuard)
  async ingestMetrics(
    @Body() body: { stats?: unknown[]; slow?: unknown[] },
    @Req() req: { project: Project },
  ) {
    await this.ingestService.publishMetrics(req.project.id, {
      stats: Array.isArray(body.stats) ? body.stats.slice(0, 200) : [],
      slow: Array.isArray(body.slow) ? body.slow.slice(0, 50) : [],
    });
    return { accepted: true };
  }

  // POST /ingest/deploy - 배포 마커. CI(GitHub Actions)나 배포 스크립트가
  // "방금 이 버전 배포했다"고 알려주면, 이후 이 시각을 기준으로
  // "배포 직후 에러 급증"을 판단해 롤백 신호를 줄 수 있다.
  // API 키로 인증하므로 CI에서 curl 한 줄로 부를 수 있다
  @Post('deploy')
  @HttpCode(202)
  @UseGuards(ApiKeyGuard)
  async markDeploy(
    @Body() body: { release?: string },
    @Req() req: { project: Project },
  ) {
    const release = (body.release ?? '').slice(0, 100) || 'unknown';
    await this.ingestService.recordDeploy(req.project.id, release);
    return { accepted: true, release };
  }
}
