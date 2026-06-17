// MessagesPage.tsx — DMs + Group chats + Follow Requests + Search

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Send, ArrowLeft, Loader2, ImagePlus, X, UserPlus, Check, CheckCheck,
  XCircle, Search, Users, Plus, MessageSquare, MessageCircle, Mic, MicOff, StopCircle, Radio,
  Pin, PinOff, BellOff, Bell, Dumbbell, Trophy, Zap,
} from 'lucide-react';
import { User } from '../types';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Input } from './ui/input';
import { toast } from 'sonner';
import { EmptyState } from './EmptyState';
import { compressBase64 } from '../../utils/imageCompression';
import { formatSmartDate } from '../../utils/dateFormatter';
import { authFetch, getAuthToken } from '../../utils/authToken';
import {
  getFollowRequests, acceptFollowRequest, declineFollowRequest, FollowRequest,
  getFollowingList,
} from '../../services/followService';

import { API } from '../../config';

interface MessagesPageProps {
  currentUser?: User | null;
  onFollowRequestsViewed?: () => void;
  onViewProfile?: (uid: string) => void;
}

interface ParticipantProfile { uid: string; name: string; avatar: string; }

interface Conversation {
  id: string;
  type: 'direct' | 'group' | 'community';
  emoji?: string;  // community only
  name: string;
  // direct only
  otherUser?: { uid: string; name: string; username: string; avatar: string };
  // group only
  participantCount?: number;
  participantProfiles?: ParticipantProfile[];
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  participants?: string[];
}

interface Message {
  id: string; senderId: string; text: string; audio?: string;
  image?: string; createdAt: string; readBy: string[];
  reactions?: Record<string, string[]>; // emoji → [uid, ...]
  _changeType?: 'added' | 'modified';
}

interface SearchUser {
  uid: string; name: string; username: string; avatar: string; accountType: string;
}

// ─── Group Avatar stack ───────────────────────────────────────────────────────
function GroupAvatarStack({ profiles }: { profiles: ParticipantProfile[] }) {
  return (
    <div className="relative w-10 h-10 shrink-0">
      {profiles.slice(0, 3).map((p, i) => (
        <div
          key={p.uid}
          className="absolute rounded-full border-2 border-[#0d0b08] overflow-hidden"
          style={{
            width: profiles.length > 1 ? 24 : 40,
            height: profiles.length > 1 ? 24 : 40,
            top: i === 0 ? 0 : i === 1 ? 10 : undefined,
            bottom: i === 2 ? 0 : undefined,
            left: i === 0 ? 0 : i === 2 ? 0 : undefined,
            right: i === 1 ? 0 : undefined,
          }}
        >
          {p.avatar
            ? <img src={p.avatar} alt={p.name} className="w-full h-full object-cover" />
            : <div className="w-full h-full bg-gradient-to-br from-[#c9a96e] to-[#a07840] flex items-center justify-center text-white text-[9px] font-bold">{p.name?.[0] || '?'}</div>
          }
        </div>
      ))}
    </div>
  );
}

// Quick emoji reactions palette
const REACTION_EMOJIS = ['❤️','😂','😮','😢','😡','👍','👎','🔥','💪','🎉'];

function EmojiReactionPicker({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <div className="flex items-center gap-0.5 bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-full px-2 py-1.5 shadow-xl">
      {REACTION_EMOJIS.map(e => (
        <button
          key={e}
          type="button"
          onClick={() => onPick(e)}
          className="text-base hover:scale-125 transition-transform active:scale-110 leading-none"
        >
          {e}
        </button>
      ))}
    </div>
  );
}

