import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api';
import type { Project } from '../api';
import { Prompt } from '../Shell';

// 프로젝트 목록 + 생성. 생성 직후 응답에만 API 키가 담겨 오므로
// 그 자리에서 한 번만 보여주고, 복사하라고 강하게 안내한다.
export function Projects() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [issuedKey, setIssuedKey] = useState<{ name: string; key: string } | null>(null);
  const [error, setError] = useState('');

  async function load() {
    setProjects(await api<Project[]>('/projects'));
  }
  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setError('');
    try {
      const res = await api<{ id: number; name: string; apiKey: string }>(
        '/projects',
        { method: 'POST', body: { name } },
      );
      setIssuedKey({ name: res.name, key: res.apiKey });
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '생성 실패');
    }
  }

  async function saveWebhook(projectId: number) {
    const url = window.prompt('Discord 웹훅 URL (비우면 해제)') ?? '';
    await api(`/projects/${projectId}/webhook`, {
      method: 'PATCH',
      body: { discordWebhookUrl: url },
    });
    await load();
  }

  return (
    <>
      <Prompt cmd="projects" />

      {issuedKey && (
        <div className="panel">
          <b>{issuedKey.name}</b> 프로젝트가 만들어졌습니다. 아래 키를 지금
          복사하세요 — <span className="danger">다시 보여드리지 않습니다.</span>
          <div className="keybox">
            <span className="key">{issuedKey.key}</span>
          </div>
          <div className="dim" style={{ marginTop: 10, fontSize: 13 }}>
            서버 코드에 붙이는 법: npm install kanari winston 후 로거에
            KanariTransport를 추가하고 이 키를 넣으면 됩니다
          </div>
          <button
            className="btn ghost"
            style={{ marginTop: 12 }}
            onClick={() => {
              navigator.clipboard.writeText(issuedKey.key);
              setIssuedKey(null);
            }}
          >
            복사하고 닫기
          </button>
        </div>
      )}

      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>프로젝트</th>
              <th>알림</th>
              <th>만든 날</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="row">
                <td>
                  <Link to={`/projects/${p.id}/groups`}>
                    <span className="count">{p.name}</span>
                  </Link>
                </td>
                <td>
                  {p.discordWebhookUrl ? (
                    <span className="badge ok">Discord 연결됨</span>
                  ) : (
                    <span className="badge unknown">알림 없음</span>
                  )}
                </td>
                <td className="dim">{p.createdAt.slice(0, 10)}</td>
                <td>
                  <button className="btn ghost" onClick={() => saveWebhook(p.id)}>
                    웹훅 설정
                  </button>{' '}
                  <Link to={`/projects/${p.id}/logs`} className="dim">
                    로그 보기 →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {projects.length === 0 && (
          <div className="empty">
            아직 프로젝트가 없습니다. 아래에서 첫 프로젝트를 만들어 보세요.
          </div>
        )}
      </div>

      <form className="panel" onSubmit={create}>
        <label htmlFor="pname">새 프로젝트 이름 (감시할 서비스 이름)</label>
        <div style={{ display: 'flex', gap: 10 }}>
          <input
            id="pname"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="예: jinro-backend"
            required
            maxLength={100}
          />
          <button className="btn" style={{ whiteSpace: 'nowrap' }}>
            만들고 키 받기
          </button>
        </div>
        {error && <div className="error-text">{error}</div>}
      </form>
    </>
  );
}
