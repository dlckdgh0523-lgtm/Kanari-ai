import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import type { ErrorEvent, ErrorGroup } from '../api';

interface OverviewData {
  health: 'ok' | 'warn' | 'danger';
  openGroups: number;
  events24h: number;
  totalChecks: number;
  failingChecks: number;
  topErrors: ErrorGroup[];
  recentEvents: ErrorEvent[];
}

const HEALTH_LABEL = {
  ok: '정상 — 카나리아가 노래하고 있습니다',
  warn: '주의 — 열린 에러가 있습니다',
  danger: '위험 — 지금 대응이 필요합니다',
};

// 프로젝트 첫 화면. 흩어진 숫자를 한 곳에 모아 서비스 상태를 10초 안에 파악하게 한다.
export function Overview() {
  const { projectId } = useParams();
  const [d, setD] = useState<OverviewData | null>(null);
  const base = `/console/projects/${projectId}`;

  useEffect(() => {
    let alive = true;
    const load = () =>
      api<OverviewData>(`/projects/${projectId}/overview`)
        .then((x) => alive && setD(x))
        .catch(() => {});
    load();
    const t = setInterval(load, 15000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [projectId]);

  if (!d) return <div className="dim">불러오는 중...</div>;

  return (
    <>
      {/* 건강 상태 배너 */}
      <div className={`health-banner ${d.health}`}>
        <span className="dot" />
        {HEALTH_LABEL[d.health]}
      </div>

      {/* 핵심 숫자 4개 */}
      <div className="stat-grid">
        <Link to={`${base}/groups`} className="stat">
          <div className="stat-num danger">{d.openGroups}</div>
          <div className="stat-label">열린 에러</div>
        </Link>
        <Link to={`${base}/logs`} className="stat">
          <div className="stat-num">{d.events24h.toLocaleString()}</div>
          <div className="stat-label">24시간 이벤트</div>
        </Link>
        <Link to={`${base}/checks`} className="stat">
          <div className={`stat-num ${d.failingChecks ? 'danger' : ''}`}>
            {d.failingChecks}/{d.totalChecks}
          </div>
          <div className="stat-label">합성 테스트 실패</div>
        </Link>
        <Link to={`${base}/apm`} className="stat">
          <div className="stat-num canary">→</div>
          <div className="stat-label">성능(APM) 보기</div>
        </Link>
      </div>

      <div className="two-col">
        {/* 가장 시끄러운 에러 */}
        <div className="panel">
          <div className="dim" style={{ marginBottom: 8 }}>
            지금 가장 시끄러운 에러
          </div>
          {d.topErrors.length === 0 && <div className="empty">열린 에러 없음</div>}
          {d.topErrors.map((g) => (
            <Link
              key={g.id}
              to={`/console/groups/${g.id}`}
              className="mini-row"
            >
              <span className="count">{g.count.toLocaleString()}</span>{' '}
              <span className="danger">{g.name}</span>{' '}
              <span>{g.message.slice(0, 50)}</span>
            </Link>
          ))}
        </div>

        {/* 미니 로그 스트림 */}
        <div className="panel">
          <div className="dim" style={{ marginBottom: 8 }}>
            최근 이벤트{' '}
            <Link to={`${base}/logs`} className="dim">
              (전체 로그 →)
            </Link>
          </div>
          <div className="term" style={{ maxHeight: 220 }}>
            {d.recentEvents.length === 0 && (
              <span className="line dim">수신된 이벤트 없음</span>
            )}
            {d.recentEvents.map((ev) => (
              <span key={ev.id} className="line">
                <span className="t">
                  {ev.occurredAt.slice(11, 19)}
                </span>{' '}
                <span className={`lv-${ev.level}`}>
                  {ev.level.toUpperCase()}
                </span>{' '}
                {ev.message.slice(0, 60)}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
