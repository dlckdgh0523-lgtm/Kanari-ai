import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

// 전역 예외 필터: API에서 터지는 모든 예외가 마지막에 여기를 지난다.
//
// 하는 일 두 가지.
// 1) 보안: 예상 못 한 500 에러의 스택을 응답에 절대 노출하지 않는다.
//    스택에는 파일 경로, 라이브러리 버전 같은 공격 힌트가 들어 있다.
// 2) 셀프 모니터링: 카나리 자신의 에러도 카나리로 보낸다 (자기 자신이 0번 고객).
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exceptions');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    // 404, 400, 401 같은 HttpException은 의도된 응답이다. 그대로 내보낸다
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      res.status(status).json(exception.getResponse());
      if (status < 500) return; // 4xx는 클라이언트 문제 - 우리 장애가 아니다
      this.report(exception, req);
      return;
    }

    // express 계층(body-parser 등)의 에러는 HttpException이 아니지만
    // status 프로퍼티에 의도한 코드가 있다. 예: 256kb 초과 바디의 PayloadTooLargeError(413).
    // 이걸 안 거르면 클라이언트 잘못(4xx)이 우리 장애(500)로 둔갑한다
    const expressStatus = (exception as { status?: number })?.status;
    if (typeof expressStatus === 'number' && expressStatus >= 400 && expressStatus < 500) {
      res.status(expressStatus).json({
        statusCode: expressStatus,
        message: (exception as Error).message ?? 'bad request',
      });
      return;
    }

    // 여기부터는 예상 못 한 에러. 내부 로그에는 스택 전부, 응답에는 한 줄만
    const error = exception instanceof Error ? exception : new Error(String(exception));
    this.logger.error(error.stack ?? error.message);
    this.report(error, req);

    if (!res.headersSent) {
      res.status(500).json({ statusCode: 500, message: 'internal server error' });
    }
  }

  // 자기 자신의 에러를 자기 수집 파이프라인으로 보낸다.
  // SDK와 같은 fire-and-forget 원칙: 실패해도 조용히 버린다
  private report(error: Error, req: Request) {
    const selfKey = process.env.KANARI_SELF_KEY;
    if (!selfKey) return; // 셀프 프로젝트 미설정이면 기능 꺼짐

    // 루프 가드: 수집 API 자신의 에러를 다시 수집으로 보내면
    // 에러 -> 보고 -> 에러 -> 보고 무한 루프가 된다
    if (req.path?.startsWith('/ingest')) return;

    const port = process.env.PORT ?? 3000;
    fetch(`http://localhost:${port}/ingest`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-kanari-key': selfKey },
      body: JSON.stringify({
        events: [
          {
            name: error.name || 'Error',
            message: error.message,
            stack: error.stack,
            context: { path: req.path, method: req.method },
          },
        ],
      }),
      signal: AbortSignal.timeout(3000),
    }).catch(() => {});
    // 한계를 알고 쓰자: DB나 Kafka가 통째로 죽은 장애는 이 보고 경로도 같이 죽는다.
    // 그런 인프라 전체 장애는 합성 테스트(외부에서 호출)와 Grafana(Phase 6)가 잡는 영역이다
  }
}
