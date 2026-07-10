import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

// API 서버 진입점.
// 컨슈머(worker.ts)와 프로세스를 분리한 이유:
// 수집 API가 바빠도 그룹핑 처리가 밀리지 않게, 서로 독립적으로 켜고 끄고 스케일하기 위해서다.
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 정의하지 않은 필드는 버린다
      transform: true, // 요청 값을 DTO 클래스 타입으로 변환한다
    }),
  );

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port);
  console.log(`kanari api listening on :${port}`);
}

bootstrap();
