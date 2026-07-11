import { Fragment, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import type { SyntheticCheck } from '../api';

interface RunResult {
  checkId: number;
  ok: boolean;
  statusCode?: number;
  ms: number;
  error?: string;
}

// 합성 테스트 관리: 카나리가 밖에서 두드려 볼 핵심 API를 등록한다.
// 200이 떠도 깨진 장애, 아예 죽은 서버를 잡는 능동 감시의 설정 화면.
export function Checks() {
  const { projectId } = useParams();
  const [checks, setChecks] = useState<SyntheticCheck[]>([]);
  const [results, setResults] = useState<Record<number, RunResult>>({});
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [expectedStatus, setExpectedStatus] = useState(200);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState<number | 'all' | null>(null);

  async function load() {
    setChecks(await api<SyntheticCheck[]>(`/projects/${projectId}/checks`));
  }
  useEffect(() => {
    load().catch(() => {});
  }, [projectId]);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      await api(`/projects/${projectId}/checks`, {
        method: 'POST',
        body: { name, url, expectedStatus },
      });
      setName('');
      setUrl('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '등록 실패');
    }
  }

  async function runNow(id: number) {
    setBusyId(id);
    try {
      const r = await api<RunResult>(`/checks/${id}/run`, { method: 'POST' });
      setResults((prev) => ({ ...prev, [id]: r }));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function runAll() {
    setBusyId('all');
    try {
      const r = await api<{ results: RunResult[] }>(
        `/projects/${projectId}/checks/run-all`,
        { method: 'POST' },
      );
      const map: Record<number, RunResult> = {};
      r.results.forEach((x) => (map[x.checkId] = x));
      setResults((prev) => ({ ...prev, ...map }));
      await load();
    } finally {
      setBusyId(null);
    }
  }

  async function remove(id: number) {
    await api(`/checks/${id}`, { method: 'DELETE' });
    await load();
  }

  return (
    <>
      <div style={{ marginBottom: 14, display: 'flex', gap: 8 }}>
        <button className="btn ghost" onClick={runAll} disabled={busyId !== null}>
          {busyId === 'all' ? '실행 중...' : '전부 지금 실행 (배포 스모크)'}
        </button>
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>이름</th>
              <th>대상</th>
              <th>상태</th>
              <th>마지막 확인</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {checks.map((c) => (
              <Fragment key={c.id}>
                <tr className="row">
                  <td>{c.name}</td>
                  <td className="dim">
                    {c.method} {c.url}
                    <span className="dim"> (기대 {c.expectedStatus})</span>
                  </td>
                  <td>
                    <span className={`badge ${c.lastStatus}`}>
                      {c.lastStatus === 'ok'
                        ? '정상'
                        : c.lastStatus === 'fail'
                          ? `실패 x${c.failStreak}`
                          : '대기'}
                    </span>
                  </td>
                  <td className="dim">
                    {c.lastCheckedAt
                      ? c.lastCheckedAt.slice(5, 16).replace('T', ' ')
                      : '-'}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn ghost"
                      onClick={() => runNow(c.id)}
                      disabled={busyId !== null}
                    >
                      {busyId === c.id ? '...' : '지금 실행'}
                    </button>{' '}
                    <button className="btn ghost" onClick={() => remove(c.id)}>
                      삭제
                    </button>
                  </td>
                </tr>
                {results[c.id] && (
                  <tr>
                    <td colSpan={5} className="dim">
                      ↳ 방금 결과:{' '}
                      {results[c.id].ok ? (
                        <span style={{ color: 'var(--ok)' }}>
                          정상 ({results[c.id].statusCode}, {results[c.id].ms}ms)
                        </span>
                      ) : (
                        <span className="danger">
                          실패 (
                          {results[c.id].statusCode ?? results[c.id].error},{' '}
                          {results[c.id].ms}ms)
                        </span>
                      )}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        {checks.length === 0 && (
          <div className="empty">
            등록된 합성 테스트가 없습니다. 서비스의 가장 중요한 API를 아래에
            등록해 보세요 — 5분마다 카나리가 대신 두드려 봅니다.
          </div>
        )}
      </div>

      <form className="panel" onSubmit={create}>
        <b>새 합성 테스트</b>
        <label htmlFor="cname">이름</label>
        <input
          id="cname"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="예: 메인 API 살아있나"
          required
          maxLength={100}
        />
        <label htmlFor="curl">확인할 주소 (GET 호출)</label>
        <input
          id="curl"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://api.example.com/health"
          required
        />
        <label htmlFor="cstatus">기대하는 응답 코드</label>
        <input
          id="cstatus"
          type="number"
          value={expectedStatus}
          onChange={(e) => setExpectedStatus(Number(e.target.value))}
          min={100}
          max={599}
        />
        {error && <div className="error-text">{error}</div>}
        <div style={{ marginTop: 14 }}>
          <button className="btn">등록 (5분 주기로 감시 시작)</button>
        </div>
      </form>
    </>
  );
}
