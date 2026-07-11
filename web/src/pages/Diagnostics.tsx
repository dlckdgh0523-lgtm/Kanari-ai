import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

interface SecurityFinding {
  level: 'good' | 'warn' | 'danger';
  title: string;
  detail: string;
}

interface LoadResult {
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

// 능동 진단: 카나리가 대상 서버에 직접 요청을 보내 알아낸다.
// 부하 테스트는 공격이 될 수 있어 본인 소유 서버만 하도록 강하게 경고한다.
export function Diagnostics() {
  const { projectId } = useParams();
  const [url, setUrl] = useState('');
  const [findings, setFindings] = useState<SecurityFinding[] | null>(null);
  const [load, setLoad] = useState<LoadResult | null>(null);
  const [concurrency, setConcurrency] = useState(10);
  const [totalRequests, setTotalRequests] = useState(100);
  const [busy, setBusy] = useState<'sec' | 'load' | null>(null);
  const [error, setError] = useState('');

  async function runSecurity() {
    setBusy('sec');
    setError('');
    try {
      const d = await api<{ findings: SecurityFinding[] }>(
        `/projects/${projectId}/diagnostics/security`,
        { method: 'POST', body: { url } },
      );
      setFindings(d.findings);
    } catch (err) {
      setError(err instanceof Error ? err.message : '실패');
    } finally {
      setBusy(null);
    }
  }

  async function runLoad() {
    setBusy('load');
    setError('');
    try {
      const d = await api<LoadResult>(
        `/projects/${projectId}/diagnostics/load`,
        { method: 'POST', body: { url, concurrency, totalRequests } },
      );
      setLoad(d);
    } catch (err) {
      setError(err instanceof Error ? err.message : '실패');
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <div className="panel">
        <label htmlFor="durl">진단할 주소</label>
        <input
          id="durl"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://내서버.com/health"
        />
        {error && <div className="error-text">{error}</div>}
      </div>

      {/* 보안 점검 */}
      <div className="panel">
        <b>보안 점검</b>
        <p className="dim" style={{ fontSize: 13, margin: '4px 0 12px' }}>
          응답 헤더, 서버 버전 노출, 스택트레이스 유출 등을 확인합니다. 요청
          몇 개만 보내므로 안전합니다.
        </p>
        <button className="btn" onClick={runSecurity} disabled={!url || busy !== null}>
          {busy === 'sec' ? '점검 중...' : '보안 점검 실행'}
        </button>

        {findings && (
          <table style={{ marginTop: 14 }}>
            <tbody>
              {findings.map((f, i) => (
                <tr key={i}>
                  <td style={{ width: 90 }}>
                    <span
                      className={`badge ${
                        f.level === 'good'
                          ? 'ok'
                          : f.level === 'danger'
                            ? 'fail'
                            : 'open'
                      }`}
                    >
                      {f.level === 'good' ? '양호' : f.level === 'danger' ? '위험' : '주의'}
                    </span>
                  </td>
                  <td>
                    <b>{f.title}</b>
                    <div className="dim" style={{ fontSize: 12 }}>
                      {f.detail}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 부하 테스트 */}
      <div className="panel">
        <b>부하 테스트 (용량 확인)</b>
        <p className="dim" style={{ fontSize: 13, margin: '4px 0 10px' }}>
          동시 요청을 보내 몇 명까지 견디는지 측정합니다.{' '}
          <span className="danger">
            반드시 본인이 소유·운영하는 서버에만 실행하세요. 남의 서버에 실행하면
            공격(DoS)이 됩니다.
          </span>{' '}
          안전을 위해 동시 50 · 총 500요청 · 10초로 상한이 걸려 있습니다.
        </p>
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label htmlFor="conc">동시 요청 수</label>
            <input
              id="conc"
              type="number"
              value={concurrency}
              min={1}
              max={50}
              onChange={(e) => setConcurrency(Number(e.target.value))}
            />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label htmlFor="tot">총 요청 수</label>
            <input
              id="tot"
              type="number"
              value={totalRequests}
              min={1}
              max={500}
              onChange={(e) => setTotalRequests(Number(e.target.value))}
            />
          </div>
          <button className="btn" onClick={runLoad} disabled={!url || busy !== null}>
            {busy === 'load' ? '측정 중...' : '부하 테스트 실행'}
          </button>
        </div>

        {load && (
          <div style={{ marginTop: 14 }}>
            <div
              className={`health-banner ${
                load.errorCount > load.totalRequests * 0.05
                  ? 'danger'
                  : load.p95Ms > 1000
                    ? 'warn'
                    : 'ok'
              }`}
            >
              <span className="dot" />
              {load.verdict}
            </div>
            <div className="stat-grid" style={{ marginTop: 12 }}>
              <div className="stat">
                <div className="stat-num">{load.rps}</div>
                <div className="stat-label">초당 요청(RPS)</div>
              </div>
              <div className="stat">
                <div className="stat-num">{load.p95Ms}ms</div>
                <div className="stat-label">p95 응답</div>
              </div>
              <div className="stat">
                <div className={`stat-num ${load.errorCount ? 'danger' : ''}`}>
                  {load.errorCount}
                </div>
                <div className="stat-label">실패 요청</div>
              </div>
              <div className="stat">
                <div className="stat-num">{load.maxMs}ms</div>
                <div className="stat-label">최대 응답</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
