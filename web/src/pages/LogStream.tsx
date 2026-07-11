import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../api';
import type { ErrorEvent } from '../api';
import { Prompt } from '../Shell';

// 터미널 로그 뷰: tail -f 처럼 최근 이벤트가 아래로 흐른다.
// 3초 주기 폴링 - 규모가 커지면 SSE로 바꾸는 것이 다음 개선 (이미 서버에 경험 있음)
export function LogStream() {
  const { projectId } = useParams();
  const [events, setEvents] = useState<ErrorEvent[]>([]);
  const termRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    let alive = true;

    async function poll() {
      try {
        const data = await api<ErrorEvent[]>(`/projects/${projectId}/events`);
        if (alive) setEvents(data.slice().reverse()); // 오래된 것부터 위로
      } catch {
        /* 다음 폴링에서 재시도 */
      }
    }

    poll();
    const timer = setInterval(poll, 3000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [projectId]);

  // 사용자가 위로 스크롤해서 과거를 보는 중이면 자동 스크롤을 멈춘다
  useEffect(() => {
    const el = termRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [events]);

  return (
    <>
      <Prompt cmd="tail" arg={`-f --project ${projectId}`} />

      <div
        className="term"
        ref={termRef}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current =
            el.scrollHeight - el.scrollTop - el.clientHeight < 40;
        }}
      >
        {events.length === 0 && (
          <span className="line dim">수신된 이벤트가 없습니다. 대기 중...</span>
        )}
        {events.map((ev) => (
          <span key={ev.id} className="line">
            <span className="t">{ev.occurredAt.slice(5, 19).replace('T', ' ')}</span>{' '}
            <span className={`lv-${ev.level}`}>{ev.level.toUpperCase().padEnd(5)}</span>{' '}
            {ev.message.slice(0, 160)}
            {ev.traceId && <span className="trace">  [{ev.traceId}]</span>}
          </span>
        ))}
        <span className="line">
          <span className="cursor" />
        </span>
      </div>
      <div className="dim" style={{ marginTop: 10, fontSize: 12 }}>
        3초마다 갱신 · error와 warn만 수집됩니다 (SDK 기본 설정)
      </div>
    </>
  );
}
