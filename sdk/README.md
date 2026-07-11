# kanari (SDK)

카나리 서버로 에러를 보내는 Winston transport.

## 설치

```bash
npm install kanari winston
```

## 사용

```ts
import winston from 'winston';
import { KanariTransport } from 'kanari';

const logger = winston.createLogger({
  // errors({ stack: true })가 있어야 Error 객체의 스택이 전송된다
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console(),
    new KanariTransport({
      apiKey: process.env.KANARI_API_KEY!,
      endpoint: 'http://localhost:3000',
      // try/catch도 logger.error도 놓친 예외까지 자동 포착
      captureGlobalErrors: true,
      // 배포 버전. 이 값이 있어야 회귀 감지와 "어느 배포에서 생겼나"가 동작한다
      release: process.env.GIT_SHA,
    }),
  ],
});

// 이렇게 쓰면 카나리에 잡힌다
logger.error(new Error('DB connection refused'));

// traceId와 context를 함께 실으면 대시보드에서 요청 단위 추적이 된다
logger.error('payment failed', {
  traceId: 'req-abc123',
  context: { path: '/orders', method: 'POST' },
});
```

## 동작 방식

- error, warn 레벨만 전송한다 (기본값. `level` 옵션으로 변경 가능)
- 5초마다 또는 50건이 차면 배치로 전송한다
- 전송 실패는 조용히 버린다. 카나리 서버가 죽어 있어도 당신의 서비스는 아무 영향이 없다
- `captureGlobalErrors: true`면 uncaughtException과 unhandledRejection까지 자동으로 잡는다.
  관찰만 할 뿐 프로세스 종료 여부에는 개입하지 않는다

## 성능 감시 (APM)

에러뿐 아니라 느려짐도 잡고 싶다면 미들웨어를 추가한다:

```ts
import { KanariMetrics } from 'kanari';

const metrics = new KanariMetrics({ apiKey: process.env.KANARI_API_KEY! });
app.use(metrics.middleware()); // Express / NestJS 공통
```

- 라우트별 응답시간을 60초 단위로 집계해 보낸다 (요청마다 보내지 않는다)
- 1초를 넘는 요청은 개별 샘플로 함께 기록된다
- 라우트 p95가 평소의 2.5배로 느려지면 카나리가 🐢 알람을 보낸다

## 배포 안전 (금요일 배포 공포 없애기)

`release`에 배포 버전(보통 git SHA)을 넣으면:

- 에러가 **어느 배포에서 처음 생겼는지** 추적됩니다
- 고쳤다고 표시한(resolved) 에러가 다시 나면 **회귀**로 잡아 🔴 알림을 보냅니다
- 배포 마커를 남기면(아래) 배포 직후 새 에러가 쏟아질 때 "롤백 고려" 알림을 보냅니다

배포 파이프라인에서 배포 직후 한 줄로 마커를 남깁니다:

```bash
curl -X POST https://kanari.example.com/ingest/deploy \
  -H "x-kanari-key: $KANARI_API_KEY" \
  -H "content-type: application/json" \
  -d "{\"release\":\"$GIT_SHA\"}"
```

GitHub Actions 전체 예제는 `examples/github-actions-deploy.yml` 참고.

## 무엇이 자동이고 무엇을 심어야 하나

- 자동: 기존 코드의 `logger.error()` / `logger.warn()` 호출, (옵션 켜면) 놓친 예외.
  에러 위치는 스택트레이스가 자동으로 알려준다
- 심으면 좋아지는 것: traceId, 요청 경로 같은 context, 외부 API 실패 로그.
  무엇이 어디서 터졌는지는 자동이고, 누가 뭘 하다가 왜 터졌는지는 심어야 보인다
