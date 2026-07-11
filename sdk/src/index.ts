import Transport from 'winston-transport';

export { KanariMetrics, BUCKET_EDGES } from './metrics';
export type { KanariMetricsOptions } from './metrics';

// ---------------------------------------------------------------
// 카나리 SDK: Winston 커스텀 transport.
//
// 사용하는 쪽에서는 이렇게 붙인다:
//
//   import winston from 'winston';
//   import { KanariTransport } from 'kanari';
//
//   const logger = winston.createLogger({
//     format: winston.format.errors({ stack: true }), // 에러 객체의 스택을 살려준다
//     transports: [
//       new winston.transports.Console(),
//       new KanariTransport({ apiKey: 'kn_xxx', endpoint: 'https://kanari.example.com' }),
//     ],
//   });
//
//   logger.error(new Error('something broke'));
//
// 설계 원칙 (fire-and-forget):
// 이 transport는 붙인 서비스를 절대 느리게 하거나 죽여서는 안 된다.
// 그래서 1) 로그를 버퍼에 쌓았다가 배치로 보내고
//        2) 전송에 실패하면 조용히 버리고
//        3) 어떤 경우에도 예외를 밖으로 던지지 않는다.
// 카나리 서버가 죽어 있어도 고객 서비스는 아무 일 없이 돌아가야 한다.
// ---------------------------------------------------------------

export interface KanariTransportOptions
  extends Transport.TransportStreamOptions {
  /** 카나리에서 발급받은 API 키 (kn_...) */
  apiKey: string;
  /** 카나리 서버 주소. 기본값은 로컬 개발용 */
  endpoint?: string;
  /** 버퍼를 비우는 주기(ms). 기본 5초 */
  flushIntervalMs?: number;
  /** 이 개수가 차면 주기를 기다리지 않고 바로 보낸다. 기본 50건 (서버의 배치 상한과 같다) */
  maxBatchSize?: number;
  /**
   * true면 logger.error()로 잡지 못한 예외까지 자동 포착한다.
   * (uncaughtException, unhandledRejection 프로세스 훅 등록)
   * 개발자가 try/catch를 깜빡한 에러가 바로 이런 걸로 죽는다 - 가장 위험한 종류다
   */
  captureGlobalErrors?: boolean;
}

// 서버의 IngestEventDto와 같은 모양
interface KanariEvent {
  name: string;
  message: string;
  stack?: string;
  level?: string;
  traceId?: string;
  context?: Record<string, unknown>;
  occurredAt: string;
}

export class KanariTransport extends Transport {
  private readonly apiKey: string;
  private readonly ingestUrl: string;
  private readonly maxBatchSize: number;
  private buffer: KanariEvent[] = [];
  private timer: NodeJS.Timeout;

  constructor(opts: KanariTransportOptions) {
    // level 기본값 warn: 로그 표준(docs/logging-standard.md)에 따라
    // 카나리로는 error와 warn만 보내고, info 이하는 로컬에만 남긴다
    super({ level: 'warn', ...opts });

    this.apiKey = opts.apiKey;
    this.ingestUrl =
      (opts.endpoint ?? 'http://localhost:3000').replace(/\/$/, '') + '/ingest';
    this.maxBatchSize = opts.maxBatchSize ?? 50;

    this.timer = setInterval(
      () => void this.flush(),
      opts.flushIntervalMs ?? 5000,
    );
    // unref: 이 타이머 때문에 프로세스가 종료를 못 하는 일을 막는다
    this.timer.unref();

    if (opts.captureGlobalErrors) {
      this.attachGlobalHandlers();
    }
  }

  // try/catch도, logger.error()도 놓친 예외를 프로세스 훅으로 포착한다.
  //
  // 함정 주의: uncaughtException에 핸들러를 달면 Node는 기본 동작(프로세스 사망)을
  // 멈춘다. 죽어야 할 앱이 망가진 상태로 계속 도는 건 더 위험하다.
  // 그래서 우리가 유일한 핸들러라면, 보고를 밀어낸 뒤 원래대로 죽여준다(exit 1).
  // 앱이 자기 핸들러를 따로 달았다면 죽일지 말지는 그 앱의 결정에 맡긴다
  private attachGlobalHandlers() {
    process.on('uncaughtException', (err) => {
      this.captureError(err, { source: 'uncaughtException' });
      const soleHandler = process.listenerCount('uncaughtException') <= 1;
      // 프로세스가 곧 죽으니 배치 주기를 기다리지 않고 즉시 밀어낸다
      void this.flush().finally(() => {
        if (soleHandler) this.dieLikeDefault(err);
      });
    });

    process.on('unhandledRejection', (reason) => {
      const err = reason instanceof Error ? reason : new Error(String(reason));
      this.captureError(err, { source: 'unhandledRejection' });
      const soleHandler = process.listenerCount('unhandledRejection') <= 1;
      void this.flush().finally(() => {
        if (soleHandler) this.dieLikeDefault(err);
      });
    });
  }

