import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, setSession } from '../api';

// 로그인과 가입을 한 화면에서. 탭 전환 대신 모드 토글이 터미널답게 담백하다.
export function Login() {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await api<{ token: string; email: string }>(
        `/auth/${mode}`,
        { method: 'POST', body: { email, password } },
      );
      setSession(res.token, res.email);
      navigate('/');
    } catch (err) {
      setError(err instanceof Error ? err.message : '요청 실패');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="gate">
      <div className="gate-box">
        <div className="gate-logo">
          <span className="bird">◗</span> kanari
          <span className="cursor" />
        </div>
        <div className="gate-sub">
          사람보다 먼저 장애를 감지하는 에러 관제 콘솔
        </div>

        <form onSubmit={submit} className="panel">
          <label htmlFor="email">이메일</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
          <label htmlFor="password">비밀번호 (8자 이상)</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          {error && <div className="error-text">{error}</div>}
          <div style={{ marginTop: 18, display: 'flex', gap: 10 }}>
            <button className="btn" disabled={busy}>
              {mode === 'login' ? '로그인' : '가입하기'}
            </button>
            <button
              type="button"
              className="btn ghost"
              onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
            >
              {mode === 'login' ? '처음이에요' : '계정이 있어요'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
