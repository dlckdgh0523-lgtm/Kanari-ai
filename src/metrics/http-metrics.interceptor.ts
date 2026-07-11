import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Counter, Histogram } from 'prom-client';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

// 요청당 두 가지를 기록한다.
// 라벨에 path 원본을 쓰지 않고 라우트 패턴(/groups/:id)을 쓰는 이유:
// /groups/1, /groups/2 ... 를 전부 다른 라벨로 만들면
// 메트릭 종류가 무한히 늘어나 Prometheus가 감당을 못 한다 (카디널리티 폭발)
const requestsTotal = new Counter({
  name: 'kanari_http_requests_total',
  help: 'HTTP 요청 수',
  labelNames: ['method', 'route', 'status'],
});

const requestDuration = new Histogram({
  name: 'kanari_http_request_duration_seconds',
  help: 'HTTP 요청 처리 시간(초)',
  labelNames: ['method', 'route'],
  // 알람 기준이 될 p95를 계산하려면 구간(버킷)이 필요하다
  buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 3, 5],
});

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest();
    const method: string = req.method;
    const route: string = req.route?.path ?? req.path ?? 'unknown';
    const endTimer = requestDuration.startTimer({ method, route });

    return next.handle().pipe(
      tap({
        next: () => {
          endTimer();
          const status = context.switchToHttp().getResponse().statusCode;
          requestsTotal.inc({ method, route, status });
        },
        error: () => {
          endTimer();
          // 예외는 필터에서 상태코드가 정해지므로 여기서는 5xx로 집계한다
          requestsTotal.inc({ method, route, status: 500 });
        },
      }),
    );
  }
}
