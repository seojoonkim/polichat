import { Routes, Route } from 'react-router';
import { lazy, Suspense } from 'react';
import ChatPage from './pages/ChatPage';

const AdminPage = lazy(() => import('./pages/AdminPage'));

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<ChatPage />} />
      <Route path="/chat/:idolId" element={<ChatPage />} />
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