  // Node의 기본 동작(에러 출력 후 비정상 종료)을 재현한다.
  // process.exit()을 바로 부르면 방금 flush한 HTTP 커넥션 정리와 충돌해
  // Windows에서 libuv 단언 크래시가 난다. 그래서 exitCode만 지정하고
  // 이벤트 루프가 자연히 비면서 종료되게 둔다. 뭔가가 루프를 계속 붙잡고 있는
  // 경우를 대비해 2초 뒤 강제 종료 안전핀을 걸어둔다 (unref라 평소엔 발동 안 함)
  private dieLikeDefault(err: Error) {
    console.error(err);
    process.exitCode = 1;
    setTimeout(() => process.exit(1), 2000).unref();
  }

  // Error 객체를 직접 카나리로 보낸다. winston을 거치지 않는 비상구
  captureError(err: Error, context?: Record<string, unknown>) {
    try {
      this.buffer.push({
        name: err.name || 'Error',
        message: err.message,
        stack: err.stack,
        level: 'error',
        context,
        occurredAt: new Date().toISOString(),
      });
    } catch {
      // SDK는 어떤 경우에도 앱에 예외를 전파하지 않는다
    }
  }

  // winston이 로그 한 건마다 호출하는 메서드
  log(info: Record<string, unknown>, callback: () => void) {
    setImmediate(() => this.emit('logged', info));

    try {
      this.buffer.push(this.toEvent(info));

      if (this.buffer.length >= this.maxBatchSize) {
        void this.flush();
      }
    } catch {
      // 변환에 실패한 로그는 버린다. SDK가 본 서비스에 예외를 전파하면 안 된다
    }

    // 즉시 callback: 전송을 기다리게 하면 로깅이 요청 처리를 막게 된다
    callback();
  }

  // winston의 info 객체를 카나리 이벤트로 변환한다
  private toEvent(info: Record<string, unknown>): KanariEvent {
    // format.errors({ stack: true })를 쓰면 Error의 stack이 info.stack에 실려 온다
    const stack = typeof info.stack === 'string' ? info.stack : undefined;

    // 에러 클래스 이름은 스택 첫 줄("TypeError: ...")에서 얻는 게 가장 정확하다
    const name = stack?.split(':')[0]?.trim() || 'Error';

    return {
      name,
      message: String(info.message ?? ''),
      stack,
      level: typeof info.level === 'string' ? info.level : 'error',
      traceId: typeof info.traceId === 'string' ? info.traceId : undefined,
      context: isPlainObject(info.context) ? info.context : undefined,
      occurredAt: new Date().toISOString(),
    };
  }

  // 버퍼에 모인 이벤트를 서버로 보낸다. 실패하면 버린다(재시도 없음)
  private async flush() {
    if (this.buffer.length === 0) return;

    // splice로 버퍼를 비우면서 가져간다. 전송 중에 새 로그가 와도 다음 배치로 쌓인다
    const events = this.buffer.splice(0, this.buffer.length);

    try {
      await fetch(this.ingestUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-kanari-key': this.apiKey,
        },
        body: JSON.stringify({ events }),
        // 카나리 서버가 느려도 고객 서비스의 이벤트 루프를 오래 잡지 않게 제한
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // 서버 다운, 네트워크 오류, 타임아웃 전부 조용히 버린다.
      // 모니터링 때문에 본 서비스가 흔들리면 주객전도다
    }
  }

  // logger.close() 또는 프로세스 정리 시 winston이 호출한다. 남은 버퍼를 마지막으로 밀어낸다
  close() {
    clearInterval(this.timer);
    void this.flush();
  }
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}
