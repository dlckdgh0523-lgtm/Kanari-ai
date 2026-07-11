import { Controller, Get, Header, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { register } from 'prom-client';
import { collectDefaultMetrics } from 'prom-client';
import { HttpMetricsInterceptor } from './http-metrics.interceptor';

// Prometheus가 주기적으로 긁어가는(/metrics) 지표 노출 모듈.
//
// 로그와 메트릭의 역할 차이:
//   로그 = 무슨 일이 있었는지의 문장 (한 건 한 건)
//   메트릭 = 얼마나 많이/빨리의 숫자 (집계)
// 에러율이 치솟는 건 메트릭 그래프로 먼저 보이고, 원인은 로그로 파고든다.

// Node.js 프로세스 기본 지표 (이벤트 루프 지연, 메모리, GC 등)
collectDefaultMetrics();

@Controller()
class MetricsController {
  // GET /metrics - Prometheus 표준 텍스트 포맷
  @Get('metrics')
  @Header('content-type', 'text/plain')
  async metrics() {
    return register.metrics();
  }
}

@Module({
  controllers: [MetricsController],
  providers: [
    // 모든 HTTP 요청의 횟수와 소요 시간을 자동 집계한다
    { provide: APP_INTERCEPTOR, useClass: HttpMetricsInterceptor },
  ],
})
export class MetricsModule {}
