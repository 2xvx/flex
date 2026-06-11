// TrainerDashboard.tsx — Full trainer control centre
// Tabs: Clients · Bookings · Calendar · Earnings · Notes · Programs · Marketplace · Reviews
import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  Users, Calendar, DollarSign, FileText, BookOpen,
  ShoppingBag, Video, BarChart2, Loader2, Check, X,
  Plus, Send, Trash2, ChevronDown, Star, PoundSterling,
  Clock, CheckCircle2, XCircle, AlertCircle, Crown,
  TrendingUp, Eye, Dumbbell, Upload, MessageCircle,
  Building2, MapPin, Phone, Globe, Instagram, Save,
  Camera, Tag,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { MuscleSelector } from './MuscleBodyDiagram';
import { Badge } from './ui/badge';
import { toast } from 'sonner';
import { authFetch } from '../../utils/authToken';
import { uploadVideoToStorage } from '../../utils/uploadVideo';
import { User } from '../types';

import { API } from '../../config';

interface Props { currentUser: User; onNavigate?: (view: string) => void; }

// ── Helpers ──────────────────────────────────────────────────────────────────
function daysSince(iso: string | null | undefined): number {
  if (!iso) return 999;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}
function fmtMoney(n: number, cur = '£') { return `${cur}${n.toFixed(0)}`; }
function fmtDate(iso: string) { return new Date(iso).toLocaleDateString('en', { day: 'numeric', month: 'short', year: 'numeric' }); }

