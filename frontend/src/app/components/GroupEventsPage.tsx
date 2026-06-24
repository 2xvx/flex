// GroupEventsPage.tsx — redesigned group events feed

import { useState, useEffect, useCallback } from 'react';
import { Calendar, MapPin, Users, Plus, X, Loader2, Check, Clock, Radio, Dumbbell } from 'lucide-react';
import { toast } from 'sonner';
import { authFetch } from '../../utils/authToken';
import { User } from '../types';
import { API } from '../../config';

interface Props { currentUser: User | null; }
interface Community { id: string; name: string; emoji: string; members: string[]; creatorId?: string; }
interface Event {
  id: string; communityId: string; communityName: string;
  title: string; description: string; eventAt: string;
  location: string; maxAttendees: number; eventType?: 'in-person'|'virtual'|'live';
  level?: string; duration?: number;
  creatorId: string; creatorName: string; creatorAvatar: string;
  attendees: string[];
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffH = (d.getTime() - now.getTime()) / 3600000;
  if (diffH > 0 && diffH < 1) return 'Starting soon';
  if (d.toDateString() === now.toDateString()) return 'Today · ' + d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  const tom = new Date(now); tom.setDate(tom.getDate() + 1);
  if (d.toDateString() === tom.toDateString()) return 'Tomorrow · ' + d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }) + ' · ' + d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });
}

function isLive(iso: string) {
  const d = new Date(iso).getTime();
  const now = Date.now();
  return d <= now && d >= now - 7200000; // within last 2 hours
}

function isToday(iso: string) {
  return new Date(iso).toDateString() === new Date().toDateString();
}

function isPast(iso: string) { return new Date(iso) < new Date() && !isLive(iso); }

function initials(name: string) { return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(); }

const AVATAR_COLORS = ['#7c3aed','#0891b2','#b45309','#065f46','#9d174d','#1d4ed8','#b91c1c'];
function avatarColor(str: string) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % AVATAR_COLORS.length; return AVATAR_COLORS[h]; }

