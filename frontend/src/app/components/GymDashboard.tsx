// GymDashboard.tsx — Full gym owner dashboard
// Core tabs: Overview · Members · Classes · Check-in · Announcements · Settings
// Pro tabs:  Billing · Revenue · Trainers · Equipment · Challenges · Progress
//            Passes · Messages · Nutrition · Contracts · Branches · Staff
import { useState, useEffect } from 'react';
import {
  Building2, Users, Calendar, QrCode, Megaphone, Settings2,
  TrendingUp, UserCheck, Plus, Trash2, CheckCircle2,
  Loader2, MapPin, Save, LogOut,
  CreditCard, BarChart2, Wrench, Trophy, Activity, Ticket,
  MessageSquare, Leaf, FileText, GitBranch, Shield,
  DollarSign, AlertCircle, RefreshCw, UserPlus, Check, X,
} from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';

import { API } from '../../config';
const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const CLASS_TYPES = ['General','Yoga','HIIT','Spinning','Boxing','Pilates','CrossFit','Zumba','Strength','Stretching'];

// ── Types ────────────────────────────────────────────────────────────────────
interface GymProfile {
  id: string; gymName: string; address: string; city: string; country: string;
  phone: string; website: string; description: string; logoUrl: string;
  amenities: string[]; memberCount: number; rating: number; ratingCount: number;
}
interface Member { id: string; name: string; photoUrl: string; plan: string; status: string; joinedAt: string; expiresAt: string; }
interface GymClass { id: string; name: string; instructor: string; dayOfWeek: number; startTime: string; endTime: string; capacity: number; enrolled: number; type: string; }
interface Checkin { id: string; name: string; photoUrl: string; checkedInAt: string; }
interface Stats { memberCount: number; checkinsToday: number; checkinsThisWeek: number; dailyCheckins: { date: string; count: number }[]; classCount: number; newMembersThisMonth: number; }

type TabId = 'overview'|'members'|'classes'|'checkin'|'announce'|'settings'|
             'billing'|'revenue'|'trainers'|'equipment'|'challenges'|'progress'|
             'passes'|'messages'|'nutrition'|'contracts'|'branches'|'staff';

interface Props { gymId: string; onSignOut?: () => void; onBack?: () => void; }

// ── Shared helpers ────────────────────────────────────────────────────────────
function inp(extra = '') {
  return `w-full bg-[rgba(240,235,227,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.35)] transition-all ${extra}`;
}
function sel(extra = '') {
  return `w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.35)] transition-all ${extra}`;
}
function PurpleBtn({ onClick, disabled, children }: { onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled}
      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#c9a96e] hover:bg-[#b8945a] text-white text-sm font-medium disabled:opacity-40 transition-all">
      {children}
    </button>
  );
}
function GhostBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick}
      className="px-4 py-2 rounded-xl bg-[rgba(240,235,227,0.04)] text-white/40 text-sm hover:text-white hover:bg-[rgba(201,169,110,0.08)] transition-all">
      {children}
    </button>
  );
}
function EmptyState({ icon: Icon, text }: { icon: any; text: string }) {
  return (
    <div className="text-center py-16 text-white/30">
      <Icon className="w-10 h-10 mx-auto mb-3 opacity-40" />
      <p>{text}</p>
    </div>
  );
}
function FormBox({ children }: { children: React.ReactNode }) {
  return <div className="bg-[#c9a96e]/5 border border-[rgba(201,169,110,0.18)] rounded-2xl p-5 mb-6 space-y-4">{children}</div>;
}
function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3">{children}</div>;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="text-xs text-white/40 mb-1 block">{label}</label>{children}</div>;
}
function Card({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(240,235,227,0.03)] border border-[rgba(201,169,110,0.09)] hover:bg-[rgba(240,235,227,0.04)] transition-all">{children}</div>;
}
function SectionHeader({ title, sub, action }: { title: string; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div>
        <h2 className="text-xl font-bold">{title}</h2>
        {sub && <p className="text-white/40 text-sm">{sub}</p>}
      </div>
      {action}
    </div>
  );
}
function StatCard({ label, value, sub, color = 'purple' }: { label: string; value: string | number; sub?: string; color?: string }) {
  const colors: Record<string,string> = {
    purple: 'bg-[rgba(201,169,110,0.09)] border-[rgba(201,169,110,0.18)] text-[#c9a96e]',
    emerald: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
    amber: 'bg-amber-500/10 border-amber-500/20 text-amber-400',
    sky: 'bg-sky-500/10 border-sky-500/20 text-sky-400',
    red: 'bg-red-500/10 border-red-500/20 text-red-400',
  };
  return (
    <div className={`rounded-2xl border p-5 ${colors[color] || colors.purple}`}>
      <p className="text-xs text-white/40 mb-1">{label}</p>
      <p className="text-3xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-white/30 mt-1">{sub}</p>}
    </div>
  );
}

