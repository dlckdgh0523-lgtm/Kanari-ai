import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import './styles.css';
import { ProjectLayout } from './ProjectLayout';
import { Shell } from './Shell';
import { Apm } from './pages/Apm';
import { Checks } from './pages/Checks';
import { Diagnostics } from './pages/Diagnostics';
import { GroupDetail } from './pages/GroupDetail';
import { Inbox } from './pages/Inbox';
import { Landing } from './pages/Landing';
import { LogStream } from './pages/LogStream';
import { Login } from './pages/Login';
import { Overview } from './pages/Overview';
import { Projects } from './pages/Projects';

// 흐름: 랜딩(/) -> 로그인(/login) -> 콘솔(/console)
// 콘솔 안: 프로젝트 목록 -> 프로젝트(탭: 개요/에러/로그/성능/합성/진단)
const router = createBrowserRouter([
  { path: '/', element: <Landing /> },
  { path: '/login', element: <Login /> },
  {
    path: '/console',
    element: <Shell />,
    children: [
      { index: true, element: <Projects /> },
      { path: 'groups/:groupId', element: <GroupDetail /> },
      {
        path: 'projects/:projectId',
        element: <ProjectLayout />,
        children: [
          { index: true, element: <Overview /> },
          { path: 'groups', element: <Inbox /> },
          { path: 'logs', element: <LogStream /> },
          { path: 'apm', element: <Apm /> },
          { path: 'checks', element: <Checks /> },
          { path: 'diagnostics', element: <Diagnostics /> },
        ],
      },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
