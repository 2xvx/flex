// ProfilePage.tsx
//
// Renders any user's profile. Behaviour changes based on who is viewing:
//
//   Own profile (non-trainer)  → Edit bio / fitness info
//   Own profile (trainer)      → Edit bio + set pricing/availability + see bookings
//   Other user's profile       → Follow button
//   Other user who is trainer  → "Book a session" button + full booking flow
//
// Data flow:
//   1. Fetches profile + posts via GET /api/users/:uid/profile
//   2. If trainer on own profile, also fetches bookings
//   3. Booking modal walks through 3 steps: date → time slot → confirm

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  User as UserIcon, MapPin, Target, Dumbbell, Star,
  Clock, Video, Users, ChevronRight, X, Check,
  Calendar, Edit2, Save, Plus, Trash2, BadgeCheck, Camera, Lock,
  PlayCircle, BarChart2, TrendingUp, Crown, Trophy, Sword, Settings, Building2,
} from 'lucide-react';
import { User, WorkoutPost, TrainerInfo, Booking } from '../types';
import { API } from '../../config';
import {
  getProfile, updateProfile, updateTrainerInfo,
  createBooking, getBookings, updateBookingStatus,
} from '../../services/profileService';
import { followUser, unfollowUser, getFollowingList } from '../../services/followService';
import { compressFile } from '../../utils/imageCompression';
import { authFetch, authHeaders } from '../../utils/authToken';
import { toast } from 'sonner';
import { getUserXP } from '../../services/xpService';
import { BodyStatsTracker } from './BodyStatsTracker';
import { BodyMeasurementsPage } from './BodyMeasurementsPage';
import { TrainerAnalytics } from './TrainerAnalytics';
import { GoalTracker } from './GoalTracker';
import { EmptyState } from './EmptyState';
import { WorkoutCard } from './WorkoutCard';
import { AnimatedNumber } from './ui/AnimatedNumber';
import { ProfileHeaderSkeleton } from './ui/skeleton';


// ── Rank helpers (mirrors sidebar / WeeklyChallengePage) ─────────────────────
const PROFILE_RANK_TIERS = [
  { name: 'Wood',     minXP: 0,    icon: '🪵', color: '#a16207', glow: '#a1620720' },
  { name: 'Stone',    minXP: 200,  icon: '🪨', color: '#9ca3af', glow: '#9ca3af20' },
  { name: 'Iron',     minXP: 500,  icon: '⚙️', color: '#94a3b8', glow: '#94a3b820' },
  { name: 'Bronze',   minXP: 1000, icon: '🥉', color: '#cd7f32', glow: '#cd7f3220' },
  { name: 'Gold',     minXP: 2000, icon: '🥇', color: '#e8c98a', glow: '#e8c98a20' },
  { name: 'Diamond',  minXP: 4000, icon: '💎', color: '#67e8f9', glow: '#67e8f920' },
  { name: 'Obsidian', minXP: 8000, icon: '🖤', color: '#a78bfa', glow: '#a78bfa20' },
];
function getProfileRank(xp: number) {
  let tier = PROFILE_RANK_TIERS[0];
  for (const t of PROFILE_RANK_TIERS) { if (xp >= t.minXP) tier = t; }
  return tier;
}
function readLocalXP(): number {
  try {
    const d = JSON.parse(localStorage.getItem('flex_xp_data') || '{"events":[]}');
    return (d.events || []).reduce((s: number, e: { amount: number }) => s + e.amount, 0);
  } catch { return 0; }
}

// ─── Constants ────────────────────────────────────────────────────────────────

const WEEK_DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SPECIALTIES_OPTIONS = [
  'Strength Training','HIIT','Weight Loss','Muscle Building','Yoga',
  'Cardio','Crossfit','Calisthenics','Powerlifting','Nutrition',
  'Flexibility','Sports Performance',
];

// Generate 1-hour time slots between two "HH:MM" strings
function buildTimeSlots(start: string, end: string): string[] {
  const slots: string[] = [];
  let [h] = start.split(':').map(Number);
  const [eh] = end.split(':').map(Number);
  while (h < eh) {
    slots.push(`${String(h).padStart(2,'0')}:00`);
    h++;
  }
  return slots;
}

// Build a calendar grid for a given month (returns weeks of day objects)
function buildCalendar(year: number, month: number) {
  const first = new Date(year, month, 1);
  const last  = new Date(year, month + 1, 0);
  const start = new Date(first);
  start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); // Mon-aligned
  const weeks: { date: Date; inMonth: boolean }[][] = [];
  let cur = new Date(start);
  while (cur <= last || weeks.length < 6) {
    const week: { date: Date; inMonth: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      week.push({ date: new Date(cur), inMonth: cur.getMonth() === month });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    if (cur > last && weeks.length >= 4) break;
  }
  return weeks;
}

// ISO date string from a Date → 'YYYY-MM-DD'
const toISO = (d: Date) => d.toISOString().split('T')[0];
const today = () => toISO(new Date());

// Day name from ISO date string
const dayName = (iso: string) => {
  const d = new Date(iso + 'T12:00:00');
  return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
};

// ─── Sub-components ───────────────────────────────────────────────────────────

// ── Workout Heatmap ──────────────────────────────────────────────────────────

function calcStreak(activeDates: Set<string>): number {
  let streak = 0;
  const cur = new Date();
  // if no workout today, start counting from yesterday
  if (!activeDates.has(toISO(cur))) cur.setDate(cur.getDate() - 1);
  while (true) {
    const s = toISO(cur);
    if (activeDates.has(s)) { streak++; cur.setDate(cur.getDate() - 1); }
    else break;
  }
  return streak;
}

