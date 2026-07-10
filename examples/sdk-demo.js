// SDK 동작 확인용 데모.
// 카나리 API와 워커가 떠 있는 상태에서 실행하면, 아래 에러들이 카나리에 잡힌다.
//
// 준비: 1) docker compose up -d   2) npm run start:api:dev   3) npm run start:worker
//       4) POST /projects 로 프로젝트 만들고 apiKey 복사
// 실행: cd sdk && npm run build && cd ..
//       KANARI_API_KEY=kn_여기에키 node examples/sdk-demo.js
// 확인: curl localhost:3000/projects/1/groups
//       같은 데모를 두 번 돌리면 그룹 수는 그대로, count만 올라야 정상이다.

const winston = require('../sdk/node_modules/winston');
const { KanariTransport } = require('../sdk/dist/index');

const apiKey = process.env.KANARI_API_KEY;
if (!apiKey) {
  console.error('KANARI_API_KEY 환경변수를 설정하고 실행하세요');
  process.exit(1);
}

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.errors({ stack: true }),
    winston.format.json(),
  ),
  transports: [
    new winston.transports.Console(),
    new KanariTransport({ apiKey, endpoint: 'http://localhost:3000' }),
  ],
});

// 케이스 1: 실제 Error 객체 (스택 있음) - 스택 기반 fingerprint로 묶인다
function findUser() {
  const user = undefined;
  return user.id; // 일부러 터뜨린다
}
try {
  findUser();
} catch (err) {
  logger.error(err);
}

// 케이스 2: 같은 자리에서 또 발생 - 새 그룹이 아니라 기존 그룹의 count가 올라야 한다
try {
  findUser();
} catch (err) {
  logger.error(err);
}

// 케이스 3: 메시지에 가변 값(주문번호)이 섞인 문자열 로그
// 스택이 없으니 메시지를 정규화해서 묶는다. 번호가 달라도 같은 그룹이어야 한다
logger.error('order 10293 payment failed', {
  traceId: 'demo-trace-1',
  context: { path: '/orders', method: 'POST' },
});
logger.error('order 55821 payment failed', {
  traceId: 'demo-trace-2',
  context: { path: '/orders', method: 'POST' },
});

// 케이스 4: warn 레벨도 전송 대상이다
logger.warn('external api slow: careernet took 4200ms', {
  context: { path: '/majors/sync' },
});

// 배치 주기(5초)를 기다렸다가 종료한다
console.log('5초 뒤 전송 후 종료합니다...');
setTimeout(() => process.exit(0), 6000);
