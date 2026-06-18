// ProgramBuilder.tsx
// Create, edit, browse and share workout programs.
import { useState, useEffect, useMemo } from 'react';
import { Plus, Trash2, ChevronDown, ChevronUp, Share2, Globe, Lock, Edit2, X, Dumbbell, BookOpen, Save, Layers, Calendar, Zap, Users, ArrowLeft, Clock, Play, CheckCircle2, ChevronRight, Copy, Star, Filter } from 'lucide-react';
import { User } from '../types';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';

import { API } from '../../config';

interface ExerciseItem { name: string; sets: number; reps: string; rest: string; notes: string; }
interface DayPlan      { dayName: string; exercises: ExerciseItem[]; }
interface WeekPlan     { weekNumber: number; days: DayPlan[]; }
interface Program      { id?: string; name: string; description: string; weeks: WeekPlan[]; isPublic: boolean; difficulty?: string; goal?: string; author?: { name: string; username: string; avatar: string }; saves?: number; createdAt?: string; }

const emptyExercise = (): ExerciseItem => ({ name: '', sets: 3, reps: '8-12', rest: '90s', notes: '' });
const emptyDay      = (n: number): DayPlan => ({ dayName: `Day ${n}`, exercises: [emptyExercise()] });
const emptyWeek     = (n: number): WeekPlan => ({ weekNumber: n, days: [emptyDay(1)] });

const WEEK_COLORS = [
  'from-[rgba(201,169,110,0.08)] to-[rgba(201,169,110,0.04)] border-[rgba(201,169,110,0.25)]',
  'from-blue-500/20 to-cyan-500/10 border-blue-500/30',
  'from-emerald-500/20 to-teal-500/10 border-emerald-500/30',
  'from-orange-500/20 to-amber-500/10 border-orange-500/30',
  'from-rose-500/20 to-pink-500/10 border-rose-500/30',
];
const WEEK_LABEL_COLORS = ['text-[#c9a96e]', 'text-blue-400', 'text-emerald-400', 'text-orange-400', 'text-rose-400'];
const WEEK_DOT_COLORS   = ['bg-[#c9a96e]', 'bg-blue-400', 'bg-emerald-400', 'bg-orange-400', 'bg-rose-400'];

const DIFF_COLORS: Record<string, string> = {
  beginner:     'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  intermediate: 'text-amber-400   bg-amber-500/10   border-amber-500/20',
  advanced:     'text-red-400     bg-red-500/10     border-red-500/20',
};

const GOAL_OPTIONS = ['General Fitness', 'Lose Weight', 'Build Muscle', 'Improve Endurance', 'Increase Strength', 'Sport-Specific'];

interface ActiveProgram { programId: string; programName: string; currentWeek: number; currentDay: number; startedAt?: string; }
interface Props { currentUser: User | null; }

