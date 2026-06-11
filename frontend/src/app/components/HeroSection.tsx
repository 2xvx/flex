// HeroSection.tsx — Option D: Full Luxury Banner
// Features:
//   • Large name + time-aware greeting
//   • XP level bar (live from backend) with "i" button → XP source drawer
//   • 4 trophy stat cards: streak 🔥, this week 💪, likes ❤️, rank 🥇
//   • Motivational subtitle that changes with activity
//   • Full-width glowing gold "Log Workout" CTA
//   • Ambient gold glow orb (top-right corner)

import { Plus, X } from 'lucide-react';
import { useEffect, useState, useCallback } from 'react';
import { WorkoutPost, User } from '../types';
import { getUserXP } from '../../services/xpService';

interface HeroSectionProps {
  currentUser: User | null;
  posts: WorkoutPost[];
  onNewPost: () => void;
}

// ── XP source data ─────────────────────────────────────────────────────────────
const XP_SOURCES = [
  {
    category: 'Activity',
    items: [
      { label: 'Post a workout',   xp: '+50',  note: 'per post'    },
      { label: 'First post ever',  xp: '+100', note: 'one-time'    },
      { label: 'Log a PR',         xp: '+75',  note: 'per entry'   },
      { label: 'Workout timer',    xp: '+30',  note: 'per session' },
    ],
  },
  {
    category: 'Social',
    items: [
      { label: 'Leave a comment',  xp: '+5',   note: 'per comment' },
      { label: 'Receive a like',   xp: '+10',  note: 'per like'    },
      { label: 'Gain a follower',  xp: '+20',  note: 'per follower'},
      { label: 'Post goes trending',xp: '+50', note: 'per post'    },
    ],
  },
  {
    category: 'Daily',
    items: [
      { label: 'Log in today',     xp: '+10',  note: 'once a day'  },
      { label: 'Complete a task',  xp: '+50',  note: 'per task'    },
      { label: 'Goal milestone',   xp: '+120', note: 'per hit'     },
    ],
  },
  {
    category: 'Milestones',
    items: [
      { label: '7-day streak',     xp: '+200', note: 'one-time'    },
      { label: '3× per week',      xp: '+100', note: 'per week'    },
      { label: 'Complete challenge',xp: '+150',note: 'per challenge'},
      { label: 'Profile complete', xp: '+80',  note: 'one-time'    },
      { label: 'Follow 5 users',   xp: '+50',  note: 'one-time'    },
      { label: 'Reach level 5',    xp: '+500', note: 'one-time'    },
    ],
  },
];

// ── Helpers ────────────────────────────────────────────────────────────────────

const getGreeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

const isThisWeek = (dateStr: string): boolean => {
  const date = new Date(dateStr);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);
  return date >= cutoff;
};

const calcXPLocal = (postCount: number, totalLikes: number) => {
  const xp = postCount * 50 + totalLikes * 10;
  return { totalXP: xp, level: Math.floor(xp / 1000) + 1, xpInLevel: xp % 1000, xpToNext: 1000 };
};

const calcRank = (posts: WorkoutPost[], userId: string | undefined): number => {
  if (!userId) return 0;
  const map = new Map<string, number>();
  posts.forEach(p => {
    if (!p.user?.id) return;
    map.set(p.user.id, (map.get(p.user.id) || 0) + (p.likes || 0));
  });
  const sorted = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const idx = sorted.findIndex(([id]) => id === userId);
  return idx === -1 ? sorted.length + 1 : idx + 1;
};

const calcStreak = (posts: WorkoutPost[], userId: string | undefined): number => {
  if (!userId) return 0;
  const postedDays = new Set(
    posts.filter(p => p.user?.id === userId)
      .map(p => new Date(p.createdAt || p.timestamp || '').toDateString())
  );
  let streak = 0;
  const date = new Date();
  while (postedDays.has(date.toDateString())) {
    streak++;
    date.setDate(date.getDate() - 1);
  }
  return streak;
};

