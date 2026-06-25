// TrainTogetherPage.tsx
// Full "Train Together" flow:
//   1. Location permission + gym picker
//   2. Radar discovery — nearby users with ratings + gym chips
//   3. Pull-in invite → follow prompt on accept
//   4. Live session view with togglable chat
//   5. Post-session rating

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  MapPin, Users, Star, Building2, X, ChevronDown,
  Send, MessageCircle, Dumbbell, UserPlus, LogOut,
  Radio, Check, Loader2, RefreshCw, Flame, Zap, Plus,
  Shield, Trophy, Clock, ChevronRight,
} from 'lucide-react';
import { User } from '../types';
import { authFetch, getAuthToken } from '../../utils/authToken';
import { API } from '../../config';
import { toast } from 'sonner';
import { fireXP, XP_EVENT } from '../../services/xpService';

// ─── Types ────────────────────────────────────────────────────────────────────
interface NearbyUser {
  uid: string;
  name: string;
  username: string;
  avatar: string;
  gym: string | null;
  gymId: string | null;
  workoutType: string | null;
  distance: number | null;
  sameGym: boolean;
  rating: number | null;
  ratingCount: number;
  inSession: boolean;
  sessionId: string | null;
}

interface Gym {
  id: string;
  name: string;
  address: string;
  distance: number | null;
  memberCount: number;
}

interface SessionMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  createdAt: string;
  type: 'chat' | 'event';
}

interface TrainSession {
  id: string;
  createdBy: string;
  creatorName: string;
  creatorAvatar: string;
  gymName: string | null;
  workoutType: string | null;
  participants: string[];
  profiles: Array<{ uid: string; name: string; avatar: string; rating: number | null }>;
  status: string;
  startedAt?: string;
  messages: SessionMessage[];
}

interface Invite {
  id: string;
  sessionId: string;
  fromUid: string;
  fromName: string;
  fromAvatar: string;
  gymName: string | null;
  workoutType: string | null;
  createdAt: string;
}

interface SessionExercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight: number | null;
  addedBy: string;
  completedSets: { [uid: string]: number[] };
}

interface Pact {
  id: string;
  createdBy: string;
  creatorName: string;
  partnerUid: string;
  title: string;
  terms: string;
  xpStake: number;
  deadlineDate: string | null;
  sessionsRequired: number;
  minMinutes: number;
  status: 'pending' | 'active' | 'completed' | 'failed' | 'declined';
  signedBy: string[];
  sessionsCompleted: string[];
  createdAt: string;
}

interface Props {
  currentUser: User | null;
  onOpenDM?: () => void;
}

// ─── Stars helper ─────────────────────────────────────────────────────────────
function StarRating({ rating, count, size = 10 }: { rating: number | null; count?: number; size?: number }) {
  if (!rating) return null;
  return (
    <span className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={size} className={i <= Math.round(rating) ? 'text-[#c9a96e] fill-[#c9a96e]' : 'text-white/15'} />
      ))}
      <span className="text-white/40 ml-1" style={{ fontSize: size - 1 }}>{rating.toFixed(1)}{count ? ` · ${count}` : ''}</span>
    </span>
  );
}

// ─── Avatar initials ──────────────────────────────────────────────────────────
function AvatarCircle({ name, avatar, size = 36, bg = '#c9a96e' }: { name: string; avatar?: string; size?: number; bg?: string }) {
  if (avatar) return <img src={avatar} alt={name} className="rounded-full object-cover shrink-0" style={{ width: size, height: size }} />;
  const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  return (
    <div className="rounded-full flex items-center justify-center shrink-0 font-medium text-[#080608]"
      style={{ width: size, height: size, background: bg, fontSize: size * 0.3 }}>
      {initials}
    </div>
  );
}

// ─── Avatar colours pool ──────────────────────────────────────────────────────
const AVATAR_COLORS = ['#c9a96e','#9b8ec4','#7aaddb','#7ac49b','#e07a7a','#e0b07a'];
function avatarColor(uid: string) { return AVATAR_COLORS[uid.charCodeAt(0) % AVATAR_COLORS.length]; }

