// MarketplacePage.tsx — Browse, buy, and sell workout plans & nutrition blueprints
import { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag, Star, TrendingUp, BookOpen, Dumbbell, Salad,
  FileText, Search, X, ChevronRight, BadgeCheck, Lock,
  DollarSign, Plus, Package, Loader2, ArrowLeft, ShoppingCart,
  BarChart2, Users, Zap,
} from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';
import { API } from '../../config';
import { User } from '../types';

// ── Types ────────────────────────────────────────────────────────────────────
interface MarketplaceProgram {
  id: string;
  programId: string;
  name: string;
  description?: string;
  price: number;
  category: string;
  weeks: number;
  purchases: number;
  rating: number;
  reviews: number;
  trainerId: string;
  trainerName: string;
  trainerAvatar?: string;
  trainerVerified?: boolean;
  publishedAt: string;
}

interface MyProgram { id: string; name: string; weeks?: number; description?: string; }
interface Purchase { id?: string; marketplaceProgramId: string; programId: string; price: number; purchasedAt: string; }

interface Props { currentUser: User | null; }

const CATEGORIES = [
  { id: 'all',       label: 'All',        Icon: Package  },
  { id: 'strength',  label: 'Strength',   Icon: Dumbbell },
  { id: 'cardio',    label: 'Cardio',     Icon: Zap      },
  { id: 'nutrition', label: 'Nutrition',  Icon: Salad    },
  { id: 'ebook',     label: 'eBooks',     Icon: FileText },
  { id: 'general',   label: 'General',    Icon: BookOpen },
];

const PRICE_RANGES = [
  { id: 'all',   label: 'Any price',  min: 0,   max: Infinity },
  { id: 'free',  label: 'Free',       min: 0,   max: 0        },
  { id: 'cheap', label: 'Under £10',  min: 0.01,max: 9.99     },
  { id: 'mid',   label: '£10–£30',    min: 10,  max: 30       },
  { id: 'prem',  label: '£30+',       min: 30,  max: Infinity },
];

// ── Sub-components ────────────────────────────────────────────────────────────
function StarRating({ rating, small }: { rating: number; small?: boolean }) {
  return (
    <div className={`flex items-center gap-0.5 ${small ? 'text-[10px]' : 'text-xs'}`}>
      {[1,2,3,4,5].map(s => (
        <Star key={s} className={`${small ? 'w-2.5 h-2.5' : 'w-3 h-3'} ${s <= Math.round(rating) ? 'fill-amber-400 text-amber-400' : 'text-white/15'}`} />
      ))}
    </div>
  );
}

function CategoryBadge({ category }: { category: string }) {
  const colors: Record<string, string> = {
    strength:  'bg-orange-500/15 text-orange-300 border-orange-500/20',
    cardio:    'bg-sky-500/15 text-sky-300 border-sky-500/20',
    nutrition: 'bg-green-500/15 text-green-300 border-green-500/20',
    ebook:     'bg-[#c9a96e]/15 text-[#e8c98a] border-[rgba(201,169,110,0.18)]',
    general:   'bg-[rgba(201,169,110,0.04)] text-white/50 border-[rgba(201,169,110,0.12)]',
  };
  return (
    <span className={`text-[9px] font-medium uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${colors[category] || colors.general}`}>
      {category}
    </span>
  );
}

