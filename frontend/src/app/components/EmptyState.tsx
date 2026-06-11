// EmptyState.tsx
// Reusable illustrated empty state.  Drop it anywhere a list/feed is empty.
//
// Usage:
//   <EmptyState icon="dumbbell" title="No workouts yet" sub="Log your first session!" />
//   <EmptyState icon="message"  title="No messages"     action={{ label: "Start a chat", onClick: fn }} />

import { ReactNode } from 'react';
import {
  Dumbbell, MessageSquare, Search, Film, TrendingUp, Trophy,
  Users, Bell, Compass, Inbox, Camera, Zap, Bookmark, Calendar,
} from 'lucide-react';

type IconName =
  | 'dumbbell' | 'message' | 'search' | 'reels' | 'progress'
  | 'trophy'   | 'users'   | 'bell'   | 'explore' | 'inbox'
  | 'camera'   | 'zap'     | 'bookmark' | 'calendar';

const ICON_MAP: Record<IconName, ReactNode> = {
  dumbbell:  <Dumbbell       className="w-8 h-8" />,
  message:   <MessageSquare  className="w-8 h-8" />,
  search:    <Search         className="w-8 h-8" />,
  reels:     <Film           className="w-8 h-8" />,
  progress:  <TrendingUp     className="w-8 h-8" />,
  trophy:    <Trophy         className="w-8 h-8" />,
  users:     <Users          className="w-8 h-8" />,
  bell:      <Bell           className="w-8 h-8" />,
  explore:   <Compass        className="w-8 h-8" />,
  inbox:     <Inbox          className="w-8 h-8" />,
  camera:    <Camera         className="w-8 h-8" />,
  zap:       <Zap            className="w-8 h-8" />,
  bookmark:  <Bookmark       className="w-8 h-8" />,
  calendar:  <Calendar       className="w-8 h-8" />,
};

// Subtle decorative SVG blob behind the icon — pure CSS, no external assets
function Blob() {
  return (
    <svg
      viewBox="0 0 120 120"
      className="absolute inset-0 w-full h-full opacity-30"
      aria-hidden
    >
      <defs>
        <radialGradient id="blob-grad" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#c9a96e" stopOpacity="0.4" />
          <stop offset="100%" stopColor="#c9a96e" stopOpacity="0"   />
        </radialGradient>
      </defs>
      <ellipse cx="60" cy="60" rx="56" ry="48" fill="url(#blob-grad)" />
    </svg>
  );
}

interface EmptyStateProps {
  icon?: IconName;
  title: string;
  sub?: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}

export function EmptyState({ icon = 'dumbbell', title, sub, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center text-center py-16 px-6 ${className}`}>
      {/* Icon bubble with blob */}
      <div className="relative w-20 h-20 flex items-center justify-center mb-5">
        <Blob />
        <div className="relative z-10 w-16 h-16 rounded-2xl bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] flex items-center justify-center text-[#c9a96e]">
          {ICON_MAP[icon]}
        </div>
      </div>

      <p className="text-white font-semibold text-base mb-1">{title}</p>
      {sub && <p className="text-white/40 text-sm max-w-xs">{sub}</p>}

      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="mt-5 px-5 py-2 rounded-xl bg-[rgba(201,169,110,0.12)] border border-[#c9a96e]/25 text-[#e8c98a] text-sm font-medium hover:bg-[rgba(201,169,110,0.18)] transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
