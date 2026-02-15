import type { IdolIntimacy } from '@/types/intimacy';
import { getIntimacyTitle, INTIMACY_TITLES, INTIMACY_ICONS } from '@/types/intimacy';
import type { IdolMeta } from '@/types/idol';

interface Props {
  intimacy: IdolIntimacy;
  idol: IdolMeta;
  onClose: () => void;
}

export default function IntimacyModal({
  intimacy,
  idol,
  onClose,
}: Props) {
  const title = getIntimacyTitle(intimacy.level);
  const expPercent = Math.min(intimacy.exp, 99);
  const currentTier = Math.floor(intimacy.level / 10);
  const tierMinLevel = currentTier * 10 + 1;
  const tierMaxLevel = currentTier === 9 ? 99 : (currentTier + 1) * 10;

  // 레벨 시스템을 2열로 변환
  const levelEntries = Object.entries(INTIMACY_TITLES);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in px-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl animate-scale-up overflow-hidden relative"
        style={{ width: '100%', maxWidth: '400px' }}
        onClick={(e) => e.stopPropagation()}
      >
          {/* X 닫기 버튼 (우측 상단) */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 z-10 w-8 h-8 flex items-center justify-center rounded-full bg-black/20 hover:bg-black/30 text-white transition-colors"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>

          {/* 헤더: 중앙 정렬 프로필 + 레벨 정보 */}
          <div
            className="px-6 py-6"
            style={{
              background: `linear-gradient(135deg, ${idol.themeColor}, ${idol.themeColorSecondary})`,
            }}
          >
            <div className="flex flex-col items-center text-center">
              {/* 큰 프로필 사진 (96px) */}
              <div className="w-24 h-24 rounded-full overflow-hidden ring-4 ring-white/30 shadow-lg mb-4">
                {idol.profileImageUrl ? (
                  <img 
                    src={idol.profileImageUrl} 
                    alt={idol.nameKo}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-white/20 flex items-center justify-center text-2xl font-bold text-white">
                    {idol.nameKo.slice(0, 1)}
                  </div>
                )}
              </div>

              {/* 이름 */}
              <div className="text-xl font-bold text-white mb-1">{idol.nameKo}</div>
              
              {/* 레벨 + 칭호 */}
              <div className="text-2xl font-extrabold text-white">Lv.{intimacy.level}</div>
              <div className="text-sm text-white/90 mt-0.5">{title}</div>

              {/* 경험치 바 (일반 프로그레스 바) */}
              <div className="w-full max-w-[280px] mt-4">
                {/* 바 */}
                <div className="h-2.5 bg-white/30 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-white rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${expPercent}%` }}
                  />
                </div>
                
                {/* 경험치 수치 */}
                <div className="flex justify-between items-center mt-1.5 text-xs text-white/80">
                  <span className="font-medium">{intimacy.exp}/100 POLI</span>
                </div>
                
                {/* 레벨 프로그레스 (10등분 점 방식) */}
                <div className="flex items-center justify-center gap-1.5 mt-2">
                  {[...Array(10)].map((_, i) => {
                    const levelInTier = intimacy.level - tierMinLevel + 1;
                    const isFilled = i < levelInTier;
                    return (
                      <div
                        key={i}
                        className={`w-2 h-2 rounded-full transition-all ${
                          isFilled ? 'bg-white shadow-sm' : 'bg-white/30'
                        }`}
                      />
                    );
                  })}
                </div>
                <div className="text-[10px] text-white/60 mt-1">
                  {tierMinLevel}-{tierMaxLevel}
                </div>
              </div>
            </div>
          </div>

          {/* 통계 - 4열 그리드 */}
          <div className="grid grid-cols-4 gap-1 px-4 py-3 bg-gray-50 text-center">
            <MiniStat label="Days" value={`${intimacy.stats.chatDays}`} />
            <MiniStat label="Messages" value={`${intimacy.stats.totalMessages}`} />
            <MiniStat label="Reactions" value={`${intimacy.stats.reactionsReceived}`} />
            <MiniStat label="Streak" value={`${intimacy.stats.consecutiveDays}d`} />
          </div>

          {/* 전체 레벨 시스템 - 2열 그리드 */}
          <div className="px-4 py-3">
            <div className="text-[10px] font-medium text-gray-400 mb-2 uppercase tracking-wide text-center">Level System</div>
            <div className="grid grid-cols-2 gap-1.5">
              {levelEntries.map(([tier, titleName]) => {
                const tierNum = Number(tier);
                const minLevel = tierNum * 10 + 1;
                const maxLevel = tierNum === 9 ? 99 : (tierNum + 1) * 10;
                const isCurrent = tierNum === currentTier;
                const isPast = tierNum < currentTier;
                
                return (
                  <div
                    key={tier}
                    className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-[11px] ${
                      isCurrent 
                        ? 'text-white font-medium shadow-sm' 
                        : isPast
                          ? 'bg-gray-100 text-gray-500'
                          : 'bg-gray-50 text-gray-400'
                    }`}
                    style={isCurrent ? {
                      background: `linear-gradient(90deg, ${idol.themeColor}, ${idol.themeColorSecondary})`,
                    } : undefined}
                  >
                    <span className="truncate flex items-center gap-1.5">
                      <img 
                        src={INTIMACY_ICONS[tierNum]} 
                        alt="" 
                        className={`w-4 h-4 ${isCurrent ? 'brightness-0 invert' : isPast ? 'opacity-60' : 'opacity-40'}`}
                      />
                      {isPast && <span className="text-green-500 -ml-1">✓</span>}
                      {titleName}
                    </span>
                    <span className="opacity-60 ml-1 shrink-0 text-[10px]">
                      {minLevel}-{maxLevel}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 하단 여백 */}
          <div className="h-2" />
        </div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[9px] text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="text-sm font-semibold text-gray-700">{value}</div>
    </div>
  );
}