const TAB_GROUPS = [
  {
    label: 'Business',
    tabs: [
      { id: 'clients',     label: 'Clients',      Icon: Users       },
      { id: 'bookings',    label: 'Bookings',     Icon: Calendar    },
      { id: 'earnings',    label: 'Earnings',     Icon: DollarSign  },
    ],
  },
  {
    label: 'Content',
    tabs: [
      { id: 'exercises',   label: 'Exercises',    Icon: Dumbbell    },
      { id: 'programs',    label: 'Programs',     Icon: BookOpen    },
      { id: 'marketplace', label: 'Marketplace',  Icon: ShoppingBag },
    ],
  },
  {
    label: 'Tools',
    tabs: [
      { id: 'calendar',    label: 'Availability', Icon: Clock       },
      { id: 'notes',       label: 'Notes',        Icon: FileText    },
      { id: 'reviews',     label: 'Form Reviews', Icon: Video       },
    ],
  },
  {
    label: 'My Gym',
    tabs: [
      { id: 'gym',         label: 'My Gym',       Icon: Building2   },
    ],
  },
];

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export function TrainerDashboard({ currentUser, onNavigate }: Props) {
  const [tab, setTab] = useState('clients');

  return (
    <div className="min-h-full">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-[#080608] border-b border-[rgba(201,169,110,0.08)]">
        <div className="px-6 pt-5 pb-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <Crown className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">Trainer Hub</h1>
            <p className="text-white/30 text-xs">Your professional dashboard</p>
          </div>
        </div>
        {/* Grouped tab navigation */}
        <div className="flex overflow-x-auto scrollbar-hide border-t border-[rgba(201,169,110,0.08)]">
          {TAB_GROUPS.map((group) => (
            <div key={group.label} className="flex items-stretch shrink-0 border-r border-[rgba(201,169,110,0.08)] last:border-r-0">
              {/* Group label */}
              <div className="flex flex-col">
                <span className="px-3 pt-2 pb-0.5 text-[9px] font-semibold uppercase tracking-widest text-white/20 whitespace-nowrap">
                  {group.label}
                </span>
                <div className="flex">
                  {group.tabs.map(({ id, label, Icon }) => (
                    <button key={id} onClick={() => setTab(id)}
                      className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 whitespace-nowrap transition-all ${
                        tab === id ? 'border-amber-500 text-amber-300' : 'border-transparent text-white/35 hover:text-white/65'
                      }`}>
                      <Icon size={12} />{label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tab panels */}
      <div className="max-w-4xl mx-auto">
        {tab === 'clients'     && <ClientsTab     currentUser={currentUser} onNavigate={onNavigate} />}
        {tab === 'bookings'    && <BookingsTab     currentUser={currentUser} />}
        {tab === 'calendar'    && <CalendarTab     currentUser={currentUser} />}
        {tab === 'earnings'    && <EarningsTab     currentUser={currentUser} />}
        {tab === 'notes'       && <NotesTab        currentUser={currentUser} />}
        {tab === 'programs'    && <ProgramsTab     currentUser={currentUser} />}
        {tab === 'marketplace' && <MarketplaceTab  currentUser={currentUser} />}
        {tab === 'reviews'     && <ReviewsTab      currentUser={currentUser} />}
        {tab === 'exercises'   && <ExercisesTab     currentUser={currentUser} />}
        {tab === 'gym'         && <GymOwnerTab     currentUser={currentUser} />}
      </div>
    </div>
  );
}

// ─── Stat mini-card (used in ClientsTab) ─────────────────────────────────────
function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.08)] rounded-xl px-3 py-2 text-center">
      <p className="text-white font-semibold text-sm">{value}</p>
      <p className="text-white/35 text-[10px] mt-0.5">{label}</p>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// CLIENTS TAB — progress dashboard + assign programs
// ════════════════════════════════════════════════════════════════════════════════
function ClientsTab({ currentUser, onNavigate }: { currentUser: User; onNavigate?: (v: string) => void }) {
  const [clients, setClients]     = useState<any[]>([]);
  const [programs, setPrograms]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [assigning, setAssigning] = useState<string | null>(null);
  const [assignNote, setAssignNote]   = useState('');
  const [selectedProg, setSelectedProg] = useState('');

  useEffect(() => {
    Promise.all([
      authFetch(`${API}/users/${currentUser.id}/trainer/clients`).then(r => r.json()),
      authFetch(`${API}/programs/mine`).then(r => r.json()),
    ]).then(([c, p]) => {
      setClients(c.clients || []);
      setPrograms(p.programs || []);
    }).catch(() => toast.error('Failed to load clients'))
    .finally(() => setLoading(false));
  }, [currentUser.id]);

  const handleAssign = async (clientId: string) => {
    if (!selectedProg) { toast.error('Select a program first'); return; }
    try {
      const res = await authFetch(`${API}/trainer/assign-program`, {
        method: 'POST',
        body: JSON.stringify({ clientId, programId: selectedProg, note: assignNote }),
      });
      if (!res.ok) throw new Error();
      toast.success('Program assigned! Client has been notified 💪');
      setAssigning(null); setAssignNote(''); setSelectedProg('');
    } catch { toast.error('Failed to assign program'); }
  };

  if (loading) return <Loader className="py-20" />;

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Client Progress</h2>
        <span className="text-white/30 text-xs">{clients.length} clients</span>
      </div>

      {clients.length === 0 && (
        <Empty icon={<Users className="w-8 h-8" />} text="No clients yet — confirmed bookings will appear here" />
      )}

      <div className="grid gap-3">
        {clients.map(client => {
          const ds = daysSince(client.lastBookingDate);
          const active = ds <= 7;
          return (
            <div key={client.id} className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Avatar className="w-10 h-10">
                  <AvatarImage src={client.avatar} />
                  <AvatarFallback className="bg-amber-600 text-white">{client.displayName?.[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm truncate">{client.displayName}</p>
                  <p className="text-white/40 text-xs">@{client.username} · {client.fitnessGoal || 'No goal set'}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${active ? 'bg-green-500/15 text-green-300 border border-green-500/25' : 'bg-[rgba(201,169,110,0.04)] text-white/25 border border-[rgba(201,169,110,0.07)]'}`}>
                    {active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <Stat label="Sessions" value={client.totalBookings} />
                <Stat label="Recent workouts" value={client.recentWorkouts} />
                <Stat label="Last session" value={ds > 100 ? 'Never' : ds === 0 ? 'Today' : `${ds}d ago`} />
              </div>

              {/* Recent workouts */}
              {client.recentWorkoutNames?.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {client.recentWorkoutNames.map((n: string, i: number) => (
                    <span key={i} className="text-[10px] bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.07)] text-white/40 px-2 py-0.5 rounded-full">{n}</span>
                  ))}
                </div>
              )}

              {/* Assign program */}
              {assigning === client.id ? (
                <div className="bg-white/4 border border-amber-500/20 rounded-xl p-3 space-y-2">
                  <select value={selectedProg} onChange={e => setSelectedProg(e.target.value)}
                    className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-amber-500/50">
                    <option value="">Select a program…</option>
                    {programs.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <input value={assignNote} onChange={e => setAssignNote(e.target.value)}
                    placeholder="Note to client (optional)…"
                    className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none" />
                  <div className="flex gap-2">
                    <button onClick={() => handleAssign(client.id)} className="flex-1 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold">Assign</button>
                    <button onClick={() => setAssigning(null)} className="px-3 py-1.5 rounded-lg bg-[rgba(201,169,110,0.04)] text-white/40 text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setAssigning(client.id)}
                    className="flex-1 py-2 rounded-xl border border-amber-500/20 text-amber-300/70 hover:bg-amber-500/10 text-xs font-medium transition-all flex items-center justify-center gap-1.5">
                    <Dumbbell className="w-3.5 h-3.5" /> Assign Program
                  </button>
                  <button
                    onClick={() => {
                      // Open DMs pre-filtered to this client — navigate to community then let MessagesPage handle it
                      if (onNavigate) onNavigate('community');
                      // Store target so MessagesPage can auto-open the convo
                      sessionStorage.setItem('openDmWith', JSON.stringify({ id: client.id, name: client.displayName, avatar: client.avatar }));
                    }}
                    className="px-4 py-2 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/50 hover:bg-[rgba(201,169,110,0.06)] hover:text-white text-xs font-medium transition-all flex items-center gap-1.5"
                    title="Message client">
                    <MessageCircle className="w-3.5 h-3.5" /> Message
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// BOOKINGS TAB — accept/decline with message
// ════════════════════════════════════════════════════════════════════════════════
function BookingsTab({ currentUser }: { currentUser: User }) {
  const [bookings,    setBookings]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [responding,  setResponding]  = useState<string | null>(null);
  const [respMsg,     setRespMsg]     = useState('');
  const [filter,      setFilter]      = useState<'pending' | 'confirmed' | 'completed' | 'cancelled'>('pending');

  const load = useCallback(async () => {
    const res = await authFetch(`${API}/users/${currentUser.id}/bookings?role=trainer`);
    const data = await res.json();
    setBookings(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [currentUser.id]);

  useEffect(() => { load(); }, [load]);

  const respond = async (bookingId: string, decision: 'confirmed' | 'declined') => {
    try {
      const res = await authFetch(`${API}/bookings/${bookingId}/respond`, {
        method: 'PATCH',
        body: JSON.stringify({ decision, message: respMsg }),
      });
      if (!res.ok) throw new Error();
      toast.success(decision === 'confirmed' ? 'Booking confirmed ✅' : 'Booking declined');
      setResponding(null); setRespMsg('');
      load();
    } catch { toast.error('Failed to respond'); }
  };

  const filtered = bookings.filter(b => b.status === filter);
  const counts   = { pending: bookings.filter(b => b.status === 'pending').length, confirmed: bookings.filter(b => b.status === 'confirmed').length, completed: bookings.filter(b => b.status === 'completed').length, cancelled: bookings.filter(b => b.status === 'cancelled').length };

  const STATUS_COLORS: Record<string, string> = {
    pending:   'bg-amber-500/15 text-amber-300 border-amber-500/25',
    confirmed: 'bg-green-500/15 text-green-300 border-green-500/25',
    completed: 'bg-blue-500/15 text-blue-300 border-blue-500/25',
    cancelled: 'bg-red-500/15 text-red-300 border-red-500/25',
  };

  if (loading) return <Loader className="py-20" />;

  return (
    <div className="px-4 py-6 space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(['pending','confirmed','completed','cancelled'] as const).map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all capitalize ${filter === s ? STATUS_COLORS[s] : 'bg-white/4 border-[rgba(201,169,110,0.07)] text-white/40 hover:text-white/70'}`}>
            {s} {counts[s] > 0 ? `(${counts[s]})` : ''}
          </button>
        ))}
      </div>

      {filtered.length === 0 && <Empty icon={<Calendar className="w-8 h-8" />} text={`No ${filter} bookings`} />}

      <div className="space-y-3">
        {filtered.map(booking => (
          <div key={booking.id} className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-white font-semibold text-sm">{booking.clientName || 'Client'}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${STATUS_COLORS[booking.status]}`}>{booking.status}</span>
                </div>
                <p className="text-white/50 text-xs">{booking.sessionType} · {booking.date} {booking.timeSlot && `at ${booking.timeSlot}`}</p>
                {booking.price > 0 && <p className="text-amber-400 text-xs font-semibold">{fmtMoney(booking.price)}</p>}
                {booking.notes && <p className="text-white/35 text-xs mt-1 italic">"{booking.notes}"</p>}
                {booking.trainerMessage && <p className="text-white/35 text-xs mt-1">Response: "{booking.trainerMessage}"</p>}
              </div>
            </div>

            {booking.status === 'pending' && (
              responding === booking.id ? (
                <div className="space-y-2">
                  <textarea value={respMsg} onChange={e => setRespMsg(e.target.value)} placeholder="Message to client (optional)…" rows={2}
                    className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/20 resize-none focus:outline-none" />
                  <div className="flex gap-2">
                    <button onClick={() => respond(booking.id, 'confirmed')} className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Confirm
                    </button>
                    <button onClick={() => respond(booking.id, 'declined')} className="flex-1 py-2 rounded-xl bg-red-600/70 hover:bg-red-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5" /> Decline
                    </button>
                    <button onClick={() => setResponding(null)} className="px-3 py-2 rounded-xl bg-[rgba(201,169,110,0.04)] text-white/40 text-xs">Cancel</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setResponding(booking.id)} className="w-full py-2 rounded-xl border border-amber-500/25 text-amber-300/70 hover:bg-amber-500/10 text-xs font-semibold transition-all">
                  Respond to Request
                </button>
              )
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// CALENDAR TAB — availability time blocks
// ════════════════════════════════════════════════════════════════════════════════
function CalendarTab({ currentUser }: { currentUser: User }) {
  // blocks[day] = list of { start, end } slots
  const [blocks, setBlocks] = useState<Record<number, { start: string; end: string }[]>>(
    () => {
      const init: Record<number, { start: string; end: string }[]> = {};
      for (let i = 0; i < 7; i++) init[i] = [];
      return init;
    }
  );
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    authFetch(`${API}/users/${currentUser.id}`)
      .then(r => r.json())
      .then(d => {
        const saved = d.trainerInfo?.availabilityBlocks || [];
        const init: Record<number, { start: string; end: string }[]> = {};
        for (let i = 0; i < 7; i++) init[i] = [];
        for (const block of saved) {
          if (block.day >= 0 && block.day <= 6) {
            init[block.day] = block.slots || [];
          }
        }
        setBlocks(init);
        setLoaded(true);
      }).catch(() => setLoaded(true));
  }, [currentUser.id]);

  const addSlot = (day: number) => {
    setBlocks(prev => ({
      ...prev,
      [day]: [...(prev[day] || []), { start: '09:00', end: '17:00' }],
    }));
  };

  const updateSlot = (day: number, idx: number, field: 'start' | 'end', val: string) => {
    setBlocks(prev => ({
      ...prev,
      [day]: prev[day].map((s, i) => i === idx ? { ...s, [field]: val } : s),
    }));
  };

  const removeSlot = (day: number, idx: number) => {
    setBlocks(prev => ({ ...prev, [day]: prev[day].filter((_, i) => i !== idx) }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const blocksArr = Object.entries(blocks)
        .filter(([_, slots]) => slots.length > 0)
        .map(([day, slots]) => ({ day: Number(day), slots }));
      const res = await authFetch(`${API}/users/${currentUser.id}/trainer/availability-blocks`, {
        method: 'PATCH',
        body: JSON.stringify({ blocks: blocksArr }),
      });
      if (!res.ok) throw new Error();
      toast.success('Availability saved!');
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  if (!loaded) return <Loader className="py-20" />;

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg">Availability</h2>
          <p className="text-white/35 text-sm">Set which time slots you're available each week</p>
        </div>
        <button onClick={save} disabled={saving} className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold transition-all">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="space-y-3">
        {DAYS.map((day, di) => (
          <div key={di} className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-3">
              <p className="text-white font-semibold text-sm w-10">{day}</p>
              <button onClick={() => addSlot(di)} className="flex items-center gap-1 text-xs text-amber-300/60 hover:text-amber-300 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add slot
              </button>
              {blocks[di].length > 0 && (
                <span className="ml-auto text-xs text-green-400 font-medium">{blocks[di].length} slot{blocks[di].length > 1 ? 's' : ''}</span>
              )}
            </div>
            {blocks[di].length === 0 && (
              <p className="text-white/20 text-xs">Unavailable — click "Add slot" to open this day</p>
            )}
            <div className="space-y-2">
              {blocks[di].map((slot, si) => (
                <div key={si} className="flex items-center gap-2">
                  <input type="time" value={slot.start} onChange={e => updateSlot(di, si, 'start', e.target.value)}
                    className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500/50 w-28" />
                  <span className="text-white/30 text-xs">to</span>
                  <input type="time" value={slot.end} onChange={e => updateSlot(di, si, 'end', e.target.value)}
                    className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-2 py-1.5 text-white text-xs focus:outline-none focus:border-amber-500/50 w-28" />
                  <button onClick={() => removeSlot(di, si)} className="text-white/20 hover:text-red-400 ml-auto"><X className="w-4 h-4" /></button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// EARNINGS TAB — monthly revenue chart
// ════════════════════════════════════════════════════════════════════════════════
function EarningsTab({ currentUser }: { currentUser: User }) {
  const [data, setData]     = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch(`${API}/users/${currentUser.id}/trainer/earnings`)
      .then(r => r.json()).then(d => setData(d))
      .catch(() => toast.error('Failed to load earnings'))
      .finally(() => setLoading(false));
  }, [currentUser.id]);

  if (loading) return <Loader className="py-20" />;
  if (!data) return <Empty icon={<DollarSign className="w-8 h-8" />} text="No earnings data yet" />;

  const maxRev = Math.max(...(data.monthlyData?.map((m: any) => m.revenue) || [0]), 1);

  return (
    <div className="px-4 py-6 space-y-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: 'Total Revenue', value: fmtMoney(data.totalRevenue || 0), icon: <PoundSterling className="w-4 h-4 text-amber-400" />, sub: 'From bookings' },
          { label: 'Marketplace', value: fmtMoney(data.marketplaceRevenue || 0), icon: <ShoppingBag className="w-4 h-4 text-[#c9a96e]" />, sub: 'Program sales' },
          { label: 'Sessions', value: data.totalSessions || 0, icon: <Calendar className="w-4 h-4 text-blue-400" />, sub: 'Confirmed + completed' },
          { label: 'This month', value: fmtMoney(data.monthlyData?.at(-1)?.revenue || 0), icon: <TrendingUp className="w-4 h-4 text-green-400" />, sub: data.monthlyData?.at(-1)?.month || '' },
        ].map(({ label, value, icon, sub }) => (
          <div key={label} className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-2xl p-4">
            <div className="flex items-center gap-1.5 mb-2">{icon}<span className="text-white/50 text-xs">{label}</span></div>
            <p className="text-white font-bold text-xl">{value}</p>
            <p className="text-white/25 text-[10px] mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      {data.monthlyData?.length > 0 && (
        <div className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-2xl p-4">
          <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-4">Monthly revenue</p>
          <div className="flex items-end gap-2 h-28">
            {data.monthlyData.map((m: any) => {
              const h = Math.max((m.revenue / maxRev) * 100, m.revenue > 0 ? 6 : 0);
              return (
                <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[9px] text-white/30">{m.revenue > 0 ? fmtMoney(m.revenue) : ''}</span>
                  <div className="w-full rounded-t-lg bg-gradient-to-t from-amber-600 to-amber-400 transition-all" style={{ height: `${h}%`, minHeight: m.revenue > 0 ? '4px' : '0' }} />
                  <span className="text-[9px] text-white/25">{m.month?.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// NOTES TAB — private session notes per client
// ════════════════════════════════════════════════════════════════════════════════
function NotesTab({ currentUser }: { currentUser: User }) {
  const [notes,    setNotes]    = useState<any[]>([]);
  const [clients,  setClients]  = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showNew,  setShowNew]  = useState(false);
  const [editing,  setEditing]  = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [form,     setForm]     = useState({ clientId: '', clientName: '', sessionDate: new Date().toISOString().slice(0,10), content: '' });
  const [saving,   setSaving]   = useState(false);
  const [filterClient, setFilterClient] = useState('all');

  const load = useCallback(async () => {
    const [n, c] = await Promise.all([
      authFetch(`${API}/trainer/notes`).then(r => r.json()),
      authFetch(`${API}/users/${currentUser.id}/trainer/clients`).then(r => r.json()),
    ]);
    setNotes(n.notes || []);
    setClients(c.clients || []);
    setLoading(false);
  }, [currentUser.id]);

  useEffect(() => { load(); }, [load]);

  const saveNote = async () => {
    if (!form.clientId || !form.content.trim()) { toast.error('Select a client and add content'); return; }
    setSaving(true);
    try {
      const client = clients.find(c => c.id === form.clientId);
      await authFetch(`${API}/trainer/notes`, { method: 'POST', body: JSON.stringify({ ...form, clientName: client?.displayName || '' }) });
      toast.success('Note saved');
      setShowNew(false); setForm({ clientId: '', clientName: '', sessionDate: new Date().toISOString().slice(0,10), content: '' });
      load();
    } catch { toast.error('Failed to save note'); }
    finally { setSaving(false); }
  };

  const updateNote = async (id: string) => {
    try {
      await authFetch(`${API}/trainer/notes/${id}`, { method: 'PATCH', body: JSON.stringify({ content: editText }) });
      toast.success('Updated'); setEditing(null); load();
    } catch { toast.error('Failed to update'); }
  };

  const deleteNote = async (id: string) => {
    if (!confirm('Delete this note?')) return;
    await authFetch(`${API}/trainer/notes/${id}`, { method: 'DELETE' });
    load();
  };

  const filtered = filterClient === 'all' ? notes : notes.filter(n => n.clientId === filterClient);
  if (loading) return <Loader className="py-20" />;

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-white font-bold text-lg">Session Notes</h2>
        <button onClick={() => setShowNew(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-all">
          <Plus className="w-3.5 h-3.5" /> New Note
        </button>
      </div>

      {showNew && (
        <div className="bg-white/4 border border-amber-500/20 rounded-2xl p-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <select value={form.clientId} onChange={e => setForm(f => ({ ...f, clientId: e.target.value }))}
              className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-amber-500/50 col-span-1">
              <option value="">Select client…</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
            </select>
            <input type="date" value={form.sessionDate} onChange={e => setForm(f => ({ ...f, sessionDate: e.target.value }))}
              className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none" />
          </div>
          <textarea value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
            placeholder="Session notes (private — only visible to you)…" rows={4}
            className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/20 resize-none focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={saveNote} disabled={saving} className="flex-1 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold">
              {saving ? 'Saving…' : 'Save Note'}
            </button>
            <button onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl bg-[rgba(201,169,110,0.04)] text-white/40 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Filter by client */}
      {clients.length > 1 && (
        <select value={filterClient} onChange={e => setFilterClient(e.target.value)}
          className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none w-full">
          <option value="all">All clients</option>
          {clients.map(c => <option key={c.id} value={c.id}>{c.displayName}</option>)}
        </select>
      )}

      {filtered.length === 0 && <Empty icon={<FileText className="w-8 h-8" />} text="No notes yet" />}

      <div className="space-y-3">
        {filtered.map(note => (
          <div key={note.id} className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <p className="text-amber-300 text-xs font-semibold flex-1">{note.clientName}</p>
              <span className="text-white/25 text-[10px]">{fmtDate(note.sessionDate || note.createdAt)}</span>
              <button onClick={() => { setEditing(note.id); setEditText(note.content); }} className="text-white/25 hover:text-white/60"><FileText className="w-3.5 h-3.5" /></button>
              <button onClick={() => deleteNote(note.id)} className="text-white/25 hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
            </div>
            {editing === note.id ? (
              <div className="space-y-2">
                <textarea value={editText} onChange={e => setEditText(e.target.value)} rows={4}
                  className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm resize-none focus:outline-none" />
                <div className="flex gap-2">
                  <button onClick={() => updateNote(note.id)} className="flex-1 py-1.5 rounded-lg bg-amber-600 text-white text-xs font-semibold">Save</button>
                  <button onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-lg bg-[rgba(201,169,110,0.04)] text-white/40 text-xs">Cancel</button>
                </div>
              </div>
            ) : (
              <p className="text-white/60 text-sm leading-relaxed whitespace-pre-wrap">{note.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// PROGRAMS TAB — manage + assign
// ════════════════════════════════════════════════════════════════════════════════
function ProgramsTab({ currentUser }: { currentUser: User }) {
  const [programs,     setPrograms]     = useState<any[]>([]);
  const [assignments,  setAssignments]  = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    Promise.all([
      authFetch(`${API}/programs/mine`).then(r => r.json()),
      authFetch(`${API}/trainer/assigned-programs`).then(r => r.json()),
    ]).then(([p, a]) => {
      setPrograms(p.programs || []);
      setAssignments(a.assignments || []);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader className="py-20" />;

  return (
    <div className="px-4 py-6 space-y-5">
      <div>
        <h2 className="text-white font-bold text-lg mb-1">Your Programs</h2>
        <p className="text-white/35 text-sm">Assign to clients or publish to the marketplace</p>
      </div>

      {programs.length === 0 && <Empty icon={<BookOpen className="w-8 h-8" />} text="No programs yet — create one in the Train tab" />}

      <div className="grid gap-3">
        {programs.map(prog => {
          const assigned = assignments.filter(a => a.programId === prog.id);
          return (
            <div key={prog.id} className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 space-y-2">
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4 h-4 text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-semibold text-sm">{prog.name}</p>
                  <p className="text-white/40 text-xs">{prog.weeks?.length || 0} weeks · {prog.isPublic ? 'Public' : 'Private'}</p>
                </div>
              </div>
              {assigned.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {assigned.map((a: any) => (
                    <span key={a.id} className="text-[10px] bg-green-500/10 border border-green-500/20 text-green-300 px-2 py-0.5 rounded-full">
                      ✓ {a.clientName || a.clientId}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-white/25 text-[10px]">
                {assigned.length} client{assigned.length !== 1 ? 's' : ''} assigned · Go to Clients tab to assign more
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// MARKETPLACE TAB — publish programs for sale
// ════════════════════════════════════════════════════════════════════════════════
function MarketplaceTab({ currentUser }: { currentUser: User }) {
  const [myListings, setMyListings] = useState<any[]>([]);
  const [myPrograms, setMyPrograms] = useState<any[]>([]);
  const [allListings, setAllListings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPublish, setShowPublish] = useState(false);
  const [form, setForm] = useState({ programId: '', price: '', description: '', category: 'strength' });
  const [publishing, setPublishing] = useState(false);
  const [view, setView] = useState<'mine' | 'browse'>('mine');

  const load = useCallback(async () => {
    const [mine, myProgs, all] = await Promise.all([
      authFetch(`${API}/marketplace/programs/mine`).then(r => r.json()),
      authFetch(`${API}/programs/mine`).then(r => r.json()),
      fetch(`${API}/marketplace/programs`).then(r => r.json()),
    ]);
    setMyListings(mine.programs || []);
    setMyPrograms(myProgs.programs || []);
    setAllListings(all.programs || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const publish = async () => {
    if (!form.programId || !form.price) { toast.error('Select a program and set a price'); return; }
    setPublishing(true);
    try {
      const res = await authFetch(`${API}/marketplace/programs`, { method: 'POST', body: JSON.stringify({ ...form, price: Number(form.price) }) });
      if (!res.ok) throw new Error((await res.json()).error);
      toast.success('Program listed on marketplace! 🎉');
      setShowPublish(false); setForm({ programId: '', price: '', description: '', category: 'strength' });
      load();
    } catch (e: any) { toast.error(e.message || 'Failed to publish'); }
    finally { setPublishing(false); }
  };

  if (loading) return <Loader className="py-20" />;

  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg">Program Marketplace</h2>
          <p className="text-white/35 text-sm">Sell your programs to the community</p>
        </div>
        <button onClick={() => setShowPublish(v => !v)} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold transition-all">
          <Plus className="w-3.5 h-3.5" /> Publish
        </button>
      </div>

      {/* Publish form */}
      {showPublish && (
        <div className="bg-white/4 border border-amber-500/20 rounded-2xl p-4 space-y-3">
          <p className="text-amber-300 text-sm font-semibold">Publish a program</p>
          <select value={form.programId} onChange={e => setForm(f => ({ ...f, programId: e.target.value }))}
            className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
            <option value="">Select program…</option>
            {myPrograms.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-white/40 text-xs">Price (£)</label>
              <input type="number" min={1} value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="9.99" className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none" />
            </div>
            <div className="space-y-1">
              <label className="text-white/40 text-xs">Category</label>
              <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
                {['strength','cardio','weight loss','muscle gain','flexibility','general'].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
            placeholder="What's in this program? Who's it for?" rows={2}
            className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/20 resize-none focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={publish} disabled={publishing} className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-sm font-semibold">
              {publishing ? 'Publishing…' : 'Publish listing'}
            </button>
            <button onClick={() => setShowPublish(false)} className="px-4 py-2.5 rounded-xl bg-[rgba(201,169,110,0.04)] text-white/40 text-sm">Cancel</button>
          </div>
        </div>
      )}

      {/* Toggle: my listings vs browse */}
      <div className="flex gap-2">
        {(['mine', 'browse'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-all capitalize ${view === v ? 'bg-amber-500/15 border-amber-500/30 text-amber-300' : 'bg-white/4 border-[rgba(201,169,110,0.07)] text-white/40'}`}>
            {v === 'mine' ? 'My listings' : 'Browse marketplace'}
          </button>
        ))}
      </div>

      {view === 'mine' && (
        <div className="space-y-3">
          {myListings.length === 0 && <Empty icon={<ShoppingBag className="w-8 h-8" />} text="No listings yet — publish your first program above" />}
          {myListings.map(listing => (
            <div key={listing.id} className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 flex items-center gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{listing.name}</p>
                <p className="text-white/40 text-xs">{listing.category} · {listing.weeks} weeks</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-amber-400 font-bold">£{listing.price}</p>
                <p className="text-white/30 text-[10px]">{listing.purchases || 0} purchases</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'browse' && (
        <div className="space-y-3">
          {allListings.length === 0 && <Empty icon={<ShoppingBag className="w-8 h-8" />} text="No programs in the marketplace yet" />}
          {allListings.map(listing => (
            <div key={listing.id} className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 flex items-center gap-3">
              <Avatar className="w-9 h-9 shrink-0">
                <AvatarImage src={listing.trainerAvatar} />
                <AvatarFallback className="bg-amber-600 text-white text-xs">{listing.trainerName?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm">{listing.name}</p>
                <p className="text-white/40 text-xs">{listing.trainerName} · {listing.weeks} weeks · {listing.purchases || 0} sold</p>
              </div>
              <p className="text-amber-400 font-bold shrink-0">£{listing.price}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════════════════
// REVIEWS TAB — video form review requests tagged to trainer
// ════════════════════════════════════════════════════════════════════════════════
function ReviewsTab({ currentUser }: { currentUser: User }) {
  const [clips, setClips] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [commenting, setCommenting] = useState<Record<string, boolean>>({});
  const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
  const [commentTimestamps, setCommentTimestamps] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    // Fetch form-check clips that tag this trainer
    authFetch(`${API}/reels?limit=50`)
      .then(r => r.json())
      .then(d => {
        const formCheckClips = (d.reels || []).filter((r: any) =>
          r.clipMode === 'formCheck' &&
          (r.taggedTrainerId === currentUser.id || r.user?.id !== currentUser.id)
        );
        setClips(formCheckClips);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [currentUser.id]);

  const sendComment = async (clipId: string) => {
    const text = commentTexts[clipId];
    const timestamp = commentTimestamps[clipId] || 0;
    if (!text?.trim()) return;
    setCommenting(c => ({ ...c, [clipId]: true }));
    try {
      await authFetch(`${API}/posts/${clipId}/timestamp-comment`, {
        method: 'POST',
        body: JSON.stringify({ text, timestamp }),
      });
      toast.success('Form review sent! ✅');
      setCommentTexts(c => ({ ...c, [clipId]: '' }));
    } catch { toast.error('Failed to send comment'); }
    finally { setCommenting(c => ({ ...c, [clipId]: false })); }
  };

  if (loading) return <Loader className="py-20" />;

  return (
    <div className="px-4 py-6 space-y-4">
      <div>
        <h2 className="text-white font-bold text-lg">Video Form Reviews</h2>
        <p className="text-white/35 text-sm">Clips marked "Roast my form 😭" — leave timestamped feedback</p>
      </div>

      {clips.length === 0 && (
        <Empty icon={<Video className="w-8 h-8" />} text='No form-check clips yet. When a client uploads a clip tagged "Roast my form 😭", it appears here.' />
      )}

      <div className="space-y-3">
        {clips.map(clip => (
          <div key={clip.id} className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-2xl overflow-hidden">
            {/* Clip header */}
            <div className="flex items-center gap-3 p-4">
              <Avatar className="w-8 h-8 shrink-0">
                <AvatarImage src={clip.user?.avatar} />
                <AvatarFallback className="bg-red-600 text-white text-xs">{clip.user?.name?.[0]}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium">{clip.user?.name}</p>
                <p className="text-red-300/70 text-xs">😭 Roast my form — {clip.timestampComments?.length || 0} comments</p>
              </div>
              {clip.videoUrl && (
                <button onClick={() => setExpanded(e => e === clip.id ? null : clip.id)}
                  className="text-white/30 hover:text-white/60 transition-colors">
                  <ChevronDown className={`w-4 h-4 transition-transform ${expanded === clip.id ? 'rotate-180' : ''}`} />
                </button>
              )}
            </div>

            {expanded === clip.id && (
              <div className="border-t border-[rgba(201,169,110,0.07)] p-4 space-y-3">
                {clip.videoUrl && (
                  <video src={clip.videoUrl} controls className="w-full rounded-xl max-h-64 bg-black" />
                )}
                {clip.caption && <p className="text-white/50 text-xs">{clip.caption}</p>}

                {/* Existing timestamped comments */}
                {(clip.timestampComments || []).slice(0, 5).map((c: any, i: number) => (
                  <div key={i} className="flex gap-2 text-xs">
                    <span className="text-red-300 font-mono">{Math.floor(c.timestamp / 60)}:{String(Math.round(c.timestamp % 60)).padStart(2,'0')}</span>
                    <span className="text-white/50">{c.name}:</span>
                    <span className="text-white/70 flex-1">{c.text}</span>
                  </div>
                ))}

                {/* Add trainer review comment */}
                <div className="space-y-2 pt-1 border-t border-[rgba(201,169,110,0.08)]">
                  <div className="flex items-center gap-2">
                    <input type="number" min={0} value={commentTimestamps[clip.id] || 0}
                      onChange={e => setCommentTimestamps(c => ({ ...c, [clip.id]: Number(e.target.value) }))}
                      className="w-20 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-2 py-1 text-white text-xs text-center focus:outline-none" />
                    <span className="text-white/30 text-xs">seconds — your feedback</span>
                  </div>
                  <div className="flex gap-2">
                    <input value={commentTexts[clip.id] || ''} onChange={e => setCommentTexts(c => ({ ...c, [clip.id]: e.target.value }))}
                      onKeyDown={e => e.key === 'Enter' && sendComment(clip.id)}
                      placeholder="Leave your form feedback…"
                      className="flex-1 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-xs placeholder:text-white/20 focus:outline-none" />
                    <button onClick={() => sendComment(clip.id)} disabled={commenting[clip.id]}
                      className="w-8 h-8 rounded-full bg-amber-600 hover:bg-amber-700 disabled:opacity-50 flex items-center justify-center">
                      {commenting[clip.id] ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white" /> : <Send className="w-3.5 h-3.5 text-white" />}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Reusable micro-components ─────────────────────────────────────────────────
// ════════════════════════════════════════════════════════════════════════════════
// EXERCISES TAB — publish technique guides to the Exercise Library

// ── Reusable micro-components ────────────────────────────────────────────────
function Empty({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-white/20">
      {icon}
      <p className="text-sm text-center max-w-xs">{text}</p>
    </div>
  );
}
function Loader({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <Loader2 className="w-6 h-6 animate-spin text-white/20" />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// EXERCISES TAB
// ══════════════════════════════════════════════════════════════════════════════

const CATEGORIES = ['Strength','Cardio','Mobility','Olympic Lifting','Calisthenics','HIIT','Powerlifting','Yoga','Pilates','Other'];
const DIFFICULTIES = ['Beginner','Intermediate','Advanced','Elite'];
const EQUIPMENT_OPTIONS = ['Barbell','Dumbbell','Kettlebell','Cable','Machine','Resistance Band','Bodyweight','Pull-up Bar','Bench','Smith Machine','Trap Bar'];

const BLANK_FORM = {
  name: '', category: 'Strength', difficulty: 'Intermediate',
  equipment: [] as string[], primaryMuscles: [] as string[], secondaryMuscles: [] as string[],
  videoUrl: '', steps: [''], mistakes: [''], easierVariation: '', harderVariation: '', trainerTip: '',
};

function ExercisesTab({ currentUser }: { currentUser: User }) {
  const [exercises, setExercises] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [view, setView]           = useState<'list' | 'form'>('list');
  const [editing, setEditing]     = useState<string | null>(null);
  const [form, setForm]           = useState({ ...BLANK_FORM });
  const [saving, setSaving]       = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await authFetch(`${API}/exercises/mine`);
      const d = await r.json();
      setExercises(d.exercises || []);
    } catch { toast.error('Failed to load exercises'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing(null); setForm({ ...BLANK_FORM }); setView('form'); };
  const openEdit   = (ex: any) => {
    setEditing(ex.id);
    setForm({
      name: ex.name || '', category: ex.category || 'Strength',
      difficulty: ex.difficulty || 'Intermediate',
      equipment: ex.equipment || [], primaryMuscles: ex.primaryMuscles || [],
      secondaryMuscles: ex.secondaryMuscles || [],
      videoUrl: ex.videoUrl || '',
      steps: ex.steps?.length ? ex.steps : [''],
      mistakes: ex.mistakes?.length ? ex.mistakes : [''],
      easierVariation: ex.easierVariation || '', harderVariation: ex.harderVariation || '',
      trainerTip: ex.trainerTip || '',
    });
    setView('form');
  };

  const deleteEx = async (id: string) => {
    if (!confirm('Delete this exercise?')) return;
    try {
      await authFetch(`${API}/exercises/${id}`, { method: 'DELETE' });
      toast.success('Deleted');
      load();
    } catch { toast.error('Failed to delete'); }
  };

  const save = async () => {
    if (!form.name.trim()) { toast.error('Name required'); return; }
    setSaving(true);
    try {
      const url    = editing ? `${API}/exercises/${editing}` : `${API}/exercises`;
      const method = editing ? 'PATCH' : 'POST';
      const payload = { ...form, variations: [ ...(form.easierVariation.trim() ? [{ name: form.easierVariation.trim(), type: 'easier' }] : []), ...(form.harderVariation.trim() ? [{ name: form.harderVariation.trim(), type: 'harder' }] : []), ] }; await authFetch(url, { method, body: JSON.stringify(payload) });
      toast.success(editing ? 'Exercise updated!' : 'Exercise published!');
      setView('list');
      load();
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  const toggleEquipment = (e: string) =>
    setForm(f => ({ ...f, equipment: f.equipment.includes(e) ? f.equipment.filter(x => x !== e) : [...f.equipment, e] }));
  const togglePrimary = (id: string) =>
    setForm(f => ({
      ...f,
      primaryMuscles: f.primaryMuscles.includes(id) ? f.primaryMuscles.filter(x => x !== id) : [...f.primaryMuscles, id],
      secondaryMuscles: f.secondaryMuscles.filter(x => x !== id),
    }));
  const toggleSecondary = (id: string) =>
    setForm(f => ({
      ...f,
      secondaryMuscles: f.secondaryMuscles.includes(id) ? f.secondaryMuscles.filter(x => x !== id) : [...f.secondaryMuscles, id],
      primaryMuscles: f.primaryMuscles.filter(x => x !== id),
    }));

  const setStep    = (i: number, v: string) => setForm(f => { const s=[...f.steps]; s[i]=v; return {...f,steps:s}; });
  const addStep    = () => setForm(f => ({ ...f, steps: [...f.steps, ''] }));
  const removeStep = (i: number) => setForm(f => ({ ...f, steps: f.steps.filter((_,j)=>j!==i) }));
  const setMistake    = (i: number, v: string) => setForm(f => { const m=[...f.mistakes]; m[i]=v; return {...f,mistakes:m}; });
  const addMistake    = () => setForm(f => ({ ...f, mistakes: [...f.mistakes, ''] }));
  const removeMistake = (i: number) => setForm(f => ({ ...f, mistakes: f.mistakes.filter((_,j)=>j!==i) }));

  if (loading) return <Loader className="py-20" />;

  // ── Form view ──────────────────────────────────────────────────────────────
  if (view === 'form') return (
    <div className="px-4 py-6 space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => setView('list')} className="text-white/40 hover:text-white/70 text-sm transition-colors">← Back</button>
        <h2 className="text-white font-bold text-lg flex-1">{editing ? 'Edit Exercise' : 'New Exercise Guide'}</h2>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm rounded-xl font-medium transition-all">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {editing ? 'Update' : 'Publish'}
        </button>
      </div>

      {/* Name */}
      <div>
        <label className="text-white/50 text-xs font-medium block mb-1.5">Exercise name *</label>
        <input value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))}
          placeholder="e.g. Romanian Deadlift"
          className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-500/50" />
      </div>

      {/* Category + Difficulty */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-white/50 text-xs font-medium block mb-1.5">Category</label>
          <select value={form.category} onChange={e => setForm(f => ({...f, category: e.target.value}))}
            className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50">
            {CATEGORIES.map(c => <option key={c} value={c} className="bg-[#0d0b08]">{c}</option>)}
          </select>
        </div>
        <div>
          <label className="text-white/50 text-xs font-medium block mb-1.5">Difficulty</label>
          <select value={form.difficulty} onChange={e => setForm(f => ({...f, difficulty: e.target.value}))}
            className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:border-amber-500/50">
            {DIFFICULTIES.map(d => <option key={d} value={d} className="bg-[#0d0b08]">{d}</option>)}
          </select>
        </div>
      </div>

      {/* Equipment */}
      <div>
        <label className="text-white/50 text-xs font-medium block mb-2">Equipment</label>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map(e => (
            <button key={e} onClick={() => toggleEquipment(e)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all border ${
                form.equipment.includes(e)
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-[rgba(201,169,110,0.04)] text-white/40 border-[rgba(201,169,110,0.12)] hover:text-white/70'
              }`}>
              {e}
            </button>
          ))}
        </div>
      </div>

      {/* Muscles */}
      <div>
        <label className="text-white/50 text-xs font-medium block mb-2">Muscles worked</label>
        <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-2xl p-3">
          <MuscleSelector
            primary={form.primaryMuscles}
            secondary={form.secondaryMuscles}
            onTogglePrimary={togglePrimary}
            onToggleSecondary={toggleSecondary}
          />
        </div>
      </div>

      {/* Video URL */}
      <div>
        <label className="text-white/50 text-xs font-medium block mb-1.5">Demo video URL (YouTube / direct)</label>
        <input value={form.videoUrl} onChange={e => setForm(f => ({...f, videoUrl: e.target.value}))}
          placeholder="https://youtube.com/..."
          className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-500/50" />
      </div>

      {/* Steps */}
      <div>
        <label className="text-white/50 text-xs font-medium block mb-2">Step-by-step cues</label>
        <div className="space-y-2">
          {form.steps.map((s, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="w-6 h-6 rounded-full bg-[#c9a96e]/40 text-[#e8c98a] text-[10px] font-bold flex items-center justify-center shrink-0">{i+1}</span>
              <input value={s} onChange={e => setStep(i, e.target.value)}
                placeholder={`Step ${i+1}…`}
                className="flex-1 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none" />
              {form.steps.length > 1 && (
                <button onClick={() => removeStep(i)} className="text-white/20 hover:text-red-400 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          <button onClick={addStep} className="text-amber-400/60 hover:text-amber-400 text-xs transition-colors flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add step
          </button>
        </div>
      </div>

      {/* Common mistakes */}
      <div>
        <label className="text-white/50 text-xs font-medium block mb-2">Common mistakes</label>
        <div className="space-y-2">
          {form.mistakes.map((m, i) => (
            <div key={i} className="flex gap-2 items-center">
              <span className="text-amber-400/60 text-xs">⚠</span>
              <input value={m} onChange={e => setMistake(i, e.target.value)}
                placeholder="e.g. Rounding the lower back…"
                className="flex-1 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none" />
              {form.mistakes.length > 1 && (
                <button onClick={() => removeMistake(i)} className="text-white/20 hover:text-red-400 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
          <button onClick={addMistake} className="text-amber-400/60 hover:text-amber-400 text-xs transition-colors flex items-center gap-1">
            <Plus className="w-3 h-3" /> Add mistake
          </button>
        </div>
      </div>

      {/* Variations */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-white/50 text-xs font-medium block mb-1.5 flex items-center gap-1">
            <span className="text-emerald-400">↓</span> Easier variation
          </label>
          <input value={form.easierVariation} onChange={e => setForm(f => ({...f, easierVariation: e.target.value}))}
            placeholder="e.g. Goblet squat"
            className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none" />
        </div>
        <div>
          <label className="text-white/50 text-xs font-medium block mb-1.5 flex items-center gap-1">
            <span className="text-red-400">↑</span> Harder variation
          </label>
          <input value={form.harderVariation} onChange={e => setForm(f => ({...f, harderVariation: e.target.value}))}
            placeholder="e.g. Pause squat"
            className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none" />
        </div>
      </div>

      {/* Trainer tip */}
      <div>
        <label className="text-white/50 text-xs font-medium block mb-1.5">Trainer tip 💡</label>
        <textarea value={form.trainerTip} onChange={e => setForm(f => ({...f, trainerTip: e.target.value}))}
          rows={3} placeholder="Your go-to coaching cue or personal tip…"
          className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none resize-none" />
      </div>

      {/* Save button (bottom) */}
      <button onClick={save} disabled={saving}
        className="w-full py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold rounded-2xl flex items-center justify-center gap-2 transition-all">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {editing ? 'Update Exercise' : 'Publish to Library'}
      </button>
    </div>
  );

  // ── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg">Exercise Library</h2>
          <p className="text-white/35 text-sm">Publish technique guides visible to all users</p>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-sm rounded-xl font-medium transition-all">
          <Plus className="w-4 h-4" /> New Exercise
        </button>
      </div>

      {exercises.length === 0 && (
        <Empty icon={<Dumbbell className="w-8 h-8" />} text="No exercises published yet — create your first guide above" />
      )}

      <div className="space-y-3">
        {exercises.map(ex => (
          <div key={ex.id} className="bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 flex items-center gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-white font-medium text-sm">{ex.name}</p>
                <span className="px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 text-[10px]">{ex.difficulty}</span>
                <span className="px-2 py-0.5 rounded-full bg-[rgba(201,169,110,0.06)] text-white/50 text-[10px]">{ex.category}</span>
              </div>
              <p className="text-white/30 text-xs mt-0.5">
                {(ex.primaryMuscles || []).slice(0,3).join(', ')}{(ex.primaryMuscles||[]).length > 3 ? ` +${(ex.primaryMuscles||[]).length-3}` : ''}
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => openEdit(ex)}
                className="px-3 py-1.5 bg-[rgba(201,169,110,0.06)] hover:bg-white/12 text-white/60 text-xs rounded-xl transition-all">Edit</button>
              <button onClick={() => deleteEx(ex.id)}
                className="w-7 h-7 flex items-center justify-center text-white/20 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// GYM OWNER TAB
// ══════════════════════════════════════════════════════════════════════════════

const AMENITIES = ['Free Weights','Machines','Cardio Zone','Pool','Sauna','Steam Room','Changing Rooms','Showers','Cafe / Smoothie Bar','Personal Training','Group Classes','24/7 Access','Parking','Lockers'];

const BLANK_GYM = {
  name: '', description: '', address: '', city: '', postcode: '', phone: '', website: '', instagram: '',
  monthlyFee: '', dayPass: '', openingHours: '06:00 - 22:00', amenities: [] as string[],
};

function GymOwnerTab({ currentUser }: { currentUser: User }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [gymId, setGymId]     = useState<string | null>(null);
  const [form, setForm]       = useState({ ...BLANK_GYM });
  const [coverUrl, setCoverUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    authFetch(`${API}/trainer/my-gym`)
      .then(r => r.json())
      .then(d => {
        if (d.gym) {
          setGymId(d.gym.id);
          setCoverUrl(d.gym.coverPhoto || '');
          setForm({
            name: d.gym.name || '', description: d.gym.description || '',
            address: d.gym.address || '', city: d.gym.city || '', postcode: d.gym.postcode || '',
            phone: d.gym.phone || '', website: d.gym.website || '', instagram: d.gym.instagram || '',
            monthlyFee: d.gym.monthlyFee || '', dayPass: d.gym.dayPass || '',
            openingHours: d.gym.openingHours || '06:00 - 22:00',
            amenities: d.gym.amenities || [],
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const uploadCover = async (file: File) => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await authFetch(`${API}/upload`, { method: 'POST', body: fd });
      const d = await r.json();
      setCoverUrl(d.url);
    } catch { toast.error('Upload failed'); }
    finally { setUploading(false); }
  };

  const toggleAmenity = (a: string) =>
    setForm(f => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a] }));

  const save = async () => {
    if (!form.name.trim()) { toast.error('Gym name required'); return; }
    setSaving(true);
    try {
      await authFetch(`${API}/trainer/my-gym`, {
        method: 'POST',
        body: JSON.stringify({ ...form, coverPhoto: coverUrl }),
      });
      toast.success(gymId ? 'Gym listing updated!' : 'Gym listing created!');
    } catch { toast.error('Failed to save gym'); }
    finally { setSaving(false); }
  };

  const field = (label: string, key: keyof typeof form, opts?: { placeholder?: string; icon?: ReactNode }) => (
    <div>
      <label className="text-white/50 text-xs font-medium block mb-1.5">{label}</label>
      <div className="relative">
        {opts?.icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/25">{opts.icon}</span>}
        <input value={form[key] as string} onChange={e => setForm(f => ({...f, [key]: e.target.value}))}
          placeholder={opts?.placeholder}
          className={`w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-500/50 ${opts?.icon ? 'pl-9 pr-4' : 'px-4'}`} />
      </div>
    </div>
  );

  if (loading) return <Loader className="py-20" />;

  return (
    <div className="px-4 py-6 space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-bold text-lg">My Gym Listing</h2>
          <p className="text-white/35 text-sm">Your gym appears in the public Gyms directory</p>
        </div>
        <button onClick={save} disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm rounded-xl font-medium transition-all">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
          {gymId ? 'Save Changes' : 'Create Listing'}
        </button>
      </div>

      {/* Cover photo */}
      <div>
        <label className="text-white/50 text-xs font-medium block mb-2">Cover photo</label>
        <div className="relative w-full h-40 rounded-2xl overflow-hidden border border-[rgba(201,169,110,0.12)] bg-[rgba(201,169,110,0.03)]">
          {coverUrl ? (
            <img src={coverUrl} className="w-full h-full object-cover" alt="Cover" />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-white/20">
              <Camera className="w-8 h-8" />
              <span className="text-xs">Add a cover photo</span>
            </div>
          )}
          <label className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 bg-black/60 hover:bg-black/80 text-white text-xs rounded-xl cursor-pointer transition-all">
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
            Upload
            <input type="file" accept="image/*" className="hidden" onChange={e => e.target.files?.[0] && uploadCover(e.target.files[0])} />
          </label>
        </div>
      </div>

      {/* Basic info */}
      {field('Gym name *', 'name', { placeholder: 'e.g. Iron Temple Gym' })}
      <div>
        <label className="text-white/50 text-xs font-medium block mb-1.5">Description</label>
        <textarea value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))}
          rows={3} placeholder="Tell people what makes your gym special…"
          className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-4 py-2.5 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-amber-500/50 resize-none" />
      </div>

      {/* Location */}
      <div className="space-y-3">
        <p className="text-white/50 text-xs font-medium">Location</p>
        {field('Street address', 'address', { placeholder: '123 Gainz Street', icon: <MapPin className="w-3.5 h-3.5" /> })}
        <div className="grid grid-cols-2 gap-3">
          {field('City', 'city', { placeholder: 'London' })}
          {field('Postcode', 'postcode', { placeholder: 'SW1A 1AA' })}
        </div>
      </div>

      {/* Contact */}
      <div className="space-y-3">
        <p className="text-white/50 text-xs font-medium">Contact</p>
        {field('Phone', 'phone', { placeholder: '+44 20 0000 0000', icon: <Phone className="w-3.5 h-3.5" /> })}
        {field('Website', 'website', { placeholder: 'https://yourgym.com', icon: <Globe className="w-3.5 h-3.5" /> })}
        {field('Instagram', 'instagram', { placeholder: '@yourgym', icon: <Instagram className="w-3.5 h-3.5" /> })}
      </div>

      {/* Hours & pricing */}
      <div className="grid grid-cols-3 gap-3">
        {field('Opening hours', 'openingHours', { placeholder: '06:00 - 22:00' })}
        {field('Monthly fee', 'monthlyFee', { placeholder: '£45/mo' })}
        {field('Day pass', 'dayPass', { placeholder: '£10' })}
      </div>

      {/* Amenities */}
      <div>
        <label className="text-white/50 text-xs font-medium block mb-2">Amenities</label>
        <div className="flex flex-wrap gap-2">
          {AMENITIES.map(a => (
            <button
              key={a}
              onClick={() => toggleAmenity(a)}
              className={'px-3 py-1.5 rounded-full text-xs font-medium border transition-all ' + (
                form.amenities.includes(a)
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-200'
                  : 'bg-[rgba(201,169,110,0.04)] border-[rgba(201,169,110,0.12)] text-white/40 hover:border-[rgba(201,169,110,0.25)]'
              )}
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Save button (bottom) */}
      <button
        onClick={save}
        disabled={saving}
        className="w-full py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-semibold text-sm transition-all flex items-center justify-center gap-2"
      >
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        {gymId ? 'Save Changes' : 'Create Listing'}
      </button>
    </div>
  );
}
