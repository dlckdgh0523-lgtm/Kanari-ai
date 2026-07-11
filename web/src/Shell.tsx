import { Navigate, Outlet, Link } from 'react-router-dom';
import { clearSession, getToken } from './api';

// 모든 화면의 공통 껍데기: ssh 상태바.
// kanari@console 은 이 제품의 정체성(터미널)을 매 화면 유지하는 장치다.
export function Shell() {
  if (!getToken()) return <Navigate to="/login" replace />;

  const email = localStorage.getItem('kanari_email') ?? '';

  return (
    <>
      <div className="statusbar">
        <Link to="/console">
          <span className="host">kanari</span>
          <span className="dim">@console</span>
        </Link>
        <span className="sep">│</span>
        <span className="dim">연결됨</span>
        <span className="right">
          <Link to="/" className="dim">
            소개
          </Link>
          <span className="dim">{email}</span>
          <a
            href="/login"
            onClick={() => clearSession()}
            className="dim"
          >
            로그아웃
          </a>
        </span>
      </div>
      <div className="page">
        <Outlet />
      </div>
    </>
  );
}

// 시그니처 요소: 셸 프롬프트 형태의 화면 제목
export function Prompt({ cmd, arg }: { cmd: string; arg?: string }) {
  return (
    <div className="prompt-line">
      <span className="chevron">❯</span>
      <span className="cmd">kanari {cmd}</span>
      {arg && <span className="arg"> {arg}</span>}
      <span className="cursor" />
    </div>
  );
}
