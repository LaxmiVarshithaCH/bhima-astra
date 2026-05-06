import React, { useEffect } from 'react';

const PRIMARY = '#6C5DD3';
const YELLOW = '#F5A623';
const BODY = '#E8941A';
const DARK = '#2D2006';

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=DM+Sans:wght@400;500;600&display=swap');

  @keyframes moveScooter {
    0%   { transform: translateX(-220px); }
    100% { transform: translateX(calc(100vw + 220px)); }
  }
  @keyframes spinWheel {
    from { transform: rotate(0deg); }
    to   { transform: rotate(360deg); }
  }
  @keyframes dotBounce {
    0%, 80%, 100% { transform: translateY(0); opacity: 0.3; }
    40%           { transform: translateY(-6px); opacity: 1; }
  }

  @keyframes smoke1 {
    0%   { transform: translate(0px, 0px) scale(0.6); opacity: 0.55; }
    100% { transform: translate(-60px, -18px) scale(1.8); opacity: 0; }
  }
  @keyframes smoke2 {
    0%   { transform: translate(0px, 0px) scale(0.5); opacity: 0.45; }
    100% { transform: translate(-80px, -10px) scale(2.1); opacity: 0; }
  }
  @keyframes smoke3 {
    0%   { transform: translate(0px, 0px) scale(0.7); opacity: 0.35; }
    100% { transform: translate(-50px, -22px) scale(1.6); opacity: 0; }
  }
  @keyframes smoke4 {
    0%   { transform: translate(0px, 0px) scale(0.4); opacity: 0.5; }
    100% { transform: translate(-70px, -6px) scale(1.9); opacity: 0; }
  }

  .scooter-wrap {
    animation: moveScooter 1.5s linear 1 forwards;
    will-change: transform;
  }
  .wheel-spin {
    animation: spinWheel 0.7s linear infinite;
    transform-box: fill-box;
    transform-origin: center;
  }
  .dot1 { animation: dotBounce 1.2s 0.0s  ease-in-out infinite; }
  .dot2 { animation: dotBounce 1.2s 0.18s ease-in-out infinite; }
  .dot3 { animation: dotBounce 1.2s 0.36s ease-in-out infinite; }

  .smoke-puff {
    position: absolute;
    border-radius: 50%;
    background: rgba(156, 163, 175, 0.4);
    filter: blur(5px);
    will-change: transform, opacity;
    pointer-events: none;
  }
  .s1 { width:16px; height:16px; bottom:32px; left:-8px;  animation: smoke1 1.1s 0.0s  ease-out infinite; }
  .s2 { width:14px; height:14px; bottom:30px; left:-12px; animation: smoke2 1.1s 0.28s ease-out infinite; }
  .s3 { width:18px; height:18px; bottom:34px; left:-5px;  animation: smoke3 1.1s 0.55s ease-out infinite; }
  .s4 { width:12px; height:12px; bottom:28px; left:-14px; animation: smoke4 1.1s 0.82s ease-out infinite; }
