// GroupEventsPage.tsx — schedule group workout events inside communities

import { useState, useEffect, useCallback } from 'react';
import {
  Calendar, MapPin, Users, Plus, X, Loader2, Check,
  Clock, ChevronDown, ChevronRight, CalendarCheck,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { toast } from 'sonner';
import { authFetch } from '../../utils/authToken';
import { User } from '../types';

import { API } from '../../config';

interface Props { currentUser: User | null; }

interface Community { id: string; name: string; emoji: string; members: string[]; }
interface Event {
  id: string;
  title: string;
  description: string;
  eventAt: string;
  location: string;
  maxAttendees: number;
  creatorId: string;
  creatorName: string;
  creatorAvatar: string;
  attendees: string[];
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function isPast(iso: string) { return new Date(iso) < new Date(); }

export function GroupEventsPage({ currentUser }: Props) {
  const [communities, setCommunities] = useState<Community[]>([]);
  const [selectedComm, setSelectedComm] = useState<Community | null>(null);
  const [events, setEvents]             = useState<Event[]>([]);
  const [loading, setLoading]           = useState(false);
  const [rsvping, setRsvping]           = useState<Record<string, boolean>>({});
  const [showCreate, setShowCreate]     = useState(false);

  // Create form
  const [form, setForm] = useState({ title: '', description: '', date: '', time: '07:00', location: '', maxAttendees: '' });
  const [creating, setCreating] = useState(false);
  const [showCommPicker, setShowCommPicker] = useState(false);

  // Load joined communities
  useEffect(() => {
    if (!currentUser) return;
    authFetch(`${API}/communities`)
      .then(r => r.json())
      .then(d => {
        const joined = (d.communities || []).filter((c: Community) => c.members?.includes(currentUser.id));
        setCommunities(joined);
        if (joined.length > 0) setSelectedComm(joined[0]);
      })
      .catch(() => toast.error('Failed to load communities'));
  }, [currentUser]);

  const loadEvents = useCallback(async () => {
    if (!selectedComm) return;
    setLoading(true);
    try {
      const res = await authFetch(`${API}/communities/${selectedComm.id}/events`);
      const data = await res.json();
      setEvents(data.events || []);
    } catch { toast.error('Failed to load events'); }
    finally { setLoading(false); }
  }, [selectedComm]);

  useEffect(() => { loadEvents(); }, [loadEvents]);

  const handleRSVP = async (event: Event) => {
    if (!currentUser) return toast.error('Log in to RSVP');
    setRsvping(r => ({ ...r, [event.id]: true }));
    try {
      const res = await authFetch(`${API}/communities/${selectedComm!.id}/events/${event.id}/rsvp`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) { toast.error(data.error || 'Failed'); return; }
      setEvents(prev => prev.map(e => e.id === event.id
        ? { ...e, attendees: data.going
            ? [...e.attendees, currentUser.id]
            : e.attendees.filter(a => a !== currentUser.id) }
        : e));
      toast.success(data.going ? "You're going! 🎉" : 'RSVP removed');
    } catch { toast.error('Failed to RSVP'); }
    finally { setRsvping(r => ({ ...r, [event.id]: false })); }
  };

  const handleCreate = async () => {
    if (!form.title.trim() || !form.date) { toast.error('Title and date required'); return; }
    if (!selectedComm) { toast.error('Select a community'); return; }
    setCreating(true);
    try {
      const eventAt = new Date(`${form.date}T${form.time}`).toISOString();
      const res = await authFetch(`${API}/communities/${selectedComm.id}/events`, {
        method: 'POST',
        body: JSON.stringify({
          title: form.title, description: form.description, eventAt,
          location: form.location, maxAttendees: Number(form.maxAttendees) || 0,
        }),
      });
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return; }
      toast.success('Event created! 📅');
      setShowCreate(false);
      setForm({ title: '', description: '', date: '', time: '07:00', location: '', maxAttendees: '' });
      loadEvents();
    } catch { toast.error('Failed to create event'); }
    finally { setCreating(false); }
  };

  const upcoming = events.filter(e => !isPast(e.eventAt));
  const past     = events.filter(e => isPast(e.eventAt));

  if (!currentUser) {
    return <div className="py-20 text-center text-white/30 text-sm">Log in to see events</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-white font-bold text-xl">Group Events 📅</h2>
          <p className="text-white/40 text-sm mt-0.5">Schedule workouts with your communities</p>
        </div>
        {communities.length > 0 && (
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#c9a96e] hover:bg-[#b8945a] text-white text-xs font-semibold transition-all"
          >
            <Plus className="w-3.5 h-3.5" /> New Event
          </button>
        )}
      </div>

      {/* Community picker */}
      {communities.length > 1 && (
        <div className="relative">
          <button
            onClick={() => setShowCommPicker(v => !v)}
            className="flex items-center gap-2 px-3 py-2 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl text-white/70 text-sm hover:bg-[rgba(201,169,110,0.06)] transition-all"
          >
            <span>{selectedComm?.emoji}</span>
            <span>{selectedComm?.name}</span>
            <ChevronDown className="w-4 h-4 ml-1" />
          </button>
          {showCommPicker && (
            <div className="absolute top-full mt-1 left-0 z-20 bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-xl overflow-hidden shadow-xl w-56">
              {communities.map(c => (
                <button key={c.id} onClick={() => { setSelectedComm(c); setShowCommPicker(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-sm text-left hover:bg-[rgba(201,169,110,0.04)] transition-all ${c.id === selectedComm?.id ? 'text-[#e8c98a]' : 'text-white/70'}`}>
                  <span>{c.emoji}</span><span>{c.name}</span>
                  {c.id === selectedComm?.id && <Check className="w-3.5 h-3.5 ml-auto" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {communities.length === 0 && (
        <div className="py-16 flex flex-col items-center gap-3 text-center">
          <Calendar className="w-10 h-10 text-white/15" />
          <p className="text-white/30 text-sm">Join a community to see and create events</p>
        </div>
      )}

      {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" /></div>}

      {!loading && communities.length > 0 && (
        <>
          {/* Upcoming events */}
          {upcoming.length === 0 && past.length === 0 && (
            <div className="py-12 flex flex-col items-center gap-3 text-center">
              <CalendarCheck className="w-10 h-10 text-white/10" />
              <p className="text-white/30 text-sm">No events yet — be the first to schedule one!</p>
            </div>
          )}

          {upcoming.length > 0 && (
            <div className="space-y-3">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Upcoming</p>
              {upcoming.map(ev => <EventCard key={ev.id} event={ev} currentUser={currentUser} onRSVP={handleRSVP} rsvping={rsvping[ev.id]} />)}
            </div>
          )}

          {past.length > 0 && (
            <div className="space-y-3">
              <p className="text-white/25 text-xs font-semibold uppercase tracking-wider">Past Events</p>
              {past.slice(0, 5).map(ev => <EventCard key={ev.id} event={ev} currentUser={currentUser} onRSVP={handleRSVP} rsvping={false} past />)}
            </div>
          )}
        </>
      )}

      {/* Create modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm px-4">
          <div className="w-full max-w-sm bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold">Create Event</p>
              <button onClick={() => setShowCreate(false)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {[
              { label: 'Event title *', field: 'title', placeholder: 'e.g. Group Run Sunday 7am' },
              { label: 'Description', field: 'description', placeholder: 'What to expect…' },
              { label: 'Location', field: 'location', placeholder: 'Park, gym address, or "Online"' },
            ].map(({ label, field, placeholder }) => (
              <div key={field} className="space-y-1">
                <label className="text-white/40 text-xs">{label}</label>
                <input
                  value={(form as any)[field]}
                  onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
                  placeholder={placeholder}
                  className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm placeholder:text-white/20 focus:outline-none focus:border-[#c9a96e]/50"
                />
              </div>
            ))}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-white/40 text-xs">Date *</label>
                <input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a96e]/50" />
              </div>
              <div className="space-y-1">
                <label className="text-white/40 text-xs">Time</label>
                <input type="time" value={form.time} onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a96e]/50" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-white/40 text-xs">Max attendees (0 = unlimited)</label>
              <input type="number" min={0} value={form.maxAttendees} onChange={e => setForm(f => ({ ...f, maxAttendees: e.target.value }))}
                placeholder="0"
                className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-[#c9a96e]/50" />
            </div>

            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full py-2.5 rounded-xl bg-[#c9a96e] hover:bg-[#b8945a] disabled:opacity-50 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-all"
            >
              {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
              {creating ? 'Creating…' : 'Create Event'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function EventCard({ event, currentUser, onRSVP, rsvping, past = false }: {
  event: Event; currentUser: User; onRSVP: (e: Event) => void; rsvping?: boolean; past?: boolean;
}) {
  const going = event.attendees.includes(currentUser.id);
  const full  = event.maxAttendees > 0 && event.attendees.length >= event.maxAttendees && !going;

  return (
    <div className={`border rounded-2xl p-4 space-y-3 transition-all ${past ? 'bg-white/2 border-[rgba(201,169,110,0.08)] opacity-50' : going ? 'bg-[#c9a96e]/8 border-[#c9a96e]/25' : 'bg-white/4 border-[rgba(201,169,110,0.07)]'}`}>
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${past ? 'bg-[rgba(201,169,110,0.04)]' : 'bg-[#c9a96e]/15'}`}>
          <Calendar className={`w-5 h-5 ${past ? 'text-white/20' : 'text-[#c9a96e]'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white font-semibold text-sm">{event.title}</p>
          {event.description && <p className="text-white/40 text-xs mt-0.5 line-clamp-2">{event.description}</p>}
        </div>
        {going && !past && (
          <span className="flex items-center gap-1 text-[10px] bg-[#c9a96e]/15 text-[#e8c98a] border border-[#c9a96e]/25 px-2 py-0.5 rounded-full font-medium">
            <Check className="w-3 h-3" /> Going
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 text-white/45 text-xs">
        <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDate(event.eventAt)}</span>
        {event.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{event.location}</span>}
        <span className="flex items-center gap-1">
          <Users className="w-3 h-3" />
          {event.attendees.length}{event.maxAttendees > 0 ? ` / ${event.maxAttendees}` : ''} going
        </span>
      </div>

      {!past && (
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <Avatar className="w-5 h-5">
              <AvatarImage src={event.creatorAvatar} />
              <AvatarFallback className="bg-[#c9a96e] text-white text-[8px]">{event.creatorName?.[0]}</AvatarFallback>
            </Avatar>
            <span className="text-white/30 text-[10px]">by {event.creatorName}</span>
          </div>
          <button
            onClick={() => onRSVP(event)}
            disabled={rsvping || full}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              full ? 'bg-[rgba(201,169,110,0.04)] text-white/25 border border-[rgba(201,169,110,0.07)]' :
              going ? 'bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.12)] text-white/60 hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/20' :
              'bg-[#c9a96e] hover:bg-[#b8945a] text-white'
            }`}
          >
            {rsvping ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : full ? 'Full' : going ? "Can't make it" : "I'm going!"}
          </button>
        </div>
      )}
    </div>
  );
}
