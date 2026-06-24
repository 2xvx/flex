// TrainPage.tsx — Workouts + Programs + AI Workouts + Challenges + Live Mode + Weekly Recap + Marketplace
import { useState, useEffect } from 'react';
import { Dumbbell, BookOpen, Trophy, CalendarCheck, AlertTriangle, X, UserCheck, ChevronRight } from 'lucide-react';
import { PRTracker } from './PRTracker';
import { ProgramBuilder } from './ProgramBuilder';
import { WorkoutSuggestionsPage } from './WorkoutSuggestionsPage';
import { DuelsPage } from './DuelsPage';
import { WeeklyRecapPage } from './WeeklyRecapPage';
import { LiveWorkoutPage } from './LiveWorkoutPage';
import { LiveStreamingPage } from './LiveStreamingPage';
import { TrainTogetherPage } from './TrainTogetherPage';
import { authFetch } from '../../utils/authToken';
import { User } from '../types';

interface Props { currentUser: User | null; }

interface AssignedProgram {
  id: string;
  programId: string;
  programName: string;
  trainerName: string;
  trainerAvatar?: string;
  assignedAt: string;
  weeks?: number;
  daysPerWeek?: number;
  goal?: string;
}

import { API } from '../../config';

const TABS = [
  { id: 'workouts',     label: 'My Workouts',  Icon: Dumbbell      },
  { id: 'programs',     label: 'Programs',      Icon: BookOpen      },
  { id: 'challenges',   label: 'Train Together', Icon: Trophy        },
  { id: 'recap',        label: 'Weekly Recap',  Icon: CalendarCheck },
];

// ── Deload logic ──────────────────────────────────────────────────────────────
// Returns true when user has 3+ workout days in EACH of the last 4 weeks
function checkDeload(posts: any[]): boolean {
  const now = Date.now();
  const MS_WEEK = 7 * 24 * 60 * 60 * 1000;
  let allFull = true;
  for (let w = 0; w < 4; w++) {
    const start = now - (w + 1) * MS_WEEK;
    const end   = now - w * MS_WEEK;
    const days  = new Set(
      posts
        .filter(p => {
          const t = p.createdAt?.seconds ? p.createdAt.seconds * 1000 : new Date(p.createdAt).getTime();
          return t >= start && t < end;
        })
        .map(p => {
          const t = p.createdAt?.seconds ? p.createdAt.seconds * 1000 : new Date(p.createdAt).getTime();
          return new Date(t).toDateString();
        })
    );
    if (days.size < 3) { allFull = false; break; }
  }
  return allFull;
}

