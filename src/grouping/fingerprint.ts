import { createHash } from 'crypto';

// ---------------------------------------------------------------
// 카나리의 심장: 에러를 같은 원인끼리 묶는 지문(fingerprint) 계산.
//
// 원리: 같은 버그에서 난 에러는 스택트레이스의 호출 경로가 같다.
// 다만 행 번호는 배포마다 바뀔 수 있고, node_modules 내부 프레임은
// 우리 코드가 아니므로, 그런 흔들리는 정보를 지우고 남은 뼈대를 해시한다.
//
// 순수 함수로 만든 이유: DB도 네트워크도 없이 입력과 출력만 있어서
// 테스트하기 쉽고, 규칙을 바꿀 때 영향 범위가 이 파일로 갇힌다.
// ---------------------------------------------------------------

// 스택에서 뼈대로 남길 프레임 수. 너무 적으면 다른 버그가 한 그룹으로 뭉치고,
// 너무 많으면 같은 버그가 여러 그룹으로 쪼개진다. 3은 Sentry 계열에서 흔히 쓰는 절충값
const FRAMES_TO_USE = 3;

export interface FingerprintResult {
  fingerprint: string;
  topFrame: string; // 우리 코드 기준 최상단 위치 (화면 표시용)
}

export function computeFingerprint(
  errorName: string,
  message: string,
  stack?: string,
): FingerprintResult {
  const frames = extractAppFrames(stack);

  // 스택이 없으면 지문 재료가 에러 이름 + 메시지뿐이다.
  // 메시지에는 "user 42 not found"처럼 매번 바뀌는 값이 섞이므로 숫자류를 지워서 일반화한다
  const material =
    frames.length > 0
      ? errorName + '\n' + frames.join('\n')
      : errorName + '\n' + normalizeMessage(message);

  return {
    fingerprint: createHash('sha1').update(material).digest('hex'),
    topFrame: frames[0] ?? '',
  };
}

// 스택트레이스에서 우리 코드 프레임만 골라 정규화한다
function extractAppFrames(stack?: string): string[] {
  if (!stack) return [];

  return stack
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('at '))
    .filter((line) => !line.includes('node_modules')) // 라이브러리 내부는 원인이 아니라 경유지다
    .filter((line) => !line.includes('node:internal'))
    .map(normalizeFrame)
    .slice(0, FRAMES_TO_USE);
}

// "at UserService.find (/app/src/users/users.service.ts:42:15)"
//  -> "userservice.find src/users/users.service.ts"
// 행:열 번호를 지우는 이유: 코드 한 줄만 추가돼도 번호가 밀려서
// 같은 버그가 배포 후에 다른 그룹으로 등록되는 것을 막기 위해서다
function normalizeFrame(line: string): string {
  const withoutAt = line.replace(/^at\s+/, '');

  const match = withoutAt.match(/^(.*?)\s*\((.*)\)$/);
  const fnName = match ? match[1] : '';
  const location = match ? match[2] : withoutAt;

  const path = location
    .replace(/:\d+:\d+$/, '') // 행:열 제거
    .replace(/\\/g, '/') // 윈도우 경로 통일
    .replace(/^.*\/(src|dist)\//, '$1/'); // 서버마다 다른 절대경로 앞부분 제거

  return (fnName + ' ' + path).trim().toLowerCase();
}

// 메시지 안의 가변 값(숫자, uuid, hex 토큰)을 자리표시자로 바꾼다
function normalizeMessage(message: string): string {
  return message
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/g, '<uuid>')
    .replace(/\b[0-9a-f]{16,}\b/g, '<hex>')
    .replace(/\d+/g, '<n>')
    .slice(0, 300);
}
