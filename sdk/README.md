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