export function TrainPage({ currentUser }: Props) {
  const [tab, setTab]                       = useState('workouts');
  const [showDeload, setShowDeload]         = useState(false);
  const [deloadChecked, setDeloadChecked]   = useState(false);
  const [assignedPrograms, setAssignedPrograms] = useState<AssignedProgram[]>([]);
  const [expandAssigned, setExpandAssigned] = useState(false);

  // ── Check deload after profile loads ─────────────────────────────────────
  useEffect(() => {
    if (!currentUser || deloadChecked) return;
    const dismissed = localStorage.getItem('flex_deload_dismissed');
    if (dismissed) {
      const when = Number(dismissed);
      if (Date.now() - when < 7 * 24 * 60 * 60 * 1000) return; // dismissed within 7 days
    }

    (async () => {
      try {
        const res  = await authFetch(`${API}/users/${currentUser.id}`);
        const data = await res.json();
        const posts: any[] = data.posts || [];
        if (checkDeload(posts)) setShowDeload(true);
      } catch {}
      setDeloadChecked(true);
    })();
  }, [currentUser, deloadChecked]);

  // ── Fetch trainer-assigned programs ─────────────────────────────────────
  useEffect(() => {
    if (!currentUser) return;
    authFetch(`${API}/train/assigned`)
      .then(r => r.json())
      .then(d => setAssignedPrograms(d.programs || []))
      .catch(() => {});
  }, [currentUser]);

  const dismissDeload = () => {
    setShowDeload(false);
    localStorage.setItem('flex_deload_dismissed', String(Date.now()));
  };

  return (
    <div className="min-h-full">
      {/* Tab bar */}
      <div className="sticky top-0 z-20 bg-[#080608] border-b border-[rgba(201,169,110,0.08)]">
        <div className="flex overflow-x-auto scrollbar-hide">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-all shrink-0 ${
                tab === id
                  ? id === 'live' ? 'border-orange-500 text-orange-300' : 'border-orange-500 text-white'
                  : 'border-transparent text-white/40 hover:text-white/70'
              }`}>
              <Icon size={15} className={tab === id && id === 'live' ? 'fill-orange-400' : undefined} />{label}
              {id === 'live' && <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />}
            </button>
          ))}
        </div>
      </div>

      {/* ── Trainer-assigned programs banner ─────────────────────────────────── */}
      {assignedPrograms.length > 0 && (tab === 'workouts' || tab === 'programs') && (
        <div className="mx-4 mt-4">
          <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/6 border border-amber-500/25 rounded-2xl overflow-hidden">
            <button
              onClick={() => setExpandAssigned(v => !v)}
              className="w-full flex items-center gap-3 px-4 py-3"
            >
              <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                <UserCheck className="w-4 h-4 text-amber-400" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-amber-300 text-xs font-semibold">
                  {assignedPrograms.length} program{assignedPrograms.length > 1 ? 's' : ''} assigned by your trainer
                </p>
                <p className="text-white/35 text-[11px] mt-0.5">Tap to {expandAssigned ? 'hide' : 'view'}</p>
              </div>
              <ChevronRight className={`w-4 h-4 text-white/25 transition-transform ${expandAssigned ? 'rotate-90' : ''}`} />
            </button>
            {expandAssigned && (
              <div className="border-t border-[rgba(201,169,110,0.08)] divide-y divide-white/5">
                {assignedPrograms.map(ap => (
                  <div key={ap.id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white text-sm font-medium truncate">{ap.programName}</p>
                      <p className="text-white/35 text-xs mt-0.5">
                        By {ap.trainerName}
                        {ap.weeks && ` · ${ap.weeks}w`}
                        {ap.daysPerWeek && ` · ${ap.daysPerWeek}×/week`}
                        {ap.goal && ` · ${ap.goal}`}
                      </p>
                    </div>
                    <button
                      onClick={() => setTab('programs')}
                      className="text-[11px] text-amber-400 font-medium hover:text-amber-300 transition-colors whitespace-nowrap"
                    >
                      View →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Deload week suggestion banner ────────────────────────────────────── */}
      {showDeload && tab === 'workouts' && (
        <div className="mx-4 mt-4">
          <div className="relative bg-gradient-to-r from-amber-500/10 to-orange-500/8 border border-amber-500/25 rounded-2xl p-4 pr-10">
            <button
              onClick={dismissDeload}
              className="absolute top-3 right-3 text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/25 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="space-y-1">
                <p className="text-amber-200 font-semibold text-sm">Time for a Deload Week 💡</p>
                <p className="text-white/50 text-xs leading-relaxed">
                  You've been crushing it for 4 straight weeks with 3+ sessions each — that's impressive. Your muscles and CNS need a recovery week to prevent burnout and come back stronger.
                </p>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Cut volume by 40%', 'Keep intensity moderate', 'Prioritise sleep & protein', 'No new PRs this week'].map(tip => (
                    <span key={tip} className="text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-300/80 px-2 py-0.5 rounded-full">{tip}</span>
                  ))}
                </div>
                <button
                  onClick={() => { setTab('ai'); dismissDeload(); }}
                  className="mt-2 text-xs text-amber-300 hover:text-amber-200 font-medium flex items-center gap-1"
                >
                   Get a deload plan from AI →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab content */}
      {tab === 'workouts'    && <PRTracker currentUser={currentUser} />}

      {tab === 'programs'    && <ProgramBuilder currentUser={currentUser} />}


      {tab === 'recap'       && <WeeklyRecapPage currentUser={currentUser} />}

      {tab === 'challenges'  && <TrainTogetherPage currentUser={currentUser} />}
    </div>
  );
}
