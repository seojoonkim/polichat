import { useNavigate } from 'react-router';
import { type DebateType } from './DebateView';

interface DebateBannerProps {
  debateType?: DebateType;
}

export default function DebateBanner({ debateType = 'seoul' }: DebateBannerProps) {
  const navigate = useNavigate();

  // 각 debateType별 설정
  const config = {
    seoul: {
      candidateA: { name: '오세훈', party: '국민의힘', id: 'ohsehoon', color: '#E61E2B' },
      candidateB: { name: '정원오', party: '더불어민주당', id: 'jungwono', color: '#004EA2' },
      tagline: '"서울의 미래를 건다"',
    },
    national: {
      candidateA: { name: '정청래', party: '더불어민주당', id: 'jungcr', color: '#004EA2' },
      candidateB: { name: '장동혁', party: '국민의힘', id: 'jangdh', color: '#C9151E' },
      tagline: '"국회 격돌"',
    },
  };

  const bannerConfig = config[debateType];

  const navigationUrl = debateType === 'national' ? '/debate?type=national' : '/debate';

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer mb-5 group"
      style={{
        background: debateType === 'national'
          ? 'linear-gradient(120deg, #060b1a 0%, #1a1020 40%, #1a0608 100%)'
          : 'linear-gradient(120deg, #2a0408 0%, #1a1020 40%, #06112a 100%)',
        minHeight: '150px',
      }}
      onClick={() => navigate(navigationUrl)}
    >
      {/* Subtle noise/depth layer */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: debateType === 'national'
            ? `
              radial-gradient(ellipse 90% 130% at 10% 50%, rgba(0,78,162,0.55) 0%, transparent 55%),
              radial-gradient(ellipse 90% 130% at 90% 50%, rgba(201,21,30,0.55) 0%, transparent 55%)
            `
            : `
              radial-gradient(ellipse 90% 130% at 10% 50%, rgba(201,21,30,0.55) 0%, transparent 55%),
              radial-gradient(ellipse 90% 130% at 90% 50%, rgba(0,78,162,0.55) 0%, transparent 55%)
            `,
        }}
      />

      {/* Fine grid texture */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      <div className="relative z-10 flex items-center justify-between px-5 py-4">
        {/* 후보A */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="w-[90px] h-[90px] rounded-full overflow-hidden transition-transform duration-300 group-hover:scale-105"
            style={{
              boxShadow: `0 0 0 2.5px ${bannerConfig.candidateA.color}CC, 0 4px 20px ${bannerConfig.candidateA.color}80`,
            }}
          >
            <img src={`/politicians/${bannerConfig.candidateA.id}/profile.jpg`} alt={bannerConfig.candidateA.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <span className="text-white text-[15px] font-bold tracking-tight">{bannerConfig.candidateA.name}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(255,255,255,0.92)', color: bannerConfig.candidateA.color, border: `1px solid ${bannerConfig.candidateA.color}80` }}>
            {bannerConfig.candidateA.party}
          </span>
        </div>

        {/* Center: VS + CTA */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="text-[32px] font-black leading-none tracking-tighter"
            style={{
              background: 'linear-gradient(180deg, #FFE566 0%, #FFB800 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              filter: 'drop-shadow(0 2px 8px rgba(255,200,0,0.4))',
            }}
          >
            VS
          </div>
          <div className="text-white/60 text-[10px] font-bold tracking-[0.12em] uppercase">AI 토론배틀</div>
          <div
            className="mt-1 px-5 py-1.5 rounded-full text-[12px] font-bold transition-all duration-200 group-hover:scale-105 flex items-center gap-1.5"
            style={{
              background: 'rgba(255,215,0,0.15)',
              border: '1px solid rgba(255,215,0,0.5)',
              color: '#FFD700',
            }}
          >
            토론 시작
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>

        {/* 후보B */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="w-[90px] h-[90px] rounded-full overflow-hidden transition-transform duration-300 group-hover:scale-105"
            style={{
              boxShadow: `0 0 0 2.5px ${bannerConfig.candidateB.color}CC, 0 4px 20px ${bannerConfig.candidateB.color}80`,
            }}
          >
            <img src={`/politicians/${bannerConfig.candidateB.id}/profile.jpg`} alt={bannerConfig.candidateB.name} className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          </div>
          <span className="text-white text-[15px] font-bold tracking-tight">{bannerConfig.candidateB.name}</span>
          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold" style={{ background: 'rgba(255,255,255,0.92)', color: bannerConfig.candidateB.color, border: `1px solid ${bannerConfig.candidateB.color}80` }}>
            {bannerConfig.candidateB.party}
          </span>
        </div>
      </div>

      {/* Bottom label */}
      <div className="relative z-10 text-center pb-3">
        <p className="text-white/35 text-[11px] tracking-wider">{bannerConfig.tagline}</p>
      </div>
    </div>
  );
}
