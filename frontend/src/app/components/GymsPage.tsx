// GymsPage.tsx
// Browse gyms, check in, see members, view map.
import { useState, useEffect } from 'react';
import { MapPin, Search, Users, CheckCircle2, X, ArrowLeft, ExternalLink, Building2 } from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';
import { User } from '../types';

import { API } from '../../config';

interface Gym {
  id: string;
  name: string;
  address: string;
  city: string;
  country: string;
  description?: string;
  lat?: number;
  lng?: number;
  memberCount?: number;
  photo?: string;
  amenities?: string[];
  rating?: number;
  ratingCount?: number;
  hours?: Record<string, string>;
  createdAt?: string;
}

interface GymMember {
  id: string;
  displayName: string;
  username: string;
  avatar: string;
  fitnessLevel?: string;
  accountType?: string;
}

interface Props { currentUser: User | null; onNavigate?: (v: string) => void; }

const GYM_EMOJIS = ['🏋️', '💪', '🏃', '⚡', '🔥', '🎯'];

export function GymsPage({ currentUser, onNavigate }: Props) {
  const [gyms,        setGyms]        = useState<Gym[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [query,       setQuery]       = useState('');
  const [selected,    setSelected]    = useState<Gym | null>(null);
  const [members,     setMembers]     = useState<GymMember[]>([]);
  const [loadingMem,  setLoadingMem]  = useState(false);
  const [myGym,       setMyGym]       = useState<string>(currentUser?.gym || '');
  const [checkingIn,  setCheckingIn]  = useState(false);

  useEffect(() => { fetchGyms(); }, []);

  const fetchGyms = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/gyms`);
      if (res.ok) { const d = await res.json(); setGyms((d.gyms || []).filter(Boolean)); }
    } catch {}
    finally { setLoading(false); }
  };

  const fetchMembers = async (gym: Gym) => {
    setLoadingMem(true);
    try {
      const res = await fetch(`${API}/gyms/${gym.id}/members`);
      if (res.ok) { const d = await res.json(); setMembers(d.members || []); }
    } catch {}
    finally { setLoadingMem(false); }
  };

  const openGym = (gym: Gym) => {
    setSelected(gym);
    setMembers([]);
    fetchMembers(gym);
  };

  const checkIn = async (gym: Gym) => {
    if (!currentUser) return toast.error('Log in to check in');
    setCheckingIn(true);
    const isAlready = myGym === gym.name;
    try {
      await authFetch(`${API}/users/${currentUser.id}/profile`, {
        method: 'PATCH',
        body: JSON.stringify({ gym: isAlready ? '' : gym.name }),
      });
      setMyGym(isAlready ? '' : gym.name);
      toast.success(isAlready ? 'Checked out' : `Checked in to ${gym.name} 💪`);
      // Refresh members
      fetchMembers(gym);
      // Post a check-in to the social feed (only when checking IN, not out)
      if (!isAlready) {
        try {
          await authFetch(`${API}/posts`, {
            method: 'POST',
            body: JSON.stringify({
              content: `Just checked in at ${gym.name}${gym.city ? ` in ${gym.city}` : ''} 🏋️💪`,
              type: 'checkin',
              gymName: gym.name,
              gymCity: gym.city || '',
            }),
          });
        } catch { /* silently skip — check-in still succeeded */ }
      }
    } catch { toast.error('Failed to check in'); }
    finally { setCheckingIn(false); }
  };


  const filtered = gyms.filter(g =>
    g && (!query ||
      (g.name || '').toLowerCase().includes(query.toLowerCase()) ||
      (g.city || '').toLowerCase().includes(query.toLowerCase()))
  );

  const mapUrl = (gym: Gym) =>
    `https://maps.google.com/maps?q=${encodeURIComponent(`${gym.name} ${gym.address} ${gym.city}`)}&output=embed`;

  const mapsLink = (gym: Gym) =>
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${gym.name} ${gym.address} ${gym.city}`)}`;


  // ── Detail view ─────────────────────────────────────────────────────────────
  if (selected) {
    const isMyGym = myGym === selected.name;
    const emoji = GYM_EMOJIS[(selected.name || 'G').charCodeAt(0) % GYM_EMOJIS.length];
    return (
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-4">
        {/* Back */}
        <div className="flex items-center gap-3">
          <button onClick={() => setSelected(null)}
            className="w-8 h-8 rounded-xl bg-[rgba(201,169,110,0.04)] hover:bg-[rgba(201,169,110,0.08)] flex items-center justify-center text-white/50 hover:text-white transition-all">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <h2 className="text-white font-bold text-lg flex-1 truncate">{selected.name}</h2>
          <a href={mapsLink(selected)} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/50 hover:text-white text-xs transition-all">
            <ExternalLink className="w-3 h-3" /> Maps
          </a>
        </div>

        {/* Hero */}
        <div className="bg-gradient-to-br from-blue-500/15 via-cyan-500/10 to-[#080608] border border-blue-500/20 rounded-2xl overflow-hidden">
          {selected.photo && (
            <div className="w-full h-48 overflow-hidden">
              <img src={selected.photo} alt={selected.name} className="w-full h-full object-cover" />
            </div>
          )}
          <div className="p-5">
          <div className="flex items-start gap-4">
            {!selected.photo && (
              <div className="w-14 h-14 rounded-2xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-3xl shrink-0">
                {emoji}
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-white font-bold text-xl">{selected.name}</h3>
              <div className="flex items-center gap-1.5 mt-1 text-white/50 text-sm">
                <MapPin className="w-3.5 h-3.5" />
                {selected.address && <span>{selected.address}, </span>}
                <span>{selected.city}</span>
                {selected.country && <span>, {selected.country}</span>}
              </div>
              {selected.rating && (
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-yellow-400 text-sm">{'★'.repeat(Math.round(selected.rating))}</span>
                  <span className="text-white/50 text-xs">{selected.rating} · {selected.ratingCount || 0} reviews · {selected.memberCount || 0} members</span>
                </div>
              )}
              {selected.description && <p className="text-white/50 text-sm mt-2 leading-relaxed">{selected.description}</p>}
              {selected.amenities && selected.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {selected.amenities.map(a => (
                    <span key={a} className="text-xs px-2 py-0.5 rounded-full bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] text-[#e8c98a]">{a}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
          {/* Check-in button */}
          <button
            onClick={() => checkIn(selected)}
            disabled={checkingIn}
            className={`mt-4 w-full py-2.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
              isMyGym
                ? 'bg-green-500/15 border border-green-500/30 text-green-300 hover:bg-green-500/25'
                : 'bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25'
            }`}
          >
            {isMyGym ? <><CheckCircle2 className="w-4 h-4" /> My Gym — Click to leave</> : <><MapPin className="w-4 h-4" /> Set as my gym</>}
          </button>
          </div>
        </div>

        {/* Map embed */}
        <div className="rounded-2xl overflow-hidden border border-[rgba(201,169,110,0.07)] h-52">
          <iframe
            title="gym-map"
            src={mapUrl(selected)}
            className="w-full h-full"
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>

        {/* Hours */}
        {selected.hours && Object.keys(selected.hours).length > 0 && (
          <div className="bg-[#080608] border border-[rgba(201,169,110,0.07)] rounded-2xl overflow-hidden">
            <div className="px-4 py-3 border-b border-[rgba(201,169,110,0.08)]">
              <p className="text-white/70 text-sm font-semibold">Opening Hours</p>
            </div>
            <div className="divide-y divide-white/[0.04]">
              {Object.entries(selected.hours).map(([day, hours]) => (
                <div key={day} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-white/50 text-sm capitalize">{day}</span>
                  <span className={`text-sm font-medium ${hours === 'Closed' ? 'text-red-400/70' : 'text-[#e8c98a]'}`}>{hours}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Members */}
        <div className="bg-[#080608] border border-[rgba(201,169,110,0.07)] rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[rgba(201,169,110,0.08)]">
            <div className="flex items-center gap-2 text-white/70 text-sm font-semibold">
              <Users className="w-4 h-4" />
              Members here
              {members.length > 0 && <span className="text-white/30 font-normal">({members.length})</span>}
            </div>
          </div>
          {loadingMem ? (
            <div className="p-6 text-center text-white/25 text-sm">Loading…</div>
          ) : members.length === 0 ? (
            <div className="p-6 text-center">
              <p className="text-white/30 text-sm">No members here yet</p>
              <p className="text-white/20 text-xs mt-1">Be the first to check in!</p>
            </div>
          ) : (
            <div className="divide-y divide-white/[0.04]">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-3 px-4 py-3 hover:bg-white/[0.02] transition-colors">
                  {m.avatar
                    ? <img src={m.avatar} className="w-9 h-9 rounded-full object-cover shrink-0" alt="" />
                    : <div className="w-9 h-9 rounded-full bg-[rgba(201,169,110,0.18)] flex items-center justify-center text-[#e8c98a] font-bold text-sm shrink-0">{m.displayName?.[0]}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-white/85 text-sm font-medium truncate">{m.displayName}</p>
                    <p className="text-white/35 text-xs">@{m.username}{m.fitnessLevel ? ` · ${m.fitnessLevel}` : ''}</p>
                  </div>
                  {m.accountType === 'trainer' && (
                    <span className="text-[10px] bg-[#c9a96e]/15 border border-[#c9a96e]/25 text-[#e8c98a] px-2 py-0.5 rounded-full">Trainer</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── List view ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-br from-blue-500/15 via-cyan-500/10 to-[#080608] border border-blue-500/20 rounded-2xl p-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-xl bg-blue-500/20 border border-blue-500/30 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-blue-400" />
              </div>
              <h2 className="text-white font-bold text-xl">Gyms</h2>
            </div>
            <p className="text-white/40 text-sm">Find gyms, check in, meet members</p>
          </div>
        </div>
        {myGym && (
          <div className="mt-3 flex items-center gap-2 bg-green-500/10 border border-green-500/20 rounded-xl px-3 py-2">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
            <span className="text-green-300 text-xs font-medium">My gym: {myGym}</span>
          </div>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
        <input value={query} onChange={e => setQuery(e.target.value)}
          placeholder="Search by gym name or city…"
          className="w-full bg-[#080608] border border-[rgba(201,169,110,0.07)] rounded-xl pl-9 pr-4 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-blue-500/40"
        />
      </div>

      {/* Gym grid */}
      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="animate-pulse bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-5">
              <div className="flex gap-3">
                <div className="w-12 h-12 rounded-xl bg-[rgba(201,169,110,0.04)]" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-[rgba(201,169,110,0.06)] rounded w-40" />
                  <div className="h-3 bg-[rgba(201,169,110,0.04)] rounded w-56" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-3xl mb-4">🏋️</div>
          <p className="text-white font-semibold mb-1">{query ? 'No gyms found' : 'No gyms yet'}</p>
          <p className="text-white/35 text-sm max-w-xs">
            {query ? `No results for "${query}"` : 'The admin will add gyms to the directory.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(gym => {
            const isMyGym = myGym === gym.name;
            const emoji = GYM_EMOJIS[(gym.name || 'G').charCodeAt(0) % GYM_EMOJIS.length];
            return (
              <div key={gym.id} onClick={() => openGym(gym)}
                className="bg-[#080608] border border-[rgba(201,169,110,0.07)] rounded-2xl overflow-hidden hover:border-[rgba(201,169,110,0.25)] hover:bg-[#0d0b08] transition-all cursor-pointer group">
                {/* Photo banner */}
                {gym.photo && (
                  <div className="w-full h-36 overflow-hidden">
                    <img src={gym.photo} alt={gym.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start gap-3">
                    {!gym.photo && (
                      <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-2xl shrink-0">
                        {emoji}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <h3 className="text-white font-semibold text-sm truncate">{gym.name}</h3>
                        {isMyGym && (
                          <span className="text-[10px] text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                            <CheckCircle2 className="w-2.5 h-2.5" /> My Gym
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-white/40 text-xs mb-1">
                        <MapPin className="w-3 h-3" />
                        {gym.address && <span>{gym.address}, </span>}
                        <span>{gym.city}</span>
                        {gym.country && <span>, {gym.country}</span>}
                      </div>
                      {gym.rating && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-yellow-400 text-xs">{'★'.repeat(Math.round(gym.rating))}</span>
                          <span className="text-white/40 text-xs">{gym.rating} ({gym.ratingCount || 0} reviews)</span>
                        </div>
                      )}
                      {gym.description && <p className="text-white/35 text-xs line-clamp-2 mt-1">{gym.description}</p>}
                      {gym.amenities && gym.amenities.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {gym.amenities.slice(0, 4).map(a => (
                            <span key={a} className="text-[10px] px-1.5 py-0.5 rounded-full bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.12)] text-white/40">{a}</span>
                          ))}
                          {gym.amenities.length > 4 && <span className="text-[10px] text-white/25">+{gym.amenities.length - 4} more</span>}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Gym modal (admin only) */}
    </div>
  );
}
