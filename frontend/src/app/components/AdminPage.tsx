// AdminPage.tsx ─ Full Admin Control Panel
// Only visible to users whose accountType === 'admin'.
//
// TABS:
//   1. Overview    — live platform stats + charts computed from Firestore data
//   2. Users       — list every user, ban/unban, change role, delete, reset pw
//   3. Content     — view/delete/pin every post + delete individual comments
//   4. Challenges  — create and delete community challenges
//   5. Tools       — send announcements, export data as CSV/JSON, audit log

import { useState, useEffect, useCallback } from 'react';
import {
  BadgeCheck,
  Users, FileText, ShieldCheck, BarChart2, Bell, Wrench,
  Trash2, Ban, CheckCircle, Search, RefreshCw, TrendingUp,
  MessageSquare, Heart, Pin, PinOff, Trophy, Download,
  AlertTriangle, ChevronDown, Plus, Send, Activity,
  UserCheck, UserX, Crown, Shield, Eye, EyeOff,
} from 'lucide-react';
import { WorkoutPost, User } from '../types';
import { fetchPosts } from '../../services/postService';
import {
  getAllUsers, banUser, changeUserRole, deleteUser, resetUserPassword, setUserPassword,
  deletePost, pinPost, deleteComment,
  getChallenges, createChallenge, deleteChallenge,
  getAnnouncements, sendAnnouncement, deleteAnnouncement,
  getActivityLog, exportAsJSON, exportAsCSV, resetAllFollows,
  getAdminHealth, getReportedPosts, dismissReport, deleteReportedPost,
} from '../../services/adminService';
import type { ReportedPost } from '../../services/adminService';
import { toast } from 'sonner';
import { authFetch } from '../../utils/authToken';

import { API, API_HOST } from '../../config';

// ─── Types ────────────────────────────────────────────────────────────────────
interface FirestoreUser {
  uid: string;
  displayName?: string;
  email?: string;
  accountType?: string;
  username?: string;
  avatar?: string;
  banned?: boolean;
  bannedReason?: string;
  verified?: boolean;
  subscription?: { active?: boolean; tier?: string };
  createdAt?: string;
}

interface Challenge {
  id: string;
  title: string;
  description: string;
  type: string;
  targetValue: number;
  durationDays: number;
  participants: number;
  isActive: boolean;
  createdAt: string;
}

interface Announcement {
  id: string;
  title: string;
  message: string;
  type: string;
  createdAt: string;
  isActive: boolean;
}

interface LogEntry {
  id: string;
  adminId: string;
  action: string;
  targetId: string;
  details: string;
  timestamp: string;
}

// ─── Small reusable pieces ────────────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, sub, iconBg, iconColor, borderColor }: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  sub?: string;
  iconBg: string;
  iconColor: string;
  borderColor: string;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border bg-[#0d0b08] p-4 flex flex-col gap-2 ${borderColor}`}>
      <div className="flex items-center gap-2.5">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconBg}`}>
          <Icon className={`w-4.5 h-4.5 ${iconColor}`} style={{ width: 18, height: 18 }} />
        </div>
        <p className="text-white/45 text-xs font-semibold uppercase tracking-wider">{label}</p>
      </div>
      <p className="text-3xl font-black text-white tabular-nums leading-none pl-0.5">{value}</p>
      {sub && <p className="text-white/30 text-[11px] pl-0.5">{sub}</p>}
    </div>
  );
}

// Bar chart — each bar's height is proportional to its value.
function BarChart({ data, colorFrom = '#c9a96e', colorTo = '#e8c98a', maxBarWidth = 40 }: {
  data: { label: string; value: number }[];
  colorFrom?: string;
  colorTo?: string;
  maxBarWidth?: number;
}) {
  const max = Math.max(...data.map(d => d.value), 1);
  const hasData = data.some(d => d.value > 0);
  return (
    <div className="relative">
      {/* horizontal grid lines */}
      <div className="absolute inset-x-0 top-0 bottom-6 flex flex-col justify-between pointer-events-none">
        {[0,1,2,3].map(i => (
          <div key={i} className="w-full border-t border-white/[0.04]" />
        ))}
      </div>
      <div className="flex items-end gap-1 h-36 relative">
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-end justify-end gap-1.5 min-w-0 group" style={{ maxWidth: maxBarWidth }}>
            {d.value > 0 ? (
              <div
                className="w-full rounded-t-sm transition-all duration-700 ease-out cursor-default"
                style={{
                  height: `${Math.max(8, (d.value / max) * 100)}%`,
                  background: `linear-gradient(to bottom, ${colorFrom}ee, ${colorTo}88)`,
                  boxShadow: `0 -2px 10px ${colorFrom}50`,
                }}
                title={`${d.label}: ${d.value}`}
              />
            ) : (
              <div className="w-full" style={{ height: '8%' }} />
            )}
            <span className="text-[8px] text-white/20 truncate w-full text-center group-hover:text-white/45 transition-colors">{d.label}</span>
          </div>
        ))}
      </div>
      {!hasData && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-white/20 text-xs">No activity yet</p>
        </div>
      )}
    </div>
  );
}

// Role badge with colour per role
function RoleBadge({ role }: { role?: string }) {
  const map: Record<string, string> = {
    admin:   'bg-[rgba(201,169,110,0.12)] text-[#e8c98a]',
    trainer: 'bg-orange-500/20 text-orange-300',
    user:    'bg-blue-500/20   text-blue-300',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${map[role || 'user'] || map.user}`}>
      {role || 'user'}
    </span>
  );
}

// Confirm before doing a destructive action (delete/ban)
function useConfirm() {
  return (message: string) => window.confirm(message);
}

