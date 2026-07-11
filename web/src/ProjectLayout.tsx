import { NavLink, Outlet, useParams } from 'react-router-dom';
import { Prompt } from './Shell';

// 프로젝트 안의 모든 화면이 공유하는 탭 내비게이션.
// 화면이 쪼개져 보이던 문제를 해결한다: 개요를 중심에 두고 세부는 탭으로 오간다.
const TABS = [
  { to: '', label: '개요', end: true },
  { to: 'groups', label: '에러' },
  { to: 'logs', label: '로그' },
  { to: 'apm', label: '성능' },
  { to: 'checks', label: '합성 테스트' },
  { to: 'diagnostics', label: '진단' },
];

export function ProjectLayout() {
  const { projectId } = useParams();
  const base = `/console/projects/${projectId}`;

  return (
    <>
      <Prompt cmd="project" arg={`#${projectId}`} />
      <nav className="tabs">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to ? `${base}/${t.to}` : base}
            end={t.end}
            className={({ isActive }) => (isActive ? 'tab active' : 'tab')}
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </>
  );
}
