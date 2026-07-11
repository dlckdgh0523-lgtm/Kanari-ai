import { WinstonModule } from 'nest-winston';
import * as winston from 'winston';
import LokiTransport from 'winston-loki';

// 카나리 자신의 로거 (도그푸딩: 카나리도 Winston을 쓴다).
//
// 로그가 가는 곳 두 군데:
//   1) 콘솔 - 개발 중 터미널에서 바로 본다
//   2) Loki - 중앙 로그 저장소. Grafana에서 시간대/레벨/앱별로 검색한다
//
// SDK와 같은 원칙: Loki가 죽어 있어도 앱은 아무 영향이 없어야 한다.
// winston-loki는 배치 전송이고 실패 시 조용히 버린다.
export function createAppLogger(appName: 'kanari-api' | 'kanari-worker') {
  const transports: winston.transport[] = [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.timestamp({ format: 'HH:mm:ss' }),
        winston.format.printf(({ timestamp, level, message, context }) => {
          return `${timestamp} ${level.toUpperCase().padEnd(5)} [${context ?? appName}] ${message}`;
        }),
      ),
    }),
  ];

  // LOKI_URL이 없으면 콘솔만 쓴다 (로컬에서 Loki 없이도 개발 가능하게)
  if (process.env.LOKI_URL) {
    transports.push(
      new LokiTransport({
        host: process.env.LOKI_URL,
        // 라벨은 검색의 축이다. Grafana에서 {app="kanari-api"} 로 조회한다.
        // 라벨을 남발하면 Loki 인덱스가 폭발하므로 앱 이름 정도만 라벨로 쓴다
        labels: { app: appName },
        json: true,
        format: winston.format.json(),
        replaceTimestamp: true,
        onConnectionError: () => {}, // Loki 다운은 앱의 장애가 아니다
      }),
    );
  }

  return WinstonModule.createLogger({
    level: 'debug',
    transports,
  });
}
