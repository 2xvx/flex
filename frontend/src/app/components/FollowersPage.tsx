// FollowersPage.tsx — shows followers and following for any user profile

import { useState, useEffect } from 'react';
import { ArrowLeft, UserCheck, UserPlus, Users } from 'lucide-react';
import { User } from '../types';
import { followUser, unfollowUser, getFollowingList, getSentRequestUids } from '../../services/followService';
import { toast } from 'sonner';

import { API } from '../../config';

interface FollowUser {
  uid: string;
  displayName?: string;
  username?: string;
  avatar?: string;
  fitnessLevel?: string;
  accountType?: string;
}

interface FollowersPageProps {
  currentUser: User | null;
  viewingUserId: string;
  initialTab?: 'followers' | 'following';
  onBack: () => void;
  onViewProfile: (uid: string) => void;
}

export function FollowersPage({
  currentUser,
  viewingUserId,
  initialTab = 'followers',
  onBack,
  onViewProfile,
}: FollowersPageProps) {
  const [tab, setTab] = useState<'followers' | 'following'>(initialTab);
  const [followers, setFollowers] = useState<FollowUser[]>([]);
  const [following, setFollowing] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [myFollowing, setMyFollowing] = useState<Set<string>>(new Set());
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [followersRes, followingRes] = await Promise.all([
          fetch(`${API}/users/${viewingUserId}/followers`),
          fetch(`${API}/users/${viewingUserId}/following-users`),
        ]);
        if (followersRes.ok) {
          const d = await followersRes.json();
          setFollowers(d.users || []);
        }
        if (followingRes.ok) {
          const d = await followingRes.json();
          setFollowing(d.users || []);
        }
        if (currentUser?.id) {
          const [myList, pendingList] = await Promise.all([
            getFollowingList(currentUser.id),
            getSentRequestUids(),
          ]);
          setMyFollowing(new Set(myList));
          setPendingRequests(new Set(pendingList));
        }
      } catch {
        toast.error('Could not load connections');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [viewingUserId, currentUser?.id]);

  const handleToggleFollow = async (uid: string) => {
    if (!currentUser) return toast.error('Log in to follow');
    if (uid === currentUser.id) return;
    setActionLoading(uid);
    try {
      if (myFollowing.has(uid)) {
        await unfollowUser(uid);
        setMyFollowing(prev => { const s = new Set(prev); s.delete(uid); return s; });
        toast.success('Unfollowed');
      } else if (pendingRequests.has(uid)) {
        toast.info('Request already sent — waiting for them to accept');
      } else {
        const result = await followUser(uid);
        if (result.alreadyFollowing) {
          setMyFollowing(prev => new Set([...prev, uid]));
        } else {
          setPendingRequests(prev => new Set([...prev, uid]));
          toast.success('Follow request sent!');
        }
      }
    } catch (e: any) {
      toast.error(e.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  const list = tab === 'followers' ? followers : following;

  return (
    <div className="max-w-2xl mx-auto py-6 px-4 space-y-5">

      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="w-9 h-9 rounded-xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] flex items-center justify-center text-white/60 hover:bg-[rgba(201,169,110,0.08)] transition-all shrink-0"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h1 className="text-white font-semibold">Connections</h1>
          <p className="text-white/40 text-xs">
            {followers.length} follower{followers.length !== 1 ? 's' : ''} · {following.length} following
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-[rgba(201,169,110,0.04)] p-1 rounded-xl">
        {(['followers', 'following'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize
              ${tab === t ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70'}`}
          >
            {t === 'followers' ? `Followers (${followers.length})` : `Following (${following.length})`}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-4 flex items-center gap-3 animate-pulse">
              <div className="w-12 h-12 rounded-xl bg-white/10 shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-32 bg-white/10 rounded" />
                <div className="h-2 w-24 bg-[rgba(201,169,110,0.04)] rounded" />
              </div>
              <div className="w-20 h-7 rounded-lg bg-[rgba(201,169,110,0.06)]" />
            </div>
          ))}
        </div>
      ) : list.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-14 h-14 rounded-2xl bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] flex items-center justify-center mx-auto mb-4">
            <Users className="w-6 h-6 text-white/20" />
          </div>
          <p className="text-white/40 text-sm">
            {tab === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
          </p>
          {tab === 'followers' && (
            <p className="text-white/25 text-xs mt-1">Share your profile to get followers</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {list.map(user => {
            const isSelf = user.uid === currentUser?.id;
            const isFollowingUser = myFollowing.has(user.uid);
            const avatarSrc = user.avatar ||
              `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || 'U')}&background=7c3aed&color=fff`;

            return (
              <div
                key={user.uid}
                className="bg-[#080608] border border-[rgba(201,169,110,0.08)] rounded-2xl p-4 flex items-center gap-3"
              >
                {/* Avatar — clickable */}
                <button onClick={() => onViewProfile(user.uid)} className="shrink-0">
                  <img
                    src={avatarSrc}
                    alt={user.displayName}
                    className="w-12 h-12 rounded-xl object-cover"
                  />
                </button>

                {/* Name / username — clickable */}
                <button onClick={() => onViewProfile(user.uid)} className="flex-1 text-left min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-white font-medium text-sm truncate">
                      {user.displayName || user.username || 'User'}
                    </p>
                    {user.accountType === 'trainer' && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-300 font-medium shrink-0">
                        trainer
                      </span>
                    )}
                  </div>
                  {user.username && (
                    <p className="text-white/40 text-xs truncate">@{user.username}</p>
                  )}
                  {user.fitnessLevel && (
                    <p className="text-white/25 text-xs mt-0.5">{user.fitnessLevel}</p>
                  )}
                </button>

                {/* Follow / Requested / Following button */}
                {!isSelf && (
                  <button
                    onClick={() => handleToggleFollow(user.uid)}
                    disabled={actionLoading === user.uid}
                    className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all disabled:opacity-50
                      ${isFollowingUser
                        ? 'border border-[rgba(201,169,110,0.18)] text-white/60 hover:border-red-500/40 hover:text-red-400'
                        : pendingRequests.has(user.uid)
                          ? 'border border-yellow-500/30 text-yellow-400/80'
                          : 'bg-[#c9a96e] text-white hover:bg-[#c9a96e]'}`}
                  >
                    {actionLoading === user.uid
                      ? '…'
                      : isFollowingUser
                        ? <><UserCheck className="w-3 h-3" /> Following</>
                        : pendingRequests.has(user.uid)
                          ? 'Requested'
                          : <><UserPlus className="w-3 h-3" /> Follow</>}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
