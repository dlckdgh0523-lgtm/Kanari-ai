import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api';
import type { ErrorEvent, ErrorGroup } from '../api';
import { Prompt } from '../Shell';

// 그룹 상세: 스택트레이스가 주인공이다.
// 해결 버튼은 반드시 메모 입력을 거친다 - 메모가 곧 지식베이스이기 때문.
export function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState<ErrorGroup | null>(null);
  const [events, setEvents] = useState<ErrorEvent[]>([]);
  const [note, setNote] = useState('');
  const [resolving, setResolving] = useState(false);
  const [suspect, setSuspect] = useState<null | {
    blobLink: string | null;
    suspectCommit: {
      sha: string;
      message: string;
      author: string;
      date: string;
      url: string;
    } | null;
    note: string;
  }>(null);
  const [suspectBusy, setSuspectBusy] = useState(false);

  async function findSuspect() {
    setSuspectBusy(true);
    try {
      setSuspect(await api(`/groups/${groupId}/suspect`));
    } finally {
      setSuspectBusy(false);
    }
  }

  useEffect(() => {
    api<{ group: ErrorGroup; recentEvents: ErrorEvent[] }>(`/groups/${groupId}`)
      .then((d) => {
        setGroup(d.group);
        setEvents(d.recentEvents);
      })
      .catch(() => {});
  }, [groupId]);

  async function resolve() {
    await api(`/groups/${groupId}/resolve`, {
      method: 'PATCH',
      body: { note: note || undefined },
    });
    navigate(-1);
  }

  if (!group) return <div className="dim">불러오는 중...</div>;

  const sample = events[0];

  return (
    <>
      <Prompt cmd="show" arg={`group#${group.id}`} />

      <div className="panel">
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
          <span className="danger" style={{ fontSize: 16 }}>{group.name}</span>
          <span className={`badge ${group.status}`}>
            {group.status === 'open' ? '열림' : '해결됨'}
          </span>
          {group.regressed && <span className="badge fail">회귀 (재발)</span>}
          {group.firstRelease && (
            <span className="dim">최초 배포: {group.firstRelease}</span>
          )}
          <span className="dim">
            총 <span className="count">{group.count.toLocaleString()}</span>회 ·
            처음 {group.firstSeenAt.slice(0, 16).replace('T', ' ')} ·
            마지막 {group.lastSeenAt.slice(0, 16).replace('T', ' ')}
          </span>
        </div>
        <div style={{ marginTop: 8 }}>{group.message}</div>
        {group.topFrame && (
          <div className="dim" style={{ marginTop: 4 }}>위치: {group.topFrame}</div>
        )}
        {group.resolveNote && (
          <div style={{ marginTop: 10 }}>
            <span className="badge resolved">해결 메모</span>{' '}
            {group.resolveNote}
          </div>
        )}
      </div>

      {sample?.stack && (
        <div className="panel">
          <div className="dim" style={{ marginBottom: 8 }}>스택트레이스 (가장 최근 발생)</div>
          <pre className="stack">{sample.stack}</pre>
          {sample.traceId && (
            <div className="dim" style={{ marginTop: 8 }}>traceId: {sample.traceId}</div>
          )}
          {sample.context && (
            <div className="dim" style={{ marginTop: 4 }}>
              context: {JSON.stringify(sample.context)}
            </div>
          )}

          {/* 범인 찾기: 스택 위치 -> GitHub 코드 링크 + 그 파일 최근 커밋 */}
          <div style={{ marginTop: 12, borderTop: '1px solid var(--coal-2)', paddingTop: 12 }}>
            {!suspect ? (
              <button className="btn ghost" onClick={findSuspect} disabled={suspectBusy}>
                {suspectBusy ? '찾는 중...' : '🔍 범인 커밋 찾기 (GitHub)'}
              </button>
            ) : (
              <div>
                {suspect.blobLink && (
                  <div style={{ marginBottom: 8 }}>
                    <a href={suspect.blobLink} target="_blank" rel="noreferrer" className="canary">
                      → 터진 코드 줄로 이동 (GitHub)
                    </a>
                  </div>
                )}
                {suspect.suspectCommit ? (
                  <div>
                    <span className="badge fail">유력 용의자</span>{' '}
                    <a href={suspect.suspectCommit.url} target="_blank" rel="noreferrer">
                      <span className="count">{suspect.suspectCommit.sha}</span>
                    </a>{' '}
                    {suspect.suspectCommit.message}
                    <div className="dim" style={{ fontSize: 12, marginTop: 2 }}>
                      {suspect.suspectCommit.author} ·{' '}
                      {suspect.suspectCommit.date.slice(0, 10)}
                    </div>
                  </div>
                ) : null}
                <div className="dim" style={{ fontSize: 12, marginTop: 6 }}>
                  {suspect.note}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="panel">
        <div className="dim" style={{ marginBottom: 8 }}>
          최근 발생 {events.length}건
        </div>
        <table>
          <tbody>
            {events.map((ev) => (
              <tr key={ev.id}>
                <td className="dim" style={{ whiteSpace: 'nowrap' }}>
                  {ev.occurredAt.slice(5, 19).replace('T', ' ')}
                </td>
                <td>{ev.message.slice(0, 90)}</td>
                <td className="dim">{ev.traceId ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {group.status === 'open' && (
        <div className="panel">
          {!resolving ? (
            <button className="btn" onClick={() => setResolving(true)}>
              해결 처리
            </button>
          ) : (
            <>
              <label htmlFor="note">
                원인과 조치를 한 줄로 남겨 주세요 — 다음에 비슷한 에러가 나면
                이 메모가 알람에 함께 나옵니다
              </label>
              <textarea
                id="note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="예: RDS 커넥션 풀 고갈. max_connections 20 -> 50 상향으로 해결"
                autoFocus
              />
              <div style={{ marginTop: 12, display: 'flex', gap: 10 }}>
                <button className="btn" onClick={resolve}>
                  메모 남기고 해결
                </button>
                <button className="btn ghost" onClick={() => setResolving(false)}>
                  취소
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
