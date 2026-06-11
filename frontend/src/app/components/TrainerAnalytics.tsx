// TrainerAnalytics.tsx — Dashboard for trainers: bookings, earnings, followers, profile views
import { useState, useEffect } from 'react';
import { BarChart2, Users, DollarSign, Eye, TrendingUp, Calendar } from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { User } from '../types';

interface TrainerAnalyticsProps { currentUser: User; }

import { API } from '../../config';

export function TrainerAnalytics({ currentUser }: TrainerAnalyticsProps) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    authFetch(`${API}/users/${currentUser.id}/trainer/analytics`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setStats(d); })
      .finally(() => setLoading(false));
  }, [currentUser.id]);

  if (loading) return (
    <div className="flex justify-center py-10">
      <div className="w-8 h-8 rounded-full border-2 border-[rgba(201,169,110,0.25)] border-t-[#c9a96e] animate-spin" />
    </div>
  );
  if (!stats) return <p className="text-white/40 text-sm text-center py-6">Failed to load analytics.</p>;

  const cards = [
    { label: 'Total Bookings', value: stats.totalBookings, icon: <Calendar className="w-4 h-4" />, color: 'text-[#c9a96e]' },
    { label: 'Confirmed',      value: stats.confirmed,     icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-400' },
    { label: 'Completed',      value: stats.completed,     icon: <BarChart2 className="w-4 h-4" />, color: 'text-blue-400' },
    { label: 'Unique Clients', value: stats.uniqueClients, icon: <Users className="w-4 h-4" />, color: 'text-orange-400' },
    { label: 'Earnings (est.)', value: `$${stats.totalEarnings}`, icon: <DollarSign className="w-4 h-4" />, color: 'text-yellow-400' },
    { label: 'Profile Views',  value: stats.profileViews,  icon: <Eye className="w-4 h-4" />, color: 'text-pink-400' },
  ];

  const maxMonthly = Math.max(...(stats.monthlyData?.map((m: any) => m.count) || [1]), 1);

  return (
    <div className="space-y-5">
      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3">
        {cards.map(({ label, value, icon, color }) => (
          <div key={label} className="bg-[rgba(201,169,110,0.03)] rounded-xl p-4 border border-[rgba(201,169,110,0.08)]">
            <div className={`flex items-center gap-1.5 mb-2 ${color}`}>
              {icon}
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="text-white font-bold text-2xl">{value ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Monthly bookings bar chart */}
      {stats.monthlyData?.length > 0 && (
        <div className="bg-[rgba(201,169,110,0.03)] rounded-xl p-4 border border-[rgba(201,169,110,0.08)]">
          <p className="text-white/50 text-xs mb-4 uppercase tracking-wide">Bookings — last 6 months</p>
          <div className="flex items-end gap-2 h-24">
            {stats.monthlyData.map((m: any) => (
              <div key={m.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-white/40 text-[10px]">{m.count || ''}</span>
                <div
                  className="w-full bg-[#c9a96e]/60 rounded-t-sm transition-all"
                  style={{ height: `${Math.max(4, (m.count / maxMonthly) * 80)}px` }}
                />
                <span className="text-white/30 text-[10px]">{m.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Status breakdown */}
      <div className="bg-[rgba(201,169,110,0.03)] rounded-xl p-4 border border-[rgba(201,169,110,0.08)]">
        <p className="text-white/50 text-xs mb-3 uppercase tracking-wide">Booking status breakdown</p>
        {[
          { label: 'Confirmed', val: stats.confirmed,  color: 'bg-green-500' },
          { label: 'Completed', val: stats.completed,  color: 'bg-blue-500' },
          { label: 'Pending',   val: stats.pending,    color: 'bg-yellow-500' },
          { label: 'Cancelled', val: stats.cancelled,  color: 'bg-red-500' },
        ].map(({ label, val, color }) => (
          <div key={label} className="flex items-center gap-2 mb-2">
            <span className="text-white/50 text-xs w-20">{label}</span>
            <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div className={`h-full ${color} rounded-full`}
                style={{ width: `${stats.totalBookings ? (val / stats.totalBookings) * 100 : 0}%` }} />
            </div>
            <span className="text-white/40 text-xs w-6 text-right">{val}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <TrendingUp className="w-3.5 h-3.5 text-white/20" />
        <p className="text-white/20 text-xs">{stats.followerCount} followers</p>
      </div>
    </div>
  );
}