export function MessagesPage({ currentUser, onFollowRequestsViewed, onViewProfile }: MessagesPageProps) {
  const [conversations, setConversations]       = useState<Conversation[]>([]);
  const [activeConvId, setActiveConvId]         = useState<string | null>(null);
  const [messages, setMessages]                 = useState<Message[]>([]);
  const [loadingConvs, setLoadingConvs]         = useState(false);
  const [loadingMsgs, setLoadingMsgs]           = useState(false);
  const [text, setText]                         = useState('');
  const [imageData, setImageData]               = useState<string | null>(null);
  const [imagePreview, setImagePreview]         = useState<string | null>(null);
  const [sending, setSending]                   = useState(false);
  const [mobileShowThread, setMobileShowThread] = useState(false);
  // Follow requests
  const [followRequests, setFollowRequests]     = useState<FollowRequest[]>([]);
  const [reqActionId, setReqActionId]           = useState<string | null>(null);
  // Search + new chat
  const [search, setSearch]                     = useState('');
  const [searchUsers, setSearchUsers]           = useState<SearchUser[]>([]);
  const [searchLoading, setSearchLoading]       = useState(false);
  // People I follow — shown as suggestions before the user types
  const [followingSuggestions, setFollowingSuggestions] = useState<SearchUser[]>([]);
  // Group chat creation
  const [showNewGroup, setShowNewGroup]         = useState(false);
  const [groupName, setGroupName]               = useState('');
  const [groupSearch, setGroupSearch]           = useState('');
  const [groupResults, setGroupResults]         = useState<SearchUser[]>([]);
  const [groupResultsLoading, setGroupResultsLoading] = useState(false);
  const [selectedMembers, setSelectedMembers]   = useState<SearchUser[]>([]);
  const [creatingGroup, setCreatingGroup]       = useState(false);

  // Option D: Pin + mute state
  const [pinnedConvs, setPinnedConvs]           = useState<Set<string>>(new Set());
  const [mutedConvs, setMutedConvs]             = useState<Set<string>>(new Set());
  const [contextMenuConv, setContextMenuConv]   = useState<string | null>(null);
  // Option C: workout attachment picker
  const [showWorkoutPick, setShowWorkoutPick]   = useState(false);

  // Emoji reactions
  const [hoveredMsgId, setHoveredMsgId]         = useState<string | null>(null);
  const hoverTimeoutRef                          = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Voice messages
  const [recording, setRecording]               = useState(false);
  const [audioBlob, setAudioBlob]               = useState<Blob | null>(null);
  const mediaRecorderRef                        = useRef<MediaRecorder | null>(null);
  const audioChunksRef                          = useRef<Blob[]>([]);

  // Activity status
  const [otherUserPresence, setOtherUserPresence] = useState<{ lastSeen: string | null; isOnline: boolean } | null>(null);
  const presenceRef                             = useRef<ReturnType<typeof setInterval> | null>(null);

  const messagesEndRef    = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const fileRef        = useRef<HTMLInputElement>(null);
  const pollRef        = useRef<ReturnType<typeof setInterval> | null>(null);
  const sseRef         = useRef<EventSource | null>(null);

  // ── Load conversations ────────────────────────────────────────────────────
  const loadConversations = useCallback(async () => {
    if (!currentUser) return;
    setLoadingConvs(true);
    try {
      const res  = await authFetch(`${API}/conversations`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Server error ${res.status}`);
      }
      const data = await res.json();
      setConversations(data.conversations || []);
    } catch (e: any) {
      console.error('[Messages] loadConversations failed:', e.message);
      toast.error('Failed to load conversations');
    }
    finally   { setLoadingConvs(false); }
  }, [currentUser]);

  // ── Load follow requests ──────────────────────────────────────────────────
  const loadFollowRequests = useCallback(async () => {
    if (!currentUser) return;
    try {
      const reqs = await getFollowRequests();
      setFollowRequests(reqs);
      // Tell App.tsx the badge can be cleared — user is viewing the requests
      if (reqs.length === 0) onFollowRequestsViewed?.();
    } catch {}
  }, [currentUser, onFollowRequestsViewed]);

  useEffect(() => {
    // User has opened Messages — clear the badge in the sidebar immediately
    onFollowRequestsViewed?.();
    loadConversations();
    loadFollowRequests();
    const reqPoll = setInterval(loadFollowRequests, 15000);

    // Pre-load following list as search suggestions
    if (currentUser?.id) {
      getFollowingList(currentUser.id).then(async (uids) => {
        if (!uids.length) return;
        try {
          const profiles = await Promise.all(
            uids.slice(0, 20).map(async (uid) => {
              const res = await fetch(`${API}/users/${uid}`);
              if (!res.ok) return null;
              const u = await res.json();
              return {
                uid: u.uid || uid,
                name: u.displayName || u.name || 'User',
                username: u.username || '',
                avatar: u.avatar || '',
                accountType: u.accountType || 'user',
              } as SearchUser;
            })
          );
          setFollowingSuggestions(profiles.filter(Boolean) as SearchUser[]);
        } catch {}
      });
    }

    return () => clearInterval(reqPoll);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadConversations, loadFollowRequests]);

  // ── Load messages for active conversation ─────────────────────────────────
  const loadMessages = useCallback(async (convId: string, markRead = false, silent = false) => {
    if (!silent) setLoadingMsgs(true);
    try {
      const res  = await authFetch(`${API}/conversations/${convId}/messages`);
      const data = await res.json();
      setMessages(prev => {
        const next = data.messages || [];
        // Only update if something actually changed (avoids pointless re-renders)
        if (prev.length === next.length && prev[prev.length-1]?.id === next[next.length-1]?.id) return prev;
        return next;
      });
      if (markRead) {
        authFetch(`${API}/conversations/${convId}/read`, { method: 'POST' }).catch(() => {});
      }
    } catch { if (!silent) toast.error('Failed to load messages'); }
    finally   { if (!silent) setLoadingMsgs(false); }
  }, []);

  useEffect(() => {
    if (!activeConvId) return;

    // Initial load (marks messages as read)
    loadMessages(activeConvId, true);

    // Close any previous SSE / poll before opening a new one
    if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

    const token = getAuthToken();
    if (token) {
      const url = `${API}/conversations/${activeConvId}/stream?token=${encodeURIComponent(token)}`;
      const sse = new EventSource(url);
      sseRef.current = sse;

      sse.onmessage = (e) => {
        try {
          const msg: Message = JSON.parse(e.data);
          const changeType = msg._changeType || 'added';
          setMessages(prev => {
            if (changeType === 'modified') {
              // Reaction update — replace in-place
              return prev.map(m => m.id === msg.id ? { ...m, reactions: msg.reactions } : m);
            }
            // New message — ignore if already present (initial snapshot burst dedup)
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (changeType === 'added') {
            // Auto-mark read when new message arrives in the open conversation
            authFetch(`${API}/conversations/${activeConvId}/read`, { method: 'POST' }).catch(() => {});
          }
        } catch {}
      };

      sse.onerror = () => {
        // SSE failed (proxy cut connection, etc.) — fall back to polling
        sse.close();
        sseRef.current = null;
        if (!pollRef.current) {
          pollRef.current = setInterval(() => loadMessages(activeConvId, false, true), 8000);
        }
      };
    } else {
      // No token yet — fall back to polling
      pollRef.current = setInterval(() => loadMessages(activeConvId, false, true), 8000);
    }

    return () => {
      if (sseRef.current) { sseRef.current.close(); sseRef.current = null; }
      if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    };
  }, [activeConvId, loadMessages]);

  const lastMsgIdRef    = useRef<string | null>(null);
  const activeConvIdRef = useRef<string | null>(null);

  const scrollToBottom = (smooth = false) => {
    const container = messagesContainerRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: smooth ? 'smooth' : 'instant' });
  };

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (!lastMsg) return;
    const justSwitchedConv = activeConvId !== activeConvIdRef.current;
    if (justSwitchedConv) {
      activeConvIdRef.current = activeConvId;
      lastMsgIdRef.current = lastMsg.id;
      // Use a tiny delay so the DOM renders messages before we scroll
      setTimeout(() => scrollToBottom(false), 0);
    } else if (lastMsg.id !== lastMsgIdRef.current) {
      lastMsgIdRef.current = lastMsg.id;
      scrollToBottom(true);
    }
  }, [messages, activeConvId]);

  // ── Debounced conversation search (filters list + backend user search) ─────
  useEffect(() => {
    if (search.trim().length < 2) { setSearchUsers([]); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const q   = search.trim().replace(/^@/, '');
        const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}&type=users`);
        const d   = await res.json();
        setSearchUsers(d.users || []);
      } catch {}
      finally { setSearchLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  // ── Debounced group member search ─────────────────────────────────────────
  useEffect(() => {
    if (groupSearch.trim().length < 2) { setGroupResults([]); return; }
    const t = setTimeout(async () => {
      setGroupResultsLoading(true);
      try {
        const q   = groupSearch.trim().replace(/^@/, '');
        const res = await fetch(`${API}/search?q=${encodeURIComponent(q)}&type=users`);
        const d   = await res.json();
        setGroupResults((d.users || []).filter((u: SearchUser) => u.uid !== currentUser?.id));
      } catch {}
      finally { setGroupResultsLoading(false); }
    }, 300);
    return () => clearTimeout(t);
  }, [groupSearch, currentUser]);

  // ── Start / open DM ───────────────────────────────────────────────────────
  const startDM = async (toUid: string) => {
    try {
      const res  = await authFetch(`${API}/conversations`, { method: 'POST', body: JSON.stringify({ toUid }) });
      const data = await res.json();
      await loadConversations();
      setActiveConvId(data.conversationId);
      setMobileShowThread(true);
      setSearch('');
      setSearchUsers([]);
    } catch { toast.error('Could not open conversation'); }
  };

  // ── Auto-open DM from trainer client list ─────────────────────────────────
  useEffect(() => {
    const raw = sessionStorage.getItem('openDmWith');
    if (!raw) return;
    sessionStorage.removeItem('openDmWith');
    try {
      const target = JSON.parse(raw);
      if (target?.id) startDM(target.id);
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Create group chat ──────────────────────────────────────────────────────
  const createGroup = async () => {
    if (!groupName.trim())            return toast.error('Give the group a name');
    if (selectedMembers.length === 0) return toast.error('Add at least one member');
    setCreatingGroup(true);
    try {
      const res  = await authFetch(`${API}/conversations/group`, {
        method: 'POST',
        body: JSON.stringify({ participantUids: selectedMembers.map(m => m.uid), name: groupName }),
      });
      const data = await res.json();
      await loadConversations();
      setActiveConvId(data.conversationId);
      setMobileShowThread(true);
      setShowNewGroup(false);
      setGroupName(''); setGroupSearch(''); setSelectedMembers([]);
      toast.success('Group chat created!');
    } catch (e: any) { toast.error(e.message || 'Could not create group'); }
    finally { setCreatingGroup(false); }
  };

  // ── Follow request accept/decline ─────────────────────────────────────────
  const handleAccept = async (req: FollowRequest) => {
    setReqActionId(req.id);
    try {
      const result = await acceptFollowRequest(req.id);
      setFollowRequests(prev => prev.filter(r => r.id !== req.id));
      toast.success(`You're now connected with ${req.fromUser.name}!`);
      if (result.conversationId) {
        await loadConversations();
        setActiveConvId(result.conversationId);
        setMobileShowThread(true);
      }
    } catch (e: any) { toast.error(e.message || 'Could not accept'); }
    finally { setReqActionId(null); }
  };

  const handleDecline = async (req: FollowRequest) => {
    setReqActionId(req.id);
    try {
      await declineFollowRequest(req.id);
      setFollowRequests(prev => prev.filter(r => r.id !== req.id));
    } catch (e: any) { toast.error(e.message || 'Could not decline'); }
    finally { setReqActionId(null); }
  };

  // ── Presence ────────────────────────────────────────────────────────────────
  // Ping presence endpoint every 30s while the tab is active
  useEffect(() => {
    if (!currentUser) return;
    const ping = () => authFetch(`${API}/users/${currentUser.id}/presence`, {
      method: 'POST', body: JSON.stringify({ online: true }),
    }).catch(() => {});
    ping();
    presenceRef.current = setInterval(ping, 30_000);
    return () => { if (presenceRef.current) clearInterval(presenceRef.current); };
  }, [currentUser]);

  // Fetch other user's presence when active DM changes
  useEffect(() => {
    if (!activeConvId) { setOtherUserPresence(null); return; }
    const activeConv = conversations.find(c => c.id === activeConvId);
    if (!activeConv || activeConv.type !== 'direct' || !activeConv.otherUser?.uid) {
      setOtherUserPresence(null); return;
    }
    const uid = activeConv.otherUser.uid;
    fetch(`${API}/users/${uid}/presence`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setOtherUserPresence(d); })
      .catch(() => {});
  }, [activeConvId, conversations]);

  // ── Voice recording ───────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      audioChunksRef.current = [];
      mr.ondataavailable = e => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mr.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        stream.getTracks().forEach(t => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch { toast.error('Microphone access denied'); }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording) {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  };

  const sendVoiceMessage = async () => {
    if (!audioBlob || !activeConvId) return;
    setSending(true);
    try {
      // 1. Convert Blob → base64 data URL
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror  = () => reject(new Error('Failed to read audio'));
        reader.readAsDataURL(audioBlob);
      });

      // 2. Upload to Firebase Storage (avoids Firestore 1MB document limit)
      const upRes = await authFetch(`${API}/upload`, {
        method: 'POST',
        body: JSON.stringify({ base64, folder: 'voice' }),
      });
      if (!upRes.ok) {
        const upErr = await upRes.json().catch(() => ({}));
        throw new Error(upErr.error || 'Audio upload failed');
      }
      const { url: audioUrl } = await upRes.json();

      // 3. Send message with the Storage URL
      const res = await authFetch(`${API}/conversations/${activeConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: '', audio: audioUrl }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Send failed');
      }
      const d = await res.json();
      if (d.message) setMessages(prev => [...prev, d.message]);
      else await loadMessages(activeConvId, false, true);
      setAudioBlob(null);
      toast.success('Voice message sent!');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to send voice message');
    } finally {
      setSending(false);
    }
  };

  // ── Emoji reaction ────────────────────────────────────────────────────────
  const reactToMessage = async (msgId: string, emoji: string) => {
    if (!activeConvId || !currentUser) return;
    setHoveredMsgId(null);
    // Optimistic update
    setMessages(prev => prev.map(m => {
      if (m.id !== msgId) return m;
      const reactions = { ...(m.reactions || {}) };
      const users = reactions[emoji] || [];
      const myId = currentUser.id;
      if (users.includes(myId)) {
        const updated = users.filter(u => u !== myId);
        if (updated.length === 0) delete reactions[emoji];
        else reactions[emoji] = updated;
      } else {
        reactions[emoji] = [...users, myId];
      }
      return { ...m, reactions };
    }));
    try {
      await authFetch(`${API}/conversations/${activeConvId}/messages/${msgId}/react`, {
        method: 'POST',
        body: JSON.stringify({ emoji }),
      });
    } catch { /* silent — SSE will correct state */ }
  };

  // ── Send message ──────────────────────────────────────────────────────────
  const handleSend = async () => {
    if ((!text.trim() && !imageData) || !activeConvId) return;
    const outgoingText = text.trim();
    setText('');
    setImageData(null); setImagePreview(null);
    setSending(true);
    try {
      const res = await authFetch(`${API}/conversations/${activeConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: outgoingText, image: imageData }),
      });
      if (!res.ok) throw new Error('Send failed');
      // If SSE is active it will deliver the message; otherwise fall back to a silent reload
      if (!sseRef.current || sseRef.current.readyState === EventSource.CLOSED) {
        await loadMessages(activeConvId, false, true);
      }
    } catch {
      // Restore text if send failed
      if (outgoingText) setText(outgoingText);
      toast.error('Failed to send message');
    }
    finally { setSending(false); }
  };

  // ── Image attach ──────────────────────────────────────────────────────────
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const raw = ev.target?.result as string;
      try { const c = await compressBase64(raw, 800, 0.75); setImageData(c); setImagePreview(c); }
      catch { setImageData(raw); setImagePreview(raw); }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ── Derived ───────────────────────────────────────────────────────────────
  const activeConv = conversations.find(c => c.id === activeConvId);

  const filteredConvs = search.trim().length < 2
    ? conversations
    : conversations.filter(c => (c.name || '').toLowerCase().includes(search.toLowerCase()));

  // New users found by search that aren't already in a conversation
  const convUserIds = new Set(conversations.map(c => c.otherUser?.uid).filter(Boolean));
  const newSearchUsers = searchUsers.filter(u => !convUserIds.has(u.uid) && u.uid !== currentUser?.id);

  // When search bar is focused but empty, show following as suggestions
  const suggestionsToShow = search.trim().length === 0
    ? followingSuggestions.filter(u => !convUserIds.has(u.uid) && u.uid !== currentUser?.id)
    : [];

  // Option D: sorted convs — pinned first
  const sortedFilteredConvs = useMemo(() =>
    [...filteredConvs].sort((a, b) => {
      const ap = pinnedConvs.has(a.id) ? 1 : 0;
      const bp = pinnedConvs.has(b.id) ? 1 : 0;
      return bp - ap;
    }),
    [filteredConvs, pinnedConvs]
  );

  const togglePin  = (id: string) => setPinnedConvs(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleMute = (id: string) => setMutedConvs(p  => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  if (!currentUser) {
    return <div className="flex items-center justify-center h-full py-24 text-white/40 text-sm">Please log in to view messages.</div>;
  }

  return (
    <div className="h-screen flex overflow-hidden">

      {/* ── Left sidebar ────────────────────────────────────────────────── */}
      <div className={`w-full md:w-80 lg:w-72 shrink-0 border-r border-[rgba(201,169,110,0.08)] flex flex-col bg-[#0d0b08]
        ${mobileShowThread ? 'hidden md:flex' : 'flex'}`}>

        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b border-[rgba(201,169,110,0.08)] space-y-3">
          <div className="flex items-center justify-between">
            <h1 className="text-white font-bold text-lg">Messages</h1>
            <div className="flex items-center gap-1.5">
              {followRequests.length > 0 && (
                <span className="w-5 h-5 rounded-full bg-[#c9a96e] text-white text-[10px] font-bold flex items-center justify-center">
                  {followRequests.length}
                </span>
              )}
              {/* New group button */}
              <button
                type="button"
                onClick={() => setShowNewGroup(true)}
                className="w-8 h-8 rounded-lg bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] flex items-center justify-center text-white/50 hover:text-[#e8c98a] hover:border-[rgba(201,169,110,0.25)] hover:bg-[rgba(201,169,110,0.08)] transition-all"
                title="New group chat"
              >
                <Users className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          {/* Search bar */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/30" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search or start new chat…"
              className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]"
            />
            {search && (
              <button type="button" onClick={() => { setSearch(''); setSearchUsers([]); }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Follow Requests ──────────────────────────────────────────── */}
          {followRequests.length > 0 && (
            <div className="border-b border-[rgba(201,169,110,0.08)] pb-1">
              <p className="px-4 pt-3 pb-1.5 text-[#e8c98a] text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1.5">
                <UserPlus className="w-3 h-3" /> Follow Requests ({followRequests.length})
              </p>
              {followRequests.map(req => (
                <div key={req.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(201,169,110,0.03)] transition-colors">
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarImage src={req.fromUser.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-[#c9a96e] to-[#a07840] text-white text-sm font-semibold">
                      {req.fromUser.name?.[0] || '?'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{req.fromUser.name}</p>
                    <p className="text-white/40 text-xs">@{req.fromUser.username}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" disabled={reqActionId === req.id} onClick={() => handleAccept(req)}
                      className="w-7 h-7 rounded-lg bg-[#c9a96e] flex items-center justify-center text-white hover:bg-[#c9a96e] disabled:opacity-50 transition-all" title="Accept">
                      {reqActionId === req.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button type="button" disabled={reqActionId === req.id} onClick={() => handleDecline(req)}
                      className="w-7 h-7 rounded-lg bg-[rgba(201,169,110,0.06)] flex items-center justify-center text-white/50 hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50 transition-all" title="Decline">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Following suggestions (shown when search bar is empty/focused) */}
          {search.trim().length === 0 && suggestionsToShow.length > 0 && (
            <div className="border-b border-[rgba(201,169,110,0.08)]">
              <p className="px-4 pt-3 pb-1.5 text-white/30 text-[10px] font-semibold uppercase tracking-wider">People you follow</p>
              {suggestionsToShow.slice(0, 6).map(u => (
                <button key={u.uid} type="button" onClick={() => startDM(u.uid)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(201,169,110,0.04)] transition-colors text-left">
                  <Avatar className="w-9 h-9 shrink-0">
                    <AvatarImage src={u.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-[#c9a96e] to-[#a07840] text-white text-sm font-semibold">{u.name?.[0] || '?'}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{u.name}</p>
                    <p className="text-white/40 text-xs">@{u.username}</p>
                  </div>
                  <MessageSquare className="w-3.5 h-3.5 text-[#c9a96e]/60 shrink-0" />
                </button>
              ))}
            </div>
          )}

          {/* ── New user results from search ─────────────────────────────── */}
          {search.trim().length >= 2 && (
            <div className="border-b border-[rgba(201,169,110,0.08)]">
              {searchLoading ? (
                <div className="flex justify-center py-4"><Loader2 className="w-4 h-4 text-[#c9a96e] animate-spin" /></div>
              ) : newSearchUsers.length > 0 && (
                <>
                  <p className="px-4 pt-3 pb-1.5 text-white/30 text-[10px] font-semibold uppercase tracking-wider">New conversation</p>
                  {newSearchUsers.map(u => (
                    <button key={u.uid} type="button" onClick={() => startDM(u.uid)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[rgba(201,169,110,0.04)] transition-colors text-left">
                      <Avatar className="w-9 h-9 shrink-0">
                        <AvatarImage src={u.avatar} />
                        <AvatarFallback className="bg-gradient-to-br from-[#c9a96e] to-[#a07840] text-white text-sm font-semibold">{u.name?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{u.name}</p>
                        <p className="text-white/40 text-xs">@{u.username}</p>
                      </div>
                      <Plus className="w-4 h-4 text-[#c9a96e] shrink-0" />
                    </button>
                  ))}
                </>
              )}
            </div>
          )}

          {/* ── Conversations list ────────────────────────────────────────── */}
          {loadingConvs ? (
            <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-[#c9a96e] animate-spin" /></div>
          ) : sortedFilteredConvs.length === 0 && followRequests.length === 0 ? (
            <div className="pt-8 px-4">
              <EmptyState icon="message" title="No conversations yet" sub="Search for someone above or wait for a follow request." />
            </div>
          ) : (
            sortedFilteredConvs.map(conv => {
              const isGroup   = conv.type === 'group' || conv.type === 'community';
              const avatarSrc = isGroup ? undefined : conv.otherUser?.avatar;
              const initials  = (conv.name || '?')[0]?.toUpperCase() || '?';
              const isPinned  = pinnedConvs.has(conv.id);
              const isMuted   = mutedConvs.has(conv.id);
              const showCtx   = contextMenuConv === conv.id;
              return (
                <div key={conv.id} className="relative">
                  <button type="button"
                    onClick={() => { setActiveConvId(conv.id); setMobileShowThread(true); setContextMenuConv(null); setConversations(cs => cs.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c)); }}
                    onContextMenu={e => { e.preventDefault(); setContextMenuConv(showCtx ? null : conv.id); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-[rgba(201,169,110,0.04)] transition-colors text-left
                      ${activeConvId === conv.id ? 'bg-[rgba(201,169,110,0.08)] border-r-2 border-[#c9a96e]' : ''}`}
                  >
                    {/* Option B: Avatar with online presence dot */}
                    <div className="relative shrink-0">
                      {conv.type === 'community' ? (
                        <div className="w-10 h-10 rounded-full bg-[rgba(201,169,110,0.04)] flex items-center justify-center text-xl">{conv.emoji || '👥'}</div>
                      ) : isGroup && conv.participantProfiles ? (
                        <GroupAvatarStack profiles={conv.participantProfiles} />
                      ) : (
                        <Avatar className="w-10 h-10">
                          <AvatarImage src={avatarSrc} />
                          <AvatarFallback className="bg-gradient-to-br from-[#c9a96e] to-[#a07840] text-white text-sm font-semibold">{initials}</AvatarFallback>
                        </Avatar>
                      )}
                      {/* Online dot — show for direct chats with recent activity */}
                      {conv.type === 'direct' && conv.lastMessageAt && (() => {
                        const diff = Date.now() - new Date(conv.lastMessageAt).getTime();
                        return diff < 5 * 60 * 1000;
                      })() && (
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#0d0b08]" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0">
                          {isPinned && <Pin className="w-2.5 h-2.5 text-[#c9a96e] shrink-0" />}
                          <p className={`text-white text-sm font-medium truncate ${isMuted ? 'opacity-50' : ''}`}>{conv.name}</p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {isMuted && <BellOff className="w-2.5 h-2.5 text-white/25" />}
                          {conv.lastMessageAt && <p className="text-white/25 text-xs">{formatSmartDate(conv.lastMessageAt)}</p>}
                        </div>
                      </div>
                      <p className={`text-xs truncate mt-0.5 ${isMuted ? 'text-white/20' : 'text-white/40'}`}>
                        {conv.type === 'community' && <span className="text-white/20">Community · </span>}
                        {conv.type === 'group' && <span className="text-white/20">{conv.participantCount} members · </span>}
                        {conv.lastMessage || 'Start the conversation'}
                      </p>
                    </div>
                    {!isMuted && conv.unreadCount > 0 && (
                      <span className="shrink-0 w-5 h-5 rounded-full bg-[#c9a96e] text-white text-[10px] font-bold flex items-center justify-center">
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                      </span>
                    )}
                  </button>
                  {/* Option D: Context menu (right-click) */}
                  {showCtx && (
                    <div className="absolute right-3 top-2 z-40 bg-[#0d0b08] border border-[rgba(201,169,110,0.15)] rounded-xl shadow-xl overflow-hidden">
                      <button type="button" onClick={() => { togglePin(conv.id); setContextMenuConv(null); }}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-white/80 hover:bg-[rgba(201,169,110,0.08)] transition-colors w-full text-left">
                        {isPinned ? <PinOff className="w-3.5 h-3.5 text-[#c9a96e]" /> : <Pin className="w-3.5 h-3.5 text-[#c9a96e]" />}
                        {isPinned ? 'Unpin' : 'Pin to top'}
                      </button>
                      <button type="button" onClick={() => { toggleMute(conv.id); setContextMenuConv(null); }}
                        className="flex items-center gap-2.5 px-4 py-2.5 text-xs text-white/80 hover:bg-[rgba(201,169,110,0.08)] transition-colors w-full text-left">
                        {isMuted ? <Bell className="w-3.5 h-3.5 text-white/50" /> : <BellOff className="w-3.5 h-3.5 text-white/50" />}
                        {isMuted ? 'Unmute' : 'Mute'}
                      </button>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Message thread ────────────────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col min-w-0 ${!mobileShowThread ? 'hidden md:flex' : 'flex'}`}>
        {activeConv ? (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-[rgba(201,169,110,0.08)] bg-[#0d0b08]">
              <button type="button" className="md:hidden shrink-0 text-white/50 hover:text-white" onClick={() => setMobileShowThread(false)}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              {/* Clickable avatar + name → view profile (DM only) */}
              <button
                type="button"
                className="flex items-center gap-3 flex-1 min-w-0 text-left group"
                onClick={() => {
                  if (activeConv.type === 'direct' && activeConv.otherUser?.uid && onViewProfile) {
                    onViewProfile(activeConv.otherUser.uid);
                  }
                }}
                disabled={activeConv.type === 'group' || activeConv.type === 'community'}
              >
                {activeConv.type === 'group' && activeConv.participantProfiles ? (
                  <GroupAvatarStack profiles={activeConv.participantProfiles} />
                ) : (
                  <Avatar className="w-8 h-8 shrink-0">
                    <AvatarImage src={activeConv.otherUser?.avatar} />
                    <AvatarFallback className="bg-gradient-to-br from-[#c9a96e] to-[#a07840] text-white text-xs font-semibold">
                      {(activeConv.name || '?')[0]?.toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                )}
                <div>
                  <p className={`text-white font-semibold text-sm ${activeConv.type === 'direct' ? 'group-hover:text-[#e8c98a] transition-colors' : ''}`}>
                    {activeConv.name}
                  </p>
                  {activeConv.type === 'direct' && otherUserPresence ? (
                    <p className="text-xs flex items-center gap-1">
                      {otherUserPresence.isOnline ? (
                        <><span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" /><span className="text-green-400">Active now</span></>
                      ) : otherUserPresence.lastSeen ? (
                        <><span className="w-1.5 h-1.5 rounded-full bg-white/20 inline-block" /><span className="text-white/30">{(() => {
                          const diff = Date.now() - new Date(otherUserPresence.lastSeen).getTime();
                          const mins = Math.floor(diff / 60000);
                          if (mins < 1) return 'Active just now';
                          if (mins < 60) return `Active ${mins}m ago`;
                          const hrs = Math.floor(mins / 60);
                          if (hrs < 24) return `Active ${hrs}h ago`;
                          return `Active ${Math.floor(hrs/24)}d ago`;
                        })()}</span></>
                      ) : <span className="text-white/40">@{activeConv.otherUser?.username || ''}</span>}
                    </p>
                  ) : (
                    <p className="text-white/40 text-xs">
                      {activeConv.type === 'group'
                        ? `${activeConv.participantCount} members`
                        : `@${activeConv.otherUser?.username || ''}`}
                    </p>
                  )}
                </div>
              </button>
            </div>

            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {loadingMsgs ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-[#c9a96e] animate-spin" /></div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <MessageSquare className="w-8 h-8 text-white/10 mb-3" />
                  <p className="text-white/30 text-sm">No messages yet. Say hello 👋</p>
                </div>
              ) : messages.map(msg => {
                const isOwn = msg.senderId === currentUser.id;
                const senderProfile = activeConv.type === 'group'
                  ? activeConv.participantProfiles?.find(p => p.uid === msg.senderId)
                  : activeConv.otherUser;
                const reactionEntries = Object.entries(msg.reactions || {});
                const showPicker = hoveredMsgId === msg.id;
                return (
                  <div key={msg.id} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
                    {!isOwn && (
                      <Avatar className="w-7 h-7 shrink-0 mt-1">
                        <AvatarImage src={senderProfile?.avatar} />
                        <AvatarFallback className="bg-gradient-to-br from-[#c9a96e] to-[#a07840] text-white text-[10px]">
                          {(senderProfile?.name || '?')[0]}
                        </AvatarFallback>
                      </Avatar>
                    )}
                    <div className={`max-w-[70%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : 'items-start'}`}>
                      {activeConv.type === 'group' && !isOwn && (
                        <p className="text-white/30 text-[10px] px-1">{senderProfile?.name || 'Member'}</p>
                      )}
                      {/* Bubble + emoji picker */}
                      <div className="relative">
                        {showPicker && (
                          <div className={`absolute z-20 bottom-full mb-1.5 ${isOwn ? 'right-0' : 'left-0'}`}>
                            <EmojiReactionPicker onPick={(emoji) => reactToMessage(msg.id, emoji)} />
                          </div>
                        )}
                        <div
                          className={`px-3.5 py-2.5 rounded-2xl text-sm leading-relaxed select-none
                            ${isOwn ? 'bg-[#c9a96e] text-white rounded-tr-sm' : 'bg-[rgba(201,169,110,0.06)] text-white/85 rounded-tl-sm'}`}
                          onMouseEnter={() => {
                            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                            hoverTimeoutRef.current = setTimeout(() => setHoveredMsgId(msg.id), 300);
                          }}
                          onMouseLeave={() => {
                            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                            hoverTimeoutRef.current = setTimeout(() => setHoveredMsgId(null), 500);
                          }}
                          onTouchStart={() => {
                            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                            hoverTimeoutRef.current = setTimeout(() => setHoveredMsgId(msg.id), 500);
                          }}
                          onTouchEnd={() => {
                            if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                          }}
                        >
                          {msg.text && <p>{msg.text}</p>}
                          {msg.image && <img src={msg.image} alt="attachment" className="mt-1.5 rounded-xl max-h-52 max-w-full object-cover" />}
                          {msg.audio && (
                            <div className="mt-1.5 flex items-center gap-2 min-w-[180px]">
                              <Radio className="w-4 h-4 shrink-0 text-[#e8c98a]" />
                              <audio src={msg.audio} controls className="h-8 flex-1 min-w-0" style={{ filter: 'invert(0.8) hue-rotate(200deg)', colorScheme: 'dark' }} />
                            </div>
                          )}
                        </div>
                      </div>
                      {/* Reactions bar */}
                      {reactionEntries.length > 0 && (
                        <div className={`flex flex-wrap gap-1 px-1 mt-0.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                          {reactionEntries.map(([emoji, uids]) => {
                            const isMine = uids.includes(currentUser.id);
                            return (
                              <button
                                key={emoji}
                                type="button"
                                onClick={() => reactToMessage(msg.id, emoji)}
                                className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all border
                                  ${isMine
                                    ? 'bg-[#c9a96e]/25 border-[rgba(201,169,110,0.5)] text-[#e8c98a]'
                                    : 'bg-[rgba(201,169,110,0.04)] border-[rgba(201,169,110,0.12)] text-white/60 hover:bg-[rgba(201,169,110,0.08)]'}`}
                              >
                                <span>{emoji}</span>
                                <span className="font-medium">{uids.length}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <div className="flex items-center gap-1 px-1">
                        <p className="text-white/25 text-[10px]">{formatSmartDate(msg.createdAt)}</p>
                        {isOwn && (() => {
                          const otherIds = (activeConv.participants || []).filter((id: string) => id !== currentUser.id);
                          const readByOther = otherIds.some((id: string) => (msg.readBy || []).includes(id));
                          return readByOther
                            ? <CheckCheck className="w-3 h-3 text-[#c9a96e] shrink-0" />
                            : <Check className="w-3 h-3 text-white/25 shrink-0" />;
                        })()}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Image preview */}
            {imagePreview && (
              <div className="px-5 pb-2">
                <div className="relative inline-block">
                  <img src={imagePreview} alt="preview" className="h-16 rounded-xl border border-[rgba(201,169,110,0.12)] object-cover" />
                  <button type="button" onClick={() => { setImageData(null); setImagePreview(null); }}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Audio preview */}
            {audioBlob && (
              <div className="px-5 pb-2 flex items-center gap-3">
                <audio src={URL.createObjectURL(audioBlob)} controls className="h-8 flex-1" style={{ filter: 'invert(0.8) hue-rotate(200deg)', colorScheme: 'dark' }} />
                <button onClick={() => setAudioBlob(null)} className="text-white/30 hover:text-red-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
                <button onClick={sendVoiceMessage} disabled={sending}
                  className="px-3 py-1.5 rounded-lg bg-[#c9a96e] text-white text-xs font-medium hover:bg-[#c9a96e] disabled:opacity-50 transition-all">
                  {sending ? '…' : 'Send'}
                </button>
              </div>
            )}

            {/* Compose row */}
            <div className="flex gap-2 px-5 py-3 border-t border-[rgba(201,169,110,0.08)] bg-[#0d0b08]">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <button type="button" onClick={() => fileRef.current?.click()}
                className="shrink-0 w-9 h-9 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] flex items-center justify-center text-white/40 hover:text-[#c9a96e] hover:border-[rgba(201,169,110,0.25)] hover:bg-[rgba(201,169,110,0.08)] transition-all">
                <ImagePlus className="w-4 h-4" />
              </button>
              <button type="button"
                onClick={recording ? stopRecording : startRecording}
                className={`shrink-0 w-9 h-9 rounded-xl border flex items-center justify-center transition-all ${recording ? 'bg-red-500/20 border-red-500/40 text-red-400 animate-pulse' : 'bg-[rgba(201,169,110,0.04)] border-[rgba(201,169,110,0.12)] text-white/40 hover:text-[#c9a96e] hover:border-[rgba(201,169,110,0.25)] hover:bg-[rgba(201,169,110,0.08)]'}`}>
                {recording ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
              <Input value={text} onChange={e => setText(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                placeholder="Type a message…"
                className="flex-1 bg-[rgba(201,169,110,0.04)] border-[rgba(201,169,110,0.12)] text-white placeholder:text-white/25 text-sm h-9 focus:border-[rgba(201,169,110,0.5)]" />
              <button type="button" disabled={(!text.trim() && !imageData) || sending} onClick={handleSend}
                className="shrink-0 w-9 h-9 rounded-xl bg-[#c9a96e] text-white flex items-center justify-center hover:opacity-90 disabled:opacity-40 transition-all">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </button>
            </div>
          </>
        ) : (
          /* Option A: Rich empty state */
          <div className="flex-1 overflow-y-auto px-6 py-8">
            <div className="max-w-sm mx-auto space-y-6">
              {/* Hero */}
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.18)] flex items-center justify-center mx-auto">
                  <MessageSquare className="w-7 h-7 text-[#c9a96e]" />
                </div>
                <p className="text-white font-semibold">Your Messages</p>
                <p className="text-white/40 text-sm">Send a message or start a new group chat</p>
              </div>
              {/* Quick actions */}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setShowNewGroup(true)}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.10)] hover:border-[rgba(201,169,110,0.25)] hover:bg-[rgba(201,169,110,0.08)] transition-all text-center">
                  <Users className="w-5 h-5 text-[#c9a96e]" />
                  <span className="text-white/70 text-xs font-medium">New Group</span>
                </button>
                <button type="button" onClick={() => { const el = document.querySelector<HTMLInputElement>('input[placeholder="Search or start new chat…"]'); el?.focus(); }}
                  className="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.10)] hover:border-[rgba(201,169,110,0.25)] hover:bg-[rgba(201,169,110,0.08)] transition-all text-center">
                  <Search className="w-5 h-5 text-[#c9a96e]" />
                  <span className="text-white/70 text-xs font-medium">Find Someone</span>
                </button>
              </div>
              {/* Suggested people */}
              {followingSuggestions.length > 0 && (
                <div>
                  <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider mb-3">People you follow</p>
                  <div className="space-y-1">
                    {followingSuggestions.slice(0, 5).map(u => (
                      <button key={u.uid} type="button" onClick={() => startDM(u.uid)}
                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-[rgba(201,169,110,0.06)] border border-transparent hover:border-[rgba(201,169,110,0.12)] transition-all text-left">
                        <Avatar className="w-9 h-9 shrink-0">
                          <AvatarImage src={u.avatar} />
                          <AvatarFallback className="bg-gradient-to-br from-[#c9a96e] to-[#a07840] text-white text-sm font-semibold">{u.name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{u.name}</p>
                          <p className="text-white/40 text-xs">@{u.username}</p>
                        </div>
                        <MessageSquare className="w-3.5 h-3.5 text-[#c9a96e]/50 shrink-0" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Tip */}
              <div className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.08)] rounded-xl px-4 py-3">
                <p className="text-[#e8c98a]/70 text-[10px] font-semibold uppercase tracking-wider mb-1">Pro tip</p>
                <p className="text-white/40 text-xs leading-relaxed">Right-click any conversation to pin it to the top or mute notifications.</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* New Group Chat modal */}
      {showNewGroup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#0d0b08] border border-[rgba(201,169,110,0.18)] rounded-3xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(201,169,110,0.08)]">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#c9a96e]" />
                <span className="text-white font-semibold">New Group Chat</span>
              </div>
              <button type="button" onClick={() => { setShowNewGroup(false); setGroupName(''); setGroupSearch(''); setSelectedMembers([]); }}
                className="w-8 h-8 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] flex items-center justify-center text-white/40 hover:text-white transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="px-6 pt-4">
              <label className="text-white/40 text-[10px] font-semibold uppercase tracking-wider block mb-1.5">Group Name</label>
              <Input
                value={groupName}
                onChange={e => setGroupName(e.target.value)}
                placeholder="e.g. Morning Crew"
                className="bg-[rgba(201,169,110,0.04)] border-[rgba(201,169,110,0.12)] text-white placeholder:text-white/20 text-sm focus:border-[rgba(201,169,110,0.5)]"
              />
            </div>
            <div className="px-6 pt-3">
              <label className="text-white/40 text-[10px] font-semibold uppercase tracking-wider block mb-1.5">Add Members</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25 pointer-events-none" />
                <Input
                  value={groupSearch}
                  onChange={e => setGroupSearch(e.target.value)}
                  placeholder="Search by username..."
                  className="pl-8 bg-[rgba(201,169,110,0.04)] border-[rgba(201,169,110,0.12)] text-white placeholder:text-white/20 text-sm focus:border-[rgba(201,169,110,0.5)]"
                />
              </div>
            </div>
            {selectedMembers.length > 0 && (
              <div className="px-6 pt-3 flex flex-wrap gap-1.5">
                {selectedMembers.map(m => (
                  <span key={m.uid} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[rgba(201,169,110,0.12)] border border-[rgba(201,169,110,0.25)] text-[#e8c98a] text-xs font-medium">
                    {m.name}
                    <button type="button" onClick={() => setSelectedMembers(p => p.filter(x => x.uid !== m.uid))}
                      className="text-[#c9a96e]/60 hover:text-[#c9a96e] transition-colors">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="px-6 pt-2 pb-4 overflow-y-auto max-h-48">
              {groupResultsLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="w-4 h-4 text-[#c9a96e] animate-spin" />
                </div>
              ) : groupResults.length > 0 ? (
                <div className="space-y-0.5">
                  {groupResults.map(u => {
                    const added = selectedMembers.some(m => m.uid === u.uid);
                    return (
                      <button key={u.uid} type="button"
                        onClick={() => setSelectedMembers(p => added ? p.filter(x => x.uid !== u.uid) : [...p, u])}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl transition-all ${added ? 'bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.20)]' : 'hover:bg-[rgba(201,169,110,0.04)] border border-transparent'}`}>
                        <Avatar className="w-8 h-8 shrink-0">
                          <AvatarImage src={u.avatar} />
                          <AvatarFallback className="bg-gradient-to-br from-[#c9a96e] to-[#a07840] text-white text-xs font-semibold">{u.name?.[0] || '?'}</AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0 text-left">
                          <p className="text-white text-sm font-medium truncate">{u.name}</p>
                          <p className="text-white/40 text-xs">@{u.username}</p>
                        </div>
                        {added && <Check className="w-4 h-4 text-[#c9a96e] shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              ) : groupSearch.trim().length >= 2 ? (
                <p className="text-white/25 text-sm text-center py-4">No users found</p>
              ) : null}
            </div>
            <div className="px-6 pb-5 pt-2 border-t border-[rgba(201,169,110,0.08)]">
              <button type="button" onClick={createGroup} disabled={creatingGroup || !groupName.trim() || selectedMembers.length === 0}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#c9a96e] to-[#e8c98a] text-[#080608] font-semibold text-sm hover:opacity-90 disabled:opacity-40 transition-all flex items-center justify-center gap-2">
                {creatingGroup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
                {creatingGroup ? 'Creating...' : `Create Group${selectedMembers.length > 0 ? ' (' + (selectedMembers.length + 1) + ')' : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
export default MessagesPage;
