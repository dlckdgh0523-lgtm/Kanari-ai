import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import type { ErrorGroup } from '../api';

function timeAgo(iso: string) {
  const sec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (sec < 60) return `${sec}초 전`;
  if (sec < 3600) return `${Math.floor(sec / 60)}분 전`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}시간 전`;
  return `${Math.floor(sec / 86400)}일 전`;
}

// 에러 그룹 인박스: 이 화면의 일은 하나 - 지금 뭐가 터지고 있는지 10초 안에 보여주기
export function Inbox() {
  const { projectId } = useParams();
  const [groups, setGroups] = useState<ErrorGroup[]>([]);
  const [status, setStatus] = useState<'open' | 'resolved' | ''>('open');

  useEffect(() => {
    const q = status ? `?status=${status}` : '';
    api<ErrorGroup[]>(`/projects/${projectId}/groups${q}`)
      .then(setGroups)
      .catch(() => {});
  }, [projectId, status]);

  return (
    <>
      <div style={{ marginBottom: 14, display: 'flex', gap: 8 }}>
        {(['open', 'resolved', ''] as const).map((s) => (
          <button
            key={s}
            className="btn ghost"
            style={s === status ? { color: 'var(--canary)', borderColor: 'var(--canary)' } : {}}
            onClick={() => setStatus(s)}
          >
            {s === 'open' ? '열림' : s === 'resolved' ? '해결됨' : '전체'}
          </button>
        ))}
      </div>

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>에러</th>
              <th>횟수</th>
              <th>상태</th>
              <th>위치</th>
              <th>마지막 발생</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id} className="row">
                <td>
                  <Link to={`/console/groups/${g.id}`}>
                    {g.regressed && (
                      <span className="badge fail" style={{ marginRight: 6 }}>
                        회귀
                      </span>
                    )}
                    <span className="danger">{g.name}</span>{' '}
                    <span>{g.message.slice(0, 80)}</span>
                  </Link>
                </td>
                <td className="count">{g.count.toLocaleString()}</td>
                <td>
                  <span className={`badge ${g.status}`}>
                    {g.status === 'open' ? '열림' : '해결됨'}
                  </span>
                </td>
                <td className="dim">{g.topFrame || '-'}</td>
                <td className="dim">{timeAgo(g.lastSeenAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {groups.length === 0 && (
          <div className="empty">
            {status === 'open'
              ? '열린 에러가 없습니다. 카나리아가 조용히 노래하고 있네요.'
              : '해당하는 에러가 없습니다.'}
          </div>
        )}
      </div>
    </>
  );
}