// ─── PostRow ─────────────────────────────────────────────────────────────────
interface PostRowProps {
  post: WorkoutPost;
  onDelete: () => void;
  onPin: () => void;
  onDeleteComment: (comment: import('../types').Comment) => void;
}
function PostRow({ post, onDelete, onPin, onDeleteComment }: PostRowProps) {
  const [expanded, setExpanded] = useState(false);
  const authorName   = post.user?.name || 'Unknown';
  const authorAvatar = post.user?.avatar || null;
  const ts = post.createdAt || post.timestamp || '';
  const timeAgo = (() => {
    const diff = Date.now() - new Date(ts).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return `${Math.floor(diff / 86400000)}d ago`;
  })();

  return (
    <div className="bg-[#080608] border border-[rgba(201,169,110,0.07)] rounded-xl overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        {authorAvatar
          ? <img src={authorAvatar} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
          : <div className="w-8 h-8 rounded-full bg-[rgba(201,169,110,0.12)] flex items-center justify-center text-[#c9a96e] text-xs font-bold shrink-0">
              {authorName[0]?.toUpperCase() || '?'}
            </div>
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white/80 text-sm font-medium">{authorName}</span>
            {post.workoutType && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.14)] text-[#c9a96e]">
                {post.workoutType}
              </span>
            )}
            {(post as any).pinned && (
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400">Pinned</span>
            )}
            <span className="text-white/25 text-[10px]">{timeAgo}</span>
          </div>
          {post.caption && <p className="text-white/40 text-xs mt-0.5 truncate">{post.caption}</p>}
          <div className="flex items-center gap-3 mt-1">
            <span className="text-white/25 text-[10px] flex items-center gap-1">
              <Heart className="w-3 h-3" />{post.likes ?? 0}
            </span>
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-white/25 text-[10px] flex items-center gap-1 hover:text-white/50 transition-colors"
            >
              <MessageSquare className="w-3 h-3" />{post.comments?.length ?? 0} comments
            </button>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onPin}
            className="p-1.5 rounded-lg text-white/25 hover:text-blue-400 hover:bg-blue-500/10 transition-all"
            title={(post as any).pinned ? 'Unpin' : 'Pin post'}>
            {(post as any).pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onDelete}
            className="p-1.5 rounded-lg text-white/25 hover:text-red-400 hover:bg-red-500/10 transition-all"
            title="Delete post">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {expanded && post.comments && post.comments.length > 0 && (
        <div className="border-t border-[rgba(201,169,110,0.06)] divide-y divide-[rgba(201,169,110,0.04)]">
          {post.comments.map((c, i) => (
            <div key={c.id ?? i} className="flex items-start gap-2 px-4 py-2 group">
              <div className="w-5 h-5 rounded-full bg-[rgba(201,169,110,0.08)] flex items-center justify-center text-[9px] text-[#c9a96e] shrink-0 mt-0.5">
                {c.user?.name?.[0]?.toUpperCase() || '?'}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-white/50 text-[11px] font-medium">{c.user?.name || 'User'}: </span>
                <span className="text-white/35 text-[11px]">{c.text}</span>
              </div>
              <button onClick={() => onDeleteComment(c)}
                className="opacity-0 group-hover:opacity-100 p-1 rounded text-white/20 hover:text-red-400 transition-all shrink-0">
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      {expanded && (!post.comments || post.comments.length === 0) && (
        <div className="px-4 py-2 border-t border-[rgba(201,169,110,0.06)]">
          <p className="text-white/20 text-xs italic">No comments</p>
        </div>
      )}
    </div>
  );
}

// ─── MAIN COMPONENT ───────────────────────────────────────────────────────────
export function AdminPage({ currentUser }: { currentUser: User | null }) {
  const confirm = useConfirm();

  // ── State ──────────────────────────────────────────────────────────────────
  const [posts,         setPosts]         = useState<WorkoutPost[]>([]);
  const [users,         setUsers]         = useState<FirestoreUser[]>([]);
  const [challenges,    setChallenges]    = useState<Challenge[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [logs,          setLogs]          = useState<LogEntry[]>([]);
  const [reportedPosts, setReportedPosts] = useState<ReportedPost[]>([]);
  const [health,        setHealth]        = useState<{ newToday: number; activeRecently: number } | null>(null);
  const [apiStatus,     setApiStatus]     = useState<'checking' | 'ok' | 'slow' | 'down'>('checking');
  const [apiLatency,    setApiLatency]    = useState(0);
  const [loading,       setLoading]       = useState(true);
  const [activeTab,     setActiveTab]     = useState<'overview'|'users'|'content'|'challenges'|'tools'>('overview');
  const [search,        setSearch]        = useState('');
  const [roleFilter,    setRoleFilter]    = useState<'all'|'user'|'trainer'|'admin'>('all');
  const [hashReveal,    setHashReveal]    = useState<Record<string, string | null>>({});
  const [hashLoading,   setHashLoading]   = useState<Record<string, boolean>>({});

  // Challenge form state
  const [cTitle,       setCTitle]       = useState('');
  const [cDesc,        setCDesc]        = useState('');
  const [cType,        setCType]        = useState('posts');
  const [cTarget,      setCTarget]      = useState(10);
  const [cDays,        setCDays]        = useState(30);

  // Announcement form state
  const [aTitle,       setATitle]       = useState('');
  const [aMessage,     setAMessage]     = useState('');
  const [aType,        setAType]        = useState('info');

  // ── Load all data ──────────────────────────────────────────────────────────
  const loadAll = useCallback(async () => {
    setLoading(true);

    // Ping API for latency / status
    const pingStart = Date.now();
    setApiStatus('checking');
    try {
      await fetch(`${API_HOST}/api/admin/health`, { method: 'HEAD' }).catch(() => {});
    } catch {}
    const lat = Date.now() - pingStart;
    setApiLatency(lat);
    setApiStatus(lat < 400 ? 'ok' : lat < 1200 ? 'slow' : 'down');

    const [postsResult, usersResult, challengesResult, announcementsResult, logsResult, healthResult, reportsResult] =
      await Promise.allSettled([
        fetchPosts(),
        getAllUsers(),
        getChallenges(),
        getAnnouncements(),
        getActivityLog(),
        getAdminHealth(),
        getReportedPosts(),
      ]);

    if (postsResult.status === 'fulfilled') {
      const v = postsResult.value as any;
      setPosts((v.posts ?? v) as WorkoutPost[]);
    }
    if (usersResult.status === 'fulfilled') {
      setUsers(usersResult.value as FirestoreUser[]);
    } else {
      toast.error('Could not load users — session may have expired. Please sign in again.');
    }
    if (challengesResult.status    === 'fulfilled') setChallenges(challengesResult.value as Challenge[]);
    if (announcementsResult.status === 'fulfilled') setAnnouncements(announcementsResult.value as Announcement[]);
    if (logsResult.status          === 'fulfilled') setLogs(logsResult.value as LogEntry[]);
    if (healthResult.status        === 'fulfilled') setHealth(healthResult.value as any);
    if (reportsResult.status       === 'fulfilled') setReportedPosts(reportsResult.value as ReportedPost[]);

    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // ── Guard: non-admins see an error ────────────────────────────────────────
  if (currentUser?.accountType !== 'admin') {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center px-6">
        <ShieldCheck className="w-12 h-12 text-red-400 mb-4" />
        <h2 className="text-white font-semibold text-lg mb-2">Access Denied</h2>
        <p className="text-white/40 text-sm">You need an admin account to view this page.</p>
      </div>
    );
  }

  // ── Computed stats from real Firestore data ────────────────────────────────
  const uniqueUserMap = new Map<string, User>();
  posts.forEach(p => { if (p.user?.id) uniqueUserMap.set(p.user.id, p.user); });

  const totalLikes    = posts.reduce((s, p) => s + (p.likes || 0), 0);
  const totalComments = posts.reduce((s, p) => s + (p.comments?.length || 0), 0);
  const bannedCount   = users.filter(u => u.banned).length;

  // Posts per day — last 14 days
  const postsPerDay = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (13 - i));
    const label = d.toLocaleDateString('en', { weekday: 'short' }).slice(0, 2);
    const value = posts.filter(p => new Date(p.createdAt || p.timestamp || '').toDateString() === d.toDateString()).length;
    return { label, value };
  });

  // Workout type breakdown
  const typeMap = new Map<string, number>();
  posts.forEach(p => { if (p.workoutType) typeMap.set(p.workoutType, (typeMap.get(p.workoutType) || 0) + 1); });
  const workoutTypes = [...typeMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  // Top posters
  const posterMap = new Map<string, { user: User; count: number; likes: number }>();
  posts.forEach(p => {
    if (!p.user?.id) return;
    const e = posterMap.get(p.user.id);
    if (e) { e.count++; e.likes += p.likes || 0; }
    else posterMap.set(p.user.id, { user: p.user, count: 1, likes: p.likes || 0 });
  });
  const topPosters = [...posterMap.values()].sort((a, b) => b.count - a.count);

  // Filtered lists
  const filteredUsers = users.filter(u => {
    const matchSearch = !search || [u.displayName, u.email, u.username].some(s => s?.toLowerCase().includes(search.toLowerCase()));
    const matchRole = roleFilter === 'all' || (u.accountType || 'user') === roleFilter;
    return matchSearch && matchRole;
  });
  const groupedUsers = {
    admin:   filteredUsers.filter(u => u.accountType === 'admin'),
    trainer: filteredUsers.filter(u => u.accountType === 'trainer'),
    user:    filteredUsers.filter(u => !u.accountType || u.accountType === 'user'),
  };
  const filteredPosts = posts.filter(p =>
    !search || [p.user?.name, p.workoutType, p.caption].some(s => s?.toLowerCase().includes(search.toLowerCase()))
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleVerify = async (u: FirestoreUser) => {
    const action = u.verified ? 'unverify' : 'verify';
    if (!confirm(`${action === 'verify' ? 'Grant' : 'Revoke'} verified badge for ${u.displayName}?`)) return;
    try {
      const res = await authFetch(`http://192.168.1.102:5000/api/admin/users/${u.uid}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({ verified: !u.verified, adminId: currentUser?.id }),
      });
      if (!res.ok) throw new Error();
      setUsers(prev => prev.map(x => x.uid === u.uid ? { ...x, verified: !u.verified } : x));
      toast.success(action === 'verify' ? 'Badge granted ✓' : 'Badge revoked');
    } catch { toast.error('Action failed'); }
  };

  const handleBan = async (u: FirestoreUser) => {
    const action = u.banned ? 'unban' : 'ban';
    if (!confirm(`Are you sure you want to ${action} ${u.displayName}?`)) return;
    const reason = u.banned ? '' : (window.prompt('Reason for ban (optional):') || '');
    try {
      await banUser(u.uid, !u.banned, reason, currentUser.id);
      toast.success(`${u.displayName} has been ${action}ned`);
      loadAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleRoleChange = async (u: FirestoreUser, newRole: string) => {
    if (!confirm(`Change ${u.displayName}'s role to "${newRole}"?`)) return;
    try {
      await changeUserRole(u.uid, newRole, currentUser.id);
      toast.success(`Role updated to ${newRole}`);
      loadAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteUser = async (u: FirestoreUser) => {
    if (!confirm(`PERMANENTLY delete ${u.displayName}? This cannot be undone.`)) return;
    try {
      await deleteUser(u.uid, currentUser.id);
      toast.success(`${u.displayName} deleted`);
      loadAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleResetPassword = async (u: FirestoreUser) => {
    if (!confirm(`Send password reset email to ${u.email}?`)) return;
    try {
      await resetUserPassword(u.uid, currentUser.id);
      toast.success(`Reset email sent to ${u.email}`);
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSetPassword = async (u: FirestoreUser) => {
    const pw = window.prompt(`Set a new password for ${u.displayName || u.email}:\n(min 6 characters)`);
    if (!pw) return;
    if (pw.length < 6) return toast.error('Password must be at least 6 characters');
    try {
      await setUserPassword(u.uid, pw);
      toast.success(`Password updated for ${u.displayName || u.email}. They can now log in with: ${pw}`);
    } catch (e: any) { toast.error(e.message); }
  };


  const handleShowHash = async (u: FirestoreUser) => {
    if (hashReveal[u.uid] !== undefined) {
      setHashReveal(h => { const n = { ...h }; delete n[u.uid]; return n; });
      return;
    }
    setHashLoading(l => ({ ...l, [u.uid]: true }));
    try {
      const res = await authFetch(`${API}/admin/users/${u.uid}/password-hash`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setHashReveal(h => ({ ...h, [u.uid]: `API error ${res.status}: ${(data as any).error || 'Unknown'}` }));
        return;
      }
      const val = (data as any).hash ?? (data as any).message ?? 'No hash stored';
      setHashReveal(h => ({ ...h, [u.uid]: val }));
    } catch (e: any) {
      setHashReveal(h => ({ ...h, [u.uid]: `Network error: ${e?.message || e}` }));
    } finally {
      setHashLoading(l => ({ ...l, [u.uid]: false }));
    }
  };

  const handleDismissReport = async (reportId: string) => {
    try {
      await dismissReport(reportId);
      setReportedPosts(prev => prev.filter(r => r.id !== reportId));
      toast.success('Report dismissed');
    } catch { toast.error('Could not dismiss report'); }
  };

  const handleDeleteReportedPost = async (report: ReportedPost) => {
    if (!confirm(`Delete the reported post by ${report.postData?.user?.name || 'unknown'}? This cannot be undone.`)) return;
    try {
      await deleteReportedPost(report.id);
      setReportedPosts(prev => prev.filter(r => r.id !== report.id));
      setPosts(prev => prev.filter(p => p.id !== report.postId));
      toast.success('Post deleted and report resolved');
    } catch { toast.error('Could not delete post'); }
  };

  const handleDeletePost = async (post: WorkoutPost) => {
    if (!confirm(`Delete this post by ${post.user?.name}?`)) return;
    try {
      await deletePost(post.id, currentUser.id);
      toast.success('Post deleted');
      loadAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const handlePinPost = async (post: WorkoutPost) => {
    try {
      await pinPost(post.id, !(post as any).pinned, currentUser.id);
      toast.success((post as any).pinned ? 'Post unpinned' : 'Post pinned to top of feed');
      loadAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleCreateChallenge = async () => {
    if (!cTitle.trim() || !cDesc.trim()) { toast.error('Title and description are required'); return; }
    try {
      await createChallenge({ title: cTitle, description: cDesc, type: cType, targetValue: cTarget, durationDays: cDays, adminId: currentUser.id });
      toast.success('Challenge created!');
      setCTitle(''); setCDesc('');
      loadAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteChallenge = async (id: string, title: string) => {
    if (!confirm(`Delete challenge "${title}"?`)) return;
    try {
      await deleteChallenge(id, currentUser.id);
      toast.success('Challenge deleted');
      loadAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSendAnnouncement = async () => {
    if (!aTitle.trim() || !aMessage.trim()) { toast.error('Title and message are required'); return; }
    try {
      await sendAnnouncement({ title: aTitle, message: aMessage, type: aType, adminId: currentUser.id });
      toast.success('Announcement sent to all users!');
      setATitle(''); setAMessage('');
      loadAll();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!confirm('Delete this announcement?')) return;
    try {
      await deleteAnnouncement(id);
      toast.success('Announcement removed');
      loadAll();
    } catch (e: any) { toast.error(e.message); }
  };

  // ── Tabs config ───────────────────────────────────────────────────────────
  const TABS = [
    { id: 'overview',   label: 'Overview',    icon: BarChart2 },
    { id: 'users',      label: 'Users',       icon: Users },
    { id: 'content',    label: 'Content',     icon: FileText },
    { id: 'challenges', label: 'Challenges',  icon: Trophy },
    { id: 'tools',      label: 'Tools',       icon: Wrench },
  ] as const;

  // ── Shared input style ─────────────────────────────────────────────────────
  const inputCls = 'w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[#c9a96e]/50 transition-colors';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="px-6 py-6 max-w-5xl w-full">

      {/* Page header */}
      <div className="relative overflow-hidden rounded-2xl border border-[#c9a96e]/20 bg-gradient-to-r from-[#0d0b08] via-[#080608] to-[#0d0b08] p-5 mb-6">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(124,58,237,0.15),_transparent_60%)]" />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[rgba(201,169,110,0.12)] border border-[#c9a96e]/30 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6 text-[#c9a96e]" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Admin Panel</h1>
              <p className="text-white/40 text-xs mt-0.5">
                Signed in as <span className="text-[#e8c98a] font-medium">{currentUser.name}</span>
              </p>
            </div>
          </div>
          <button
            onClick={loadAll}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white/60 hover:text-white hover:bg-[rgba(201,169,110,0.06)] text-xs font-medium transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 overflow-x-auto pb-0.5">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => { setActiveTab(id); setSearch(''); }}
            className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-xs font-semibold whitespace-nowrap transition-all border ${
              activeTab === id
                ? 'bg-[#c9a96e]/25 text-[#e8c98a] border-[#c9a96e]/40 shadow-lg shadow-[rgba(201,169,110,0.15)]'
                : 'text-white/40 border-[rgba(201,169,110,0.08)] bg-[rgba(201,169,110,0.03)] hover:text-white/70 hover:bg-[rgba(201,169,110,0.05)]'
            }`}
          >
            <Icon className={`w-3.5 h-3.5 ${activeTab === id ? 'text-[#e8c98a]' : ''}`} />
            {label}
          </button>
        ))}
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          TAB 1 — OVERVIEW
          What it does: Shows the health of the whole platform at a glance.
          Every number is calculated from real Firestore data — no hardcoding.
          The charts update automatically as users post.
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">

          {/* ── Platform Health Strip ── */}
          <div className="rounded-2xl border border-[rgba(201,169,110,0.12)] bg-[#0d0b08] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-[rgba(201,169,110,0.07)]">
              <p className="text-white/50 text-[10px] uppercase tracking-widest font-semibold">Platform Health</p>
              <div className="flex items-center gap-1.5">
                <span style={{
                  display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                  background: apiStatus === 'ok' ? '#22c55e' : apiStatus === 'slow' ? '#f97316' : apiStatus === 'down' ? '#ef4444' : '#c9a96e',
                  boxShadow: apiStatus === 'ok' ? '0 0 6px #22c55e' : apiStatus === 'slow' ? '0 0 6px #f97316' : apiStatus === 'down' ? '0 0 6px #ef4444' : '0 0 6px #c9a96e',
                }} />
                <span className="text-[10px] font-medium" style={{
                  color: apiStatus === 'ok' ? '#22c55e' : apiStatus === 'slow' ? '#f97316' : apiStatus === 'down' ? '#ef4444' : '#c9a96e',
                }}>
                  {apiStatus === 'checking' ? 'Checking…' : apiStatus === 'ok' ? `API OK · ${apiLatency}ms` : apiStatus === 'slow' ? `Slow · ${apiLatency}ms` : 'API Down'}
                </span>
              </div>
            </div>

            {/* 3-column metric strip */}
            <div className="grid grid-cols-3 divide-x divide-[rgba(201,169,110,0.06)]">
              {/* Online / active recently */}
              <div className="px-5 py-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1">
                  <span style={{ display:'inline-block', width:7, height:7, borderRadius:'50%', background:'#22c55e', boxShadow:'0 0 8px #22c55e', animation:'pulse 2s infinite' }} />
                  <p className="text-white/35 text-[10px] uppercase tracking-widest font-medium">Active Today</p>
                </div>
                <p className="text-3xl font-black text-white tabular-nums leading-none">
                  {health?.activeRecently ?? '—'}
                </p>
                <p className="text-white/25 text-[10px]">users active in last 24h</p>
              </div>

              {/* New signups today */}
              <div className="px-5 py-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1">
                  <UserCheck className="w-3 h-3 text-[#c9a96e]" />
                  <p className="text-white/35 text-[10px] uppercase tracking-widest font-medium">New Today</p>
                </div>
                <p className="text-3xl font-black text-white tabular-nums leading-none">
                  {health?.newToday ?? users.filter(u => u.createdAt && new Date(u.createdAt).toDateString() === new Date().toDateString()).length}
                </p>
                <p className="text-white/25 text-[10px]">new signups today</p>
              </div>

              {/* Moderation queue count */}
              <div className="px-5 py-4 flex flex-col gap-1">
                <div className="flex items-center gap-2 mb-1">
                  <AlertTriangle className={`w-3 h-3 ${reportedPosts.length > 0 ? 'text-orange-400' : 'text-white/25'}`} />
                  <p className="text-white/35 text-[10px] uppercase tracking-widest font-medium">Reports</p>
                </div>
                <p className={`text-3xl font-black tabular-nums leading-none ${reportedPosts.length > 0 ? 'text-orange-400' : 'text-white'}`}>
                  {reportedPosts.length}
                </p>
                <p className="text-white/25 text-[10px]">pending review</p>
              </div>
            </div>
          </div>

          {/* ── Moderation Queue ── */}
          <div className="rounded-2xl border overflow-hidden"
            style={{ borderColor: reportedPosts.length > 0 ? 'rgba(249,115,22,0.2)' : 'rgba(201,169,110,0.08)', background: '#0d0b08' }}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,169,110,0.07)]">
              <div className="flex items-center gap-2">
                <AlertTriangle className={`w-4 h-4 ${reportedPosts.length > 0 ? 'text-orange-400' : 'text-white/25'}`} />
                <p className="text-white/50 text-[10px] uppercase tracking-widest font-semibold">Moderation Queue</p>
                {reportedPosts.length > 0 && (
                  <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/30">
                    {reportedPosts.length} pending
                  </span>
                )}
              </div>
              {reportedPosts.length > 0 && (
                <p className="text-white/20 text-[10px]">Review each report and approve or remove the content</p>
              )}
            </div>

            {reportedPosts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <CheckCircle className="w-8 h-8 text-green-500/40" />
                <p className="text-white/25 text-sm font-medium">All clear — no reported posts</p>
                <p className="text-white/15 text-xs">Reports from users will appear here for review</p>
              </div>
            ) : (
              <div className="divide-y divide-[rgba(201,169,110,0.05)]">
                {reportedPosts.map(report => {
                  const pd = report.postData || {};
                  const authorName = pd.user?.name || pd.authorName || 'Unknown user';
                  const authorAvatar = pd.user?.avatar || pd.avatar || null;
                  const caption = pd.caption || pd.text || '';
                  const workoutType = pd.workoutType || pd.type || '';
                  const reportedAt = new Date(report.createdAt);
                  const timeAgo = (() => {
                    const diff = Date.now() - reportedAt.getTime();
                    if (diff < 60000) return 'just now';
                    if (diff < 3600000) return `${Math.floor(diff/60000)}m ago`;
                    if (diff < 86400000) return `${Math.floor(diff/3600000)}h ago`;
                    return `${Math.floor(diff/86400000)}d ago`;
                  })();

                  return (
                    <div key={report.id} className="px-5 py-4 flex items-start gap-4 hover:bg-white/[0.015] transition-colors group">
                      {/* Author avatar */}
                      <div className="shrink-0 mt-0.5">
                        {authorAvatar
                          ? <img src={authorAvatar} alt="" className="w-9 h-9 rounded-full object-cover border border-orange-500/30" />
                          : <div className="w-9 h-9 rounded-full bg-orange-500/15 border border-orange-500/25 flex items-center justify-center text-orange-400 text-xs font-bold">
                              {authorName[0]?.toUpperCase() || '?'}
                            </div>
                        }
                      </div>

                      {/* Post info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-white/80 text-sm font-medium">{authorName}</span>
                          {workoutType && (
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-[rgba(201,169,110,0.08)] border border-[rgba(201,169,110,0.14)] text-[#c9a96e]">
                              {workoutType}
                            </span>
                          )}
                          <span className="text-white/20 text-[10px]">{timeAgo}</span>
                        </div>

                        {caption && (
                          <p className="text-white/45 text-xs leading-relaxed mb-2 line-clamp-2">{caption}</p>
                        )}

                        {/* Report reason */}
                        <div className="flex items-start gap-1.5 bg-orange-500/6 border border-orange-500/15 rounded-lg px-3 py-2">
                          <AlertTriangle className="w-3 h-3 text-orange-400/70 shrink-0 mt-0.5" />
                          <p className="text-orange-300/70 text-[11px] leading-relaxed">
                            <span className="font-semibold text-orange-400/80">Reason: </span>
                            {report.reason}
                          </p>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          onClick={() => handleDismissReport(report.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                          style={{ background: 'rgba(34,197,94,0.06)', borderColor: 'rgba(34,197,94,0.2)', color: '#22c55e' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.12)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.06)')}
                        >
                          <CheckCircle className="w-3 h-3" />
                          Dismiss
                        </button>
                        <button
                          onClick={() => handleDeleteReportedPost(report)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                          style={{ background: 'rgba(239,68,68,0.06)', borderColor: 'rgba(239,68,68,0.2)', color: '#ef4444' }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.06)')}
                        >
                          <Trash2 className="w-3 h-3" />
                          Delete Post
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 4 top-level stat cards — single row */}
          <div className="grid grid-cols-4 gap-3">
            <StatCard icon={Users}    label="Users"        value={users.length}  sub={`${users.filter(u=>u.accountType==='trainer').length} trainers`}  iconBg="bg-blue-500/15"   iconColor="text-blue-400"   borderColor="border-blue-500/20" />
            <StatCard icon={FileText} label="Posts"        value={posts.length}  sub="published content"   iconBg="bg-[#c9a96e]/15" iconColor="text-[#c9a96e]" borderColor="border-[rgba(201,169,110,0.18)]" />
            <StatCard icon={Heart}    label="Total Likes"  value={totalLikes}    sub="across all posts"    iconBg="bg-pink-500/15"   iconColor="text-pink-400"   borderColor="border-[rgba(201,169,110,0.15)]" />
            <StatCard icon={Ban}      label="Banned"       value={bannedCount}   sub="suspended accounts"  iconBg="bg-orange-500/15" iconColor="text-orange-400" borderColor="border-orange-500/20" />
          </div>

          {/* Engagement summary */}
          <div className="bg-[#0d0b08] rounded-2xl border border-[rgba(201,169,110,0.08)] p-5">
            <p className="text-white/50 text-[10px] uppercase tracking-widest font-semibold mb-4">Engagement</p>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="flex flex-col gap-1">
                <p className="text-3xl font-black text-white tabular-nums">{totalComments}</p>
                <p className="text-white/30 text-xs">total comments</p>
              </div>
              <div className="flex flex-col gap-1 border-x border-[rgba(201,169,110,0.06)]">
                <p className="text-3xl font-black text-white tabular-nums">
                  {posts.length > 0 ? (totalLikes / posts.length).toFixed(1) : '0'}
                </p>
                <p className="text-white/30 text-xs">avg likes / post</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-3xl font-black text-white tabular-nums">
                  {posts.length > 0 ? (totalComments / posts.length).toFixed(1) : '0'}
                </p>
                <p className="text-white/30 text-xs">avg comments / post</p>
              </div>
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-2 gap-3">
            {/* Posts per day chart */}
            <div className="bg-[#0d0b08] rounded-2xl border border-[rgba(201,169,110,0.08)] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">Posts / day</p>
                  <p className="text-white/25 text-[10px] mt-0.5">last 14 days</p>
                </div>
                <Activity className="w-4 h-4 text-[#c9a96e]/60" />
              </div>
              <BarChart data={postsPerDay} colorFrom="#c9a96e" colorTo="#c9a96e" />
            </div>

            {/* Workout types chart */}
            <div className="bg-[#0d0b08] rounded-2xl border border-[rgba(201,169,110,0.08)] p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-widest">Workout types</p>
                  <p className="text-white/25 text-[10px] mt-0.5">top categories</p>
                </div>
                <TrendingUp className="w-4 h-4 text-orange-400/60" />
              </div>
              {workoutTypes.length > 0
                ? <BarChart data={workoutTypes} colorFrom="#f97316" colorTo="#fb923c" maxBarWidth={64} />
                : <div className="h-40 flex items-center justify-center text-white/20 text-xs">No workout data yet</div>
              }
            </div>
          </div>

          {/* Top posters */}
          <div className="bg-[#0d0b08] rounded-2xl border border-[rgba(201,169,110,0.08)] p-5">
            <p className="text-white/50 text-[10px] uppercase tracking-widest font-semibold mb-4">Most Active Users</p>
            <div className="space-y-1">
              {topPosters.slice(0, 5).map((e, i) => (
                <div key={e.user.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-white/4 transition-colors group">
                  <span className={`text-sm w-5 font-black tabular-nums ${i === 0 ? 'text-yellow-400' : i === 1 ? 'text-white/40' : i === 2 ? 'text-orange-700' : 'text-white/20'}`}>{i + 1}</span>
                  {e.user.avatar
                    ? <img src={e.user.avatar} className="w-8 h-8 rounded-full object-cover ring-1 ring-white/10" alt="" />
                    : <div className="w-8 h-8 rounded-full bg-[#c9a96e] flex items-center justify-center text-white text-xs font-semibold">{e.user.name?.[0]}</div>
                  }
                  <span className="flex-1 text-sm text-white/80 font-medium truncate">{e.user.name}</span>
                  <span className="text-xs text-white/30 group-hover:text-white/50 transition-colors">{e.count} posts</span>
                  <span className="text-xs text-pink-400/60">{e.likes} ♥</span>
                  <RoleBadge role={e.user.accountType} />
                </div>
              ))}
              {topPosters.length === 0 && <p className="text-white/20 text-xs text-center py-6">No posts yet</p>}
            </div>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 2 — USERS
          What it does: Lists every user with a Firestore profile.
          Actions per user:
            Ban     → disables their Firebase Auth login + marks them in Firestore
            Role    → dropdown to change between user / trainer / admin
            Reset   → sends a Firebase password-reset email to their inbox
            Delete  → permanently removes from Firebase Auth AND Firestore
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'users' && (
        <div>
          {/* Search + count */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input type="text" placeholder="Search users..." value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} pl-9`} />
            </div>
            <span className="text-white/30 text-xs shrink-0">{filteredUsers.length} users</span>
          </div>

          {/* Role filter pills */}
          <div className="flex gap-1.5 mb-5 flex-wrap">
            {(['all','admin','trainer','user'] as const).map(r => (
              <button key={r} onClick={() => setRoleFilter(r)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all border ${
                  roleFilter === r
                    ? r === 'admin'   ? 'bg-[rgba(201,169,110,0.12)] text-[#e8c98a] border-[#c9a96e]/40'
                    : r === 'trainer' ? 'bg-orange-500/20 text-orange-300 border-orange-500/40'
                    : r === 'user'    ? 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                    : 'bg-white/10 text-white border-[rgba(201,169,110,0.18)]'
                    : 'bg-[rgba(201,169,110,0.03)] text-white/40 border-[rgba(201,169,110,0.07)] hover:text-white/70'
                }`}
              >
                {r === 'all'
                  ? `All (${users.length})`
                  : `${r.charAt(0).toUpperCase()+r.slice(1)}s (${users.filter(u=>(u.accountType||'user')===r).length})`}
              </button>
            ))}
          </div>

          {filteredUsers.length === 0 ? (
            <p className="text-white/25 text-sm text-center py-8">No users found.</p>
          ) : roleFilter !== 'all' ? (
            /* Single-role flat list */
            <div className="space-y-2">
              {filteredUsers.map(u => (
              <div key={u.uid} className={`bg-[#0d0b08] rounded-2xl border px-4 py-4 ${u.banned ? 'border-red-500/30 bg-red-500/5' : 'border-[rgba(201,169,110,0.08)]'}`}>
                <div className="flex items-center gap-3">
                  {u.avatar
                    ? <img src={u.avatar} className="w-9 h-9 rounded-full object-cover shrink-0" alt="" />
                    : <div className="w-9 h-9 rounded-full bg-[#c9a96e] flex items-center justify-center text-white text-sm shrink-0">{u.displayName?.[0] || '?'}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium truncate">{u.displayName || 'Unnamed'}</p>
                      {u.verified && <BadgeCheck className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                      {u.banned && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">banned</span>}
                    </div>
                    <p className="text-white/35 text-xs truncate">{u.email} · @{u.username || '—'}</p>
                  </div>
                  <RoleBadge role={u.accountType} />
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[rgba(201,169,110,0.08)] flex-wrap">
                  <button onClick={() => handleBan(u)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${u.banned ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}>
                    {u.banned ? <><CheckCircle className="w-3 h-3" /> Unban</> : <><Ban className="w-3 h-3" /> Ban</>}
                  </button>
                  <button onClick={() => handleVerify(u)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${u.verified ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20' : 'bg-[rgba(201,169,110,0.04)] text-white/40 hover:bg-[rgba(201,169,110,0.08)]'}`}>
                    <BadgeCheck className="w-3 h-3" /> {u.verified ? 'Unverify' : 'Verify'}
                  </button>
                  <div className="relative">
                    <select value={u.accountType || 'user'} onChange={e => handleRoleChange(u, e.target.value)} className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none cursor-pointer appearance-none pr-6">
                      <option value="user">user</option>
                      <option value="trainer">trainer</option>
                      <option value="admin">admin</option>
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                  </div>
                  <button onClick={() => handleSetPassword(u)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-all">
                    <Shield className="w-3 h-3" /> Set PW
                  </button>
                  <button onClick={() => handleResetPassword(u)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all">
                    <Send className="w-3 h-3" /> Reset PW
                  </button>
                  <button onClick={() => handleDeleteUser(u)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all ml-auto">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <button onClick={() => handleShowHash(u)} disabled={hashLoading[u.uid]} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50">
                    {hashReveal[u.uid] !== undefined ? <><EyeOff className="w-3 h-3" /> Hide</> : <><Eye className="w-3 h-3" /> PW Hash</>}
                  </button>
                </div>
                {u.bannedReason && <p className="text-red-400/60 text-xs mt-2 italic">Reason: {u.bannedReason}</p>}
                {hashReveal[u.uid] !== undefined && (
                  <div className="mt-2 p-2 bg-black/40 border border-emerald-500/20 rounded-lg">
                    <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider mb-1">Stored bcrypt hash</p>
                    <p className="text-emerald-300/80 text-[10px] font-mono break-all leading-relaxed">{hashReveal[u.uid]}</p>
                  </div>
                )}
              </div>
              ))}
            </div>
          ) : (
            /* All — grouped by role */
            <div className="space-y-6">
              {(['admin','trainer','user'] as const).filter(g => groupedUsers[g].length > 0).map(group => (
                <div key={group}>
                  <div className={`flex items-center gap-2 mb-2 pb-1.5 border-b ${
                    group === 'admin' ? 'border-[#c9a96e]/20' : group === 'trainer' ? 'border-orange-500/20' : 'border-blue-500/20'
                  }`}>
                    <span className={`text-xs font-semibold uppercase tracking-widest ${
                      group === 'admin' ? 'text-[#c9a96e]' : group === 'trainer' ? 'text-orange-400' : 'text-blue-400'
                    }`}>{group}s</span>
                    <span className="text-white/20 text-xs">({groupedUsers[group].length})</span>
                  </div>
                  <div className="space-y-2">
                    {groupedUsers[group].map(u => (
              <div key={u.uid} className={`bg-[#0d0b08] rounded-2xl border px-4 py-4 ${u.banned ? 'border-red-500/30 bg-red-500/5' : 'border-[rgba(201,169,110,0.08)]'}`}>
                <div className="flex items-center gap-3">
                  {u.avatar
                    ? <img src={u.avatar} className="w-9 h-9 rounded-full object-cover shrink-0" alt="" />
                    : <div className="w-9 h-9 rounded-full bg-[#c9a96e] flex items-center justify-center text-white text-sm shrink-0">{u.displayName?.[0] || '?'}</div>
                  }
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-white text-sm font-medium truncate">{u.displayName || 'Unnamed'}</p>
                      {u.banned && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded-full">banned</span>}
                    </div>
                    <p className="text-white/35 text-xs truncate">{u.email} · @{u.username || '—'}</p>
                  </div>
                  <RoleBadge role={u.accountType} />
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[rgba(201,169,110,0.08)] flex-wrap">
                  <button onClick={() => handleBan(u)} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all ${u.banned ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20' : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'}`}>
                    {u.banned ? <><CheckCircle className="w-3 h-3" /> Unban</> : <><Ban className="w-3 h-3" /> Ban</>}
                  </button>
                  <div className="relative">
                    <select value={u.accountType || 'user'} onChange={e => handleRoleChange(u, e.target.value)} className="bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-lg px-2 py-1.5 text-xs text-white/70 focus:outline-none cursor-pointer appearance-none pr-6">
                      <option value="user">user</option>
                      <option value="trainer">trainer</option>
                      <option value="admin">admin</option>
                    </select>
                    <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/30 pointer-events-none" />
                  </div>
                  <button onClick={() => handleSetPassword(u)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-yellow-500/10 text-yellow-400 hover:bg-yellow-500/20 transition-all">
                    <Shield className="w-3 h-3" /> Set PW
                  </button>
                  <button onClick={() => handleResetPassword(u)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-all">
                    <Send className="w-3 h-3" /> Reset PW
                  </button>
                  <button onClick={() => handleDeleteUser(u)} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all ml-auto">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <button onClick={() => handleShowHash(u)} disabled={hashLoading[u.uid]} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-all disabled:opacity-50">
                    {hashReveal[u.uid] !== undefined ? <><EyeOff className="w-3 h-3" /> Hide</> : <><Eye className="w-3 h-3" /> PW Hash</>}
                  </button>
                </div>
                {u.bannedReason && <p className="text-red-400/60 text-xs mt-2 italic">Reason: {u.bannedReason}</p>}
                {hashReveal[u.uid] !== undefined && (
                  <div className="mt-2 p-2 bg-black/40 border border-emerald-500/20 rounded-lg">
                    <p className="text-[10px] text-emerald-400/60 uppercase tracking-wider mb-1">Stored bcrypt hash</p>
                    <p className="text-emerald-300/80 text-[10px] font-mono break-all leading-relaxed">{hashReveal[u.uid]}</p>
                  </div>
                )}
              </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'content' && (
        <div>
          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
              <input type="text" placeholder="Search posts..." value={search} onChange={e => setSearch(e.target.value)} className={`${inputCls} pl-9`} />
            </div>
            <span className="text-white/30 text-xs shrink-0">{filteredPosts.length} posts</span>
          </div>

          <div className="space-y-2">
            {filteredPosts.map(post => (
              <PostRow
                key={post.id}
                post={post}
                onDelete={() => handleDeletePost(post)}
                onPin={() => handlePinPost(post)}
                onDeleteComment={(comment) => deleteComment(post.id, comment, currentUser.id).then(loadAll).catch(e => toast.error(e.message))}
              />
            ))}
            {filteredPosts.length === 0 && (
              <p className="text-white/25 text-sm text-center py-8">No posts found.</p>
            )}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 4 — CHALLENGES
          What it does: Admins create community-wide challenges.
          Examples: "Post 10 workouts this month", "30-day streak".
          Challenges are saved to Firestore and can be shown to all users.
          Users' progress is calculated from their real post history.
      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'challenges' && (
        <div className="space-y-6">

          {/* Create form */}
          <div className="bg-[#0d0b08] rounded-2xl border border-[rgba(201,169,110,0.08)] p-5">
            <p className="text-white/60 text-sm font-medium mb-4 flex items-center gap-2">
              <Plus className="w-4 h-4 text-[#c9a96e]" /> Create new challenge
            </p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="col-span-2">
                <label className="text-white/40 text-xs mb-1 block">Title</label>
                <input type="text" placeholder="e.g. 30-Day Consistency Challenge" value={cTitle} onChange={e => setCTitle(e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="text-white/40 text-xs mb-1 block">Description</label>
                <textarea placeholder="What do users need to do?" value={cDesc} onChange={e => setCDesc(e.target.value)} rows={2} className={`${inputCls} resize-none`} />
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">Type</label>
                <select value={cType} onChange={e => setCType(e.target.value)} className={inputCls}>
                  <option value="posts">Posts (log X workouts)</option>
                  <option value="streak">Streak (X consecutive days)</option>
                  <option value="calories">Calories (burn X total)</option>
                </select>
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">Target value</label>
                <input type="number" value={cTarget} onChange={e => setCTarget(Number(e.target.value))} className={inputCls} min={1} />
              </div>
              <div>
                <label className="text-white/40 text-xs mb-1 block">Duration (days)</label>
                <input type="number" value={cDays} onChange={e => setCDays(Number(e.target.value))} className={inputCls} min={1} max={365} />
              </div>
            </div>
            <button
              onClick={handleCreateChallenge}
              className="w-full py-2.5 rounded-lg bg-[#c9a96e] text-white text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Create Challenge
            </button>
          </div>

          {/* Existing challenges list */}
          <div className="space-y-2">
            {challenges.length === 0 && (
              <p className="text-white/25 text-sm text-center py-8">No challenges yet. Create the first one above!</p>
            )}
            {challenges.map(c => (
              <div key={c.id} className="bg-[#0d0b08] rounded-2xl border border-[rgba(201,169,110,0.08)] px-4 py-4 flex items-start gap-3">
                <div className="w-9 h-9 rounded-xl bg-[#c9a96e]/15 flex items-center justify-center text-sm shrink-0">
                  {c.type === 'streak' ? '🔥' : c.type === 'calories' ? '⚡' : '💪'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-sm font-medium">{c.title}</p>
                  <p className="text-white/40 text-xs mt-0.5">{c.description}</p>
                  <div className="flex gap-3 mt-1.5">
                    <span className="text-white/25 text-[10px]">Target: {c.targetValue}</span>
                    <span className="text-white/25 text-[10px]">{c.durationDays} days</span>
                    <span className="text-white/25 text-[10px]">{c.participants} participants</span>
                    <span className={`text-[10px] ${c.isActive ? 'text-green-400' : 'text-white/25'}`}>
                      {c.isActive ? 'Active' : 'Ended'}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => handleDeleteChallenge(c.id, c.title)}
                  className="p-1.5 rounded-lg bg-red-500/5 hover:bg-red-500/15 text-red-500/40 hover:text-red-400 transition-all shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          TAB 5 — TOOLS
          Three sections:
            A. Announcements — send a visible message to all users
            B. Export        — download all users or posts as CSV or JSON
            C. Activity Log  — full history of every admin action taken      ════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'tools' && (
        <div className="space-y-6">

          {/* A. Announcements */}
          <div className="bg-[#0d0b08] rounded-2xl border border-[rgba(201,169,110,0.08)] p-5">
            <div className="flex items-center gap-2 mb-5">
              <Bell className="w-4 h-4 text-[#c9a96e]" />
              <p className="text-white/50 text-[10px] uppercase tracking-widest font-semibold">Send Announcement</p>
            </div>
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Title"
                value={aTitle}
                onChange={e => setATitle(e.target.value)}
                className={inputCls}
              />
              <textarea
                placeholder="Message body…"
                value={aMessage}
                onChange={e => setAMessage(e.target.value)}
                rows={3}
                className={inputCls + ' resize-none'}
              />
              <div className="flex items-center gap-3">
                <select
                  value={aType}
                  onChange={e => setAType(e.target.value)}
                  className={inputCls + ' w-auto'}
                >
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="success">Success</option>
                  <option value="error">Error</option>
                </select>
                <button
                  onClick={handleSendAnnouncement}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all"
                  style={{ background: '#c9a96e', color: '#080608', boxShadow: '0 0 20px rgba(201,169,110,0.25)' }}
                >
                  <Send className="w-3.5 h-3.5" />
                  Send to All Users
                </button>
              </div>
            </div>

            {announcements.length > 0 && (
              <div className="mt-5 pt-5 border-t border-[rgba(201,169,110,0.07)] space-y-2">
                <p className="text-white/30 text-[10px] uppercase tracking-widest mb-3">Active Announcements</p>
                {announcements.map(a => (
                  <div key={a.id} className="flex items-start gap-3 px-3 py-3 rounded-xl bg-white/[0.02] border border-[rgba(201,169,110,0.06)] group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <p className="text-white/80 text-sm font-medium truncate">{a.title}</p>
                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
                          a.type === 'warning' ? 'bg-orange-500/15 text-orange-300' :
                          a.type === 'error'   ? 'bg-red-500/15 text-red-300' :
                          a.type === 'success' ? 'bg-green-500/15 text-green-300' :
                          'bg-blue-500/15 text-blue-300'
                        }`}>{a.type}</span>
                      </div>
                      <p className="text-white/35 text-xs truncate">{a.message}</p>
                      <p className="text-white/20 text-[10px] mt-1">{new Date(a.createdAt).toLocaleString()}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteAnnouncement(a.id)}
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      title="Delete announcement"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* B. Export */}
          <div className="bg-[#0d0b08] rounded-2xl border border-[rgba(201,169,110,0.08)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Download className="w-4 h-4 text-[#c9a96e]" />
              <p className="text-white/50 text-[10px] uppercase tracking-widest font-semibold">Export Data</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => { try { exportAsCSV(users as unknown as object[], 'users'); toast.success('CSV downloaded'); } catch { toast.error('Export failed'); } }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.12)] text-white/60 hover:text-white hover:bg-[rgba(201,169,110,0.1)] text-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Export CSV
              </button>
              <button
                onClick={() => { try { exportAsJSON(posts as unknown as object[], 'posts'); toast.success('JSON downloaded'); } catch { toast.error('Export failed'); } }}
                className="flex items-center justify-center gap-2 py-2.5 rounded-xl bg-[rgba(201,169,110,0.06)] border border-[rgba(201,169,110,0.12)] text-white/60 hover:text-white hover:bg-[rgba(201,169,110,0.1)] text-sm transition-all"
              >
                <Download className="w-3.5 h-3.5" /> Export JSON
              </button>
            </div>
          </div>

          {/* C. Audit Log */}
          <div className="bg-[#0d0b08] rounded-2xl border border-[rgba(201,169,110,0.08)] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-[#c9a96e]" />
              <p className="text-white/50 text-[10px] uppercase tracking-widest font-semibold">Audit Log</p>
            </div>
            {logs.length === 0 ? (
              <p className="text-white/25 text-sm text-center py-6">No audit entries yet</p>
            ) : (
              <div className="space-y-1 max-h-72 overflow-y-auto">
                {logs.map(log => (
                  <div key={log.id} className="flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-white/[0.02] transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full bg-[#c9a96e]/40 mt-1.5 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white/70 text-xs">
                        <span className="font-medium text-[#e8c98a]">{log.action}</span>
                        {log.details && <span className="text-white/40"> &mdash; {log.details}</span>}
                      </p>
                      <p className="text-white/25 text-[10px] mt-0.5">
                        {log.adminId} &middot; {log.timestamp ? new Date(log.timestamp).toLocaleString() : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