function ProgramCard({ prog, owned, onSelect }: { prog: MarketplaceProgram; owned: boolean; onSelect: () => void }) {
  return (
    <div onClick={onSelect}
      className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-2xl p-4 cursor-pointer hover:border-[rgba(201,169,110,0.25)] hover:bg-[rgba(201,169,110,0.04)] transition-all group">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <CategoryBadge category={prog.category} />
          <h3 className="text-white font-medium text-sm mt-1.5 leading-tight line-clamp-2 group-hover:text-[#e8c98a] transition-colors">
            {prog.name}
          </h3>
        </div>
        <div className="ml-3 shrink-0 text-right">
          {prog.price === 0
            ? <span className="text-green-400 font-bold text-sm">Free</span>
            : <span className="text-white font-bold text-sm">£{prog.price.toFixed(2)}</span>
          }
        </div>
      </div>

      {/* Trainer */}
      <div className="flex items-center gap-2 mb-3">
        {prog.trainerAvatar
          ? <img src={prog.trainerAvatar} className="w-5 h-5 rounded-full object-cover" />
          : <div className="w-5 h-5 rounded-full bg-[#c9a96e]/40 flex items-center justify-center text-[8px] text-[#e8c98a]">{prog.trainerName[0]}</div>
        }
        <span className="text-white/40 text-[11px]">{prog.trainerName}</span>
        {prog.trainerVerified && <BadgeCheck className="w-3 h-3 text-[#c9a96e]" />}
      </div>

      {/* Stats row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {prog.weeks > 0 && <span className="text-white/30 text-[10px]">{prog.weeks}w</span>}
          {prog.reviews > 0 && (
            <div className="flex items-center gap-1">
              <StarRating rating={prog.rating} small />
              <span className="text-white/25 text-[10px]">({prog.reviews})</span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 text-white/20">
          <Users className="w-3 h-3" />
          <span className="text-[10px]">{prog.purchases}</span>
        </div>
      </div>

      {owned && (
        <div className="mt-2 pt-2 border-t border-[rgba(201,169,110,0.06)] flex items-center gap-1 text-green-400 text-[10px]">
          <Lock className="w-2.5 h-2.5" /> Purchased
        </div>
      )}
    </div>
  );
}

// ── Detail View ───────────────────────────────────────────────────────────────
function ProgramDetail({ prog, owned, onBack, onPurchase, purchasing }:
  { prog: MarketplaceProgram; owned: boolean; onBack: () => void; onPurchase: () => void; purchasing: boolean }) {
  return (
    <div className="space-y-5">
      <button onClick={onBack} className="flex items-center gap-1.5 text-white/40 hover:text-white/70 text-sm transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to marketplace
      </button>

      <div className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-2xl overflow-hidden">
        {/* Hero */}
        <div className="bg-gradient-to-br from-[rgba(201,169,110,0.1)] to-[rgba(201,169,110,0.04)] p-6 border-b border-[rgba(201,169,110,0.06)]">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <CategoryBadge category={prog.category} />
              <h2 className="text-white font-bold text-lg mt-2 leading-tight">{prog.name}</h2>
              <div className="flex items-center gap-2 mt-2">
                {prog.trainerAvatar
                  ? <img src={prog.trainerAvatar} className="w-6 h-6 rounded-full object-cover" />
                  : <div className="w-6 h-6 rounded-full bg-[#c9a96e]/40 flex items-center justify-center text-[10px] text-[#e8c98a]">{prog.trainerName[0]}</div>
                }
                <span className="text-white/60 text-sm">{prog.trainerName}</span>
                {prog.trainerVerified && <BadgeCheck className="w-4 h-4 text-[#c9a96e]" />}
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-white/30 text-[10px] uppercase tracking-wide">Price</p>
              {prog.price === 0
                ? <p className="text-green-400 font-bold text-2xl">Free</p>
                : <p className="text-white font-bold text-2xl">£{prog.price.toFixed(2)}</p>
              }
            </div>
          </div>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-3 divide-x divide-white/6 border-b border-[rgba(201,169,110,0.06)]">
          {[
            { label: 'Duration',  value: prog.weeks > 0 ? `${prog.weeks} wks` : '—' },
            { label: 'Students',  value: prog.purchases.toString() },
            { label: 'Rating',    value: prog.reviews > 0 ? `${prog.rating.toFixed(1)} / 5` : 'No ratings' },
          ].map(({ label, value }) => (
            <div key={label} className="px-4 py-3 text-center">
              <p className="text-white font-semibold text-sm">{value}</p>
              <p className="text-white/30 text-[10px]">{label}</p>
            </div>
          ))}
        </div>

        {/* Description */}
        <div className="p-5">
          {prog.description
            ? <p className="text-white/60 text-sm leading-relaxed">{prog.description}</p>
            : <p className="text-white/25 text-sm italic">No description provided.</p>
          }
        </div>

        {/* CTA */}
        <div className="px-5 pb-5">
          {owned
            ? (
              <div className="flex items-center gap-2 bg-green-500/10 border border-green-500/20 text-green-400 rounded-xl px-4 py-3 text-sm font-medium">
                <Lock className="w-4 h-4" /> You own this plan — check Programs tab to use it
              </div>
            )
            : (
              <button onClick={onPurchase} disabled={purchasing}
                className="w-full flex items-center justify-center gap-2 bg-[#c9a96e] hover:bg-[#c9a96e] disabled:opacity-50 text-white font-medium py-3 rounded-xl transition-all">
                {purchasing
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <ShoppingCart className="w-4 h-4" />
                }
                {purchasing ? 'Processing…' : prog.price === 0 ? 'Get for Free' : `Buy for £${prog.price.toFixed(2)}`}
              </button>
            )
          }
        </div>
      </div>
    </div>
  );
}

