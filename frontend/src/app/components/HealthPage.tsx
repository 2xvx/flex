// HealthPage.tsx — Nutrition + Meals + Water + Recovery + Grocery + Habits + Wearables
import { useState } from 'react';
import { Apple, UtensilsCrossed, Droplets, Zap, ShoppingCart, Flame, Watch } from 'lucide-react';
import { NutritionPage } from './NutritionPage';
import { MealsPage } from './MealsPage';
import { WaterTrackerPage } from './WaterTrackerPage';
import { RecoveryScorePage } from './RecoveryScorePage';
import { GroceryListPage } from './GroceryListPage';
import { HabitTrackerPage } from './HabitTrackerPage';
import { HealthIntegrationPage } from './HealthIntegrationPage';
import { User } from '../types';

interface Props { currentUser: User | null; }

const TABS = [
  { id: 'nutrition', label: 'Nutrition',  Icon: Apple,           color: 'border-green-500'  },
  { id: 'meals',     label: 'Meals',      Icon: UtensilsCrossed, color: 'border-green-500'  },
  { id: 'habits',    label: 'Habits',     Icon: Flame,           color: 'border-orange-500' },
  { id: 'water',     label: 'Water',      Icon: Droplets,        color: 'border-sky-500'    },
  { id: 'recovery',  label: 'Recovery',   Icon: Zap,             color: 'border-amber-500'  },
  { id: 'grocery',   label: 'Grocery',    Icon: ShoppingCart,    color: 'border-green-500'  },
  { id: 'wearables', label: 'Wearables',  Icon: Watch,           color: 'border-[#c9a96e]' },
];

export function HealthPage({ currentUser }: Props) {
  const [tab, setTab] = useState('nutrition');

  return (
    <div className="min-h-full">
      <div className="sticky top-0 z-20 bg-[#080608] border-b border-[rgba(201,169,110,0.08)]">
        <div className="flex overflow-x-auto scrollbar-hide">
          {TABS.map(({ id, label, Icon, color }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-2 px-5 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-all shrink-0 ${
                tab === id ? `${color} text-white` : 'border-transparent text-white/40 hover:text-white/70'
              }`}>
              <Icon size={15} />{label}
            </button>
          ))}
        </div>
      </div>
      {tab === 'nutrition' && <NutritionPage currentUser={currentUser} />}
      {tab === 'meals'     && <MealsPage     currentUser={currentUser} />}
      {tab === 'habits'    && currentUser && <HabitTrackerPage userId={currentUser.id} />}
      {tab === 'water'     && <WaterTrackerPage currentUser={currentUser} />}
      {tab === 'recovery'  && <RecoveryScorePage currentUser={currentUser} />}
      {tab === 'grocery'   && <GroceryListPage currentUser={currentUser} />}
      {tab === 'wearables' && currentUser && <HealthIntegrationPage userId={currentUser.id} />}
    </div>
  );
}
