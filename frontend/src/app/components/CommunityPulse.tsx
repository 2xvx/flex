// CommunityPulse.tsx — Live workout counter + scrolling activity ticker
// Sits just below the Feed's filter bar; refreshes every 30 s automatically.

import { useState, useEffect, useRef } from 'react';
import { Flame, Radio } from 'lucide-react';
import { API } from '../../config';
import { AnimatedNumber } from './ui/AnimatedNumber';

interface ActivityEvent {
  id: string;
  type: 'pr' | 'workout' | 'stream';
  message: string;
  avatar: string | null;
  ts: string;
}

const TYPE_ICON: Record<string, string> = {
  pr:      '🏆',
  workout: '💪',
  stream:  '🔴',
};

// ── Horizontal auto-scrolling ticker ─────────────────────────────────────────
function ActivityTicker({ events }: { events: ActivityEvent[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const posRef   = useRef(0);
  const rafRef   = useRef(0);
  const speedPx  = 0.45; // px per frame (~27 px/s at 60fps)

  useEffect(() => {
    const track = trackRef.current;
    if (!track || events.length === 0) return;

    const step = () => {
      posRef.current += speedPx;
      const half = track.scrollWidth / 2;
      if (posRef.current >= half) posRef.current = 0;
      track.style.transform = `translateX(-${posRef.current}px)`;
      rafRef.current = requestAnimationFrame(step);
    };

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [events]);

  if (events.length === 0) return null;

  // Duplicate the list so the scroll loops seamlessly
  const doubled = [...events, ...events];

  return (
    <div className="overflow-hidden flex-1 min-w-0">
      <div ref={trackRef} className="flex items-center gap-6 whitespace-nowrap will-change-transform">
        {doubled.map((ev, i) => (
          <span key={`${ev.id}-${i}`} className="flex items-center gap-1.5 text-white/55 text-xs shrink-0">
            <span className="text-[11px]">{TYPE_ICON[ev.type]}</span>
            <span>{ev.message}</span>
            <span className="text-white/20 mx-1">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ── Main CommunityPulse bar ───────────────────────────────────────────────────
export function CommunityPulse() {
  const [count,  setCount]  = useState(0);
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [live,   setLive]   = useState(false);

  const load = async () => {
    try {
      const [statsRes, actRes] = await Promise.all([
        fetch(`${API}/stats/today`),
        fetch(`${API}/activity/recent`),
      ]);
      if (statsRes.ok) {
        const s = await statsRes.json();
        setCount(s.workoutsToday ?? 0);
      }
      if (actRes.ok) {
        const a = await actRes.json();
        setEvents(a.events ?? []);
        setLive((a.events ?? []).some((e: ActivityEvent) => e.type === 'stream'));
      }
    } catch { /* silent — this is a decorative feature */ }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-white/[0.025] border-b border-[rgba(201,169,110,0.08)] overflow-hidden">
      {/* Workout counter */}
      <div className="flex items-center gap-1.5 shrink-0 border-r border-[rgba(201,169,110,0.07)] pr-3">
        <Flame className="w-3.5 h-3.5 text-orange-400 shrink-0" />
        <span className="text-white text-xs font-semibold tabular-nums">
          <AnimatedNumber value={count} duration={1200} />
        </span>
        <span className="text-white/35 text-[11px] hidden sm:inline">workouts today</span>
      </div>

      {/* Live pulse dot if any stream is active */}
      {live && (
        <div className="flex items-center gap-1 shrink-0 border-r border-[rgba(201,169,110,0.07)] pr-3">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          <span className="text-red-400 text-[11px] font-semibold hidden sm:inline">LIVE</span>
        </div>
      )}

      {/* Scrolling activity ticker */}
      <ActivityTicker events={events} />
    </div>
  );
}
