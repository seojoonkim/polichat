import { useNavigate } from 'react-router';
import { type DebateType } from './DebateView';

interface DebateBannerProps {
  debateType?: DebateType;
}

export default function DebateBanner({ debateType = 'seoul' }: DebateBannerProps) {
  const navigate = useNavigate();

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

  const c = config[debateType];
  const isNational = debateType === 'national';
  const navigationUrl = isNational ? '/debate?type=national' : '/debate';
  const uid = debateType; // unique prefix for animation names

  return (
    <div
      className="relative rounded-2xl overflow-hidden cursor-pointer mb-5 group"
      style={{
        background: isNational
          ? 'linear-gradient(120deg, #060b1a 0%, #1a1020 40%, #1a0608 100%)'
          : 'linear-gradient(120deg, #2a0408 0%, #1a1020 40%, #06112a 100%)',
        minHeight: '150px',
      }}
      onClick={() => navigate(navigationUrl)}
    >
      {/* ── 애니메이션 CSS ─────────────────────────────────────────── */}
      <style>{`
        @keyframes bgBreath-${uid} {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        @keyframes scanLine-${uid} {
          0%   { transform: translateX(-100%); opacity: 0; }
          10%  { opacity: 1; }
          90%  { opacity: 1; }
          100% { transform: translateX(400%); opacity: 0; }
        }
        @keyframes ringGlowA-${uid} {
          0%, 100% { box-shadow: 0 0 0 2.5px ${c.candidateA.color}CC, 0 4px 20px ${c.candidateA.color}60; }
          50%       { box-shadow: 0 0 0 3px ${c.candidateA.color}FF, 0 4px 30px ${c.candidateA.color}AA, 0 0 20px ${c.candidateA.color}40; }
        }
        @keyframes ringGlowB-${uid} {
          0%, 100% { box-shadow: 0 0 0 2.5px ${c.candidateB.color}CC, 0 4px 20px ${c.candidateB.color}60; }
          50%       { box-shadow: 0 0 0 3px ${c.candidateB.color}FF, 0 4px 30px ${c.candidateB.color}AA, 0 0 20px ${c.candidateB.color}40; }
        }
        @keyframes vsPulse-${uid} {
          0%, 100% { filter: drop-shadow(0 2px 6px rgba(255,200,0,0.4)); transform: scale(1); }
          50%       { filter: drop-shadow(0 2px 18px rgba(255,200,0,0.75)); transform: scale(1.06); }
        }
        @keyframes btnGlow-${uid} {
          0%, 100% { box-shadow: 0 0 0 0 rgba(255,215,0,0); border-color: rgba(255,215,0,0.5); }
          50%       { box-shadow: 0 0 12px 2px rgba(255,215,0,0.2); border-color: rgba(255,215,0,0.85); }
        }
        @keyframes taglinePulse-${uid} {
          0%, 100% { opacity: 1; text-shadow: 0 0 8px rgba(255,255,255,0.15); }
          50%       { opacity: 0.88; text-shadow: 0 0 16px rgba(255,255,255,0.3); }
        }
        @keyframes particleFloat-${uid} {
          0%   { transform: translateY(0) scale(1); opacity: 0.6; }
          100% { transform: translateY(-60px) scale(0.3); opacity: 0; }
        }
      `}</style>

      {/* ── 배경 그라디언트 (숨쉬는 효과) ─────────────────────────── */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: isNational
            ? `radial-gradient(ellipse 90% 130% at 10% 50%, rgba(0,78,162,0.55) 0%, transparent 55%),
               radial-gradient(ellipse 90% 130% at 90% 50%, rgba(201,21,30,0.55) 0%, transparent 55%)`
            : `radial-gradient(ellipse 90% 130% at 10% 50%, rgba(201,21,30,0.55) 0%, transparent 55%),
               radial-gradient(ellipse 90% 130% at 90% 50%, rgba(0,78,162,0.55) 0%, transparent 55%)`,
          animation: `bgBreath-${uid} 4s ease-in-out infinite`,
        }}
      />

      {/* ── 격자 텍스처 ────────────────────────────────────────────── */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />

      {/* ── 스캔라인 (가로로 쓸고 지나가는 빛) ─────────────────────── */}
      <div
        className="absolute inset-y-0 w-1/4 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
          animation: `scanLine-${uid} 5s ease-in-out infinite`,
          animationDelay: debateType === 'national' ? '2.5s' : '0s',
        }}
      />

      {/* ── 떠오르는 파티클 (왼쪽) ──────────────────────────────────── */}
      {[...Array(3)].map((_, idx) => (
        <div
          key={`pl-${idx}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '3px', height: '3px',
            background: c.candidateA.color,
            left: `${8 + idx * 6}%`,
            bottom: `${20 + idx * 12}%`,
            opacity: 0.5,
            animation: `particleFloat-${uid} ${2.5 + idx * 0.8}s ease-out infinite`,
            animationDelay: `${idx * 0.9}s`,
          }}
        />
      ))}

      {/* ── 떠오르는 파티클 (오른쪽) ─────────────────────────────────── */}
      {[...Array(3)].map((_, idx) => (
        <div
          key={`pr-${idx}`}
          className="absolute rounded-full pointer-events-none"
          style={{
            width: '3px', height: '3px',
            background: c.candidateB.color,
            right: `${8 + idx * 6}%`,
            bottom: `${20 + idx * 12}%`,
            opacity: 0.5,
            animation: `particleFloat-${uid} ${2.5 + idx * 0.8}s ease-out infinite`,
            animationDelay: `${0.4 + idx * 0.9}s`,
          }}
        />
      ))}

      {/* ── 상단 태그라인 ─────────────────────────────────────────── */}
      <div className="relative z-10 text-center pt-2 pb-0">
        <p
          className="text-white font-black text-[17px] tracking-tight"
          style={{ animation: `taglinePulse-${uid} 3.5s ease-in-out infinite` }}
        >
          {c.tagline}
        </p>
      </div>

      {/* ── 메인 그리드 ───────────────────────────────────────────── */}
      <div className="relative z-10 grid grid-cols-3 items-center px-4 py-2">

        {/* 후보 A */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="w-[90px] h-[90px] rounded-full overflow-hidden transition-transform duration-300 group-hover:scale-105"
            style={{
              animation: `ringGlowA-${uid} 2.8s ease-in-out infinite`,
            }}
          >
            <img
              src={`/politicians/${c.candidateA.id}/profile.jpg`}
              alt={c.candidateA.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <span className="text-white text-[15px] font-bold tracking-tight">{c.candidateA.name}</span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: 'rgba(255,255,255,0.92)', color: c.candidateA.color, border: `1px solid ${c.candidateA.color}80` }}
          >
            {c.candidateA.party}
          </span>
        </div>

        {/* VS + CTA */}
        <div className="flex flex-col items-center gap-2">
          <div
            className="text-[32px] font-black leading-none tracking-tighter"
            style={{
              background: 'linear-gradient(180deg, #FFE566 0%, #FFB800 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              animation: `vsPulse-${uid} 2.2s ease-in-out infinite`,
              display: 'inline-block',
            }}
          >
            VS
          </div>
          <div className="text-white/60 text-[10px] font-bold tracking-[0.12em] uppercase">AI 토론배틀</div>
          <div
            className="mt-1 px-5 py-1.5 rounded-full text-[12px] font-bold flex items-center gap-1.5 transition-transform duration-200 group-hover:scale-105"
            style={{
              background: 'rgba(255,215,0,0.15)',
              border: '1px solid rgba(255,215,0,0.5)',
              color: '#FFD700',
              animation: `btnGlow-${uid} 2.5s ease-in-out infinite`,
            }}
          >
            토론 시작
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>

        {/* 후보 B */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="w-[90px] h-[90px] rounded-full overflow-hidden transition-transform duration-300 group-hover:scale-105"
            style={{
              animation: `ringGlowB-${uid} 2.8s ease-in-out infinite`,
              animationDelay: '1.4s',
            }}
          >
            <img
              src={`/politicians/${c.candidateB.id}/profile.jpg`}
              alt={c.candidateB.name}
              className="w-full h-full object-cover"
              onError={(e) => { e.currentTarget.style.display = 'none'; }}
            />
          </div>
          <span className="text-white text-[15px] font-bold tracking-tight">{c.candidateB.name}</span>
          <span
            className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
            style={{ background: 'rgba(255,255,255,0.92)', color: c.candidateB.color, border: `1px solid ${c.candidateB.color}80` }}
          >
            {c.candidateB.party}
          </span>
        </div>
      </div>

      <div className="pb-1" />
    </div>
  );
}