function WorkoutHeatmap({ posts, uid }: { posts: WorkoutPost[]; uid?: string }) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all');
  const [backendCounts, setBackendCounts] = useState<Record<string, number> | null>(null);

  // Fetch full heatmap from backend (has all-time history)
  useEffect(() => {
    if (!uid) return;
    authFetch(`${API}/users/${uid}/heatmap`)
      .then(r => r.json())
      .then(data => { if (data.counts) setBackendCounts(data.counts); })
      .catch(() => {});
  }, [uid]);

  // Build date → count map — prefer backend data
  const counts = new Map<string, number>();
  if (backendCounts) {
    Object.entries(backendCounts).forEach(([k, v]) => counts.set(k, v as number));
  } else {
    posts.forEach(p => {
      if (!p.createdAt) return;
      const raw = p.createdAt as any;
      const ms = typeof raw === 'number' ? raw : raw?.seconds ? raw.seconds * 1000 : new Date(raw).getTime();
      const d = toISO(new Date(ms));
      counts.set(d, (counts.get(d) || 0) + 1);
    });
  }

  const activeDates = new Set(counts.keys());
  const streak      = calcStreak(activeDates);
  const todayStr    = toISO(new Date());

  // Build grid depending on mode
  const isAll = selectedYear === 'all';

  // For "all time": show 52 weeks rolling back from today
  // For a year: show Jan 1 → Dec 31
  let gridStartDate: Date;
  let gridEndDate: Date;
  let yearStart: string;
  let yearEnd: string;

  if (isAll) {
    gridEndDate   = new Date();
    gridStartDate = new Date(gridEndDate);
    gridStartDate.setDate(gridStartDate.getDate() - 52 * 7);
    const dayOff = (gridStartDate.getDay() + 6) % 7;
    gridStartDate.setDate(gridStartDate.getDate() - dayOff);
    yearStart = toISO(gridStartDate);
    yearEnd   = todayStr;
  } else {
    gridStartDate = new Date(selectedYear, 0, 1);
    const dayOff  = (gridStartDate.getDay() + 6) % 7;
    gridStartDate.setDate(gridStartDate.getDate() - dayOff);
    gridEndDate = new Date(selectedYear, 11, 31);
    yearStart   = `${selectedYear}-01-01`;
    yearEnd     = `${selectedYear}-12-31`;
  }

  const yearActive = [...activeDates].filter(d => d >= yearStart && d <= yearEnd).length;

  const weeks: string[][] = [];
  const cur = new Date(gridStartDate);
  while (cur <= gridEndDate) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) { week.push(toISO(new Date(cur))); cur.setDate(cur.getDate() + 1); }
    weeks.push(week);
  }

  // Month label positions
  const monthLabels: { wi: number; label: string }[] = [];
  weeks.forEach((week, wi) => {
    const d = new Date(week[0] + 'T12:00:00');
    const inRange = isAll
      ? d >= gridStartDate && d <= gridEndDate
      : d.getFullYear() === (selectedYear as number);
    if (d.getDate() <= 7 && inRange) {
      monthLabels.push({ wi, label: d.toLocaleString('default', { month: 'short' }) });
    }
  });

  const cellColor = (n: number) =>
    n === 0 ? 'bg-white/[0.07]' : n === 1 ? 'bg-[#a07840]/80' : n === 2 ? 'bg-[#c9a96e]' : 'bg-[#e8c98a]';

  const DAY_LABELS = ['M', '', 'W', '', 'F', '', 'S'];

  return (
    <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-5">
      {/* Header row */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-white font-medium text-sm">Workout Heatmap</h3>
          <p className="text-white/35 text-xs mt-0.5">
            {yearActive} active day{yearActive !== 1 ? 's' : ''} {isAll ? '· last 52 weeks' : `in ${selectedYear}`}
          </p>
        </div>
        {/* Streak + animated fire */}
        <div className="text-right flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1.5">
            {streak > 0 && (
              <span
                className="text-lg leading-none"
                style={{ display: 'inline-block', animation: 'heatFlicker 1.4s ease-in-out infinite' }}
              >🔥</span>
            )}
            <span className={`font-bold text-2xl leading-none ${streak > 0 ? 'text-orange-400' : 'text-white/20'}`}>
              {streak}
            </span>
          </div>
          <p className="text-white/30 text-[11px]">day streak</p>
        </div>
      </div>

      {/* Year navigation */}
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {/* Prev/next arrows — only usable when on a specific year */}
        <button
          onClick={() => setSelectedYear(y => typeof y === 'number' ? y - 1 : currentYear - 1)}
          disabled={selectedYear === 'all' || (typeof selectedYear === 'number' && selectedYear <= currentYear - 3)}
          className="w-6 h-6 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-[rgba(201,169,110,0.08)] transition-all disabled:opacity-20"
        >‹</button>
        <span className="text-white/50 text-xs font-medium w-10 text-center">
          {selectedYear === 'all' ? '—' : selectedYear}
        </span>
        <button
          onClick={() => setSelectedYear(y => typeof y === 'number' ? Math.min(y + 1, currentYear) : currentYear)}
          disabled={selectedYear === 'all' || selectedYear >= currentYear}
          className="w-6 h-6 rounded-md flex items-center justify-center text-white/40 hover:text-white hover:bg-[rgba(201,169,110,0.08)] transition-all disabled:opacity-20"
        >›</button>

        {/* Quick pills */}
        <div className="flex gap-1 ml-1">
          {/* All-time pill */}
          <button
            onClick={() => setSelectedYear('all')}
            className={`px-2.5 py-0.5 rounded-md text-[10px] font-medium transition-all ${
              selectedYear === 'all'
                ? 'bg-[#c9a96e]/25 text-[#e8c98a] ring-1 ring-[rgba(201,169,110,0.25)]'
                : 'text-white/30 hover:text-white/60 hover:bg-[rgba(201,169,110,0.04)]'
            }`}
          >
            All
          </button>
          {[currentYear, currentYear - 1, currentYear - 2].map(y => (
            <button
              key={y}
              onClick={() => setSelectedYear(y)}
              className={`px-2 py-0.5 rounded-md text-[10px] font-medium transition-all ${
                selectedYear === y
                  ? 'bg-[#c9a96e]/25 text-[#e8c98a] ring-1 ring-[rgba(201,169,110,0.25)]'
                  : 'text-white/25 hover:text-white/50 hover:bg-[rgba(201,169,110,0.04)]'
              }`}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto -mx-1 px-1">
        <div style={{ width: 'max-content' }}>
          {/* Month labels */}
          <div className="flex gap-[3px] mb-1 ml-4">
            {weeks.map((_, wi) => {
              const label = monthLabels.find(m => m.wi === wi);
              return (
                <div key={wi} className="w-[10px] text-[8px] text-white/25 leading-none shrink-0 text-center">
                  {label ? label.label : ''}
                </div>
              );
            })}
          </div>
          <div className="flex gap-[3px]">
            {/* Day-of-week labels */}
            <div className="flex flex-col gap-[3px] mr-1 shrink-0">
              {DAY_LABELS.map((l, i) => (
                <div key={i} className="w-[10px] h-[10px] flex items-center justify-end">
                  <span className="text-white/20 text-[7px] leading-none">{l}</span>
                </div>
              ))}
            </div>
            {/* Weeks */}
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map(date => {
                  const n = counts.get(date) || 0;
                  const isOutOfYear = date < yearStart || date > yearEnd;
                  const isFuture   = date > todayStr;
                  const hide = isFuture || (!isAll && isOutOfYear);
                  return (
                    <div
                      key={date}
                      title={n > 0 ? `${date} · ${n} workout${n > 1 ? 's' : ''}` : date}
                      className={`w-[10px] h-[10px] rounded-[2px] transition-colors ${
                        hide ? 'opacity-0 pointer-events-none' : cellColor(n)
                      }`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-1 mt-3 justify-end">
        <span className="text-white/20 text-[9px]">Less</span>
        {[0, 1, 2, 3].map(n => (
          <div key={n} className={`w-[10px] h-[10px] rounded-[2px] ${cellColor(n)}`} />
        ))}
        <span className="text-white/20 text-[9px]">More</span>
      </div>

      {/* Fire flicker keyframes — injected inline */}
      <style>{`
        @keyframes heatFlicker {
          0%,100% { transform: scale(1) rotate(-3deg); filter: brightness(1); }
          25%      { transform: scale(1.15) rotate(3deg); filter: brightness(1.3); }
          50%      { transform: scale(1.05) rotate(-2deg); filter: brightness(1.1); }
          75%      { transform: scale(1.2) rotate(4deg); filter: brightness(1.4); }
        }
      `}</style>
    </div>
  );
}

// ── Challenge Dialog ──────────────────────────────────────────────────────────

interface ChallengeDialogProps {
  targetUser: { id: string; name: string };
  currentUser: User;
  onClose: () => void;
}

function ChallengeDialog({ targetUser, currentUser, onClose }: ChallengeDialogProps) {
  const [type, setType]       = useState<'workouts' | 'calories' | 'days'>('workouts');
  const [duration, setDuration] = useState('7');
  const [sending, setSending] = useState(false);

  const TYPES = [
    { id: 'workouts' as const, label: '🏋️ Most Workouts',    desc: 'Who logs more sessions in the period' },
    { id: 'calories' as const, label: '🔥 Most Calories',    desc: 'Who burns more total calories' },
    { id: 'days'     as const, label: '📅 Most Active Days', desc: 'Who works out on more distinct days' },
  ];

  const handleSend = async () => {
    setSending(true);
    try {
      await authFetch('${API}/challenges', {
        method: 'POST',
        body: JSON.stringify({
          challengerId:   currentUser.id,
          challengerName: (currentUser as any).displayName || currentUser.name || 'Someone',
          targetId:   targetUser.id,
          targetName: targetUser.name,
          type,
          durationDays: parseInt(duration),
        }),
      });
      toast.success(`Challenge sent to ${targetUser.name}! ⚔️`);
      onClose();
    } catch {
      toast.error('Could not send challenge — please try again');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-[rgba(201,169,110,0.08)]">
          <div>
            <p className="text-white font-semibold flex items-center gap-2">
              <Sword className="w-4 h-4 text-orange-400" /> Challenge
            </p>
            <p className="text-white/40 text-xs mt-0.5">{targetUser.name}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <p className="text-white/40 text-xs mb-2 font-medium">Challenge type</p>
            <div className="space-y-2">
              {TYPES.map(t => (
                <button
                  key={t.id}
                  onClick={() => setType(t.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                    type === t.id ? 'border-orange-500/40 bg-orange-500/8' : 'border-[rgba(201,169,110,0.07)] hover:border-[rgba(201,169,110,0.18)]'
                  }`}
                >
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${type === t.id ? 'text-orange-300' : 'text-white/70'}`}>{t.label}</p>
                    <p className="text-white/30 text-xs">{t.desc}</p>
                  </div>
                  {type === t.id && <div className="w-2 h-2 rounded-full bg-orange-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-white/40 text-xs mb-2 font-medium">Duration</p>
            <div className="flex gap-2">
              {['3', '7', '14', '30'].map(d => (
                <button
                  key={d}
                  onClick={() => setDuration(d)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                    duration === d
                      ? 'bg-orange-500/15 border-orange-400/50 text-orange-300'
                      : 'border-[rgba(201,169,110,0.12)] text-white/50 hover:border-[rgba(201,169,110,0.18)]'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>

          <button
            disabled={sending}
            onClick={handleSend}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-[#c9a96e] to-[#a07840] text-white font-semibold  transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-orange-500/10"
          >
            <Sword className="w-4 h-4" />
            {sending ? 'Sending…' : 'Send Challenge'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Before / After Slider ─────────────────────────────────────────────────────

function BeforeAfterSlider({ before, after }: { before: any; after: any }) {
  const [sliderPos, setSliderPos] = useState(50);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const updatePos = (clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(5, Math.min(95, ((clientX - rect.left) / rect.width) * 100));
    setSliderPos(pct);
  };

  const fmtDate = (ts: any) => {
    if (!ts) return '';
    const ms = typeof ts === 'number' ? ts : ts?.seconds ? ts.seconds * 1000 : new Date(ts).getTime();
    return new Date(ms).toLocaleDateString('default', { month: 'short', year: 'numeric' });
  };

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative rounded-2xl overflow-hidden cursor-col-resize select-none"
        style={{ aspectRatio: '3/4' }}
        onMouseDown={e => { dragging.current = true; updatePos(e.clientX); }}
        onMouseMove={e => { if (dragging.current) updatePos(e.clientX); }}
        onMouseUp={() => { dragging.current = false; }}
        onMouseLeave={() => { dragging.current = false; }}
        onTouchStart={e => { dragging.current = true; updatePos(e.touches[0].clientX); e.preventDefault(); }}
        onTouchMove={e => { if (dragging.current) updatePos(e.touches[0].clientX); e.preventDefault(); }}
        onTouchEnd={() => { dragging.current = false; }}
      >
        {/* After photo (full, behind) */}
        <img src={after.url} alt="After" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        {/* Before photo (clipped to left side) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }}
        >
          <img src={before.url} alt="Before" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
        </div>
        {/* Divider line */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-white/90 shadow-[0_0_12px_rgba(255,255,255,0.7)] pointer-events-none" style={{ left: `${sliderPos}%` }}>
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-9 h-9 rounded-full bg-white shadow-xl flex items-center justify-center pointer-events-auto cursor-col-resize">
            <span className="text-gray-600 text-sm font-bold select-none">↔</span>
          </div>
        </div>
        {/* Labels */}
        <div className="absolute top-3 left-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1 pointer-events-none">
          <p className="text-white text-xs font-semibold">Before</p>
          {before.createdAt && <p className="text-white/60 text-[10px]">{fmtDate(before.createdAt)}</p>}
        </div>
        <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm rounded-lg px-2.5 py-1 pointer-events-none">
          <p className="text-white text-xs font-semibold">After</p>
          {after.createdAt && <p className="text-white/60 text-[10px]">{fmtDate(after.createdAt)}</p>}
        </div>
      </div>
      {(before.note || after.note) && (
        <div className="flex gap-2">
          {before.note && <p className="flex-1 text-white/40 text-xs px-1">{before.note}</p>}
          {after.note  && <p className="flex-1 text-white/40 text-xs px-1 text-right">{after.note}</p>}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Booking['status'] }) {
  const cfg: Record<string, string> = {
    pending:   'bg-yellow-500/15 text-yellow-300',
    confirmed: 'bg-green-500/15  text-green-300',
    cancelled: 'bg-red-500/15    text-red-300',
    completed: 'bg-[#c9a96e]/15 text-[#e8c98a]',
  };
  return (
    <span className={`text-[11px] px-2 py-0.5 rounded font-medium ${cfg[status] ?? ''}`}>
      {status}
    </span>
  );
}

// ─── Booking Modal ────────────────────────────────────────────────────────────

interface BookingModalProps {
  trainer: { id: string; name: string; trainerInfo: TrainerInfo };
  client:  User;
  onClose: () => void;
  onSuccess: (b: Booking) => void;
}

function BookingModal({ trainer, client, onClose, onSuccess }: BookingModalProps) {
  const [step, setStep]                 = useState(1);
  const [calYear, setCalYear]           = useState(new Date().getFullYear());
  const [calMonth, setCalMonth]         = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [sessionType, setSessionType]   = useState<'online'|'in-person'>(
    trainer.trainerInfo.sessionTypes?.[0] ?? 'online'
  );
  const [notes, setNotes]   = useState('');
  const [saving, setSaving] = useState(false);

  const ti       = trainer.trainerInfo;
  const slots    = buildTimeSlots(ti.availability?.startTime ?? '09:00', ti.availability?.endTime ?? '17:00');
  const weeks    = buildCalendar(calYear, calMonth);
  const availDays = ti.availability?.days ?? [];

  const prevMonth = () => {
    if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); }
    else setCalMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); }
    else setCalMonth(m => m + 1);
  };

  const monthName = new Date(calYear, calMonth, 1)
    .toLocaleString('default', { month: 'long', year: 'numeric' });

  const handleConfirm = async () => {
    setSaving(true);
    try {
      const booking = await createBooking({
        trainerId:   trainer.id,
        trainerName: trainer.name,
        clientId:    client.id,
        clientName:  client.name,
        date:        selectedDate,
        timeSlot:    selectedTime,
        sessionType,
        notes,
        price:       ti.hourlyRate ?? 0,
      });
      toast.success('Booking request sent! The trainer will confirm shortly.');
      onSuccess(booking);
      onClose();
    } catch {
      toast.error('Failed to send booking request. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl w-full max-w-md shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[rgba(201,169,110,0.08)]">
          <div>
            <p className="text-white font-semibold text-base">Book a session</p>
            <p className="text-white/40 text-xs mt-0.5">with {trainer.name}</p>
          </div>
          <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-6 pt-4">
          {[1,2,3].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold transition-all ${
                step > s  ? 'bg-[#c9a96e] text-white' :
                step === s? 'bg-[rgba(201,169,110,0.18)] border border-[rgba(201,169,110,0.45)] text-[#e8c98a]' :
                            'bg-[rgba(201,169,110,0.04)] text-white/30'
              }`}>
                {step > s ? <Check className="w-3 h-3" /> : s}
              </div>
              {s < 3 && <div className={`flex-1 h-px w-8 ${step > s ? 'bg-[#c9a96e]' : 'bg-white/10'}`} />}
            </div>
          ))}
          <p className="ml-2 text-white/40 text-xs">
            {step === 1 ? 'Pick a date' : step === 2 ? 'Pick a time' : 'Confirm'}
          </p>
        </div>

        <div className="px-6 py-5">

          {/* ── Step 1: Calendar ── */}
          {step === 1 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <button onClick={prevMonth} className="text-white/40 hover:text-white px-2 py-1 rounded transition-colors">‹</button>
                <p className="text-white text-sm font-medium">{monthName}</p>
                <button onClick={nextMonth} className="text-white/40 hover:text-white px-2 py-1 rounded transition-colors">›</button>
              </div>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-2">
                {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => (
                  <div key={d} className="text-center text-[10px] text-white/30 py-1">{d}</div>
                ))}
              </div>
              {/* Calendar days */}
              {weeks.map((week, wi) => (
                <div key={wi} className="grid grid-cols-7 gap-0.5">
                  {week.map(({ date, inMonth }) => {
                    const iso      = toISO(date);
                    const dName    = dayName(iso);
                    const isPast   = iso < today();
                    const isAvail  = availDays.includes(dName) && inMonth && !isPast;
                    const isSelected = iso === selectedDate;
                    return (
                      <button
                        key={iso}
                        disabled={!isAvail}
                        onClick={() => { setSelectedDate(iso); }}
                        className={`h-9 rounded-lg text-sm font-medium transition-all ${
                          isSelected   ? 'bg-[#c9a96e] text-white' :
                          isAvail      ? 'text-white hover:bg-[rgba(201,169,110,0.12)] hover:text-[#e8c98a]' :
                          !inMonth     ? 'text-white/10 cursor-default' :
                                         'text-white/20 cursor-default'
                        }`}
                      >
                        {date.getDate()}
                      </button>
                    );
                  })}
                </div>
              ))}
              {availDays.length > 0 && (
                <p className="text-white/30 text-xs mt-3">
                  Available: {availDays.join(', ')}
                </p>
              )}
            </div>
          )}

          {/* ── Step 2: Time slot ── */}
          {step === 2 && (
            <div>
              <p className="text-white/60 text-sm mb-3">
                {new Date(selectedDate + 'T12:00:00').toLocaleDateString('default', { weekday:'long', month:'long', day:'numeric' })}
              </p>
              <div className="grid grid-cols-3 gap-2 max-h-52 overflow-y-auto pr-1">
                {slots.map(slot => (
                  <button
                    key={slot}
                    onClick={() => setSelectedTime(slot)}
                    className={`py-2.5 rounded-lg text-sm font-medium border transition-all ${
                      selectedTime === slot
                        ? 'bg-[#c9a96e] border-[rgba(201,169,110,0.45)] text-white'
                        : 'border-[rgba(201,169,110,0.12)] text-white/60 hover:border-[rgba(201,169,110,0.45)] hover:text-white'
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>

              {/* Session type */}
              {ti.sessionTypes && ti.sessionTypes.length > 1 && (
                <div className="mt-4">
                  <p className="text-white/40 text-xs mb-2">Session type</p>
                  <div className="flex gap-2">
                    {ti.sessionTypes.map(t => (
                      <button
                        key={t}
                        onClick={() => setSessionType(t)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all ${
                          sessionType === t
                            ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.45)] text-[#e8c98a]'
                            : 'border-[rgba(201,169,110,0.12)] text-white/50 hover:border-[rgba(201,169,110,0.18)]'
                        }`}
                      >
                        {t === 'online' ? <Video className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 3: Confirm ── */}
          {step === 3 && (
            <div>
              {/* Summary card */}
              <div className="bg-[rgba(201,169,110,0.04)] rounded-xl p-4 mb-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Trainer</span>
                  <span className="text-white font-medium">{trainer.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Date</span>
                  <span className="text-white">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('default',{weekday:'short',month:'short',day:'numeric'})}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Time</span>
                  <span className="text-white">{selectedTime}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-white/50">Format</span>
                  <span className="text-white capitalize">{sessionType}</span>
                </div>
                {/* Payment breakdown */}
                <div className="border-t border-[rgba(201,169,110,0.07)] pt-2 mt-1 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-white/50">Session rate</span>
                    <span className="text-white">{ti.currency ?? '$'}{ti.hourlyRate ?? 0}/hr</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-white/35">Platform fee (5%)</span>
                    <span className="text-white/50">{ti.currency ?? '$'}{((ti.hourlyRate ?? 0) * 0.05).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-semibold border-t border-[rgba(201,169,110,0.07)] pt-1.5 mt-1">
                    <span className="text-white">Total due</span>
                    <span className="text-[#e8c98a]">{ti.currency ?? '$'}{((ti.hourlyRate ?? 0) * 1.05).toFixed(2)}</span>
                  </div>
                </div>
              </div>
              {/* Payment notice */}
              <div className="flex items-start gap-2 bg-amber-500/8 border border-amber-500/20 rounded-xl px-3 py-2.5 mb-3">
                <span className="text-amber-400 text-sm shrink-0">💳</span>
                <p className="text-amber-200/70 text-xs leading-relaxed">
                  Payment is collected directly by the trainer at the time of your session. No charge is made now.
                </p>
              </div>
              {/* Notes */}
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Any notes for the trainer? (optional)"
                rows={3}
                className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 resize-none focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
              />
            </div>
          )}
        </div>

        {/* Footer buttons */}
        <div className="flex gap-3 px-6 pb-5">
          {step > 1 && (
            <button
              onClick={() => setStep(s => s - 1)}
              className="flex-1 py-2.5 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/60 text-sm hover:bg-[rgba(201,169,110,0.04)] transition-all"
            >
              Back
            </button>
          )}
          {step < 3 ? (
            <button
              disabled={(step === 1 && !selectedDate) || (step === 2 && !selectedTime)}
              onClick={() => setStep(s => s + 1)}
              className="flex-1 py-2.5 rounded-xl bg-[#c9a96e] text-white text-sm font-medium hover:bg-[#c9a96e] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              Continue <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              disabled={saving}
              onClick={handleConfirm}
              className="flex-1 py-2.5 rounded-xl bg-[#c9a96e] text-white text-sm font-medium hover:bg-[#c9a96e] transition-all disabled:opacity-60 flex items-center justify-center gap-1.5"
            >
              {saving ? 'Sending…' : <>Confirm booking <Check className="w-4 h-4" /></>}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Edit Trainer Info Panel ───────────────────────────────────────────────────

interface EditTrainerPanelProps {
  uid: string;
  initial: TrainerInfo | undefined;
  onSave: (ti: TrainerInfo) => void;
  onClose: () => void;
}

const DEFAULT_TRAINER_INFO: TrainerInfo = {
  hourlyRate: 60,
  currency: '$',
  experience: 1,
  specialties: [],
  sessionTypes: ['online'],
  availability: { days: [], startTime: '09:00', endTime: '17:00' },
  trainerBio: '',
};

function EditTrainerPanel({ uid, initial, onSave, onClose }: EditTrainerPanelProps) {
  const [form, setForm] = useState<TrainerInfo>({ ...DEFAULT_TRAINER_INFO, ...initial });
  const [saving, setSaving] = useState(false);

  const toggleDay = (day: string) => {
    setForm(f => ({
      ...f,
      availability: {
        ...f.availability,
        days: f.availability.days.includes(day)
          ? f.availability.days.filter(d => d !== day)
          : [...f.availability.days, day],
      },
    }));
  };

  const toggleSpecialty = (s: string) => {
    setForm(f => ({
      ...f,
      specialties: f.specialties.includes(s)
        ? f.specialties.filter(x => x !== s)
        : [...f.specialties, s],
    }));
  };

  const toggleSessionType = (t: 'online' | 'in-person') => {
    setForm(f => ({
      ...f,
      sessionTypes: f.sessionTypes.includes(t)
        ? f.sessionTypes.filter(x => x !== t)
        : [...f.sessionTypes, t],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateTrainerInfo(uid, form);
      toast.success('Trainer profile updated!');
      onSave(form);
      onClose();
    } catch {
      toast.error('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 overflow-y-auto">
      <div className="bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl w-full max-w-lg shadow-2xl my-4">
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[rgba(201,169,110,0.08)]">
          <p className="text-white font-semibold">Edit trainer profile</p>
          <button onClick={onClose} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">

          {/* Trainer bio */}
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Your trainer bio</label>
            <textarea
              value={form.trainerBio}
              onChange={e => setForm(f => ({ ...f, trainerBio: e.target.value }))}
              rows={3}
              placeholder="Tell clients about your training philosophy…"
              className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 resize-none focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
            />
          </div>

          {/* Pricing */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs block mb-1.5">Hourly rate</label>
              <input
                type="number"
                value={form.hourlyRate}
                onChange={e => setForm(f => ({ ...f, hourlyRate: Number(e.target.value) }))}
                className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1.5">Currency</label>
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
              >
                {['$','€','£','AED','SAR'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>

          {/* Experience */}
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Years of experience</label>
            <input
              type="number"
              min={0}
              value={form.experience}
              onChange={e => setForm(f => ({ ...f, experience: Number(e.target.value) }))}
              className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
            />
          </div>

          {/* Session types */}
          <div>
            <label className="text-white/50 text-xs block mb-2">Session types offered</label>
            <div className="flex gap-2">
              {(['online', 'in-person'] as const).map(t => (
                <button
                  key={t}
                  onClick={() => toggleSessionType(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border transition-all ${
                    form.sessionTypes.includes(t)
                      ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.45)] text-[#e8c98a]'
                      : 'border-[rgba(201,169,110,0.12)] text-white/50 hover:border-[rgba(201,169,110,0.18)]'
                  }`}
                >
                  {t === 'online' ? <Video className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Availability — days */}
          <div>
            <label className="text-white/50 text-xs block mb-2">Available days</label>
            <div className="flex flex-wrap gap-1.5">
              {WEEK_DAYS.map(day => (
                <button
                  key={day}
                  onClick={() => toggleDay(day)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    form.availability.days.includes(day)
                      ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.45)] text-[#e8c98a]'
                      : 'border-[rgba(201,169,110,0.12)] text-white/50 hover:border-[rgba(201,169,110,0.18)]'
                  }`}
                >
                  {day.slice(0,3)}
                </button>
              ))}
            </div>
          </div>

          {/* Availability — hours */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/50 text-xs block mb-1.5">Start time</label>
              <input
                type="time"
                value={form.availability.startTime}
                onChange={e => setForm(f => ({ ...f, availability: { ...f.availability, startTime: e.target.value } }))}
                className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)] [color-scheme:dark]"
              />
            </div>
            <div>
              <label className="text-white/50 text-xs block mb-1.5">End time</label>
              <input
                type="time"
                value={form.availability.endTime}
                onChange={e => setForm(f => ({ ...f, availability: { ...f.availability, endTime: e.target.value } }))}
                className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)] [color-scheme:dark]"
              />
            </div>
          </div>

          {/* Specialties */}
          <div>
            <label className="text-white/50 text-xs block mb-2">Specialties</label>
            <div className="flex flex-wrap gap-1.5">
              {SPECIALTIES_OPTIONS.map(s => (
                <button
                  key={s}
                  onClick={() => toggleSpecialty(s)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    form.specialties.includes(s)
                      ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.45)] text-[#e8c98a]'
                      : 'border-[rgba(201,169,110,0.12)] text-white/50 hover:border-[rgba(201,169,110,0.18)]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 pb-5 pt-3 border-t border-[rgba(201,169,110,0.08)] flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/60 text-sm hover:bg-[rgba(201,169,110,0.04)] transition-all">
            Cancel
          </button>
          <button
            disabled={saving}
            onClick={handleSave}
            className="flex-1 py-2.5 rounded-xl bg-[#c9a96e] text-white text-sm font-medium hover:bg-[#c9a96e] transition-all disabled:opacity-60 flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" /> {saving ? 'Saving…' : 'Save profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ProfilePage ─────────────────────────────────────────────────────────

interface ProfilePageProps {
  onNavigate?: (dest: string) => void;
  currentUser: User | null;
  viewingUserId: string;
  onViewProfile?: (uid: string) => void;
  onViewFollowers?: (uid: string, tab: 'followers' | 'following') => void;
  onCurrentUserUpdate?: (updates: Partial<User>) => void;
}

export function ProfilePage({ currentUser, viewingUserId, onViewProfile, onViewFollowers, onNavigate, onCurrentUserUpdate }: ProfilePageProps) {
  const [profile, setProfile]               = useState<any>(null);
  const [bookings, setBookings]             = useState<Booking[]>([]);
  const [clientBookings, setClientBookings] = useState<Booking[]>([]);
  const [loading, setLoading]               = useState(true);
  const [activeTab, setActiveTab]           = useState<'posts'|'bookings'|'mybookings'|'progress'|'stats'|'goals'|'saved'|'analytics'|'clients'>('posts');
  const [savedPosts, setSavedPosts]         = useState<WorkoutPost[]>([]);
  const [progressPhotos, setProgressPhotos] = useState<any[]>([]);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showEditTrainer, setShowEditTrainer]   = useState(false);
  const [showEditProfile, setShowEditProfile]   = useState(false);
  const [editBio, setEditBio]               = useState('');
  const [editUsername, setEditUsername]     = useState('');
  const [editGoal, setEditGoal]             = useState('');
  const [editIsPrivate, setEditIsPrivate]   = useState(false);
  const [isFollowing, setIsFollowing]       = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [postsHidden, setPostsHidden]       = useState(false);
  const [postsViewMode, setPostsViewMode]    = useState<'list'|'grid'>('list');
  const [followLoading, setFollowLoading]   = useState(false);
  const [editLevel, setEditLevel]           = useState('');
  const [editGym, setEditGym]               = useState('');
  const [gymList, setGymList]               = useState<{id:string;name:string}[]>([]);
  const [gymSearch, setGymSearch]           = useState('');
  const [showGymDrop, setShowGymDrop]       = useState(false);
  const [editGender, setEditGender]         = useState('');
  const [editDisplayName, setEditDisplayName] = useState('');
  const [editInstagram, setEditInstagram]   = useState('');
  const [editTwitter, setEditTwitter]       = useState('');
  const [usernameStatus, setUsernameStatus] = useState<'idle'|'checking'|'available'|'taken'|'cooldown'|'same'>('idle');
  const usernameTimerRef                    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savingProfile, setSavingProfile]   = useState(false);
  const [avatarPreview, setAvatarPreview]   = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving]     = useState(false);
  const avatarInputRef                      = useRef<HTMLInputElement>(null);
  const [coverPreview, setCoverPreview]     = useState<string | null>(null);
  const [coverSaving, setCoverSaving]       = useState(false);
  const coverInputRef                       = useRef<HTMLInputElement>(null);
  const [highlights, setHighlights]         = useState<any[]>([]);
  const [showHighlightViewer, setShowHighlightViewer] = useState<{highlight: any, idx: number} | null>(null);
  const [showCreateHighlight, setShowCreateHighlight] = useState(false);
  const [newHLName, setNewHLName]           = useState('');
  const [creatingHL, setCreatingHL]         = useState(false);
  const [profileXP, setProfileXP]           = useState(0);

  // ── New profile features ────────────────────────────────────────────────────
  const [pinnedPRs, setPinnedPRs]           = useState<{exercise: string; value: string; unit: string}[]>([]);
  const [showPinPRs, setShowPinPRs]         = useState(false);
  const [newPR, setNewPR]                   = useState({ exercise: '', value: '', unit: 'kg' });
  const [savingPRs, setSavingPRs]           = useState(false);
  const pendingNewPR                        = newPR.exercise.trim() && newPR.value.trim();
  const [showChallengeDialog, setShowChallengeDialog] = useState(false);
  // before/after comparison: indices into progressPhotos array
  const [compareMode, setCompareMode]       = useState(false);
  const [compareIdxA, setCompareIdxA]       = useState<number | null>(null);
  const [compareIdxB, setCompareIdxB]       = useState<number | null>(null);

  const isOwnProfile = currentUser?.id === viewingUserId;
  const isTrainer    = profile?.accountType === 'trainer';

  const load = useCallback(async () => {
    setLoading(true);
    // Fetch XP from backend for the profile being viewed
    getUserXP(viewingUserId).then(d => {
      setProfileXP(d.totalXP);
      // Broadcast so LeftSidebar syncs immediately when viewing own profile
      window.dispatchEvent(new CustomEvent('xp-updated', { detail: { totalXP: d.totalXP } }));
    }).catch(() => {});
    try {
      const data = await getProfile(viewingUserId, currentUser?.id);
      setProfile(data);
      setEditBio(data.bio ?? '');
      setEditUsername(data.username ?? '');
      setEditGoal(data.fitnessGoal ?? '');
      setEditLevel(data.fitnessLevel ?? '');
      setEditGym(data.gym ?? '');
      setGymSearch(data.gym ?? '');
      // Fetch gym list from DB
      authFetch(`${API}/train-together/gyms`).then(r => r.json()).then(d => setGymList(d.gyms || [])).catch(() => {});
      setEditGender(data.gender ?? '');
      setEditIsPrivate(data.isPrivate ?? false);
      setEditDisplayName(data.displayName ?? data.name ?? '');
      setEditInstagram(data.instagram ?? '');
      setEditTwitter(data.twitter ?? '');
      setUsernameStatus('idle');
      setPostsHidden(data.postsHidden ?? false);
      setHasPendingRequest(data.hasPendingRequest ?? false);
      setPinnedPRs(data.pinnedPRs || []);

      // Trainer on own profile: load their incoming bookings
      if (data.accountType === 'trainer' && currentUser?.id === viewingUserId) {
        try {
          const bkgs = await getBookings(viewingUserId, 'trainer');
          setBookings(bkgs);
        } catch { /* bookings not critical */ }
      }
      // Any user on own profile: load their outgoing client bookings
      if (currentUser?.id === viewingUserId) {
        try {
          const cbkgs = await getBookings(viewingUserId, 'client');
          setClientBookings(cbkgs);
        } catch { /* not critical */ }
      }
      // Load progress photos for own profile
      if (currentUser?.id === viewingUserId) {
        try {
          const token = localStorage.getItem('fitconnect_id_token');
          const pr = await fetch(`${API}/progress/${viewingUserId}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          if (pr.ok) {
            const pd = await pr.json();
            setProgressPhotos(pd.photos || []);
          }
        } catch { /* not critical */ }
      }
      // Check if current user already follows this profile
      if (currentUser?.id && currentUser.id !== viewingUserId) {
        try {
          const following = await getFollowingList(currentUser.id);
          setIsFollowing(following.includes(viewingUserId));
        } catch { /* not critical */ }
      }
    } catch {
      toast.error('Could not load profile.');
    } finally {
      setLoading(false);
    }
  }, [viewingUserId, currentUser?.id]);

  useEffect(() => { load(); }, [load]);

  // Keep rank in sync when XP is earned anywhere in the app
  useEffect(() => {
    if (!isOwnProfile) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.totalXP != null) setProfileXP(detail.totalXP);
    };
    window.addEventListener('xp-updated', handler);
    return () => window.removeEventListener('xp-updated', handler);
  }, [isOwnProfile]);

  // Load story highlights whenever viewingUserId changes
  useEffect(() => {
    if (!viewingUserId) return;
    fetch(`${API}/users/${viewingUserId}/highlights`, {
      headers: authHeaders(),
    })
      .then(r => r.ok ? r.json() : { highlights: [] })
      .then(d => setHighlights(d.highlights || d || []))
      .catch(() => {});
  }, [viewingUserId]);

  const handleFollow = async () => {
    if (!currentUser) return toast.error('Log in to follow users');
    setFollowLoading(true);
    try {
      if (isFollowing) {
        await unfollowUser(viewingUserId);
        setIsFollowing(false);
        setPostsHidden(!!profile?.isPrivate);
        setProfile((p: any) => ({ ...p, followers: Math.max(0, (p.followers ?? 1) - 1) }));
        toast.success('Unfollowed');
      } else if (hasPendingRequest) {
        // Cancel pending request — unfollow endpoint also cleans up pending requests
        await unfollowUser(viewingUserId);
        setHasPendingRequest(false);
        toast.success('Follow request cancelled');
      } else {
        const result = await followUser(viewingUserId);
        if (result.followed) {
          // Public account — instant follow
          setIsFollowing(true);
          setPostsHidden(false);
          setProfile((p: any) => ({ ...p, followers: (p.followers ?? 0) + 1 }));
          toast.success(`Following ${profile?.displayName || 'user'}!`);
        } else if (result.requested) {
          // Private account — request sent
          setHasPendingRequest(true);
          toast.success('Follow request sent!');
        } else if (result.alreadyFollowing) {
          setIsFollowing(true);
        } else if (result.alreadyRequested) {
          setHasPendingRequest(true);
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setFollowLoading(false);
    }
  };

  const handleAvatarFile = async (file: File) => {
    try {
      const compressed = await compressFile(file, 400, 0.85);
      setAvatarPreview(compressed);
    } catch { toast.error('Could not load image'); }
  };

  const handleSaveAvatar = async () => {
    if (!avatarPreview || !currentUser) return;
    setAvatarSaving(true);
    try {
      const res = await authFetch(`${API}/users/${currentUser.id}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({ avatar: avatarPreview }),
      });
      if (!res.ok) throw new Error('Failed');
      // Update the shown avatar immediately
      setProfile((p: any) => ({ ...p, avatar: avatarPreview }));
      onCurrentUserUpdate?.({ avatar: avatarPreview });
      setAvatarPreview(null);
      toast.success('Profile photo updated!');
    } catch {
      toast.error('Could not save photo');
    } finally {
      setAvatarSaving(false);
    }
  };

  const handleCoverFile = async (file: File) => {
    try {
      const compressed = await compressFile(file, 1200, 0.85);
      setCoverPreview(compressed);
      // Auto-save immediately
      if (!currentUser) return;
      setCoverSaving(true);
      const res = await authFetch(`${API}/users/${currentUser.id}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({ coverPhoto: compressed }),
      });
      if (!res.ok) throw new Error('Failed');
      setProfile((p: any) => ({ ...p, coverPhoto: compressed }));
      toast.success('Cover photo updated!');
    } catch { toast.error('Could not save cover'); }
    finally { setCoverSaving(false); }
  };

  const checkUsername = (val: string) => {
    const clean = val.trim().replace(/^@/, '').toLowerCase();
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    if (!clean || clean === profile.username) { setUsernameStatus('same'); return; }
    if (clean.length < 3) { setUsernameStatus('idle'); return; }
    // 7-day cooldown check
    const changedAt = profile.usernameChangedAt;
    if (changedAt) {
      const daysSince = (Date.now() - new Date(changedAt).getTime()) / 86400000;
      if (daysSince < 7) { setUsernameStatus('cooldown'); return; }
    }
    setUsernameStatus('checking');
    usernameTimerRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`${API}/resolve-username/${encodeURIComponent(clean)}`);
        setUsernameStatus(res.ok ? 'taken' : 'available');
      } catch { setUsernameStatus('available'); }
    }, 600);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;
    if (usernameStatus === 'taken') { toast.error('That username is already taken'); return; }
    if (usernameStatus === 'cooldown') { toast.error('You can only change your username once every 7 days'); return; }
    if (usernameStatus === 'checking') { toast.error('Still checking username…'); return; }
    setSavingProfile(true);
    const cleanUsername = editUsername.trim().replace(/^@/, '').toLowerCase();
    if (cleanUsername && cleanUsername !== profile.username && (cleanUsername.length < 3 || cleanUsername.length > 20)) {
      toast.error('Username must be 3–20 characters'); setSavingProfile(false); return;
    }
    const isNewUsername = cleanUsername && cleanUsername !== profile.username;
    try {
      await updateProfile(currentUser.id, {
        bio: editBio, fitnessGoal: editGoal, fitnessLevel: editLevel,
        gym: editGym, isPrivate: editIsPrivate, gender: editGender,
        displayName: editDisplayName.trim() || undefined,
        instagram: editInstagram.trim() || undefined,
        twitter: editTwitter.trim().replace(/^@/, '') || undefined,
        ...(isNewUsername ? { username: cleanUsername, usernameChangedAt: new Date().toISOString() } : {}),
      });
      const updates: any = { bio: editBio, fitnessGoal: editGoal, fitnessLevel: editLevel, gym: editGym, gender: editGender, isPrivate: editIsPrivate, instagram: editInstagram, twitter: editTwitter };
      if (editDisplayName.trim()) updates.displayName = editDisplayName.trim();
      if (isNewUsername) { updates.username = cleanUsername; updates.usernameChangedAt = new Date().toISOString(); }
      setProfile((p: any) => ({ ...p, ...updates }));
      if (isNewUsername) setEditUsername(cleanUsername);
      onCurrentUserUpdate?.({ name: editDisplayName.trim() || currentUser.name, ...(isNewUsername ? { username: cleanUsername } : {}) });
      toast.success('Profile updated!');
      setShowEditProfile(false);
    } catch (err: any) {
      const msg = err?.message || '';
      toast.error(msg.includes('taken') ? 'That username is already taken' : 'Failed to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleStatusChange = async (bookingId: string, status: Booking['status']) => {
    try {
      await updateBookingStatus(bookingId, status);
      setBookings(bks => bks.map(b => b.id === bookingId ? { ...b, status } : b));
      toast.success(`Booking ${status}.`);
    } catch {
      toast.error('Failed to update booking.');
    }
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto py-16 flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-2 border-[rgba(201,169,110,0.25)] border-t-[#c9a96e] animate-spin" />
        <p className="text-white/30 text-sm">Loading profile…</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto">
        <ProfileHeaderSkeleton />
        <div className="px-4 space-y-3 mt-2">
          {[1,2,3].map(i => (
            <div key={i} className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.06)] rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="skeleton w-10 h-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-3 w-32 rounded-lg" />
                  <div className="skeleton h-2.5 w-20 rounded-md" />
                </div>
              </div>
              <div className="skeleton h-3 w-full rounded-lg" />
              <div className="skeleton h-3 w-4/5 rounded-lg" />
              {i === 1 && <div className="skeleton h-40 w-full rounded-xl" />}
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto py-24 text-center">
        <p className="text-white/40">Profile not found.</p>
      </div>
    );
  }

  const initials = (profile.displayName || profile.name || '?')
    .split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0,2);

  const posts: WorkoutPost[] = profile.posts ?? [];

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-5">

      {/* ── Profile Header ── */}
      <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl">
        {/* Cover — rank-aware gradient + real photo */}
        {(() => {
          const xp   = profileXP;
          const rank = getProfileRank(xp);
          const coverSrc = coverPreview || (profile as any).coverPhoto || null;
          return (
            <div className="h-36 relative overflow-hidden rounded-t-2xl">
              {/* Gradient base */}
              <div className="absolute inset-0" style={{
                background: isOwnProfile
                  ? 'linear-gradient(135deg, ' + rank.color + '55 0%, ' + rank.color + '11 60%, #080608 100%)'
                  : 'linear-gradient(135deg, rgba(201,169,110,0.15) 0%, #0d0b08 55%, #080608 100%)',
              }} />
              <div className="absolute inset-0 opacity-30" style={{
                backgroundImage: 'radial-gradient(circle at 75% 35%, ' + (isOwnProfile ? rank.color : '#c9a96e') + '40 0%, transparent 60%)',
              }} />
              {/* Real cover photo */}
              {coverSrc && <img src={coverSrc} alt="Cover" className="absolute inset-0 w-full h-full object-cover" />}
              {coverSrc && <div className="absolute inset-0 bg-black/25" />}
              {/* Cover upload button */}
              {isOwnProfile && (
                <>
                  <button type="button" onClick={() => coverInputRef.current?.click()}
                    disabled={coverSaving}
                    className="absolute top-3 right-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-black/50 backdrop-blur-sm border border-white/10 text-white/60 text-xs hover:text-white hover:bg-black/70 transition-all">
                    <Camera className="w-3 h-3" />
                    <span>{coverSaving ? 'Saving…' : 'Cover'}</span>
                  </button>
                  <input ref={coverInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleCoverFile(f); e.target.value = ''; }} />
                </>
              )}
            </div>
          );
        })()}

        <div className="px-5 pb-5">
          {/* Avatar row — negative margin pulls avatar up over the cover */}
          <div className="flex items-end justify-between -mt-10 mb-3">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-20 h-20 rounded-2xl border-4 border-[#080608] overflow-hidden bg-[#080608]">
                {(avatarPreview || profile.avatar)
                  ? <img src={avatarPreview || profile.avatar} alt={profile.displayName} className="w-full h-full object-cover" />
                  : <div className="w-full h-full bg-[#c9a96e] flex items-center justify-center text-white text-xl font-bold">{initials}</div>
                }
              </div>
              {isOwnProfile && (
                <>
                  <button type="button" onClick={() => avatarInputRef.current?.click()}
                    className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#c9a96e] border-2 border-[#080608] flex items-center justify-center hover:opacity-80 transition-all"
                    title="Change profile photo">
                    <Camera className="w-3.5 h-3.5 text-white" />
                  </button>
                  <input ref={avatarInputRef} type="file" accept="image/*" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) handleAvatarFile(f); e.target.value = ''; }} />
                </>
              )}
            </div>

            {/* Action button(s) */}
            {isOwnProfile ? (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowEditProfile(e => !e)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/70 text-sm hover:bg-[rgba(201,169,110,0.04)] transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                  {showEditProfile ? 'Cancel' : 'Edit profile'}
                </button>
                <button
                  onClick={() => onNavigate?.('settings')}
                  className="flex items-center justify-center w-9 h-9 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/50 hover:bg-[rgba(201,169,110,0.04)] hover:text-white/80 transition-all"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleFollow}
                  disabled={followLoading}
                  className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-60
                    ${isFollowing
                      ? 'border border-[rgba(201,169,110,0.18)] text-white/70 hover:border-red-500/40 hover:text-red-400 hover:bg-red-500/5'
                      : hasPendingRequest
                        ? 'border border-[rgba(201,169,110,0.25)] text-[#e8c98a] bg-[rgba(201,169,110,0.08)] hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                        : 'bg-[#c9a96e] text-white hover:bg-[#c9a96e] shadow-lg shadow-[rgba(201,169,110,0.15)]'}`}
                >
                  {followLoading ? '…' : isFollowing ? 'Following ✓' : hasPendingRequest ? 'Requested ✓' : '+ Follow'}
                </button>
                {currentUser && (
                  <button
                    onClick={() => setShowChallengeDialog(true)}
                    title="Challenge this user"
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-orange-500/30 text-orange-400 text-sm hover:bg-orange-500/10 transition-all"
                  >
                    <Sword className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Save / cancel avatar — shown inline below the header row */}
          {avatarPreview && isOwnProfile && (
            <div className="flex gap-2 mb-3 mt-1">
              <button onClick={handleSaveAvatar} disabled={avatarSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#c9a96e] text-white text-xs font-medium hover:bg-[#c9a96e] disabled:opacity-50 transition-all">
                <Camera className="w-3 h-3" />
                {avatarSaving ? 'Saving…' : 'Save photo'}
              </button>
              <button onClick={() => setAvatarPreview(null)}
                className="px-3 py-1.5 rounded-lg border border-[rgba(201,169,110,0.12)] text-white/50 text-xs hover:text-white/80 transition-all">
                Discard
              </button>
            </div>
          )}

          {/* Name + badge */}
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h1 className="text-white font-semibold text-lg">{profile.displayName || profile.name}</h1>
            {(() => {
              const xp   = profileXP;
              const rank = getProfileRank(xp);
              return (
                <span title={rank.name + ' — ' + xp + ' XP'} style={{ background: rank.color + '18', border: '0.5px solid ' + rank.color + '50' }}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-semibold shrink-0 cursor-default">
                  <span>{rank.icon}</span>
                  <span style={{ color: rank.color }}>{rank.name}</span>
                </span>
              );
            })()}
            {isTrainer && (
              <BadgeCheck className="w-5 h-5 text-[#c9a96e] shrink-0" />
            )}
            {(profile as any).verified && (
              <span title="Verified" className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-500 shrink-0">
                <Check className="w-3 h-3 text-white" strokeWidth={3} />
              </span>
            )}
            {(profile as any).subscription?.active && (profile as any).subscription?.tier === 'pro' && (
              <span className="inline-flex items-center gap-1 bg-amber-500/15 border border-amber-500/25 text-amber-400 text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0">
                <Crown className="w-2.5 h-2.5" /> Pro
              </span>
            )}
            {profile.isPrivate && (
              <Lock className="w-4 h-4 text-white/40 shrink-0" aria-label="Private account" />
            )}
            {profile.accountType && profile.accountType !== 'user' && (
              <span className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                profile.accountType === 'admin'   ? 'bg-[rgba(201,169,110,0.12)] text-[#e8c98a]' :
                profile.accountType === 'trainer' ? 'bg-orange-500/20 text-orange-300' : 'bg-white/10 text-white/50'
              }`}>
                {profile.accountType}
              </span>
            )}
          </div>
          <p className="text-white/40 text-sm mb-2">@{profile.username}</p>

          {/* Edit profile form */}
          {showEditProfile && isOwnProfile && (
            <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.08)] rounded-xl p-4 mb-3 space-y-3">

              {/* Name + Username row */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-white/35 text-[10px] uppercase tracking-wider mb-1.5 block">Display name</label>
                  <input value={editDisplayName} onChange={e => setEditDisplayName(e.target.value)} maxLength={40}
                    placeholder="Your name"
                    className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.4)]" />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-white/35 text-[10px] uppercase tracking-wider">Username</label>
                    {usernameStatus === 'cooldown' && (() => {
                      const changedAt = profile.usernameChangedAt ? new Date(profile.usernameChangedAt) : null;
                      const daysLeft = changedAt ? Math.ceil(7 - (Date.now() - changedAt.getTime()) / 86400000) : 7;
                      return <span className="text-[10px] text-amber-400/80">{daysLeft}d cooldown</span>;
                    })()}
                    {usernameStatus === 'checking' && <span className="text-[10px] text-white/40">checking…</span>}
                    {usernameStatus === 'available' && <span className="text-[10px] text-green-400">✓ available</span>}
                    {usernameStatus === 'taken' && <span className="text-[10px] text-red-400">✗ taken</span>}
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25 text-sm">@</span>
                    <input
                      value={editUsername}
                      onChange={e => {
                        const v = e.target.value.replace(/[^a-zA-Z0-9_]/g, '');
                        setEditUsername(v);
                        checkUsername(v);
                      }}
                      placeholder="handle"
                      maxLength={20}
                      disabled={usernameStatus === 'cooldown'}
                      className={'w-full bg-[rgba(255,255,255,0.04)] border rounded-lg pl-7 pr-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none transition-colors '
                        + (usernameStatus === 'taken' ? 'border-red-500/40' : usernameStatus === 'available' ? 'border-green-500/40' : usernameStatus === 'cooldown' ? 'border-white/05 opacity-40 cursor-not-allowed' : 'border-[rgba(255,255,255,0.08)] focus:border-[rgba(201,169,110,0.4)]')}
                    />
                  </div>
                </div>
              </div>

              {/* Bio */}
              <div>
                <label className="text-white/35 text-[10px] uppercase tracking-wider mb-1.5 block">Bio</label>
                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} rows={2} maxLength={200}
                  placeholder="Tell people about yourself…"
                  className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/20 resize-none focus:outline-none focus:border-[rgba(201,169,110,0.4)]" />
              </div>

              {/* Goal + Level + Gym */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-white/35 text-[10px] uppercase tracking-wider mb-1.5 block">Goal</label>
                  <select value={editGoal} onChange={e => setEditGoal(e.target.value)}
                    className="w-full bg-[#0d0b08] border border-[rgba(255,255,255,0.08)] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[rgba(201,169,110,0.4)]">
                    {['Build Muscle','Lose Weight','Stay Fit','Improve Endurance','Flexibility'].map(g => <option key={g}>{g}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-white/35 text-[10px] uppercase tracking-wider mb-1.5 block">Level</label>
                  <select value={editLevel} onChange={e => setEditLevel(e.target.value)}
                    className="w-full bg-[#0d0b08] border border-[rgba(255,255,255,0.08)] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[rgba(201,169,110,0.4)]">
                    {['Beginner','Intermediate','Advanced','Expert'].map(l => <option key={l}>{l}</option>)}
                  </select>
                </div>
                <div className="relative">
                  <label className="text-white/35 text-[10px] uppercase tracking-wider mb-1.5 block">Gym</label>
                  <input
                    value={gymSearch}
                    onChange={e => { setGymSearch(e.target.value); setEditGym(e.target.value); setShowGymDrop(true); }}
                    onFocus={() => setShowGymDrop(true)}
                    onBlur={() => setTimeout(() => setShowGymDrop(false), 150)}
                    placeholder="Search gym…"
                    className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-2 py-2 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.4)]"
                  />
                  {showGymDrop && gymList.length > 0 && (
                    <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#111011] border border-white/[0.08] rounded-lg overflow-hidden max-h-36 overflow-y-auto">
                      {gymList
                        .filter(g => g.name.toLowerCase().includes(gymSearch.toLowerCase()))
                        .map(g => (
                          <button
                            key={g.id}
                            type="button"
                            onMouseDown={() => { setEditGym(g.name); setGymSearch(g.name); setShowGymDrop(false); }}
                            className="w-full text-left px-3 py-2 text-xs text-white/80 hover:bg-white/[0.06] border-b border-white/[0.04] last:border-0"
                          >
                            {g.name}
                          </button>
                        ))
                      }
                      {gymList.filter(g => g.name.toLowerCase().includes(gymSearch.toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-xs text-white/30">No gyms found</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Social links */}
              <div>
                <label className="text-white/35 text-[10px] uppercase tracking-wider mb-1.5 block">Social links</label>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2">
                    <span className="text-[#e1306c] text-sm shrink-0">IG</span>
                    <input value={editInstagram} onChange={e => setEditInstagram(e.target.value.replace(/^@/, ''))} placeholder="instagram_username"
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none" />
                  </div>
                  <div className="flex items-center gap-2 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2">
                    <span className="text-white/60 text-sm shrink-0 font-bold">𝕏</span>
                    <input value={editTwitter} onChange={e => setEditTwitter(e.target.value.replace(/^@/, ''))} placeholder="x_handle"
                      className="flex-1 bg-transparent text-sm text-white placeholder:text-white/20 focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* Privacy + Gender row */}
              <div className="grid grid-cols-2 gap-2 items-center">
                <div>
                  <label className="text-white/35 text-[10px] uppercase tracking-wider mb-1.5 block">Gender</label>
                  <select value={editGender} onChange={e => setEditGender(e.target.value)}
                    className="w-full bg-[#0d0b08] border border-[rgba(255,255,255,0.08)] rounded-lg px-2 py-2 text-xs text-white focus:outline-none focus:border-[rgba(201,169,110,0.4)]">
                    <option value="">Prefer not to say</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                  </select>
                </div>
                <div className="flex items-center justify-between bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg px-3 py-2 mt-4">
                  <div className="flex items-center gap-2">
                    <Lock className="w-3.5 h-3.5 text-white/40" />
                    <span className="text-white/70 text-xs">Private</span>
                  </div>
                  <button type="button" onClick={() => setEditIsPrivate(v => !v)}
                    className={'relative w-9 h-5 rounded-full transition-all ' + (editIsPrivate ? 'bg-[#c9a96e]' : 'bg-white/10')}>
                    <span className={'absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-all ' + (editIsPrivate ? 'translate-x-4' : '')} />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button onClick={() => setShowEditProfile(false)}
                  className="flex-1 py-2 rounded-lg border border-[rgba(255,255,255,0.08)] text-white/50 text-sm hover:text-white/70 transition-all">
                  Cancel
                </button>
                <button disabled={savingProfile || usernameStatus === 'taken' || usernameStatus === 'checking'}
                  onClick={handleSaveProfile}
                  className="flex-1 py-2 rounded-lg bg-[#c9a96e] text-[#0d0b08] text-sm font-medium disabled:opacity-50 transition-all">
                  {savingProfile ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          )}

          {/* Bio */}
          {profile.bio && !showEditProfile && (
            <p className="text-white/70 text-sm mb-3 leading-relaxed">{profile.bio}</p>
          )}

          {/* Tags row */}
          <div className="flex flex-wrap gap-2 mb-4">
            {profile.fitnessLevel && (
              <span className="flex items-center gap-1 text-xs text-white/50 bg-[rgba(201,169,110,0.04)] px-2.5 py-1 rounded-full">
                <Dumbbell className="w-3 h-3" /> {profile.fitnessLevel}
              </span>
            )}
            {profile.fitnessGoal && (
              <span className="flex items-center gap-1 text-xs text-white/50 bg-[rgba(201,169,110,0.04)] px-2.5 py-1 rounded-full">
                <Target className="w-3 h-3" /> {profile.fitnessGoal}
              </span>
            )}
            {profile.gym && (
              <span className="flex items-center gap-1.5 text-xs text-[#c9a96e]/80 bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] px-2.5 py-1 rounded-full font-medium">
                <Building2 className="w-3 h-3 text-[#c9a96e]" /> {profile.gym}
              </span>
            )}
          </div>

          {/* ── XP Rank Progress (own profile) ── */}
          {isOwnProfile && (() => {
            const xp    = profileXP;
            const rank  = getProfileRank(xp);
            const idx   = PROFILE_RANK_TIERS.indexOf(rank);
            const isMax = idx === PROFILE_RANK_TIERS.length - 1;
            const next  = isMax ? null : PROFILE_RANK_TIERS[idx + 1];
            const pct   = isMax ? 100 : Math.round(((xp - rank.minXP) / (next!.minXP - rank.minXP)) * 100);
            return (
              <div className="mb-4 p-3 rounded-xl border border-white/[0.06] bg-white/[0.02] flex items-center gap-3">
                <span className="text-xl shrink-0">{rank.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold" style={{ color: rank.color }}>{rank.name}</p>
                    <p className="text-white/30 text-[10px]">{xp.toLocaleString()} XP{next ? ' · ' + (next.minXP - xp).toLocaleString() + ' to ' + next.name : ' · Max rank'}</p>
                  </div>
                  <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: pct + '%', background: 'linear-gradient(90deg, ' + rank.color + ', ' + (next?.color ?? rank.color) + ')' }} />
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── Story Highlights Row ── */}
          {(highlights.length > 0 || isOwnProfile) && (
            <div className="flex gap-3 overflow-x-auto pb-1 mb-4 scrollbar-none">
              {highlights.map((hl, hlIdx) => (
                <button
                  key={hl.id}
                  onClick={() => setShowHighlightViewer({ highlight: hl, idx: 0 })}
                  className="flex flex-col items-center gap-1 shrink-0"
                >
                  <div className="w-14 h-14 rounded-full ring-2 ring-[rgba(201,169,110,0.4)] overflow-hidden bg-[rgba(201,169,110,0.04)] flex items-center justify-center">
                    {hl.coverUrl
                      ? <img src={hl.coverUrl} alt={hl.name} className="w-full h-full object-cover" />
                      : <PlayCircle className="w-6 h-6 text-[#c9a96e]" />}
                  </div>
                  <span className="text-white/50 text-[10px] max-w-[56px] truncate">{hl.name}</span>
                </button>
              ))}
              {isOwnProfile && (
                <button
                  onClick={() => setShowCreateHighlight(true)}
                  className="flex flex-col items-center gap-1 shrink-0"
                >
                  <div className="w-14 h-14 rounded-full border-2 border-dashed border-[rgba(201,169,110,0.18)] flex items-center justify-center hover:border-[rgba(201,169,110,0.5)] transition-all">
                    <Plus className="w-5 h-5 text-white/40" />
                  </div>
                  <span className="text-white/30 text-[10px]">New</span>
                </button>
              )}
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Posts',     value: posts.length,            tab: null },
              { label: 'Followers', value: Math.max(0, profile.followers ?? 0),  tab: 'followers' as const },
              { label: 'Following', value: Math.max(0, profile.following ?? 0),  tab: 'following' as const },
            ].map(({ label, value, tab }) => (
              <button
                key={label}
                onClick={() => tab && onViewFollowers?.(viewingUserId, tab)}
                className={`text-center bg-[rgba(201,169,110,0.04)] rounded-xl py-3 transition-all ${tab ? 'hover:bg-[rgba(201,169,110,0.08)] cursor-pointer' : 'cursor-default'}`}
              >
                <p className="text-white font-bold text-xl"><AnimatedNumber value={typeof value === 'number' ? value : 0} duration={800} /></p>
                <p className="text-white/40 text-xs mt-0.5">{label}</p>
              </button>
            ))}
          </div>

          {/* ── Pinned PRs ── */}
          {(pinnedPRs.length > 0 || isOwnProfile) && (
            <div className="mt-5 pt-4 border-t border-white/[0.06]">
              <div className="flex items-center justify-between mb-3">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-wide flex items-center gap-1.5">
                  <Trophy className="w-3.5 h-3.5 text-yellow-400" /> Personal Records
                </p>
                {isOwnProfile && (
                  <button
                    onClick={() => setShowPinPRs(p => !p)}
                    className="text-[11px] text-[#c9a96e] hover:text-[#e8c98a] transition-colors font-medium"
                  >
                    {showPinPRs ? 'Done' : pinnedPRs.length > 0 ? 'Edit' : '+ Pin your PRs'}
                  </button>
                )}
              </div>

              {/* PR editor (own profile only) */}
              {showPinPRs && isOwnProfile && (
                <div className="bg-[rgba(201,169,110,0.04)] rounded-xl p-3 mb-3 space-y-2">
                  {/* Existing PRs */}
                  {pinnedPRs.map((pr, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        value={pr.exercise}
                        onChange={e => setPinnedPRs(prev => prev.map((p, pi) => pi === i ? { ...p, exercise: e.target.value } : p))}
                        placeholder="Exercise"
                        className="flex-1 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-2 py-1 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
                      />
                      <input
                        value={pr.value}
                        onChange={e => setPinnedPRs(prev => prev.map((p, pi) => pi === i ? { ...p, value: e.target.value } : p))}
                        placeholder="100"
                        className="w-16 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-2 py-1 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
                      />
                      <select
                        value={pr.unit}
                        onChange={e => setPinnedPRs(prev => prev.map((p, pi) => pi === i ? { ...p, unit: e.target.value } : p))}
                        className="w-14 bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-lg px-1 py-1 text-xs text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
                      >
                        {['kg', 'lbs', 'reps', 'min', 'km'].map(u => <option key={u}>{u}</option>)}
                      </select>
                      <button onClick={() => setPinnedPRs(prev => prev.filter((_, pi) => pi !== i))} className="text-red-400/60 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                  {/* Add new PR row */}
                  {pinnedPRs.length < 5 && (
                    <div className="flex items-center gap-2">
                      <input
                        value={newPR.exercise}
                        onChange={e => setNewPR(p => ({ ...p, exercise: e.target.value }))}
                        placeholder="e.g. Bench Press"
                        className="flex-1 bg-[rgba(201,169,110,0.04)] border border-dashed border-[rgba(201,169,110,0.12)] rounded-lg px-2 py-1 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
                      />
                      <input
                        value={newPR.value}
                        onChange={e => setNewPR(p => ({ ...p, value: e.target.value }))}
                        placeholder="100"
                        className="w-16 bg-[rgba(201,169,110,0.04)] border border-dashed border-[rgba(201,169,110,0.12)] rounded-lg px-2 py-1 text-xs text-white placeholder:text-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
                      />
                      <select
                        value={newPR.unit}
                        onChange={e => setNewPR(p => ({ ...p, unit: e.target.value }))}
                        className="w-14 bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-lg px-1 py-1 text-xs text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
                      >
                        {['kg', 'lbs', 'reps', 'min', 'km'].map(u => <option key={u}>{u}</option>)}
                      </select>
                      <button
                        onClick={() => {
                          if (!newPR.exercise.trim() || !newPR.value.trim()) return;
                          setPinnedPRs(prev => [...prev, { ...newPR }]);
                          setNewPR({ exercise: '', value: '', unit: 'kg' });
                        }}
                        className="text-[#c9a96e] hover:text-[#e8c98a] transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <button
                    disabled={savingPRs}
                    onClick={async () => {
                      if (!currentUser) return;
                      setSavingPRs(true);
                      // Auto-flush any partially typed PR row before saving
                      const finalPRs = pendingNewPR
                        ? [...pinnedPRs, { exercise: newPR.exercise.trim(), value: newPR.value.trim(), unit: newPR.unit }].slice(0, 5)
                        : pinnedPRs;
                      if (pendingNewPR) {
                        setPinnedPRs(finalPRs);
                        setNewPR({ exercise: '', value: '', unit: 'kg' });
                      }
                      try {
                        await authFetch(`${API}/users/${currentUser.id}/profile`, {
                          method: 'PATCH',
                          body: JSON.stringify({ pinnedPRs: finalPRs }),
                        });
                        toast.success('PRs saved! 🏆');
                        setShowPinPRs(false);
                      } catch { toast.error('Could not save PRs'); }
                      finally { setSavingPRs(false); }
                    }}
                    className="w-full py-2 rounded-lg bg-gradient-to-r from-[#c9a96e] to-[#a07840] text-white text-xs font-semibold  transition-all disabled:opacity-60 shadow-sm"
                  >
                    {savingPRs ? 'Saving…' : `Save${pendingNewPR ? ` & add "${newPR.exercise || newPR.value}"` : ' PRs'}`}
                  </button>
                </div>
              )}

              {/* Display PRs */}
              {pinnedPRs.length > 0 && !showPinPRs && (
                <div className="flex flex-wrap gap-2">
                  {pinnedPRs.map((pr, i) => (
                    <div key={i} className="flex items-center gap-2 bg-gradient-to-r from-yellow-500/15 to-amber-500/10 border border-yellow-500/30 rounded-xl px-3 py-2 shadow-sm">
                      <Trophy className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
                      <span className="text-white/80 text-xs font-medium">{pr.exercise}</span>
                      <span className="text-yellow-300 text-sm font-bold leading-none">{pr.value}<span className="text-yellow-500/70 text-[10px] ml-0.5">{pr.unit}</span></span>
                    </div>
                  ))}
                </div>
              )}
              {pinnedPRs.length === 0 && isOwnProfile && !showPinPRs && (
                <button
                  onClick={() => setShowPinPRs(true)}
                  className="flex items-center gap-2 text-white/25 text-xs hover:text-white/50 transition-colors group"
                >
                  <div className="w-6 h-6 rounded-lg border border-dashed border-[rgba(201,169,110,0.12)] group-hover:border-white/30 flex items-center justify-center transition-colors">
                    <Plus className="w-3 h-3" />
                  </div>
                  Pin your best lifts to your profile
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Workout Heatmap ── (visible whenever posts are accessible) */}
      {!postsHidden && posts.length > 0 && (
        <WorkoutHeatmap posts={posts} uid={viewingUserId} />
      )}

      {/* ── Private account locked state ── */}
      {postsHidden && (
        <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-8 flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-[rgba(201,169,110,0.04)] flex items-center justify-center mb-4">
            <Lock className="w-7 h-7 text-white/30" />
          </div>
          <p className="text-white font-semibold mb-1">This account is private</p>
          <p className="text-white/40 text-sm">
            {hasPendingRequest
              ? 'Your follow request is pending. Once approved, you\'ll see their posts.'
              : 'Follow this account to see their workouts and progress.'}
          </p>
        </div>
      )}

      {/* ── Trainer Card ── (always visible — even private trainers need to be bookable) */}
      {isTrainer && (
        <div className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-5">
          <div className="flex items-start justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                <span className="text-white font-semibold text-sm">Certified Trainer</span>
              </div>
              {profile.trainerInfo?.trainerBio && (
                <p className="text-white/50 text-xs leading-relaxed max-w-sm">
                  {profile.trainerInfo.trainerBio}
                </p>
              )}
            </div>

            {isOwnProfile && (
              <button
                onClick={() => setShowEditTrainer(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[rgba(201,169,110,0.25)] text-[#c9a96e] text-xs hover:bg-[rgba(201,169,110,0.08)] transition-all"
              >
                <Edit2 className="w-3 h-3" />
                {profile.trainerInfo ? 'Edit' : 'Setup'}
              </button>
            )}
          </div>

          {profile.trainerInfo ? (
            <>
              {/* Pricing row */}
              <div className="flex flex-wrap gap-4 mb-4">
                <div className="flex items-center gap-1.5 text-sm">
                  <span className="text-[#c9a96e] font-bold text-lg">
                    {profile.trainerInfo.currency}{profile.trainerInfo.hourlyRate}
                  </span>
                  <span className="text-white/40 text-xs">/ hour</span>
                </div>
                {profile.trainerInfo.experience > 0 && (
                  <div className="flex items-center gap-1.5 text-white/50 text-sm">
                    <Clock className="w-4 h-4" />
                    {profile.trainerInfo.experience}y experience
                  </div>
                )}
                {profile.trainerInfo.sessionTypes?.map((t: string) => (
                  <div key={t} className="flex items-center gap-1 text-white/50 text-xs bg-[rgba(201,169,110,0.04)] px-2 py-1 rounded-full">
                    {t === 'online' ? <Video className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                    {t}
                  </div>
                ))}
              </div>

              {/* Specialties */}
              {profile.trainerInfo.specialties?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {profile.trainerInfo.specialties.map((s: string) => (
                    <span key={s} className="text-xs px-2.5 py-1 rounded-full bg-[rgba(201,169,110,0.08)] text-[#e8c98a] border border-[rgba(201,169,110,0.18)]">
                      {s}
                    </span>
                  ))}
                </div>
              )}

              {/* Availability */}
              {profile.trainerInfo.availability?.days?.length > 0 && (
                <div className="flex items-center gap-1.5 text-white/40 text-xs mb-4">
                  <Calendar className="w-3.5 h-3.5" />
                  {profile.trainerInfo.availability.days.map((d: string) => d.slice(0,3)).join(' · ')}
                  {' · '}
                  {profile.trainerInfo.availability.startTime} – {profile.trainerInfo.availability.endTime}
                </div>
              )}
            </>
          ) : isOwnProfile ? (
            <p className="text-white/30 text-sm mb-4">
              Set up your trainer profile so clients can book sessions with you.
            </p>
          ) : null}

          {/* Book button (only for non-own profiles) */}
          {!isOwnProfile && profile.trainerInfo && (
            <button
              onClick={() => setShowBookingModal(true)}
              className="w-full py-3 rounded-xl bg-[#c9a96e] text-white font-medium hover:bg-[#c9a96e] transition-all flex items-center justify-center gap-2"
            >
              Book a session <ChevronRight className="w-4 h-4" />
            </button>
          )}

          {/* Trainer setup CTA for own empty profile */}
          {isOwnProfile && !profile.trainerInfo && (
            <button
              onClick={() => setShowEditTrainer(true)}
              className="w-full py-2.5 rounded-xl border border-dashed border-[rgba(201,169,110,0.25)] text-[#c9a96e] text-sm hover:bg-[rgba(201,169,110,0.08)] transition-all flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" /> Set up trainer profile
            </button>
          )}
        </div>
      )}

      {/* ── Tabs ── */}
      {!postsHidden && isOwnProfile && (
        <div className="flex gap-1 bg-[rgba(201,169,110,0.04)] p-1 rounded-xl overflow-x-auto">
          <button
            onClick={() => setActiveTab('posts')}
            className={`flex-1 min-w-fit py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'posts' ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            Posts
          </button>
          <button
            onClick={() => setActiveTab('progress')}
            className={`flex-1 min-w-fit py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'progress' ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            📸 Progress
          </button>
          {isTrainer && (
            <button
              onClick={() => setActiveTab('bookings')}
              className={`flex-1 min-w-fit py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'bookings' ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70'}`}
            >
              Requests
              {bookings.length > 0 && (
                <span className="ml-1.5 text-xs bg-white/20 px-1.5 py-0.5 rounded-full">{bookings.length}</span>
              )}
            </button>
          )}
          {clientBookings.length > 0 && (
            <button
              onClick={() => setActiveTab('mybookings')}
              className={`flex-1 min-w-fit py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'mybookings' ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70'}`}
            >
              My Bookings
              <span className="ml-1.5 text-xs bg-white/20 px-1.5 py-0.5 rounded-full">{clientBookings.length}</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('stats')}
            className={`flex-1 min-w-fit py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'stats' ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            📊 Body Stats
          </button>
          <button
            onClick={() => setActiveTab('measurements' as any)}
            className={`flex-1 min-w-fit py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === ('measurements' as any) ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            📏 Measurements
          </button>
          <button
            onClick={() => setActiveTab('goals')}
            className={`flex-1 min-w-fit py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'goals' ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            🎯 Goals
          </button>
          <button
            onClick={() => {
              setActiveTab('saved');
              // Fetch saved posts on demand
              authFetch(`${API}/users/${viewingUserId}/saved-posts`)
                .then(r => r.json())
                .then(d => setSavedPosts(d.posts || []))
                .catch(() => {});
            }}
            className={`flex-1 min-w-fit py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'saved' ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            🔖 Saved
          </button>
          {isOwnProfile && isTrainer && (
            <button
              onClick={() => setActiveTab('clients')}
              className={`flex-1 min-w-fit py-2 px-3 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeTab === 'clients' ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70'}`}
            >
              👥 My Clients
            </button>
          )}
        </div>
      )}

      {/* ── Posts Grid ── */}
      {!postsHidden && activeTab === 'posts' && (
        <div>
          {/* View toggle */}
          {posts.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/30 text-xs">{posts.length} post{posts.length !== 1 ? 's' : ''}</p>
              <div className="flex gap-1 bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.06]">
                <button onClick={() => setPostsViewMode('list')}
                  className={'px-2.5 py-1 rounded-md text-xs font-medium transition-all ' + (postsViewMode === 'list' ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70')}>
                  ☰ List
                </button>
                <button onClick={() => setPostsViewMode('grid')}
                  className={'px-2.5 py-1 rounded-md text-xs font-medium transition-all ' + (postsViewMode === 'grid' ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70')}>
                  ⊞ Grid
                </button>
              </div>
            </div>
          )}
          {posts.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] flex items-center justify-center mx-auto mb-4">
                <Dumbbell className="w-6 h-6 text-white/20" />
              </div>
              <p className="text-white/40 text-sm">
                {isOwnProfile ? "You haven't posted any workouts yet." : 'No posts yet.'}
              </p>
            </div>
          ) : postsViewMode === 'grid' ? (
            <div className="grid grid-cols-3 gap-1.5">
              {posts.map((post: WorkoutPost) => {
                const img = (post as any).image || (post as any).mediaUrl || (post as any).images?.[0];
                return (
                  <div key={post.id} className="aspect-square rounded-xl overflow-hidden bg-[rgba(201,169,110,0.04)] border border-white/[0.06] relative group cursor-pointer">
                    {img
                      ? <img src={img} alt="" className="w-full h-full object-cover" />
                      : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1">
                          <Dumbbell className="w-5 h-5 text-white/20" />
                          <p className="text-white/25 text-[10px] text-center px-2 truncate w-full">{(post as any).exercise || 'Workout'}</p>
                        </div>
                      )
                    }
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center">
                      <p className="text-white text-xs font-medium text-center px-2 line-clamp-2">{(post as any).exercise || (post as any).caption || 'Workout'}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-3">
              {posts.map((post: WorkoutPost) => (
                <div key={post.id} className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-white/40">
                      {post.workoutType} · {post.duration} min · {post.calories} kcal
                    </span>
                    <span className="text-xs text-white/25">
                      {post.createdAt ? new Date(post.createdAt).toLocaleDateString() : ''}
                    </span>
                  </div>
                  {post.caption && (
                    <p className="text-white/80 text-sm leading-relaxed">{post.caption}</p>
                  )}
                  <div className="flex items-center gap-4 mt-3 text-white/30 text-xs">
                    <span>❤️ {post.likes ?? 0}</span>
                    <span>💬 {post.comments?.length ?? 0}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Bookings Tab (trainer own profile) ── */}
      {/* ── Progress Photos Tab ── */}
      {activeTab === 'progress' && isOwnProfile && (
        <div>
          {progressPhotos.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-14 h-14 rounded-2xl bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] flex items-center justify-center mx-auto mb-3">
                <span className="text-2xl">📸</span>
              </div>
              <p className="text-white/50 text-sm font-medium mb-1">No progress photos yet</p>
              <p className="text-white/25 text-xs max-w-xs mx-auto">Upload before/after photos in the Progress section to track your transformation.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Before/After comparison mode toggle */}
              <div className="flex items-center justify-between">
                <p className="text-white/40 text-xs">{progressPhotos.length} photo{progressPhotos.length !== 1 ? 's' : ''}</p>
                <button
                  onClick={() => { setCompareMode(m => !m); setCompareIdxA(null); setCompareIdxB(null); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    compareMode
                      ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.45)]/50 text-[#e8c98a]'
                      : 'border-[rgba(201,169,110,0.12)] text-white/50 hover:border-[rgba(201,169,110,0.18)] hover:text-white/70'
                  }`}
                >
                  <TrendingUp className="w-3 h-3" />
                  {compareMode ? 'Done comparing' : 'Compare before/after'}
                </button>
              </div>

              {/* Comparison slider — shown when both photos selected */}
              {compareMode && compareIdxA !== null && compareIdxB !== null && (
                <div className="rounded-2xl overflow-hidden bg-[#080608] border border-[rgba(201,169,110,0.08)] p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-white/60 text-xs font-medium">Before / After</p>
                    <button
                      onClick={() => { setCompareIdxA(null); setCompareIdxB(null); }}
                      className="text-white/30 hover:text-white/60 text-xs transition-colors"
                    >
                      Change selection
                    </button>
                  </div>
                  <BeforeAfterSlider
                    before={progressPhotos[Math.min(compareIdxA, compareIdxB)]}
                    after={progressPhotos[Math.max(compareIdxA, compareIdxB)]}
                  />
                  <p className="text-white/25 text-[10px] text-center mt-2">Drag the divider to compare</p>
                </div>
              )}

              {/* Photo grid — in compare mode, clicking selects A then B */}
              {(!compareMode || compareIdxA === null || compareIdxB === null) && (
                <div className="columns-2 gap-2 space-y-2">
                  {progressPhotos.map((photo: any, idx: number) => {
                    const isA = compareIdxA === idx;
                    const isB = compareIdxB === idx;
                    return (
                      <div
                        key={photo.id}
                        className={`break-inside-avoid rounded-xl overflow-hidden border relative transition-all cursor-pointer ${
                          compareMode
                            ? isA || isB
                              ? 'border-[rgba(201,169,110,0.45)] ring-2 ring-[rgba(201,169,110,0.4)]'
                              : 'border-[rgba(201,169,110,0.08)] hover:border-[#c9a96e]/40'
                            : 'border-[rgba(201,169,110,0.08)]'
                        }`}
                        onClick={() => {
                          if (!compareMode) return;
                          if (isA) { setCompareIdxA(null); return; }
                          if (isB) { setCompareIdxB(null); return; }
                          if (compareIdxA === null) { setCompareIdxA(idx); return; }
                          if (compareIdxB === null) { setCompareIdxB(idx); return; }
                        }}
                      >
                        <img src={photo.url} alt="" className="w-full object-cover" draggable={false} />
                        {compareMode && (isA || isB) && (
                          <div className="absolute top-2 left-2 w-6 h-6 rounded-full bg-[#c9a96e] flex items-center justify-center shadow-lg">
                            <span className="text-white text-[10px] font-bold">{isA ? 'A' : 'B'}</span>
                          </div>
                        )}
                        {compareMode && !isA && !isB && (
                          <div className="absolute inset-0 bg-black/20 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-white text-xs font-medium bg-black/60 px-2 py-1 rounded-lg">
                              {compareIdxA === null ? 'Select as Before' : 'Select as After'}
                            </span>
                          </div>
                        )}
                        {photo.note && (
                          <p className="text-white/40 text-xs p-2 truncate">{photo.note}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Compare mode instructions */}
              {compareMode && compareIdxA === null && (
                <p className="text-center text-white/30 text-xs py-2">Tap a photo to mark it as <span className="text-[#c9a96e]">Before</span></p>
              )}
              {compareMode && compareIdxA !== null && compareIdxB === null && (
                <p className="text-center text-white/30 text-xs py-2">Now tap another photo to mark it as <span className="text-[#c9a96e]">After</span></p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Stats Tab ── */}
      {activeTab === 'stats' && (
        <BodyStatsTracker userId={viewingUserId} />
      )}

      {/* ── Measurements Tab ── */}
      {activeTab === ('measurements' as any) && (
        <div className="px-4 py-4">
          <BodyMeasurementsPage
            userId={viewingUserId}
            currentUser={currentUser}
            readOnly={!isOwnProfile}
          />
        </div>
      )}

      {/* ── Goals Tab ── */}
      {activeTab === 'goals' && (
        <GoalTracker userId={viewingUserId} />
      )}

      {/* ── Saved Tab ── */}
      {activeTab === 'saved' && isOwnProfile && (
        <div className="space-y-3">
          {savedPosts.length === 0 ? (
            <EmptyState icon="bookmark" title="No saved workouts" sub="Tap the bookmark icon on any post to save it here." />
          ) : (
            savedPosts.map((post: WorkoutPost) => (
              <WorkoutCard
                key={post.id}
                post={post}
                currentUser={currentUser}
              />
            ))
          )}
        </div>
      )}

      {/* ── Bookings Tab (trainer own profile) ── */}
      {activeTab === 'bookings' && isOwnProfile && isTrainer && (
        <div className="space-y-3">
          {bookings.length === 0 ? (
            <EmptyState icon="calendar" title="No bookings yet" sub="Clients can request sessions from your profile." />
          ) : (
            bookings.map((b: Booking) => (
              <div key={b.id} className="p-4 rounded-xl bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.08)]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white font-medium text-sm">{b.clientName}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    b.status === 'confirmed' ? 'bg-green-500/20 text-green-300' :
                    b.status === 'pending'   ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-red-500/20 text-red-300'}`}>{b.status}</span>
                </div>
                <p className="text-white/40 text-xs">{b.date} · {b.timeSlot} · {b.sessionType}</p>
                {b.status === 'pending' && (
                  <div className="flex gap-2 mt-3">
                    <button onClick={() => updateBookingStatus(b.id, 'confirmed').then(load).catch(() => toast.error('Failed'))}
                      className="flex-1 py-1.5 rounded-lg bg-green-500/20 text-green-300 text-xs font-medium hover:bg-green-500/30 transition-all">
                      Confirm
                    </button>
                    <button onClick={() => updateBookingStatus(b.id, 'cancelled').then(load).catch(() => toast.error('Failed'))}
                      className="flex-1 py-1.5 rounded-lg bg-red-500/20 text-red-300 text-xs font-medium hover:bg-red-500/30 transition-all">
                      Decline
                    </button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* ── My Bookings Tab (client view) ── */}
      {activeTab === 'mybookings' && isOwnProfile && (
        <div className="space-y-3">
          {clientBookings.length === 0 ? (
            <EmptyState icon="calendar" title="No bookings yet" sub="Book a session with a trainer to get started." />
          ) : (
            clientBookings.map((b: Booking) => (
              <div key={b.id} className="p-4 rounded-xl bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.08)]">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-white font-medium text-sm">{b.trainerName}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    b.status === 'confirmed' ? 'bg-green-500/20 text-green-300' :
                    b.status === 'pending'   ? 'bg-yellow-500/20 text-yellow-300' :
                    'bg-red-500/20 text-red-300'}`}>{b.status}</span>
                </div>
                <p className="text-white/40 text-xs">{b.date} · {b.timeSlot} · {b.sessionType}</p>
              </div>
            ))
          )}
        </div>
      )}


      {/* ── Highlight Viewer Modal ── */}
      {showHighlightViewer && (
        <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setShowHighlightViewer(null)}>
          <div className="relative w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="relative bg-[#080608] rounded-2xl overflow-hidden aspect-[9/16] max-h-[80vh]">
              {showHighlightViewer.highlight.stories.length > 0 ? (
                <img
                  src={showHighlightViewer.highlight.stories[showHighlightViewer.idx]?.imageUrl}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-white/30 text-sm">
                  No stories in this highlight
                </div>
              )}
              {/* Story progress dots */}
              <div className="absolute top-3 left-3 right-3 flex gap-1">
                {showHighlightViewer.highlight.stories.map((_: any, i: number) => (
                  <div key={i} className={`flex-1 h-0.5 rounded-full ${i <= showHighlightViewer.idx ? 'bg-white' : 'bg-white/30'}`} />
                ))}
              </div>
              {/* Header */}
              <div className="absolute top-6 left-3 right-3 flex items-center justify-between">
                <span className="text-white font-semibold text-sm drop-shadow">{showHighlightViewer.highlight.name}</span>
                <button onClick={() => setShowHighlightViewer(null)} className="text-white/70 hover:text-white">
                  <X className="w-5 h-5" />
                </button>
              </div>
              {/* Caption */}
              {showHighlightViewer.highlight.stories[showHighlightViewer.idx]?.caption && (
                <div className="absolute bottom-4 left-4 right-4">
                  <p className="text-white text-sm drop-shadow bg-black/40 rounded-lg px-3 py-2">
                    {showHighlightViewer.highlight.stories[showHighlightViewer.idx].caption}
                  </p>
                </div>
              )}
              {/* Prev/Next tap zones */}
              <button
                className="absolute inset-y-0 left-0 w-1/3"
                onClick={() => setShowHighlightViewer(s => s && s.idx > 0 ? { ...s, idx: s.idx - 1 } : s)}
              />
              <button
                className="absolute inset-y-0 right-0 w-1/3"
                onClick={() => {
                  if (!showHighlightViewer) return;
                  const max = showHighlightViewer.highlight.stories.length - 1;
                  if (showHighlightViewer.idx < max) {
                    setShowHighlightViewer(s => s ? { ...s, idx: s.idx + 1 } : s);
                  } else {
                    setShowHighlightViewer(null);
                  }
                }}
              />
            </div>
            {/* Delete highlight (own profile) */}
            {isOwnProfile && (
              <button
                onClick={async () => {
                  const { authFetch: af } = await import('../../utils/authToken');
                  await af(`${API}/users/${currentUser!.id}/highlights/${showHighlightViewer.highlight.id}`, { method: 'DELETE' });
                  setHighlights(prev => prev.filter(h => h.id !== showHighlightViewer.highlight.id));
                  setShowHighlightViewer(null);
                }}
                className="mt-3 w-full py-2 rounded-xl border border-red-500/30 text-red-400 text-sm hover:bg-red-500/10 transition-all"
              >
                Delete highlight
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Create Highlight Modal ── */}
      {showCreateHighlight && isOwnProfile && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-end justify-center p-4"
          onClick={() => setShowCreateHighlight(false)}>
          <div className="w-full max-w-sm bg-[#0d0b08] rounded-2xl p-5 space-y-4"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold">New Highlight</p>
              <button onClick={() => setShowCreateHighlight(false)}><X className="w-5 h-5 text-white/40" /></button>
            </div>
            <input
              value={newHLName}
              onChange={e => setNewHLName(e.target.value)}
              placeholder="Highlight name (e.g. 'Client Results')"
              className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
            />
            <button
              disabled={!newHLName.trim() || creatingHL}
              onClick={async () => {
                if (!newHLName.trim() || !currentUser) return;
                setCreatingHL(true);
                try {
                  const res = await authFetch(`${API}/users/${currentUser.id}/highlights`, {
                    method: 'POST', body: JSON.stringify({ name: newHLName.trim() }),
                  });
                  const data = await res.json();
                  setHighlights(prev => [...prev, { ...data }]);
                  setNewHLName('');
                  setShowCreateHighlight(false);
                  toast.success('Highlight created!');
                } catch { toast.error('Failed to create highlight'); }
                setCreatingHL(false);
              }}
              className="w-full py-3 rounded-xl bg-[#c9a96e] text-white font-medium hover:bg-[#c9a96e] disabled:opacity-50 transition-all"
            >
              {creatingHL ? 'Creating…' : 'Create'}
            </button>
          </div>
        </div>
      )}

      {/* ── Analytics Tab (trainer own profile) ── */}

      {/* ── Clients Tab (trainer own profile) ── */}
      {activeTab === 'clients' && isOwnProfile && isTrainer && (
        <ClientsTab trainerId={viewingUserId} />
      )}

      {activeTab === 'analytics' && isOwnProfile && isTrainer && (
        <TrainerAnalytics currentUser={currentUser!} />
      )}

      {/* ── Challenge Dialog ── */}
      {showChallengeDialog && currentUser && (
        <ChallengeDialog
          targetUser={{ id: viewingUserId, name: profile.displayName || profile.name || 'User' }}
          currentUser={currentUser}
          onClose={() => setShowChallengeDialog(false)}
        />
      )}

      {/* ── Booking Modal ── */}
      {showBookingModal && profile && currentUser && profile.trainerInfo && (
        <BookingModal
          trainer={{ id: viewingUserId, name: profile.displayName || profile.name || 'Trainer', trainerInfo: profile.trainerInfo }}
          client={currentUser}
          onClose={() => setShowBookingModal(false)}
          onSuccess={() => { setShowBookingModal(false); toast.success('Booking request sent! The trainer will confirm shortly.'); }}
        />
      )}
    </div>
  );
}

// ─── My Clients Tab ───────────────────────────────────────────────────────────
interface TrainerClient {
  id: string; displayName: string; username: string; avatar: string | null;
  fitnessGoal: string; totalBookings: number; lastBookingDate: string | null; recentWorkouts: number;
  recentWorkoutNames: string[];
}


function ClientsTab({ trainerId }: { trainerId: string }) {
  const [clients, setClients] = useState<TrainerClient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch(`${API}/users/${trainerId}/trainer/clients`)
      .then(r => r.json())
      .then(d => setClients(d.clients || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [trainerId]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="w-5 h-5 rounded-full border-2 border-[#c9a96e] border-t-transparent animate-spin" />
      </div>
    );
  }

  if (clients.length === 0) {
    return (
      <div className="text-center py-12">
        <Users className="w-8 h-8 text-white/20 mx-auto mb-3" />
        <p className="text-white/40 text-sm">No clients yet</p>
        <p className="text-white/25 text-xs mt-1">Clients who book you will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-white/30 text-xs px-1">{clients.length} client{clients.length !== 1 ? 's' : ''}</p>
      {clients.map(c => (
        <div key={c.id} className="bg-[#0d0b08] border border-[rgba(201,169,110,0.08)] rounded-2xl p-4">
          <div className="flex items-center gap-3 mb-3">
            {c.avatar
              ? <img src={c.avatar} className="w-10 h-10 rounded-full object-cover shrink-0" alt={c.displayName} />
              : <div className="w-10 h-10 rounded-full bg-[#a07840] flex items-center justify-center text-white font-semibold shrink-0">{c.displayName[0]}</div>
            }
            <div className="flex-1 min-w-0">
              <p className="text-white font-medium text-sm truncate">{c.displayName}</p>
              <p className="text-white/35 text-xs">@{c.username}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-[#e8c98a] font-semibold text-sm">{c.totalBookings}</p>
              <p className="text-white/30 text-[10px]">session{c.totalBookings !== 1 ? 's' : ''}</p>
            </div>
          </div>
          {c.recentWorkoutNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {c.recentWorkoutNames.slice(0, 3).map((n, i) => (
                <span key={i} className="px-2 py-0.5 rounded-full bg-[rgba(201,169,110,0.04)] text-white/40 text-[10px] border border-[rgba(201,169,110,0.08)]">
                  {n}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
