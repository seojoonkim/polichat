interface Props {
  size?: number;
  message?: string;
  dark?: boolean;
}

export default function PolichatLogoSpinner({ size = 72, message = '로딩 중...', dark = false }: Props) {
  const textColor = dark ? 'text-gray-300' : 'text-gray-500';
  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <style>{`
        @keyframes logoFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50%       { transform: translateY(-8px) scale(1.05); }
        }
        @keyframes logoGlow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(124,58,237,0.0); }
          50%       { box-shadow: 0 0 24px 8px rgba(124,58,237,0.28); }
        }
        @keyframes orbitDot {
          from { transform: rotate(0deg) translateX(42px) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(42px) rotate(-360deg); }
        }
        @keyframes orbitDot2 {
          from { transform: rotate(120deg) translateX(42px) rotate(-120deg); }
          to   { transform: rotate(480deg) translateX(42px) rotate(-480deg); }
        }
        @keyframes orbitDot3 {
          from { transform: rotate(240deg) translateX(42px) rotate(-240deg); }
          to   { transform: rotate(600deg) translateX(42px) rotate(-600deg); }
        }
        @keyframes textBlink {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.5; }
        }
      `}</style>

      {/* 메인 로고 (헤더와 동일) */}
      <div className="flex items-center gap-2" style={{ animation: 'logoFloat 2.4s ease-in-out infinite' }}>
        <img src="/logo.svg" alt="Polichat" style={{ width: 36, height: 36 }} />
        <div className="flex items-baseline gap-0.5">
          <span
            className="logo-text-gradient"
            style={{
              fontFamily: "'Rammetto One', sans-serif",
              fontWeight: 400,
              fontSize: '28px',
              letterSpacing: '-0.01em',
              lineHeight: 1,
            }}
          >
            Polichat
          </span>
          <span
            style={{
              fontSize: '16px',
              fontFamily: "'Pretendard Variable', sans-serif",
              fontWeight: 700,
              color: '#7C3AED',
              opacity: 0.85,
            }}
          >
            .kr
          </span>
        </div>
      </div>

      {/* Logo + orbit wrapper */}
      <div className="relative flex items-center justify-center" style={{ width: size + 32, height: size + 32 }}>
        {/* Orbit dots */}
        <span
          className="absolute w-2.5 h-2.5 rounded-full bg-violet-500"
          style={{ top: '50%', left: '50%', marginTop: -5, marginLeft: -5, animation: 'orbitDot 1.6s linear infinite' }}
        />
        <span
          className="absolute w-2 h-2 rounded-full bg-purple-400"
          style={{ top: '50%', left: '50%', marginTop: -4, marginLeft: -4, animation: 'orbitDot2 1.6s linear infinite' }}
        />
        <span
          className="absolute w-1.5 h-1.5 rounded-full bg-violet-300"
          style={{ top: '50%', left: '50%', marginTop: -3, marginLeft: -3, animation: 'orbitDot3 1.6s linear infinite' }}
        />

        {/* Logo image */}
        <img
          src="/logo.svg"
          alt="폴리챗"
          style={{
            width: size,
            height: size,
            animation: 'logoFloat 2.4s ease-in-out infinite, logoGlow 2.4s ease-in-out infinite',
            borderRadius: '50%',
          }}
        />
      </div>

      {/* Message */}
      {message && (
        <p className={`text-sm font-medium ${textColor}`} style={{ animation: 'textBlink 2s ease-in-out infinite' }}>
          {message}
        </p>
      )}
    </div>
  );
}
