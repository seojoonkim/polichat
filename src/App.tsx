import { Routes, Route, Navigate } from 'react-router';
import { lazy, Suspense } from 'react';
import ChatPage from './pages/ChatPage';
import DebatePage from './pages/DebatePage';

const AdminPage = lazy(() => import('./pages/AdminPage'));
const IssuesPage = lazy(() => import('./pages/IssuesPage'));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ChatPage />} />
      <Route path="/chat" element={<Navigate to="/" replace />} />
      <Route path="/chat/:politicianId" element={<ChatPage />} />
      <Route path="/debate" element={<DebatePage />} />
      <Route
        path="/issues"
        element={
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-gray-400">Loading issues...</div>
              </div>
            }
          >
            <IssuesPage />
          </Suspense>
        }
      />
      <Route
        path="/admin/*"
        element={
          <Suspense
            fallback={
              <div className="flex items-center justify-center h-screen bg-gray-50">
                <div className="text-gray-400">Loading admin...</div>
              </div>
            }
          >
            <AdminPage />
          </Suspense>
        }
      />
    </Routes>
  );
}
