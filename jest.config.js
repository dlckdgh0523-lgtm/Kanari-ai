// 단위 테스트 설정. 순수 함수 위주라 별도 환경 없이 빠르게 돈다.
// 통합 테스트(실제 DB)는 별도 프로젝트로 나중에 분리한다 (D1 후반).
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testRegex: '\\.spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.module.ts',
    '!src/main.ts',
    '!src/worker.ts',
  ],
};
