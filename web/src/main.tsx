import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles.css';
import { Shell } from './Shell';
import { GroupDetail } from './pages/GroupDetail';
import { Inbox } from './pages/Inbox';
import { LogStream } from './pages/LogStream';
import { Login } from './pages/Login';
import { Projects } from './pages/Projects';

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: <Shell />, // 상단 상태바 + 로그인 확인
    children: [
      { index: true, element: <Projects /> },
      { path: 'projects/:projectId/groups', element: <Inbox /> },
      { path: 'projects/:projectId/logs', element: <LogStream /> },
      { path: 'groups/:groupId', element: <GroupDetail /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
