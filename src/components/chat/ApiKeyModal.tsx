import { useState } from 'react';
import { useApiKeyStore } from '@/stores/api-key-store';

interface Props {
  returnTo?: string;
}

export default function ApiKeyModal(_props: Props) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const setApiKey = useApiKeyStore((s) => s.setApiKey);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) {
      setError('Please enter your API key.');
      return;
    }
    if (!trimmed.startsWith('sk-ant-')) {
      setError('Invalid API key format. Must start with sk-ant-');
      return;
    }
    setApiKey(trimmed);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-blue-50 p-4">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="bg-white rounded-3xl shadow-xl p-8">
          {/* Logo */}
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-pink-400 to-purple-500 mb-4">
              <svg
                className="w-8 h-8 text-white"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Polichat</h1>
            <p className="text-sm text-gray-500 mt-1">
              Chat with AI Politicians
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Anthropic API Key
            </label>
            <input
              type="password"
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                setError('');
              }}
              placeholder="sk-ant-..."
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:border-purple-400 focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm"
              autoFocus
            />
            {error && (
              <p className="text-red-500 text-xs mt-2">{error}</p>
            )}

            <button
              type="submit"
              className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-pink-500 to-purple-500 text-white font-semibold text-sm hover:from-pink-600 hover:to-purple-600 transition-all shadow-md hover:shadow-lg"
            >
              Get Started
            </button>
          </form>

          {/* Info */}
          <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed">
            Your API key is stored locally
            <br />
            and sent directly to Anthropic.
          </p>
        </div>
      </div>
    </div>
  );
}
