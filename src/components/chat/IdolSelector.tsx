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
    <div className="premium-bg min-h-[100dvh] overflow-y-auto overflow-x-hidden relative hide-scrollbar">
      {/* Floating orbs background */}
      <div className="orb orb-1" />
      <div className="orb orb-2" />
      <div className="orb orb-3" />

      <div 
        className="mx-auto px-4 pt-8 pb-16 relative z-10"
        style={{ maxWidth: '600px' }}
      >
        {/* Hero */}
        <div className="text-center mb-8">
          {/* Logo with glow */}
          <div className="flex items-center justify-center gap-2 mb-3 animate-fade-in">
            <img 
              src="/logo.svg" 
              alt="Mim.chat" 
              className="w-11 h-11 logo-glow"
            />
            <h1 className="text-4xl font-black tracking-tight shimmer-text">
              Mim.chat
            </h1>
            <span className="ml-1.5 px-2.5 py-0.5 text-[10px] beta-badge rounded-full">
              R&D Beta
            </span>
          </div>
          
          {/* Hero Message */}
          <div 
            className="animate-fade-in-up"
            style={{ animationDelay: '0.1s' }}
          >
            <p className="text-xl font-bold text-gray-800 tracking-tight mb-1.5">
              Meet Your Mim ✨
            </p>
            <p className="text-sm text-gray-500 leading-relaxed">
              <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent font-medium">
                AI trained on their personality
              </span>
              <br />remembers you & grows closer
            </p>
          </div>
        </div>

        {/* Idol Cards */}
        <div className="space-y-4">
          {idols.map((idol, index) => (
            <button
              key={idol.id}
              onClick={() => setCurrentIdol(idol.id)}
              className="w-full text-left animate-slide-up-bounce group"
              style={{ animationDelay: `${0.15 + index * 0.06}s` }}
            >
              <div 
                className="idol-card glass-card rounded-2xl overflow-hidden"
                style={{
                  ['--idol-color' as string]: idol.themeColor,
                  ['--idol-color-secondary' as string]: idol.themeColorSecondary,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `linear-gradient(135deg, rgba(255,255,255,0.85), ${idol.themeColor}08)`;
                  e.currentTarget.style.borderColor = `${idol.themeColor}40`;
                  e.currentTarget.style.boxShadow = `
                    0 12px 32px -8px ${idol.themeColor}20,
                    0 4px 12px -4px ${idol.themeColor}12,
                    inset 0 1px 0 rgba(255,255,255,0.9)
                  `;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '';
                  e.currentTarget.style.borderColor = '';
                  e.currentTarget.style.boxShadow = '';
                }}
              >
                <div className="flex items-stretch">
                  {/* Avatar */}
                  <div
                    className="idol-image-wrapper w-24 aspect-square flex items-center justify-center text-white text-2xl font-bold shrink-0"
                    style={{
                      background: `linear-gradient(145deg, ${idol.themeColor}, ${idol.themeColorSecondary})`,
                    }}
                  >
                    {idol.profileImageUrl ? (
                      <img
                        src={idol.profileImageUrl}
                        alt={idol.nameKo}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                      />
                    ) : (
                      <span className="drop-shadow-lg">{getInitials(idol.nameKo)}</span>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 px-4 py-4 flex flex-col justify-center">
                    <div className="flex items-center gap-2 mb-1 min-w-0">
                      <span className="font-bold text-lg text-gray-800 tracking-tight truncate shrink-0 max-w-[140px]">
                        {idol.nameKo}
                      </span>
                      <img 
                        src={getFlagImageUrl(idol.language)} 
                        alt={getCountryName(idol.language)}
                        className="w-5 h-4 object-cover rounded-sm"
                        title={idol.language || 'ko'}
                      />
                      <span
                        className="group-pill text-[10px] px-2.5 py-0.5 rounded-full text-white"
                        style={{ 
                          background: `linear-gradient(135deg, ${idol.themeColor}, ${idol.themeColorSecondary})`,
                        }}
                      >
                        {idol.group}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 font-medium">
                      {idol.nameEn}
                    </p>
                    <p className="text-sm text-gray-500 truncate mt-1">
                      {idol.tagline}
                    </p>
                  </div>

                  {/* Arrow */}
                  <div className="flex items-center pr-4">
                    <div 
                      className="idol-arrow w-9 h-9 rounded-full flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${idol.themeColor}15, ${idol.themeColorSecondary}20)`,
                      }}
                    >
                      <svg
                        className="w-5 h-5"
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
          <div className="text-center text-gray-400 mt-10 animate-fade-in glass-card rounded-2xl p-6">
            <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-violet-100 to-pink-100 flex items-center justify-center">
              <svg className="w-6 h-6 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <p className="text-sm font-medium">No celebrities found</p>
            <p className="text-xs text-gray-300 mt-1">New celebs coming soon</p>
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-center mt-4 text-sm text-gray-500 animate-fade-in gap-2"
          style={{ animationDelay: '0.4s', opacity: 0 }}
        >
          <span className="bg-gradient-to-r from-violet-500 to-pink-500 bg-clip-text text-transparent font-semibold">
            Mim.chat
          </span>
          <span className="text-gray-400">•</span>
          <span>Made with 💜</span>
        </div>
      </div>
    </div>
  );
}
