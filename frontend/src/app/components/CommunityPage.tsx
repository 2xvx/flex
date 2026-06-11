// CommunityPage.tsx — Messages + Communities + Events + Accountability + Weekly Challenge + Find Buddy + Gyms
import { useState } from 'react';
import { MessageSquare, Users, UserPlus2, MapPin, Calendar, UserCheck, Trophy } from 'lucide-react';
import { MessagesPage } from './MessagesPage';
import { CommunitiesPage } from './CommunitiesPage';
import { WorkoutBuddyPage } from './WorkoutBuddyPage';
import { GymsPage } from './GymsPage';
import { GroupEventsPage } from './GroupEventsPage';
import { AccountabilityPage } from './AccountabilityPage';
import { WeeklyChallengePage } from './WeeklyChallengePage';
import { User } from '../types';

interface Props {
  currentUser: User | null;
  onViewProfile: (uid: string) => void;
  onNavigate: (view: string) => void;
  onFollowRequestsViewed: () => void;
}

const TABS = [
  { id: 'messages',      label: 'Messages',    Icon: MessageSquare },
  { id: 'communities',   label: 'Communities', Icon: Users         },
  { id: 'events',        label: 'Events',      Icon: Calendar      },
  { id: 'challenge',     label: 'Challenge',   Icon: Trophy        },
  { id: 'accountability',label: 'Pairs',       Icon: UserCheck     },
  { id: 'buddy',         label: 'Find Buddy',  Icon: UserPlus2     },
  { id: 'gyms',          label: 'Gyms',        Icon: MapPin        },
];

export function CommunityPage({ currentUser, onViewProfile, onNavigate, onFollowRequestsViewed }: Props) {
  const [tab, setTab] = useState('messages');

  const isMessages = tab === 'messages';

  return (
    <div className={isMessages ? 'flex flex-col h-full' : 'min-h-full'}>
      <div className="sticky top-0 z-20 bg-[#080608] border-b border-[rgba(201,169,110,0.08)] shrink-0">
        <div className="flex overflow-x-auto scrollbar-hide">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-all shrink-0 ${
                tab === id ? 'border-[#c9a96e] text-white' : 'border-transparent text-white/40 hover:text-white/70'
              }`}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>
      </div>
      <div className={isMessages ? 'flex-1 min-h-0 overflow-hidden' : undefined}>
        {tab === 'messages'       && <MessagesPage currentUser={currentUser} onFollowRequestsViewed={onFollowRequestsViewed} onViewProfile={onViewProfile} />}
        {tab === 'communities'    && <CommunitiesPage currentUser={currentUser} onNavigate={onNavigate} />}
        {tab === 'events'         && <GroupEventsPage currentUser={currentUser} />}
        {tab === 'challenge'      && <WeeklyChallengePage currentUser={currentUser} />}
        {tab === 'accountability' && <AccountabilityPage currentUser={currentUser} />}
        {tab === 'buddy'          && <WorkoutBuddyPage currentUser={currentUser} onNavigate={onNavigate} />}
        {tab === 'gyms'           && <GymsPage currentUser={currentUser} />}
      </div>
    </div>
  );
}