// ── XP Info Drawer (fixed overlay) ────────────────────────────────────────────
function XPInfoDrawer({ open, onClose, level, xpInLevel, xpToNext, totalXP }: {
  open: boolean;
  onClose: () => void;
  level: number;
  xpInLevel: number;
  xpToNext: number;
  totalXP: number;
}) {
  // Trap close on escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const pct = Math.min(100, Math.round((xpInLevel / xpToNext) * 100));

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 9000,
          background: 'rgba(8,6,8,0.65)',
          backdropFilter: 'blur(3px)',
          opacity: open ? 1 : 0,
          pointerEvents: open ? 'auto' : 'none',
          transition: 'opacity 0.28s ease',
        }}
      />

      {/* Drawer panel */}
      <div
        style={{
          position: 'fixed', top: 0, right: 0, bottom: 0, zIndex: 9001,
          width: 280,
          background: 'linear-gradient(160deg, #141008 0%, #0d0b08 50%, #0a0807 100%)',
          borderLeft: '1px solid rgba(201,169,110,0.18)',
          transform: open ? 'translateX(0)' : 'translateX(100%)',
          transition: 'transform 0.32s cubic-bezier(0.32,0,0.12,1)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto',
        }}
      >
        {/* Ambient gold halo top */}
        <div style={{
          position: 'absolute', top: -40, right: -40,
          width: 200, height: 200, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(201,169,110,0.12) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        {/* Header */}
        <div style={{
          padding: '20px 20px 16px',
          borderBottom: '1px solid rgba(201,169,110,0.08)',
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.18em', color: 'rgba(201,169,110,0.55)', textTransform: 'uppercase', marginBottom: 4 }}>
              XP Guide
            </p>
            <p style={{ fontSize: 18, fontWeight: 800, color: '#fff', lineHeight: 1 }}>
              How to earn XP
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', flexShrink: 0, marginTop: 2,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
          >
            <X className="w-3.5 h-3.5 text-white/40" />
          </button>
        </div>

        {/* Level progress summary */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(201,169,110,0.08)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{
                fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99,
                background: 'rgba(201,169,110,0.12)', border: '1px solid rgba(201,169,110,0.25)',
                color: '#c9a96e',
              }}>
                LVL {level}
              </span>
              <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)' }}>
                {xpInLevel} / {xpToNext} XP
              </span>
            </div>
            <span style={{ fontSize: 10, color: 'rgba(201,169,110,0.5)', fontWeight: 600 }}>
              {pct}%
            </span>
          </div>
          {/* XP bar */}
          <div style={{ height: 5, borderRadius: 3, background: 'rgba(201,169,110,0.08)', overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: pct + '%',
              background: 'linear-gradient(90deg, #c9a96e, #e8c98a)',
              borderRadius: 3,
            }} />
          </div>
          <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 6 }}>
            ⚡ {totalXP.toLocaleString()} total XP · {xpToNext - xpInLevel} to level {level + 1}
          </p>
        </div>

        {/* XP sources by category */}
        <div style={{ padding: '12px 20px 32px', flex: 1 }}>
          {XP_SOURCES.map((section, si) => (
            <div key={si} style={{ marginBottom: 20 }}>
              {/* Category label */}
              <p style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.2em', textTransform: 'uppercase',
                color: 'rgba(201,169,110,0.45)', marginBottom: 8,
              }}>
                {section.category}
              </p>

              {section.items.map((item, ii) => (
                <div
                  key={ii}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '8px 0',
                    borderBottom: ii < section.items.length - 1
                      ? '1px solid rgba(201,169,110,0.06)'
                      : 'none',
                  }}
                >
                  <div>
                    <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
                      {item.label}
                    </p>
                    <p style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 1 }}>
                      {item.note}
                    </p>
                  </div>
                  <span style={{
                    fontSize: 13, fontWeight: 700, color: '#e8c98a',
                    background: 'rgba(201,169,110,0.08)',
                    padding: '3px 9px', borderRadius: 6,
                    border: '1px solid rgba(201,169,110,0.15)',
                    flexShrink: 0, marginLeft: 8,
                  }}>
                    {item.xp}
                  </span>
                </div>
              ))}
            </div>
          ))}

          {/* Footer note */}
          <div style={{
            background: 'rgba(201,169,110,0.06)',
            border: '1px solid rgba(201,169,110,0.12)',
            borderRadius: 10, padding: '10px 12px',
          }}>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
              One-time bonuses are awarded only once per account. Daily XP resets at midnight.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export function HeroSection({ currentUser, posts, onNewPost }: HeroSectionProps) {
  const myPosts    = posts.filter(p => p.user?.id === currentUser?.id);
  const weekPosts  = myPosts.filter(p => isThisWeek(p.createdAt || p.timestamp || ''));
  const totalLikes = myPosts.reduce((sum, p) => sum + (p.likes || 0), 0);
  const streak     = calcStreak(posts, currentUser?.id);
  const rank       = calcRank(posts, currentUser?.id);

  // ── XP state (live from backend) ──────────────────────────────────────────
  const localXP = calcXPLocal(myPosts.length, totalLikes);
  const [xpState, setXPState] = useState(localXP);
  const [showXPInfo, setShowXPInfo] = useState(false);

  const fetchXP = useCallback(async () => {
    if (!currentUser?.id) return;
    try {
      const data = await getUserXP(currentUser.id);
      setXPState({
        totalXP: data.totalXP,
        level: data.level,
        xpInLevel: data.xpInLevel,
        xpToNext: data.xpToNext,
      });
    } catch {
      // Keep local fallback on error
    }
  }, [currentUser?.id]);

  useEffect(() => {
    fetchXP();
  }, [fetchXP]);

  useEffect(() => {
    const handler = () => fetchXP();
    window.addEventListener('xp-updated', handler);
    return () => window.removeEventListener('xp-updated', handler);
  }, [fetchXP]);

  const { level, xpInLevel, xpToNext, totalXP } = xpState;
  const xpPct = Math.min(100, Math.round((xpInLevel / xpToNext) * 100));

  const fullName  = currentUser?.name || 'Athlete';

  const subtitle =
    weekPosts.length === 0 ? "Ready to crush your first session this week?"
    : weekPosts.length === 1 ? "1 session logged — the momentum has started 🚀"
    : weekPosts.length < 4  ? `${weekPosts.length} sessions this week — you're building something real 💪`
    : `${weekPosts.length} sessions this week — absolute beast mode 🔥`;

  const rankLabel = rank === 0 ? '–' : `#${rank}`;
  const rankColor = rank === 1 ? '#facc15' : rank === 2 ? '#94a3b8' : rank === 3 ? '#cd7c2f' : '#c9a96e';

  const trophies = [
    { icon: '🔥', value: streak,          label: 'streak',    color: '#f97316' },
    { icon: '💪', value: weekPosts.length, label: 'this week', color: '#c9a96e' },
    { icon: '❤️', value: totalLikes,       label: 'likes',     color: '#f87171' },
    { icon: '🥇', value: rankLabel,        label: 'rank',      color: rankColor  },
  ];

  return (
    <>
      {/* ── XP Info Drawer ── */}
      <XPInfoDrawer
        open={showXPInfo}
        onClose={() => setShowXPInfo(false)}
        level={level}
        xpInLevel={xpInLevel}
        xpToNext={xpToNext}
        totalXP={totalXP}
      />

      <div
        className="border-b border-[rgba(201,169,110,0.08)] px-6 py-5 relative overflow-hidden"
        style={{ background: '#080608' }}
      >
        {/* ── Ambient glow orb — top-right ── */}
        <div
          aria-hidden
          style={{
            position: 'absolute', top: -60, right: -40,
            width: 220, height: 220, borderRadius: '50%',
            background: 'radial-gradient(circle, rgba(201,169,110,0.1) 0%, transparent 70%)',
            pointerEvents: 'none',
          }}
        />

        {/* ── Greeting label ── */}
        <p className="text-[10px] uppercase tracking-[0.14em] text-[rgba(201,169,110,0.45)] mb-1 font-medium">
          {getGreeting()}
        </p>

        {/* ── Large name + level row ── */}
        <div className="flex items-end justify-between mb-1">
          <h1
            className="text-2xl font-extrabold text-white leading-tight tracking-tight"
            style={{ letterSpacing: '-0.3px' }}
          >
            {fullName}
          </h1>

          {/* Level badge */}
          <span
            className="text-[10px] font-semibold px-3 py-1 rounded-full shrink-0 mb-0.5"
            style={{
              background: 'rgba(201,169,110,0.1)',
              border: '1px solid rgba(201,169,110,0.25)',
              color: '#c9a96e',
            }}
          >
            LVL {level}
          </span>
        </div>

        {/* ── XP bar + info button ── */}
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 rounded-full overflow-hidden" style={{ height: 4, background: 'rgba(201,169,110,0.08)' }}>
            <div style={{
              height: 4, width: xpPct + '%',
              background: 'linear-gradient(90deg, #c9a96e, #e8c98a)',
              borderRadius: 2, transition: 'width 1s cubic-bezier(0.4,0,0.2,1)',
            }} />
          </div>
          <span className="text-[9px] text-white/25 shrink-0 tabular-nums">{xpInLevel} / {xpToNext} XP</span>

          {/* XP info "i" button */}
          <button
            onClick={() => setShowXPInfo(true)}
            aria-label="How to earn XP"
            style={{
              width: 16, height: 16, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'rgba(201,169,110,0.15)',
              border: '1px solid rgba(201,169,110,0.3)',
              color: '#c9a96e',
              fontSize: 9, fontWeight: 800,
              cursor: 'pointer',
              transition: 'background 0.15s, border-color 0.15s',
              fontFamily: 'serif',
              lineHeight: 1,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(201,169,110,0.3)';
              e.currentTarget.style.borderColor = 'rgba(201,169,110,0.6)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(201,169,110,0.15)';
              e.currentTarget.style.borderColor = 'rgba(201,169,110,0.3)';
            }}
          >
            i
          </button>
        </div>

        {/* Subtitle */}
        <p className="text-white/35 text-xs mb-4">{subtitle}</p>

        {/* Trophy cards */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {trophies.map(({ icon, value, label, color }) => (
            <div key={label}
              className="rounded-xl p-2.5 flex flex-col items-center text-center border transition-all hover:scale-[1.03]"
              style={{ background: 'rgba(201,169,110,0.04)', borderColor: 'rgba(201,169,110,0.09)' }}>
              <span className="text-base mb-1">{icon}</span>
              <span className="text-lg font-bold leading-tight tabular-nums" style={{ color }}>{value}</span>
              <span className="text-white/25 text-[9px] mt-0.5 capitalize">{label}</span>
            </div>
          ))}
        </div>

        {/* CTA */}
        <button
          onClick={onNewPost}
          className="w-full flex items-center justify-center gap-2 rounded-xl font-bold text-sm active:scale-[0.98] transition-all"
          style={{
            background: '#c9a96e', color: '#080608', padding: '12px 0',
            letterSpacing: '0.02em',
            boxShadow: '0 0 28px rgba(201,169,110,0.25), 0 4px 12px rgba(201,169,110,0.15)',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = '#d4b07a'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = '#c9a96e'; }}
        >
          <Plus className="w-4 h-4" />
          Log Workout
        </button>
      </div>
    </>
  );
}
