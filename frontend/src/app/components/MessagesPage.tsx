// MessagesPage.tsx — DMs + Group chats + Follow Requests + Search

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Send, ArrowLeft, Loader2, ImagePlus, X, UserPlus, Check, CheckCheck,
  XCircle, Search, Users, Plus, MessageSquare, MessageCircle, Mic, MicOff, StopCircle, Radio,
  Pin, PinOff, BellOff, Bell, Dumbbell, Trophy, Zap, Pencil, Trash2, LogOut,
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
  icon?: string | null;
  createdBy?: string | null;
  admins?: string[];
  lastMessage: string;
  lastMessageAt: string;
  unreadCount: number;
  participants?: string[];
}

interface GroupInfo {
  id: string; name: string; icon: string | null;
  createdBy: string; admins: string[];
  members: { uid: string; name: string; username: string; avatar: string }[];
  createdAt: string;
}

interface Message {
  id: string; senderId: string; text: string; audio?: string;
  image?: string; createdAt: string; readBy: string[];
  reactions?: Record<string, string[]>;
  replyTo?: { id: string; text: string; senderId: string; senderName?: string };
  editedAt?: string; deleted?: boolean;
  _changeType?: 'added' | 'modified';
}

interface MessageGroup {
  senderId: string;
  messages: Message[];
  firstTime: string;
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
  const [msgSearch, setMsgSearch]               = useState('');
  const [showMsgSearch, setShowMsgSearch]       = useState(false);
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
  const [contextMenuPos,  setContextMenuPos]    = useState<{x:number;y:number}>({x:0,y:0});
  const [showGroupInfo,   setShowGroupInfo]     = useState(false);
  const [groupInfo,       setGroupInfo]         = useState<GroupInfo | null>(null);
  const [groupInfoLoading,setGroupInfoLoading]  = useState(false);

  const handleConvContextMenu = (e: React.MouseEvent, convId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({ x: e.clientX, y: e.clientY });
    setContextMenuConv(convId);
  };

  const handleDeleteConv = async (convId: string) => {
    setContextMenuConv(null);
    try {
      await authFetch(`${API}/conversations/${convId}`, { method: 'DELETE' });
      setConversations(cs => cs.filter(c => c.id !== convId));
      if (activeConvId === convId) setActiveConvId(null);
      toast.success('Chat deleted');
    } catch { toast.error('Failed to delete chat'); }
  };

  const handleLeaveGroup = async (convId: string) => {
    setContextMenuConv(null);
    try {
      await authFetch(`${API}/conversations/${convId}/leave`, { method: 'POST' });
      setConversations(cs => cs.filter(c => c.id !== convId));
      if (activeConvId === convId) setActiveConvId(null);
      toast.success('Left group');
    } catch { toast.error('Failed to leave group'); }
  };

  const openGroupInfo = async (convId: string) => {
    setShowGroupInfo(true);
    setGroupInfoLoading(true);
    try {
      const res = await authFetch(`${API}/conversations/${convId}/info`);
      const data = await res.json();
      setGroupInfo(data);
    } catch { toast.error('Failed to load group info'); }
    finally { setGroupInfoLoading(false); }
  };

  const [memberActionUid, setMemberActionUid] = useState<string | null>(null);

  const groupAction = async (action: 'promote'|'demote'|'kick'|'transfer', targetUid: string) => {
    if (!groupInfo) return;
    setMemberActionUid(null);
    try {
      let res: Response;
      if (action === 'transfer') {
        res = await authFetch(`${API}/conversations/${groupInfo.id}/transfer`, { method: 'POST', body: JSON.stringify({ toUid: targetUid }) });
      } else if (action === 'kick') {
        res = await authFetch(`${API}/conversations/${groupInfo.id}/members/${targetUid}`, { method: 'DELETE' });
      } else {
        res = await authFetch(`${API}/conversations/${groupInfo.id}/members/${targetUid}/${action}`, { method: 'POST' });
      }
      if (!res.ok) { const d = await res.json(); toast.error(d.error || 'Failed'); return; }
      // Refresh group info
      const updated = await authFetch(`${API}/conversations/${groupInfo.id}/info`);
      setGroupInfo(await updated.json());
      const labels = { promote: 'Promoted to Admin', demote: 'Removed admin role', kick: 'Member removed', transfer: 'Leadership transferred' };
      toast.success(labels[action]);
      if (action === 'kick') setConversations(cs => cs.map(c => c.id === groupInfo.id ? { ...c, participantCount: (c.participantCount || 1) - 1 } : c));
    } catch { toast.error('Action failed'); }
  };

