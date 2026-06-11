// NotificationsPanel.tsx
//
// A slide-in notification panel shown when the user clicks the bell icon.
// Clicking a notification marks it as read AND navigates to the relevant content.

import { useState, useEffect, useCallback } from 'react';
import { X, Bell, CheckCheck, ChevronRight } from 'lucide-react';
import { AppNotification } from '../types';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
} from '../../services/notificationService';
import { toast } from 'sonner';

// ─── Notification icon + colour by type ──────────────────────────────────────

const TYPE_CONFIG: Record<AppNotification['type'], { icon: string; colour: string; bg: string }> = {
  like_hype:        { icon: '🔥', colour: 'text-orange-300', bg: 'bg-orange-500/10 border-orange-500/20' },
  trainer_shoutout: { icon: '⭐', colour: 'text-yellow-300', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  duel_request:     { icon: '⚔️', colour: 'text-[#e8c98a]', bg: 'bg-[rgba(201,169,110,0.08)] border-[rgba(201,169,110,0.18)]' },
  badge_earned:     { icon: '🏅', colour: 'text-green-300',  bg: 'bg-green-500/10  border-green-500/20'  },
  streak_warning:   { icon: '⚡', colour: 'text-yellow-300', bg: 'bg-yellow-500/10 border-yellow-500/20' },
  duel_update:      { icon: '📣', colour: 'text-blue-300',   bg: 'bg-blue-500/10   border-blue-500/20'   },
  follow_request:   { icon: '👤', colour: 'text-[#e8c98a]', bg: 'bg-[rgba(201,169,110,0.08)] border-[rgba(201,169,110,0.18)]' },
  follow_accepted:  { icon: '✅', colour: 'text-green-300',  bg: 'bg-green-500/10  border-green-500/20'  },
};

// Relative time string
function relTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  <  1) return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ─── Derive destination from notification type + data ────────────────────────
function getDestination(notif: AppNotification): string | null {
  const d = notif.data || {};
  switch (notif.type) {
    case 'like_hype':
    case 'trainer_shoutout':
      return d.postId ? `post:${d.postId}` : 'feed';
    case 'duel_request':
    case 'duel_update':
      return 'challenges';
    case 'follow_request':
      return 'messages';
    case 'follow_accepted':
      return d.fromUid ? `profile:${d.fromUid}` : 'feed';
    case 'badge_earned':
      return 'challenges';
    case 'streak_warning':
      return 'feed';
    default:
      return null;
  }
}

// ─── Single notification row ──────────────────────────────────────────────────

function NotifRow({
  notif, onRead, onNavigate,
}: {
  notif: AppNotification;
  onRead: (id: string) => void;
  onNavigate: (dest: string) => void;
}) {
  const cfg  = TYPE_CONFIG[notif.type] ?? TYPE_CONFIG.duel_update;
  const dest = getDestination(notif);

  const handleClick = () => {
    if (!notif.isRead) onRead(notif.id);
    if (dest) onNavigate(dest);
  };

  return (
    <div
      onClick={handleClick}
      className={`flex gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
        notif.isRead
          ? 'bg-transparent border-transparent opacity-50 hover:opacity-70'
          : `${cfg.bg} hover:opacity-90`
      }`}
    >
      <span className="text-xl shrink-0 mt-0.5">{cfg.icon}</span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium leading-snug ${notif.isRead ? 'text-white/60' : 'text-white'}`}>
          {notif.title}
        </p>
        <p className="text-white/40 text-xs mt-0.5 leading-relaxed">{notif.message}</p>
        <p className="text-white/25 text-[10px] mt-1">{relTime(notif.createdAt)}</p>
      </div>
      <div className="flex flex-col items-end gap-1 shrink-0">
        {!notif.isRead && <div className="w-2 h-2 rounded-full bg-[#c9a96e] mt-1.5" />}
        {dest && <ChevronRight className="w-3.5 h-3.5 text-white/20 mt-auto" />}
      </div>
    </div>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface NotificationsPanelProps {
  userId: string;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
  onNavigate?: (dest: string) => void;
}

export function NotificationsPanel({ userId, onClose, onUnreadCountChange, onNavigate }: NotificationsPanelProps) {
  const [notifs, setNotifs]   = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const unreadCount = notifs.filter(n => !n.isRead).length;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getNotifications(userId);
      setNotifs(data);
      onUnreadCountChange?.(data.filter((n: AppNotification) => !n.isRead).length);
    } catch {
      toast.error('Could not load notifications');
    } finally {
      setLoading(false);
    }
  }, [userId, onUnreadCountChange]);

  useEffect(() => { load(); }, [load]);

  const handleRead = async (id: string) => {
    try {
      await markNotificationRead(id);
      setNotifs(ns => ns.map(n => n.id === id ? { ...n, isRead: true } : n));
      onUnreadCountChange?.(unreadCount - 1);
    } catch { /* silent */ }
  };

  const handleNavigate = (dest: string) => {
    onClose();
    onNavigate?.(dest);
  };

  const handleReadAll = async () => {
    try {
      await markAllNotificationsRead(userId);
      setNotifs(ns => ns.map(n => ({ ...n, isRead: true })));
      onUnreadCountChange?.(0);
    } catch {
      toast.error('Failed to mark all as read');
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 h-full w-80 z-50 bg-[#080608] border-l border-[rgba(201,169,110,0.08)] flex flex-col shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,169,110,0.08)]">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-white/60" />
            <p className="text-white font-semibold text-sm">Notifications</p>
            {unreadCount > 0 && (
              <span className="text-xs bg-[#c9a96e] text-white px-1.5 py-0.5 rounded-full font-medium">
                {unreadCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleReadAll}
                className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                <CheckCheck className="w-3.5 h-3.5" /> All read
              </button>
            )}
            <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
          {loading ? (
            <div className="flex flex-col items-center py-16 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[rgba(201,169,110,0.25)] border-t-[#c9a96e] animate-spin" />
              <p className="text-white/30 text-xs">Loading…</p>
            </div>
          ) : notifs.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <div className="w-14 h-14 rounded-2xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] flex items-center justify-center mb-4">
                <Bell className="w-6 h-6 text-white/20" />
              </div>
              <p className="text-white/40 text-sm">No notifications yet</p>
              <p className="text-white/25 text-xs mt-1">We'll let you know when something happens.</p>
            </div>
          ) : (
            <>
              {notifs.filter(n => !n.isRead).length > 0 && (
                <>
                  <p className="text-white/30 text-[10px] font-medium uppercase tracking-widest px-1 pt-1">
                    New
                  </p>
                  {notifs.filter(n => !n.isRead).map(n => (
                    <NotifRow key={n.id} notif={n} onRead={handleRead} onNavigate={handleNavigate} />
                  ))}
                </>
              )}
              {notifs.filter(n => n.isRead).length > 0 && (
                <>
                  <p className="text-white/30 text-[10px] font-medium uppercase tracking-widest px-1 pt-2">
                    Earlier
                  </p>
                  {notifs.filter(n => n.isRead).map(n => (
                    <NotifRow key={n.id} notif={n} onRead={handleRead} onNavigate={handleNavigate} />
                  ))}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
