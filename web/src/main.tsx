import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles.css';
import { Shell } from './Shell';
import { Apm } from './pages/Apm';
import { Checks } from './pages/Checks';
import { GroupDetail } from './pages/GroupDetail';
import { Inbox } from './pages/Inbox';
import { Landing } from './pages/Landing';
import { LogStream } from './pages/LogStream';
import { Login } from './pages/Login';
import { Projects } from './pages/Projects';

// 흐름: 랜딩(/) -> 로그인(/login) -> 콘솔(/console/...)
const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/login', element: <Login /> },
  {
    path: '/console',
    element: <Shell />, // 상단 상태바 + 로그인 확인
    children: [
      { index: true, element: <Projects /> },
      { path: 'projects/:projectId/groups', element: <Inbox /> },
      { path: 'projects/:projectId/logs', element: <LogStream /> },
      { path: 'projects/:projectId/checks', element: <Checks /> },
      { path: 'projects/:projectId/apm', element: <Apm /> },
      { path: 'groups/:groupId', element: <GroupDetail /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
