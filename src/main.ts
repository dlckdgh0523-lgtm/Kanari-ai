import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { json } from 'express';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { createAppLogger } from './common/logging';

// API 서버 진입점.
// 컨슈머(worker.ts)와 프로세스를 분리한 이유:
// 수집 API가 바빠도 그룹핑 처리가 밀리지 않게, 서로 독립적으로 켜고 끄고 스케일하기 위해서다.
async function bootstrap() {
  // 기본 bodyParser를 끄고 직접 다는 이유: 크기 제한을 걸기 위해서다.
  // logger 교체: Nest 기본 콘솔 로거 대신 Winston(콘솔 + Loki)을 쓴다
  const app = await NestFactory.create(AppModule, {
    bodyParser: false,
    logger: createAppLogger('kanari-api'),
  });

  // 보안 응답 헤더 모음 (X-Content-Type-Options, X-Frame-Options 등).
  // 공개 인터넷에 노출되는 API의 기본기다
  app.use(helmet());

  // 바디 크기 제한: SDK 배치 50건이 넉넉히 들어오고도 남는 크기.
  // 무제한이면 수백 MB 바디 하나로 서버 메모리를 태우는 공격에 노출된다
  app.use(json({ limit: '256kb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 정의하지 않은 필드는 버린다
      transform: true, // 요청 값을 DTO 클래스 타입으로 변환한다
    }),
  );

  // 모든 예외의 최종 관문: 스택 비노출 + 셀프 모니터링 (파일 주석 참조)
  app.useGlobalFilters(new AllExceptionsFilter());

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`kanari api listening on :${port}`);
}

bootstrap();
