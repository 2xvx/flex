import { useState, useMemo } from "react";
import {
  Package, BarChart2, ShoppingCart, Zap, Settings, Coins,
  Plus, Edit2, Trash2, X, Check, Clock, TrendingUp, Eye,
  Truck, AlertCircle, ChevronRight, Upload, Star, Users,
  ArrowUpRight, Tag, ToggleLeft, ToggleRight
} from "lucide-react";

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface StoreProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  sizes: string[];
  image: string;
  isLimited: boolean;
  dropEndsAt?: string;
  views: number;
  sales: number;
  active: boolean;
}

interface Order {
  id: string;
  buyer: string;
  product: string;
  size: string;
  amount: number;
  status: "pending" | "shipped" | "delivered";
  date: Date;
  tracking?: string;
}

// ─── MOCK DATA ────────────────────────────────────────────────────────────────
const MOCK_PRODUCTS: StoreProduct[] = [
  { id:"sp1", name:"Obsidian Tee", category:"T-Shirts", price:1200, stock:34, sizes:["S","M","L","XL"], image:"👕", isLimited:false, views:892, sales:58, active:true },
  { id:"sp2", name:"Gold Rush Hoodie", category:"Hoodies", price:3500, stock:8, sizes:["M","L","XL"], image:"🧥", isLimited:true, dropEndsAt:"2026-06-05", views:2341, sales:12, active:true },
  { id:"sp3", name:"Elite Shorts", category:"Shorts", price:900, stock:0, sizes:["S","M","L","XL","XXL"], image:"🩳", isLimited:false, views:445, sales:30, active:false },
  { id:"sp4", name:"Beast Cap", category:"Accessories", price:600, stock:22, sizes:["One Size"], image:"🧢", isLimited:false, views:310, sales:19, active:true },
];

const MOCK_ORDERS: Order[] = [
  { id:"o1", buyer:"@marcus.lifts", product:"Gold Rush Hoodie", size:"L", amount:3500, status:"pending", date:new Date(Date.now()-1000*60*40) },
  { id:"o2", buyer:"@sara_fit", product:"Obsidian Tee", size:"M", amount:1200, status:"shipped", date:new Date(Date.now()-1000*60*60*5), tracking:"TRK928374" },
  { id:"o3", buyer:"@coach_ali", product:"Beast Cap", size:"One Size", amount:600, status:"delivered", date:new Date(Date.now()-1000*60*60*28) },
  { id:"o4", buyer:"@james.gains", product:"Obsidian Tee", size:"XL", amount:1200, status:"pending", date:new Date(Date.now()-1000*60*60*2) },
  { id:"o5", buyer:"@rina.strong", product:"Elite Shorts", size:"S", amount:900, status:"delivered", date:new Date(Date.now()-1000*60*60*72) },
];

const CATEGORIES = ["T-Shirts","Hoodies","Shorts","Pants","Accessories","Equipment","Supplements"];

function timeAgo(d: Date) {
  const s = Math.floor((Date.now()-d.getTime())/1000);
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  if (s < 86400) return `${Math.floor(s/3600)}h ago`;
  return `${Math.floor(s/86400)}d ago`;
}

type Tab = "products"|"analytics"|"orders"|"drops"|"profile"|"earnings";