// ── Main Dashboard ────────────────────────────────────────────────────────────
export function GymDashboard({ gymId, onSignOut, onBack }: Props) {
  const [tab, setTab] = useState<TabId>('overview');
  const [gym, setGym]         = useState<GymProfile | null>(null);
  const [stats, setStats]     = useState<Stats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [classes, setClasses] = useState<GymClass[]>([]);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadGym(); loadStats(); }, [gymId]);
  useEffect(() => { if (tab === 'members')  loadMembers();  }, [tab]);
  useEffect(() => { if (tab === 'classes')  loadClasses();  }, [tab]);
  useEffect(() => { if (tab === 'checkin')  loadCheckins(); }, [tab]);

  const loadGym = async () => {
    try { const r = await authFetch(`${API}/gyms/${gymId}`); if (r.ok) setGym(await r.json()); }
    catch {} finally { setLoading(false); }
  };
  const loadStats    = async () => { try { const r = await authFetch(`${API}/gyms/${gymId}/stats`); if (r.ok) setStats(await r.json()); } catch {} };
  const loadMembers  = async () => { const r = await authFetch(`${API}/gyms/${gymId}/members`); if (r.ok) setMembers(await r.json()); };
  const loadClasses  = async () => { const r = await authFetch(`${API}/gyms/${gymId}/classes`); if (r.ok) setClasses(await r.json()); };
  const loadCheckins = async () => { const r = await authFetch(`${API}/gyms/${gymId}/checkins`); if (r.ok) setCheckins(await r.json()); };

  if (loading) return (
    <div className="min-h-screen bg-[#080608] flex items-center justify-center">
      <Loader2 className="w-8 h-8 text-[#c9a96e] animate-spin" />
    </div>
  );

  const coreTabs = [
    { id: 'overview', label: 'Overview',      icon: TrendingUp },
    { id: 'members',  label: 'Members',       icon: Users },
    { id: 'classes',  label: 'Classes',       icon: Calendar },
    { id: 'checkin',  label: 'Check-in',      icon: QrCode },
    { id: 'announce', label: 'Announcements', icon: Megaphone },
    { id: 'settings', label: 'Settings',      icon: Settings2 },
  ] as const;

  const proTabs = [
    { id: 'billing',    label: 'Billing',     icon: CreditCard },
    { id: 'revenue',    label: 'Revenue',     icon: BarChart2 },
    { id: 'trainers',   label: 'Trainers',    icon: UserCheck },
    { id: 'equipment',  label: 'Equipment',   icon: Wrench },
    { id: 'challenges', label: 'Challenges',  icon: Trophy },
    { id: 'progress',   label: 'Progress',    icon: Activity },
    { id: 'passes',     label: 'Day Passes',  icon: Ticket },
    { id: 'messages',   label: 'Messages',    icon: MessageSquare },
    { id: 'nutrition',  label: 'Nutrition',   icon: Leaf },
    { id: 'contracts',  label: 'Contracts',   icon: FileText },
    { id: 'branches',   label: 'Branches',    icon: GitBranch },
    { id: 'staff',      label: 'Staff',       icon: Shield },
  ] as const;

  const navItem = (id: TabId, label: string, Icon: any) => (
    <button key={id} onClick={() => setTab(id)}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all text-left ${
        tab === id
          ? 'bg-[#c9a96e]/20 text-[#e8c98a] font-medium'
          : 'text-white/40 hover:text-white hover:bg-[rgba(240,235,227,0.04)]'
      }`}>
      <Icon className={`w-4 h-4 shrink-0 ${tab === id ? 'text-[#c9a96e]' : ''}`} />
      <span>{label}</span>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#080608] text-white flex">

      {/* ── Left Sidebar ── */}
      <aside className="w-56 shrink-0 flex flex-col h-screen sticky top-0 overflow-y-auto" style={{background:"#0d0b08",borderRight:"0.5px solid rgba(201,169,110,0.12)"}}>

        {/* Gym identity */}
        <div className="px-4 py-5 border-b border-[rgba(201,169,110,0.08)]">
          {/* Logo mark */}
          <div className="flex flex-col items-center mb-4">
            <div style={{
              width: 56, height: 56, borderRadius: 14, flexShrink: 0,
              background: gym?.logoUrl ? 'transparent' : 'linear-gradient(135deg, #1a1508 0%, #2a1f08 50%, #1a1508 100%)',
              border: '0.5px solid rgba(201,169,110,0.35)',
              boxShadow: '0 0 24px rgba(201,169,110,0.18), inset 0 1px 0 rgba(232,201,138,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative', overflow: 'hidden',
            }}>
              {gym?.logoUrl ? (
                <img src={gym.logoUrl} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 14 }} alt="" />
              ) : (
                <>
                  {/* Gold shimmer line */}
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, height: '0.5px',
                    background: 'linear-gradient(90deg, transparent, rgba(232,201,138,0.6), transparent)',
                  }} />
                  {/* Dumbbell icon */}
                  <svg width="30" height="30" viewBox="0 0 30 30" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <rect x="3" y="13" width="5" height="4" rx="1.5" fill="#c9a96e" opacity="0.9"/>
                    <rect x="22" y="13" width="5" height="4" rx="1.5" fill="#c9a96e" opacity="0.9"/>
                    <rect x="6" y="11" width="3" height="8" rx="1.5" fill="#e8c98a"/>
                    <rect x="21" y="11" width="3" height="8" rx="1.5" fill="#e8c98a"/>
                    <rect x="9" y="14" width="12" height="2" rx="1" fill="#c9a96e"/>
                  </svg>
                </>
              )}
            </div>
            <div className="mt-3 text-center min-w-0 w-full">
              <p style={{ fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: 'rgba(201,169,110,0.85)', fontWeight: 400, marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {gym?.gymName || 'My Gym'}
              </p>
              <p style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,235,227,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                <MapPin style={{ width: 8, height: 8 }} />{gym?.city || 'Location'}
              </p>
            </div>
          </div>
          {/* quick stats */}
          <div className="grid grid-cols-2 gap-2">
            <div style={{ background: 'rgba(201,169,110,0.06)', border: '0.5px solid rgba(201,169,110,0.12)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
              <p style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,235,227,0.25)', marginBottom: 2 }}>Members</p>
              <p style={{ fontSize: 15, fontWeight: 300, color: '#e8c98a' }}>{gym?.memberCount ?? 0}</p>
            </div>
            <div style={{ background: 'rgba(201,169,110,0.06)', border: '0.5px solid rgba(201,169,110,0.12)', borderRadius: 8, padding: '6px 8px', textAlign: 'center' }}>
              <p style={{ fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', color: 'rgba(240,235,227,0.25)', marginBottom: 2 }}>Rating</p>
              <p style={{ fontSize: 15, fontWeight: 300, color: '#e8c98a' }}>{gym?.rating ? `${gym.rating}★` : '—'}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          {/* Core */}
          <p className="text-[10px] text-white/20 uppercase tracking-widest font-semibold px-3 mb-2">Core</p>
          {coreTabs.map(t => navItem(t.id as TabId, t.label, t.icon))}

          {/* Pro */}
          <div className="pt-4 pb-1">
            <p className="text-[10px] text-[#c9a96e]/50 uppercase tracking-widest font-semibold px-3 mb-2 flex items-center gap-1.5">
              <span className="px-1.5 py-0.5 rounded bg-[rgba(201,169,110,0.12)] text-[#c9a96e] text-[9px] font-bold">PRO</span>
              Systems
            </p>
          </div>
          {proTabs.map(t => navItem(t.id as TabId, t.label, t.icon))}
        </nav>

        {/* Back to app + Sign out */}
        <div className="px-3 pb-4 border-t border-[rgba(201,169,110,0.08)] pt-3 space-y-0.5">
          {onBack && (
            <button onClick={onBack}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-[#c9a96e]/60 hover:text-[#c9a96e] hover:bg-[rgba(201,169,110,0.06)] transition-all">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M8.5 2.5L4 7l4.5 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>
              Back to Flex App
            </button>
          )}
          {onSignOut && (
            <button onClick={onSignOut}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-white/30 hover:text-white hover:bg-[rgba(240,235,227,0.04)] transition-all">
              <LogOut className="w-4 h-4" /> Sign out
            </button>
          )}
        </div>
      </aside>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          {tab === 'overview'    && <OverviewTab stats={stats} gym={gym} />}
          {tab === 'members'     && <MembersTab members={members} gymId={gymId} onRefresh={loadMembers} />}
          {tab === 'classes'     && <ClassesTab classes={classes} gymId={gymId} onRefresh={loadClasses} />}
          {tab === 'checkin'     && <CheckinTab checkins={checkins} gymId={gymId} onRefresh={loadCheckins} />}
          {tab === 'announce'    && <AnnouncementsTab gymId={gymId} />}
          {tab === 'settings'    && gym && <GymSettingsTab gym={gym} gymId={gymId} onSaved={loadGym} />}
          {tab === 'billing'     && <BillingTab gymId={gymId} />}
          {tab === 'revenue'     && <RevenueTab gymId={gymId} />}
          {tab === 'trainers'    && <TrainersTab gymId={gymId} />}
          {tab === 'equipment'   && <EquipmentTab gymId={gymId} />}
          {tab === 'challenges'  && <ChallengesTab gymId={gymId} />}
          {tab === 'progress'    && <ProgressTab gymId={gymId} members={members} onLoadMembers={loadMembers} />}
          {tab === 'passes'      && <PassesTab gymId={gymId} />}
          {tab === 'messages'    && <MessagesTab gymId={gymId} members={members} onLoadMembers={loadMembers} />}
          {tab === 'nutrition'   && <NutritionTab gymId={gymId} />}
          {tab === 'contracts'   && <ContractsTab gymId={gymId} />}
          {tab === 'branches'    && <BranchesTab gymId={gymId} />}
          {tab === 'staff'       && <StaffTab gymId={gymId} />}
        </div>
      </main>

    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CORE TABS (unchanged originals)
// ─────────────────────────────────────────────────────────────────────────────
function OverviewTab({ stats, gym }: { stats: Stats | null; gym: GymProfile | null }) {
  const max = Math.max(...(stats?.dailyCheckins.map(d => d.count) || [1]), 1);
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatCard label="Total members"         value={stats?.memberCount ?? 0}         color="purple" />
        <StatCard label="Check-ins today"       value={stats?.checkinsToday ?? 0}        color="emerald" />
        <StatCard label="Check-ins this week"   value={stats?.checkinsThisWeek ?? 0}    color="sky" />
        <StatCard label="Active classes"        value={stats?.classCount ?? 0}           color="amber" />
        <StatCard label="New members / month"   value={stats?.newMembersThisMonth ?? 0} color="purple" />
        <StatCard label="Rating" value={gym?.rating ? `${gym.rating}/5` : '—'} sub={`${gym?.ratingCount ?? 0} reviews`} color="amber" />
      </div>
      <div className="bg-[rgba(240,235,227,0.03)] border border-[rgba(201,169,110,0.09)] rounded-2xl p-6">
        <h3 className="text-sm font-medium text-white/60 mb-5">Check-ins — last 7 days</h3>
        <div className="flex items-end gap-2 h-28">
          {(stats?.dailyCheckins || []).map(d => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-xs text-white/30">{d.count}</span>
              <div className="w-full rounded-t-lg bg-[#c9a96e]/60 transition-all" style={{ height: `${Math.max(4, (d.count / max) * 96)}px` }} />
              <span className="text-[10px] text-white/20">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </div>
      {gym?.amenities?.length ? (
        <div className="bg-[rgba(240,235,227,0.03)] border border-[rgba(201,169,110,0.09)] rounded-2xl p-6">
          <h3 className="text-sm font-medium text-white/60 mb-4">Amenities</h3>
          <div className="flex flex-wrap gap-2">
            {gym.amenities.map(a => <span key={a} className="px-3 py-1 rounded-full bg-[rgba(201,169,110,0.09)] border border-[rgba(201,169,110,0.18)] text-[#e8c98a] text-xs">{a}</span>)}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MembersTab({ members, gymId, onRefresh }: { members: Member[]; gymId: string; onRefresh: () => void }) {
  const [removing, setRemoving] = useState<string|null>(null);
  const removeMember = async (id: string) => {
    setRemoving(id);
    try {
      const r = await authFetch(`${API}/gyms/${gymId}/members/${id}`, { method: 'DELETE' });
      if (r.ok) { toast.success('Member removed'); onRefresh(); } else toast.error('Failed');
    } finally { setRemoving(null); }
  };
  const active = members.filter(m => m.status === 'active');
  return (
    <div>
      <SectionHeader title="Members" sub={`${active.length} active · ${members.length - active.length} inactive`} />
      <div className="space-y-2">
        {members.length === 0 && <EmptyState icon={Users} text="No members yet" />}
        {members.map(m => (
          <Card key={m.id}>
            {m.photoUrl ? <img src={m.photoUrl} className="w-9 h-9 rounded-full object-cover" alt="" /> : <div className="w-9 h-9 rounded-full bg-[#c9a96e]/20 flex items-center justify-center text-[#e8c98a] text-sm font-bold">{m.name?.[0]||'?'}</div>}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{m.name}</p>
              <p className="text-xs text-white/30">{m.plan === 'yearly' ? 'Yearly' : 'Monthly'} · expires {m.expiresAt?.slice(0,10)}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${m.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[rgba(240,235,227,0.04)] text-white/30'}`}>{m.status}</span>
            <button onClick={() => removeMember(m.id)} disabled={removing === m.id} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all">
              {removing === m.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ClassesTab({ classes, gymId, onRefresh }: { classes: GymClass[]; gymId: string; onRefresh: () => void }) {
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(''); const [instructor, setInstructor] = useState('');
  const [day, setDay] = useState(0); const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('08:00'); const [capacity, setCapacity] = useState(20);
  const [type, setType] = useState('General');
  const save = async () => {
    if (!name) return toast.error('Class name required');
    setSaving(true);
    try {
      const r = await authFetch(`${API}/gyms/${gymId}/classes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, instructor, dayOfWeek: day, startTime, endTime, capacity, type }) });
      if (r.ok) { toast.success('Class added!'); setShow(false); setName(''); onRefresh(); }
      else { const e = await r.json().catch(() => ({})); toast.error(e.error || 'Failed'); }
    } finally { setSaving(false); }
  };
  const del = async (id: string) => { const r = await authFetch(`${API}/gyms/${gymId}/classes/${id}`, { method: 'DELETE' }); if (r.ok) { toast.success('Deleted'); onRefresh(); } };
  const byDay = DAYS.map((_, i) => classes.filter(c => c.dayOfWeek === i));
  return (
    <div>
      <SectionHeader title="Classes & Schedule" sub={`${classes.length} classes`}
        action={<PurpleBtn onClick={() => setShow(s => !s)}><Plus className="w-4 h-4" /> Add class</PurpleBtn>} />
      {show && (
        <FormBox>
          <h3 className="text-sm font-semibold text-[#e8c98a]">New class</h3>
          <Row>
            <Field label="Class name *"><input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Morning Yoga" className={inp()} /></Field>
            <Field label="Instructor"><input value={instructor} onChange={e => setInstructor(e.target.value)} placeholder="Name" className={inp()} /></Field>
            <Field label="Day"><select value={day} onChange={e => setDay(Number(e.target.value))} className={sel()}>{DAYS.map((d,i) => <option key={d} value={i}>{d}</option>)}</select></Field>
            <Field label="Type"><select value={type} onChange={e => setType(e.target.value)} className={sel()}>{CLASS_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></Field>
            <Field label="Start time"><input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className={inp()} /></Field>
            <Field label="End time"><input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className={inp()} /></Field>
            <Field label="Capacity"><input type="number" min={1} max={500} value={capacity} onChange={e => setCapacity(Number(e.target.value))} className={inp()} /></Field>
          </Row>
          <div className="flex gap-2">
            <PurpleBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}{saving ? 'Saving…' : 'Save'}</PurpleBtn>
            <GhostBtn onClick={() => setShow(false)}>Cancel</GhostBtn>
          </div>
        </FormBox>
      )}
      <div className="space-y-4">
        {classes.length === 0 && <EmptyState icon={Calendar} text="No classes yet — add your first one!" />}
        {DAYS.map((d, i) => byDay[i].length > 0 && (
          <div key={d}>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wider mb-2">{d}</p>
            <div className="space-y-2">
              {byDay[i].map(c => (
                <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl bg-[rgba(240,235,227,0.03)] border border-[rgba(201,169,110,0.09)]">
                  <div className="w-1 h-10 rounded-full bg-[#c9a96e]/60 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.name} <span className="text-white/30 text-xs ml-1">{c.type}</span></p>
                    <p className="text-xs text-white/30">{c.startTime} – {c.endTime} · {c.instructor || 'No instructor'}</p>
                  </div>
                  <div className="text-right"><p className="text-sm font-medium">{c.enrolled}/{c.capacity}</p><p className="text-xs text-white/30">spots</p></div>
                  <button onClick={() => del(c.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CheckinTab({ checkins, gymId, onRefresh }: { checkins: Checkin[]; gymId: string; onRefresh: () => void }) {
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(`flex://checkin/${gymId}`)}`;
  return (
    <div className="space-y-8">
      <div className="bg-[rgba(240,235,227,0.03)] border border-[rgba(201,169,110,0.09)] rounded-2xl p-6 flex flex-col md:flex-row items-center gap-6">
        <div className="bg-white p-3 rounded-2xl shrink-0"><img src={qrUrl} alt="QR" className="w-40 h-40" /></div>
        <div>
          <h2 className="text-xl font-bold mb-1">Check-in QR code</h2>
          <p className="text-white/40 text-sm mb-4">Print and display at your entrance. Members scan with Flex app.</p>
          <div className="flex gap-2">
            <a href={qrUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#c9a96e] hover:bg-[#b8945a] text-white text-sm font-medium transition-all">Download QR</a>
            <button onClick={onRefresh} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[rgba(240,235,227,0.04)] border border-[rgba(201,169,110,0.12)] text-white/50 text-sm hover:text-white hover:bg-[rgba(201,169,110,0.08)] transition-all"><RefreshCw className="w-3.5 h-3.5" /> Refresh</button>
          </div>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-white/50 uppercase tracking-wider mb-4">Recent check-ins</h3>
        <div className="space-y-2">
          {checkins.length === 0 && <EmptyState icon={QrCode} text="No check-ins yet today" />}
          {checkins.map(c => (
            <Card key={c.id}>
              {c.photoUrl ? <img src={c.photoUrl} className="w-8 h-8 rounded-full object-cover" alt="" /> : <div className="w-8 h-8 rounded-full bg-[#c9a96e]/20 flex items-center justify-center text-[#e8c98a] text-xs font-bold">{c.name?.[0]||'?'}</div>}
              <p className="flex-1 text-sm font-medium truncate">{c.name}</p>
              <p className="text-xs text-white/30">{new Date(c.checkedInAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</p>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function AnnouncementsTab({ gymId }: { gymId: string }) {
  const [text, setText] = useState('');
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  useEffect(() => { authFetch(`${API}/gyms/${gymId}/announcements`).then(r => r.json()).then(setItems).catch(() => {}); }, [gymId]);
  const post = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const r = await authFetch(`${API}/gyms/${gymId}/announcements`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      if (r.ok) { toast.success('Posted!'); setText(''); const r2 = await authFetch(`${API}/gyms/${gymId}/announcements`); setItems(await r2.json()); }
    } finally { setSaving(false); }
  };
  return (
    <div className="space-y-6">
      <SectionHeader title="Announcements" sub="Post updates and news for your members." />
      <div className="bg-[rgba(240,235,227,0.03)] border border-[rgba(201,169,110,0.09)] rounded-2xl p-4">
        <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Write an announcement…" rows={4} className="w-full bg-transparent text-white placeholder-white/25 focus:outline-none resize-none text-sm" />
        <div className="flex justify-end mt-2">
          <PurpleBtn onClick={post} disabled={saving || !text.trim()}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}{saving ? 'Posting…' : 'Post'}</PurpleBtn>
        </div>
      </div>
      <div className="space-y-3">
        {items.length === 0 && <EmptyState icon={Megaphone} text="No announcements yet" />}
        {items.map(a => (
          <div key={a.id} className="p-4 rounded-2xl bg-[rgba(240,235,227,0.03)] border border-[rgba(201,169,110,0.09)]">
            <p className="text-sm text-white/80 leading-relaxed">{a.text}</p>
            <p className="text-xs text-white/25 mt-2">{new Date(a.createdAt).toLocaleDateString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function GymSettingsTab({ gym, gymId, onSaved }: { gym: GymProfile; gymId: string; onSaved: () => void }) {
  const [gymName, setGymName] = useState(gym.gymName);
  const [description, setDescription] = useState(gym.description);
  const [address, setAddress] = useState(gym.address);
  const [city, setCity] = useState(gym.city);
  const [country, setCountry] = useState(gym.country);
  const [phone, setPhone] = useState(gym.phone);
  const [website, setWebsite] = useState(gym.website);
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try {
      const r = await authFetch(`${API}/gyms/${gymId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ gymName, description, address, city, country, phone, website }) });
      if (r.ok) { toast.success('Settings saved!'); onSaved(); } else toast.error('Failed to save');
    } finally { setSaving(false); }
  };
  return (
    <div className="space-y-6 max-w-xl">
      <SectionHeader title="Gym settings" sub="Update your gym profile information." />
      {[
        { label: 'Gym name', value: gymName, set: setGymName, placeholder: 'Gym name' },
        { label: 'Address', value: address, set: setAddress, placeholder: 'Street address' },
        { label: 'City', value: city, set: setCity, placeholder: 'City' },
        { label: 'Country', value: country, set: setCountry, placeholder: 'Country' },
        { label: 'Phone', value: phone, set: setPhone, placeholder: '+1 234 567 8900' },
        { label: 'Website', value: website, set: setWebsite, placeholder: 'https://yourgym.com' },
      ].map(f => (
        <div key={f.label}>
          <label className="block text-sm text-white/40 mb-1.5">{f.label}</label>
          <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder} className={inp()} />
        </div>
      ))}
      <div>
        <label className="block text-sm text-white/40 mb-1.5">Description</label>
        <textarea value={description} onChange={e => setDescription(e.target.value)} rows={4} placeholder="Tell members about your gym…" className="w-full bg-[rgba(240,235,227,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-4 py-3 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.35)] transition-all resize-none" />
      </div>
      <button onClick={save} disabled={saving} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-[#c9a96e] hover:bg-[#b8945a] text-white font-medium disabled:opacity-50 transition-all">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}{saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRO TABS
// ─────────────────────────────────────────────────────────────────────────────

// 1. BILLING & PAYMENTS
function BillingTab({ gymId }: { gymId: string }) {
  const [payments, setPayments] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [memberName, setMemberName] = useState('');
  const [amount, setAmount] = useState('');
  const [plan, setPlan] = useState('monthly');
  const [status, setStatus] = useState('pending');
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const load = async () => { const r = await authFetch(`${API}/gyms/${gymId}/payments`); if (r.ok) setPayments(await r.json()); };
  useEffect(() => { load(); }, [gymId]);
  const save = async () => {
    if (!memberName || !amount) return toast.error('Member name and amount required');
    setSaving(true);
    try {
      const r = await authFetch(`${API}/gyms/${gymId}/payments`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ memberName, amount: Number(amount), plan, status, dueDate, note }) });
      if (r.ok) { toast.success('Payment added!'); setShow(false); setMemberName(''); setAmount(''); setNote(''); load(); }
      else toast.error('Failed');
    } finally { setSaving(false); }
  };
  const updateStatus = async (id: string, newStatus: string) => {
    await authFetch(`${API}/gyms/${gymId}/payments/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }) });
    load();
  };
  const del = async (id: string) => { await authFetch(`${API}/gyms/${gymId}/payments/${id}`, { method: 'DELETE' }); toast.success('Deleted'); load(); };
  const total = payments.filter(p => p.status === 'paid').reduce((s, p) => s + (p.amount || 0), 0);
  const overdue = payments.filter(p => p.status === 'overdue').length;
  const statusColor: Record<string,string> = { paid: 'bg-emerald-500/15 text-emerald-400', pending: 'bg-amber-500/15 text-amber-400', overdue: 'bg-red-500/15 text-red-400' };
  return (
    <div>
      <SectionHeader title="Billing & Payments" sub={`${payments.length} records`}
        action={<PurpleBtn onClick={() => setShow(s => !s)}><Plus className="w-4 h-4" /> Add payment</PurpleBtn>} />
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total collected" value={`$${total}`} color="emerald" />
        <StatCard label="Overdue records" value={overdue} color="red" />
        <StatCard label="Pending records" value={payments.filter(p => p.status === 'pending').length} color="amber" />
      </div>
      {show && (
        <FormBox>
          <h3 className="text-sm font-semibold text-[#e8c98a]">New payment record</h3>
          <Row>
            <Field label="Member name *"><input value={memberName} onChange={e => setMemberName(e.target.value)} placeholder="John Doe" className={inp()} /></Field>
            <Field label="Amount ($) *"><input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="99" className={inp()} /></Field>
            <Field label="Plan"><select value={plan} onChange={e => setPlan(e.target.value)} className={sel()}><option value="monthly">Monthly</option><option value="yearly">Yearly</option><option value="day-pass">Day Pass</option></select></Field>
            <Field label="Status"><select value={status} onChange={e => setStatus(e.target.value)} className={sel()}><option value="pending">Pending</option><option value="paid">Paid</option><option value="overdue">Overdue</option></select></Field>
            <Field label="Due date"><input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className={inp()} /></Field>
            <Field label="Note"><input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note" className={inp()} /></Field>
          </Row>
          <div className="flex gap-2">
            <PurpleBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <DollarSign className="w-4 h-4" />}{saving ? 'Saving…' : 'Save'}</PurpleBtn>
            <GhostBtn onClick={() => setShow(false)}>Cancel</GhostBtn>
          </div>
        </FormBox>
      )}
      <div className="space-y-2">
        {payments.length === 0 && <EmptyState icon={CreditCard} text="No payment records yet" />}
        {payments.map(p => (
          <Card key={p.id}>
            <div className="w-9 h-9 rounded-full bg-[#c9a96e]/20 flex items-center justify-center text-[#e8c98a] text-sm font-bold shrink-0">{p.memberName?.[0]||'?'}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{p.memberName}</p>
              <p className="text-xs text-white/30">{p.plan} {p.dueDate ? `· due ${p.dueDate}` : ''} {p.note ? `· ${p.note}` : ''}</p>
            </div>
            <p className="text-sm font-bold text-white">${p.amount}</p>
            <select value={p.status} onChange={e => updateStatus(p.id, e.target.value)}
              className={`text-xs px-2 py-1 rounded-lg border-0 cursor-pointer ${statusColor[p.status] || 'bg-[rgba(240,235,227,0.04)] text-white/40'} bg-transparent`}>
              <option value="pending">Pending</option><option value="paid">Paid</option><option value="overdue">Overdue</option>
            </select>
            <button onClick={() => del(p.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// 2. REVENUE ANALYTICS
function RevenueTab({ gymId }: { gymId: string }) {
  const [data, setData] = useState<any>(null);
  useEffect(() => { authFetch(`${API}/gyms/${gymId}/revenue`).then(r => r.ok ? r.json() : null).then(d => { if (d) setData(d); }); }, [gymId]);
  if (!data) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" /></div>;
  const max = Math.max(...(data.monthly?.map((m: any) => m.total) || [1]), 1);
  return (
    <div className="space-y-6">
      <SectionHeader title="Revenue Analytics" sub="Financial overview of your gym" />
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total revenue (paid)" value={`$${data.totalRevenue?.toFixed(0)}`} color="emerald" />
        <StatCard label="Overdue amount"        value={`$${data.overdue?.toFixed(0)}`}       color="red" />
        <StatCard label="Pending amount"        value={`$${data.pending?.toFixed(0)}`}        color="amber" />
      </div>
      <div className="bg-[rgba(240,235,227,0.03)] border border-[rgba(201,169,110,0.09)] rounded-2xl p-6">
        <h3 className="text-sm font-medium text-white/60 mb-5">Monthly revenue — last 6 months</h3>
        <div className="flex items-end gap-3 h-36">
          {(data.monthly || []).map((m: any) => (
            <div key={m.month} className="flex-1 flex flex-col items-center gap-2">
              <span className="text-xs text-white/40">${m.total.toFixed(0)}</span>
              <div className="w-full rounded-t-lg bg-[#c9a96e]/60" style={{ height: `${Math.max(4, (m.total / max) * 110)}px` }} />
              <span className="text-[11px] text-white/30">{m.label}</span>
            </div>
          ))}
        </div>
      </div>
      {data.byPlan && Object.keys(data.byPlan).length > 0 && (
        <div className="bg-[rgba(240,235,227,0.03)] border border-[rgba(201,169,110,0.09)] rounded-2xl p-6">
          <h3 className="text-sm font-medium text-white/60 mb-4">Revenue by plan</h3>
          <div className="space-y-3">
            {Object.entries(data.byPlan).map(([plan, total]: any) => (
              <div key={plan} className="flex items-center gap-3">
                <span className="text-sm text-white/60 w-24 capitalize">{plan}</span>
                <div className="flex-1 h-2 bg-[rgba(240,235,227,0.04)] rounded-full overflow-hidden">
                  <div className="h-full bg-[#c9a96e]/70 rounded-full" style={{ width: `${Math.min(100, (total / data.totalRevenue) * 100)}%` }} />
                </div>
                <span className="text-sm font-medium text-white w-16 text-right">${total.toFixed(0)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// 3. PERSONAL TRAINERS
function TrainersTab({ gymId }: { gymId: string }) {
  const [trainers, setTrainers] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(''); const [specialty, setSpecialty] = useState('');
  const [email, setEmail] = useState(''); const [phone, setPhone] = useState('');
  const [bio, setBio] = useState(''); const [hourlyRate, setHourlyRate] = useState('');
  const load = async () => { const r = await authFetch(`${API}/gyms/${gymId}/trainers`); if (r.ok) setTrainers(await r.json()); };
  useEffect(() => { load(); }, [gymId]);
  const save = async () => {
    if (!name) return toast.error('Name required');
    setSaving(true);
    try {
      const r = await authFetch(`${API}/gyms/${gymId}/trainers`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, specialty, email, phone, bio, hourlyRate: Number(hourlyRate) }) });
      if (r.ok) { toast.success('Trainer added!'); setShow(false); setName(''); setSpecialty(''); setEmail(''); setPhone(''); setBio(''); setHourlyRate(''); load(); }
    } finally { setSaving(false); }
  };
  const del = async (id: string) => { await authFetch(`${API}/gyms/${gymId}/trainers/${id}`, { method: 'DELETE' }); toast.success('Removed'); load(); };
  return (
    <div>
      <SectionHeader title="Personal Trainers" sub={`${trainers.length} trainers`}
        action={<PurpleBtn onClick={() => setShow(s => !s)}><UserPlus className="w-4 h-4" /> Add trainer</PurpleBtn>} />
      {show && (
        <FormBox>
          <h3 className="text-sm font-semibold text-[#e8c98a]">New trainer</h3>
          <Row>
            <Field label="Full name *"><input value={name} onChange={e => setName(e.target.value)} placeholder="Ahmed Ali" className={inp()} /></Field>
            <Field label="Specialty"><input value={specialty} onChange={e => setSpecialty(e.target.value)} placeholder="e.g. Strength & HIIT" className={inp()} /></Field>
            <Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="trainer@gym.com" className={inp()} /></Field>
            <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567" className={inp()} /></Field>
            <Field label="Hourly rate ($)"><input type="number" value={hourlyRate} onChange={e => setHourlyRate(e.target.value)} placeholder="50" className={inp()} /></Field>
          </Row>
          <Field label="Bio"><textarea value={bio} onChange={e => setBio(e.target.value)} rows={2} placeholder="Short bio…" className="w-full bg-[rgba(240,235,227,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.35)] resize-none" /></Field>
          <div className="flex gap-2"><PurpleBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{saving ? 'Saving…' : 'Save'}</PurpleBtn><GhostBtn onClick={() => setShow(false)}>Cancel</GhostBtn></div>
        </FormBox>
      )}
      <div className="space-y-2">
        {trainers.length === 0 && <EmptyState icon={UserCheck} text="No trainers added yet" />}
        {trainers.map(t => (
          <Card key={t.id}>
            <div className="w-10 h-10 rounded-full bg-[#c9a96e]/20 flex items-center justify-center text-[#e8c98a] font-bold shrink-0">{t.name?.[0]||'?'}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{t.name}</p>
              <p className="text-xs text-white/30">{t.specialty || 'No specialty'} {t.email ? `· ${t.email}` : ''}</p>
            </div>
            {t.hourlyRate > 0 && <span className="text-xs text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg">${t.hourlyRate}/hr</span>}
            <span className="text-xs text-white/30">{(t.assignedMembers || []).length} members</span>
            <button onClick={() => del(t.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// 4. EQUIPMENT TRACKER
function EquipmentTab({ gymId }: { gymId: string }) {
  const [items, setItems] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(''); const [type, setType] = useState('');
  const [brand, setBrand] = useState(''); const [condition, setCondition] = useState('good');
  const [lastMaint, setLastMaint] = useState(''); const [nextMaint, setNextMaint] = useState('');
  const [notes, setNotes] = useState('');
  const load = async () => { const r = await authFetch(`${API}/gyms/${gymId}/equipment`); if (r.ok) setItems(await r.json()); };
  useEffect(() => { load(); }, [gymId]);
  const save = async () => {
    if (!name) return toast.error('Name required');
    setSaving(true);
    try {
      const r = await authFetch(`${API}/gyms/${gymId}/equipment`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, type, brand, condition, lastMaintenance: lastMaint, nextMaintenance: nextMaint, notes }) });
      if (r.ok) { toast.success('Equipment added!'); setShow(false); setName(''); setType(''); setBrand(''); setNotes(''); load(); }
    } finally { setSaving(false); }
  };
  const del = async (id: string) => { await authFetch(`${API}/gyms/${gymId}/equipment/${id}`, { method: 'DELETE' }); toast.success('Removed'); load(); };
  const condColor: Record<string,string> = { excellent: 'text-emerald-400 bg-emerald-500/10', good: 'text-sky-400 bg-sky-500/10', fair: 'text-amber-400 bg-amber-500/10', poor: 'text-red-400 bg-red-500/10', broken: 'text-red-400 bg-red-500/20' };
  const needsMaint = items.filter(i => i.nextMaintenance && i.nextMaintenance <= new Date().toISOString().slice(0,10)).length;
  return (
    <div>
      <SectionHeader title="Equipment Tracker" sub={`${items.length} items${needsMaint > 0 ? ` · ⚠️ ${needsMaint} need maintenance` : ''}`}
        action={<PurpleBtn onClick={() => setShow(s => !s)}><Plus className="w-4 h-4" /> Add equipment</PurpleBtn>} />
      {show && (
        <FormBox>
          <h3 className="text-sm font-semibold text-[#e8c98a]">New equipment</h3>
          <Row>
            <Field label="Name *"><input value={name} onChange={e => setName(e.target.value)} placeholder="Treadmill" className={inp()} /></Field>
            <Field label="Type"><input value={type} onChange={e => setType(e.target.value)} placeholder="Cardio / Strength…" className={inp()} /></Field>
            <Field label="Brand"><input value={brand} onChange={e => setBrand(e.target.value)} placeholder="e.g. Life Fitness" className={inp()} /></Field>
            <Field label="Condition"><select value={condition} onChange={e => setCondition(e.target.value)} className={sel()}><option value="excellent">Excellent</option><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option><option value="broken">Broken</option></select></Field>
            <Field label="Last maintenance"><input type="date" value={lastMaint} onChange={e => setLastMaint(e.target.value)} className={inp()} /></Field>
            <Field label="Next maintenance"><input type="date" value={nextMaint} onChange={e => setNextMaint(e.target.value)} className={inp()} /></Field>
          </Row>
          <Field label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional notes…" className={inp()} /></Field>
          <div className="flex gap-2"><PurpleBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{saving ? 'Saving…' : 'Save'}</PurpleBtn><GhostBtn onClick={() => setShow(false)}>Cancel</GhostBtn></div>
        </FormBox>
      )}
      <div className="space-y-2">
        {items.length === 0 && <EmptyState icon={Wrench} text="No equipment logged yet" />}
        {items.map(i => (
          <Card key={i.id}>
            <div className="w-9 h-9 rounded-xl bg-[rgba(240,235,227,0.04)] flex items-center justify-center shrink-0"><Wrench className="w-4 h-4 text-white/40" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{i.name} {i.brand && <span className="text-white/30 text-xs">· {i.brand}</span>}</p>
              <p className="text-xs text-white/30">{i.type || 'No type'} {i.nextMaintenance ? `· next service: ${i.nextMaintenance}` : ''}</p>
            </div>
            <span className={`text-xs px-2 py-1 rounded-lg capitalize ${condColor[i.condition] || 'text-white/40 bg-[rgba(240,235,227,0.04)]'}`}>{i.condition}</span>
            {i.nextMaintenance && i.nextMaintenance <= new Date().toISOString().slice(0,10) && <AlertCircle className="w-4 h-4 text-amber-400 shrink-0" />}
            <button onClick={() => del(i.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// 5. CHALLENGES & LEADERBOARDS
function ChallengesTab({ gymId }: { gymId: string }) {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(''); const [description, setDescription] = useState('');
  const [goalType, setGoalType] = useState('checkins'); const [goalValue, setGoalValue] = useState('10');
  const [startDate, setStartDate] = useState(''); const [endDate, setEndDate] = useState('');
  const [reward, setReward] = useState('');
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [selectedChallenge, setSelectedChallenge] = useState<string|null>(null);
  const load = async () => { const r = await authFetch(`${API}/gyms/${gymId}/challenges`); if (r.ok) setChallenges(await r.json()); };
  useEffect(() => { load(); }, [gymId]);
  const save = async () => {
    if (!name) return toast.error('Name required');
    setSaving(true);
    try {
      const r = await authFetch(`${API}/gyms/${gymId}/challenges`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description, goalType, goalValue: Number(goalValue), startDate, endDate, reward }) });
      if (r.ok) { toast.success('Challenge created!'); setShow(false); setName(''); setDescription(''); setReward(''); load(); }
    } finally { setSaving(false); }
  };
  const del = async (id: string) => { await authFetch(`${API}/gyms/${gymId}/challenges/${id}`, { method: 'DELETE' }); toast.success('Deleted'); load(); };
  const loadLeaderboard = async (id: string) => {
    setSelectedChallenge(id);
    const r = await authFetch(`${API}/gyms/${gymId}/challenges/${id}/leaderboard`);
    if (r.ok) setLeaderboard(await r.json());
  };
  return (
    <div>
      <SectionHeader title="Challenges & Leaderboards" sub={`${challenges.length} challenges`}
        action={<PurpleBtn onClick={() => setShow(s => !s)}><Plus className="w-4 h-4" /> Create challenge</PurpleBtn>} />
      {show && (
        <FormBox>
          <h3 className="text-sm font-semibold text-[#e8c98a]">New challenge</h3>
          <Row>
            <Field label="Challenge name *"><input value={name} onChange={e => setName(e.target.value)} placeholder="30-Day Check-in Challenge" className={inp()} /></Field>
            <Field label="Reward"><input value={reward} onChange={e => setReward(e.target.value)} placeholder="Free month membership" className={inp()} /></Field>
            <Field label="Goal type"><select value={goalType} onChange={e => setGoalType(e.target.value)} className={sel()}><option value="checkins">Check-ins</option><option value="classes">Classes attended</option></select></Field>
            <Field label="Goal value"><input type="number" value={goalValue} onChange={e => setGoalValue(e.target.value)} placeholder="10" className={inp()} /></Field>
            <Field label="Start date"><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inp()} /></Field>
            <Field label="End date"><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inp()} /></Field>
          </Row>
          <Field label="Description"><textarea value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Describe the challenge…" className="w-full bg-[rgba(240,235,227,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.35)] resize-none" /></Field>
          <div className="flex gap-2"><PurpleBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}{saving ? 'Saving…' : 'Create'}</PurpleBtn><GhostBtn onClick={() => setShow(false)}>Cancel</GhostBtn></div>
        </FormBox>
      )}
      <div className="space-y-3">
        {challenges.length === 0 && <EmptyState icon={Trophy} text="No challenges yet — create your first one!" />}
        {challenges.map(c => (
          <div key={c.id} className="p-4 rounded-2xl bg-[rgba(240,235,227,0.03)] border border-[rgba(201,169,110,0.09)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <p className="text-sm font-medium">{c.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${c.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[rgba(240,235,227,0.04)] text-white/30'}`}>{c.active ? 'Active' : 'Ended'}</span>
                </div>
                {c.description && <p className="text-xs text-white/40 mb-2">{c.description}</p>}
                <p className="text-xs text-white/30">Goal: {c.goalValue} {c.goalType} {c.endDate ? `· ends ${c.endDate}` : ''} {c.reward ? `· 🏆 ${c.reward}` : ''}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => loadLeaderboard(c.id)} className="px-3 py-1.5 rounded-lg bg-[rgba(201,169,110,0.1)] text-[#c9a96e] text-xs hover:bg-[#b8945a]/20 transition-all">Leaderboard</button>
                <button onClick={() => del(c.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            {selectedChallenge === c.id && leaderboard.length > 0 && (
              <div className="mt-4 pt-4 border-t border-[rgba(201,169,110,0.08)]">
                <p className="text-xs text-white/40 mb-3 uppercase tracking-wider">Leaderboard</p>
                <div className="space-y-1">
                  {leaderboard.slice(0,10).map((e, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className={`text-xs font-bold w-5 text-center ${idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-white/60' : idx === 2 ? 'text-amber-700' : 'text-white/30'}`}>#{idx+1}</span>
                      <span className="flex-1 text-xs text-white/70">{e.name}</span>
                      <span className="text-xs text-[#c9a96e] font-medium">{e.count} check-ins</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 6. MEMBER PROGRESS
function ProgressTab({ gymId, members, onLoadMembers }: { gymId: string; members: Member[]; onLoadMembers: () => void }) {
  const [selectedMember, setSelectedMember] = useState('');
  const [entries, setEntries] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));
  const [weight, setWeight] = useState(''); const [bodyFat, setBodyFat] = useState('');
  const [chest, setChest] = useState(''); const [waist, setWaist] = useState('');
  const [hips, setHips] = useState(''); const [notes, setNotes] = useState('');
  useEffect(() => { if (members.length === 0) onLoadMembers(); }, []);
  const loadEntries = async (memberId: string) => {
    setSelectedMember(memberId);
    const r = await authFetch(`${API}/gyms/${gymId}/progress/${memberId}`);
    if (r.ok) setEntries(await r.json());
  };
  const save = async () => {
    if (!selectedMember) return toast.error('Select a member first');
    setSaving(true);
    try {
      const r = await authFetch(`${API}/gyms/${gymId}/progress/${selectedMember}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, weight: Number(weight), bodyFat: Number(bodyFat), chest: Number(chest), waist: Number(waist), hips: Number(hips), notes }) });
      if (r.ok) { toast.success('Progress saved!'); setShow(false); setWeight(''); setBodyFat(''); setChest(''); setWaist(''); setHips(''); setNotes(''); loadEntries(selectedMember); }
    } finally { setSaving(false); }
  };
  return (
    <div>
      <SectionHeader title="Member Progress" sub="Track weight, measurements & personal records" />
      <div className="mb-6">
        <label className="text-xs text-white/40 mb-2 block">Select member</label>
        <select value={selectedMember} onChange={e => loadEntries(e.target.value)} className={sel('max-w-xs')}>
          <option value="">-- Choose member --</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
      </div>
      {selectedMember && (
        <>
          <div className="flex justify-end mb-4">
            <PurpleBtn onClick={() => setShow(s => !s)}><Plus className="w-4 h-4" /> Log progress</PurpleBtn>
          </div>
          {show && (
            <FormBox>
              <h3 className="text-sm font-semibold text-[#e8c98a]">New progress entry</h3>
              <Row>
                <Field label="Date"><input type="date" value={date} onChange={e => setDate(e.target.value)} className={inp()} /></Field>
                <Field label="Weight (kg)"><input type="number" value={weight} onChange={e => setWeight(e.target.value)} placeholder="75" className={inp()} /></Field>
                <Field label="Body fat (%)"><input type="number" value={bodyFat} onChange={e => setBodyFat(e.target.value)} placeholder="18" className={inp()} /></Field>
                <Field label="Chest (cm)"><input type="number" value={chest} onChange={e => setChest(e.target.value)} placeholder="95" className={inp()} /></Field>
                <Field label="Waist (cm)"><input type="number" value={waist} onChange={e => setWaist(e.target.value)} placeholder="80" className={inp()} /></Field>
                <Field label="Hips (cm)"><input type="number" value={hips} onChange={e => setHips(e.target.value)} placeholder="90" className={inp()} /></Field>
              </Row>
              <Field label="Notes"><input value={notes} onChange={e => setNotes(e.target.value)} placeholder="e.g. Bench press PR: 100kg" className={inp()} /></Field>
              <div className="flex gap-2"><PurpleBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Activity className="w-4 h-4" />}{saving ? 'Saving…' : 'Save'}</PurpleBtn><GhostBtn onClick={() => setShow(false)}>Cancel</GhostBtn></div>
            </FormBox>
          )}
          <div className="space-y-3">
            {entries.length === 0 && <EmptyState icon={Activity} text="No progress entries yet for this member" />}
            {entries.map(e => (
              <div key={e.id} className="p-4 rounded-2xl bg-[rgba(240,235,227,0.03)] border border-[rgba(201,169,110,0.09)]">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">{e.date}</p>
                </div>
                <div className="grid grid-cols-3 gap-3 text-center">
                  {e.weight > 0 && <div><p className="text-lg font-bold text-white">{e.weight}<span className="text-xs text-white/30">kg</span></p><p className="text-xs text-white/30">Weight</p></div>}
                  {e.bodyFat > 0 && <div><p className="text-lg font-bold text-white">{e.bodyFat}<span className="text-xs text-white/30">%</span></p><p className="text-xs text-white/30">Body fat</p></div>}
                  {e.waist > 0 && <div><p className="text-lg font-bold text-white">{e.waist}<span className="text-xs text-white/30">cm</span></p><p className="text-xs text-white/30">Waist</p></div>}
                </div>
                {e.notes && <p className="text-xs text-white/40 mt-2 pt-2 border-t border-[rgba(201,169,110,0.08)]">{e.notes}</p>}
              </div>
            ))}
          </div>
        </>
      )}
      {!selectedMember && members.length > 0 && <EmptyState icon={Activity} text="Select a member above to view their progress" />}
    </div>
  );
}

// 7. DAY PASSES & VISITORS
function PassesTab({ gymId }: { gymId: string }) {
  const [passes, setPasses] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [visitorName, setVisitorName] = useState(''); const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(''); const [type, setType] = useState('day');
  const [price, setPrice] = useState(''); const [note, setNote] = useState('');
  const load = async () => { const r = await authFetch(`${API}/gyms/${gymId}/passes`); if (r.ok) setPasses(await r.json()); };
  useEffect(() => { load(); }, [gymId]);
  const save = async () => {
    if (!visitorName) return toast.error('Visitor name required');
    setSaving(true);
    try {
      const r = await authFetch(`${API}/gyms/${gymId}/passes`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ visitorName, email, phone, type, price: Number(price), note }) });
      if (r.ok) { toast.success('Pass issued!'); setShow(false); setVisitorName(''); setEmail(''); setPhone(''); setPrice(''); setNote(''); load(); }
    } finally { setSaving(false); }
  };
  const expire = async (id: string) => { await authFetch(`${API}/gyms/${gymId}/passes/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'expired' }) }); load(); };
  const active = passes.filter(p => p.status === 'active').length;
  return (
    <div>
      <SectionHeader title="Day Passes & Visitors" sub={`${active} active passes · ${passes.length} total`}
        action={<PurpleBtn onClick={() => setShow(s => !s)}><Ticket className="w-4 h-4" /> Issue pass</PurpleBtn>} />
      {show && (
        <FormBox>
          <h3 className="text-sm font-semibold text-[#e8c98a]">Issue new pass</h3>
          <Row>
            <Field label="Visitor name *"><input value={visitorName} onChange={e => setVisitorName(e.target.value)} placeholder="Jane Smith" className={inp()} /></Field>
            <Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="visitor@email.com" className={inp()} /></Field>
            <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+1 234 567" className={inp()} /></Field>
            <Field label="Pass type"><select value={type} onChange={e => setType(e.target.value)} className={sel()}><option value="day">Day pass (1 day)</option><option value="week">Week pass (7 days)</option><option value="month">Month pass (30 days)</option></select></Field>
            <Field label="Price ($)"><input type="number" value={price} onChange={e => setPrice(e.target.value)} placeholder="15" className={inp()} /></Field>
            <Field label="Note"><input value={note} onChange={e => setNote(e.target.value)} placeholder="Optional note" className={inp()} /></Field>
          </Row>
          <div className="flex gap-2"><PurpleBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ticket className="w-4 h-4" />}{saving ? 'Issuing…' : 'Issue pass'}</PurpleBtn><GhostBtn onClick={() => setShow(false)}>Cancel</GhostBtn></div>
        </FormBox>
      )}
      <div className="space-y-2">
        {passes.length === 0 && <EmptyState icon={Ticket} text="No passes issued yet" />}
        {passes.map(p => (
          <Card key={p.id}>
            <div className="w-9 h-9 rounded-xl bg-[rgba(201,169,110,0.09)] flex items-center justify-center shrink-0"><Ticket className="w-4 h-4 text-[#c9a96e]" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{p.visitorName}</p>
              <p className="text-xs text-white/30 capitalize">{p.type} pass · expires {p.expiresAt} {p.price > 0 ? `· $${p.price}` : ''}</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${p.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[rgba(240,235,227,0.04)] text-white/30'}`}>{p.status}</span>
            {p.status === 'active' && <button onClick={() => expire(p.id)} className="px-2 py-1 text-xs rounded-lg text-white/30 hover:text-white hover:bg-[rgba(201,169,110,0.08)] transition-all">Expire</button>}
          </Card>
        ))}
      </div>
    </div>
  );
}

// 8. MEMBER MESSAGING
function MessagesTab({ gymId, members, onLoadMembers }: { gymId: string; members: Member[]; onLoadMembers: () => void }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recipient, setRecipient] = useState('all');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const load = async () => { const r = await authFetch(`${API}/gyms/${gymId}/messages`); if (r.ok) setMessages(await r.json()); };
  useEffect(() => { load(); if (members.length === 0) onLoadMembers(); }, [gymId]);
  const send = async () => {
    if (!body.trim()) return toast.error('Message body required');
    setSaving(true);
    try {
      const selectedMember = members.find(m => m.id === recipient);
      const r = await authFetch(`${API}/gyms/${gymId}/messages`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ recipient: recipient === 'all' ? 'All Members' : selectedMember?.name || recipient, recipientId: recipient === 'all' ? null : recipient, subject, body }) });
      if (r.ok) { toast.success('Message sent!'); setShow(false); setSubject(''); setBody(''); load(); }
    } finally { setSaving(false); }
  };
  return (
    <div>
      <SectionHeader title="Member Messaging" sub={`${messages.length} messages sent`}
        action={<PurpleBtn onClick={() => setShow(s => !s)}><MessageSquare className="w-4 h-4" /> New message</PurpleBtn>} />
      {show && (
        <FormBox>
          <h3 className="text-sm font-semibold text-[#e8c98a]">Compose message</h3>
          <Field label="Send to">
            <select value={recipient} onChange={e => setRecipient(e.target.value)} className={sel()}>
              <option value="all">📢 All Members</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </Field>
          <Field label="Subject"><input value={subject} onChange={e => setSubject(e.target.value)} placeholder="e.g. New class schedule" className={inp()} /></Field>
          <Field label="Message *"><textarea value={body} onChange={e => setBody(e.target.value)} rows={4} placeholder="Type your message here…" className="w-full bg-[rgba(240,235,227,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.35)] resize-none" /></Field>
          <div className="flex gap-2"><PurpleBtn onClick={send} disabled={saving || !body.trim()}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageSquare className="w-4 h-4" />}{saving ? 'Sending…' : 'Send message'}</PurpleBtn><GhostBtn onClick={() => setShow(false)}>Cancel</GhostBtn></div>
        </FormBox>
      )}
      <div className="space-y-3">
        {messages.length === 0 && <EmptyState icon={MessageSquare} text="No messages sent yet" />}
        {messages.map(m => (
          <div key={m.id} className="p-4 rounded-2xl bg-[rgba(240,235,227,0.03)] border border-[rgba(201,169,110,0.09)]">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#c9a96e] bg-[rgba(201,169,110,0.09)] px-2 py-0.5 rounded-full">To: {m.recipient}</span>
              <span className="text-xs text-white/30">{new Date(m.sentAt).toLocaleDateString()}</span>
            </div>
            {m.subject && <p className="text-sm font-medium mb-1">{m.subject}</p>}
            <p className="text-sm text-white/60 leading-relaxed">{m.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// 9. NUTRITION & DIET PLANS
function NutritionTab({ gymId }: { gymId: string }) {
  const [plans, setPlans] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(''); const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState(''); const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState(''); const [notes, setNotes] = useState('');
  const load = async () => { const r = await authFetch(`${API}/gyms/${gymId}/nutrition`); if (r.ok) setPlans(await r.json()); };
  useEffect(() => { load(); }, [gymId]);
  const save = async () => {
    if (!name) return toast.error('Plan name required');
    setSaving(true);
    try {
      const r = await authFetch(`${API}/gyms/${gymId}/nutrition`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, calories: Number(calories), protein: Number(protein), carbs: Number(carbs), fat: Number(fat), notes }) });
      if (r.ok) { toast.success('Plan created!'); setShow(false); setName(''); setCalories(''); setProtein(''); setCarbs(''); setFat(''); setNotes(''); load(); }
    } finally { setSaving(false); }
  };
  const del = async (id: string) => { await authFetch(`${API}/gyms/${gymId}/nutrition/${id}`, { method: 'DELETE' }); toast.success('Deleted'); load(); };
  return (
    <div>
      <SectionHeader title="Nutrition & Diet Plans" sub={`${plans.length} plans created`}
        action={<PurpleBtn onClick={() => setShow(s => !s)}><Plus className="w-4 h-4" /> Create plan</PurpleBtn>} />
      {show && (
        <FormBox>
          <h3 className="text-sm font-semibold text-[#e8c98a]">New diet plan</h3>
          <Row>
            <Field label="Plan name *"><input value={name} onChange={e => setName(e.target.value)} placeholder="Muscle Gain Plan" className={inp()} /></Field>
            <Field label="Daily calories"><input type="number" value={calories} onChange={e => setCalories(e.target.value)} placeholder="2500" className={inp()} /></Field>
            <Field label="Protein (g)"><input type="number" value={protein} onChange={e => setProtein(e.target.value)} placeholder="180" className={inp()} /></Field>
            <Field label="Carbs (g)"><input type="number" value={carbs} onChange={e => setCarbs(e.target.value)} placeholder="250" className={inp()} /></Field>
            <Field label="Fat (g)"><input type="number" value={fat} onChange={e => setFat(e.target.value)} placeholder="70" className={inp()} /></Field>
          </Row>
          <Field label="Notes / meal suggestions"><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} placeholder="Breakfast: oats + eggs…" className="w-full bg-[rgba(240,235,227,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.35)] resize-none" /></Field>
          <div className="flex gap-2"><PurpleBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Leaf className="w-4 h-4" />}{saving ? 'Saving…' : 'Create plan'}</PurpleBtn><GhostBtn onClick={() => setShow(false)}>Cancel</GhostBtn></div>
        </FormBox>
      )}
      <div className="space-y-3">
        {plans.length === 0 && <EmptyState icon={Leaf} text="No diet plans yet" />}
        {plans.map(p => (
          <div key={p.id} className="p-4 rounded-2xl bg-[rgba(240,235,227,0.03)] border border-[rgba(201,169,110,0.09)]">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium mb-2">{p.name}</p>
                <div className="flex gap-4 text-xs text-white/40">
                  {p.calories > 0 && <span>🔥 {p.calories} kcal</span>}
                  {p.protein > 0 && <span>💪 {p.protein}g protein</span>}
                  {p.carbs > 0 && <span>🌾 {p.carbs}g carbs</span>}
                  {p.fat > 0 && <span>🫒 {p.fat}g fat</span>}
                </div>
                {p.notes && <p className="text-xs text-white/30 mt-2 leading-relaxed">{p.notes}</p>}
              </div>
              <button onClick={() => del(p.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all ml-3"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// 10. CONTRACTS & WAIVERS
function ContractsTab({ gymId }: { gymId: string }) {
  const [contracts, setContracts] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(''); const [content, setContent] = useState(''); const [type, setType] = useState('membership');
  const [signerName, setSignerName] = useState(''); const [signingId, setSigningId] = useState<string|null>(null);
  const load = async () => { const r = await authFetch(`${API}/gyms/${gymId}/contracts`); if (r.ok) setContracts(await r.json()); };
  useEffect(() => { load(); }, [gymId]);
  const save = async () => {
    if (!title || !content) return toast.error('Title and content required');
    setSaving(true);
    try {
      const r = await authFetch(`${API}/gyms/${gymId}/contracts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, content, type }) });
      if (r.ok) { toast.success('Contract created!'); setShow(false); setTitle(''); setContent(''); load(); }
    } finally { setSaving(false); }
  };
  const del = async (id: string) => { await authFetch(`${API}/gyms/${gymId}/contracts/${id}`, { method: 'DELETE' }); toast.success('Deleted'); load(); };
  const markSigned = async (id: string, existing: string[]) => {
    if (!signerName.trim()) return toast.error('Enter the signer name');
    const updated = [...existing, `${signerName} · ${new Date().toISOString().slice(0,10)}`];
    await authFetch(`${API}/gyms/${gymId}/contracts/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ signedBy: updated }) });
    toast.success('Marked as signed!'); setSignerName(''); setSigningId(null); load();
  };
  return (
    <div>
      <SectionHeader title="Contracts & Waivers" sub={`${contracts.length} documents`}
        action={<PurpleBtn onClick={() => setShow(s => !s)}><Plus className="w-4 h-4" /> Create contract</PurpleBtn>} />
      {show && (
        <FormBox>
          <h3 className="text-sm font-semibold text-[#e8c98a]">New contract / waiver</h3>
          <Row>
            <Field label="Title *"><input value={title} onChange={e => setTitle(e.target.value)} placeholder="Membership Agreement" className={inp()} /></Field>
            <Field label="Type"><select value={type} onChange={e => setType(e.target.value)} className={sel()}><option value="membership">Membership</option><option value="waiver">Liability Waiver</option><option value="pt">PT Agreement</option></select></Field>
          </Row>
          <Field label="Content *"><textarea value={content} onChange={e => setContent(e.target.value)} rows={5} placeholder="Enter the full contract text here…" className="w-full bg-[rgba(240,235,227,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.35)] resize-none" /></Field>
          <div className="flex gap-2"><PurpleBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}{saving ? 'Saving…' : 'Create'}</PurpleBtn><GhostBtn onClick={() => setShow(false)}>Cancel</GhostBtn></div>
        </FormBox>
      )}
      <div className="space-y-3">
        {contracts.length === 0 && <EmptyState icon={FileText} text="No contracts yet" />}
        {contracts.map(c => (
          <div key={c.id} className="p-4 rounded-2xl bg-[rgba(240,235,227,0.03)] border border-[rgba(201,169,110,0.09)]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-[#c9a96e]" />
                  <p className="text-sm font-medium">{c.title}</p>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-[rgba(240,235,227,0.04)] text-white/30 capitalize">{c.type}</span>
                </div>
                <p className="text-xs text-white/30 line-clamp-2 mb-2">{c.content}</p>
                <p className="text-xs text-white/40">✍️ {(c.signedBy || []).length} signed</p>
                {(c.signedBy || []).length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1">{c.signedBy.map((s: string, i: number) => <span key={i} className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full">{s}</span>)}</div>
                )}
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => setSigningId(signingId === c.id ? null : c.id)} className="px-2 py-1.5 text-xs rounded-lg bg-[rgba(201,169,110,0.1)] text-[#c9a96e] hover:bg-[#b8945a]/20 transition-all">Mark signed</button>
                <button onClick={() => del(c.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
              </div>
            </div>
            {signingId === c.id && (
              <div className="flex gap-2 mt-3 pt-3 border-t border-[rgba(201,169,110,0.08)]">
                <input value={signerName} onChange={e => setSignerName(e.target.value)} placeholder="Member name who signed" className={inp('flex-1')} />
                <PurpleBtn onClick={() => markSigned(c.id, c.signedBy || [])}><Check className="w-4 h-4" /> Confirm</PurpleBtn>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// 11. MULTI-BRANCH SUPPORT
function BranchesTab({ gymId }: { gymId: string }) {
  const [branches, setBranches] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(''); const [address, setAddress] = useState('');
  const [city, setCity] = useState(''); const [country, setCountry] = useState('');
  const [phone, setPhone] = useState(''); const [managerName, setManagerName] = useState('');
  const [memberCount, setMemberCount] = useState('');
  const load = async () => { const r = await authFetch(`${API}/gyms/${gymId}/branches`); if (r.ok) setBranches(await r.json()); };
  useEffect(() => { load(); }, [gymId]);
  const save = async () => {
    if (!name) return toast.error('Branch name required');
    setSaving(true);
    try {
      const r = await authFetch(`${API}/gyms/${gymId}/branches`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, address, city, country, phone, managerName, memberCount: Number(memberCount) }) });
      if (r.ok) { toast.success('Branch added!'); setShow(false); setName(''); setAddress(''); setCity(''); setCountry(''); setPhone(''); setManagerName(''); setMemberCount(''); load(); }
    } finally { setSaving(false); }
  };
  const del = async (id: string) => { await authFetch(`${API}/gyms/${gymId}/branches/${id}`, { method: 'DELETE' }); toast.success('Removed'); load(); };
  const totalMembers = branches.reduce((s, b) => s + (b.memberCount || 0), 0);
  return (
    <div>
      <SectionHeader title="Branch Locations" sub={`${branches.length} branches · ${totalMembers} total members`}
        action={<PurpleBtn onClick={() => setShow(s => !s)}><Plus className="w-4 h-4" /> Add branch</PurpleBtn>} />
      {show && (
        <FormBox>
          <h3 className="text-sm font-semibold text-[#e8c98a]">New branch</h3>
          <Row>
            <Field label="Branch name *"><input value={name} onChange={e => setName(e.target.value)} placeholder="Downtown Branch" className={inp()} /></Field>
            <Field label="Manager name"><input value={managerName} onChange={e => setManagerName(e.target.value)} placeholder="Ahmed Hassan" className={inp()} /></Field>
            <Field label="Address"><input value={address} onChange={e => setAddress(e.target.value)} placeholder="123 Main Street" className={inp()} /></Field>
            <Field label="City"><input value={city} onChange={e => setCity(e.target.value)} placeholder="Dubai" className={inp()} /></Field>
            <Field label="Country"><input value={country} onChange={e => setCountry(e.target.value)} placeholder="UAE" className={inp()} /></Field>
            <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 4 000 0000" className={inp()} /></Field>
            <Field label="Member count"><input type="number" value={memberCount} onChange={e => setMemberCount(e.target.value)} placeholder="0" className={inp()} /></Field>
          </Row>
          <div className="flex gap-2"><PurpleBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitBranch className="w-4 h-4" />}{saving ? 'Saving…' : 'Add branch'}</PurpleBtn><GhostBtn onClick={() => setShow(false)}>Cancel</GhostBtn></div>
        </FormBox>
      )}
      <div className="space-y-2">
        {branches.length === 0 && <EmptyState icon={GitBranch} text="No branches yet — this is your main location" />}
        {branches.map(b => (
          <Card key={b.id}>
            <div className="w-10 h-10 rounded-xl bg-[rgba(201,169,110,0.09)] flex items-center justify-center shrink-0"><GitBranch className="w-5 h-5 text-[#c9a96e]" /></div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{b.name}</p>
              <p className="text-xs text-white/30">{[b.address, b.city, b.country].filter(Boolean).join(', ')} {b.managerName ? `· Manager: ${b.managerName}` : ''}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-sm font-bold">{b.memberCount}</p>
              <p className="text-xs text-white/30">members</p>
            </div>
            <span className={`text-xs px-2 py-0.5 rounded-full ${b.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-[rgba(240,235,227,0.04)] text-white/30'}`}>{b.active ? 'Active' : 'Inactive'}</span>
            <button onClick={() => del(b.id)} className="p-1.5 rounded-lg text-white/20 hover:text-red-400 hover:bg-red-500/10 transition-all"><Trash2 className="w-4 h-4" /></button>
          </Card>
        ))}
      </div>
    </div>
  );
}

// 12. STAFF MANAGEMENT
function StaffTab({ gymId }: { gymId: string }) {
  const [staff, setStaff] = useState<any[]>([]);
  const [show, setShow] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState(''); const [email, setEmail] = useState('');
  const [phone, setPhone] = useState(''); const [role, setRole] = useState('receptionist');
  const load = async () => { const r = await authFetch(`${API}/gyms/${gymId}/staff`); if (r.ok) setStaff(await r.json()); };
  useEffect(() => { load(); }, [gymId]);
  const save = async () => {
    if (!name) return toast.error('Name required');
    setSaving(true);
    try {
      const r = await authFetch(`${API}/gyms/${gymId}/staff`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, email, phone, role }) });
      if (r.ok) { toast.success('Staff member added!'); setShow(false); setName(''); setEmail(''); setPhone(''); load(); }
    } finally { setSaving(false); }
  };
  const del = async (id: string) => { await authFetch(`${API}/gyms/${gymId}/staff/${id}`, { method: 'DELETE' }); toast.success('Removed'); load(); };
  const toggleActive = async (id: string, active: boolean) => {
    await authFetch(`${API}/gyms/${gymId}/staff/${id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ active: !active }) });
    load();
  };
  const roleColor: Record<string,string> = {
    manager: 'bg-[#c9a96e]/15 text-[#c9a96e]',
    trainer: 'bg-sky-500/15 text-sky-400',
    receptionist: 'bg-emerald-500/15 text-emerald-400',
    cleaner: 'bg-amber-500/15 text-amber-400',
    security: 'bg-red-500/15 text-red-400',
  };
  return (
    <div>
      <SectionHeader title="Staff Management" sub={`${staff.filter(s => s.active).length} active · ${staff.length} total`}
        action={<PurpleBtn onClick={() => setShow(s => !s)}><UserPlus className="w-4 h-4" /> Add staff</PurpleBtn>} />
      {show && (
        <FormBox>
          <h3 className="text-sm font-semibold text-[#e8c98a]">New staff member</h3>
          <Row>
            <Field label="Full name *"><input value={name} onChange={e => setName(e.target.value)} placeholder="Omar Khalid" className={inp()} /></Field>
            <Field label="Role"><select value={role} onChange={e => setRole(e.target.value)} className={sel()}><option value="manager">Manager</option><option value="trainer">Trainer</option><option value="receptionist">Receptionist</option><option value="cleaner">Cleaner</option><option value="security">Security</option></select></Field>
            <Field label="Email"><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="staff@gym.com" className={inp()} /></Field>
            <Field label="Phone"><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 50 123 4567" className={inp()} /></Field>
          </Row>
          <div className="flex gap-2">
            <PurpleBtn onClick={save} disabled={saving}>{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}{saving ? 'Saving...' : 'Add staff'}</PurpleBtn>
            <GhostBtn onClick={() => setShow(false)}>Cancel</GhostBtn>
          </div>
        </FormBox>
      )}
      <div className="space-y-3">
        {staff.map((s: any) => (
          <Card key={s.id}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0, background: 'rgba(201,169,110,0.12)', border: '0.5px solid rgba(201,169,110,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#c9a96e', fontSize: 14, fontWeight: 500 }}>{s.name?.[0]}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white/80 text-sm font-medium truncate">{s.name}</p>
              <p className="text-white/40 text-xs">{s.role}</p>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
