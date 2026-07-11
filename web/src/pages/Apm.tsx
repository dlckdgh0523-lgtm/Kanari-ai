import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';

interface RouteRow {
  key: string;
  count: number;
  errorRate: number;
  avgMs: number;
  p95Ms: number;
  maxMs: number;
}

interface SlowRow {
  id: number;
  method: string;
  route: string;
  durationMs: number;
  statusCode: number;
  traceId: string | null;
  occurredAt: string;
}

// p95에 따라 색을 다르게: 느린 라우트가 표에서 바로 튀어야 한다
function speedClass(ms: number) {
  if (ms >= 1000) return 'danger';
  if (ms >= 300) return '';
  return 'dim';
}

// APM: 최근 1시간, 어느 API가 얼마나 느린가.
// 에러 인박스가 "터진 것"이라면 여기는 "느려지는 것" - 죽기 전의 신음을 본다.
export function Apm() {
  const { projectId } = useParams();
  const [routes, setRoutes] = useState<RouteRow[]>([]);
  const [slow, setSlow] = useState<SlowRow[]>([]);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const d = await api<{ routes: RouteRow[]; slowSamples: SlowRow[] }>(
          `/projects/${projectId}/apm`,
        );
        if (alive) {
          setRoutes(d.routes);
          setSlow(d.slowSamples);
        }
      } catch {
        /* 다음 갱신에서 재시도 */
      }
    }
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [projectId]);

  return (
    <>
      <div className="panel">
        <div className="dim" style={{ marginBottom: 8 }}>
          라우트별 성능 (최근 1시간 · 15초마다 갱신)
        </div>
        <table>
          <thead>
            <tr>
              <th>라우트</th>
              <th>요청</th>
              <th>에러율</th>
              <th>평균</th>
              <th>p95</th>
              <th>최대</th>
            </tr>
          </thead>
          <tbody>
            {routes.map((r) => (
              <tr key={r.key}>
                <td>{r.key}</td>
                <td className="count">{r.count.toLocaleString()}</td>
                <td className={r.errorRate > 0 ? 'danger' : 'dim'}>
                  {r.errorRate}%
                </td>
                <td className={speedClass(r.avgMs)}>{r.avgMs}ms</td>
                <td className={speedClass(r.p95Ms)}>
                  {r.p95Ms >= 3000 ? '3s+' : `${r.p95Ms}ms`}
                </td>
                <td className={speedClass(r.maxMs)}>{r.maxMs}ms</td>
              </tr>
            ))}
          </tbody>
        </table>
        {routes.length === 0 && (
          <div className="empty">
            아직 성능 데이터가 없습니다. 서버에 KanariMetrics 미들웨어를
            붙이면 1분 안에 여기가 채워집니다.
          </div>
        )}
      </div>

      <div className="panel">
        <div className="dim" style={{ marginBottom: 8 }}>
          느린 요청 샘플 (1초 이상)
        </div>
        <table>
          <tbody>
            {slow.map((s) => (
              <tr key={s.id}>
                <td className="dim" style={{ whiteSpace: 'nowrap' }}>
                  {s.occurredAt.slice(5, 19).replace('T', ' ')}
                </td>
                <td>
                  {s.method} {s.route}
                </td>
                <td className="danger">{s.durationMs}ms</td>
                <td className="dim">{s.statusCode}</td>
                <td className="dim">{s.traceId ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {slow.length === 0 && (
          <div className="empty">1초를 넘긴 요청이 없습니다. 빠르네요.</div>
        )}
      </div>
    </>
  );
}
