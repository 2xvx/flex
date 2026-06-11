import { useEffect, useRef, useState } from 'react';

interface XPLevelUpProps {
  level: number;
  totalXP: number;
  onClose: () => void;
}

// ── Confetti particle ─────────────────────────────────────────────────────────
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rotation: number;
  rotSpeed: number;
  color: string;
  size: number;
  opacity: number;
}

const COLORS = ['#c9a96e', '#e8c98a', '#fff7e6', '#f5d78e', '#ffffff', '#d4a843'];

function createParticles(count: number): Particle[] {
  return Array.from({ length: count }, () => ({
    x: Math.random() * window.innerWidth,
    y: -20 - Math.random() * 60,
    vx: (Math.random() - 0.5) * 4,
    vy: 2 + Math.random() * 4,
    rotation: Math.random() * 360,
    rotSpeed: (Math.random() - 0.5) * 8,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size: 6 + Math.random() * 8,
    opacity: 1,
  }));
}

export default function XPLevelUp({ level, totalXP, onClose }: XPLevelUpProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const rafRef = useRef<number>(0);
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);

  // Entrance animation
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 30);
    return () => clearTimeout(t);
  }, []);

  // Confetti animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    // Spawn burst of 120 particles
    particlesRef.current = createParticles(120);

    let frame = 0;
    function tick() {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Spawn a few more for first 60 frames
      if (frame < 60 && frame % 4 === 0) {
        particlesRef.current.push(...createParticles(6));
      }
      frame++;

      particlesRef.current = particlesRef.current.filter(p => p.opacity > 0.01);

      for (const p of particlesRef.current) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.12; // gravity
        p.vx *= 0.99;
        p.rotation += p.rotSpeed;
        if (p.y > canvas.height * 0.6) p.opacity -= 0.025;

        ctx.save();
        ctx.globalAlpha = p.opacity;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        ctx.restore();
      }

      if (particlesRef.current.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      }
    }
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  function handleClose() {
    setClosing(true);
    setTimeout(onClose, 320);
  }

  // Auto-close after 6 seconds
  useEffect(() => {
    const t = setTimeout(handleClose, 6000);
    return () => clearTimeout(t);
  }, []);

  const xpForLevel = (level - 1) * 1000;
  const pct = Math.round(((totalXP - xpForLevel) / 1000) * 100);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: closing
          ? 'rgba(8,6,8,0)'
          : visible
          ? 'rgba(8,6,8,0.82)'
          : 'rgba(8,6,8,0)',
        transition: 'background 0.32s ease',
        backdropFilter: visible && !closing ? 'blur(6px)' : 'none',
      }}
      onClick={handleClose}
    >
      {/* Confetti canvas */}
      <canvas
        ref={canvasRef}
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* Modal card */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          position: 'relative',
          zIndex: 2,
          background: 'linear-gradient(160deg, #1a1408 0%, #0d0b08 50%, #0a0807 100%)',
          border: '1.5px solid rgba(201,169,110,0.45)',
          borderRadius: 24,
          padding: '44px 48px 36px',
          minWidth: 320,
          maxWidth: 400,
          textAlign: 'center',
          boxShadow: '0 0 60px rgba(201,169,110,0.25), 0 0 120px rgba(201,169,110,0.1), 0 24px 64px rgba(0,0,0,0.6)',
          transform: closing ? 'scale(0.88)' : visible ? 'scale(1)' : 'scale(0.72)',
          opacity: closing ? 0 : visible ? 1 : 0,
          transition: 'transform 0.38s cubic-bezier(0.34,1.56,0.64,1), opacity 0.32s ease',
        }}
      >
        {/* Radial gold halo */}
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 24,
          background: 'radial-gradient(ellipse at 50% 30%, rgba(201,169,110,0.14) 0%, transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Crown / badge */}
        <div style={{
          fontSize: 56,
          lineHeight: 1,
          marginBottom: 12,
          filter: 'drop-shadow(0 0 16px rgba(201,169,110,0.7))',
        }}>
          👑
        </div>

        {/* "LEVEL UP" label */}
        <div style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.25em',
          color: '#c9a96e',
          textTransform: 'uppercase',
          marginBottom: 6,
          opacity: 0.85,
        }}>
          Level Up
        </div>

        {/* Level number */}
        <div style={{
          fontSize: 72,
          fontWeight: 900,
          lineHeight: 1,
          background: 'linear-gradient(135deg, #e8c98a 0%, #c9a96e 40%, #f5d78e 70%, #c9a96e 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          marginBottom: 4,
          filter: 'drop-shadow(0 0 24px rgba(201,169,110,0.4))',
        }}>
          {level}
        </div>

        {/* Subtitle */}
        <div style={{
          fontSize: 14,
          color: '#b8a898',
          marginBottom: 28,
          fontWeight: 500,
        }}>
          You reached <span style={{ color: '#e8c98a', fontWeight: 700 }}>Level {level}</span>!
        </div>

        {/* XP bar */}
        <div style={{ marginBottom: 24 }}>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: '#7a6a58',
            marginBottom: 6,
          }}>
            <span style={{ color: '#c9a96e', fontWeight: 600 }}>{totalXP - xpForLevel} / 1000 XP</span>
            <span>{pct}%</span>
          </div>
          <div style={{
            height: 6,
            borderRadius: 999,
            background: 'rgba(201,169,110,0.12)',
            overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              borderRadius: 999,
              width: pct + '%',
              background: 'linear-gradient(90deg, #c9a96e, #e8c98a)',
              boxShadow: '0 0 8px rgba(201,169,110,0.6)',
              transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)',
            }} />
          </div>
        </div>

        {/* Total XP badge */}
        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: 'rgba(201,169,110,0.1)',
          border: '1px solid rgba(201,169,110,0.2)',
          borderRadius: 999,
          padding: '6px 16px',
          fontSize: 13,
          color: '#e8c98a',
          fontWeight: 600,
          marginBottom: 28,
        }}>
          ⚡ {totalXP.toLocaleString()} Total XP
        </div>

        {/* Continue button */}
        <button
          onClick={handleClose}
          style={{
            display: 'block',
            width: '100%',
            padding: '12px 0',
            borderRadius: 10,
            border: 'none',
            cursor: 'pointer',
            background: 'linear-gradient(90deg, #c9a96e 0%, #e8c98a 50%, #c9a96e 100%)',
            color: '#080608',
            fontWeight: 800,
            fontSize: 14,
            letterSpacing: '0.06em',
            boxShadow: '0 0 20px rgba(201,169,110,0.4)',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.88')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          KEEP GOING
        </button>
      </div>
    </div>
  );
}
