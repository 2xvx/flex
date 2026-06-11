import { useState, useMemo } from "react";
import {
  Coins, CreditCard, Tag, ArrowUpRight, ArrowDownLeft, Dumbbell,
  Gift, Crown, Zap, Check, X, Star, ChevronRight, Clock,
  ShoppingBag, Trophy, Flame, Award, Copy, Users
} from "lucide-react";

// ─── TYPES ──────────────────────────────────────────────────────────────────
interface Transaction {
  id: string;
  type: "credit" | "debit";
  source: "workout" | "topup" | "coupon" | "purchase" | "gift" | "mission";
  label: string;
  amount: number;
  date: Date;
}

interface Mission {
  id: string;
  label: string;
  desc: string;
  reward: number;
  progress: number;
  total: number;
  icon: string;
  completed: boolean;
}

// ─── CONSTANTS ───────────────────────────────────────────────────────────────
const VIP_TIERS = [
  { name: "Bronze", min: 0,     color: "#cd7f32", next: 5000,  icon: "🥉",
    perks: ["Earn 1× FP per workout", "Access to all products"] },
  { name: "Silver", min: 5000,  color: "#c0c0c0", next: 15000, icon: "🥈",
    perks: ["Earn 1.25× FP per workout", "Early access to drops", "+5% on top-ups"] },
  { name: "Gold",   min: 15000, color: "#c9a96e", next: 40000, icon: "🥇",
    perks: ["Earn 1.5× FP per workout", "Exclusive colorways", "+10% on top-ups", "Free shipping"] },
  { name: "Elite",  min: 40000, color: "#a259ff", next: null,  icon: "💎",
    perks: ["Earn 2× FP per workout", "Personal shopper", "+15% on top-ups", "Free express shipping", "Early drops 24h early"] },
];

const TOP_UP_PACKS = [
  { id: "s", label: "Starter", fp: 500,  price: "$4.99",  bonus: 0 },
  { id: "m", label: "Popular", fp: 2000, price: "$14.99", bonus: 200, best: true },
  { id: "l", label: "Pro",     fp: 5000, price: "$29.99", bonus: 750 },
];

const MOCK_TRANSACTIONS: Transaction[] = [
  { id:"t1", type:"credit", source:"workout", label:"Chest day — 5 exercises", amount:75,   date: new Date(Date.now()-1000*60*30) },
  { id:"t2", type:"debit",  source:"purchase",label:"Obsidian Tee (M)",         amount:1200, date: new Date(Date.now()-1000*60*60*26) },
  { id:"t3", type:"credit", source:"topup",   label:"Top-up · Visa •••• 4242",  amount:2000, date: new Date(Date.now()-1000*60*60*72) },
  { id:"t4", type:"credit", source:"mission", label:"7-day streak bonus",        amount:300,  date: new Date(Date.now()-1000*60*60*96) },
  { id:"t5", type:"credit", source:"coupon",  label:'Coupon "FLEX2024"',         amount:500,  date: new Date(Date.now()-1000*60*60*120) },
  { id:"t6", type:"credit", source:"gift",    label:"Gift from @sara.lifts",     amount:200,  date: new Date(Date.now()-1000*60*60*168) },
  { id:"t7", type:"debit",  source:"purchase",label:"Gold Rush Hoodie (L)",      amount:3500, date: new Date(Date.now()-1000*60*60*240) },
  { id:"t8", type:"credit", source:"workout", label:"Leg day — 6 exercises",     amount:90,   date: new Date(Date.now()-1000*60*60*264) },
];

const MISSIONS: Mission[] = [
  { id:"m1", label:"Weekly warrior",   desc:"Complete 5 workouts this week",   reward:250, progress:3, total:5, icon:"🏋️", completed:false },
  { id:"m2", label:"Cardio king",      desc:"Log 3 cardio sessions",           reward:150, progress:3, total:3, icon:"🏃", completed:true  },
  { id:"m3", label:"Social butterfly", desc:"Like 10 posts from your feed",    reward:100, progress:6, total:10,icon:"❤️", completed:false },
  { id:"m4", label:"Streak master",    desc:"Maintain a 7-day workout streak", reward:500, progress:4, total:7, icon:"🔥", completed:false },
];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function timeAgo(d: Date): string {
  const secs = Math.floor((Date.now() - d.getTime()) / 1000);
  if (secs < 60) return "Just now";
  if (secs < 3600) return `${Math.floor(secs/60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs/3600)}h ago`;
  return `${Math.floor(secs/86400)}d ago`;
}

