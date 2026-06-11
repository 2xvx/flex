// WelcomePage.tsx — Full-screen animated welcome shown right after login

import { useEffect, useState } from 'react';
import { Dumbbell, Flame, Trophy, Users, Zap, Star, ChevronRight, Heart, BarChart2 } from 'lucide-react';
import { User } from '../types';

interface WelcomePageProps {
  currentUser: User | null;
  onEnter: () => void;
}

const FEATURES = [
  { icon: <Flame    className="w-5 h-5" />, color: 'from-orange-500 to-red-500',   bg: 'bg-orange-500/10', border: 'border-orange-500/20', title: 'Track Workouts',   desc: 'Log every session and watch your progress grow' },
  { icon: <Trophy   className="w-5 h-5" />, color: 'from-yellow-500 to-amber-500', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', title: 'Earn Badges',      desc: 'Complete challenges and collect permanent rewards' },
  { icon: <Users    className="w-5 h-5" />, color: 'from-blue-500 to-cyan-500',    bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   title: 'Friend Duels',    desc: 'Challenge others to head-to-head fitness battles' },
  { icon: <BarChart2 className="w-5 h-5" />, color: 'from-[#c9a96e] to-[#a07840]', bg: 'bg-[rgba(201,169,110,0.08)]', border: 'border-[rgba(201,169,110,0.18)]', title: 'Leaderboards',   desc: 'See where you rank in the community' },
  { icon: <Star     className="w-5 h-5" />, color: 'from-pink-500 to-rose-500',    bg: 'bg-pink-500/10',   border: 'border-[rgba(201,169,110,0.15)]',   title: 'Book Trainers',   desc: 'Connect with expert coaches for personal sessions' },
  { icon: <Zap      className="w-5 h-5" />, color: 'from-green-500 to-emerald-500', bg: 'bg-green-500/10', border: 'border-green-500/20',  title: 'PR Tracker',      desc: 'Graph your personal records and break them' },
];

export function WelcomePage({ currentUser, onEnter }: WelcomePageProps) {
  const [stage, setStage] = useState(0); // 0=logo, 1=name, 2=features, 3=cta
  const [featuresVisible, setFeaturesVisible] = useState<boolean[]>(new Array(6).fill(false));

  const firstName = currentUser?.name?.split(' ')[0] || 'there';
  const isTrainer = currentUser?.accountType === 'trainer';

  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 300);
    const t2 = setTimeout(() => setStage(2), 900);
    const t3 = setTimeout(() => {
      FEATURES.forEach((_, i) => {
        setTimeout(() => {
          setFeaturesVisible(prev => { const n = [...prev]; n[i] = true; return n; });
        }, i * 100);
      });
    }, 1200);
    const t4 = setTimeout(() => setStage(3), 2200);
    return () => [t1, t2, t3, t4].forEach(clearTimeout);
  }, []);

  return (
    <div className="min-h-screen bg-[#080608] flex flex-col items-center justify-center relative overflow-hidden px-4 py-8">

      {/* Animated background blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-[#c9a96e]/8 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-[#c9a96e]/8 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-[40%] left-[50%] w-[300px] h-[300px] bg-pink-600/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '2s' }} />
        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.02]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      </div>

      {/* Logo mark */}
      <div className={`transition-all duration-700 ${stage >= 0 ? 'opacity-100 scale-100' : 'opacity-0 scale-75'} mb-8`}>
        <div className="relative">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#c9a96e] via-[#c9a96e] to-[#a07840] flex items-center justify-center shadow-2xl shadow-[rgba(201,169,110,0.25)] mx-auto">
            <Dumbbell className="w-10 h-10 text-white" strokeWidth={2} />
          </div>
          {/* Orbiting dot */}
          <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-yellow-400 to-orange-400 shadow-lg shadow-yellow-500/40 flex items-center justify-center">
            <Heart className="w-2.5 h-2.5 text-white fill-white" />
          </div>
        </div>
      </div>

      {/* Greeting text */}
      <div className={`text-center mb-10 transition-all duration-700 ${stage >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <p className="text-[#c9a96e] text-sm font-medium tracking-widest uppercase mb-2">Welcome to Flex 🔥</p>
        <h1 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-3">
          Hey, <span className="bg-gradient-to-r from-[#c9a96e] via-[#e8c98a] to-[#c9a96e] bg-clip-text text-transparent">{firstName}</span> 👋
        </h1>
        <p className="text-white/50 text-base max-w-sm mx-auto leading-relaxed">
          {isTrainer
            ? 'Your clients are waiting. Let\'s build something great together.'
            : 'Your fitness journey just levelled up. Let\'s crush some goals.'}
        </p>
      </div>

      {/* Feature grid */}
      <div className={`w-full max-w-lg mb-10 transition-all duration-500 ${stage >= 2 ? 'opacity-100' : 'opacity-0'}`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {FEATURES.map((f, i) => (
            <div key={f.title}
              className={`${f.bg} border ${f.border} rounded-2xl p-3.5 transition-all duration-500
                ${featuresVisible[i] ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-2.5 shadow-lg`}>
                {f.icon}
              </div>
              <p className="text-white text-xs font-semibold leading-tight mb-0.5">{f.title}</p>
              <p className="text-white/35 text-[10px] leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* CTA button */}
      <div className={`transition-all duration-700 ${stage >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
        <button
          onClick={onEnter}
          className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-[#c9a96e] via-[#c9a96e] to-[#a07840] text-white font-semibold text-base shadow-2xl shadow-[rgba(201,169,110,0.25)] hover:shadow-[rgba(201,169,110,0.3)] hover:scale-105 active:scale-95 transition-all duration-300"
        >
          <Flame className="w-5 h-5 text-orange-300" />
          Let's get started
          <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
        </button>
        <p className="text-white/20 text-xs text-center mt-4">
          {currentUser?.workouts
            ? `You've logged ${currentUser.workouts} workout${currentUser.workouts !== 1 ? 's' : ''} so far`
            : 'Start by logging your first workout'}
        </p>
      </div>

      {/* Floating particles */}
      {stage >= 2 && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(8)].map((_, i) => (
            <div key={i}
              className="absolute w-1 h-1 rounded-full bg-[#c9a96e]/30 animate-pulse"
              style={{
                left: `${10 + i * 12}%`,
                top: `${20 + (i % 3) * 25}%`,
                animationDelay: `${i * 0.3}s`,
                animationDuration: `${2 + i * 0.4}s`,
              }} />
          ))}
        </div>
      )}
    </div>
  );
}
