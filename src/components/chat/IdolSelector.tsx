import type { IdolMeta } from '@/types/idol';
import { useChatStore } from '@/stores/chat-store';
import { getFlagImageUrl, getCountryName } from '@/utils/language';

interface Props {
  idols: IdolMeta[];
}

function getInitials(name: string): string {
  return name.slice(0, 1);
}

export default function IdolSelector({ idols }: Props) {
  const setCurrentIdol = useChatStore((s) => s.setCurrentIdol);

  return (
    <div className="polichat-bg min-h-[100dvh] overflow-y-auto overflow-x-hidden relative hide-scrollbar">
      {/* Subtle background pattern */}
      <div className="policy-pattern" />

      <div 
        className="mx-auto px-4 pt-10 pb-8 relative z-10"
        style={{ maxWidth: '600px' }}
      >
        {/* Hero */}
        <div className="text-center mb-10">
          {/* Logo */}
          <div className="flex items-center justify-center gap-3 mb-4 animate-fade-in">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-800 to-slate-600 flex items-center justify-center shadow-lg">
              <span className="text-2xl">🏛️</span>
            </div>
            <h1 className="text-4xl font-black tracking-tight text-slate-800">
              Polichat
            </h1>
          </div>
          
          {/* Hero Message */}
          <div 
            className="animate-fade-in-up"
            style={{ animationDelay: '0.1s' }}
          >
            <p className="text-xl font-bold text-slate-700 tracking-tight mb-2">
              정치인과 대화하기 💬
            </p>
            <p className="text-sm text-slate-500 leading-relaxed">
              AI가 학습한 정치인의 정책과 비전
              <br />
              <span className="text-slate-400">직접 물어보고 토론하세요</span>
            </p>
          </div>
        </div>

        {/* Politician Cards */}
        <div className="space-y-4">
          {idols.map((idol, index) => (
            <button
              key={idol.id}
              onClick={() => setCurrentIdol(idol.id)}
              className="w-full text-left animate-slide-up-bounce group"
              style={{ animationDelay: `${0.15 + index * 0.06}s` }}
            >
              <div 
                className="politician-card rounded-2xl overflow-hidden"
                style={{
                  ['--pol-color' as string]: idol.themeColor,
                  ['--pol-color-secondary' as string]: idol.themeColorSecondary,
                }}
              >
                <div className="flex items-stretch">
                  {/* Avatar */}
                  <div
                    className="politician-image w-28 aspect-square flex items-center justify-center text-white text-2xl font-bold shrink-0"
                    style={{
                      background: `linear-gradient(145deg, ${idol.themeColor}, ${idol.themeColorSecondary})`,
                    }}
                  >
                    {idol.profileImageUrl ? (
                      <img
                        src={idol.profileImageUrl}
                        alt={idol.nameKo}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    ) : (
                      <span className="drop-shadow-lg text-3xl">{getInitials(idol.nameKo)}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 px-4 py-4 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1 min-w-0">
                      <span className="font-bold text-lg text-slate-800 tracking-tight">
                        {idol.nameKo}
                      </span>
                      <span
                        className="party-badge text-[10px] px-2.5 py-0.5 rounded-full text-white font-medium"
                        style={{ 
                          background: idol.themeColor,
                        }}
                      >
                        {idol.group}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 font-medium mb-1">
                      {idol.nameEn}
                    </p>
                    <p className="text-sm text-slate-600 truncate">
                      {idol.tagline}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center pr-4">
                    <div 
                      className="w-10 h-10 rounded-full flex items-center justify-center transition-all duration-300 group-hover:scale-110"
                      style={{
                        background: `${idol.themeColor}15`,
                      }}
                    >
                      <svg
                        className="w-5 h-5 transition-transform duration-300 group-hover:translate-x-0.5"
                        fill="none"
                        stroke={idol.themeColor}
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2.5}
                          d="M9 5l7 7-7 7"
                        />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {idols.length === 0 && (
          <div className="text-center text-slate-400 mt-10 animate-fade-in bg-white/60 backdrop-blur-sm rounded-2xl p-8 border border-slate-200">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <span className="text-2xl">🏛️</span>
            </div>
            <p className="text-sm font-medium text-slate-600">등록된 정치인이 없습니다</p>
            <p className="text-xs text-slate-400 mt-1">곧 새로운 정치인이 추가됩니다</p>
          </div>
        )}
      </div>
    </div>
  );
}
