import { Fragment, useEffect, useState } from 'react';
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
  // 웹훅 인라인 편집. window.prompt는 임베디드 브라우저에서 차단되는 경우가 있어 쓰지 않는다
  const [editingId, setEditingId] = useState<number | null>(null);
  const [webhookInput, setWebhookInput] = useState('');

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

  function openWebhookEditor(p: Project) {
    setEditingId(p.id);
    setWebhookInput(p.discordWebhookUrl ?? '');
  }

  async function saveWebhook() {
    if (editingId === null) return;
    await api(`/projects/${editingId}/webhook`, {
      method: 'PATCH',
      body: { discordWebhookUrl: webhookInput },
    });
    setEditingId(null);
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
              <Fragment key={p.id}>
                <tr className="row">
                  <td>
                    <Link to={`/console/projects/${p.id}/groups`}>
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
                    <button className="btn ghost" onClick={() => openWebhookEditor(p)}>
                      웹훅 설정
                    </button>{' '}
                    <Link to={`/console/projects/${p.id}/apm`} className="dim">
                      성능
                    </Link>{' '}
                    <Link to={`/console/projects/${p.id}/checks`} className="dim">
                      합성 테스트
                    </Link>{' '}
                    <Link to={`/console/projects/${p.id}/logs`} className="dim">
                      로그 →
                    </Link>
                  </td>
                </tr>
                {editingId === p.id && (
                  <tr>
                    <td colSpan={4}>
                      <label htmlFor={`wh-${p.id}`}>
                        Discord 웹훅 URL — 서버 설정 → 연동 → 웹훅에서 만들 수
                        있습니다. 비우고 저장하면 알림이 꺼집니다
                      </label>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <input
                          id={`wh-${p.id}`}
                          value={webhookInput}
                          onChange={(e) => setWebhookInput(e.target.value)}
                          placeholder="https://discord.com/api/webhooks/..."
                          autoFocus
                        />
                        <button className="btn" onClick={saveWebhook} style={{ whiteSpace: 'nowrap' }}>
                          저장
                        </button>
                        <button className="btn ghost" onClick={() => setEditingId(null)}>
                          취소
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
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
