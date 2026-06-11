// GroceryListPage.tsx — generates a weekly grocery list from saved meals, grouped by aisle

import { useState, useEffect, useCallback } from 'react';
import { ShoppingCart, Check, Plus, X, ChevronDown, ChevronUp, RefreshCw, Copy, Loader2 } from 'lucide-react';
import { authFetch } from '../../utils/authToken';
import { toast } from 'sonner';
import { User } from '../types';

interface Props { currentUser: User | null; }

import { API } from '../../config';

interface GroceryItem { name: string; checked: boolean; custom?: boolean; aisle: string; }

// ── Aisle classifier ──────────────────────────────────────────────────────────
const AISLES: { id: string; label: string; emoji: string; keywords: string[] }[] = [
  { id: 'produce',   label: 'Produce',          emoji: '🥦', keywords: ['spinach','kale','broccoli','lettuce','tomato','cucumber','pepper','onion','garlic','apple','banana','berry','berries','avocado','lemon','lime','carrot','celery','zucchini','mushroom','ginger','herb','basil','parsley','cilantro','arugula','beetroot','sweet potato','potato','cabbage','cauliflower','peas','corn'] },
  { id: 'protein',   label: 'Protein & Meat',   emoji: '🥩', keywords: ['chicken','beef','turkey','salmon','tuna','shrimp','egg','tofu','tempeh','pork','steak','cod','tilapia','sardine','lamb','bacon','sausage','ground beef','ground turkey','whey','protein powder'] },
  { id: 'dairy',     label: 'Dairy & Eggs',     emoji: '🥛', keywords: ['milk','yogurt','cheese','butter','cream','cottage','mozzarella','cheddar','parmesan','greek yogurt','eggs','kefir','ghee'] },
  { id: 'grains',    label: 'Grains & Bread',   emoji: '🌾', keywords: ['rice','oat','oats','quinoa','bread','pasta','flour','tortilla','wrap','noodle','barley','bulgur','couscous','cracker','cereal','bagel','pita'] },
  { id: 'pantry',    label: 'Pantry & Canned',  emoji: '🥫', keywords: ['bean','beans','lentil','chickpea','tomato sauce','broth','stock','coconut milk','olive oil','oil','vinegar','soy sauce','tahini','peanut butter','almond butter','honey','maple','salt','pepper','cumin','turmeric','paprika','cinnamon','oregano','thyme','cayenne','baking','sugar','nut','nuts','almond','walnut','cashew','seed','seeds','chia','flax'] },
  { id: 'frozen',    label: 'Frozen',            emoji: '🧊', keywords: ['frozen','ice cream','edamame'] },
  { id: 'drinks',    label: 'Drinks',            emoji: '🧃', keywords: ['coffee','tea','juice','water','almond milk','oat milk','soy milk','coconut water','smoothie'] },
];

function classifyItem(name: string): string {
  const lower = name.toLowerCase();
  for (const aisle of AISLES) {
    if (aisle.keywords.some(k => lower.includes(k))) return aisle.id;
  }
  return 'other';
}

