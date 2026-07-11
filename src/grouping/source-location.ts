// 스택트레이스에서 "우리 코드 첫 프레임"의 파일과 줄 번호를 뽑는다.
// fingerprint는 줄 번호를 지우지만(그룹핑용), 여기서는 정확한 위치가 필요하므로
// 줄 번호를 살린다. 이 위치로 GitHub의 정확한 줄에 딥링크를 걸고,
// 그 파일을 마지막으로 바꾼 커밋(유력 용의자)을 찾는다.

export interface SourceLocation {
  file: string; // 저장소 기준 상대 경로 (예: src/pay/pay.service.ts)
  line: number;
}

export function parseTopAppFrame(stack?: string): SourceLocation | null {
  if (!stack) return null;

  const lines = stack.split('\n');
  for (const raw of lines) {
    const line = raw.trim();
    if (!line.startsWith('at ')) continue;
    if (line.includes('node_modules')) continue; // 라이브러리 내부는 원인이 아니다
    if (line.includes('node:internal')) continue;

    // "at Fn (/app/src/pay/pay.service.ts:12:9)" 또는
    // "at /app/src/x.ts:5:3" 두 형태 모두에서 경로:줄:열 추출
    const m = line.match(/\(?([^\s()]+):(\d+):(\d+)\)?$/);
    if (!m) continue;

    const rawPath = m[1].replace(/\\/g, '/');
    const lineNo = Number(m[2]);

    // 서버마다 다른 절대경로 앞부분을 잘라 저장소 기준 경로로 만든다.
    // src/ 또는 dist/ 가 나오는 지점부터가 저장소 상대 경로다
    const rel = rawPath.replace(/^.*?\/((?:src|dist|app)\/.*)$/, '$1');
    const file = rel.replace(/^app\//, ''); // 컨테이너의 /app 루트 제거

    return { file, line: lineNo };
  }

  return null;
}

// GitHub 저장소 URL을 owner/repo로 분해한다. 아니면 null
export function parseGitHubRepo(
  repoUrl?: string | null,
): { owner: string; repo: string } | null {
  if (!repoUrl) return null;
  const m = repoUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!m) return null;
  return { owner: m[1], repo: m[2] };
}

// 정확한 줄로 가는 GitHub 딥링크. release(커밋 SHA)가 있으면 그 시점의 코드로,
// 없으면 기본 브랜치로 연결한다
export function buildBlobLink(
  repoUrl: string,
  loc: SourceLocation,
  ref?: string | null,
): string {
  const base = repoUrl.replace(/\.git$/, '').replace(/\/$/, '');
  const r = ref || 'HEAD';
  return `${base}/blob/${r}/${loc.file}#L${loc.line}`;
}
