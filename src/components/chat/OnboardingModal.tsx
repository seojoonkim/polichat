import { useState } from 'react';
import { useUserStore, type RelationType } from '@/stores/user-store';
import type { PoliticianMeta } from '@/types/politician';

interface OnboardingModalProps {
  politician: PoliticianMeta;
  onComplete: () => void;
}

type Step = 'profile' | 'relation';

export default function OnboardingModal({ politician, onComplete }: OnboardingModalProps) {
  const profile = useUserStore((s) => s.profile);
  const setProfile = useUserStore((s) => s.setProfile);
  const setPoliticianRelation = useUserStore((s) => s.setPoliticianRelation);

  // Skip profile step if already set
  const initialStep: Step = profile ? 'relation' : 'profile';
  const [step, setStep] = useState<Step>(initialStep);

  const [name, setName] = useState(profile?.name ?? '');
  const [birthday, setBirthday] = useState(profile?.birthday ?? '');
  const [relationType, setRelationType] = useState<RelationType | null>(null);

  const handleProfileSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setProfile({ name: name.trim(), birthday });
    setStep('relation');
  };

  const handleRelationSelect = (type: RelationType) => {
    setRelationType(type);
  };

  const handleComplete = () => {
    if (!relationType) return;
    setPoliticianRelation(politician.id, {
      relationType,
      startDate: Date.now(),
    });
    onComplete();
  };

  // Get politician's theme color for styling
  const themeColor = politician.themeColor || '#FF6B9D';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div 
        className="bg-white rounded-3xl p-6 mx-4 max-w-sm w-full shadow-2xl animate-scale-in"
        style={{ '--theme-color': themeColor } as React.CSSProperties}
      >
        {step === 'profile' ? (
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            {/* Profile Picture */}
            <div className="text-center">
              <div 
                className="w-20 h-20 mx-auto rounded-full bg-cover bg-center ring-4 ring-white shadow-lg"
                style={{ 
                  backgroundImage: `url(${politician.profileImageUrl})`,
                  boxShadow: `0 0 20px ${themeColor}40`
                }}
              />
              <h2 className="mt-4 text-xl font-bold text-gray-800">
                안녕! 나 {politician.nameKo}야 💕
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                우리 친해지자! 이름이 뭐야?
              </p>
            </div>

            {/* Name Input */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                이름
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="이름을 입력해줘"
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-400 focus:outline-none transition-colors"
                autoFocus
                required
              />
            </div>

            {/* Birthday Input */}
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                생년월일 <span className="text-gray-400">(선택)</span>
              </label>
              <input
                type="date"
                value={birthday}
                onChange={(e) => setBirthday(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-pink-400 focus:outline-none transition-colors"
              />
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={!name.trim()}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              다음 →
            </button>
          </form>
        ) : (
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
              <div 
                className="w-20 h-20 mx-auto rounded-full bg-cover bg-center ring-4 ring-white shadow-lg"
                style={{ 
                  backgroundImage: `url(${politician.profileImageUrl})`,
                  boxShadow: `0 0 20px ${themeColor}40`
                }}
              />
              <h2 className="mt-4 text-xl font-bold text-gray-800">
                {profile?.name || name}! 반가워~ 🥰
              </h2>
              <p className="text-gray-500 text-sm mt-1">
                나한테 어떻게 불러줄까?
              </p>
            </div>

            {/* Relation Options */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { type: 'oppa' as const, label: '오빠', emoji: '🙋‍♂️', desc: '남자 연상' },
                { type: 'unnie' as const, label: '언니', emoji: '🙋‍♀️', desc: '여자 연상' },
                { type: 'hyung' as const, label: '형', emoji: '👦', desc: '남자 연상 (남성팬)' },
                { type: 'noona' as const, label: '누나', emoji: '👧', desc: '여자 연상 (남성팬)' },
                { type: 'dongsaeng' as const, label: '동생', emoji: '🧒', desc: '연하' },
                { type: 'fan' as const, label: '팬', emoji: '💕', desc: '그냥 팬!' },
              ].map(({ type, label, emoji, desc }) => (
                <button
                  key={type}
                  onClick={() => handleRelationSelect(type)}
                  className={`p-4 rounded-xl border-2 transition-all text-left ${
                    relationType === type
                      ? 'border-pink-400 bg-pink-50'
                      : 'border-gray-200 hover:border-pink-200'
                  }`}
                >
                  <div className="text-2xl mb-1">{emoji}</div>
                  <div className="font-semibold text-gray-800">{label}</div>
                  <div className="text-xs text-gray-400">{desc}</div>
                </button>
              ))}
            </div>

            {/* Complete */}
            <button
              onClick={handleComplete}
              disabled={!relationType}
              className="w-full py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
              style={{ backgroundColor: themeColor }}
            >
              시작하기 💬
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