function extractIngredients(meals: any[]): string[] {
  const raw: string[] = [];
  for (const meal of meals) {
    for (const ing of (meal.ingredients || [])) {
      const cleaned = String(ing).trim().replace(/^\d[\d./]*\s*(g|kg|ml|l|oz|lb|cup|tbsp|tsp|piece|slice|clove|bunch|handful|pinch|can|pack|serving)s?\s*/i, '').trim();
      if (cleaned.length > 1) raw.push(cleaned);
    }
  }
  // Deduplicate (case-insensitive)
  const seen = new Set<string>();
  return raw.filter(i => {
    const key = i.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function GroceryListPage({ currentUser }: Props) {
  const [items,      setItems]      = useState<GroceryItem[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [newItem,    setNewItem]    = useState('');
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set(AISLES.map(a => a.id).concat('other')));
  const [generated,  setGenerated]  = useState(false);

  const generate = useCallback(async () => {
    if (!currentUser) return;
    setLoading(true);
    try {
      const res  = await authFetch(`${API}/meals/saved`);
      const data = await res.json();
      const meals: any[] = data.meals || [];

      if (meals.length === 0) {
        toast.error('No saved meals found — save some meals first!');
        setLoading(false);
        return;
      }

      const ingredients = extractIngredients(meals);
      const newItems: GroceryItem[] = ingredients.map(name => ({
        name, checked: false, aisle: classifyItem(name),
      }));

      setItems(newItems);
      setGenerated(true);
      toast.success(`${newItems.length} items from ${meals.length} saved meals 🛒`);
    } catch {
      toast.error('Failed to load meals');
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  const toggleItem = (idx: number) =>
    setItems(prev => prev.map((it, i) => i === idx ? { ...it, checked: !it.checked } : it));

  const removeItem = (idx: number) =>
    setItems(prev => prev.filter((_, i) => i !== idx));

  const addCustom = () => {
    if (!newItem.trim()) return;
    setItems(prev => [...prev, { name: newItem.trim(), checked: false, custom: true, aisle: classifyItem(newItem) }]);
    setNewItem('');
  };

  const clearChecked = () => setItems(prev => prev.filter(it => !it.checked));

  const toggleAisle = (id: string) =>
    setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const copyList = () => {
    const text = groupedAisles
      .map(({ aisle, aisle: { label }, items: its }) =>
        `${label}\n${its.map(it => `  ${it.checked ? '✓' : '☐'} ${it.name}`).join('\n')}`)
      .join('\n\n');
    navigator.clipboard.writeText(text).then(() => toast.success('List copied!'));
  };

  // Group items by aisle
  const allAisleIds = [...AISLES.map(a => a.id), 'other'];
  const groupedAisles = allAisleIds
    .map(id => {
      const aisle = AISLES.find(a => a.id === id) ?? { id: 'other', label: 'Other', emoji: '🛒', keywords: [] };
      return { aisle, items: items.filter(it => it.aisle === id) };
    })
    .filter(g => g.items.length > 0);

  const totalItems   = items.length;
  const checkedItems = items.filter(it => it.checked).length;

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-white font-bold text-xl">Grocery List 🛒</h2>
          <p className="text-white/40 text-sm mt-0.5">Generated from your saved meals</p>
        </div>
        {generated && (
          <span className="text-white/30 text-xs mt-1">{checkedItems}/{totalItems} done</span>
        )}
      </div>

      {/* Generate / Re-generate */}
      {!generated ? (
        <div className="flex flex-col items-center gap-4 py-10">
          <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
            <ShoppingCart className="w-7 h-7 text-green-400" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-white font-semibold">Build Your List</p>
            <p className="text-white/35 text-sm max-w-xs">We'll pull ingredients from all your saved meals and group them by aisle.</p>
          </div>
          <button
            onClick={generate}
            disabled={loading || !currentUser}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold text-sm transition-all"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShoppingCart className="w-4 h-4" />}
            Generate from Saved Meals
          </button>
        </div>
      ) : (
        <>
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="h-2 bg-[rgba(201,169,110,0.06)] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-green-500 to-emerald-400 rounded-full transition-all duration-500"
                style={{ width: `${totalItems > 0 ? (checkedItems / totalItems) * 100 : 0}%` }}
              />
            </div>
            {checkedItems === totalItems && totalItems > 0 && (
              <p className="text-green-400 text-xs font-semibold text-center">All items collected! 🎉</p>
            )}
          </div>

          {/* Actions row */}
          <div className="flex items-center gap-2">
            <button onClick={generate} disabled={loading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white/40 hover:text-white text-xs transition-all">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Regenerate
            </button>
            <button onClick={clearChecked} disabled={checkedItems === 0} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white/40 hover:text-white disabled:opacity-30 text-xs transition-all">
              <X className="w-3.5 h-3.5" /> Clear checked
            </button>
            <button onClick={copyList} className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] text-white/40 hover:text-white text-xs transition-all">
              <Copy className="w-3.5 h-3.5" /> Copy
            </button>
          </div>

          {/* Aisle groups */}
          {groupedAisles.map(({ aisle, items: aisleItems }) => {
            const isExpanded = expanded.has(aisle.id);
            const doneInAisle = aisleItems.filter(it => it.checked).length;
            return (
              <div key={aisle.id} className="bg-[rgba(201,169,110,0.03)] border border-[rgba(201,169,110,0.06)] rounded-2xl overflow-hidden">
                <button
                  onClick={() => toggleAisle(aisle.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[rgba(201,169,110,0.03)] transition-all"
                >
                  <span className="text-base">{aisle.emoji}</span>
                  <span className="text-white font-medium text-sm flex-1 text-left">{aisle.label}</span>
                  <span className="text-white/30 text-xs">{doneInAisle}/{aisleItems.length}</span>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
                </button>

                {isExpanded && (
                  <div className="border-t border-[rgba(201,169,110,0.08)] divide-y divide-white/4">
                    {aisleItems.map((item, localIdx) => {
                      const globalIdx = items.findIndex(it => it === item);
                      return (
                        <div
                          key={localIdx}
                          className={`flex items-center gap-3 px-4 py-2.5 transition-all ${item.checked ? 'opacity-40' : ''}`}
                        >
                          <button
                            onClick={() => toggleItem(globalIdx)}
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-all ${
                              item.checked ? 'bg-green-500 border-green-500' : 'border-white/25 hover:border-green-400'
                            }`}
                          >
                            {item.checked && <Check className="w-3 h-3 text-white" />}
                          </button>
                          <span className={`text-sm flex-1 ${item.checked ? 'line-through text-white/30' : 'text-white/80'}`}>
                            {item.name}
                          </span>
                          {item.custom && <span className="text-white/20 text-[10px]">custom</span>}
                          <button onClick={() => removeItem(globalIdx)} className="text-white/15 hover:text-red-400 transition-colors">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}

          {/* Add custom item */}
          <div className="flex gap-2">
            <input
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addCustom()}
              placeholder="Add item manually…"
              className="flex-1 bg-[rgba(201,169,110,0.04)] border border-[rgba(201,169,110,0.12)] rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-white/25 focus:outline-none focus:border-green-500/50"
            />
            <button
              onClick={addCustom}
              className="px-4 py-2.5 bg-green-600/80 hover:bg-green-600 text-white rounded-xl text-sm font-medium transition-all"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </>
      )}
    </div>
  );
}
