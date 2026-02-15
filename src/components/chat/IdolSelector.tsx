import type { IdolMeta } from '@/types/idol';
import { useChatStore } from '@/stores/chat-store';

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
          <div className="flex items-center justify-center gap-3 mb-5 animate-fade-in">
            <img src="/logo.svg" alt="Polichat" className="w-14 h-14" />
            <h1 className="text-4xl font-black tracking-tight text-slate-800">
              Polichat
            </h1>
          </div>
          
          {/* Hero Message */}
          <div 
            className="animate-fade-in-up"
            style={{ animationDelay: '0.1s' }}
          >
            <p className="text-xl font-bold text-slate-700 tracking-tight mb-3">
              정치인에게 직접 물어보세요
            </p>
            <p className="text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
              AI가 공약, 경력, 발언을 학습했습니다
              <br />
              <span className="text-slate-400">정책 질문부터 일상 대화까지 자유롭게</span>
            </p>
          </div>
          
          {/* Feature badges */}
          <div 
            className="flex items-center justify-center gap-2 mt-5 animate-fade-in-up"
            style={{ animationDelay: '0.2s' }}
          >
            <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-medium rounded-full">
              📋 실제 공약 기반
            </span>
            <span className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-medium rounded-full">
              💬 실시간 대화
            </span>
          </div>
        </div>

        {/* Section title */}
        <div className="mb-4 animate-fade-in-up" style={{ animationDelay: '0.15s' }}>
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider">
            대화 상대 선택
          </h2>
        </div>

        {/* Politician Cards */}
        <div className="space-y-4">
          {idols.map((idol, index) => (
            <button
              key={idol.id}
              onClick={() => setCurrentIdol(idol.id)}
              className="w-full text-left animate-slide-up-bounce group"
              style={{ animationDelay: `${0.2 + index * 0.08}s` }}
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
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                          e.currentTarget.nextElementSibling?.classList.remove('hidden');
                        }}
                      />
                    ) : null}
                    <span className={idol.profileImageUrl ? 'hidden' : ''}>
                      {getInitials(idol.nameKo)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 p-4 flex flex-col justify-center min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-lg text-slate-800 truncate">
                        {idol.nameKo}
                      </h3>
                      <span 
                        className="px-2 py-0.5 text-xs font-medium rounded-full shrink-0"
                        style={{
                          backgroundColor: `${idol.themeColor}15`,
                          color: idol.themeColor,
                        }}
                      >
                        {idol.group}
                      </span>
                    </div>
                    
                    <p className="text-sm text-slate-500 line-clamp-2 mb-2">
                      {idol.tagline}
                    </p>
                    
                    {/* CTA hint */}
                    <div className="flex items-center gap-1 text-xs text-slate-400 group-hover:text-blue-500 transition-colors">
                      <span>대화하기</span>
                      <svg className="w-3 h-3 transform group-hover:translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* Footer info */}
        <div 
          className="mt-8 text-center animate-fade-in-up"
          style={{ animationDelay: '0.4s' }}
        >
          <p className="text-xs text-slate-400 leading-relaxed">
            AI가 생성한 응답입니다. 실제 정치인의 발언이 아닙니다.
            <br />
            <span className="text-slate-300">정책 정보는 공식 자료를 참고해 주세요.</span>
          </p>
        </div>
      </div>
    </div>
  );
}