// ─── PRODUCT FORM ─────────────────────────────────────────────────────────────
function ProductForm({ initial, onSave, onCancel }: {
  initial?: Partial<StoreProduct>;
  onSave: (p: StoreProduct) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    name: initial?.name || "",
    category: initial?.category || "T-Shirts",
    price: initial?.price || 500,
    stock: initial?.stock || 10,
    sizes: (initial?.sizes || ["S","M","L","XL"]).join(", "),
    image: initial?.image || "👕",
    isLimited: initial?.isLimited || false,
    dropEndsAt: initial?.dropEndsAt || "",
    active: initial?.active !== false,
  });

  function submit() {
    if (!form.name.trim()) return;
    onSave({
      id: initial?.id || `sp-${Date.now()}`,
      name: form.name,
      category: form.category,
      price: Number(form.price),
      stock: Number(form.stock),
      sizes: form.sizes.split(",").map(s=>s.trim()).filter(Boolean),
      image: form.image,
      isLimited: form.isLimited,
      dropEndsAt: form.dropEndsAt || undefined,
      views: initial?.views || 0,
      sales: initial?.sales || 0,
      active: form.active,
    });
  }

  const gold = "#c9a96e";
  const inp: React.CSSProperties = {
    width:"100%", background:"rgba(255,255,255,0.04)",
    border:"0.5px solid rgba(255,255,255,0.1)", borderRadius:8,
    padding:"9px 12px", color:"#fff", fontSize:13, outline:"none",
    boxSizing:"border-box",
  };
  const lbl: React.CSSProperties = { fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:4, display:"block" };

  return (
    <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
        <div style={{ gridColumn:"1/-1" }}>
          <span style={lbl}>Product name</span>
          <input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="e.g. Obsidian Tee" />
        </div>
        <div>
          <span style={lbl}>Category</span>
          <select style={{...inp}} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
            {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <span style={lbl}>Image (emoji)</span>
          <input style={inp} value={form.image} onChange={e=>setForm(f=>({...f,image:e.target.value}))} maxLength={2} />
        </div>
        <div>
          <span style={lbl}>Price (Flex Points)</span>
          <input style={inp} type="number" value={form.price} min={100} onChange={e=>setForm(f=>({...f,price:Number(e.target.value)}))} />
        </div>
        <div>
          <span style={lbl}>Stock quantity</span>
          <input style={inp} type="number" value={form.stock} min={0} onChange={e=>setForm(f=>({...f,stock:Number(e.target.value)}))} />
        </div>
        <div style={{ gridColumn:"1/-1" }}>
          <span style={lbl}>Sizes (comma-separated)</span>
          <input style={inp} value={form.sizes} onChange={e=>setForm(f=>({...f,sizes:e.target.value}))} placeholder="S, M, L, XL" />
        </div>
      </div>

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        background:"rgba(255,255,255,0.04)", borderRadius:8, padding:"10px 14px" }}>
        <div>
          <p style={{ fontSize:13, color:"#fff", margin:0 }}>Limited drop</p>
          <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)", margin:0 }}>Shows countdown timer on product</p>
        </div>
        <button onClick={()=>setForm(f=>({...f,isLimited:!f.isLimited}))} style={{ background:"none", border:"none", cursor:"pointer" }}>
          {form.isLimited
            ? <ToggleRight size={28} color={gold} />
            : <ToggleLeft size={28} color="rgba(255,255,255,0.2)" />}
        </button>
      </div>

      {form.isLimited && (
        <div>
          <span style={lbl}>Drop ends at (date)</span>
          <input style={inp} type="date" value={form.dropEndsAt} onChange={e=>setForm(f=>({...f,dropEndsAt:e.target.value}))} />
        </div>
      )}

      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        background:"rgba(255,255,255,0.04)", borderRadius:8, padding:"10px 14px" }}>
        <div>
          <p style={{ fontSize:13, color:"#fff", margin:0 }}>Active / visible</p>
          <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)", margin:0 }}>Hidden products won't appear in Flex Store</p>
        </div>
        <button onClick={()=>setForm(f=>({...f,active:!f.active}))} style={{ background:"none", border:"none", cursor:"pointer" }}>
          {form.active
            ? <ToggleRight size={28} color="#4ade80" />
            : <ToggleLeft size={28} color="rgba(255,255,255,0.2)" />}
        </button>
      </div>

      <div style={{ display:"flex", gap:8, marginTop:4 }}>
        <button onClick={submit} style={{ flex:1, padding:"11px 0", borderRadius:8,
          background:gold, color:"#000", border:"none", fontSize:13, fontWeight:600, cursor:"pointer" }}>
          Save product
        </button>
        <button onClick={onCancel} style={{ padding:"11px 20px", borderRadius:8,
          background:"rgba(255,255,255,0.05)", color:"rgba(255,255,255,0.6)",
          border:"0.5px solid rgba(255,255,255,0.1)", fontSize:13, cursor:"pointer" }}>
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────
export function StoreDashboard({ currentUser, onNavigate }: {
  currentUser: any;
  onNavigate: (v: string) => void;
}) {
  const [tab, setTab] = useState<Tab>("products");
  const [products, setProducts] = useState<StoreProduct[]>(MOCK_PRODUCTS);
  const [orders, setOrders] = useState<Order[]>(MOCK_ORDERS);
  const [editingProduct, setEditingProduct] = useState<StoreProduct | null>(null);
  const [addingProduct, setAddingProduct] = useState(false);
  const [trackingInput, setTrackingInput] = useState<Record<string,string>>({});
  const [fpBalance] = useState(18740);
  const [storeProfile, setStoreProfile] = useState({
    name: currentUser?.storeName || "My Store",
    category: currentUser?.storeCategory || "Clothing",
    bio: currentUser?.storeBio || "Premium gym clothing for elite athletes.",
    logo: "🏪",
    banner: "#1a1208",
    shipping: "Ships within 3–5 business days.",
    instagram: "",
    approved: currentUser?.storeApproved ?? true,
  });
  const [profileEditing, setProfileEditing] = useState(false);

  const gold = "#c9a96e";
  const cardBg = "#0d0b08";
  const border = "0.5px solid rgba(255,255,255,0.07)";
  const goldBorder = "0.5px solid rgba(201,169,110,0.15)";

  const stats = useMemo(() => ({
    totalSales: products.reduce((s,p)=>s+p.sales,0),
    totalRevenue: products.reduce((s,p)=>s+p.sales*p.price,0),
    totalViews: products.reduce((s,p)=>s+p.views,0),
    pendingOrders: orders.filter(o=>o.status==="pending").length,
  }), [products, orders]);

  function saveProduct(p: StoreProduct) {
    if (editingProduct) {
      setProducts(prev=>prev.map(x=>x.id===p.id?p:x));
      setEditingProduct(null);
    } else {
      setProducts(prev=>[p,...prev]);
      setAddingProduct(false);
    }
  }

  function deleteProduct(id: string) {
    setProducts(prev=>prev.filter(p=>p.id!==id));
  }

  function markShipped(orderId: string) {
    const tracking = trackingInput[orderId] || "";
    setOrders(prev=>prev.map(o=>o.id===orderId?{...o,status:"shipped",tracking}:o));
  }

  const TABS: {id:Tab; label:string; icon:React.ReactNode}[] = [
    { id:"products",  label:"Products",  icon:<Package size={14}/> },
    { id:"analytics", label:"Analytics", icon:<BarChart2 size={14}/> },
    { id:"orders",    label:"Orders",    icon:<ShoppingCart size={14}/> },
    { id:"drops",     label:"Flash Drops",icon:<Zap size={14}/> },
    { id:"earnings",  label:"Earnings",  icon:<Coins size={14}/> },
    { id:"profile",   label:"Profile",   icon:<Settings size={14}/> },
  ];

  return (
    <div style={{ minHeight:"100vh", background:"#080608", color:"#fff",
      fontFamily:"system-ui,sans-serif", paddingBottom:50 }}>
      <div style={{ maxWidth:620, margin:"0 auto", padding:"20px 16px 0" }}>

        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:4 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ fontSize:22 }}>{storeProfile.logo}</span>
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                <span style={{ fontSize:17, fontWeight:600 }}>{storeProfile.name}</span>
                {storeProfile.approved && (
                  <div style={{ background:"rgba(201,169,110,0.12)", borderRadius:20,
                    padding:"1px 7px", display:"flex", alignItems:"center", gap:3 }}>
                    <Check size={10} color={gold} />
                    <span style={{ fontSize:10, color:gold, fontWeight:500 }}>Verified</span>
                  </div>
                )}
              </div>
              <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)", margin:0 }}>Store Dashboard</p>
            </div>
          </div>
          <button onClick={()=>onNavigate("flex-store")} style={{
            background:"rgba(201,169,110,0.08)", border:goldBorder,
            borderRadius:8, padding:"6px 12px", fontSize:11, color:gold, cursor:"pointer" }}>
            View in Store
          </button>
        </div>

        {/* Pending banner */}
        {!storeProfile.approved && (
          <div style={{ background:"rgba(251,191,36,0.07)", border:"0.5px solid rgba(251,191,36,0.2)",
            borderRadius:10, padding:"10px 14px", margin:"16px 0",
            display:"flex", alignItems:"center", gap:8 }}>
            <AlertCircle size={15} color="#fbbf24" />
            <span style={{ fontSize:12, color:"#fbbf24" }}>
              Your store is pending admin approval. Products won't be visible until approved.
            </span>
          </div>
        )}

        {/* Stat pills */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, margin:"16px 0" }}>
          {[
            { label:"Total sales", value:stats.totalSales },
            { label:"Revenue (FP)", value:stats.totalRevenue.toLocaleString() },
            { label:"Total views", value:stats.totalViews.toLocaleString() },
            { label:"Pending orders", value:stats.pendingOrders },
          ].map(s=>(
            <div key={s.label} style={{ background:cardBg, border, borderRadius:10, padding:"10px 10px" }}>
              <p style={{ fontSize:10, color:"rgba(255,255,255,0.35)", margin:"0 0 3px" }}>{s.label}</p>
              <p style={{ fontSize:16, fontWeight:600, color:gold, margin:0 }}>{s.value}</p>
            </div>
          ))}
        </div>

        {/* Tab bar */}
        <div style={{ display:"flex", gap:4, overflowX:"auto", paddingBottom:2, marginBottom:20,
          scrollbarWidth:"none" }}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{
              whiteSpace:"nowrap", display:"flex", alignItems:"center", gap:5,
              padding:"7px 12px", borderRadius:8, fontSize:12, cursor:"pointer",
              fontWeight: tab===t.id ? 500 : 400,
              background: tab===t.id ? gold : "rgba(255,255,255,0.04)",
              color: tab===t.id ? "#000" : "rgba(255,255,255,0.45)",
              border:"none", flexShrink:0,
            }}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* ── PRODUCTS TAB ── */}
        {tab==="products" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            {(addingProduct || editingProduct) ? (
              <div style={{ background:cardBg, border, borderRadius:12, padding:"16px 16px" }}>
                <p style={{ fontSize:14, fontWeight:500, color:"#fff", marginBottom:16 }}>
                  {editingProduct ? "Edit product" : "Add new product"}
                </p>
                <ProductForm
                  initial={editingProduct || undefined}
                  onSave={saveProduct}
                  onCancel={()=>{ setEditingProduct(null); setAddingProduct(false); }}
                />
              </div>
            ) : (
              <button onClick={()=>setAddingProduct(true)} style={{
                width:"100%", padding:"11px 0", borderRadius:10,
                background:"rgba(201,169,110,0.08)", border:goldBorder,
                color:gold, fontSize:13, fontWeight:500, cursor:"pointer",
                display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
                <Plus size={15}/> Add new product
              </button>
            )}

            {products.map(p=>(
              <div key={p.id} style={{ background:cardBg, border, borderRadius:12,
                padding:"12px 14px", opacity: p.active ? 1 : 0.5 }}>
                <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                  <div style={{ background:"#1a1208", borderRadius:8, width:44, height:44,
                    display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, flexShrink:0 }}>
                    {p.image}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:2 }}>
                      <span style={{ fontSize:13, fontWeight:500, color:"#fff" }}>{p.name}</span>
                      {p.isLimited && <span style={{ fontSize:10, background:"rgba(255,80,80,0.12)",
                        color:"#ff9090", borderRadius:20, padding:"1px 6px" }}>Limited</span>}
                      {!p.active && <span style={{ fontSize:10, background:"rgba(255,255,255,0.05)",
                        color:"rgba(255,255,255,0.3)", borderRadius:20, padding:"1px 6px" }}>Hidden</span>}
                    </div>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", margin:0 }}>
                      {p.category} · {p.stock} in stock
                    </p>
                    <div style={{ display:"flex", gap:10, marginTop:4 }}>
                      <span style={{ fontSize:11, color:gold }}>{p.price.toLocaleString()} FP</span>
                      <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{p.sales} sold</span>
                      <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{p.views} views</span>
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:6, flexShrink:0 }}>
                    <button onClick={()=>setEditingProduct(p)} style={{
                      background:"rgba(255,255,255,0.05)", border, borderRadius:7,
                      width:30, height:30, display:"flex", alignItems:"center",
                      justifyContent:"center", cursor:"pointer" }}>
                      <Edit2 size={13} color="rgba(255,255,255,0.6)" />
                    </button>
                    <button onClick={()=>deleteProduct(p.id)} style={{
                      background:"rgba(255,80,80,0.06)", border:"0.5px solid rgba(255,80,80,0.15)",
                      borderRadius:7, width:30, height:30, display:"flex", alignItems:"center",
                      justifyContent:"center", cursor:"pointer" }}>
                      <Trash2 size={13} color="#ff9090" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── ANALYTICS TAB ── */}
        {tab==="analytics" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:cardBg, border, borderRadius:12, padding:"16px" }}>
              <p style={{ fontSize:13, fontWeight:500, color:"#fff", marginBottom:16 }}>Top products</p>
              {[...products].sort((a,b)=>b.sales-a.sales).map((p,i)=>(
                <div key={p.id} style={{ display:"flex", alignItems:"center", gap:10,
                  padding:"8px 0", borderBottom: i<products.length-1?"0.5px solid rgba(255,255,255,0.05)":"none" }}>
                  <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)", width:16, textAlign:"center" }}>
                    {i+1}
                  </span>
                  <span style={{ fontSize:18 }}>{p.image}</span>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:12, color:"#fff", margin:0 }}>{p.name}</p>
                    <div style={{ height:4, background:"rgba(255,255,255,0.06)", borderRadius:4, marginTop:4 }}>
                      <div style={{ height:4, borderRadius:4, background:gold,
                        width:`${Math.round(p.sales/Math.max(...products.map(x=>x.sales))*100)}%` }} />
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}>
                    <p style={{ fontSize:12, color:gold, margin:0 }}>{p.sales} sold</p>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)", margin:0 }}>
                      {p.views} views
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10 }}>
              <div style={{ background:cardBg, border, borderRadius:12, padding:"14px" }}>
                <TrendingUp size={16} color={gold} style={{ marginBottom:8 }} />
                <p style={{ fontSize:22, fontWeight:600, color:gold, margin:"0 0 2px" }}>
                  {Math.round(stats.totalSales > 0 ? stats.totalViews / stats.totalSales : 0)}:1
                </p>
                <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>Views per sale</p>
              </div>
              <div style={{ background:cardBg, border, borderRadius:12, padding:"14px" }}>
                <Eye size={16} color="#7dd3fc" style={{ marginBottom:8 }} />
                <p style={{ fontSize:22, fontWeight:600, color:"#7dd3fc", margin:"0 0 2px" }}>
                  {stats.totalSales > 0 ? Math.round(stats.totalSales/stats.totalViews*100) : 0}%
                </p>
                <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)" }}>Conversion rate</p>
              </div>
            </div>
          </div>
        )}

        {/* ── ORDERS TAB ── */}
        {tab==="orders" && (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {orders.map(o=>(
              <div key={o.id} style={{ background:cardBg, border, borderRadius:12, padding:"14px 16px" }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:8 }}>
                  <div>
                    <p style={{ fontSize:13, fontWeight:500, color:"#fff", margin:"0 0 2px" }}>
                      {o.product} ({o.size})
                    </p>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", margin:0 }}>
                      {o.buyer} · {timeAgo(o.date)}
                    </p>
                  </div>
                  <div>
                    <span style={{ fontSize:12, fontWeight:500, color:gold }}>{o.amount.toLocaleString()} FP</span>
                    <div style={{ marginTop:4, textAlign:"right" }}>
                      <span style={{
                        fontSize:10, fontWeight:500, padding:"2px 8px", borderRadius:20,
                        background: o.status==="pending" ? "rgba(251,191,36,0.1)" : o.status==="shipped" ? "rgba(125,211,252,0.1)" : "rgba(74,222,128,0.1)",
                        color: o.status==="pending" ? "#fbbf24" : o.status==="shipped" ? "#7dd3fc" : "#4ade80",
                      }}>{o.status}</span>
                    </div>
                  </div>
                </div>
                {o.status==="pending" && (
                  <div style={{ display:"flex", gap:6, marginTop:8 }}>
                    <input
                      value={trackingInput[o.id]||""}
                      onChange={e=>setTrackingInput(prev=>({...prev,[o.id]:e.target.value}))}
                      placeholder="Tracking number (optional)"
                      style={{ flex:1, background:"rgba(255,255,255,0.04)", border:"0.5px solid rgba(255,255,255,0.08)",
                        borderRadius:7, padding:"7px 10px", color:"#fff", fontSize:12, outline:"none" }}
                    />
                    <button onClick={()=>markShipped(o.id)} style={{
                      padding:"7px 14px", borderRadius:7, background:"rgba(125,211,252,0.1)",
                      border:"0.5px solid rgba(125,211,252,0.2)", color:"#7dd3fc",
                      fontSize:12, cursor:"pointer", display:"flex", alignItems:"center", gap:5 }}>
                      <Truck size={12} /> Mark shipped
                    </button>
                  </div>
                )}
                {o.tracking && (
                  <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:6 }}>
                    Tracking: {o.tracking}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── FLASH DROPS TAB ── */}
        {tab==="drops" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:"rgba(201,169,110,0.06)", border:goldBorder,
              borderRadius:10, padding:"12px 14px" }}>
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:4 }}>
                <Zap size={14} color={gold} />
                <span style={{ fontSize:13, color:gold, fontWeight:500 }}>Schedule a Flash Drop</span>
              </div>
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.4)", lineHeight:1.5 }}>
                Flash drops create a 24h countdown on a product with a push notification blast to all Flex users. Limited stock only.
              </p>
            </div>
            {products.filter(p=>p.active).map(p=>(
              <div key={p.id} style={{ background:cardBg, border, borderRadius:12,
                padding:"12px 14px", display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:22 }}>{p.image}</span>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:13, color:"#fff", margin:"0 0 2px" }}>{p.name}</p>
                  <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", margin:0 }}>
                    {p.stock} in stock · {p.price.toLocaleString()} FP
                  </p>
                </div>
                {p.isLimited ? (
                  <span style={{ fontSize:11, color:"#ff9090", background:"rgba(255,80,80,0.1)",
                    borderRadius:20, padding:"3px 10px" }}>Active drop</span>
                ) : (
                  <button onClick={()=>setProducts(prev=>prev.map(x=>x.id===p.id?{...x,isLimited:true}:x))}
                    style={{ padding:"6px 14px", borderRadius:20, background:"rgba(201,169,110,0.08)",
                      border:goldBorder, color:gold, fontSize:11, cursor:"pointer" }}>
                    Start drop
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── EARNINGS TAB ── */}
        {tab==="earnings" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:cardBg, border:goldBorder, borderRadius:12, padding:"20px 18px" }}>
              <p style={{ fontSize:11, color:"rgba(201,169,110,0.6)", marginBottom:4 }}>Total FP earned</p>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:6 }}>
                <Coins size={22} color={gold} />
                <span style={{ fontSize:30, fontWeight:600, color:gold }}>{fpBalance.toLocaleString()}</span>
                <span style={{ fontSize:13, color:"rgba(255,255,255,0.4)", paddingTop:6 }}>FP</span>
              </div>
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>
                ≈ ${(fpBalance/100).toFixed(2)} USD at current rate
              </p>
            </div>
            <div style={{ background:cardBg, border, borderRadius:12, padding:"14px 16px" }}>
              <p style={{ fontSize:13, fontWeight:500, color:"#fff", marginBottom:12 }}>Withdraw FP</p>
              <p style={{ fontSize:12, color:"rgba(255,255,255,0.4)", marginBottom:12, lineHeight:1.5 }}>
                Convert your Flex Points to real currency. Minimum withdrawal: 5,000 FP. Processing takes 3–5 business days.
              </p>
              <div style={{ display:"flex", gap:8 }}>
                <input placeholder="Amount (FP)" type="number" style={{
                  flex:1, background:"rgba(255,255,255,0.04)", border:"0.5px solid rgba(255,255,255,0.08)",
                  borderRadius:8, padding:"9px 12px", color:"#fff", fontSize:13, outline:"none" }} />
                <button style={{ padding:"9px 18px", borderRadius:8, background:gold,
                  color:"#000", border:"none", fontSize:13, fontWeight:500, cursor:"pointer" }}>
                  Withdraw
                </button>
              </div>
            </div>
            <div style={{ background:cardBg, border, borderRadius:12, padding:"14px 16px" }}>
              <p style={{ fontSize:12, fontWeight:500, color:"rgba(255,255,255,0.5)", marginBottom:10 }}>Sales history</p>
              {orders.map((o,i)=>(
                <div key={o.id} style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
                  padding:"8px 0", borderBottom: i<orders.length-1?"0.5px solid rgba(255,255,255,0.05)":"none" }}>
                  <div>
                    <p style={{ fontSize:12, color:"#fff", margin:0 }}>{o.product}</p>
                    <p style={{ fontSize:11, color:"rgba(255,255,255,0.35)", margin:0 }}>{o.buyer}</p>
                  </div>
                  <span style={{ fontSize:13, fontWeight:500, color:"#4ade80" }}>+{o.amount.toLocaleString()} FP</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── PROFILE TAB ── */}
        {tab==="profile" && (
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div style={{ background:cardBg, border, borderRadius:12, padding:"16px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <p style={{ fontSize:14, fontWeight:500, color:"#fff" }}>Store profile</p>
                <button onClick={()=>setProfileEditing(e=>!e)} style={{
                  background:"rgba(255,255,255,0.05)", border, borderRadius:7,
                  padding:"5px 12px", fontSize:12, color:"rgba(255,255,255,0.6)", cursor:"pointer" }}>
                  {profileEditing ? "Done" : "Edit"}
                </button>
              </div>
              {profileEditing ? (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  {[
                    { label:"Store name", key:"name" as const },
                    { label:"Category", key:"category" as const },
                    { label:"Bio", key:"bio" as const },
                    { label:"Logo (emoji)", key:"logo" as const },
                    { label:"Shipping policy", key:"shipping" as const },
                    { label:"Instagram handle", key:"instagram" as const },
                  ].map(f=>(
                    <div key={f.key}>
                      <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)", marginBottom:4, display:"block" }}>{f.label}</span>
                      <input value={(storeProfile as any)[f.key]} onChange={e=>setStoreProfile(p=>({...p,[f.key]:e.target.value}))}
                        style={{ width:"100%", background:"rgba(255,255,255,0.04)", border:"0.5px solid rgba(255,255,255,0.1)",
                          borderRadius:8, padding:"9px 12px", color:"#fff", fontSize:13, outline:"none", boxSizing:"border-box" }} />
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                    <span style={{ fontSize:36 }}>{storeProfile.logo}</span>
                    <div>
                      <p style={{ fontSize:15, fontWeight:500, color:"#fff", margin:0 }}>{storeProfile.name}</p>
                      <p style={{ fontSize:12, color:"rgba(255,255,255,0.4)", margin:0 }}>{storeProfile.category}</p>
                    </div>
                  </div>
                  <p style={{ fontSize:13, color:"rgba(255,255,255,0.6)", lineHeight:1.6 }}>{storeProfile.bio}</p>
                  <p style={{ fontSize:12, color:"rgba(255,255,255,0.35)" }}>📦 {storeProfile.shipping}</p>
                  {storeProfile.instagram && (
                    <p style={{ fontSize:12, color:"#7dd3fc" }}>@{storeProfile.instagram}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