export function GroupEventsPage({ currentUser }: Props) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [events, setEvents]           = useState<Event[]>([]);
  const [loading, setLoading]         = useState(true);
  const [rsvping, setRsvping]         = useState<Record<string, boolean>>({});
  const [filter, setFilter]           = useState<'all'|'live'|'today'|'going'>('all');
  const [showCreate, setShowCreate]   = useState(false);
  const [form, setForm] = useState({
    title: '', description: '', date: '', time: '07:00',
    location: '', maxAttendees: '', eventType: 'in-person' as 'in-person'|'virtual'|'live',
    level: 'All levels', duration: '60', communityId: '',
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!currentUser) return;
    setLoading(true);
    authFetch(`${API}/communities`)
      .then(r => r.json())
      .then(async d => {
        const all: Community[] = d.communities || [];
        const joined = all.filter((c: Community) => c.members?.includes(currentUser.id) || c.creatorId === currentUser.id);
        setCommunities(joined);
        if (joined.length === 0) { setLoading(false); return; }
        // Fetch events from all joined communities in parallel
        const results = await Promise.allSettled(
          joined.map(c =>
            authFetch(`${API}/communities/${c.id}/events`)
              .then(r => r.json())
              .then(data => (data.events || []).map((e: Event) => ({ ...e, communityId: c.id, communityName: c.name })))
          )
        );
        const merged: Event[] = [];
        results.forEach(r => { if (r.status === 'fulfilled') merged.push(...r.value); });
        merged.sort((a, b) => new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime());
        setEvents(merged);
        setForm(f => ({ ...f, communityId: joined[0]?.id || '' }));
      })
      .catch(() => toast.error('Failed to load events'))
      .finally(() => setLoading(false));
  }, [currentUser]);

  const handleRSVP = async (event: Event) => {
    if (!currentUser) return;
    setRsvping(r => ({ ...r, [event.id]: true }));
    try {
      const res = await authFetch(`${API}/communities/${event.communityId}/events/${event.id}/rsvp`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed'); return; }
      setEvents(prev => prev.map(e => e.id === event.id
        ? { ...e, attendees: data.going ? [...e.attendees, currentUser.id] : e.attendees.filter(a => a !== currentUser.id) }
        : e));
      toast.success(data.going ? "You're going! 🎉" : 'RSVP removed');
    } catch { toast.error('Failed to RSVP'); }
    finally { setRsvping(r => ({ ...r, [event.id]: false })); }
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.date || !form.communityId) { toast.error('Fill in title, date and community'); return; }
    setCreating(true);
    try {
      const eventAt = new Date(`${form.date}T${form.time}`).toISOString();
      const res = await authFetch(`${API}/communities/${form.communityId}/events`, {
        method: 'POST',
        body: JSON.stringify({
          title: form.title, description: form.description, eventAt,
          location: form.location, maxAttendees: Number(form.maxAttendees) || 0,
          eventType: form.eventType, level: form.level, duration: Number(form.duration) || 60,
        }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return; }
      const created = await res.json();
      const comm = communities.find(c => c.id === form.communityId);
      setEvents(prev => [{ ...created, communityId: form.communityId, communityName: comm?.name || '' }, ...prev]
        .sort((a, b) => new Date(a.eventAt).getTime() - new Date(b.eventAt).getTime()));
      toast.success('Event created!');
      setShowCreate(false);
      setForm(f => ({ ...f, title: '', description: '', date: '', location: '', maxAttendees: '' }));
    } catch { toast.error('Failed to create event'); }
    finally { setCreating(false); }
  };

  const upcoming = events.filter(e => !isPast(e.eventAt));
  const past     = events.filter(e => isPast(e.eventAt)).reverse(); // newest-first
  const myUpcoming = upcoming.filter(e => currentUser && e.attendees.includes(currentUser.id));

  const filtered = (() => {
    if (filter === 'live')  return upcoming.filter(e => isLive(e.eventAt));
    if (filter === 'today') return upcoming.filter(e => isToday(e.eventAt));
    if (filter === 'going') return upcoming.filter(e => currentUser && e.attendees.includes(currentUser.id));
    return upcoming;
  })();

  const liveCount  = upcoming.filter(e => isLive(e.eventAt)).length;
  const todayCount = upcoming.filter(e => isToday(e.eventAt)).length;

  if (!currentUser) return <div className="py-20 text-center text-white/30 text-sm">Log in to see events</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-white font-bold text-xl">Group Events</h2>
          <p className="text-white/40 text-sm mt-0.5">
            {todayCount > 0 ? `${todayCount} happening today` : 'Schedule workouts with your crew'}
          </p>
        </div>
        {communities.length > 0 && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#c9a96e] text-[#0d0b08] text-xs font-semibold hover:opacity-90 transition-all">
            <Plus className="w-3.5 h-3.5" /> Create event
          </button>
        )}
      </div>

      {/* Filter chips */}
      {communities.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {([
            { id: 'all',   label: 'All events', count: upcoming.length },
            { id: 'live',  label: 'Live now',   count: liveCount,  dot: true },
            { id: 'today', label: 'Today',       count: todayCount },
            { id: 'going', label: 'Going',       count: myUpcoming.length },
          ] as const).map(chip => (
            <button key={chip.id} onClick={() => setFilter(chip.id)}
              className={'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border ' +
                (filter === chip.id
                  ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.35)] text-[#c9a96e]'
                  : 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] text-white/45 hover:text-white/70')}>
              {(chip as any).dot && <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />}
              {chip.label}
              {chip.count > 0 && <span className="opacity-60">{chip.count}</span>}
            </button>
          ))}
        </div>
      )}

      {loading && <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" /></div>}

      {/* Empty — not in any community */}
      {!loading && communities.length === 0 && (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <Calendar className="w-10 h-10 text-white/10" />
          <p className="text-white/30 text-sm">Join a community to see and create events</p>
        </div>
      )}

      {/* Events list */}
      {!loading && communities.length > 0 && (
        <>
          {filtered.length === 0 && (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <Calendar className="w-10 h-10 text-white/10" />
              <p className="text-white/30 text-sm">
                {filter === 'live' ? 'No live events right now' : filter === 'today' ? 'Nothing scheduled today' : filter === 'going' ? "You haven't RSVP'd to anything yet" : 'No upcoming events — create one!'}
              </p>
            </div>
          )}

          <div className="space-y-3">
            {filtered.map(ev => (
              <EventCard key={ev.id} event={ev} currentUser={currentUser} onRSVP={handleRSVP} rsvping={!!rsvping[ev.id]} />
            ))}
          </div>

          {/* Past events — only shown on 'all' tab when no upcoming events exist */}
          {filter === 'all' && past.length > 0 && (
            <div className="mt-2">
              <p className="text-white/25 text-[10px] uppercase tracking-wider mb-2">Past events</p>
              <div className="space-y-2">
                {past.slice(0, 5).map(ev => (
                  <div key={ev.id} className="border border-[rgba(255,255,255,0.04)] rounded-xl p-3 opacity-50 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-white/50 text-xs font-medium line-clamp-1">{ev.title}</p>
                      <p className="text-white/25 text-[10px] mt-0.5">{fmtDate(ev.eventAt)} · {ev.communityName}</p>
                    </div>
                    <span className="shrink-0 text-[10px] text-white/20 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] px-2 py-0.5 rounded-full">Ended</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* My upcoming strip */}
          {myUpcoming.length > 0 && filter !== 'going' && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-white/40 text-[10px] uppercase tracking-wider">Your confirmed</p>
                <span className="text-[10px] bg-[rgba(201,169,110,0.12)] text-[#c9a96e] px-2 py-0.5 rounded-full border border-[rgba(201,169,110,0.2)]">{myUpcoming.length} going</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {myUpcoming.slice(0, 4).map(ev => (
                  <div key={ev.id} className="bg-[#0f0d0b] border border-[rgba(201,169,110,0.1)] rounded-xl p-3">
                    <p className="text-white/35 text-[10px] mb-1">{fmtDate(ev.eventAt)}</p>
                    <p className="text-white text-xs font-medium leading-snug mb-1 line-clamp-1">{ev.title}</p>
                    <p className="text-white/25 text-[10px]">{ev.communityName} · {ev.attendees.length} going</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center bg-black/70 px-4" onClick={() => setShowCreate(false)}>
          <div className="w-full max-w-sm bg-[#0d0b08] border border-[rgba(201,169,110,0.15)] rounded-2xl p-5 space-y-3 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold">Create Event</p>
              <button onClick={() => setShowCreate(false)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {/* Community picker */}
            {communities.length > 1 && (
              <div>
                <label className="text-white/40 text-xs block mb-1">Community</label>
                <select value={form.communityId} onChange={e => setForm(f => ({ ...f, communityId: e.target.value }))}
                  className="w-full bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
                  {communities.map(c => <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>)}
                </select>
              </div>
            )}

            <div>
              <label className="text-white/40 text-xs block mb-1">Title *</label>
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="e.g. Sunday Morning Run"
                className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.4)]" />
            </div>

            <div>
              <label className="text-white/40 text-xs block mb-1">Description</label>
              <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="What to expect…"
                className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none resize-none focus:border-[rgba(201,169,110,0.4)]" />
            </div>

            {/* Type pills */}
            <div>
              <label className="text-white/40 text-xs block mb-1.5">Type</label>
              <div className="flex gap-2">
                {(['in-person','virtual','live'] as const).map(t => (
                  <button key={t} onClick={() => setForm(f => ({ ...f, eventType: t }))}
                    className={'flex-1 py-1.5 rounded-lg text-xs font-medium border transition-all ' +
                      (form.eventType === t ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.3)] text-[#c9a96e]' : 'bg-[rgba(255,255,255,0.03)] border-[rgba(255,255,255,0.08)] text-white/40')}>
                    {t === 'in-person' ? '📍 In-person' : t === 'virtual' ? '💻 Virtual' : '🔴 Live'}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-white/40 text-xs block mb-1">Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none" />
              </div>
              <div>
                <label className="text-white/40 text-xs block mb-1">Time</label>
                <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-white/40 text-xs block mb-1">Location</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Gym / Online"
                  className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none" />
              </div>
              <div>
                <label className="text-white/40 text-xs block mb-1">Max spots</label>
                <input type="number" min={0} value={form.maxAttendees} onChange={e => setForm(f => ({ ...f, maxAttendees: e.target.value }))}
                  placeholder="0 = unlimited"
                  className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-white/40 text-xs block mb-1">Level</label>
                <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))}
                  className="w-full bg-[#0d0b08] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none">
                  {['All levels','Beginner','Intermediate','Advanced'].map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/40 text-xs block mb-1">Duration (min)</label>
                <input type="number" min={15} value={form.duration} onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                  className="w-full bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none" />
              </div>
            </div>

            <button onClick={handleCreate} disabled={creating}
              className="w-full py-2.5 rounded-xl bg-[#c9a96e] text-[#0d0b08] font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50">
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              {creating ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ event, currentUser, onRSVP, rsvping }: {
  event: Event; currentUser: User; onRSVP: (e: Event) => void; rsvping: boolean;
}) {
  const going = event.attendees.includes(currentUser.id);
  const full  = event.maxAttendees > 0 && event.attendees.length >= event.maxAttendees && !going;
  const live  = isLive(event.eventAt);
  const spotsLeft = event.maxAttendees > 0 ? event.maxAttendees - event.attendees.length : null;

  return (
    <div className={'border rounded-2xl overflow-hidden transition-all ' +
      (live ? 'border-red-500/20 bg-red-500/5' : going ? 'border-[rgba(201,169,110,0.2)] bg-[rgba(201,169,110,0.04)]' : 'border-[rgba(255,255,255,0.06)] bg-[#0f0d0b]')}>
      <div className="p-4">
        {/* Top row — badges */}
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2 flex-wrap">
            {live && (
              <span className="flex items-center gap-1.5 text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />LIVE
              </span>
            )}
            <span className="text-[10px] text-white/40 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] px-2 py-0.5 rounded-full">
              {live ? `${event.attendees.length} watching` : fmtDate(event.eventAt)}
            </span>
            {event.eventType && !live && (
              <span className="text-[10px] text-white/35 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] px-2 py-0.5 rounded-full">
                {event.eventType === 'in-person' ? '📍' : event.eventType === 'virtual' ? '💻' : '🔴'} {event.eventType}
              </span>
            )}
            {spotsLeft !== null && spotsLeft <= 5 && !full && (
              <span className="text-[10px] font-medium text-green-400 bg-green-500/10 border border-green-500/15 px-2 py-0.5 rounded-full">
                {spotsLeft} spot{spotsLeft !== 1 ? 's' : ''} left
              </span>
            )}
            {full && <span className="text-[10px] text-white/25 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.07)] px-2 py-0.5 rounded-full">Full</span>}
          </div>
          {going && !live && <span className="flex items-center gap-1 text-[10px] text-[#c9a96e]"><Check className="w-3 h-3" /> Going</span>}
        </div>

        {/* Title */}
        <p className="text-white font-semibold text-[15px] leading-snug mb-1">{event.title}</p>
        {event.description && <p className="text-white/40 text-xs mb-2 line-clamp-1">{event.description}</p>}

        {/* Meta row */}
        <div className="flex items-center gap-3 flex-wrap mb-3">
          {event.location && (
            <span className="flex items-center gap-1 text-white/35 text-xs">
              <MapPin className="w-3 h-3" />{event.location}
            </span>
          )}
          {event.duration && (
            <span className="flex items-center gap-1 text-white/35 text-xs">
              <Clock className="w-3 h-3" />{event.duration} min
            </span>
          )}
          {event.level && (
            <span className="flex items-center gap-1 text-white/35 text-xs">
              <Dumbbell className="w-3 h-3" />{event.level}
            </span>
          )}
          <span className="flex items-center gap-1 text-white/35 text-xs">
            <Users className="w-3 h-3" />
            {event.attendees.length}{event.maxAttendees > 0 ? ` / ${event.maxAttendees}` : ''} going
          </span>
        </div>

        {/* Bottom — community + attendee avatars + RSVP */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Stacked avatar circles for first 3 attendees */}
            <div className="flex">
              {event.attendees.slice(0, 3).map((uid, i) => (
                <div key={uid} style={{ marginLeft: i > 0 ? -6 : 0, background: avatarColor(uid), zIndex: 3 - i }}
                  className="w-6 h-6 rounded-full border-2 border-[#0f0d0b] flex items-center justify-center text-white text-[8px] font-medium relative">
                  {uid[0]?.toUpperCase()}
                </div>
              ))}
            </div>
            <span className="text-white/30 text-[11px]">{event.communityName}</span>
          </div>
          <button onClick={() => onRSVP(event)} disabled={rsvping || full}
            className={'px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ' + (
              full ? 'bg-[rgba(255,255,255,0.04)] text-white/20 cursor-not-allowed' :
              live ? 'bg-red-500/15 border border-red-500/25 text-red-400 hover:bg-red-500/25' :
              going ? 'bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] text-white/40 hover:text-red-400 hover:border-red-500/20' :
              'bg-[#c9a96e] text-[#0d0b08] hover:opacity-90')}>
            {rsvping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : full ? 'Full' : live ? 'Join live' : going ? "Can't go" : "I'm going"}
          </button>
        </div>
      </div>
    </div>
  );
}