// ── Publish Modal (trainer only) ──────────────────────────────────────────────
function PublishModal({ onClose, onPublished }: { onClose: () => void; onPublished: () => void }) {
  const [myPrograms, setMyPrograms] = useState<MyProgram[]>([]);
  const [loading, setLoading]       = useState(true);
  const [form, setForm]             = useState({ programId: '', price: '', category: 'general', description: '' });
  const [saving, setSaving]         = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await authFetch(`${API}/programs`);
        const d = await r.json();
        setMyPrograms(d.programs || []);
      } catch { toast.error('Could not load programs'); }
      finally { setLoading(false); }
    })();
  }, []);

  const handlePublish = async () => {
    if (!form.programId) return toast.error('Select a program');
    if (!form.price && form.price !== '0') return toast.error('Enter a price (0 for free)');
    setSaving(true);
    try {
      const r = await authFetch(`${API}/marketplace/programs`, {
        method: 'POST',
        body: JSON.stringify({ ...form, price: Number(form.price) }),
      });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      toast.success('Program published to marketplace!');
      onPublished();
    } catch (e: any) { toast.error(e.message || 'Failed to publish'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-[#0d0b08] border border-[rgba(201,169,110,0.12)] rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(201,169,110,0.07)]">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <Package className="w-4 h-4 text-[#c9a96e]" /> Publish to Marketplace
          </h2>
          <button onClick={onClose} className="text-white/40 hover:text-white/70"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Select program */}
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Select Program</label>
            {loading
              ? <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-[#c9a96e] animate-spin" /></div>
              : myPrograms.length === 0
                ? <p className="text-white/30 text-sm">No programs found. Create one in the Programs tab first.</p>
                : (
                  <select value={form.programId} onChange={e => setForm(f => ({ ...f, programId: e.target.value }))}
                    className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]">
                    <option value="">— Choose a program —</option>
                    {myPrograms.map(p => (
                      <option key={p.id} value={p.id}>{p.name} {p.weeks ? `(${p.weeks}w)` : ''}</option>
                    ))}
                  </select>
                )
            }
          </div>
          {/* Category */}
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-[rgba(201,169,110,0.5)]">
              {CATEGORIES.filter(c => c.id !== 'all').map(c => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </select>
          </div>
          {/* Price */}
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Price (£) — enter 0 for free</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 text-sm">£</span>
              <input type="number" min="0" step="0.01" value={form.price}
                onChange={e => setForm(f => ({ ...f, price: e.target.value }))}
                placeholder="9.99"
                className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl pl-6 pr-3 py-2 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-[rgba(201,169,110,0.5)]" />
            </div>
          </div>
          {/* Description */}
          <div>
            <label className="text-white/50 text-xs block mb-1.5">Marketplace Description</label>
            <textarea rows={3} value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Tell buyers what they'll get…"
              className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)] resize-none" />
          </div>
        </div>
        <div className="px-5 pb-5 flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[rgba(201,169,110,0.12)] text-white/60 text-sm hover:bg-[rgba(201,169,110,0.04)] transition-all">Cancel</button>
          <button onClick={handlePublish} disabled={saving}
            className="flex-1 py-2.5 rounded-xl bg-[#c9a96e] hover:bg-[#c9a96e] text-white text-sm font-medium transition-all disabled:opacity-50">
            {saving ? 'Publishing…' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export function MarketplacePage({ currentUser }: Props) {
  const [view, setView]               = useState<'browse' | 'mine' | 'purchased'>('browse');
  const [programs, setPrograms]       = useState<MarketplaceProgram[]>([]);
  const [myPublished, setMyPublished] = useState<MarketplaceProgram[]>([]);
  const [purchases, setPurchases]     = useState<Purchase[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState('');
  const [category, setCategory]       = useState('all');
  const [priceRange, setPriceRange]   = useState('all');
  const [selected, setSelected]       = useState<MarketplaceProgram | null>(null);
  const [purchasing, setPurchasing]   = useState(false);
  const [showPublish, setShowPublish] = useState(false);

  const isTrainer = currentUser?.accountType === 'trainer';

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [browseRes, purchasedRes] = await Promise.all([
        authFetch(`${API}/marketplace/programs`),
        authFetch(`${API}/marketplace/programs/purchased`),
      ]);
      const browseData    = await browseRes.json();
      const purchasedData = await purchasedRes.json();
      setPrograms(browseData.programs || []);
      setPurchases(purchasedData.purchases || []);

      if (isTrainer) {
        const mineRes  = await authFetch(`${API}/marketplace/programs/mine`);
        const mineData = await mineRes.json();
        setMyPublished(mineData.programs || []);
      }
    } catch { toast.error('Could not load marketplace'); }
    finally { setLoading(false); }
  }, [isTrainer]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const ownedIds = new Set(purchases.map(p => p.marketplaceProgramId));

  const filtered = programs.filter(p => {
    if (category !== 'all' && p.category !== category) return false;
    const range = PRICE_RANGES.find(r => r.id === priceRange)!;
    if (p.price < range.min || p.price > range.max) return false;
    if (search) {
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.trainerName.toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
    }
    return true;
  });

  const handlePurchase = async () => {
    if (!selected || !currentUser) return;
    setPurchasing(true);
    try {
      const r = await authFetch(`${API}/marketplace/programs/${selected.id}/purchase`, { method: 'POST' });
      if (!r.ok) { const e = await r.json(); throw new Error(e.error); }
      toast.success('Purchase successful! Check Programs tab.');
      await loadAll();
      setSelected(null);
    } catch (e: any) { toast.error(e.message || 'Purchase failed'); }
    finally { setPurchasing(false); }
  };

  // ── Trainer revenue stats ─────────────────────────────────────────────────
  const totalRevenue = myPublished.reduce((a, p) => a + (p.price * (p.purchases || 0)), 0);
  const totalSales   = myPublished.reduce((a, p) => a + (p.purchases || 0), 0);

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 text-[#c9a96e] animate-spin" /></div>;
  }

  // ── Detail view ───────────────────────────────────────────────────────────
  if (selected) {
    return (
      <ProgramDetail
        prog={selected}
        owned={ownedIds.has(selected.id)}
        onBack={() => setSelected(null)}
        onPurchase={handlePurchase}
        purchasing={purchasing}
      />
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-white font-semibold flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-[#c9a96e]" /> Marketplace
          </h2>
          <p className="text-white/35 text-xs mt-0.5">Buy and sell workout plans & nutrition programs</p>
        </div>
        {isTrainer && (
          <button onClick={() => setShowPublish(true)}
            className="flex items-center gap-1.5 bg-[#c9a96e] hover:bg-[#c9a96e] text-white text-xs font-medium px-3 py-1.5 rounded-xl transition-all">
            <Plus className="w-3.5 h-3.5" /> Publish
          </button>
        )}
      </div>

      {/* View tabs */}
      <div className="flex bg-white/4 border border-[rgba(201,169,110,0.07)] rounded-xl p-1 gap-1">
        {[
          { id: 'browse',    label: 'Browse',    icon: ShoppingBag },
          { id: 'purchased', label: 'Purchased', icon: Lock        },
          ...(isTrainer ? [{ id: 'mine', label: 'My Plans', icon: BarChart2 }] : []),
        ].map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setView(id as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-medium transition-all ${
              view === id ? 'bg-[#c9a96e] text-white' : 'text-white/40 hover:text-white/70'
            }`}>
            <Icon className="w-3.5 h-3.5" />{label}
          </button>
        ))}
      </div>

      {/* ── BROWSE ── */}
      {view === 'browse' && (
        <>
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search plans, trainers…"
              className="w-full bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl pl-9 pr-3 py-2.5 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-[rgba(201,169,110,0.5)]" />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {CATEGORIES.map(({ id, label, Icon }) => (
              <button key={id} onClick={() => setCategory(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs whitespace-nowrap shrink-0 transition-all ${
                  category === id ? 'bg-[#c9a96e] border-[#c9a96e] text-white' : 'border-[rgba(201,169,110,0.12)] text-white/40 hover:border-[rgba(201,169,110,0.18)] hover:text-white/60'
                }`}>
                <Icon className="w-3 h-3" />{label}
              </button>
            ))}
          </div>

          {/* Price filter */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {PRICE_RANGES.map(({ id, label }) => (
              <button key={id} onClick={() => setPriceRange(id)}
                className={`px-3 py-1 rounded-full border text-[11px] whitespace-nowrap shrink-0 transition-all ${
                  priceRange === id ? 'bg-white/10 border-[rgba(201,169,110,0.18)] text-white' : 'border-[rgba(201,169,110,0.07)] text-white/30 hover:text-white/50'
                }`}>
                {label}
              </button>
            ))}
          </div>

          {/* Results */}
          {filtered.length === 0
            ? (
              <div className="text-center py-12 border border-[rgba(201,169,110,0.07)] rounded-2xl">
                <ShoppingBag className="w-8 h-8 text-white/10 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No programs match your filters</p>
              </div>
            )
            : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filtered.map(prog => (
                  <ProgramCard key={prog.id} prog={prog} owned={ownedIds.has(prog.id)} onSelect={() => setSelected(prog)} />
                ))}
              </div>
            )
          }
        </>
      )}

      {/* ── PURCHASED ── */}
      {view === 'purchased' && (
        purchases.length === 0
          ? (
            <div className="text-center py-12 border border-[rgba(201,169,110,0.07)] rounded-2xl">
              <Lock className="w-8 h-8 text-white/10 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No purchased plans yet</p>
              <button onClick={() => setView('browse')} className="mt-3 text-[#c9a96e] text-xs hover:text-[#e8c98a] flex items-center gap-1 mx-auto">
                Browse marketplace <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          )
          : (
            <div className="space-y-2">
              {purchases.map(p => {
                const prog = programs.find(pr => pr.id === p.marketplaceProgramId);
                return (
                  <div key={p.id || p.marketplaceProgramId} className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-xl px-4 py-3 flex items-center justify-between">
                    <div>
                      <p className="text-white/80 text-sm font-medium">{prog?.name || 'Program'}</p>
                      <p className="text-white/30 text-[11px] mt-0.5">
                        Purchased {new Date(p.purchasedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                        {' · '}£{p.price.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 text-green-400 text-[10px]">
                      <Lock className="w-3 h-3" /> Owned
                    </div>
                  </div>
                );
              })}
            </div>
          )
      )}

      {/* ── MY PLANS (trainer) ── */}
      {view === 'mine' && isTrainer && (
        <div className="space-y-4">
          {/* Revenue summary */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Revenue', value: `£${totalRevenue.toFixed(2)}`, Icon: DollarSign, color: 'text-green-400' },
              { label: 'Total Sales',   value: totalSales.toString(),          Icon: TrendingUp,  color: 'text-[#c9a96e]' },
              { label: 'Plans Listed',  value: myPublished.length.toString(),  Icon: Package,     color: 'text-sky-400'    },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-xl p-3 text-center">
                <Icon className={`w-4 h-4 mx-auto mb-1 ${color}`} />
                <p className={`font-bold text-sm ${color}`}>{value}</p>
                <p className="text-white/30 text-[9px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {myPublished.length === 0
            ? (
              <div className="text-center py-10 border border-[rgba(201,169,110,0.07)] rounded-2xl">
                <Package className="w-8 h-8 text-white/10 mx-auto mb-3" />
                <p className="text-white/40 text-sm">No published plans yet</p>
                <button onClick={() => setShowPublish(true)}
                  className="mt-3 flex items-center gap-1.5 bg-[#c9a96e] hover:bg-[#c9a96e] text-white text-xs font-medium px-3 py-1.5 rounded-xl transition-all mx-auto">
                  <Plus className="w-3.5 h-3.5" /> Publish Your First Plan
                </button>
              </div>
            )
            : (
              <div className="space-y-2">
                {myPublished.map(p => (
                  <div key={p.id} className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.07)] rounded-xl px-4 py-3 flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 text-sm font-medium truncate">{p.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <CategoryBadge category={p.category} />
                        <span className="text-white/30 text-[10px]">{p.purchases} sales</span>
                        {p.reviews > 0 && <span className="text-amber-400 text-[10px]">★ {p.rating.toFixed(1)}</span>}
                      </div>
                    </div>
                    <div className="text-right ml-3 shrink-0">
                      <p className="text-white font-semibold text-sm">{p.price === 0 ? 'Free' : `£${p.price.toFixed(2)}`}</p>
                      <p className="text-green-400 text-[10px]">£{(p.price * p.purchases).toFixed(2)} earned</p>
                    </div>
                  </div>
                ))}
              </div>
            )
          }
        </div>
      )}

      {/* Publish modal */}
      {showPublish && (
        <PublishModal
          onClose={() => setShowPublish(false)}
          onPublished={() => { setShowPublish(false); loadAll(); }}
        />
      )}
    </div>
  );
}