function getVipTier(spent: number) {
  let t = VIP_TIERS[0];
  for (const tier of VIP_TIERS) { if (spent >= tier.min) t = tier; }
  return t;
}

function txIcon(source: Transaction["source"]) {
  switch (source) {
    case "workout":  return <Dumbbell size={14} color="#4ade80" />;
    case "topup":    return <CreditCard size={14} color="#c9a96e" />;
    case "coupon":   return <Tag size={14} color="#a78bfa" />;
    case "purchase": return <ShoppingBag size={14} color="#fb923c" />;
    case "gift":     return <Gift size={14} color="#f472b6" />;
    case "mission":  return <Trophy size={14} color="#facc15" />;
  }
}

// ─── TABS ─────────────────────────────────────────────────────────────────────
type Tab = "overview" | "topup" | "missions" | "vip";

// ─── MAIN PAGE ───────────────────────────────────────────────────────────────
export function FlexWalletPage({ onNavigate }: { onNavigate: (v: string) => void }) {
  const [balance, setBalance]     = useState(4200);
  const [totalSpent, setTotalSpent] = useState(8400);
  const [tab, setTab]             = useState<Tab>("overview");
  const [coupon, setCoupon]       = useState("");
  const [couponMsg, setCouponMsg] = useState<{ok:boolean;msg:string}|null>(null);
  const [giftAmount, setGiftAmount] = useState(100);
  const [giftUser, setGiftUser]   = useState("");
  const [giftSent, setGiftSent]   = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS);
  const [missions, setMissions]   = useState<Mission[]>(MISSIONS);
  const [selectedPack, setSelectedPack] = useState<string|null>(null);
  const [payDone, setPayDone]     = useState(false);
  const [expiryDays]              = useState(142); // days until points expire

  const tier    = useMemo(() => getVipTier(totalSpent), [totalSpent]);
  const nextTier = useMemo(() => {
    const idx = VIP_TIERS.findIndex(t => t.name === tier.name);
    return idx < VIP_TIERS.length - 1 ? VIP_TIERS[idx + 1] : null;
  }, [tier]);

  function applyCoupon() {
    const valid: Record<string,number> = {
      "FLEX2024": 500, "NEWMEMBER": 300, "FLEXELITE": 1000
    };
    const reward = valid[coupon.toUpperCase()];
    if (reward) {
      setBalance(b => b + reward);
      setTransactions(prev => [{
        id: `coup-${Date.now()}`, type:"credit", source:"coupon",
        label: `Coupon "${coupon.toUpperCase()}"`, amount: reward, date: new Date()
      }, ...prev]);
      setCouponMsg({ ok:true, msg:`+${reward.toLocaleString()} FP added!` });
    } else {
      setCouponMsg({ ok:false, msg:"Invalid or already used coupon code." });
    }
    setCoupon("");
    setTimeout(() => setCouponMsg(null), 3000);
  }

  function buyPack(pack: typeof TOP_UP_PACKS[0]) {
    setSelectedPack(pack.id);
    setTimeout(() => {
      const total = pack.fp + pack.bonus;
      setBalance(b => b + total);
      setTransactions(prev => [{
        id: `top-${Date.now()}`, type:"credit", source:"topup",
        label: `Top-up ${pack.label} pack · ${total.toLocaleString()} FP`, amount: total, date: new Date()
      }, ...prev]);
      setPayDone(true);
      setTimeout(() => { setPayDone(false); setSelectedPack(null); }, 2500);
    }, 1200);
  }

  function sendGift() {
    if (!giftUser || giftAmount <= 0 || giftAmount > balance) return;
    setBalance(b => b - giftAmount);
    setTransactions(prev => [{
      id: `gift-${Date.now()}`, type:"debit", source:"gift",
      label: `Gift to @${giftUser}`, amount: giftAmount, date: new Date()
    }, ...prev]);
    setGiftSent(true);
    setTimeout(() => { setGiftSent(false); setGiftUser(""); setGiftAmount(100); }, 2500);
  }

  function claimMission(id: string) {
    const m = missions.find(x => x.id === id);
    if (!m || !m.completed) return;
    setBalance(b => b + m.reward);
    setTransactions(prev => [{
      id: `mis-${Date.now()}`, type:"credit", source:"mission",
      label: `Mission: ${m.label}`, amount: m.reward, date: new Date()
    }, ...prev]);
    setMissions(prev => prev.filter(x => x.id !== id));
  }

  const gold    = "#c9a96e";
  const cardBg  = "#0d0b08";
  const border  = "0.5px solid rgba(255,255,255,0.07)";
  const goldBorder = "0.5px solid rgba(201,169,110,0.15)";

  const TABS: {id:Tab; label:string}[] = [
    {id:"overview", label:"Overview"},
    {id:"topup",    label:"Top-up"},
    {id:"missions", label:"Missions"},
    {id:"vip",      label:"VIP"},
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#080608", color:"#fff",
      fontFamily:"system-ui, sans-serif", paddingBottom:50 }}>
      <div style={{ maxWidth:560, margin:"0 auto", padding:"20px 16px 0" }}>

        {/* header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <Coins size={20} color={gold} />
            <span style={{ fontSize:18, fontWeight:600 }}>Flex Wallet</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5,
            background:"rgba(201,169,110,0.08)", border:goldBorder,
            borderRadius:20, padding:"4px 10px" }}>
            <span style={{ fontSize:13 }}>{tier.icon}</span>
            <span style={{ fontSize:11, color:gold, fontWeight:500 }}>{tier.name}</span>
          </div>
        </div>
        <p style={{ fontSize:12, color:"rgba(255,255,255,0.3)", marginBottom:20 }}>
          Your Flex Points balance and activity
        </p>

        {/* balance hero */}
        <div style={{ background:cardBg, border:goldBorder, borderRadius:14,
          padding:"20px 20px 16px", marginBottom:20 }}>
          <p style={{ fontSize:11, color:"rgba(201,169,110,0.6)", marginBottom:6 }}>Current balance</p>
          <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
            <Coins size={24} color={gold} />
            <span style={{ fontSize:32, fontWeight:600, color:gold }}>{balance.toLocaleString()}</span>
            <span style={{ fontSize:14, color:"rgba(255,255,255,0.4)", paddingTop:6 }}>FP</span>
          </div>
          <p style={{ fontSize:12, color:"rgba(255,255,255,0.35)", marginBottom:14 }}>
            ≈ ${(balance / 100).toFixed(2)} value
          </p>
          <div style={{ display:"flex", gap:8 }}>
            <div style={{ flex:1, background:"rgba(255,255,255,0.04)", borderRadius:8,
              padding:"8px 12px", border }}>
              <p style={{ fontSize:10, color:"rgba(255,255,255,0.35)" }}>Total spent</p>
              <p style={{ fontSize:14, color:"#fff", fontWeight:500 }}>
                {totalSpent.toLocaleString()} FP
              </p>
            </div>
            <div style={{ flex:1, background:"rgba(255,255,255,0.04)", borderRadius:8,
              padding:"8px 12px", border }}>
              <p style={{ fontSize:10, color:"rgba(255,255,255,0.35)" }}>Points expire in</p>
              <p style={{ fontSize:14, color: expiryDays<30?"#f87171":"#fff", fontWeight:500 }}>
                {expiryDays} days
              </p>
            </div>
          </div>
          {expiryDays < 60 && (
            <div style={{ marginTop:10, background:"rgba(248,113,113,0.07)",
              border:"0.5px solid rgba(248,113,113,0.15)", borderRadius:8,
              padding:"6px 10px", display:"flex", alignItems:"center", gap:6 }}>
              <Clock size={12} color="#f87171" />
              <span style={{ fontSize:11, color:"#f87171" }}>
                Complete a mission to renew your points expiry!
              </span>
            </div>
          )}
        </div>

        {/* tabs */}
        <div style={{ display:"flex", gap:4, marginBottom:20,
          background:"rgba(255,255,255,0.04)", borderRadius:10, padding:4 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              flex:1, padding:"7px 0", borderRadius:7, fontSize:12, cursor:"pointer",
              fontWeight: tab===t.id ? 600 : 400,
              background: tab===t.id ? gold : "transparent",
              color: tab===t.id ? "#000" : "rgba(255,255,255,0.45)",
              border:"none",
            }}>{t.label}</button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {tab === "overview" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {/* quick actions */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
              <button onClick={() => setTab("topup")} style={{
                background:cardBg, border:goldBorder, borderRadius:12,
                padding:"14px 14px", display:"flex", alignItems:"center", gap:10,
                cursor:"pointer", textAlign:"left" }}>
                <div style={{ background:"rgba(201,169,110,0.1)", borderRadius:8, padding:8 }}>
                  <CreditCard size={18} color={gold} />
                </div>
                <div>
                  <p style={{ fontSize:13, color:"#fff", fontWeight:500, margin:0 }}>Top-up</p>
                  <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", margin:0 }}>Credit card</p>
                </div>
              </button>
              <button onClick={() => setTab("topup")} style={{
                background:cardBg, border, borderRadius:12,
                padding:"14px 14px", display:"flex", alignItems:"center", gap:10,
                cursor:"pointer", textAlign:"left" }}>
                <div style={{ background:"rgba(167,139,250,0.1)", borderRadius:8, padding:8 }}>
                  <Tag size={18} color="#a78bfa" />
                </div>
                <div>
                  <p style={{ fontSize:13, color:"#fff", fontWeight:500, margin:0 }}>Coupon</p>
                  <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", margin:0 }}>Enter code</p>
                </div>
              </button>
            </div>

            {/* gift points */}
            <div style={{ background:cardBg, border, borderRadius:12, padding:"14px 16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
                <Gift size={15} color="#f472b6" />
                <span style={{ fontSize:13, fontWeight:500, color:"#fff" }}>Gift Flex Points</span>
              </div>
              {giftSent ? (
                <div style={{ display:"flex", alignItems:"center", gap:6, color:"#4ade80", fontSize:13 }}>
                  <Check size={15} /> Gift sent successfully!
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                  <input value={giftUser} onChange={e=>setGiftUser(e.target.value)}
                    placeholder="@username"
                    style={{ background:"rgba(255,255,255,0.04)", border,
                      borderRadius:8, padding:"8px 12px", color:"#fff", fontSize:13,
                      outline:"none" }} />
                  <div style={{ display:"flex", gap:8 }}>
                    <input type="number" value={giftAmount} min={50} max={balance}
                      onChange={e=>setGiftAmount(Number(e.target.value))}
                      style={{ flex:1, background:"rgba(255,255,255,0.04)", border,
                        borderRadius:8, padding:"8px 12px", color:"#fff", fontSize:13,
                        outline:"none" }} />
                    <button onClick={sendGift} disabled={!giftUser || giftAmount > balance}
                      style={{ padding:"8px 16px", borderRadius:8, fontSize:12, cursor:"pointer",
                        background: giftUser && giftAmount<=balance ? "#f472b6" : "rgba(255,255,255,0.05)",
                        color: giftUser && giftAmount<=balance ? "#fff" : "rgba(255,255,255,0.25)",
                        border:"none", fontWeight:500 }}>
                      Send Gift
                    </button>
                  </div>
                  <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>
                    Min 50 FP · Balance: {balance.toLocaleString()} FP
                  </p>
                </div>
              )}
            </div>

            {/* transactions */}
            <div>
              <p style={{ fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.4)", marginBottom:10 }}>
                Recent transactions
              </p>
              <div style={{ background:cardBg, border, borderRadius:12, overflow:"hidden" }}>
                {transactions.slice(0,6).map((tx, i) => (
                  <div key={tx.id} style={{
                    display:"flex", justifyContent:"space-between", alignItems:"center",
                    padding:"12px 16px",
                    borderBottom: i<5 ? "0.5px solid rgba(255,255,255,0.05)" : "none",
                  }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                      <div style={{ background:"rgba(255,255,255,0.05)", borderRadius:8,
                        width:32, height:32, display:"flex", alignItems:"center", justifyContent:"center" }}>
                        {txIcon(tx.source)}
                      </div>
                      <div>
                        <p style={{ fontSize:12, color:"#fff", margin:0 }}>{tx.label}</p>
                        <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)", margin:0 }}>
                          {timeAgo(tx.date)}
                        </p>
                      </div>
                    </div>
                    <span style={{ fontSize:13, fontWeight:600,
                      color: tx.type==="credit" ? "#4ade80" : "#f87171" }}>
                      {tx.type==="credit"?"+":"-"}{tx.amount.toLocaleString()} FP
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={() => onNavigate("flex-store")} style={{
              width:"100%", padding:"13px 0", borderRadius:12,
              background:"rgba(201,169,110,0.08)", border:goldBorder,
              color:gold, fontSize:14, fontWeight:500, cursor:"pointer" }}>
              Browse Flex Store →
            </button>
          </div>
        )}

        {/* ── TOP-UP TAB ── */}
        {tab === "topup" && (
          <div style={{ display:"flex", flexDirection:"column", gap:16 }}>
            {/* packs */}
            <div>
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:10 }}>
                Choose a pack
              </p>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8 }}>
                {TOP_UP_PACKS.map(pack => (
                  <button key={pack.id} onClick={() => !payDone && buyPack(pack)}
                    style={{
                      padding:"14px 8px", borderRadius:12, cursor:"pointer", textAlign:"center",
                      background:cardBg,
                      border: pack.best ? `2px solid ${gold}` : border,
                      position:"relative", transition:"opacity 0.2s",
                      opacity: selectedPack && selectedPack!==pack.id ? 0.4 : 1,
                    }}>
                    {pack.best && (
                      <div style={{ position:"absolute", top:-8, left:"50%",
                        transform:"translateX(-50%)", background:gold,
                        color:"#000", fontSize:9, fontWeight:600,
                        padding:"2px 8px", borderRadius:20, whiteSpace:"nowrap" }}>
                        BEST VALUE
                      </div>
                    )}
                    <Coins size={18} color={gold} style={{ margin:"0 auto 6px" }} />
                    <p style={{ fontSize:15, fontWeight:600, color:gold, margin:"4px 0 2px" }}>
                      {pack.fp.toLocaleString()}
                    </p>
                    {pack.bonus > 0 && (
                      <p style={{ fontSize:10, color:"#4ade80", margin:"0 0 4px" }}>
                        +{pack.bonus} bonus
                      </p>
                    )}
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", margin:0 }}>{pack.label}</p>
                    {selectedPack===pack.id && payDone ? (
                      <p style={{ fontSize:12, color:"#4ade80", marginTop:4 }}>✓ Added!</p>
                    ) : selectedPack===pack.id ? (
                      <p style={{ fontSize:11, color:gold, marginTop:4 }}>Processing…</p>
                    ) : (
                      <p style={{ fontSize:13, fontWeight:500, color:"#fff", marginTop:6 }}>{pack.price}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* coupon */}
            <div style={{ background:cardBg, border, borderRadius:12, padding:"16px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:12 }}>
                <Tag size={15} color="#a78bfa" />
                <span style={{ fontSize:13, fontWeight:500, color:"#fff" }}>Redeem coupon code</span>
              </div>
              <div style={{ display:"flex", gap:8 }}>
                <input value={coupon} onChange={e=>setCoupon(e.target.value)}
                  onKeyDown={e=>e.key==="Enter"&&applyCoupon()}
                  placeholder="e.g. FLEX2024"
                  style={{ flex:1, background:"rgba(255,255,255,0.04)", border,
                    borderRadius:8, padding:"9px 12px", color:"#fff", fontSize:13,
                    outline:"none", textTransform:"uppercase", letterSpacing:1 }} />
                <button onClick={applyCoupon} style={{
                  padding:"9px 16px", borderRadius:8, background:"rgba(167,139,250,0.12)",
                  border:"0.5px solid rgba(167,139,250,0.2)", color:"#a78bfa",
                  fontSize:13, fontWeight:500, cursor:"pointer" }}>
                  Apply
                </button>
              </div>
              {couponMsg && (
                <div style={{ marginTop:8, display:"flex", alignItems:"center", gap:5,
                  color: couponMsg.ok ? "#4ade80" : "#f87171", fontSize:12 }}>
                  {couponMsg.ok ? <Check size={13}/> : <X size={13}/>}
                  {couponMsg.msg}
                </div>
              )}
              <p style={{ fontSize:11, color:"rgba(255,255,255,0.25)", marginTop:8 }}>
                Try: FLEX2024 · NEWMEMBER · FLEXELITE
              </p>
            </div>

            {/* payment note */}
            <div style={{ background:"rgba(255,255,255,0.03)", borderRadius:10, padding:"10px 14px" }}>
              <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)", lineHeight:1.6, margin:0 }}>
                🔒 Payments processed securely via Stripe. Points are added instantly.
                1 Flex Point ≈ $0.01 USD. Non-refundable.
              </p>
            </div>
          </div>
        )}

        {/* ── MISSIONS TAB ── */}
        {tab === "missions" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:"rgba(250,204,21,0.06)", border:"0.5px solid rgba(250,204,21,0.12)",
              borderRadius:10, padding:"10px 14px", marginBottom:4 }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                <Flame size={14} color="#facc15" />
                <span style={{ fontSize:13, color:"#facc15", fontWeight:500 }}>Weekly Missions</span>
              </div>
              <p style={{ fontSize:12, color:"rgba(250,204,21,0.6)", margin:0 }}>
                Complete missions to earn bonus FP and renew your points expiry clock.
              </p>
            </div>

            {missions.map(m => (
              <div key={m.id} style={{ background:cardBg, border, borderRadius:12, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:10 }}>
                  <div style={{ display:"flex", gap:10, alignItems:"center" }}>
                    <span style={{ fontSize:22 }}>{m.icon}</span>
                    <div>
                      <p style={{ fontSize:13, fontWeight:500, color:"#fff", margin:"0 0 2px" }}>
                        {m.label}
                      </p>
                      <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", margin:0 }}>{m.desc}</p>
                    </div>
                  </div>
                  <div style={{ display:"flex", alignItems:"center", gap:4,
                    background:"rgba(201,169,110,0.08)", border:goldBorder,
                    borderRadius:20, padding:"3px 8px", flexShrink:0 }}>
                    <Coins size={11} color={gold} />
                    <span style={{ fontSize:11, color:gold, fontWeight:500 }}>+{m.reward}</span>
                  </div>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                  <div style={{ flex:1, height:5, background:"rgba(255,255,255,0.06)", borderRadius:4 }}>
                    <div style={{ height:5, borderRadius:4,
                      background: m.completed ? "#4ade80" : gold,
                      width:`${Math.min(100, m.progress/m.total*100)}%`,
                      transition:"width 0.4s" }} />
                  </div>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)", flexShrink:0 }}>
                    {m.progress}/{m.total}
                  </span>
                  {m.completed && (
                    <button onClick={() => claimMission(m.id)} style={{
                      padding:"4px 12px", borderRadius:20, fontSize:11, fontWeight:600,
                      background:"#4ade80", color:"#000", border:"none", cursor:"pointer" }}>
                      Claim!
                    </button>
                  )}
                </div>
              </div>
            ))}

            {missions.length === 0 && (
              <div style={{ textAlign:"center", padding:"40px 0" }}>
                <Trophy size={36} color="rgba(250,204,21,0.3)" style={{ margin:"0 auto 10px" }} />
                <p style={{ color:"rgba(255,255,255,0.3)" }}>All missions completed! New missions next week.</p>
              </div>
            )}
          </div>
        )}

        {/* ── VIP TAB ── */}
        {tab === "vip" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:cardBg, border:goldBorder, borderRadius:12,
              padding:"16px", marginBottom:4, textAlign:"center" }}>
              <span style={{ fontSize:36 }}>{tier.icon}</span>
              <p style={{ fontSize:18, fontWeight:600, color:tier.color, margin:"6px 0 2px" }}>
                {tier.name} Member
              </p>
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>
                {totalSpent.toLocaleString()} FP total spent
              </p>
              {nextTier && (
                <>
                  <div style={{ height:6, background:"rgba(255,255,255,0.06)",
                    borderRadius:4, margin:"12px 0 4px" }}>
                    <div style={{ height:6, borderRadius:4, background:gold,
                      width:`${Math.min(100,(totalSpent-tier.min)/(nextTier.min-tier.min)*100)}%` }} />
                  </div>
                  <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>
                    {(nextTier.min-totalSpent).toLocaleString()} FP to {nextTier.name} {nextTier.icon}
                  </p>
                </>
              )}
            </div>

            {VIP_TIERS.map(t => {
              const active = t.name === tier.name;
              const unlocked = totalSpent >= t.min;
              return (
                <div key={t.name} style={{ background:cardBg, borderRadius:12, padding:"14px 16px",
                  border: active ? `1px solid ${t.color}` : border,
                  opacity: unlocked ? 1 : 0.45 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <span style={{ fontSize:20 }}>{t.icon}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <span style={{ fontSize:14, fontWeight:600, color:t.color }}>{t.name}</span>
                        {active && <span style={{ fontSize:10, background:`${t.color}22`,
                          color:t.color, borderRadius:20, padding:"1px 8px", fontWeight:500 }}>
                          Current
                        </span>}
                      </div>
                      <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)", margin:0 }}>
                        {t.min.toLocaleString()}+ FP spent
                      </p>
                    </div>
                    {!unlocked && <span style={{ fontSize:11, color:"rgba(255,255,255,0.2)" }}>🔒</span>}
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {t.perks.map(perk => (
                      <div key={perk} style={{ display:"flex", alignItems:"center", gap:6 }}>
                        <Check size={12} color={unlocked ? t.color : "rgba(255,255,255,0.15)"} />
                        <span style={{ fontSize:12, color: unlocked ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)" }}>
                          {perk}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
