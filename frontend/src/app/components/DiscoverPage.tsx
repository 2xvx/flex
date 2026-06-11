// DiscoverPage.tsx — Search + Explore + Leaderboard + Library
import { useState } from 'react';
import { Search, Compass, Trophy, BookOpen } from 'lucide-react';
import { SearchPage } from './SearchPage';
import { ExplorePage } from './ExplorePage';
import { LeaderboardPage } from './LeaderboardPage';
import { ExerciseLibraryPage } from './ExerciseLibraryPage';
import { User } from '../types';

interface Props {
  currentUser: User | null;
  onViewProfile: (uid: string) => void;
  hashtagFilter: string | null;
  onHashtag: (tag: string) => void;
  onClearHashtag: () => void;
}

const TABS = [
  { id: 'search',      label: 'Search',      Icon: Search   },
  { id: 'explore',     label: 'Explore',     Icon: Compass  },
  { id: 'leaderboard', label: 'Leaderboard', Icon: Trophy   },
  { id: 'library',     label: 'Library',     Icon: BookOpen },
];

export function DiscoverPage({ currentUser, onViewProfile, hashtagFilter, onHashtag, onClearHashtag }: Props) {
  const [tab, setTab] = useState('search');
  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-20 bg-[#080608] border-b border-[rgba(201,169,110,0.08)]">
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
      {tab === 'search'      && <SearchPage currentUser={currentUser} onViewProfile={onViewProfile} hashtagFilter={hashtagFilter} onHashtag={onHashtag} onClearHashtag={onClearHashtag} />}
      {tab === 'explore'     && <ExplorePage currentUser={currentUser} onViewProfile={onViewProfile} />}
      {tab === 'leaderboard' && <LeaderboardPage currentUser={currentUser} onViewProfile={onViewProfile} />}
      {tab === 'library'     && <ExerciseLibraryPage currentUser={currentUser} />}
    </div>
  );
}