`;

function Wheel({ cx, cy }: { cx: number; cy: number }) {
  const spokes = [0, 30, 60, 90, 120, 150];
  return (
    <g className="wheel-spin">
      <circle cx={cx} cy={cy} r="20" fill={DARK} />
      <circle cx={cx} cy={cy} r="15" fill="#3a3a3a" />
      <circle cx={cx} cy={cy} r="5" fill="#999" />
      <circle cx={cx} cy={cy} r="2.5" fill={DARK} />
      {spokes.map((angle) => {
        const rad = (angle * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);
        return (
          <React.Fragment key={angle}>
            <line
              x1={cx + cos * 5}
              y1={cy + sin * 5}
              x2={cx + cos * 15}
              y2={cy + sin * 15}
              stroke="#bbb"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
            <line
              x1={cx - cos * 5}
              y1={cy - sin * 5}
              x2={cx - cos * 15}
              y2={cy - sin * 15}
              stroke="#bbb"
              strokeWidth="1.4"
              strokeLinecap="round"
            />
          </React.Fragment>
        );
      })}
    </g>
  );
}

function ScooterSVG() {
  return (
    <svg width="170" height="105" viewBox="0 0 170 105" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Rear mudguard */}
      <path d="M18 72 Q20 56 32 52 L42 52 Q36 56 32 72 Z" fill={BODY} />
      {/* Main body */}
      <path d="M38 74 Q40 54 60 48 L90 44 Q108 42 120 46 L136 58 L136 74 Z" fill={YELLOW} />
      {/* Floorboard */}
      <rect x="38" y="73" width="98" height="7" rx="2" fill={BODY} />
      {/* Front fairing */}
      <path d="M116 46 Q132 46 140 58 L136 58 Q128 48 116 48 Z" fill={BODY} />
      {/* Body highlight */}
      <path d="M62 48 Q90 44 110 46" stroke="rgba(255,255,255,0.45)" strokeWidth="2.5" strokeLinecap="round" fill="none" />
      {/* Front fork */}
      <line x1="122" y1="48" x2="136" y2="58" stroke={DARK} strokeWidth="3.5" strokeLinecap="round" />
      {/* Headlight */}
      <ellipse cx="141" cy="52" rx="6" ry="5" fill="#FFF9C4" stroke={BODY} strokeWidth="1.2" />
      <ellipse cx="141" cy="52" rx="3.5" ry="3" fill="#FFFDE7" />
      {/* Taillight */}
      <rect x="18" y="54" width="8" height="5" rx="2" fill="#FF4444" opacity="0.85" />
      {/* Delivery box */}
      <rect x="8" y="34" width="34" height="26" rx="3" fill="#8B6914" stroke={DARK} strokeWidth="1.5" />
      <rect x="8" y="34" width="34" height="8" rx="3" fill="#A07820" />
      <line x1="25" y1="34" x2="25" y2="60" stroke={DARK} strokeWidth="1" opacity="0.4" />
      <line x1="8" y1="48" x2="42" y2="48" stroke={DARK} strokeWidth="1" opacity="0.4" />
      <path d="M19 34 Q25 27 31 34" stroke={DARK} strokeWidth="2" fill="none" strokeLinecap="round" />
      {/* Seat */}
      <path d="M60 44 Q76 40 92 44 L90 50 Q74 46 62 50 Z" fill="#1a1a1a" />
      {/* Handlebar */}
      <line x1="118" y1="36" x2="124" y2="44" stroke={DARK} strokeWidth="3" strokeLinecap="round" />
      <line x1="113" y1="30" x2="113" y2="38" stroke={DARK} strokeWidth="2.5" strokeLinecap="round" />
      <line x1="108" y1="30" x2="118" y2="30" stroke={DARK} strokeWidth="4" strokeLinecap="round" />
      {/* Rider: legs */}
      <path d="M76 50 Q78 62 74 70" stroke="#5C3200" strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M74 70 Q68 76 60 76" stroke="#5C3200" strokeWidth="8" strokeLinecap="round" fill="none" />
      {/* Shoes */}
      <ellipse cx="57" cy="76" rx="9" ry="4.5" fill="#1a1a1a" />
      {/* Torso */}
      <path d="M72 26 Q90 22 100 32 L96 50 Q84 46 74 48 Z" fill={YELLOW} />
      <path d="M88 24 Q96 28 98 38 L96 42 Q92 32 88 28 Z" fill={BODY} opacity="0.45" />
      {/* Arm */}
      <path d="M94 32 Q106 30 114 32" stroke={YELLOW} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M114 32 L114 36" stroke="#5C3200" strokeWidth="5" strokeLinecap="round" />
      {/* Helmet */}
      <ellipse cx="78" cy="16" rx="17" ry="15" fill={YELLOW} />
      <path d="M63 18 Q78 26 93 18" stroke={BODY} strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M65 16 Q72 22 90 18 L90 13 Q72 17 65 11 Z" fill="rgba(0,0,0,0.5)" />
      <ellipse cx="72" cy="9" rx="5.5" ry="3" fill="rgba(255,255,255,0.32)" transform="rotate(-20 72 9)" />
      {/* Wheels */}
      <Wheel cx={30} cy={78} />
      <Wheel cx={136} cy={78} />
    </svg>
  );
}

function SmokeEffect() {
  return (
    <div style={{ position: 'absolute', bottom: 0, left: 22, width: 0, height: 0 }}>
      <div className="smoke-puff s1" />
      <div className="smoke-puff s2" />
      <div className="smoke-puff s3" />
      <div className="smoke-puff s4" />
    </div>
  );
}

export type LoadingScreenProps = {
  onFinish?: () => void;
};

export default function LoadingScreen({ onFinish }: LoadingScreenProps) {
  useEffect(() => {
    // Failsafe in case animation event is blocked
    const timer = setTimeout(() => {
      onFinish?.();
    }, 1200);
    return () => clearTimeout(timer);
  }, [onFinish]);

  return (
    <>
      <style>{styles}</style>

      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: '#f9fafb',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'DM Sans', sans-serif",
          overflow: 'hidden',
          zIndex: 99999, // Ensure it covers everything
        }}
      >
        {/* Animation lane — scooter runs once left → right */}
        <div style={{ position: 'relative', width: '100%', height: 120, overflow: 'hidden' }}>
          <div
            className="scooter-wrap"
            style={{ position: 'absolute', bottom: 10, left: 0, zIndex: 2 }}
            onAnimationEnd={() => onFinish?.()}
          >
            <SmokeEffect />
            <ScooterSVG />
          </div>
        </div>

        {/* Loading text + bouncing dots */}
        <div
          style={{
            marginTop: 28,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <p
            style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '0.9rem',
              fontWeight: 500,
              color: '#111827',
              margin: 0,
              letterSpacing: '0.01em',
            }}
          >
            Loading
          </p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {['dot1', 'dot2', 'dot3'].map((cls) => (
              <div
                key={cls}
                className={cls}
                style={{ width: 7, height: 7, borderRadius: '50%', background: PRIMARY }}
              />
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
