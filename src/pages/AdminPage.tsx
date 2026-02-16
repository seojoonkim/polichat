import { useEffect, useState } from 'react';
import { usePoliticianStore } from '@/stores/politician-store';
import AdminLayout from '@/components/admin/AdminLayout';

const ADMIN_PASSWORD = 'admin';

function AdminGate({ children }: { children: React.ReactNode }) {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  // Check sessionStorage for existing auth
  useEffect(() => {
    if (sessionStorage.getItem('mimchat-admin-auth') === 'true') {
      setAuthenticated(true);
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      sessionStorage.setItem('mimchat-admin-auth', 'true');
      setAuthenticated(true);
      setError(false);
    } else {
      setError(true);
    }
  };

  if (authenticated) {
    return <>{children}</>;
  }

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-lg p-8 w-full max-w-sm"
      >
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-purple-600 bg-clip-text text-transparent">
            Polichat Admin
          </h1>
          <p className="text-gray-400 text-sm mt-1">비밀번호를 입력하세요</p>
        </div>

        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(false);
          }}
          placeholder="비밀번호"
          autoFocus
          className={`w-full px-4 py-3 rounded-xl border ${
            error ? 'border-red-400' : 'border-gray-200'
          } focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors`}
        />

        {error && (
          <p className="text-red-500 text-xs mt-2">비밀번호가 틀렸습니다.</p>
        )}

        <button
          type="submit"
          className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-600 text-white font-medium hover:shadow-lg transition-shadow"
        >
          로그인
        </button>
      </form>
    </div>
  );
}

export default function AdminPage() {
  const loadPoliticians = usePoliticianStore((s) => s.loadPoliticians);

  useEffect(() => {
    loadPoliticians();
  }, [loadPoliticians]);

  return (
    <AdminGate>
      <AdminLayout />
    </AdminGate>
  );
}
