import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

function HexagonIcon({ size = 16 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <path
        d="M8.5 3.5h7l5 8.5-5 8.5h-7L3.5 12l5-8.5z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Nav() {
  const [clock, setClock] = useState('—');

  useEffect(() => {
    const updateClock = () => {
      const t = new Date().toLocaleTimeString('en-IN', {
        timeZone: 'Asia/Kolkata',
        hour12: false
      });
      setClock('IST ' + t);
    };
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.nav
      className="nav"
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="nav-inner">
        <div className="nav-logo">
          <span className="logo-mark">
            <HexagonIcon size={16} />
          </span>
          <div>
            <div className="logo-name">
              BHIMA ASTRA<sup>&reg;</sup>
            </div>
            <div className="logo-tagline">Parametric Intelligence</div>
          </div>
        </div>
        <div className="nav-links">
          {['Oracle', 'Pipeline', 'Behavioral', 'Terminal'].map((label) => (
            <a key={label} href={`#${label.toLowerCase()}`}>{label}</a>
          ))}
        </div>
        <div className="nav-right">
          <div className="sys-clock">{clock}</div>
          <div className="nav-badge">&#x25CF; ACTIVE</div>
        </div>
      </div>
    </motion.nav>
  );
}