// ─── Main component ───────────────────────────────────────────────────────────
export function TrainTogetherPage({ currentUser, onOpenDM }: Props) {
  // ── location / gym ──────────────────────────────────────────────────────────
  const [locStatus, setLocStatus] = useState<'prompt' | 'loading' | 'ready' | 'denied'>('prompt');
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [selectedGym, setSelectedGym] = useState<Gym | null>(null);
  const [showGymPicker, setShowGymPicker] = useState(false);
  const [workoutType, setWorkoutType] = useState('');
  const [available, setAvailable] = useState(true);

  // ── discovery ───────────────────────────────────────────────────────────────
  const [nearbyUsers, setNearbyUsers] = useState<NearbyUser[]>([]);
  const [loadingNearby, setLoadingNearby] = useState(false);
  const [listTab, setListTab] = useState<'all' | 'samegym' | 'friends'>('all');
  const [followingUsers, setFollowingUsers] = useState<NearbyUser[]>([]);
  const [sessionHistory, setSessionHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [pullingUid, setPullingUid] = useState<string | null>(null);
  const [pendingInvites, setPendingInvites] = useState<Invite[]>([]);

  // ── session ─────────────────────────────────────────────────────────────────
  const [session, setSession] = useState<TrainSession | null>(null);
  const [waitingSession, setWaitingSession] = useState<{ id: string; gymName: string | null; invitedUser: { uid: string; name: string; avatar: string } | null } | null>(null);
  const [sessionView, setSessionView] = useState<'workout' | 'chat'>('workout');
  const [chatText, setChatText] = useState('');
  const [sessionTimer, setSessionTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseRef = useRef<EventSource | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── post-session ─────────────────────────────────────────────────────────────
  const [showRating, setShowRating] = useState(false);
  const [ratingTarget, setRatingTarget] = useState<{ uid: string; name: string; sessionId: string } | null>(null);
  const [myRating, setMyRating] = useState(0);
  const [ratingNote, setRatingNote] = useState('');
  const [ratingSubmitted, setRatingSubmitted] = useState(false);

  // ── follow prompt ────────────────────────────────────────────────────────────
  const [showFollowPrompt, setShowFollowPrompt] = useState(false);
  const [followTarget, setFollowTarget] = useState<{ uid: string; name: string; avatar: string; sessionId: string } | null>(null);

  // ── accept invite ─────────────────────────────────────────────────────────────
  const [acceptingInvite, setAcceptingInvite] = useState<Invite | null>(null);

  // ── rival mode ───────────────────────────────────────────────────────────────
  const [myReps, setMyReps] = useState(0);
  const [theirReps, setTheirReps] = useState(0);
  const [hypeLeft, setHypeLeft] = useState(3);
  const [hypeCooling, setHypeCooling] = useState(false);
  const [hypeAnim, setHypeAnim] = useState(false);
  const [momentum, setMomentum] = useState(0);
  const [lockedIn, setLockedIn] = useState(false);
  const [sessionExercises, setSessionExercises] = useState<SessionExercise[]>([]);
  const [showAddEx, setShowAddEx] = useState(false);
  const [newExName, setNewExName] = useState('');
  const [newExSets, setNewExSets] = useState(4);
  const [newExWeight, setNewExWeight] = useState('');

  // ── prophecy ─────────────────────────────────────────────────────────────────
  const [showProphecy, setShowProphecy] = useState(false);
  const [prophecyDone, setProphecyDone] = useState(false);
  const [prophMySets, setProphMySets] = useState('');
  const [prophPartnerSets, setProphPartnerSets] = useState('');
  const [prophDuration, setProphDuration] = useState('');
  const [prophMaxKg, setProphMaxKg] = useState('');

  // ── pacts ────────────────────────────────────────────────────────────────────
  const [pacts, setPacts] = useState<Pact[]>([]);
  const [showCreatePact, setShowCreatePact] = useState(false);
  const [pactTargetUser, setPactTargetUser] = useState<NearbyUser | null>(null);
  const [pactTitle, setPactTitle] = useState('');
  const [pactSessions, setPactSessions] = useState(3);
  const [pactXp, setPactXp] = useState(100);

  // ── Request location ─────────────────────────────────────────────────────────
  const requestLocation = () => {
    setLocStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        setLocStatus('ready');
        fetchGyms(c);
        updateLocation(c, null, null, true);
      },
      () => {
        setLocStatus('denied');
        // still allow app to work without GPS
        fetchGyms(null);
        updateLocation(null, null, null, true);
      },
      { timeout: 8000 }
    );
  };

  const skipLocation = () => {
    setLocStatus('ready');
    fetchGyms(null);
    updateLocation(null, null, null, true);
  };

  // ── Update location on backend ────────────────────────────────────────────────
  const updateLocation = useCallback(async (
    c: { lat: number; lng: number } | null,
    gymId: string | null,
    gymName: string | null,
    avail: boolean
  ) => {
    try {
      await authFetch(`${API}/train-together/location`, {
        method: 'POST',
        body: JSON.stringify({
          lat: c?.lat ?? null, lng: c?.lng ?? null,
          gymId, gymName, workoutType, available: avail,
        }),
      });
    } catch {}
  }, [workoutType]);

  // ── Fetch gyms ───────────────────────────────────────────────────────────────
  const fetchGyms = async (c: { lat: number; lng: number } | null) => {
    try {
      const url = c ? `${API}/train-together/gyms?lat=${c.lat}&lng=${c.lng}` : `${API}/train-together/gyms`;
      const res = await authFetch(url);
      const data = await res.json();
      const gymList: Gym[] = data.gyms || [];
      setGyms(gymList);
      // Auto-select gym if user has one in their profile
      if (!selectedGym && currentUser?.gym && gymList.length > 0) {
        const profileGym = gymList.find(g =>
          g.name.toLowerCase().includes(currentUser.gym!.toLowerCase().split(' ')[0]) ||
          currentUser.gym!.toLowerCase().includes(g.name.toLowerCase().split(' ')[0])
        );
        if (profileGym) setSelectedGym(profileGym);
      }
    } catch {}
  };

  // ── Fetch nearby users ───────────────────────────────────────────────────────
  const fetchNearby = useCallback(async () => {
    setLoadingNearby(true);
    try {
      const params = new URLSearchParams();
      if (coords) { params.set('lat', String(coords.lat)); params.set('lng', String(coords.lng)); }
      if (selectedGym) params.set('gymId', selectedGym.id);
      const res = await authFetch(`${API}/train-together/nearby?${params}`);
      const data = await res.json();
      setNearbyUsers(data.users || []);
    } catch { toast.error('Could not load nearby users'); }
    finally { setLoadingNearby(false); }
  }, [coords, selectedGym]);

  // ── Fetch pending invites ─────────────────────────────────────────────────────
  const fetchInvites = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/train-together/invites`);
      const data = await res.json();
      setPendingInvites(data.invites || []);
    } catch {}
  }, []);

  // Poll invites immediately on mount — so user sees requests even on location screen
  useEffect(() => {
    fetchInvites();
    const interval = setInterval(fetchInvites, 8000);
    return () => clearInterval(interval);
  }, [fetchInvites]);

  // Reconnect to active session on mount (e.g. user navigated away and came back)
  useEffect(() => {
    const savedId = localStorage.getItem('flex_train_session');
    if (!savedId) return;
    authFetch(`${API}/train-together/sessions/${savedId}`)
      .then(r => r.json())
      .then(data => {
        if (data.session && data.session.status === 'active') {
          setSession(data.session);
          setLocStatus('ready');
          startSessionSSE(savedId);
        } else {
          localStorage.removeItem('flex_train_session');
        }
      })
      .catch(() => localStorage.removeItem('flex_train_session'));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll nearby users only once location is granted/skipped
  useEffect(() => {
    if (locStatus === 'ready') {
      fetchNearby();
      const interval = setInterval(fetchNearby, 15000);
      return () => clearInterval(interval);
    }
  }, [locStatus, fetchNearby]);

  // ── Pull in a user — open DM with prefilled context ──────────────────────
  const pullIn = (user: NearbyUser) => {
    if (!currentUser) return;
    setPullingUid(user.uid);
    const parts: string[] = [];
    if (user.gym) parts.push(`📍 ${user.gym}`);
    if (user.workoutType) parts.push(`🏋️ ${user.workoutType}`);
    const context = parts.length > 0 ? ` (${parts.join(' · ')})` : '';
    const prefill = `Hey! Want to train together?${context}`;
    sessionStorage.setItem('openDmWith', JSON.stringify({ id: user.uid }));
    sessionStorage.setItem('openDmPrefill', prefill);
    onOpenDM?.();
    setTimeout(() => setPullingUid(null), 500);
  };

  // ── Join an existing session ──────────────────────────────────────────────────
  const joinSession = async (user: NearbyUser) => {
    if (!user.sessionId) return;
    try {
      const res = await authFetch(`${API}/train-together/sessions/${user.sessionId}/join`, { method: 'POST', body: JSON.stringify({}) });
      const data = await res.json();
      // Show follow prompt first, then enter session
      setFollowTarget({ uid: user.uid, name: user.name, avatar: user.avatar, sessionId: data.session.id });
      setShowFollowPrompt(true);
      // Store session so it loads after follow prompt is dismissed
      setSession(data.session);
      startSessionSSE(data.session.id);
    } catch { toast.error('Could not join session'); }
  };

  // ── Accept invite ─────────────────────────────────────────────────────────────
  const acceptInvite = async (invite: Invite) => {
    setAcceptingInvite(invite);
    try {
      const res = await authFetch(`${API}/train-together/sessions/${invite.sessionId}/join`, {
        method: 'POST', body: JSON.stringify({ inviteId: invite.id }),
      });
      const data = await res.json();
      setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
      // Show follow prompt first, session loads after dismissal
      setFollowTarget({ uid: invite.fromUid, name: invite.fromName, avatar: invite.fromAvatar, sessionId: data.session.id });
      setShowFollowPrompt(true);
      setSession(data.session);
      startSessionSSE(data.session.id);
    } catch { toast.error('Could not accept invite'); }
    finally { setAcceptingInvite(null); }
  };

  const declineInvite = async (invite: Invite) => {
    setPendingInvites(prev => prev.filter(i => i.id !== invite.id));
  };

  // ── Follow ────────────────────────────────────────────────────────────────────
  const followUser = async (uid: string) => {
    try {
      await authFetch(`${API}/users/${uid}/follow`, { method: 'POST' });
      toast.success('Following!');
    } catch {}
    setShowFollowPrompt(false);
  };

  // ── Pacts ─────────────────────────────────────────────────────────────────────
  const fetchPacts = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/train-together/pacts`);
      const data = await res.json();
      setPacts(data.pacts || []);
    } catch {}
  }, []);

  const fetchFollowing = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/train-together/following`);
      const data = await res.json();
      setFollowingUsers(data.users || []);
    } catch {}
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await authFetch(`${API}/train-together/history`);
      const data = await res.json();
      setSessionHistory(data.sessions || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (locStatus === 'ready') { fetchPacts(); fetchFollowing(); fetchHistory(); }
  }, [locStatus, fetchPacts, fetchFollowing, fetchHistory]);

  const createPact = async () => {
    if (!pactTargetUser || !pactTitle.trim()) return;
    try {
      await authFetch(`${API}/train-together/pacts`, {
        method: 'POST',
        body: JSON.stringify({
          partnerUid: pactTargetUser.uid,
          title: pactTitle,
          sessionsRequired: pactSessions,
          xpStake: pactXp,
        }),
      });
      toast.success(`Pact sent to ${pactTargetUser.name}!`);
      setShowCreatePact(false);
      setPactTargetUser(null);
      setPactTitle('');
      fetchPacts();
    } catch { toast.error('Could not create pact'); }
  };

  const signPact = async (pactId: string) => {
    try {
      await authFetch(`${API}/train-together/pacts/${pactId}/sign`, { method: 'POST' });
      toast.success('Pact signed — you are both locked in!');
      fetchPacts();
    } catch { toast.error('Could not sign pact'); }
  };

  // ── Log a rep (Rival Mode) ────────────────────────────────────────────────────
  const logRep = async () => {
    if (!session) return;
    setMyReps(r => r + 1);
    setMomentum(m => { const next = Math.min(100, m + 8); setLockedIn(next >= 85); return next; });
    try {
      await authFetch(`${API}/train-together/sessions/${session.id}/rep`, { method: 'POST' });
    } catch {}
  };

  // ── Send hype ─────────────────────────────────────────────────────────────────
  const sendHype = async () => {
    if (!session || hypeCooling || hypeLeft === 0) return;
    setHypeLeft(h => h - 1);
    setHypeCooling(true);
    setTimeout(() => setHypeCooling(false), 5000);
    setMomentum(m => Math.min(100, m + 15));
    try {
      await authFetch(`${API}/train-together/sessions/${session.id}/hype`, { method: 'POST' });
    } catch {}
  };

  // ── Check off a set ───────────────────────────────────────────────────────────
  const checkSet = async (exId: string, setNum: number) => {
    if (!session) return;
    setSessionExercises(exs => exs.map(ex => {
      if (ex.id !== exId) return ex;
      const uid = currentUser?.id || '';
      const mine = ex.completedSets[uid] || [];
      if (mine.includes(setNum)) return ex;
      return { ...ex, completedSets: { ...ex.completedSets, [uid]: [...mine, setNum] } };
    }));
    setMyReps(r => r + 1);
    setMomentum(m => { const next = Math.min(100, m + 5); setLockedIn(next >= 85); return next; });
    try {
      await authFetch(`${API}/train-together/sessions/${session.id}/exercise/${exId}/set`, {
        method: 'POST', body: JSON.stringify({ setNum }),
      });
    } catch {}
  };

  // ── Add exercise ──────────────────────────────────────────────────────────────
  const addExercise = async () => {
    if (!session || !newExName.trim()) return;
    const newEx: SessionExercise = {
      id: Date.now().toString(), name: newExName,
      sets: newExSets, reps: 8, weight: newExWeight ? parseFloat(newExWeight) : null,
      addedBy: currentUser?.id || '', completedSets: {},
    };
    setSessionExercises(exs => [...exs, newEx]);
    setShowAddEx(false);
    setNewExName(''); setNewExSets(4); setNewExWeight('');
    try {
      await authFetch(`${API}/train-together/sessions/${session.id}/exercise`, {
        method: 'POST', body: JSON.stringify({ name: newEx.name, sets: newEx.sets, weight: newEx.weight }),
      });
    } catch {}
  };

  // ── Submit prophecy ───────────────────────────────────────────────────────────
  const submitProphecy = async () => {
    if (!session) return;
    setProphecyDone(true);
    setShowProphecy(false);
    try {
      await authFetch(`${API}/train-together/sessions/${session.id}/prophecy`, {
        method: 'POST',
        body: JSON.stringify({
          mySets: parseInt(prophMySets) || 0,
          partnerSets: parseInt(prophPartnerSets) || 0,
          durationMin: parseInt(prophDuration) || 0,
          partnerMaxKg: parseFloat(prophMaxKg) || 0,
        }),
      });
    } catch {}
  };

  // ── Session SSE ────────────────────────────────────────────────────────────────
  const startSessionSSE = (sessionId: string) => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    localStorage.setItem('flex_train_session', sessionId);
    const token = getAuthToken();
    if (!token) return;
    const sse = new EventSource(`${API}/train-together/sessions/${sessionId}/stream?token=${encodeURIComponent(token)}`);
    sseRef.current = sse;
    sse.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type === 'update') {
          const s = msg.session;
          if (s.status === 'active') {
            setWaitingSession(null);
            setSession(s);
            // Sync rep counts
            if (s.repCounts) {
              const uid = localStorage.getItem('flex_uid') || '';
              const myR = s.repCounts[uid] || 0;
              const theirR = Object.entries(s.repCounts as Record<string,number>)
                .filter(([k]) => k !== uid).reduce((a,[,v]) => a + v, 0);
              setMyReps(myR);
              setTheirReps(theirR);
            }
            // Sync exercises
            if (s.exercises) setSessionExercises(s.exercises);
            // Detect hype burst (new hype from partner)
            if (s.hypes && s.hypes.length > 0) {
              const last = s.hypes[s.hypes.length - 1];
              const uid = localStorage.getItem('flex_uid') || '';
              if (last.fromUid !== uid) {
                setHypeAnim(true);
                setTimeout(() => setHypeAnim(false), 800);
              }
            }
            // Show prophecy modal on first activation
            setShowProphecy(prev => {
              if (!prev && !prophecyDone) return true;
              return prev;
            });
          } else if (s.status === 'ended') {
            endSessionLocally();
          } else {
            setWaitingSession(prev => prev ? { ...prev } : prev);
          }
        }
        if (msg.type === 'ended') endSessionLocally();
      } catch {}
    };
    // Start timer
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setSessionTimer(s => s + 1), 1000);
  };

  // ── End session ───────────────────────────────────────────────────────────────
  const endSession = async () => {
    if (!session) return;
    try {
      await authFetch(`${API}/train-together/sessions/${session.id}/leave`, { method: 'POST' });
    } catch {}
    // Award XP for completing a train-together session (idempotent per session)
    if (currentUser?.id && sessionTimer > 60) {
      fireXP(currentUser.id, XP_EVENT.TRAIN_TOGETHER, `train_session_${session.id}`);
    }
    endSessionLocally();
  };

  const endSessionLocally = () => {
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setSessionTimer(0);
    setWaitingSession(null);
    localStorage.removeItem('flex_train_session');
    // Show rating for partner
    if (session) {
      const partner = session.profiles?.find(p => p.uid !== currentUser?.id);
      if (partner) {
        setRatingTarget({ uid: partner.uid, name: partner.name, sessionId: session.id });
        setShowRating(true);
      }
    }
    setSession(null);
  };

  useEffect(() => {
    return () => {
      if (sseRef.current) sseRef.current.close();
      if (timerRef.current) clearInterval(timerRef.current);
      // Mark unavailable on unmount
      authFetch(`${API}/train-together/location`, { method: 'DELETE' }).catch(() => {});
    };
  }, []);

  // ── Send chat message ─────────────────────────────────────────────────────────
  const sendChat = async () => {
    if (!chatText.trim() || !session) return;
    const text = chatText.trim();
    setChatText('');
    try {
      await authFetch(`${API}/train-together/sessions/${session.id}/messages`, {
        method: 'POST', body: JSON.stringify({ text }),
      });
    } catch { toast.error('Message failed'); }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.messages]);

  // ── Submit rating ─────────────────────────────────────────────────────────────
  const submitRating = async () => {
    if (!ratingTarget || myRating === 0) return;
    try {
      await authFetch(`${API}/train-together/sessions/${ratingTarget.sessionId}/rate`, {
        method: 'POST',
        body: JSON.stringify({ targetUid: ratingTarget.uid, rating: myRating, note: ratingNote }),
      });
      setRatingSubmitted(true);
      toast.success('Rating submitted!');
    } catch { toast.error('Failed to submit rating'); }
  };

  // ── Timer format ──────────────────────────────────────────────────────────────
  const fmtTimer = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // SCREENS
  // ─────────────────────────────────────────────────────────────────────────────

  // ── Create Pact modal ────────────────────────────────────────────────────────
  if (showCreatePact && pactTargetUser) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex flex-col px-6 pt-8">
        <button onClick={() => setShowCreatePact(false)} className="self-start text-white/30 mb-6 flex items-center gap-1 text-sm">
          <ChevronRight size={14} className="rotate-180" /> Back
        </button>
        <div className="flex items-center gap-3 mb-6">
          <AvatarCircle name={pactTargetUser.name} avatar={pactTargetUser.avatar} size={44} bg={avatarColor(pactTargetUser.uid)} />
          <div>
            <p className="text-white font-medium text-sm">Make a pact with {pactTargetUser.name}</p>
            <p className="text-white/35 text-xs mt-0.5">Both stake XP. Miss it, both lose. Honor it, both win double.</p>
          </div>
        </div>

        <div className="bg-white/[0.02] border border-white/[0.06] rounded-2xl p-5 flex flex-col gap-4">
          <div>
            <p className="text-white/40 text-[10px] mb-1.5 uppercase tracking-wider">Pact title</p>
            <input
              className="w-full bg-white/[0.05] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 outline-none"
              placeholder='e.g. "Train 3x this week"'
              value={pactTitle}
              onChange={e => setPactTitle(e.target.value)}
            />
          </div>
          <div>
            <p className="text-white/40 text-[10px] mb-1.5 uppercase tracking-wider">Sessions required</p>
            <div className="flex gap-2">
              {[2,3,4,5].map(n => (
                <button key={n} onClick={() => setPactSessions(n)}
                  className={`flex-1 py-2.5 rounded-xl text-sm border font-medium ${pactSessions === n ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.3)] text-[#c9a96e]' : 'border-white/[0.07] text-white/30'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-white/40 text-[10px] mb-1.5 uppercase tracking-wider">XP stake (each)</p>
            <div className="flex gap-2">
              {[50, 100, 200, 500].map(n => (
                <button key={n} onClick={() => setPactXp(n)}
                  className={`flex-1 py-2.5 rounded-xl text-sm border font-medium ${pactXp === n ? 'bg-[rgba(201,169,110,0.12)] border-[rgba(201,169,110,0.3)] text-[#c9a96e]' : 'border-white/[0.07] text-white/30'}`}>
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 bg-white/[0.03] rounded-xl p-3">
            <div className="text-center">
              <p className="text-[#4ade80] text-lg font-bold">+{pactXp * 2}</p>
              <p className="text-white/30 text-[10px]">XP if you honor it</p>
            </div>
            <div className="text-center">
              <p className="text-red-400 text-lg font-bold">-{pactXp}</p>
              <p className="text-white/30 text-[10px]">XP if anyone misses</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={() => setShowCreatePact(false)} className="flex-1 py-3.5 rounded-xl border border-white/[0.08] text-white/40 text-sm">Cancel</button>
          <button onClick={createPact} disabled={!pactTitle.trim()}
            className="flex-[2] py-3.5 rounded-xl bg-[rgba(201,169,110,0.12)] border border-[rgba(201,169,110,0.25)] text-[#c9a96e] text-sm font-medium disabled:opacity-40">
            Send pact to {pactTargetUser.name}
          </button>
        </div>
      </div>
    );
  }

  // ── Post-session rating screen ────────────────────────────────────────────────
  if (showRating && ratingTarget) {
    return (
      <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-sm">
          <h2 className="text-white text-lg font-medium mb-1 text-center">Session done!</h2>
          <p className="text-white/40 text-sm text-center mb-6">
            {Math.floor(sessionTimer / 60)} min with {ratingTarget.name}
          </p>

          {!ratingSubmitted ? (
            <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-5">
              <p className="text-white text-sm font-medium mb-4">
                Rate {ratingTarget.name} as a training partner
              </p>
              <div className="flex gap-2 mb-4">
                {[1,2,3,4,5].map(i => (
                  <button key={i} onClick={() => setMyRating(i)}>
                    <Star size={28} className={i <= myRating ? 'text-[#c9a96e] fill-[#c9a96e]' : 'text-white/20'} />
                  </button>
                ))}
              </div>
              <textarea
                className="w-full bg-white/[0.04] border border-white/[0.07] rounded-xl p-3 text-sm text-white placeholder-white/30 outline-none resize-none h-20 mb-4"
                placeholder="Leave a note (optional)…"
                value={ratingNote}
                onChange={e => setRatingNote(e.target.value)}
              />
              <button
                onClick={submitRating}
                disabled={myRating === 0}
                className="w-full bg-[#c9a96e] text-[#080608] rounded-xl py-3 text-sm font-medium disabled:opacity-40"
              >
                Submit rating
              </button>
            </div>
          ) : (
            <div className="bg-white/[0.04] border border-white/[0.07] rounded-2xl p-5 text-center">
              <Check size={32} className="text-[#c9a96e] mx-auto mb-2" />
              <p className="text-white text-sm font-medium">Rating submitted</p>
            </div>
          )}

          <button
            onClick={() => setShowRating(false)}
            className="w-full mt-3 text-white/40 text-sm py-2"
          >
            Back to discover
          </button>
        </div>
      </div>
    );
  }

  // ── Waiting for partner screen ────────────────────────────────────────────────
  if (waitingSession && !session) {
    const invited = waitingSession.invitedUser;
    return (
      <div className="min-h-[calc(100vh-120px)] flex flex-col items-center justify-center px-6 text-center">
        {/* Pulsing rings around invited user avatar */}
        <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full border-2 border-[rgba(201,169,110,0.25)] animate-ping" style={{ animationDuration: '1.8s' }} />
          <div className="absolute rounded-full border-2 border-[rgba(201,169,110,0.15)] animate-ping" style={{ width: 104, height: 104, top: -4, left: -4, animationDuration: '1.8s', animationDelay: '0.6s' }} />
          {invited ? (
            <AvatarCircle name={invited.name} avatar={invited.avatar} size={96} bg={avatarColor(invited.uid)} />
          ) : (
            <div className="w-24 h-24 rounded-full bg-[rgba(201,169,110,0.1)] border border-[rgba(201,169,110,0.2)] flex items-center justify-center">
              <Users size={32} className="text-[#c9a96e]" />
            </div>
          )}
        </div>

        <h2 className="text-white text-lg font-medium mb-2">
          {invited ? `Waiting for ${invited.name}…` : 'Session open — waiting for someone to join…'}
        </h2>
        <p className="text-white/40 text-sm mb-1">
          {invited ? "They'll get a notification to join your session." : 'Pull in someone from the list below or share your session.'}
        </p>
        {waitingSession.gymName && (
          <div className="flex items-center gap-1.5 text-white/30 text-xs mb-8">
            <Building2 size={12} />
            {waitingSession.gymName}
          </div>
        )}

        {/* Animated dots */}
        <div className="flex gap-1.5 mb-10">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-2 h-2 rounded-full bg-[#c9a96e]/60 animate-bounce" style={{ animationDelay: `${i * 0.2}s` }} />
          ))}
        </div>

        {/* Follow prompt if invited someone */}
        {invited && (
          <div className="w-full max-w-xs bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 mb-4">
            <p className="text-white/50 text-xs mb-3">While you wait — do you want to follow {invited.name}?</p>
            <div className="flex gap-2">
              <button
                onClick={() => followUser(invited.uid)}
                className="flex-1 bg-[rgba(201,169,110,0.12)] text-[#c9a96e] border border-[rgba(201,169,110,0.2)] rounded-xl py-2 text-xs font-medium flex items-center justify-center gap-1.5"
              >
                <UserPlus size={13} /> Follow
              </button>
              <button className="flex-1 bg-white/[0.04] text-white/35 border border-white/[0.06] rounded-xl py-2 text-xs">
                Skip
              </button>
            </div>
          </div>
        )}

        <button
          onClick={async () => {
            // Cancel — leave the session
            try { await authFetch(`${API}/train-together/sessions/${waitingSession.id}/leave`, { method: 'POST' }); } catch {}
            if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
            if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
            setWaitingSession(null);
          }}
          className="text-white/30 text-sm border border-white/[0.07] rounded-xl px-6 py-2.5"
        >
          Cancel
        </button>
      </div>
    );
  }

  // ── Active session screen ─────────────────────────────────────────────────────
  if (session) {
    const partner = session.profiles?.find(p => p.uid !== currentUser?.id);
    const chatMessages = (session.messages || []).slice().sort((a, b) => a.createdAt.localeCompare(b.createdAt));

    return (
      <>
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Header */}
        <div className="bg-[rgba(201,169,110,0.06)] border-b border-[rgba(201,169,110,0.1)] px-4 py-2.5 flex items-center gap-2 shrink-0">
          <span className="flex items-center gap-1 text-red-400 text-xs shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            Rival Mode
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-white/50 text-xs truncate">{session.gymName || 'No gym selected'}</p>
          </div>
          {!prophecyDone && (
            <button
              onClick={() => setShowProphecy(true)}
              className="flex items-center gap-1 bg-[rgba(127,119,221,0.1)] border border-[rgba(127,119,221,0.2)] text-[#AFA9EC] rounded-lg px-2 py-1 text-[10px] font-medium shrink-0"
            >
              <Trophy size={10} /> Prophecy
            </button>
          )}
          <button
            onClick={() => setSessionView(v => v === 'workout' ? 'chat' : 'workout')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs border transition-colors shrink-0 ${
              sessionView === 'chat'
                ? 'bg-[rgba(201,169,110,0.15)] text-[#c9a96e] border-[rgba(201,169,110,0.25)]'
                : 'bg-white/[0.05] text-white/50 border-white/[0.07]'
            }`}
          >
            <MessageCircle size={12} />
            Chat
            {(session.messages?.filter(m => m.type === 'chat').length || 0) > 0 && (
              <span className="bg-[#c9a96e] text-[#080608] text-[9px] rounded-full px-1 ml-0.5">
                {session.messages?.filter(m => m.type === 'chat').length}
              </span>
            )}
          </button>
        </div>

        {sessionView === 'workout' ? (
          /* ── Rival Mode workout view ── */
          <div className="flex-1 overflow-y-auto">

            {/* VS card — tug of war */}
            <div className="mx-4 mt-4 bg-white/[0.03] border border-[rgba(201,169,110,0.12)] rounded-2xl p-4">
              <div className="flex items-center gap-3">
                {/* Me */}
                <div className="flex-1 flex flex-col items-center gap-1.5">
                  <div className={`transition-transform duration-200 ${hypeAnim ? 'scale-125' : 'scale-100'}`}>
                    <AvatarCircle name={currentUser?.name || 'Me'} avatar={currentUser?.avatar} size={42} bg="#888" />
                  </div>
                  <span className="text-white/60 text-xs">You</span>
                  <span className={`text-2xl font-bold ${myReps >= theirReps ? 'text-[#c9a96e]' : 'text-white/35'}`}>{myReps}</span>
                </div>
                {/* Center */}
                <div className="flex flex-col items-center gap-1">
                  <span className="text-white/20 text-xs font-bold tracking-widest">VS</span>
                  <span className="text-white/30 text-[10px]">{fmtTimer(sessionTimer)}</span>
                </div>
                {/* Partner */}
                {partner && (
                  <div className="flex-1 flex flex-col items-center gap-1.5">
                    <div className={`transition-transform duration-200 ${hypeAnim ? '' : ''}`}>
                      <AvatarCircle name={partner.name} avatar={partner.avatar} size={42} bg={avatarColor(partner.uid)} />
                    </div>
                    <span className="text-white/60 text-xs truncate max-w-[70px] text-center">{partner.name}</span>
                    <span className={`text-2xl font-bold ${theirReps > myReps ? 'text-[#9b8ec4]' : 'text-white/35'}`}>{theirReps}</span>
                  </div>
                )}
              </div>
              {/* Tug-of-war bar */}
              <div className="mt-3 h-2 bg-white/[0.05] rounded-full overflow-hidden relative">
                {(() => {
                  const total = myReps + theirReps || 1;
                  const myPct = Math.round((myReps / total) * 100);
                  return (
                    <>
                      <div className="absolute left-0 top-0 h-full bg-[#c9a96e] rounded-full transition-all duration-500" style={{ width: myPct + '%' }} />
                      <div className="absolute right-0 top-0 h-full bg-[#9b8ec4] rounded-full transition-all duration-500" style={{ width: (100 - myPct) + '%' }} />
                    </>
                  );
                })()}
                <div className="absolute left-1/2 top-0 h-full w-0.5 bg-[#0a080c] -translate-x-px" />
              </div>
              <div className="flex justify-between mt-1 text-[9px] text-white/20">
                <span>You winning</span><span>{partner?.name} winning</span>
              </div>
            </div>

            {/* Momentum meter */}
            <div className="mx-4 mt-3">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white/30 text-[10px] uppercase tracking-wider">Session momentum</span>
                <span className="text-[10px] text-[#c9a96e] font-medium">{Math.round(momentum)}%</span>
              </div>
              <div className="h-1.5 bg-white/[0.05] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${lockedIn ? 'bg-[#4ade80]' : 'bg-[#c9a96e]'}`}
                  style={{ width: momentum + '%' }}
                />
              </div>
              {lockedIn && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Zap size={11} className="text-[#4ade80]" />
                  <span className="text-[#4ade80] text-[10px] font-medium">Locked in — both of you are on fire</span>
                </div>
              )}
            </div>

            {/* Exercise tracker */}
            <div className="mx-4 mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-white/30 text-[10px] uppercase tracking-wider">Workout tracker</span>
                <button onClick={() => setShowAddEx(true)} className="flex items-center gap-1 text-[#c9a96e] text-xs">
                  <Plus size={11} /> Add
                </button>
              </div>
              {sessionExercises.length === 0 && (
                <button
                  onClick={() => setShowAddEx(true)}
                  className="w-full border border-dashed border-white/[0.08] rounded-xl py-4 text-white/25 text-xs flex items-center justify-center gap-2"
                >
                  <Plus size={13} /> Add your first exercise
                </button>
              )}
              <div className="flex flex-col gap-2">
                {sessionExercises.map(ex => {
                  const myDone = ex.completedSets[currentUser?.id || ''] || [];
                  const allDone = myDone.length >= ex.sets;
                  return (
                    <div key={ex.id} className={`rounded-xl border px-3.5 py-2.5 ${allDone ? 'border-[rgba(74,222,128,0.2)] bg-[rgba(74,222,128,0.04)]' : 'border-white/[0.06] bg-white/[0.02]'}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <p className="text-white text-xs font-medium">{ex.name}</p>
                          <p className="text-white/30 text-[10px]">{ex.sets} sets{ex.weight ? ` · ${ex.weight} kg` : ''}</p>
                        </div>
                        {allDone && <Check size={14} className="text-[#4ade80]" />}
                      </div>
                      <div className="flex gap-1.5">
                        {Array.from({ length: ex.sets }, (_, i) => {
                          const setNum = i + 1;
                          const iDone = myDone.includes(setNum);
                          return (
                            <button
                              key={i}
                              onClick={() => checkSet(ex.id, setNum)}
                              disabled={iDone}
                              className={`w-7 h-7 rounded-lg text-[10px] font-semibold border transition-all ${
                                iDone
                                  ? 'bg-[#4ade80]/15 border-[#4ade80]/30 text-[#4ade80]'
                                  : 'border-white/[0.1] text-white/30 hover:border-white/20'
                              }`}
                            >
                              {iDone ? '✓' : setNum}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Add exercise sheet */}
            {showAddEx && (
              <div className="mx-4 mt-3 bg-[rgba(201,169,110,0.05)] border border-[rgba(201,169,110,0.15)] rounded-xl p-4">
                <p className="text-white text-sm font-medium mb-3">Add exercise</p>
                <input
                  className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 outline-none mb-2"
                  placeholder="Exercise name (e.g. Bench Press)"
                  value={newExName}
                  onChange={e => setNewExName(e.target.value)}
                />
                <div className="flex gap-2 mb-3">
                  <div className="flex-1">
                    <p className="text-white/30 text-[10px] mb-1">Sets</p>
                    <div className="flex gap-1">
                      {[3,4,5,6].map(n => (
                        <button key={n} onClick={() => setNewExSets(n)}
                          className={`flex-1 py-1.5 rounded-lg text-xs border ${newExSets === n ? 'bg-[rgba(201,169,110,0.15)] border-[rgba(201,169,110,0.3)] text-[#c9a96e]' : 'border-white/[0.08] text-white/40'}`}>
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="w-24">
                    <p className="text-white/30 text-[10px] mb-1">Weight (kg)</p>
                    <input
                      className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-2 py-1.5 text-sm text-white outline-none"
                      placeholder="80"
                      value={newExWeight}
                      onChange={e => setNewExWeight(e.target.value)}
                      type="number"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowAddEx(false)} className="flex-1 py-2 rounded-lg border border-white/[0.08] text-white/40 text-xs">Cancel</button>
                  <button onClick={addExercise} disabled={!newExName.trim()} className="flex-1 py-2 rounded-lg bg-[rgba(201,169,110,0.15)] border border-[rgba(201,169,110,0.25)] text-[#c9a96e] text-xs font-medium disabled:opacity-40">Add</button>
                </div>
              </div>
            )}

            {/* Action row — Hype + Log Rep */}
            <div className="mx-4 mt-4 flex gap-3">
              <button
                onClick={sendHype}
                disabled={hypeCooling || hypeLeft === 0}
                className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-medium transition-all ${
                  hypeCooling || hypeLeft === 0
                    ? 'bg-white/[0.02] border-white/[0.05] text-white/20'
                    : 'bg-red-500/[0.08] border-red-500/[0.2] text-red-400 active:scale-95'
                }`}
              >
                <Flame size={15} />
                Hype
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${hypeLeft > 0 ? 'bg-red-500/15 text-red-400' : 'bg-white/[0.05] text-white/20'}`}>
                  {hypeLeft}
                </span>
              </button>
              <button
                onClick={logRep}
                className="flex-[1.4] flex items-center justify-center gap-2 py-3 rounded-xl bg-[rgba(201,169,110,0.12)] border border-[rgba(201,169,110,0.25)] text-[#c9a96e] text-sm font-bold active:scale-95 transition-transform"
              >
                + Rep
              </button>
            </div>

            {/* End session */}
            <div className="mx-4 mt-3 mb-6">
              <button
                onClick={endSession}
                className="w-full flex items-center justify-center gap-2 bg-red-500/[0.06] text-red-400/70 border border-red-500/[0.1] rounded-xl py-3 text-sm"
              >
                <LogOut size={13} /> End session
              </button>
            </div>
          </div>
        ) : (
          /* ── Chat view ── */
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-2">
              {chatMessages.length === 0 && (
                <p className="text-white/25 text-xs text-center py-6">No messages yet. Say hi!</p>
              )}
              {chatMessages.map(msg => {
                const isOwn = msg.senderId === currentUser?.id;
                if (msg.type === 'event') {
                  return (
                    <div key={msg.id} className="flex justify-center">
                      <span className="bg-[rgba(201,169,110,0.1)] text-[#c9a96e] rounded-full px-3 py-1 text-xs">{msg.text}</span>
                    </div>
                  );
                }
                return (
                  <div key={msg.id} className="flex gap-2 items-end">
                    <AvatarCircle
                      name={isOwn ? (currentUser?.name || 'Me') : (partner?.name || 'Partner')}
                      avatar={isOwn ? currentUser?.avatar : partner?.avatar}
                      size={24}
                      bg={isOwn ? '#888' : avatarColor(partner?.uid || '')}
                    />
                    <div className="flex flex-col max-w-[75%]">
                      <span className="text-white/35 text-[9px] mb-0.5 ml-1">{isOwn ? 'You' : partner?.name}</span>
                      <div className={`rounded-2xl px-3 py-2 ${
                        isOwn
                          ? 'bg-[#c9a96e]/90 text-[#080608] rounded-tl-sm'
                          : 'bg-white/[0.07] text-white rounded-tl-sm'
                      }`}>
                        <p className="text-xs leading-relaxed">{msg.text}</p>
                        <p className={`text-[9px] mt-0.5 ${isOwn ? 'text-[#080608]/50' : 'text-white/30'}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>
            {/* Input */}
            <div className="px-3 pb-4 pt-2 border-t border-white/[0.05] flex gap-2 items-center shrink-0">
              <input
                className="flex-1 bg-white/[0.05] border border-white/[0.08] rounded-full px-3.5 py-2 text-sm text-white placeholder-white/30 outline-none"
                placeholder={`Message ${partner?.name || ''}…`}
                value={chatText}
                onChange={e => setChatText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendChat()}
              />
              <button
                onClick={sendChat}
                disabled={!chatText.trim()}
                className="w-8 h-8 rounded-full bg-[#c9a96e] flex items-center justify-center shrink-0 disabled:opacity-40"
              >
                <Send size={13} className="text-[#080608]" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Prophecy modal ── */}
      {showProphecy && !prophecyDone && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-md bg-[#0f0d12] border border-[rgba(127,119,221,0.2)] rounded-t-3xl p-6 pb-8">
            <div className="flex items-center gap-2 mb-1">
              <Trophy size={16} className="text-[#AFA9EC]" />
              <p className="text-white font-medium">Session Prophecy</p>
            </div>
            <p className="text-white/40 text-xs mb-5 leading-relaxed">
              Predict how the session will go. Accuracy gets revealed at the end — builds your Chemistry score with {partner?.name}.
            </p>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <p className="text-white/30 text-[10px] mb-1 uppercase tracking-wider">My total sets</p>
                <input className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none" placeholder="14" type="number" value={prophMySets} onChange={e => setProphMySets(e.target.value)} />
              </div>
              <div>
                <p className="text-white/30 text-[10px] mb-1 uppercase tracking-wider">{partner?.name ?? 'Partner'}'s sets</p>
                <input className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none" placeholder="12" type="number" value={prophPartnerSets} onChange={e => setProphPartnerSets(e.target.value)} />
              </div>
              <div>
                <p className="text-white/30 text-[10px] mb-1 uppercase tracking-wider">Duration (min)</p>
                <input className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none" placeholder="60" type="number" value={prophDuration} onChange={e => setProphDuration(e.target.value)} />
              </div>
              <div>
                <p className="text-white/30 text-[10px] mb-1 uppercase tracking-wider">{partner?.name ?? 'Partner'}'s max kg</p>
                <input className="w-full bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white outline-none" placeholder="85" type="number" value={prophMaxKg} onChange={e => setProphMaxKg(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => { setProphecyDone(true); setShowProphecy(false); }} className="flex-1 py-2.5 rounded-xl border border-white/[0.08] text-white/35 text-sm">Skip</button>
              <button onClick={submitProphecy} className="flex-[2] py-2.5 rounded-xl bg-[rgba(127,119,221,0.15)] border border-[rgba(127,119,221,0.25)] text-[#AFA9EC] text-sm font-medium">Lock in prediction</button>
            </div>
          </div>
        </div>
      )}
      </>
  );
  }

  // ── Location permission screen ────────────────────────────────────────────────
  if (locStatus === 'prompt' || locStatus === 'loading') {
    // Fake orbiting user dots for visual life
    const ORBIT_DOTS = [
      { label: 'AK', color: '#7c3aed', angle: 30,  r: 110 },
      { label: 'SJ', color: '#0891b2', angle: 105, r: 130 },
      { label: 'MR', color: '#b45309', angle: 200, r: 108 },
      { label: 'TN', color: '#065f46', angle: 270, r: 128 },
      { label: 'YL', color: '#9d174d', angle: 340, r: 115 },
    ];
    return (
      <div className="min-h-[calc(100vh-120px)] flex flex-col overflow-hidden relative">

        {/* ── Full-bleed ambient glow ── */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute left-1/2 top-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ width: 480, height: 480, background: 'radial-gradient(circle, rgba(201,169,110,0.09) 0%, transparent 70%)', filter: 'blur(2px)' }} />
          <div className="absolute left-1/2 top-[28%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ width: 260, height: 260, background: 'radial-gradient(circle, rgba(201,169,110,0.13) 0%, transparent 65%)' }} />
        </div>

        {/* Invite banner */}
        {pendingInvites.length > 0 && (() => {
          const invite = pendingInvites[0];
          return (
            <div className="mx-6 mt-4 mb-2 bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.25)] rounded-xl p-3.5 flex items-center gap-3 z-10">
              <span className="w-2 h-2 rounded-full bg-[#c9a96e] animate-pulse shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">{invite.fromName} wants to train with you!</p>
                <p className="text-white/40 text-xs">{invite.gymName || invite.workoutType || 'Session invite'}</p>
              </div>
              <button onClick={() => acceptInvite(invite)} disabled={!!acceptingInvite}
                className="bg-[#c9a96e] text-[#080608] rounded-lg px-3 py-1.5 text-xs font-medium shrink-0">
                {acceptingInvite?.id === invite.id ? <Loader2 size={12} className="animate-spin" /> : 'Accept'}
              </button>
              <button onClick={() => declineInvite(invite)} className="text-white/30 shrink-0"><X size={14} /></button>
            </div>
          );
        })()}

        <div className="flex-1 flex flex-col items-center justify-center text-center px-6 relative z-10">

          {/* ── Radar canvas ── */}
          <div className="relative flex items-center justify-center mb-6" style={{ width: 300, height: 300 }}>

            {/* Animated CSS radar sweep */}
            <style>{`
              @keyframes radarSweep {
                from { transform: rotate(0deg); }
                to   { transform: rotate(360deg); }
              }
              @keyframes dotPulse {
                0%,100% { transform: scale(1);   opacity: 1;   }
                50%      { transform: scale(1.35); opacity: 0.7; }
              }
              @keyframes orbitFloat {
                0%,100% { transform: translateY(0px);   }
                50%      { transform: translateY(-5px);  }
              }
            `}</style>

            {/* Grid circles */}
            {[150, 110, 70, 36].map(r => (
              <div key={r} className="absolute rounded-full border border-[rgba(201,169,110,0.10)]"
                style={{ width: r * 2, height: r * 2 }} />
            ))}

            {/* Cross-hair lines */}
            <div className="absolute" style={{ width: 300, height: 1, background: 'rgba(201,169,110,0.07)' }} />
            <div className="absolute" style={{ width: 1, height: 300, background: 'rgba(201,169,110,0.07)' }} />

            {/* Radar sweep cone */}
            <div className="absolute inset-0 rounded-full overflow-hidden" style={{ animation: 'radarSweep 3s linear infinite' }}>
              <div className="absolute inset-0" style={{
                background: 'conic-gradient(from 0deg, rgba(201,169,110,0.22) 0deg, rgba(201,169,110,0.08) 30deg, transparent 80deg)',
                borderRadius: '50%',
              }} />
            </div>

            {/* Orbiting user dots */}
            {ORBIT_DOTS.map(({ label, color, angle, r }) => {
              const rad = (angle * Math.PI) / 180;
              const x = 150 + r * Math.cos(rad);
              const y = 150 + r * Math.sin(rad);
              return (
                <div key={label} className="absolute flex items-center justify-center rounded-full text-white text-[9px] font-bold"
                  style={{
                    width: 28, height: 28,
                    left: x - 14, top: y - 14,
                    background: color,
                    border: '2px solid rgba(255,255,255,0.15)',
                    boxShadow: `0 0 10px ${color}66`,
                    animation: `orbitFloat ${2.2 + (angle % 5) * 0.2}s ease-in-out infinite`,
                    animationDelay: `${(angle % 7) * 0.15}s`,
                  }}>
                  {label}
                </div>
              );
            })}

            {/* Center pin */}
            <div className="relative flex flex-col items-center justify-center rounded-full z-10"
              style={{
                width: 68, height: 68,
                background: 'linear-gradient(145deg, rgba(201,169,110,0.22) 0%, rgba(201,169,110,0.08) 100%)',
                border: '2px solid rgba(201,169,110,0.45)',
                boxShadow: '0 0 32px rgba(201,169,110,0.25), inset 0 1px 0 rgba(255,255,255,0.10)',
                animation: 'dotPulse 2s ease-in-out infinite',
              }}>
              {locStatus === 'loading'
                ? <Loader2 size={26} className="text-[#c9a96e] animate-spin" />
                : <MapPin size={26} className="text-[#c9a96e]" fill="rgba(201,169,110,0.2)" />}
            </div>

            {/* Live badge */}
            <div className="absolute flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold"
              style={{ top: 16, right: 36, background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.3)', color: '#4ade80' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              5 active nearby
            </div>
          </div>

          {/* ── Heading ── */}
          <h2 className="text-white font-bold text-2xl mb-2 tracking-tight">Find Training Partners</h2>
          <p className="text-white/45 text-[13px] mb-7 max-w-[260px] leading-relaxed">
            See who's lifting near you right now — same gym, same energy.
          </p>

          {/* ── Gym picker preview ── */}
          <div className="w-full max-w-sm mb-6 rounded-2xl overflow-hidden"
            style={{ background: 'linear-gradient(135deg, rgba(201,169,110,0.07) 0%, rgba(255,255,255,0.02) 100%)', border: '1px solid rgba(201,169,110,0.16)' }}>
            <div className="px-4 pt-4 pb-3">
              <p className="text-[#c9a96e] text-[10px] uppercase tracking-widest font-semibold mb-3">Where are you training?</p>
              <div className="flex flex-wrap gap-2">
                {['FitLife', "Gold's Gym", 'MacFit', 'Home workout'].map(g => (
                  <span key={g} className="px-3 py-1.5 rounded-full text-xs font-medium text-white/55"
                    style={{ background: 'rgba(201,169,110,0.09)', border: '1px solid rgba(201,169,110,0.18)' }}>
                    {g}
                  </span>
                ))}
              </div>
            </div>
            <div className="px-4 py-2.5 flex items-center gap-1.5 border-t border-[rgba(201,169,110,0.08)]">
              <MapPin size={10} className="text-[#c9a96e] shrink-0" />
              <p className="text-white/28 text-[11px]">Local gyms load after allowing access</p>
            </div>
          </div>

          {/* ── CTA buttons ── */}
          <button onClick={requestLocation} disabled={locStatus === 'loading'}
            className="w-full max-w-sm rounded-2xl py-3.5 text-sm font-bold mb-3 disabled:opacity-60 transition-all active:scale-[0.98]"
            style={{ background: 'linear-gradient(135deg, #d4aa6e 0%, #c9a96e 55%, #b8923a 100%)', color: '#080608', boxShadow: '0 4px 28px rgba(201,169,110,0.35), 0 1px 0 rgba(255,255,255,0.15) inset' }}>
            {locStatus === 'loading' ? (
              <span className="flex items-center justify-center gap-2"><Loader2 size={14} className="animate-spin" /> Getting location…</span>
            ) : (
              <span className="flex items-center justify-center gap-2"><MapPin size={14} /> Allow location access</span>
            )}
          </button>
          <button onClick={skipLocation}
            className="w-full max-w-sm rounded-2xl py-3 text-sm text-white/35 font-medium hover:text-white/55 transition-colors"
            style={{ border: '1px solid rgba(255,255,255,0.07)' }}>
            Skip for now
          </button>
        </div>
      </div>
    );
  }

  // ── Follow prompt overlay ──────────────────────────────────────────────────────
  const FollowPromptOverlay = () => {
    if (!showFollowPrompt || !followTarget) return null;
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-6">
        <div className="bg-[#111011] border border-white/[0.08] rounded-2xl p-6 w-full max-w-xs text-center">
          {/* Pulsing rings */}
          <div className="relative w-20 h-20 mx-auto mb-4">
            <div className="absolute inset-0 rounded-full border-2 border-[rgba(201,169,110,0.2)] animate-ping" />
            <AvatarCircle name={followTarget.name} avatar={followTarget.avatar} size={80} bg={avatarColor(followTarget.uid)} />
          </div>
          <p className="text-white text-base font-medium mb-1">{followTarget.name} accepted!</p>
          <p className="text-white/40 text-xs mb-5">Follow them to train together again easily.</p>
          <div className="flex gap-2">
            <button
              onClick={() => followUser(followTarget.uid)}
              className="flex-1 bg-[#c9a96e] text-[#080608] rounded-xl py-2.5 text-sm font-medium flex items-center justify-center gap-1.5"
            >
              <UserPlus size={14} /> Follow
            </button>
            <button
              onClick={() => setShowFollowPrompt(false)}
              className="flex-1 bg-white/[0.05] text-white/50 border border-white/[0.07] rounded-xl py-2.5 text-sm"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    );
  };

  // ── Invite banner ──────────────────────────────────────────────────────────────
  const InviteBanner = () => {
    if (pendingInvites.length === 0) return null;
    const invite = pendingInvites[0];
    return (
      <div className="mx-4 mb-3 bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.2)] rounded-xl p-3 flex items-center gap-3">
        <div className="relative w-1.5 h-1.5 rounded-full bg-[#c9a96e] animate-pulse" />
        <div className="flex-1 min-w-0">
          <p className="text-white text-xs font-medium truncate">{invite.fromName} wants to train!</p>
          <p className="text-white/40 text-[10px]">{invite.gymName || invite.workoutType || 'Session invite'}</p>
        </div>
        <button
          onClick={() => acceptInvite(invite)}
          disabled={!!acceptingInvite}
          className="bg-[#c9a96e] text-[#080608] rounded-lg px-2.5 py-1.5 text-xs font-medium shrink-0"
        >
          {acceptingInvite?.id === invite.id ? <Loader2 size={12} className="animate-spin" /> : 'Accept'}
        </button>
        <button onClick={() => declineInvite(invite)} className="text-white/30 shrink-0">
          <X size={14} />
        </button>
      </div>
    );
  };

  // ── Discovery screen (main) ────────────────────────────────────────────────────
  const sameGymUsers = nearbyUsers.filter(u => u.sameGym);
  const displayedUsers = listTab === 'samegym' ? sameGymUsers : listTab === 'friends' ? followingUsers : nearbyUsers;

  return (
    <>
      <FollowPromptOverlay />

      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Top bar */}
        <div className="px-4 pt-4 pb-2 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-white text-lg font-medium">Train Together</h1>
            <p className="text-white/40 text-xs">
              {nearbyUsers.length > 0 ? `${nearbyUsers.length} available nearby` : 'Finding people near you…'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Availability toggle */}
            <button
              onClick={() => {
                const next = !available;
                setAvailable(next);
                updateLocation(coords, selectedGym?.id || null, selectedGym?.name || null, next);
                toast.success(next ? "You're now visible to others" : 'You are now hidden');
              }}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs border transition-colors ${
                available
                  ? 'bg-[rgba(122,196,155,0.1)] text-[#7ac49b] border-[rgba(122,196,155,0.2)]'
                  : 'bg-white/[0.04] text-white/35 border-white/[0.07]'
              }`}
            >
              <Radio size={11} />
              {available ? 'Visible' : 'Hidden'}
            </button>
            <button onClick={fetchNearby} className="text-white/30 hover:text-white/60">
              <RefreshCw size={15} className={loadingNearby ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Gym selector */}
        <div className="px-4 mb-3 shrink-0">
          <button
            onClick={() => setShowGymPicker(v => !v)}
            className="w-full flex items-center gap-2.5 bg-white/[0.03] border border-white/[0.07] rounded-xl px-3.5 py-2.5"
          >
            <Building2 size={15} className="text-[#c9a96e] shrink-0" />
            <div className="flex-1 text-left min-w-0">
              <p className="text-white/30 text-[9px] uppercase tracking-widest">Current gym</p>
              <p className="text-white text-sm truncate">{selectedGym?.name || 'Select a gym'}</p>
            </div>
            <ChevronDown size={14} className={`text-white/30 transition-transform ${showGymPicker ? 'rotate-180' : ''}`} />
          </button>

          {showGymPicker && (
            <div className="mt-1 bg-[#111011] border border-white/[0.08] rounded-xl overflow-hidden">
              {gyms.length === 0 && (
                <p className="text-white/30 text-xs px-4 py-3">No gyms found nearby</p>
              )}
              {gyms.map(gym => (
                <button
                  key={gym.id}
                  onClick={() => {
                    setSelectedGym(gym);
                    setShowGymPicker(false);
                    updateLocation(coords, gym.id, gym.name, available);
                    fetchNearby();
                  }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04] border-b border-white/[0.04] last:border-0"
                >
                  <span className={`w-2 h-2 rounded-full shrink-0 ${selectedGym?.id === gym.id ? 'bg-[#c9a96e]' : 'bg-white/20'}`} />
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-white text-xs truncate">{gym.name}</p>
                    <p className="text-white/35 text-[10px]">
                      {gym.distance !== null ? `${gym.distance} km away` : ''}{gym.memberCount ? ` · ${gym.memberCount} members` : ''}
                    </p>
                  </div>
                  {selectedGym?.id === gym.id && <Check size={13} className="text-[#c9a96e] shrink-0" />}
                </button>
              ))}
              <button
                onClick={() => { setSelectedGym(null); setShowGymPicker(false); updateLocation(coords, null, null, available); fetchNearby(); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-white/[0.04]"
              >
                <span className="w-2 h-2 rounded-full bg-white/20 shrink-0" />
                <p className="text-white/50 text-xs">Home workout / no gym</p>
              </button>
            </div>
          )}
        </div>

        {/* Workout type input */}
        <div className="px-4 mb-3 shrink-0">
          <input
            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl px-3.5 py-2 text-sm text-white placeholder-white/25 outline-none"
            placeholder="What are you training? (e.g. Push day, Legs…)"
            value={workoutType}
            onChange={e => setWorkoutType(e.target.value)}
            onBlur={() => updateLocation(coords, selectedGym?.id || null, selectedGym?.name || null, available)}
          />
        </div>

        {/* Invite banner */}
        <InviteBanner />

        {/* Tabs */}
        <div className="flex px-4 gap-0 border-b border-white/[0.05] shrink-0 items-center">
          {(['all', 'samegym', 'friends'] as const).map(t => (
            <button
              key={t}
              onClick={() => setListTab(t)}
              className={`text-xs px-3 py-2 border-b-2 transition-colors ${
                listTab === t ? 'text-[#c9a96e] border-[#c9a96e]' : 'text-white/35 border-transparent'
              }`}
            >
              {t === 'all' ? `Nearby (${nearbyUsers.length})` : t === 'samegym' ? `Gym (${sameGymUsers.length})` : `Friends (${followingUsers.length})`}
            </button>
          ))}
          <button
            onClick={() => setShowHistory(true)}
            className="ml-auto flex items-center gap-1 text-white/30 hover:text-white/60 text-xs px-3 py-2 transition-colors"
          >
            <Clock size={12} /> History
          </button>
        </div>

        {/* Active Pacts banner */}
        {pacts.filter(p => p.status === 'active' || p.status === 'pending').length > 0 && (
          <div className="mx-4 mb-3 mt-1 flex flex-col gap-2">
            {pacts.filter(p => p.status === 'active' || p.status === 'pending').slice(0, 2).map(pact => {
              const needsMySign = !pact.signedBy.includes(currentUser?.id || '');
              return (
                <div key={pact.id} className={`rounded-xl border px-3.5 py-3 flex items-center gap-3 ${needsMySign ? 'bg-[rgba(201,169,110,0.06)] border-[rgba(201,169,110,0.2)]' : 'bg-white/[0.02] border-white/[0.06]'}`}>
                  <Shield size={15} className={needsMySign ? 'text-[#c9a96e] shrink-0' : 'text-white/25 shrink-0'} />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-xs font-medium truncate">{pact.title}</p>
                    <p className="text-white/30 text-[10px]">
                      {pact.sessionsCompleted.length}/{pact.sessionsRequired} sessions · {pact.xpStake} XP stake
                    </p>
                  </div>
                  {needsMySign ? (
                    <button onClick={() => signPact(pact.id)} className="shrink-0 bg-[rgba(201,169,110,0.12)] border border-[rgba(201,169,110,0.25)] text-[#c9a96e] text-[10px] font-medium px-2.5 py-1.5 rounded-lg">
                      Sign
                    </button>
                  ) : (
                    <span className="text-[#4ade80] text-[10px] shrink-0 flex items-center gap-1">
                      <Check size={9} /> Active
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* User list */}
        <div className="flex-1 overflow-y-auto">
          {loadingNearby && nearbyUsers.length === 0 && (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={20} className="text-[#c9a96e] animate-spin" />
            </div>
          )}

          {!loadingNearby && displayedUsers.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center px-6">
              <Users size={32} className="text-white/15 mb-3" />
              <p className="text-white/40 text-sm">
                              {listTab === 'samegym' ? 'No one at your gym is available right now.' : listTab === 'friends' ? "None of your friends are online right now." : 'No nearby users available right now.'}
              </p>
              <p className="text-white/25 text-xs mt-1">Pull to refresh or check back later.</p>
            </div>
          )}

          {displayedUsers.map((user, idx) => (
            <div key={user.uid}>
              <div className="flex items-center gap-3 px-4 py-3">
                <AvatarCircle name={user.name} avatar={user.avatar} size={40} bg={avatarColor(user.uid)} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white text-sm font-medium">{user.name}</span>
                    <StarRating rating={user.rating} count={user.ratingCount} size={10} />
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    {user.workoutType && (
                      <span className="text-white/45 text-xs">{user.workoutType}</span>
                    )}
                    {user.gym && (
                      <span className="bg-white/[0.05] border border-white/[0.07] rounded-md px-1.5 py-0.5 text-[10px] text-white/45">
                        {user.gym}
                      </span>
                    )}
                    {user.distance !== null && (
                      <span className="text-white/30 text-[10px]">{user.distance} km</span>
                    )}
                    {user.sameGym && (
                      <span className="bg-[rgba(122,196,155,0.1)] text-[#7ac49b] rounded-md px-1.5 py-0.5 text-[10px]">same gym</span>
                    )}
                  </div>
                </div>
                {user.inSession ? (
                  <button
                    onClick={() => joinSession(user)}
                    className="bg-[#c9a96e] text-[#080608] rounded-full px-3 py-1.5 text-xs font-medium shrink-0"
                  >
                    Join
                  </button>
                ) : (
                  <div className="flex flex-col gap-1.5 shrink-0">
                    <button
                      onClick={() => pullIn(user)}
                      disabled={pullingUid === user.uid}
                      className="bg-[rgba(201,169,110,0.1)] text-[#c9a96e] border border-[rgba(201,169,110,0.22)] rounded-full px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      {pullingUid === user.uid ? <Loader2 size={11} className="animate-spin" /> : 'Pull in'}
                    </button>
                    <button
                      onClick={() => { setPactTargetUser(user); setPactTitle(''); setShowCreatePact(true); }}
                      className="flex items-center justify-center gap-1 bg-white/[0.03] text-white/35 border border-white/[0.06] rounded-full px-3 py-1 text-[10px]"
                    >
                      <Shield size={9} /> Pact
                    </button>
                  </div>
                )}
              </div>
              {idx < displayedUsers.length - 1 && <div className="h-px bg-white/[0.04] mx-4" />}
            </div>
          ))}
        </div>

        {/* Start session FAB */}
        <div className="px-4 py-3 border-t border-white/[0.05] shrink-0">
          <button
            onClick={async () => {
              try {
                const res = await authFetch(`${API}/train-together/sessions`, {
                  method: 'POST',
                  body: JSON.stringify({ gymId: selectedGym?.id, gymName: selectedGym?.name, workoutType }),
                });
                const data = await res.json();
                setWaitingSession({ id: data.session.id, gymName: data.session.gymName, invitedUser: null });
                startSessionSSE(data.session.id);
                toast.success('Session open! Pull in someone to start.');
              } catch { toast.error('Could not start session'); }
            }}
            className="w-full bg-[#c9a96e] text-[#080608] rounded-xl py-3 text-sm font-medium flex items-center justify-center gap-2"
          >
            <Users size={16} />
            Start a session
          </button>
        </div>
      </div>

      {/* ── Session History modal ─────────────────────────────────────────── */}
      {showHistory && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setShowHistory(false)}
        >
          <div
            className="w-full max-w-lg bg-[#0e0b07] border-t border-[rgba(201,169,110,0.12)] rounded-t-3xl p-5 space-y-4 max-h-[75vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-white font-semibold">Session History</p>
              <button onClick={() => setShowHistory(false)} className="text-white/30 hover:text-white">
                <X size={18} />
              </button>
            </div>

            {sessionHistory.length === 0 ? (
              <div className="text-center py-10">
                <Clock size={28} className="text-white/15 mx-auto mb-3" />
                <p className="text-white/35 text-sm">No completed sessions yet.</p>
                <p className="text-white/20 text-xs mt-1">Start a session with someone to build your history.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {sessionHistory.map(s => {
                  const dateStr = s.date ? new Date(s.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' }) : '—';
                  const partner = s.partners?.[0];
                  return (
                    <div key={s.id} className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.08)] rounded-2xl px-4 py-3.5 flex items-center gap-3">
                      {partner ? (
                        <AvatarCircle name={partner.name} avatar={partner.avatar} size={40} bg={avatarColor(partner.uid)} />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-white/[0.05] flex items-center justify-center shrink-0">
                          <Users size={16} className="text-white/30" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">
                          {partner ? `With ${partner.name}` : 'Solo session'}
                        </p>
                        <p className="text-white/40 text-xs mt-0.5">
                          {dateStr}
                          {s.durationMin > 0 && ` · ${s.durationMin} min`}
                          {s.gymName && ` · ${s.gymName}`}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {s.exerciseCount > 0 && (
                          <p className="text-white/60 text-xs">{s.exerciseCount} exercises</p>
                        )}
                        {s.myReps > 0 && (
                          <p className="text-[#c9a96e] text-xs font-medium">{s.myReps} reps</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