  const handleGroupIconChange = async (convId: string, file: File) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target?.result as string;
      try {
        const res = await authFetch(`${API}/conversations/${convId}`, {
          method: 'PATCH', body: JSON.stringify({ icon: base64 }),
        });
        if (!res.ok) { toast.error('Failed to update icon'); return; }
        setGroupInfo(g => g ? { ...g, icon: base64 } : g);
        setConversations(cs => cs.map(c => c.id === convId ? { ...c, icon: base64 } : c));
        toast.success('Group icon updated');
      } catch { toast.error('Failed to update icon'); }
    };
    reader.readAsDataURL(file);
  };
  // Option C: workout attachment picker
  const [showWorkoutPick, setShowWorkoutPick]   = useState(false);

  // Emoji reactions
  const [hoveredMsgId, setHoveredMsgId]         = useState<string | null>(null);
  const hoverTimeoutRef                          = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Reply + typing
  const [replyTo, setReplyTo]                   = useState<Message | null>(null);
  const [editingMsgId, setEditingMsgId]         = useState<string | null>(null);
  const [editText, setEditText]                 = useState('');
  const [typingUsers, setTypingUsers]            = useState<string[]>([]);
  const typingClearRef                           = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const activeConvRef  = useRef<string | null>(null); // tracks which conv messages belong to

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
      // Deduplicate: for DMs keep only the latest conversation per other user
      const raw: Conversation[] = data.conversations || [];
      const seen = new Map<string, Conversation>();
      for (const c of raw) {
        // Key: otherUser uid if available, else name for direct, else conv id
        const key = c.type === 'direct'
          ? (c.otherUser?.uid || c.name || c.id)
          : c.id;
        const existing = seen.get(key);
        if (!existing) { seen.set(key, c); continue; }
        const ta = existing.lastMessageAt ? new Date(existing.lastMessageAt).getTime() : 0;
        const tb = c.lastMessageAt ? new Date(c.lastMessageAt).getTime() : 0;
        if (tb > ta) seen.set(key, c);
      }
      setConversations(Array.from(seen.values()));
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
                name: u.name || u.name || 'User',
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
      // Guard: if the user switched conversations while fetch was in flight, discard result
      if (activeConvRef.current !== convId) return;
      setMessages(prev => {
        const next = data.messages || [];
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
    // Use a local flag so async callbacks can detect stale conv
    let active = true;

    // ① Kill old connections, null out handlers so onerror can't restart polls
    if (sseRef.current) {
      sseRef.current.onmessage = null;
      sseRef.current.onerror = null;
      sseRef.current.close();
      sseRef.current = null;
    }
    if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }

    // ② Register this conv as the current one, then clear messages
    activeConvRef.current = activeConvId;
    setMessages([]);

    // ③ Load new conversation's messages
    loadMessages(activeConvId, true);

    const token = getAuthToken();
    if (token) {
      const url = `${API}/conversations/${activeConvId}/stream?token=${encodeURIComponent(token)}`;
      const sse = new EventSource(url);
      sseRef.current = sse;

      sse.onmessage = (e) => {
        if (!active) return;
        try {
          const msg: Message = JSON.parse(e.data);
          const changeType = msg._changeType || 'added';
          setMessages(prev => {
            if (changeType === 'modified') return prev.map(m => m.id === msg.id ? { ...m, reactions: msg.reactions } : m);
            if (prev.some(m => m.id === msg.id)) return prev;
            return [...prev, msg];
          });
          if (changeType === 'added') {
            authFetch(`${API}/conversations/${activeConvId}/read`, { method: 'POST' }).catch(() => {});
          }
        } catch {}
      };

      sse.onerror = () => {
        if (!active) return;
        sse.onmessage = null;
        sse.onerror = null;
        sse.close();
        sseRef.current = null;
        if (!pollRef.current) {
          pollRef.current = setInterval(() => { if (active) loadMessages(activeConvId, false, true); }, 2000);
        }
      };
    } else {
      pollRef.current = setInterval(() => { if (active) loadMessages(activeConvId, false, true); }, 2000);
    }

    return () => {
      active = false;
      if (sseRef.current) { sseRef.current.onmessage = null; sseRef.current.onerror = null; sseRef.current.close(); sseRef.current = null; }
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
      // Use RAF so DOM renders messages before we scroll (avoids flash)
      requestAnimationFrame(() => scrollToBottom(false));
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
        const sq = groupSearch.trim().replace(/^@/, '').toLowerCase();
        setGroupResults(
          (d.users || []).filter((u: SearchUser) =>
            u.uid !== currentUser?.id &&
            (u.name?.toLowerCase().includes(sq) || u.username?.toLowerCase().includes(sq))
          )
        );
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
  const editMessage = async (msgId: string, newText: string) => {
    if (!activeConvId || !newText.trim()) return;
    setEditingMsgId(null);
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, text: newText.trim() } : m));
    try {
      await authFetch(`${API}/conversations/${activeConvId}/messages/${msgId}`, {
        method: 'PATCH', body: JSON.stringify({ text: newText.trim() }),
      });
    } catch { toast.error('Failed to edit message'); }
  };

  const deleteMessage = async (msgId: string) => {
    if (!activeConvId) return;
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, deleted: true, text: '' } : m));
    try {
      await authFetch(`${API}/conversations/${activeConvId}/messages/${msgId}`, { method: 'DELETE' });
    } catch { toast.error('Failed to delete message'); }
  };

  const handleSend = async () => {
    if ((!text.trim() && !imageData) || !activeConvId) return;
    const outgoingText = text.trim();
    const replyToId = replyTo?.id;
    setText('');
    setImageData(null); setImagePreview(null);
    setReplyTo(null);
    setSending(true);
    try {
      const res = await authFetch(`${API}/conversations/${activeConvId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text: outgoingText, image: imageData, replyToId }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${res.status}`);
      }
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

  // ── Message groups (Discord-style: consecutive same-sender within 5 min) ─────
  const messageGroups = useMemo<MessageGroup[]>(() => {
    const groups: MessageGroup[] = [];
    for (const msg of messages) {
      const last = groups[groups.length - 1];
      const sameSender = last?.senderId === msg.senderId;
      const prevTime = last ? new Date(last.messages[last.messages.length - 1].createdAt).getTime() : 0;
      const diff = new Date(msg.createdAt).getTime() - prevTime;
      if (sameSender && diff < 5 * 60 * 1000) {
        last.messages.push(msg);
      } else {
        groups.push({ senderId: msg.senderId, messages: [msg], firstTime: msg.createdAt });
      }
    }
    return groups;
  }, [messages]);

  // ── Typing notification ────────────────────────────────────────────────────
  const sendTyping = useCallback(() => {
    if (!activeConvId) return;
    authFetch(`${API}/conversations/${activeConvId}/typing`, { method: 'POST' }).catch(() => {});
  }, [activeConvId]);

  // Poll for typing indicator every 3s while a conversation is open
  useEffect(() => {
    if (!activeConvId) { setTypingUsers([]); return; }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await authFetch(`${API}/conversations/${activeConvId}/typing`);
        if (!cancelled && res.ok) {
          const d = await res.json();
          setTypingUsers(d.typing || []);
        }
      } catch {}
    };
    poll();
    const t = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(t); };
  }, [activeConvId]);

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
    <div className="h-full flex overflow-hidden">

      {/* ── Left sidebar — compact icon strip ─────────────────────────── */}
      <div className={`w-[68px] shrink-0 flex flex-col items-center py-3 gap-2 bg-[#070507] border-r border-white/[0.05]
        ${mobileShowThread ? 'hidden md:flex' : 'flex'}`}>

        {/* Conversations as avatar circles */}
        {loadingConvs ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-4 h-4 text-[#c9a96e] animate-spin" />
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 w-full px-2 flex-1">
            {sortedFilteredConvs.map(conv => {
              const isActive = activeConvId === conv.id;
              const isCommunity = conv.type === 'community';
              const initials = (conv.name || '?')[0]?.toUpperCase();
              const avatarSrc = conv.type === 'direct' ? conv.otherUser?.avatar : undefined;
              const hasUnread = conv.unreadCount > 0;
              return (
                <div key={conv.id} className="relative w-full flex items-center justify-center group/convbtn" onContextMenu={e => handleConvContextMenu(e, conv.id)}>
                  {/* Active indicator pill */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r-full bg-white" />
                  )}
                  {/* Hover tooltip */}
                  <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-[#18160f] border border-white/[0.1] rounded-lg text-white text-xs font-semibold whitespace-nowrap pointer-events-none opacity-0 group-hover/convbtn:opacity-100 transition-opacity z-50 shadow-xl">
                    {conv.name}
                    {conv.type === 'community' && <span className="ml-1 text-[#c9a96e] text-[10px]">Community</span>}
                  </div>
                  <button
                    type="button"
                    onClick={() => { setActiveConvId(conv.id); setMobileShowThread(true); setContextMenuConv(null); setConversations(cs => cs.map(c => c.id === conv.id ? { ...c, unreadCount: 0 } : c)); }}
                    className={`relative w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold transition-all
                      ${isActive ? 'rounded-2xl' : 'hover:rounded-2xl'}
                    `}
                  >
                    {isCommunity ? (
                      <div className={`w-11 h-11 rounded-[inherit] flex items-center justify-center text-xl transition-all
                        ${isActive ? 'bg-[#c9a96e]/20 rounded-2xl' : 'bg-[rgba(255,255,255,0.06)]'}`}>
                        {conv.emoji || '👥'}
                      </div>
                    ) : avatarSrc ? (
                      <img src={avatarSrc} alt={conv.name} className={`w-11 h-11 object-cover transition-all ${isActive ? 'rounded-2xl' : 'rounded-full'}`} />
                    ) : (
                      <div className={`w-11 h-11 flex items-center justify-center text-white text-sm font-bold transition-all
                        bg-gradient-to-br from-[#c9a96e] to-[#a07840]
                        ${isActive ? 'rounded-2xl' : 'rounded-full'}`}>
                        {initials}
                      </div>
                    )}
                    {/* Unread dot */}
                    {hasUnread && (
                      <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#c9a96e] text-[#080608] text-[9px] font-bold flex items-center justify-center border-2 border-[#070507]">
                        {conv.unreadCount > 9 ? '9+' : conv.unreadCount}
                      </span>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Divider */}
        <div className="w-8 h-px bg-white/[0.08] my-1" />

        {/* New conversation button */}
        <button
          type="button"
          title="New conversation"
          onClick={() => setShowNewGroup(true)}
          className="w-11 h-11 rounded-full bg-[rgba(255,255,255,0.06)] flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-[rgba(255,255,255,0.1)] transition-all hover:rounded-2xl"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {/* ── Message thread

      {/* ── Message thread ────────────────────────────────────────────────── */}
      <div className={`flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden bg-[#0d0b09] ${!mobileShowThread ? 'hidden md:flex' : 'flex'}`}>
        {activeConv ? (
          <>
            {/* Thread header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.06] bg-[#0a0806]">
              <button type="button" className="md:hidden shrink-0 text-white/50 hover:text-white" onClick={() => setMobileShowThread(false)}>
                <ArrowLeft className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
                onClick={() => {
                  if (activeConv.type === 'direct' && activeConv.otherUser?.uid && onViewProfile) {
                    onViewProfile(activeConv.otherUser.uid);
                  }
                }}
                disabled={activeConv.type === 'community'}
              >
                <div className="relative shrink-0">
                  {activeConv.type === 'group' && activeConv.icon ? (
                    <img src={activeConv.icon} className="w-9 h-9 rounded-xl object-cover" alt={activeConv.name} />
                  ) : activeConv.type === 'group' && activeConv.participantProfiles ? (
                    <GroupAvatarStack profiles={activeConv.participantProfiles} />
                  ) : (
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={activeConv.otherUser?.avatar} />
                      <AvatarFallback className="bg-gradient-to-br from-[#c9a96e] to-[#a07840] text-white text-sm font-bold">
                        {(activeConv.name || '?')[0]?.toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  {otherUserPresence?.isOnline && (
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[#0a0806]" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <p className="text-white font-semibold text-[14px] leading-tight">{activeConv.name}</p>
                    {otherUserPresence?.isOnline && <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />}
                  </div>
                  {activeConv.type === 'direct' && otherUserPresence ? (
                    <p className="text-[11px] mt-0.5">
                      {otherUserPresence.isOnline
                        ? <span className="text-green-400">Active now</span>
                        : otherUserPresence.lastSeen
                          ? <span className="text-white/30">{(() => {
                              const diff = Date.now() - new Date(otherUserPresence.lastSeen).getTime();
                              const mins = Math.floor(diff / 60000);
                              if (mins < 1) return 'active just now';
                              if (mins < 60) return `active ${mins}m ago`;
                              const hrs = Math.floor(mins / 60);
                              return hrs < 24 ? `active ${hrs}h ago` : `active ${Math.floor(hrs/24)}d ago`;
                            })()}</span>
                          : <span className="text-white/30">@{activeConv.otherUser?.username || ''}</span>}
                    </p>
                  ) : (
                    <p className="text-white/30 text-[11px] mt-0.5">
                      {activeConv.type === 'group' ? `${activeConv.participantCount} members` : `@${activeConv.otherUser?.username || ''}`}
                    </p>
                  )}
                </div>
              </button>
              {/* Right-side header actions */}
              <div className="flex items-center gap-1 shrink-0">
                <button type="button"
                  onClick={() => { setShowMsgSearch(s => !s); setMsgSearch(''); }}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg transition-all ${showMsgSearch ? 'text-[#c9a96e] bg-[rgba(201,169,110,0.1)]' : 'text-white/30 hover:text-white/60 hover:bg-white/[0.06]'}`}>
                  <Search className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Inline message search bar */}
            {showMsgSearch && (
              <div className="px-4 py-2 bg-[#0a0806] border-b border-white/[0.04] flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-white/30 shrink-0" />
                <input
                  autoFocus
                  value={msgSearch}
                  onChange={e => setMsgSearch(e.target.value)}
                  placeholder="Search messages…"
                  className="flex-1 bg-transparent text-white/80 text-sm placeholder:text-white/25 focus:outline-none"
                />
                {msgSearch && (
                  <button type="button" onClick={() => setMsgSearch('')} className="text-white/25 hover:text-white/50">
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
            {/* Messages — Discord-style grouped */}
            <div ref={messagesContainerRef} className="flex-1 overflow-y-auto px-4 py-4 bg-[#0d0b09]">
              {loadingMsgs ? (
                <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 text-[#c9a96e] animate-spin" /></div>
              ) : messageGroups.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-16">
                  <MessageSquare className="w-8 h-8 text-white/10 mb-3" />
                  <p className="text-white/30 text-sm">No messages yet. Say hello 👋</p>
                </div>
              ) : (
                <div className="flex flex-col min-h-full"><div className="space-y-5 pt-2">
                  {/* ── Conversation start banner ── */}
                  <div className="flex flex-col items-start px-2 pb-6 mb-4 border-b border-white/[0.05]">
                    {activeConv.type === 'group' && activeConv.participantProfiles ? (
                      <GroupAvatarStack profiles={activeConv.participantProfiles} />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#c9a96e] to-[#a07840] flex items-center justify-center text-white text-2xl font-bold mb-3">
                        {(activeConv.name || '?')[0]?.toUpperCase()}
                      </div>
                    )}
                    <p className="text-white font-bold text-xl mt-1">{activeConv.name}</p>
                    <p className="text-white/40 text-sm mt-0.5">
                      {activeConv.type === 'direct'
                        ? `This is the beginning of your conversation with ${activeConv.name}.`
                        : activeConv.type === 'group'
                          ? `Welcome to the group. ${activeConv.participantCount} members.`
                          : `Community · ${activeConv.name}`}
                    </p>
                  </div>
                  {messageGroups.filter(group =>
                    !msgSearch || group.messages.some(m => m.text?.toLowerCase().includes(msgSearch.toLowerCase()))
                  ).map((group, gi) => {
                    const isOwn = group.senderId === currentUser.id;
                    const senderProfile = activeConv.type === 'group'
                      ? activeConv.participantProfiles?.find(p => p.uid === group.senderId)
                      : (isOwn ? null : activeConv.otherUser);
                    const senderName = senderProfile?.name || (isOwn ? currentUser.name || currentUser.name : 'Member');
                    const senderAvatar = senderProfile?.avatar;
                    return (
                      <div key={gi} className="flex gap-2.5 justify-start mt-3">
                        {/* Avatar — always on left */}
                        <Avatar className="w-8 h-8 shrink-0 mt-1">
                          <AvatarImage src={isOwn ? currentUser?.avatar : senderAvatar} />
                          <AvatarFallback className={`text-white text-[10px] font-semibold ${isOwn ? 'bg-gradient-to-br from-orange-500 to-orange-700' : 'bg-gradient-to-br from-[#c9a96e] to-[#a07840]'}`}>
                            {isOwn ? (currentUser?.name || currentUser?.name || 'Me')[0]?.toUpperCase() : (senderName || '?')[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex flex-col gap-0.5 max-w-[72%] items-start">
                          {/* Name + time header — always shown */}
                          <div className="flex items-baseline gap-2 px-0.5 mb-0.5">
                            <span className={`text-xs font-medium ${isOwn ? 'text-[#c9a96e]' : 'text-white/70'}`}>
                              {isOwn ? (currentUser?.name || currentUser?.name || 'You') : senderName}
                            </span>
                            <span className="text-white/25 text-[10px]">{formatSmartDate(group.firstTime)}</span>
                          </div>
                          {/* Messages in group */}
                          {group.messages.map((msg, mi) => {
                            const isLast = mi === group.messages.length - 1;
                            const reactionEntries = Object.entries(msg.reactions || {});
                            const showPicker = hoveredMsgId === msg.id;
                            const otherIds = (activeConv.participants || []).filter((id: string) => id !== currentUser.id);
                            const readByOther = isOwn && otherIds.some((id: string) => (msg.readBy || []).includes(id));
                            return (
                              <div key={msg.id} className="relative group/msg w-full">
                                {/* Reply-to quote */}
                                {msg.replyTo && (
                                  <div className="flex mb-1 justify-start">
                                    <div className="border-l-2 border-[#c9a96e]/50 pl-2 bg-[rgba(201,169,110,0.04)] rounded-r-lg px-2 py-1 max-w-[90%]">
                                      <p className="text-[#c9a96e]/70 text-[10px] font-medium">{msg.replyTo.senderName || 'Someone'}</p>
                                      <p className="text-white/40 text-[11px] truncate">{msg.replyTo.text || '📎 Attachment'}</p>
                                    </div>
                                  </div>
                                )}
                                {/* Bubble — own messages get a subtle gold tint to distinguish */}
                                <div
                                  className={`relative inline-block max-w-full text-sm leading-relaxed select-none transition-colors
                                    ${isOwn
                                      ? 'bg-[rgba(201,169,110,0.12)] text-white/90 rounded-2xl rounded-tl-md px-3.5 py-2'
                                      : 'text-white/88 py-0.5'
                                    }`}
                                  onMouseEnter={() => {
                                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                    hoverTimeoutRef.current = setTimeout(() => setHoveredMsgId(msg.id), 250);
                                  }}
                                  onMouseLeave={() => {
                                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                    hoverTimeoutRef.current = setTimeout(() => setHoveredMsgId(null), 400);
                                  }}
                                  onTouchStart={() => {
                                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                    hoverTimeoutRef.current = setTimeout(() => setHoveredMsgId(msg.id), 500);
                                  }}
                                  onTouchEnd={() => {
                                    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
                                  }}
                                >
                                  {/* Deleted message */}
                                  {msg.deleted ? (
                                    <p className="italic text-white/25 text-xs">Message deleted</p>
                                  ) : editingMsgId === msg.id ? (
                                    /* Inline edit */
                                    <div className="flex flex-col gap-1 min-w-[160px]">
                                      <input
                                        autoFocus
                                        value={editText}
                                        onChange={e => setEditText(e.target.value)}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); editMessage(msg.id, editText); }
                                          if (e.key === 'Escape') setEditingMsgId(null);
                                        }}
                                        className="bg-transparent text-[#080608] text-sm focus:outline-none w-full"
                                      />
                                      <div className="flex gap-2 text-[10px]">
                                        <button type="button" onClick={() => editMessage(msg.id, editText)} className="text-[#080608]/70 hover:text-[#080608] font-medium">Save</button>
                                        <button type="button" onClick={() => setEditingMsgId(null)} className="text-[#080608]/40 hover:text-[#080608]/70">Cancel</button>
                                      </div>
                                    </div>
                                  ) : (
                                    <>
                                      {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}{msg.editedAt && <span className="text-[10px] opacity-50 ml-1">(edited)</span>}</p>}
                                      {msg.image && <img src={msg.image} alt="attachment" className="mt-1.5 rounded-xl max-h-52 max-w-full object-cover" />}
                                      {msg.audio && (
                                        <div className="mt-1.5 flex items-center gap-2 min-w-[180px]">
                                          <Radio className="w-4 h-4 shrink-0 text-[#e8c98a]" />
                                          <audio src={msg.audio} controls className="h-8 flex-1 min-w-0" style={{ filter: 'invert(0.8) hue-rotate(200deg)', colorScheme: 'dark' }} />
                                        </div>
                                      )}
                                    </>
                                  )}
                                  {/* Hover actions */}
                                  {showPicker && !msg.deleted && (
                                    <div className={`absolute z-30 bottom-full mb-1 ${isOwn ? 'right-0' : 'left-0'} flex items-center gap-1`}
                                      onMouseEnter={() => { if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current); setHoveredMsgId(msg.id); }}
                                      onMouseLeave={() => { hoverTimeoutRef.current = setTimeout(() => setHoveredMsgId(null), 400); }}>
                                      <EmojiReactionPicker onPick={(emoji) => reactToMessage(msg.id, emoji)} />
                                      <button type="button" onClick={() => { setReplyTo(msg); setHoveredMsgId(null); }}
                                        className="w-7 h-7 rounded-full bg-[#0d0b08] border border-[rgba(201,169,110,0.2)] flex items-center justify-center text-white/50 hover:text-[#c9a96e] hover:border-[rgba(201,169,110,0.4)] transition-colors text-sm"
                                        title="Reply">↩</button>
                                      {isOwn && (
                                        <>
                                          <button type="button"
                                            onClick={() => { setEditingMsgId(msg.id); setEditText(msg.text || ''); setHoveredMsgId(null); }}
                                            className="w-7 h-7 rounded-full bg-[#0d0b08] border border-[rgba(201,169,110,0.2)] flex items-center justify-center text-white/50 hover:text-[#c9a96e] hover:border-[rgba(201,169,110,0.4)] transition-colors"
                                            title="Edit">
                                            <Pencil className="w-3 h-3" />
                                          </button>
                                          <button type="button"
                                            onClick={() => { deleteMessage(msg.id); setHoveredMsgId(null); }}
                                            className="w-7 h-7 rounded-full bg-[#0d0b08] border border-red-500/20 flex items-center justify-center text-white/50 hover:text-red-400 hover:border-red-500/40 transition-colors"
                                            title="Delete">
                                            <Trash2 className="w-3 h-3" />
                                          </button>
                                        </>
                                      )}
                                    </div>
                                  )}
                                </div>
                                {/* Reactions */}
                                {reactionEntries.length > 0 && (
                                  <div className={`flex flex-wrap gap-1 mt-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                                    {reactionEntries.map(([emoji, uids]) => {
                                      const isMine = uids.includes(currentUser.id);
                                      return (
                                        <button key={emoji} type="button" onClick={() => reactToMessage(msg.id, emoji)}
                                          className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs transition-all border
                                            ${isMine ? 'bg-[#c9a96e]/20 border-[rgba(201,169,110,0.4)] text-[#e8c98a]' : 'bg-[rgba(255,255,255,0.05)] border-[rgba(255,255,255,0.08)] text-white/60 hover:bg-[rgba(201,169,110,0.08)]'}`}>
                                          <span>{emoji}</span>
                                          <span className="font-medium">{uids.length}</span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                                {/* Timestamp + read for own last message */}
                                {isOwn && isLast && (
                                  <div className="flex items-center justify-start gap-1 mt-0.5 px-0.5">
                                    {readByOther
                                      ? <CheckCheck className="w-3 h-3 text-[#c9a96e]" />
                                      : <Check className="w-3 h-3 text-white/25" />}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                  {/* Typing indicator */}
                  {typingUsers.length > 0 && (
                    <div className="flex gap-2.5 mt-3">
                      <div className="w-8 h-8 rounded-full bg-[rgba(255,255,255,0.06)] flex items-center justify-center shrink-0">
                        <span className="text-xs">💬</span>
                      </div>
                      <div className="bg-[rgba(255,255,255,0.06)] rounded-2xl rounded-tl-md px-3 py-2 flex items-center gap-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </div></div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Image preview */}
            {imagePreview && (
              <div className="px-4 pb-2">
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
              <div className="px-4 pb-2 flex items-center gap-3">
                <audio src={URL.createObjectURL(audioBlob)} controls className="h-8 flex-1" style={{ filter: 'invert(0.8) hue-rotate(200deg)', colorScheme: 'dark' }} />
                <button onClick={() => setAudioBlob(null)} className="text-white/30 hover:text-red-400 transition-colors">
                  <X className="w-4 h-4" />
                </button>
                <button onClick={sendVoiceMessage} disabled={sending}
                  className="px-3 py-1.5 rounded-lg bg-[#c9a96e] text-white text-xs font-medium hover:opacity-90 disabled:opacity-50 transition-all">
                  {sending ? '…' : 'Send'}
                </button>
              </div>
            )}

            {/* Reply indicator */}
            {replyTo && (
              <div className="mx-4 mb-1 flex items-center gap-2 bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.15)] rounded-xl px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-[#c9a96e] text-[10px] font-semibold">Replying to {replyTo.senderId === currentUser.id ? 'yourself' : (activeConv?.otherUser?.name || 'message')}</p>
                  <p className="text-white/50 text-xs truncate">{replyTo.text || '📎 Attachment'}</p>
                </div>
                <button type="button" onClick={() => setReplyTo(null)} className="text-white/30 hover:text-white/60 transition-colors shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* Compose row */}
            <div className="px-4 py-3 bg-[#0d0b09] border-t border-white/[0.06]">
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
              <div className="flex items-center gap-2 bg-white/[0.07] rounded-xl px-3 py-2">
                <button type="button" onClick={() => fileRef.current?.click()}
                  className="shrink-0 w-7 h-7 flex items-center justify-center text-white/30 hover:text-white/60 transition-colors">
                  <ImagePlus className="w-4 h-4" />
                </button>
                <button type="button" onClick={recording ? stopRecording : startRecording}
                  className={`shrink-0 w-7 h-7 flex items-center justify-center transition-all ${recording ? 'text-red-400 animate-pulse' : 'text-white/30 hover:text-white/60'}`}>
                  {recording ? <StopCircle className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
                <input
                  value={text}
                  onChange={e => { setText(e.target.value); sendTyping(); }}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder={replyTo ? 'Write a reply…' : `Message ${activeConv?.name || ''}…`}
                  className="flex-1 bg-transparent text-white/90 placeholder:text-white/25 text-sm focus:outline-none"
                />
                <button type="button" disabled={(!text.trim() && !imageData) || sending} onClick={handleSend}
                  className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-all disabled:opacity-30 text-[#c9a96e] hover:text-[#e8c98a]">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/[0.04] border border-white/[0.06] flex items-center justify-center mb-5">
              <MessageSquare className="w-8 h-8 text-white/20" />
            </div>
            <p className="text-white/70 font-semibold text-base mb-1">Direct Messages</p>
            <p className="text-white/30 text-sm mb-6 max-w-[260px]">Select a conversation or start a new one</p>
            <div className="flex gap-3">
              <button type="button" onClick={() => setShowNewGroup(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/[0.05] hover:bg-white/[0.08] text-white/60 hover:text-white/80 text-sm font-medium transition-all">
                <Users className="w-4 h-4" />New Group
              </button>
              <button type="button" onClick={() => { const el = document.querySelector<HTMLInputElement>('input[placeholder="Find or start a conversation"]'); el?.focus(); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#c9a96e] hover:opacity-90 text-[#080608] text-sm font-semibold transition-all">
                <Search className="w-4 h-4" />Find Someone
              </button>
            </div>
            {followingSuggestions.length > 0 && (
              <div className="mt-8 w-full max-w-[320px]">
                <p className="text-white/20 text-[10px] font-semibold uppercase tracking-widest mb-3">People you follow</p>
                <div className="space-y-1">
                  {followingSuggestions.slice(0, 4).map(u => (
                    <button key={u.uid} type="button" onClick={() => startDM(u.uid)}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/[0.04] transition-all text-left">
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarImage src={u.avatar} />
                        <AvatarFallback className="bg-gradient-to-br from-[#c9a96e] to-[#a07840] text-white text-xs font-bold">{u.name?.[0] || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-white/70 text-sm font-medium truncate">{u.name}</p>
                        <p className="text-white/25 text-xs">@{u.username}</p>
                      </div>
                      <Send className="w-3 h-3 text-white/20" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Conversation right-click context menu */}
      {contextMenuConv && (() => {
        const conv = conversations.find(c => c.id === contextMenuConv);
        if (!conv) return null;
        const isGroup = conv.type === 'group';
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenuConv(null)} />
            <div className="fixed z-50 w-44 bg-[#0d0b08] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden py-1"
              style={{ top: contextMenuPos.y, left: contextMenuPos.x }}>
              {isGroup ? (
                <button type="button" onClick={() => handleLeaveGroup(conv.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-all">
                  <LogOut className="w-4 h-4" /> Leave group
                </button>
              ) : (
                <button type="button" onClick={() => handleDeleteConv(conv.id)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-all">
                  <Trash2 className="w-4 h-4" /> Delete chat
                </button>
              )}
            </div>
          </>
        );
      })()}

      {/* Group Info Panel */}
      {showGroupInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-end bg-black/50 backdrop-blur-sm" onClick={() => setShowGroupInfo(false)}>
          <div className="w-full max-w-xs h-full bg-[#0a0806] border-l border-white/[0.06] flex flex-col overflow-y-auto" onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.06]">
              <p className="text-white font-semibold">Group Info</p>
              <button type="button" onClick={() => setShowGroupInfo(false)} className="text-white/40 hover:text-white"><X className="w-5 h-5" /></button>
            </div>

            {groupInfoLoading ? (
              <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" /></div>
            ) : groupInfo ? (
              <div className="p-5 space-y-6">
                {/* Group icon + name */}
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    {groupInfo.icon ? (
                      <img src={groupInfo.icon} className="w-20 h-20 rounded-2xl object-cover border border-white/[0.08]" alt="Group" />
                    ) : (
                      <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#c9a96e]/30 to-[#c9a96e]/10 border border-white/[0.08] flex items-center justify-center text-3xl">
                        👥
                      </div>
                    )}
                    {/* Change icon button — leader only */}
                    {groupInfo.createdBy === currentUser?.id && (
                      <label className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-[#c9a96e] flex items-center justify-center cursor-pointer hover:opacity-90 transition-opacity border-2 border-[#0a0806]">
                        <input type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleGroupIconChange(groupInfo.id, f); }} />
                        <Plus className="w-3.5 h-3.5 text-[#0d0b08]" />
                      </label>
                    )}
                  </div>
                  <p className="text-white font-bold text-lg text-center">{groupInfo.name}</p>
                  <p className="text-white/30 text-xs">{groupInfo.members.length} members</p>
                </div>

                {/* Members list */}
                <div>
                  <p className="text-white/30 text-[10px] uppercase tracking-wider font-semibold mb-3">Members</p>
                  <div className="space-y-1">
                    {groupInfo.members.map(m => {
                      const isLeader   = m.uid === groupInfo.createdBy;
                      const isAdmin    = groupInfo.admins.includes(m.uid);
                      const iAmLeader  = groupInfo.createdBy === currentUser?.id;
                      const isSelf     = m.uid === currentUser?.id;
                      const showMenu   = memberActionUid === m.uid;
                      return (
                        <div key={m.uid} className="relative">
                          <div className="flex items-center gap-3 py-2 px-3 rounded-xl hover:bg-white/[0.03] transition-all">
                            <Avatar className="w-9 h-9 shrink-0">
                              <AvatarImage src={m.avatar} />
                              <AvatarFallback className="bg-gradient-to-br from-[#c9a96e] to-[#a07840] text-white text-xs font-bold">{m.name[0]}</AvatarFallback>
                            </Avatar>
                            <div className="flex-1 min-w-0">
                              <p className="text-white/80 text-sm font-medium truncate">{m.name}{isSelf && <span className="text-white/30 text-xs ml-1">(you)</span>}</p>
                              {m.username && <p className="text-white/30 text-xs">@{m.username}</p>}
                            </div>
                            {isLeader && <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-[rgba(201,169,110,0.15)] text-[#c9a96e] border border-[rgba(201,169,110,0.2)] font-semibold">Leader</span>}
                            {!isLeader && isAdmin && <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-[rgba(99,102,241,0.15)] text-indigo-300 border border-indigo-500/20 font-semibold">Admin</span>}
                            {/* Action button — only leader sees it, not for themselves */}
                            {iAmLeader && !isSelf && (
                              <button type="button" onClick={() => setMemberActionUid(showMenu ? null : m.uid)}
                                className="w-6 h-6 rounded-full flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/[0.08] transition-all text-lg leading-none">
                                ⋯
                              </button>
                            )}
                          </div>
                          {/* Action dropdown */}
                          {showMenu && iAmLeader && (
                            <>
                              <div className="fixed inset-0 z-40" onClick={() => setMemberActionUid(null)} />
                              <div className="absolute right-0 top-full mt-1 z-50 w-48 bg-[#0d0b08] border border-white/[0.08] rounded-xl shadow-2xl overflow-hidden py-1">
                                {isAdmin ? (
                                  <button type="button" onClick={() => groupAction('demote', m.uid)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-white/60 hover:bg-white/[0.05] hover:text-white transition-all">
                                    ↓ Remove Admin role
                                  </button>
                                ) : (
                                  <button type="button" onClick={() => groupAction('promote', m.uid)}
                                    className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-indigo-300 hover:bg-indigo-500/10 transition-all">
                                    ↑ Make Admin
                                  </button>
                                )}
                                <button type="button" onClick={() => groupAction('transfer', m.uid)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-[#c9a96e] hover:bg-[rgba(201,169,110,0.08)] transition-all">
                                  👑 Transfer Leadership
                                </button>
                                <div className="border-t border-white/[0.05] my-1" />
                                <button type="button" onClick={() => groupAction('kick', m.uid)}
                                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-all">
                                  ✕ Remove from group
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Leave group */}
                <button type="button"
                  onClick={() => { setShowGroupInfo(false); handleLeaveGroup(groupInfo.id); }}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-red-500/20 text-red-400 hover:bg-red-500/10 transition-all text-sm font-medium">
                  <LogOut className="w-4 h-4" /> Leave group
                </button>
              </div>
            ) : null}
          </div>
        </div>
      )}

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
