import { BadRequestException, Injectable, Logger } from '@nestjs/common';

// 능동 진단: 카나리가 대상 서버에 직접 요청을 쏴서 알아내는 것들.
// 수동 수집(SDK)과 달리 우리가 능동적으로 두드린다.
//
// 강한 가드레일이 필요한 이유: 남의 서버에 부하를 쏘면 그게 곧 DoS 공격이다.
// 그래서 부하 테스트는 상한을 하드코딩하고, 화면에서 "본인 소유 서버만"을 경고한다.
// (도메인 소유 검증은 다음 단계 개선으로 남긴다 - MEMORY 기록)

export interface SecurityFinding {
  level: 'good' | 'warn' | 'danger';
  title: string;
  detail: string;
}

export interface LoadTestResult {
  target: string;
  totalRequests: number;
  concurrency: number;
  okCount: number;
  errorCount: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
  rps: number;
  verdict: string;
}

@Injectable()
export class DiagnosticsService {
  private readonly logger = new Logger(DiagnosticsService.name);

  // ---------- 보안 점검 ----------
  // 대상에 요청 몇 개만 보내고 응답을 뜯어본다. 부하가 없어 안전하다.
  async securityScan(url: string): Promise<SecurityFinding[]> {
    const findings: SecurityFinding[] = [];

    // 1) HTTPS 여부. 평문 HTTP는 그 자체로 위험
    findings.push(
      url.startsWith('https://')
        ? { level: 'good', title: 'HTTPS', detail: '암호화된 연결을 씁니다' }
        : {
            level: 'danger',
            title: 'HTTPS 미사용',
            detail: '평문 HTTP입니다. 요청이 중간에서 훔쳐보일 수 있습니다',
          },
    );

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    } catch (err) {
      findings.push({
        level: 'warn',
        title: '연결 실패',
        detail: `대상에 접속하지 못했습니다: ${err instanceof Error ? err.message : err}`,
      });
      return findings;
    }

    const h = res.headers;

    // 2) 보안 응답 헤더 점검
    const securityHeaders: { key: string; title: string; why: string }[] = [
      { key: 'strict-transport-security', title: 'HSTS', why: '브라우저가 항상 HTTPS로만 접속하게 강제' },
      { key: 'content-security-policy', title: 'CSP', why: 'XSS 공격 시 악성 스크립트 실행 차단' },
      { key: 'x-content-type-options', title: 'X-Content-Type-Options', why: 'MIME 스니핑 공격 차단' },
      { key: 'x-frame-options', title: 'X-Frame-Options', why: '클릭재킹 차단 (다른 사이트가 iframe으로 감쌈)' },
    ];
    for (const sh of securityHeaders) {
      findings.push(
        h.get(sh.key)
          ? { level: 'good', title: sh.title, detail: '설정되어 있습니다' }
          : { level: 'warn', title: `${sh.title} 없음`, detail: sh.why },
      );
    }

    // 3) 서버 버전 노출 (공격자에게 알려진 취약점 정보를 준다)
    const server = h.get('server');
    if (server && /\d/.test(server)) {
      findings.push({
        level: 'warn',
        title: '서버 버전 노출',
        detail: `Server 헤더가 버전을 드러냅니다: ${server}`,
      });
    }

    // 4) CORS 와일드카드 (아무 사이트나 이 API를 호출 가능)
    if (h.get('access-control-allow-origin') === '*') {
      findings.push({
        level: 'warn',
        title: 'CORS 전체 허용',
        detail: 'Access-Control-Allow-Origin이 * 입니다. 의도한 것인지 확인하세요',
      });
    }

    // 5) 에러 응답에 스택트레이스가 새는가 (없는 경로로 유도)
    try {
      const probe = await fetch(
        url.replace(/\/?$/, '') + '/kanari-probe-404-xyz',
        { signal: AbortSignal.timeout(8000) },
      );
      const text = (await probe.text()).slice(0, 5000);
      if (/at\s+\S+\s+\(.*:\d+:\d+\)|\.js:\d+:\d+/.test(text)) {
        findings.push({
          level: 'danger',
          title: '스택트레이스 노출',
          detail: '에러 응답에 코드 스택이 그대로 담깁니다. 파일 경로·구조가 공격자에게 노출됩니다',
        });
      }
    } catch {
      // 프로브 실패는 발견 사항이 아니다
    }

    return findings;
  }

  // ---------- 부하 테스트 ----------
  // 동시 요청을 웨이브로 보내며 응답시간과 실패를 측정한다.
  // 상한을 하드코딩해서 이 기능이 공격 도구가 되지 않게 막는다.
  async loadTest(
    url: string,
    concurrency: number,
    totalRequests: number,
  ): Promise<LoadTestResult> {
    // 가드레일: 절대 넘을 수 없는 상한
    const c = Math.min(Math.max(concurrency, 1), 50);
    const total = Math.min(Math.max(totalRequests, 1), 500);

    if (!/^https?:\/\//.test(url)) {
      throw new BadRequestException('http(s) URL만 가능합니다');
    }

    const durations: number[] = [];
    let okCount = 0;
    let errorCount = 0;
    const startedAt = Date.now();
    const deadline = startedAt + 10_000; // 10초 안전 상한

    let sent = 0;
    async function worker() {
      while (sent < total && Date.now() < deadline) {
        sent += 1;
        const t = Date.now();
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
          durations.push(Date.now() - t);
          if (res.status < 500) okCount += 1;
          else errorCount += 1;
        } catch {
          durations.push(Date.now() - t);
          errorCount += 1;
        }
      }
    }

    await Promise.all(Array.from({ length: c }, () => worker()));

    const elapsedSec = (Date.now() - startedAt) / 1000;
    durations.sort((a, b) => a - b);
    const sum = durations.reduce((a, b) => a + b, 0);
    const n = durations.length || 1;
    const p95 = durations[Math.floor(durations.length * 0.95)] ?? 0;
    const errorRate = errorCount / (okCount + errorCount || 1);

    // 판정: 에러율과 지연으로 "이 부하를 견디는가"를 한 줄로
    let verdict: string;
    if (errorRate > 0.05) {
      verdict = `동시 ${c} 부하에서 무너지기 시작합니다 (실패율 ${Math.round(errorRate * 100)}%)`;
    } else if (p95 > 1000) {
      verdict = `버티지만 느려집니다 (p95 ${p95}ms). 이 이상 트래픽이면 위험합니다`;
    } else {
      verdict = `동시 ${c} 부하를 문제없이 견딥니다 (p95 ${p95}ms)`;
    }

    this.logger.log(`loadtest ${url} c=${c} n=${sent}: ${verdict}`);

    return {
      target: url,
      totalRequests: sent,
      concurrency: c,
      okCount,
      errorCount,
      avgMs: Math.round(sum / n),
      p95Ms: p95,
      maxMs: durations[durations.length - 1] ?? 0,
      rps: Math.round(sent / (elapsedSec || 1)),
      verdict,
    };
  }
}