export function ProgramBuilder({ currentUser }: Props) {
  const [tab,          setTab]          = useState<'mine' | 'browse'>('mine');
  const [myPrograms,   setMyPrograms]   = useState<Program[]>([]);
  const [publicProgs,  setPublicProgs]  = useState<Program[]>([]);
  const [editing,      setEditing]      = useState<Program | null>(null);
  const [viewing,      setViewing]      = useState<Program | null>(null);
  const [expandedWeek, setExpandedWeek] = useState<number>(0);
  const [viewWeek,     setViewWeek]     = useState<number>(0);
  const [loading,      setLoading]      = useState(true);
  const [activeProgram, setActiveProgram] = useState<ActiveProgram | null>(null);
  const [settingActive, setSettingActive] = useState(false);

  // Browse filters
  const [browseDiff,  setBrowseDiff]  = useState('');
  const [browseGoal,  setBrowseGoal]  = useState('');
  const [browseWeeks, setBrowseWeeks] = useState(0);

  useEffect(() => { fetchMine(); fetchPublic(); fetchActiveProgram(); }, []);  // eslint-disable-line

  const fetchMine = async () => {
    try {
      const res = await authFetch(`${API}/programs/mine`);
      if (res.ok) setMyPrograms((await res.json()).programs || []);
    } catch {} finally { setLoading(false); }
  };

  const fetchPublic = async () => {
    try {
      const res = await authFetch(`${API}/programs`);
      if (res.ok) setPublicProgs((await res.json()).programs || []);
    } catch {}
  };

  const fetchActiveProgram = async () => {
    if (!currentUser) return;
    try {
      const res = await authFetch(`${API}/users/${currentUser.id}/profile`);
      if (res.ok) { const d = await res.json(); setActiveProgram(d.activeProgram || null); }
    } catch {}
  };

  const setAsActive = async (prog: Program) => {
    if (!currentUser || !prog.id) return;
    setSettingActive(true);
    try {
      const isAlready = activeProgram?.programId === prog.id;
      await authFetch(`${API}/users/${currentUser.id}/active-program`, {
        method: 'PATCH',
        body: JSON.stringify(isAlready ? { programId: null } : { programId: prog.id, programName: prog.name, currentWeek: 0, currentDay: 0 }),
      });
      setActiveProgram(isAlready ? null : { programId: prog.id, programName: prog.name, currentWeek: 0, currentDay: 0 });
      toast.success(isAlready ? 'Program deactivated' : 'Now following: ' + prog.name + ' 💪');
    } catch { toast.error('Failed to update'); }
    finally { setSettingActive(false); }
  };

  const advanceDay = async () => {
    if (!currentUser || !activeProgram) return;
    const prog = myPrograms.find(p => p.id === activeProgram.programId);
    if (!prog) return;
    const totalWeeks = prog.weeks.length;
    const daysInWeek = prog.weeks[activeProgram.currentWeek]?.days.length || 1;
    let nextWeek = activeProgram.currentWeek;
    let nextDay  = activeProgram.currentDay + 1;
    if (nextDay >= daysInWeek) { nextDay = 0; nextWeek = Math.min(nextWeek + 1, totalWeeks - 1); }
    await authFetch(`${API}/users/${currentUser.id}/active-program/progress`, {
      method: 'PATCH', body: JSON.stringify({ currentWeek: nextWeek, currentDay: nextDay }),
    });
    setActiveProgram(ap => ap ? { ...ap, currentWeek: nextWeek, currentDay: nextDay } : ap);
    toast.success('Progress saved!');
  };

  const startNew = () => { setEditing({ name: '', description: '', weeks: [emptyWeek(1)], isPublic: true, difficulty: 'intermediate' }); setExpandedWeek(0); };

  const openView = (prog: Program) => { setViewing(prog); setViewWeek(0); };

  const saveProgram = async () => {
    if (!editing || !editing.name.trim()) { toast.error('Program needs a name'); return; }
    try {
      if (editing.id) {
        await authFetch(`${API}/programs/${editing.id}`, { method: 'PUT', body: JSON.stringify(editing) });
        toast.success('Program updated!');
      } else {
        await authFetch(`${API}/programs`, { method: 'POST', body: JSON.stringify(editing) });
        toast.success('Program saved!');
      }
      setEditing(null);
      fetchMine(); fetchPublic();
    } catch { toast.error('Save failed'); }
  };

  const deleteProgram = async (id: string) => {
    if (!confirm('Delete this program?')) return;
    await authFetch(`${API}/programs/${id}`, { method: 'DELETE' });
    fetchMine();
    toast.success('Deleted');
  };

  const shareProgram = (prog: Program, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}?program=${prog.id}`).then(() => toast.success('Link copied!'));
  };

  // -- Editor helpers --
  const setField = (field: keyof Program, val: any) => setEditing(e => e ? { ...e, [field]: val } : e);
  const addWeek  = () => setEditing(e => e ? { ...e, weeks: [...e.weeks, emptyWeek(e.weeks.length + 1)] } : e);

  const copyWeek = (wIdx: number) => setEditing(e => {
    if (!e) return e;
    const src = e.weeks[wIdx];
    const newWeek: WeekPlan = {
      weekNumber: e.weeks.length + 1,
      days: src.days.map(d => ({ ...d, exercises: d.exercises.map(ex => ({ ...ex })) })),
    };
    return { ...e, weeks: [...e.weeks, newWeek] };
  });

  const addDay = (wIdx: number) => setEditing(e => {
    if (!e) return e;
    const weeks = e.weeks.map((w, i) => i === wIdx ? { ...w, days: [...w.days, emptyDay(w.days.length + 1)] } : w);
    return { ...e, weeks };
  });

  const copyDay = (wIdx: number, dIdx: number) => setEditing(e => {
    if (!e) return e;
    const src = e.weeks[wIdx].days[dIdx];
    const newDay: DayPlan = { dayName: src.dayName + ' (copy)', exercises: src.exercises.map(ex => ({ ...ex })) };
    const weeks = e.weeks.map((w, i) => i === wIdx ? { ...w, days: [...w.days, newDay] } : w);
    return { ...e, weeks };
  });

  const updateDay = (wIdx: number, dIdx: number, field: keyof DayPlan, val: any) => setEditing(e => {
    if (!e) return e;
    const weeks = e.weeks.map((w, i) => i === wIdx
      ? { ...w, days: w.days.map((d, j) => j === dIdx ? { ...d, [field]: val } : d) } : w);
    return { ...e, weeks };
  });

  const addExercise = (wIdx: number, dIdx: number) => setEditing(e => {
    if (!e) return e;
    const weeks = e.weeks.map((w, i) => i === wIdx
      ? { ...w, days: w.days.map((d, j) => j === dIdx ? { ...d, exercises: [...d.exercises, emptyExercise()] } : d) } : w);
    return { ...e, weeks };
  });

  const updateExercise = (wIdx: number, dIdx: number, eIdx: number, field: keyof ExerciseItem, val: any) => setEditing(e => {
    if (!e) return e;
    const weeks = e.weeks.map((w, i) => i === wIdx
      ? { ...w, days: w.days.map((d, j) => j === dIdx
          ? { ...d, exercises: d.exercises.map((ex, k) => k === eIdx ? { ...ex, [field]: val } : ex) } : d) } : w);
    return { ...e, weeks };
  });

  const removeExercise = (wIdx: number, dIdx: number, eIdx: number) => setEditing(e => {
    if (!e) return e;
    const weeks = e.weeks.map((w, i) => i === wIdx
      ? { ...w, days: w.days.map((d, j) => j === dIdx
          ? { ...d, exercises: d.exercises.filter((_, k) => k !== eIdx) } : d) } : w);
    return { ...e, weeks };
  });

  const totalExercises = (prog: Program) =>
    prog.weeks.reduce((a, w) => a + w.days.reduce((b, d) => b + d.exercises.length, 0), 0);

  // Browse filter
  const filteredPublic = useMemo(() => publicProgs.filter(p => {
    if (browseDiff && p.difficulty !== browseDiff) return false;
    if (browseGoal && p.goal !== browseGoal) return false;
    if (browseWeeks > 0 && (p.weeks?.length ?? 0) < browseWeeks) return false;
    return true;
  }), [publicProgs, browseDiff, browseGoal, browseWeeks]);

  // -- Program card --
  const ProgramCard = ({ prog, isMine }: { prog: Program; isMine: boolean }) => {
    const totalDays = prog.weeks.reduce((a, w) => a + w.days.length, 0);
    const isActive  = activeProgram?.programId === prog.id;
    const doneDays  = isActive
      ? prog.weeks.slice(0, activeProgram!.currentWeek).reduce((a, w) => a + w.days.length, 0) + activeProgram!.currentDay
      : 0;
    const pct = totalDays > 0 ? Math.round((doneDays / totalDays) * 100) : 0;

    return (
      <div
        onClick={() => openView(prog)}
        className="bg-[#080608] border border-[rgba(201,169,110,0.07)] rounded-2xl p-5 hover:border-[rgba(201,169,110,0.25)] hover:bg-[#0d0b08] transition-all cursor-pointer group"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] flex items-center justify-center shrink-0">
            <Dumbbell className="w-5 h-5 text-[#c9a96e]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-0.5 flex-wrap">
              <h3 className="text-white font-semibold text-sm truncate">{prog.name}</h3>
              {isActive && <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0"><CheckCircle2 className="w-2.5 h-2.5" />Active</span>}
              {prog.difficulty && (
                <span className={'text-[10px] px-1.5 py-0.5 rounded-full border capitalize shrink-0 ' + (DIFF_COLORS[prog.difficulty] || DIFF_COLORS.intermediate)}>
                  {prog.difficulty}
                </span>
              )}
              {prog.isPublic
                ? <span className="text-[10px] text-[#c9a96e] bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0"><Globe className="w-2.5 h-2.5" />Public</span>
                : <span className="text-[10px] text-white/30 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0"><Lock className="w-2.5 h-2.5" />Private</span>
              }
            </div>
            {prog.description && <p className="text-white/40 text-xs mb-2 line-clamp-1">{prog.description}</p>}
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-1 text-white/35 text-xs"><Calendar className="w-3 h-3" />{prog.weeks?.length ?? 0} wk</span>
              <span className="flex items-center gap-1 text-white/35 text-xs"><Zap className="w-3 h-3" />{totalExercises(prog)} exercises</span>
              {prog.goal && <span className="flex items-center gap-1 text-white/25 text-xs"><Star className="w-3 h-3" />{prog.goal}</span>}
              {prog.author && !isMine && (
                <span className="flex items-center gap-1 text-white/25 text-xs ml-auto">
                  {prog.author.avatar
                    ? <img src={prog.author.avatar} className="w-4 h-4 rounded-full object-cover" alt="" />
                    : <div className="w-4 h-4 rounded-full bg-[rgba(201,169,110,0.18)] flex items-center justify-center text-[8px] text-[#e8c98a]">{prog.author.name?.[0]}</div>
                  }
                  @{prog.author.username}
                </span>
              )}
            </div>
            {isActive && totalDays > 0 && (
              <div className="mt-2.5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-white/30">Progress</span>
                  <span className="text-[10px] text-green-400 font-medium">{pct}%</span>
                </div>
                <div className="h-1 bg-[rgba(201,169,110,0.06)] rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: pct + '%' }} />
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
            {isMine && (
              <button onClick={e => { e.stopPropagation(); setAsActive(prog); }}
                disabled={settingActive}
                className={'p-1.5 rounded-lg transition-all ' + (isActive ? 'text-green-400 bg-green-500/10' : 'text-white/30 hover:text-green-400 hover:bg-green-500/10')}
                title={isActive ? 'Active -- click to deactivate' : 'Set as active program'}>
                <Play className="w-3.5 h-3.5" />
              </button>
            )}
            {isMine && (
              <button onClick={e => { e.stopPropagation(); setEditing(prog); setExpandedWeek(0); }}
                className="p-1.5 rounded-lg text-white/30 hover:text-[#c9a96e] hover:bg-[rgba(201,169,110,0.08)] transition-all">
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button onClick={e => shareProgram(prog, e)}
              className="p-1.5 rounded-lg text-white/30 hover:text-blue-400 hover:bg-blue-500/10 transition-all">
              <Share2 className="w-3.5 h-3.5" />
            </button>
            {isMine && prog.id && (
              <button onClick={e => { e.stopPropagation(); deleteProgram(prog.id!); }}
                className="p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  const Skeleton = () => (
    <div className="animate-pulse bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-5">
      <div className="flex gap-3">
        <div className="w-10 h-10 rounded-xl bg-[rgba(201,169,110,0.04)]" />
        <div className="flex-1 space-y-2">
          <div className="h-3.5 bg-[rgba(201,169,110,0.06)] rounded w-40" />
          <div className="h-2.5 bg-[rgba(201,169,110,0.04)] rounded w-64" />
          <div className="flex gap-3 mt-1">
            <div className="h-2 bg-[rgba(201,169,110,0.04)] rounded w-12" />
            <div className="h-2 bg-[rgba(201,169,110,0.04)] rounded w-16" />
          </div>
        </div>
      </div>
    </div>
  );

  if (viewing) {
    const prog = viewing;
    const isMine = !prog.author || prog.author.username === currentUser?.username;
    const isActive = activeProgram?.programId === prog.id;
    const week = prog.weeks?.[viewWeek];

    // Progress tracking
    const totalDays = prog.weeks?.reduce((a, w) => a + w.days.length, 0) ?? 0;
    const completedDays = isActive
      ? (activeProgram!.currentWeek * (prog.weeks?.[0]?.days.length || 1)) + activeProgram!.currentDay
      : 0;
    const progressPct = totalDays > 0 ? Math.round((completedDays / totalDays) * 100) : 0;

    const isDayDone = (wIdx: number, dIdx: number) => {
      if (!isActive) return false;
      if (wIdx < activeProgram!.currentWeek) return true;
      if (wIdx === activeProgram!.currentWeek && dIdx < activeProgram!.currentDay) return true;
      return false;
    };
    const isDayToday = (wIdx: number, dIdx: number) =>
      isActive && wIdx === activeProgram!.currentWeek && dIdx === activeProgram!.currentDay;

    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <button onClick={() => setViewing(null)}
            className="w-8 h-8 rounded-xl bg-[rgba(201,169,110,0.04)] hover:bg-[rgba(201,169,110,0.08)] flex items-center justify-center text-white/50 hover:text-white transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-white font-bold text-lg flex-1 truncate">{prog.name}</h2>
          <div className="flex gap-1.5">
            {isMine && (
              <button onClick={() => { setViewing(null); setEditing(prog); setExpandedWeek(0); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/50 hover:text-[#e8c98a] hover:border-[rgba(201,169,110,0.25)] text-xs transition-all">
                <Edit2 className="w-3 h-3" /> Edit
              </button>
            )}
            <button onClick={e => shareProgram(prog, e)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/50 hover:text-blue-300 hover:border-blue-500/30 text-xs transition-all">
              <Share2 className="w-3 h-3" /> Share
            </button>
          </div>
        </div>

        {/* Program card */}
        <div className="bg-gradient-to-br from-[rgba(201,169,110,0.06)] via-[rgba(201,169,110,0.03)] to-[#080608] border border-[rgba(201,169,110,0.18)] rounded-2xl p-5">
          {prog.description && <p className="text-white/60 text-sm mb-4">{prog.description}</p>}
          <div className="flex items-center gap-4 flex-wrap mb-4">
            <div className="text-center">
              <div className="text-white font-bold text-xl">{prog.weeks?.length ?? 0}</div>
              <div className="text-white/35 text-xs mt-0.5 flex items-center gap-1"><Calendar className="w-3 h-3" />Weeks</div>
            </div>
            <div className="text-center">
              <div className="text-white font-bold text-xl">{prog.weeks?.reduce((a, w) => a + w.days.length, 0) ?? 0}</div>
              <div className="text-white/35 text-xs mt-0.5 flex items-center gap-1"><Clock className="w-3 h-3" />Days</div>
            </div>
            <div className="text-center">
              <div className="text-white font-bold text-xl">{totalExercises(prog)}</div>
              <div className="text-white/35 text-xs mt-0.5 flex items-center gap-1"><Zap className="w-3 h-3" />Exercises</div>
            </div>
            {prog.difficulty && (
              <div className={'text-xs px-2.5 py-1 rounded-full border capitalize ' + (DIFF_COLORS[prog.difficulty] || DIFF_COLORS.intermediate)}>
                {prog.difficulty}
              </div>
            )}
            {prog.goal && (
              <div className="text-xs px-2.5 py-1 rounded-full border border-emerald-500/20 text-emerald-400 bg-emerald-500/10">{prog.goal}</div>
            )}
          </div>
          {/* Progress bar — only shown when active */}
          {isActive && totalDays > 0 && (
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-white/40">Week {activeProgram!.currentWeek + 1} — Day {activeProgram!.currentDay + 1}</span>
                <span className="text-xs text-[#c9a96e]">{progressPct}%</span>
              </div>
              <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#c9a96e] to-[#a07840] rounded-full transition-all" style={{width: `${progressPct}%`}} />
              </div>
            </div>
          )}
        </div>

        {/* Start workout button */}
        {isActive && (
          <button
            onClick={advanceDay}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#c9a96e] to-[#a07840] text-white rounded-2xl py-3.5 font-medium text-sm transition-all hover:opacity-90 active:scale-[0.99]">
            <Play className="w-4 h-4 fill-white" />
            Start today — {prog.weeks?.[activeProgram!.currentWeek]?.days?.[activeProgram!.currentDay]?.dayName ?? 'Day ' + (activeProgram!.currentDay + 1)}
          </button>
        )}
        {!isActive && isMine && (
          <button
            onClick={() => setAsActive(prog)}
            disabled={settingActive}
            className="w-full flex items-center justify-center gap-2 border border-[rgba(201,169,110,0.3)] text-[#c9a96e] rounded-2xl py-3 font-medium text-sm transition-all hover:bg-[rgba(201,169,110,0.06)]">
            <Play className="w-4 h-4" /> Start this program
          </button>
        )}

        {/* Week tabs */}
        {(prog.weeks?.length ?? 0) > 0 && (
          <>
            <div className="flex gap-1.5 flex-wrap">
              {prog.weeks.map((w, i) => (
                <button key={i} onClick={() => setViewWeek(i)}
                  className={'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all ' + (
                    viewWeek === i
                      ? 'bg-gradient-to-r ' + WEEK_COLORS[i % WEEK_COLORS.length] + ' ' + WEEK_LABEL_COLORS[i % WEEK_LABEL_COLORS.length] + ' border'
                      : 'text-white/40 hover:text-white/70 border border-[rgba(201,169,110,0.07)] hover:border-[rgba(201,169,110,0.12)]'
                  )}>
                  <span className={'w-1.5 h-1.5 rounded-full ' + WEEK_DOT_COLORS[i % WEEK_DOT_COLORS.length]} />
                  Week {w.weekNumber}
                </button>
              ))}
            </div>

            {/* Days */}
            {week && (
              <div className="space-y-3">
                {week.days.map((day, dIdx) => {
                  const done  = isDayDone(viewWeek, dIdx);
                  const today = isDayToday(viewWeek, dIdx);
                  const exList = day.exercises.filter(ex => ex.name);
                  return (
                    <div key={dIdx} className={'rounded-2xl overflow-hidden border transition-all ' + (
                      today  ? 'border-[rgba(201,169,110,0.3)] bg-[rgba(201,169,110,0.04)]' :
                      done   ? 'border-white/5 bg-[rgba(255,255,255,0.01)]' :
                               'border-[rgba(201,169,110,0.07)] bg-[#080608]'
                    )}>
                      <div className="flex items-center gap-3 px-4 py-3">
                        {/* Status icon */}
                        {done ? (
                          <div className="w-7 h-7 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          </div>
                        ) : today ? (
                          <div className="w-7 h-7 rounded-full bg-[rgba(201,169,110,0.15)] border border-[rgba(201,169,110,0.4)] flex items-center justify-center shrink-0">
                            <Play className="w-3.5 h-3.5 text-[#c9a96e]" />
                          </div>
                        ) : (
                          <div className="w-7 h-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center shrink-0 text-white/30 text-xs font-medium">
                            {dIdx + 1}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className={'text-sm font-medium ' + (done ? 'line-through text-white/35' : today ? 'text-white' : 'text-white/70')}>
                            {day.dayName}
                          </p>
                          {exList.length > 0 && (
                            <p className="text-xs text-white/30 mt-0.5 truncate">
                              {exList.map(e => e.name).slice(0, 3).join(' · ')}
                              {exList.length > 3 && ' +' + (exList.length - 3) + ' more'}
                            </p>
                          )}
                        </div>
                        {done && <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full shrink-0">Done</span>}
                        {today && <span className="text-[10px] text-[#c9a96e] bg-[rgba(201,169,110,0.1)] px-2.5 py-1 rounded-full shrink-0">Today</span>}
                      </div>

                      {/* Exercise table — always visible */}
                      {exList.length > 0 && (
                        <div className={'border-t divide-y divide-white/5 ' + (today ? 'border-[rgba(201,169,110,0.1)]' : 'border-white/5')}>
                          <div className="grid grid-cols-[1fr_44px_60px_48px] gap-2 px-4 py-2 text-[10px] text-white/25 uppercase tracking-wider">
                            <span>Exercise</span><span className="text-center">Sets</span><span className="text-center">Reps</span><span className="text-center">Rest</span>
                          </div>
                          {exList.map((ex, eIdx) => (
                            <div key={eIdx} className="grid grid-cols-[1fr_44px_60px_48px] gap-2 px-4 py-2.5 items-center">
                              <span className={'text-sm font-medium ' + (done ? 'text-white/30' : 'text-white/85')}>{ex.name}</span>
                              <span className="text-white/45 text-xs text-center">{ex.sets}</span>
                              <span className="text-white/45 text-xs text-center">{ex.reps}</span>
                              <span className="text-white/45 text-xs text-center">{ex.rest}</span>
                            </div>
                          ))}
                          {day.exercises.some(ex => ex.notes) && (
                            <div className="px-4 py-2 text-white/30 text-xs italic">
                              {day.exercises.filter(ex => ex.notes).map(ex => ex.notes).join(' · ')}
                            </div>
                          )}
                        </div>
                      )}
                      {exList.length === 0 && (
                        <div className="px-4 pb-3 text-white/20 text-xs italic">Rest day</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  if (editing) return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setEditing(null)} className="w-8 h-8 rounded-xl bg-[rgba(201,169,110,0.04)] hover:bg-[rgba(201,169,110,0.08)] flex items-center justify-center text-white/50 hover:text-white transition-all">
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-white font-bold text-lg flex-1">{editing.id ? 'Edit Program' : 'New Program'}</h2>
        <button onClick={saveProgram} className="flex items-center gap-2 bg-gradient-to-r from-[#c9a96e] to-[#a07840] text-white px-4 py-2 rounded-xl text-sm font-medium transition-all shadow-lg shadow-[rgba(201,169,110,0.15)]">
          <Save className="w-4 h-4" /> Save
        </button>
      </div>

      <div className="bg-gradient-to-br from-[rgba(201,169,110,0.06)] to-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.18)] rounded-2xl p-4 space-y-3">
        <input
          value={editing.name}
          onChange={e => setField('name', e.target.value)}
          placeholder="Program name (e.g. Stronglifts 5x5)"
          className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-4 py-3 text-white placeholder:text-white/25 outline-none focus:border-[rgba(201,169,110,0.5)] text-sm"
        />
        <textarea
          value={editing.description}
          onChange={e => setField('description', e.target.value)}
          placeholder="Description -- goals, intensity, who it's for (optional)"
          rows={2}
          className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/25 outline-none focus:border-[rgba(201,169,110,0.5)] resize-none"
        />
        <div>
          <p className="text-white/40 text-xs mb-1.5">Difficulty</p>
          <div className="flex gap-2">
            {(['beginner', 'intermediate', 'advanced'] as const).map(d => (
              <button key={d} onClick={() => setField('difficulty', d)}
                className={'flex-1 py-1.5 rounded-xl text-xs font-medium border capitalize transition-all ' + (
                  editing.difficulty === d ? DIFF_COLORS[d] : 'border-[rgba(201,169,110,0.12)] text-white/40 hover:border-[rgba(201,169,110,0.2)]'
                )}>
                {d}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="text-white/40 text-xs mb-1.5">Goal</p>
          <select
            value={editing.goal || ''}
            onChange={e => setField('goal', e.target.value)}
            className="w-full bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white/80 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
          >
            <option value="">Select a goal (optional)</option>
            {GOAL_OPTIONS.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>
        <button
          onClick={() => setField('isPublic', !editing.isPublic)}
          className={'flex items-center gap-2 px-3 py-2 rounded-xl border text-sm transition-all ' + (editing.isPublic ? 'border-[rgba(201,169,110,0.5)] bg-[rgba(201,169,110,0.08)] text-[#e8c98a]' : 'border-[rgba(201,169,110,0.12)] bg-[rgba(201,169,110,0.03)] text-white/40 hover:text-white/60')}
        >
          {editing.isPublic ? <><Globe className="w-3.5 h-3.5" /> Public -- anyone can view</> : <><Lock className="w-3.5 h-3.5" /> Private -- only you</>}
        </button>
      </div>

      {editing.weeks.map((week, wIdx) => {
        const colorClass = WEEK_COLORS[wIdx % WEEK_COLORS.length];
        const labelColor = WEEK_LABEL_COLORS[wIdx % WEEK_LABEL_COLORS.length];
        return (
          <div key={wIdx} className={'bg-gradient-to-br ' + colorClass + ' border rounded-2xl overflow-hidden'}>
            <button
              onClick={() => setExpandedWeek(expandedWeek === wIdx ? -1 : wIdx)}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            >
              <div className={'text-xs font-bold uppercase tracking-wider ' + labelColor}>Week {week.weekNumber}</div>
              <span className="text-white/30 text-xs">{week.days.length} day{week.days.length !== 1 ? 's' : ''}</span>
              <span className="text-white/25 text-xs">&middot;</span>
              <span className="text-white/30 text-xs">{week.days.reduce((a, d) => a + d.exercises.length, 0)} exercises</span>
              <button
                onClick={e => { e.stopPropagation(); copyWeek(wIdx); toast.success('Week duplicated!'); }}
                className="ml-auto mr-1 p-1 rounded-lg text-white/20 hover:text-[#c9a96e] hover:bg-[rgba(201,169,110,0.08)] transition-all"
                title="Duplicate week"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <span className="text-white/40">{expandedWeek === wIdx ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}</span>
            </button>

            {expandedWeek === wIdx && (
              <div className="border-t border-[rgba(201,169,110,0.07)] p-4 space-y-5 bg-black/20">
                {week.days.map((day, dIdx) => (
                  <div key={dIdx} className="space-y-2.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={day.dayName}
                        onChange={e => updateDay(wIdx, dIdx, 'dayName', e.target.value)}
                        className="flex-1 bg-transparent border-b border-[rgba(201,169,110,0.12)] text-white/80 text-sm font-semibold pb-1.5 outline-none focus:border-[rgba(201,169,110,0.45)]"
                      />
                      <button
                        onClick={() => { copyDay(wIdx, dIdx); toast.success('Day duplicated!'); }}
                        className="p-1 rounded-lg text-white/20 hover:text-blue-400 hover:bg-blue-500/10 transition-all shrink-0"
                        title="Duplicate day"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-[1fr_44px_60px_52px_24px] gap-1.5 text-[10px] text-white/25 uppercase tracking-wider px-1">
                        <span>Exercise</span><span className="text-center">Sets</span><span className="text-center">Reps</span><span className="text-center">Rest</span><span />
                      </div>
                      {day.exercises.map((ex, eIdx) => (
                        <div key={eIdx} className="grid grid-cols-[1fr_44px_60px_52px_24px] gap-1.5 items-center group">
                          <input value={ex.name} onChange={e => updateExercise(wIdx, dIdx, eIdx, 'name', e.target.value)}
                            placeholder="Exercise name"
                            className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-2.5 py-1.5 text-white text-xs placeholder:text-white/20 outline-none focus:border-[#c9a96e]/40"
                          />
                          <input type="number" value={ex.sets} onChange={e => updateExercise(wIdx, dIdx, eIdx, 'sets', +e.target.value)}
                            className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-1.5 py-1.5 text-white text-xs text-center outline-none focus:border-[#c9a96e]/40"
                          />
                          <input value={ex.reps} placeholder="8-12" onChange={e => updateExercise(wIdx, dIdx, eIdx, 'reps', e.target.value)}
                            className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-1.5 py-1.5 text-white text-xs text-center outline-none focus:border-[#c9a96e]/40"
                          />
                          <input value={ex.rest} placeholder="90s" onChange={e => updateExercise(wIdx, dIdx, eIdx, 'rest', e.target.value)}
                            className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-1.5 py-1.5 text-white text-xs text-center outline-none focus:border-[#c9a96e]/40"
                          />
                          <button onClick={() => removeExercise(wIdx, dIdx, eIdx)}
                            className="opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all flex items-center justify-center">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <button onClick={() => addExercise(wIdx, dIdx)} className="flex items-center gap-1 text-white/25 hover:text-[#c9a96e] text-xs mt-1 transition-colors">
                        <Plus className="w-3 h-3" /> Add exercise
                      </button>
                    </div>
                  </div>
                ))}
                <button onClick={() => addDay(wIdx)} className="flex items-center gap-1.5 text-white/30 hover:text-[#e8c98a] text-xs py-1.5 transition-colors border-t border-[rgba(201,169,110,0.07)] pt-3 w-full">
                  <Plus className="w-3.5 h-3.5" /> Add training day
                </button>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={addWeek} className="w-full py-4 rounded-2xl border border-dashed border-[rgba(201,169,110,0.12)] text-white/30 hover:text-[#c9a96e] hover:border-[rgba(201,169,110,0.25)] text-sm flex items-center justify-center gap-2 transition-all hover:bg-[rgba(201,169,110,0.04)]">
        <Plus className="w-4 h-4" /> Add Week
      </button>
    </div>
  );

  const totalWeeks = myPrograms.reduce((a, p) => a + (p.weeks?.length ?? 0), 0);
  const totalExs   = myPrograms.reduce((a, p) => a + totalExercises(p), 0);

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      <div className="bg-gradient-to-br from-[rgba(201,169,110,0.06)] via-[rgba(201,169,110,0.03)] to-[#080608] border border-[rgba(201,169,110,0.18)] rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-[rgba(201,169,110,0.12)] border border-[rgba(201,169,110,0.25)] flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-[#c9a96e]" />
              </div>
              <h2 className="text-white font-bold text-xl">Programs</h2>
            </div>
            <p className="text-white/40 text-sm">Build structured training plans week by week</p>
          </div>
          <button onClick={startNew} className="flex items-center gap-1.5 bg-gradient-to-r from-[#c9a96e] to-[#a07840] text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-[rgba(201,169,110,0.2)] shrink-0">
            <Plus className="w-4 h-4" /> New Program
          </button>
        </div>
        {myPrograms.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-[rgba(201,169,110,0.07)]">
            <div className="text-center">
              <div className="text-white font-bold text-xl">{myPrograms.length}</div>
              <div className="text-white/35 text-xs mt-0.5 flex items-center justify-center gap-1"><Layers className="w-3 h-3" />Programs</div>
            </div>
            <div className="text-center">
              <div className="text-white font-bold text-xl">{totalWeeks}</div>
              <div className="text-white/35 text-xs mt-0.5 flex items-center justify-center gap-1"><Calendar className="w-3 h-3" />Weeks</div>
            </div>
            <div className="text-center">
              <div className="text-white font-bold text-xl">{totalExs}</div>
              <div className="text-white/35 text-xs mt-0.5 flex items-center justify-center gap-1"><Zap className="w-3 h-3" />Exercises</div>
            </div>
          </div>
        )}
      </div>

      {activeProgram && (() => {
        const prog = myPrograms.find(p => p.id === activeProgram.programId);
        if (!prog) return null;
        const week = prog.weeks[activeProgram.currentWeek];
        const day  = week?.days[activeProgram.currentDay];
        const totalDays = prog.weeks.reduce((a, w) => a + w.days.length, 0);
        const doneDays  = prog.weeks.slice(0, activeProgram.currentWeek).reduce((a, w) => a + w.days.length, 0) + activeProgram.currentDay;
        const pct = Math.round((doneDays / totalDays) * 100);
        const todayExs = day?.exercises.filter((e: any) => e.name) || [];
        return (
          <div className="bg-gradient-to-br from-green-500/15 via-emerald-500/10 to-[#080608] border border-green-500/20 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-400" />
                <span className="text-green-300 font-semibold text-sm">Active: {activeProgram.programName}</span>
              </div>
              <button onClick={() => setViewing(prog)} className="text-white/30 hover:text-white/70 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            {day && (
              <p className="text-white/50 text-xs mb-2">
                Week {activeProgram.currentWeek + 1} &middot; {day.dayName}
              </p>
            )}
            {todayExs.length > 0 && (
              <div className="mb-3 space-y-1">
                {todayExs.slice(0, 4).map((ex: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-white/50">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500/60 shrink-0" />
                    <span className="font-medium text-white/70">{ex.name}</span>
                    <span className="text-white/30">{ex.sets}x{ex.reps}</span>
                  </div>
                ))}
                {todayExs.length > 4 && (
                  <p className="text-white/25 text-[10px] pl-3.5">+{todayExs.length - 4} more exercises</p>
                )}
              </div>
            )}
            <div className="flex items-center gap-3 mb-1">
              <div className="flex-1 h-1.5 bg-[rgba(201,169,110,0.06)] rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: pct + '%' }} />
              </div>
              <span className="text-white/35 text-xs shrink-0">{pct}%</span>
            </div>
            <div className="flex gap-2 mt-3">
              <button onClick={() => { setViewing(prog); setViewWeek(activeProgram.currentWeek); }}
                className="flex-1 py-2 rounded-xl bg-green-500/15 hover:bg-green-500/25 text-green-300 text-xs font-semibold transition-all flex items-center justify-center gap-1.5">
                <Play className="w-3 h-3" /> View today's workout
              </button>
              <button onClick={advanceDay}
                className="px-3 py-2 rounded-xl bg-[rgba(201,169,110,0.04)] hover:bg-[rgba(201,169,110,0.08)] text-white/40 hover:text-white/70 text-xs transition-all">
                Next day &rarr;
              </button>
            </div>
          </div>
        );
      })()}

      <div className="flex gap-1.5">
        {(['mine', 'browse'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ' + (
              tab === t
                ? 'bg-[#c9a96e]/15 text-[#e8c98a] border border-[#c9a96e]/25'
                : 'text-white/40 hover:text-white/70 border border-transparent'
            )}>
            {t === 'mine' ? <><Layers className="w-3.5 h-3.5" /> My Programs</> : <><Users className="w-3.5 h-3.5" /> Browse Public</>}
          </button>
        ))}
      </div>

      {tab === 'browse' && (
        <div className="flex flex-wrap gap-2 items-center">
          <Filter className="w-3.5 h-3.5 text-white/25 shrink-0" />
          {(['', 'beginner', 'intermediate', 'advanced'] as const).map(d => (
            <button key={d} onClick={() => setBrowseDiff(d)}
              className={'px-2.5 py-1 rounded-full text-[11px] border capitalize transition-all ' + (
                browseDiff === d
                  ? (d ? DIFF_COLORS[d] : 'border-[rgba(201,169,110,0.45)] bg-[rgba(201,169,110,0.12)] text-[#e8c98a]')
                  : 'border-[rgba(201,169,110,0.12)] text-white/40 hover:border-[rgba(201,169,110,0.2)]'
              )}>
              {d || 'All levels'}
            </button>
          ))}
          <div className="w-px h-4 bg-[rgba(201,169,110,0.12)]" />
          {([0, 4, 8, 12] as const).map(w => (
            <button key={w} onClick={() => setBrowseWeeks(w)}
              className={'px-2.5 py-1 rounded-full text-[11px] border transition-all ' + (
                browseWeeks === w
                  ? 'border-[rgba(201,169,110,0.45)] bg-[rgba(201,169,110,0.12)] text-[#e8c98a]'
                  : 'border-[rgba(201,169,110,0.12)] text-white/40 hover:border-[rgba(201,169,110,0.2)]'
              )}>
              {w === 0 ? 'Any length' : w + '+ wks'}
            </button>
          ))}
        </div>
      )}

      {tab === 'mine' ? (
        loading ? (
          <div className="space-y-3"><Skeleton /><Skeleton /><Skeleton /></div>
        ) : myPrograms.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[rgba(201,169,110,0.08)] to-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.18)] flex items-center justify-center mb-4">
              <Dumbbell className="w-7 h-7 text-[#c9a96e]" />
            </div>
            <p className="text-white font-semibold mb-1">No programs yet</p>
            <p className="text-white/35 text-sm max-w-xs mb-5">Create your first training program to organize workouts week by week.</p>
            <button onClick={startNew} className="flex items-center gap-2 bg-gradient-to-r from-[#c9a96e] to-[#a07840] text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-all shadow-lg shadow-[rgba(201,169,110,0.2)]">
              <Plus className="w-4 h-4" /> Create your first program
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {myPrograms.map((p, i) => <ProgramCard key={p.id ?? i} prog={p} isMine />)}
          </div>
        )
      ) : (
        <div className="space-y-3">
          {filteredPublic.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.07)] flex items-center justify-center mb-3">
                <Users className="w-6 h-6 text-white/20" />
              </div>
              <p className="text-white/40 text-sm">No programs match your filters</p>
              <p className="text-white/25 text-xs mt-1">Try adjusting the filters above</p>
            </div>
          ) : filteredPublic.map((p, i) => (
            <ProgramCard key={p.id ?? i} prog={p} isMine={p.author?.username === currentUser?.username} />
          ))}
        </div>
      )}
    </div>
  );
}
