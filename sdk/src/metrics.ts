// ---------------------------------------------------------------
// 카나리 APM (라우트 레벨 성능 수집)
//
// 사용법 (Express / NestJS 공통):
//   import { KanariMetrics } from 'kanari';
//   const metrics = new KanariMetrics({ apiKey: 'kn_...', endpoint: '...' });
//   app.use(metrics.middleware());
//
// 동작 원리:
// 요청마다 걸린 시간을 재서 라우트별로 메모리에 집계하고(카운트, 에러 수,
// 시간 분포 버킷), 60초마다 한 번만 서버로 보낸다. 요청마다 보내면
// 모니터링이 트래픽을 배로 만드는 주객전도가 되기 때문이다.
// 임계치(기본 1초)를 넘는 느린 요청만 개별 샘플로 함께 보낸다.
//
// 에러 SDK와 같은 원칙: 전송 실패는 조용히 버린다. 본 서비스가 우선이다.
// ---------------------------------------------------------------

export interface KanariMetricsOptions {
  apiKey: string;
  endpoint?: string;
  /** 집계 전송 주기(ms). 기본 60초 */
  flushIntervalMs?: number;
  /** 이 시간(ms)을 넘는 요청은 개별 샘플로도 보낸다. 기본 1000 */
  slowThresholdMs?: number;
}

// 응답시간 분포를 담는 버킷 경계(ms). p95는 서버가 이 분포에서 계산한다.
// 원시값을 다 보내는 대신 분포만 보내는 것이 APM의 표준 절충이다
export const BUCKET_EDGES = [10, 25, 50, 100, 250, 500, 1000, 3000];

interface RouteAgg {
  count: number;
  errorCount: number;
  totalMs: number;
  maxMs: number;
  buckets: number[]; // BUCKET_EDGES 길이 + 1 (마지막은 3000ms 초과)
}

interface SlowSample {
  route: string;
  method: string;
  durationMs: number;
  statusCode: number;
  traceId?: string;
  occurredAt: string;
}

// Express 스타일 미들웨어 시그니처 (Nest도 내부적으로 Express라 그대로 동작)
type Req = {
  method: string;
  path?: string;
  route?: { path?: string };
  headers: Record<string, unknown>;
};
type Res = {
  statusCode: number;
  on: (event: string, cb: () => void) => void;
};

export class KanariMetrics {
  private readonly apiKey: string;
  private readonly url: string;
  private readonly slowThresholdMs: number;
  private aggs = new Map<string, RouteAgg>();
  private slow: SlowSample[] = [];

  constructor(opts: KanariMetricsOptions) {
    this.apiKey = opts.apiKey;
    this.url =
      (opts.endpoint ?? 'http://localhost:3000').replace(/\/$/, '') +
      '/ingest/metrics';
    this.slowThresholdMs = opts.slowThresholdMs ?? 1000;

    const timer = setInterval(
      () => void this.flush(),
      opts.flushIntervalMs ?? 60_000,
    );
    timer.unref();
  }

  middleware() {
    return (req: Req, res: Res, next: () => void) => {
      const startedAt = Date.now();

      // finish는 응답이 클라이언트로 다 나간 시점. 여기서 재야
      // 미들웨어 체인 전체가 아니라 실제 처리 시간이 잡힌다
      res.on('finish', () => {
        try {
          const ms = Date.now() - startedAt;
          // 라우트 패턴(/users/:id)을 쓴다. 실제 경로(/users/42)를 쓰면
          // 집계 키가 무한히 늘어난다 (서버 메트릭에서 배운 카디널리티 교훈)
          const route = req.route?.path ?? req.path ?? 'unknown';
          this.record(req.method, route, res.statusCode, ms, req);
        } catch {
          // 계측 실패가 본 서비스에 번지면 안 된다
        }
      });

      next();
    };
  }

  private record(method: string, route: string, status: number, ms: number, req: Req) {
    const key = method + ' ' + route;
    let agg = this.aggs.get(key);
    if (!agg) {
      agg = {
        count: 0,
        errorCount: 0,
        totalMs: 0,
        maxMs: 0,
        buckets: new Array(BUCKET_EDGES.length + 1).fill(0),
      };
      this.aggs.set(key, agg);
    }

    agg.count += 1;
    if (status >= 500) agg.errorCount += 1;
    agg.totalMs += ms;
    if (ms > agg.maxMs) agg.maxMs = ms;

    let idx = BUCKET_EDGES.findIndex((edge) => ms <= edge);
    if (idx === -1) idx = BUCKET_EDGES.length;
    agg.buckets[idx] += 1;

    if (ms >= this.slowThresholdMs && this.slow.length < 50) {
      const traceId = req.headers['x-trace-id'];
      this.slow.push({
        route,
        method,
        durationMs: ms,
        statusCode: status,
        traceId: typeof traceId === 'string' ? traceId : undefined,
        occurredAt: new Date().toISOString(),
      });
    }
  }

  private async flush() {
    if (this.aggs.size === 0 && this.slow.length === 0) return;

    const stats = [...this.aggs.entries()].map(([key, agg]) => {
      const [method, ...rest] = key.split(' ');
      return { method, route: rest.join(' '), ...agg };
    });
    const slow = this.slow;
    this.aggs = new Map();
    this.slow = [];

    try {
      await fetch(this.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-kanari-key': this.apiKey,
        },
        body: JSON.stringify({ stats, slow }),
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // 이번 1분치는 버린다. 성능 지표는 다음 분에 또 온다
    }
  }
}
