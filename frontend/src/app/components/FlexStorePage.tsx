import { useState, useMemo } from "react";
import {
  ShoppingBag, Search, Check, Star, Coins, ChevronRight,
  Clock, Users, Heart, X, ArrowLeft, Filter, Zap, Package,
  Minus, Plus, Truck, CircleCheck, Loader, ShoppingCart
} from "lucide-react";

// ─── TYPES ───────────────────────────────────────────────────────────────────
interface StoreProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  originalPrice?: number;
  image: string;
  color: string;
  isLimited: boolean;
  dropEndsAt?: Date;
  squadDeal?: number;
  inStock: number;
  sizes: string[];
  description: string;
}

interface Store {
  id: string;
  name: string;
  logo: string;
  banner: string;
  category: string;
  bio: string;
  verified: boolean;
  rating: number;
  totalSales: number;
  followers: number;
  badge?: string;
  products: StoreProduct[];
}

// ─── CART & ORDER TYPES ───────────────────────────────────────────────────────
interface CartItem {
  cartId: string;
  product: StoreProduct;
  storeName: string;
  size: string;
  qty: number;
}

type OrderStatus = 'pending' | 'processing' | 'shipped' | 'delivered';
interface Order {
  id: string;
  items: CartItem[];
  total: number;
  placedAt: string;
  status: OrderStatus;
  estimatedDelivery: string;
}

// ─── MOCK STORES ──────────────────────────────────────────────────────────────
const STORES: Store[] = [
  {
    id:"s1", name:"Flex Originals", logo:"⚡", banner:"#1a1208",
    category:"Clothing", bio:"Official Flex gear. Obsidian & gold aesthetic for elite athletes who train in the dark.",
    verified:true, rating:4.9, totalSales:1240, followers:8420, badge:"Official",
    products:[
      { id:"p1", name:"Obsidian Tee", category:"T-Shirts", price:1200, image:"👕", color:"#1a1208",
        isLimited:false, inStock:50, sizes:["XS","S","M","L","XL","XXL"], squadDeal:20,
        description:"Ultra-light performance fabric. Moisture-wicking and anti-odour." },
      { id:"p2", name:"Gold Rush Hoodie", category:"Hoodies", price:3500, image:"🧥", color:"#0d1a0d",
        isLimited:true, dropEndsAt:new Date(Date.now()+1000*60*60*18), inStock:12, sizes:["S","M","L","XL"],
        description:"French terry cotton blend. Gold embroidery, drop shoulder fit." },
      { id:"p5", name:"Phantom Joggers", category:"Pants", price:2200, originalPrice:2800, image:"👖", color:"#111118",
        isLimited:true, dropEndsAt:new Date(Date.now()+1000*60*60*6), inStock:8, sizes:["S","M","L","XL"],
        description:"Tapered jogger with deep side pockets. Water-resistant shell." },
    ],
  },
  {
    id:"s2", name:"Gymshark × Flex", logo:"🦈", banner:"#0a0a1a",
    category:"Performance", bio:"High-performance training gear, co-designed with Flex athletes.",
    verified:true, rating:4.8, totalSales:890, followers:5300, badge:"Collab",
    products:[
      { id:"p3", name:"Elite Compression Shorts", category:"Shorts", price:900, image:"🩳", color:"#0a0a1a",
        isLimited:false, inStock:80, sizes:["XS","S","M","L","XL","XXL"], squadDeal:20,
        description:"4-way stretch compression shorts. Seamless waistband." },
      { id:"p6", name:"Velocity Leggings", category:"Pants", price:1400, image:"🏃", color:"#0d0818",
        isLimited:false, inStock:45, sizes:["XS","S","M","L","XL"],
        description:"Ultra-stretch 7/8 length leggings. Phone pocket on waist." },
    ],
  },
  {
    id:"s3", name:"Beast Gear", logo:"🏋️", banner:"#0d1a0d",
    category:"Equipment", bio:"Premium training equipment. Built for beasts, tested in the wild.",
    verified:false, rating:4.5, totalSales:230, followers:920, badge:"New store",
    products:[
      { id:"p7", name:"Resistance Band Set", category:"Accessories", price:450, image:"🔗", color:"#0d1a0d",
        isLimited:false, inStock:100, sizes:["Set of 5"],
        description:"5 resistance levels. Latex-free, anti-snap. Carry pouch included." },
      { id:"p8", name:"Lifting Straps", category:"Accessories", price:300, image:"🪢", color:"#1a0d0d",
        isLimited:false, inStock:60, sizes:["One Size"],
        description:"Cotton wrist straps with neoprene padding." },
    ],
  },
  {
    id:"s4", name:"Nike × Flex", logo:"✔️", banner:"#0d0d0d",
    category:"Footwear & Accessories", bio:"Dri-FIT collab drops. Limited runs, Flex community exclusive.",
    verified:true, rating:4.9, totalSales:560, followers:12800, badge:"Collab",
    products:[
      { id:"p4", name:"Beast Mode Cap", category:"Accessories", price:600, image:"🧢", color:"#1a0d0d",
        isLimited:false, inStock:30, sizes:["One Size"], squadDeal:20,
        description:"Dri-FIT technology. Gold embroidered Flex wordmark." },
      { id:"p9", name:"Training Socks (3-pack)", category:"Accessories", price:350, image:"🧦", color:"#0d0d0d",
        isLimited:false, inStock:200, sizes:["S/M","L/XL"],
        description:"Cushioned heel & toe. Ankle-length with arch support." },
    ],
  },
];

const STORE_CATEGORIES = ["All","Clothing","Performance","Equipment","Footwear & Accessories"];

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function useCountdown(target?: Date) {
  const [label, setLabel] = useState("");
  useMemo(() => {
    if (!target) return;
    const update = () => {
      const s = Math.max(0, Math.floor((target.getTime()-Date.now())/1000));
      const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
      setLabel(`${h}h ${String(m).padStart(2,"0")}m ${String(sec).padStart(2,"0")}s`);
    };
    update();
  }, [target]);
  return label;
}

// ─── STORE CARD ───────────────────────────────────────────────────────────────
function StoreCard({ store, onSelect }: { store: Store; onSelect: ()=>void }) {
  const gold = "#c9a96e";
  const badgeColor: Record<string,{bg:string;color:string}> = {
    "Official":   { bg:"rgba(201,169,110,0.12)", color:gold },
    "Collab":     { bg:"rgba(125,211,252,0.1)",  color:"#7dd3fc" },
    "New store":  { bg:"rgba(167,139,250,0.1)",  color:"#a78bfa" },
  };
  const bc = store.badge ? badgeColor[store.badge] : null;

  return (
    <div onClick={onSelect} style={{
      background:"#0d0b08", border:"0.5px solid rgba(255,255,255,0.07)",
      borderRadius:14, overflow:"hidden", cursor:"pointer",
      transition:"transform 0.15s",
    }}
      onMouseEnter={e=>(e.currentTarget.style.transform="translateY(-2px)")}
      onMouseLeave={e=>(e.currentTarget.style.transform="translateY(0)")}
    >
      {/* banner */}
      <div style={{ background:store.banner, height:70, display:"flex",
        alignItems:"center", justifyContent:"center", position:"relative" }}>
        <span style={{ fontSize:36 }}>{store.logo}</span>
        {store.badge && bc && (
          <div style={{ position:"absolute", top:8, right:8,
            background:bc.bg, borderRadius:20, padding:"2px 8px",
            fontSize:10, color:bc.color, fontWeight:500 }}>
            {store.badge}
          </div>
        )}
      </div>
      {/* info */}
      <div style={{ padding:"12px 12px 14px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:2 }}>
          <span style={{ fontSize:13, fontWeight:500, color:"#fff" }}>{store.name}</span>
          {store.verified && <Check size={12} color={gold} />}
        </div>
        <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", margin:"0 0 8px" }}>{store.category}</p>
        <div style={{ display:"flex", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:3 }}>
            <Star size={10} color="#facc15" fill="#facc15" />
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.6)" }}>{store.rating}</span>
          </div>
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{store.totalSales.toLocaleString()} sales</span>
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)" }}>{store.products.length} products</span>
        </div>
      </div>
    </div>
  );
}

// ─── PRODUCT CARD (inside store) ─────────────────────────────────────────────
function ProductCard({ p, balance, onBuy }: {
  p: StoreProduct; balance: number; onBuy: (p:StoreProduct,size:string)=>void;
}) {
  const [size, setSize] = useState("");
  const [open, setOpen] = useState(false);
  const cdLabel = useCountdown(p.dropEndsAt);
  const affordable = balance >= p.price;
  const gold = "#c9a96e";

  return (
    <div style={{ background:"#0d0b08", border:"0.5px solid rgba(255,255,255,0.07)",
      borderRadius:12, overflow:"hidden" }}>
      {/* image */}
      <div style={{ background:p.color, height:88, display:"flex", alignItems:"center",
        justifyContent:"center", fontSize:38, position:"relative", cursor:"pointer" }}
        onClick={()=>setOpen(o=>!o)}>
        {p.image}
        {p.isLimited && (
          <div style={{ position:"absolute", top:6, left:6,
            background:"rgba(255,80,80,0.15)", border:"0.5px solid rgba(255,80,80,0.3)",
            borderRadius:20, padding:"2px 7px", fontSize:9, color:"#ff9090", fontWeight:600 }}>
            LIMITED
          </div>
        )}
        {p.originalPrice && (
          <div style={{ position:"absolute", top:6, right:6,
            background:"rgba(255,200,60,0.15)", borderRadius:20, padding:"2px 7px",
            fontSize:9, color:"#ffd060", fontWeight:600 }}>SALE</div>
        )}
      </div>
      {/* info */}
      <div style={{ padding:"10px 10px 12px" }}>
        <p style={{ fontSize:12, fontWeight:500, color:"#fff", margin:"0 0 2px" }}>{p.name}</p>
        {p.isLimited && cdLabel && (
          <div style={{ display:"flex", alignItems:"center", gap:3, marginBottom:4 }}>
            <Clock size={9} color="#ff6060" />
            <span style={{ fontSize:9, color:"#ff9090" }}>{cdLabel}</span>
          </div>
        )}
        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:open?8:0 }}>
          <Coins size={12} color={gold} />
          <span style={{ fontSize:12, fontWeight:600, color:gold }}>{p.price.toLocaleString()}</span>
          {p.originalPrice && (
            <span style={{ fontSize:10, color:"rgba(255,255,255,0.3)", textDecoration:"line-through" }}>
              {p.originalPrice.toLocaleString()}
            </span>
          )}
        </div>
        {/* expanded buy */}
        {open && (
          <div>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:8 }}>
              {p.sizes.map(s=>(
                <button key={s} onClick={()=>setSize(s)} style={{
                  padding:"4px 10px", borderRadius:20, fontSize:11, cursor:"pointer",
                  background: size===s ? gold : "rgba(255,255,255,0.06)",
                  color: size===s ? "#000" : "rgba(255,255,255,0.6)",
                  border: size===s ? "none" : "0.5px solid rgba(255,255,255,0.1)",
                  fontWeight: size===s ? 600 : 400,
                }}>{s}</button>
              ))}
            </div>
            <button disabled={!affordable||!size} onClick={()=>{ onBuy(p,size); setOpen(false); setSize(""); }} style={{
              width:"100%", padding:"8px 0", borderRadius:8,
              background: affordable&&size ? gold : "rgba(255,255,255,0.05)",
              color: affordable&&size ? "#000" : "rgba(255,255,255,0.2)",
              border:"none", fontSize:12, fontWeight:600, cursor: affordable&&size?"pointer":"not-allowed",
            }}>
              {!size?"Select size":!affordable?"Need more FP":"Buy now"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── STORE PROFILE PAGE ───────────────────────────────────────────────────────
function StoreProfilePage({ store, balance, onBack, onBuy, onNavigateWallet }: {
  store: Store; balance: number; onBack: ()=>void;
  onBuy:(p:StoreProduct,size:string)=>void; onNavigateWallet:()=>void;
}) {
  const [catFilter, setCatFilter] = useState("All");
  const [wishlist, setWishlist] = useState<string[]>([]);
  const gold = "#c9a96e";

  const storeCategories = useMemo(() => {
    const cats = Array.from(new Set(store.products.map(p=>p.category)));
    return ["All",...cats];
  }, [store.products]);

  const filtered = useMemo(() => {
    return catFilter==="All" ? store.products : store.products.filter(p=>p.category===catFilter);
  }, [store.products, catFilter]);

  const badgeColor: Record<string,{bg:string;color:string}> = {
    "Official":  { bg:"rgba(201,169,110,0.12)", color:gold },
    "Collab":    { bg:"rgba(125,211,252,0.1)", color:"#7dd3fc" },
    "New store": { bg:"rgba(167,139,250,0.1)", color:"#a78bfa" },
  };

  return (
    <div style={{ minHeight:"100vh", background:"#080608", color:"#fff",
      fontFamily:"system-ui,sans-serif", paddingBottom:50 }}>
      {/* banner */}
      <div style={{
        background:`linear-gradient(160deg, ${store.banner} 0%, #1a1410 100%)`,
        height:140, position:"relative",
        borderBottom:"0.5px solid rgba(201,169,110,0.12)",
        display:"flex", flexDirection:"column", justifyContent:"space-between",
        padding:"16px 16px 0",
      }}>
        <button onClick={onBack} style={{
          background:"rgba(0,0,0,0.45)", border:"0.5px solid rgba(255,255,255,0.1)",
          borderRadius:8, padding:"6px 12px", display:"flex", alignItems:"center", gap:5,
          color:"#fff", fontSize:12, cursor:"pointer", alignSelf:"flex-start",
        }}>
          <ArrowLeft size={13}/> All stores
        </button>
        {/* logo inside banner */}
        <div style={{ display:"flex", alignItems:"flex-end", gap:12, marginBottom:-28 }}>
          <div style={{ width:56, height:56, borderRadius:12, background:"#0d0b08",
            border:`1.5px solid ${gold}55`, display:"flex", alignItems:"center",
            justifyContent:"center", fontSize:28, flexShrink:0, boxShadow:"0 4px 16px rgba(0,0,0,0.5)" }}>
            {store.logo}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:600, margin:"0 auto", padding:"0 16px" }}>
        {/* store header */}
        <div style={{ marginTop:36, marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, flexWrap:"wrap", marginBottom:2 }}>
            <span style={{ fontSize:17, fontWeight:700, color:"#fff" }}>{store.name}</span>
            {store.verified && (
              <div style={{ display:"flex", alignItems:"center", gap:3,
                background:"rgba(201,169,110,0.1)", borderRadius:20, padding:"2px 7px" }}>
                <Check size={10} color={gold} />
                <span style={{ fontSize:10, color:gold, fontWeight:500 }}>Verified</span>
              </div>
            )}
            {store.badge && badgeColor[store.badge] && (
              <span style={{ fontSize:10, fontWeight:500, padding:"2px 8px", borderRadius:20,
                background:badgeColor[store.badge].bg, color:badgeColor[store.badge].color }}>
                {store.badge}
              </span>
            )}
          </div>
          <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", margin:0 }}>{store.category}</p>
        </div>

        <p style={{ fontSize:13, color:"rgba(255,255,255,0.55)", lineHeight:1.6, marginBottom:12 }}>{store.bio}</p>

        {/* stats */}
        <div style={{ display:"flex", gap:16, marginBottom:16 }}>
          <div style={{ display:"flex", alignItems:"center", gap:4 }}>
            <Star size={12} color="#facc15" fill="#facc15" />
            <span style={{ fontSize:12, color:"rgba(255,255,255,0.7)" }}>{store.rating} rating</span>
          </div>
          <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{store.totalSales.toLocaleString()} sales</span>
          <span style={{ fontSize:12, color:"rgba(255,255,255,0.4)" }}>{store.followers.toLocaleString()} followers</span>
        </div>

        {/* balance */}
        <div style={{ background:"#0d0b08", border:"0.5px solid rgba(201,169,110,0.15)",
          borderRadius:10, padding:"10px 14px", marginBottom:16,
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <Coins size={14} color={gold} />
            <span style={{ fontSize:13, fontWeight:600, color:gold }}>{balance.toLocaleString()}</span>
            <span style={{ fontSize:11, color:"rgba(255,255,255,0.4)" }}>FP</span>
          </div>
          <button onClick={onNavigateWallet} style={{ background:"rgba(201,169,110,0.1)",
            border:"0.5px solid rgba(201,169,110,0.2)", borderRadius:7,
            padding:"5px 12px", fontSize:11, color:gold, cursor:"pointer" }}>
            Top up
          </button>
        </div>

        {/* category chips */}
        {storeCategories.length > 2 && (
          <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4, marginBottom:16,
            scrollbarWidth:"none" }}>
            {storeCategories.map(c=>(
              <button key={c} onClick={()=>setCatFilter(c)} style={{
                whiteSpace:"nowrap", padding:"5px 14px", borderRadius:20, fontSize:12, cursor:"pointer",
                background: catFilter===c ? gold : "rgba(255,255,255,0.05)",
                color: catFilter===c ? "#000" : "rgba(255,255,255,0.5)",
                border:"none", fontWeight: catFilter===c ? 500 : 400,
              }}>{c}</button>
            ))}
          </div>
        )}

        {/* product grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(148px,1fr))", gap:10 }}>
          {filtered.map(p=>(
            <ProductCard key={p.id} p={p} balance={balance} onBuy={onBuy} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN FLEX STORE PAGE ─────────────────────────────────────────────────────
export function FlexStorePage({ onNavigate }: { onNavigate: (v:string)=>void }) {
  const [balance, setBalance] = useState(4200);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All");
  const [sortBy, setSortBy] = useState<"rating"|"sales"|"newest">("sales");
  const [selectedStore, setSelectedStore] = useState<Store|null>(null);
  const [purchaseToast, setPurchaseToast] = useState<string|null>(null);

  // ── Cart & Orders ────────────────────────────────────────────────────────────
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [cartTab, setCartTab] = useState<'cart'|'orders'>('cart');
  const [orders, setOrders] = useState<Order[]>([]);
  const [placingOrder, setPlacingOrder] = useState(false);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);
  const cartTotal = cart.reduce((s, i) => s + i.product.price * i.qty, 0);

  const gold = "#c9a96e";

  const filtered = useMemo(() => {
    let list = STORES.filter(s => {
      const catOk = category==="All" || s.category===category;
      const searchOk = !search || s.name.toLowerCase().includes(search.toLowerCase())
        || s.category.toLowerCase().includes(search.toLowerCase());
      return catOk && searchOk;
    });
    if (sortBy==="rating") list = [...list].sort((a,b)=>b.rating-a.rating);
    if (sortBy==="sales") list = [...list].sort((a,b)=>b.totalSales-a.totalSales);
    return list;
  }, [search, category, sortBy]);

  function addToCart(p: StoreProduct, size: string, storeName: string) {
    setCart(prev => {
      const existing = prev.find(i => i.product.id === p.id && i.size === size);
      if (existing) return prev.map(i => i.product.id === p.id && i.size === size ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { cartId: `${p.id}-${size}-${Date.now()}`, product: p, storeName, size, qty: 1 }];
    });
    setPurchaseToast(`${p.name} added to cart!`);
    setTimeout(() => setPurchaseToast(null), 2500);
  }

  function removeFromCart(cartId: string) {
    setCart(prev => prev.filter(i => i.cartId !== cartId));
  }

  function changeQty(cartId: string, delta: number) {
    setCart(prev => prev
      .map(i => i.cartId === cartId ? { ...i, qty: Math.max(1, i.qty + delta) } : i)
    );
  }

  function placeOrder() {
    if (cart.length === 0 || cartTotal > balance) return;
    setPlacingOrder(true);
    setTimeout(() => {
      const deliveryDays = Math.floor(Math.random() * 4) + 3;
      const delivery = new Date(Date.now() + deliveryDays * 86400000);
      const newOrder: Order = {
        id: `ORD-${Date.now().toString(36).toUpperCase()}`,
        items: [...cart],
        total: cartTotal,
        placedAt: new Date().toLocaleString(),
        status: 'pending',
        estimatedDelivery: delivery.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' }),
      };
      setBalance(b => b - cartTotal);
      setOrders(prev => [newOrder, ...prev]);
      setCart([]);
      setPlacingOrder(false);
      setCartTab('orders');
      // Simulate status progression
      setTimeout(() => setOrders(o => o.map(x => x.id === newOrder.id ? { ...x, status: 'processing' } : x)), 5000);
      setTimeout(() => setOrders(o => o.map(x => x.id === newOrder.id ? { ...x, status: 'shipped' } : x)), 12000);
    }, 1500);
  }

  // kept for backwards compat with StoreProfilePage prop
  function handleBuy(p: StoreProduct, size: string) {
    addToCart(p, size, selectedStore?.name || 'Store');
  }

  if (selectedStore) {
    return (
      <StoreProfilePage
        store={selectedStore}
        balance={balance}
        onBack={()=>setSelectedStore(null)}
        onBuy={handleBuy}
        onNavigateWallet={()=>{ setSelectedStore(null); onNavigate("flex-wallet"); }}
      />
    );
  }

  return (
    <div style={{ minHeight:"100vh", background:"#080608", color:"#fff",
      fontFamily:"system-ui,sans-serif", paddingBottom:50 }}>

      {/* purchase toast */}
      {purchaseToast && (
        <div style={{ position:"fixed", top:20, left:"50%", transform:"translateX(-50%)",
          zIndex:300, background:"rgba(13,11,8,0.97)", border:`0.5px solid ${gold}`,
          borderRadius:12, padding:"12px 20px", display:"flex", alignItems:"center", gap:8 }}>
          <Check size={15} color="#4ade80" />
          <span style={{ fontSize:13, color:"#fff" }}>{purchaseToast}</span>
        </div>
      )}

      {/* CART PANEL */}
      {cartOpen && (
        <div style={{ position:"fixed", inset:0, zIndex:200, display:"flex", justifyContent:"flex-end" }}>
          {/* backdrop */}
          <div onClick={() => setCartOpen(false)}
            style={{ position:"absolute", inset:0, background:"rgba(0,0,0,0.6)" }} />
          {/* drawer */}
          <div style={{ position:"relative", width:"100%", maxWidth:400, background:"#0d0b08",
            borderLeft:"0.5px solid rgba(201,169,110,0.15)", height:"100%",
            display:"flex", flexDirection:"column", overflowY:"auto" }}>

            {/* drawer header */}
            <div style={{ padding:"18px 18px 0", borderBottom:"0.5px solid rgba(255,255,255,0.06)", paddingBottom:14 }}>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                <span style={{ fontSize:16, fontWeight:600, color:"#fff" }}>
                  {cartTab === 'cart' ? 'Your basket' : 'My orders'}
                </span>
                <button onClick={() => setCartOpen(false)}
                  style={{ background:"rgba(255,255,255,0.06)", border:"none", borderRadius:8,
                    width:30, height:30, display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer" }}>
                  <X size={15} color="rgba(255,255,255,0.6)" />
                </button>
              </div>
              {/* tabs */}
              <div style={{ display:"flex", gap:4 }}>
                {(['cart','orders'] as const).map(tab => (
                  <button key={tab} onClick={() => setCartTab(tab)}
                    style={{ flex:1, padding:"6px 0", borderRadius:8, border:"none", fontSize:12, fontWeight:500,
                      cursor:"pointer",
                      background: cartTab===tab ? gold : "rgba(255,255,255,0.05)",
                      color: cartTab===tab ? "#000" : "rgba(255,255,255,0.5)" }}>
                    {tab === 'cart'
                      ? (cartCount > 0 ? `Basket (${cartCount})` : 'Basket')
                      : (orders.length > 0 ? `Orders (${orders.length})` : 'Orders')}
                  </button>
                ))}
              </div>
            </div>

            {/* CART TAB */}
            {cartTab === 'cart' && (
              <div style={{ flex:1, overflowY:"auto", padding:18, display:"flex", flexDirection:"column", gap:12 }}>
                {/* cart items */}
                {cart.length === 0 ? (
                  <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                    justifyContent:"center", gap:10, padding:"40px 0" }}>
                    <ShoppingCart size={32} color="rgba(255,255,255,0.15)" />
                    <p style={{ fontSize:13, color:"rgba(255,255,255,0.35)", textAlign:"center" }}>
                      Your basket is empty
                    </p>
                  </div>
                ) : (
                  <>
                    {cart.map(item => (
                      <div key={item.cartId} style={{ background:"rgba(255,255,255,0.03)",
                        borderRadius:10, padding:"12px 14px", display:"flex", gap:12,
                        border:"0.5px solid rgba(255,255,255,0.06)" }}>
                        <div style={{ width:44, height:44, borderRadius:8, display:"flex",
                          alignItems:"center", justifyContent:"center",
                          background: item.product.color || "#1a1208", fontSize:22, flexShrink:0 }}>
                          {item.product.image}
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <p style={{ fontSize:13, fontWeight:500, color:"#fff", margin:0,
                            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                            {item.product.name}
                          </p>
                          <p style={{ fontSize:11, color:"rgba(255,255,255,0.4)", margin:"2px 0 6px" }}>
                            {item.storeName} · Size {item.size}
                          </p>
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <button onClick={() => changeQty(item.cartId, -1)}
                                style={{ width:22, height:22, borderRadius:6, border:"0.5px solid rgba(255,255,255,0.12)",
                                  background:"rgba(255,255,255,0.04)", color:"#fff", fontSize:14,
                                  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>−</button>
                              <span style={{ fontSize:12, color:"#fff", minWidth:16, textAlign:"center" }}>{item.qty}</span>
                              <button onClick={() => changeQty(item.cartId, 1)}
                                style={{ width:22, height:22, borderRadius:6, border:"0.5px solid rgba(255,255,255,0.12)",
                                  background:"rgba(255,255,255,0.04)", color:"#fff", fontSize:14,
                                  cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>+</button>
                            </div>
                            <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                              <span style={{ fontSize:12, fontWeight:600, color:gold }}>
                                {(item.product.price * item.qty).toLocaleString()} FC
                              </span>
                              <button onClick={() => removeFromCart(item.cartId)}
                                style={{ background:"none", border:"none", cursor:"pointer", padding:2 }}>
                                <X size={13} color="rgba(255,255,255,0.3)" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </div>
            )}

            {/* ORDERS TAB */}
            {cartTab === 'orders' && (
              <div style={{ flex:1, overflowY:"auto", padding:18, display:"flex", flexDirection:"column", gap:12 }}>
                {orders.length === 0 ? (
                  <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                    justifyContent:"center", gap:10, padding:"40px 0" }}>
                    <Package size={32} color="rgba(255,255,255,0.15)" />
                    <p style={{ fontSize:13, color:"rgba(255,255,255,0.35)", textAlign:"center" }}>
                      No orders yet
                    </p>
                  </div>
                ) : orders.map(order => {
                  const statusColor: Record<OrderStatus,string> = {
                    pending:"rgba(250,204,21,0.8)", processing:"rgba(96,165,250,0.8)",
                    shipped:"rgba(52,211,153,0.6)", delivered:"rgba(52,211,153,0.9)"
                  };
                  return (
                    <div key={order.id} style={{ background:"rgba(255,255,255,0.03)",
                      borderRadius:10, padding:"14px", border:"0.5px solid rgba(255,255,255,0.06)" }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
                        <span style={{ fontSize:12, fontWeight:600, color:"rgba(255,255,255,0.7)" }}>{order.id}</span>
                        <span style={{ fontSize:11, fontWeight:500,
                          color: statusColor[order.status],
                          background:"rgba(255,255,255,0.05)", borderRadius:20, padding:"2px 8px",
                          textTransform:"capitalize" }}>{order.status}</span>
                      </div>
                      <div style={{ display:"flex", flexDirection:"column", gap:4, marginBottom:8 }}>
                        {order.items.map(item => (
                          <p key={item.cartId} style={{ fontSize:12, color:"rgba(255,255,255,0.5)", margin:0 }}>
                            {item.qty}× {item.product.name} (Size {item.size})
                          </p>
                        ))}
                      </div>
                      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11,
                        color:"rgba(255,255,255,0.35)" }}>
                        <span>Placed {order.placedAt}</span>
                        <span style={{ color:gold, fontWeight:600 }}>{order.total.toLocaleString()} FC</span>
                      </div>
                      {(order.status === 'pending' || order.status === 'processing') && (
                        <p style={{ fontSize:11, color:"rgba(255,255,255,0.3)", marginTop:6 }}>
                          Est. delivery: {order.estimatedDelivery}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* checkout footer — only on cart tab */}
            {cartTab === 'cart' && cart.length > 0 && (
              <div style={{ padding:"14px 18px", borderTop:"0.5px solid rgba(255,255,255,0.06)",
                display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
                  <span style={{ fontSize:13, color:"rgba(255,255,255,0.5)" }}>Total</span>
                  <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                    <Coins size={13} color={gold} />
                    <span style={{ fontSize:14, fontWeight:700, color:gold }}>{cartTotal.toLocaleString()} FC</span>
                  </div>
                </div>
                {cartTotal > balance && (
                  <p style={{ fontSize:11, color:"#f87171", textAlign:"center", margin:0 }}>
                    Insufficient balance ({balance.toLocaleString()} FC available)
                  </p>
                )}
                <button
                  onClick={placeOrder}
                  disabled={placingOrder || cartTotal > balance}
                  style={{ width:"100%", padding:"11px 0", borderRadius:10, border:"none",
                    background: cartTotal > balance ? "rgba(255,255,255,0.06)" : gold,
                    color: cartTotal > balance ? "rgba(255,255,255,0.25)" : "#000",
                    fontSize:13, fontWeight:600, cursor: cartTotal > balance ? "not-allowed" : "pointer",
                    opacity: placingOrder ? 0.7 : 1 }}>
                  {placingOrder ? "Placing order…" : "Place order"}
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* ── MAIN STORE CONTENT ────────────────────────────────────────────────── */}
      {/* header */}
      <div style={{ padding:"20px 16px 0", maxWidth:640, margin:"0 auto" }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
          <div>
            <h1 style={{ fontSize:20, fontWeight:700, color:"#fff", margin:0 }}>Flex Store</h1>
            <p style={{ fontSize:12, color:"rgba(255,255,255,0.4)", margin:"2px 0 0" }}>
              Spend your Flex Coins
            </p>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ display:"flex", alignItems:"center", gap:5,
              background:"rgba(201,169,110,0.08)", borderRadius:20, padding:"5px 12px",
              border:"0.5px solid rgba(201,169,110,0.15)" }}>
              <Coins size={13} color={gold} />
              <span style={{ fontSize:12, fontWeight:600, color:gold }}>{balance.toLocaleString()}</span>
            </div>
            <button onClick={() => setCartOpen(true)} style={{
              position:"relative", background:"rgba(255,255,255,0.06)", border:"none",
              borderRadius:10, width:36, height:36, display:"flex", alignItems:"center",
              justifyContent:"center", cursor:"pointer" }}>
              <ShoppingCart size={16} color="rgba(255,255,255,0.7)" />
              {cartCount > 0 && (
                <span style={{ position:"absolute", top:-5, right:-5, background:gold,
                  color:"#000", fontSize:9, fontWeight:700, borderRadius:"50%",
                  width:17, height:17, display:"flex", alignItems:"center", justifyContent:"center" }}>
                  {cartCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* search */}
        <div style={{ position:"relative", marginBottom:12 }}>
          <Search size={14} color="rgba(255,255,255,0.3)"
            style={{ position:"absolute", left:11, top:"50%", transform:"translateY(-50%)" }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search stores…"
            style={{ width:"100%", background:"rgba(255,255,255,0.04)",
              border:"0.5px solid rgba(255,255,255,0.08)", borderRadius:10,
              padding:"9px 12px 9px 34px", fontSize:13, color:"#fff",
              outline:"none", boxSizing:"border-box" }}
          />
        </div>

        {/* category tabs */}
        <div style={{ display:"flex", gap:6, overflowX:"auto", paddingBottom:4, marginBottom:16 }}>
          {["All","Clothing","Performance","Nutrition","Equipment"].map(c => (
            <button key={c} onClick={() => setCategory(c)}
              style={{ flexShrink:0, padding:"5px 14px", borderRadius:20, border:"none",
                fontSize:12, cursor:"pointer",
                background: category===c ? gold : "rgba(255,255,255,0.05)",
                color: category===c ? "#000" : "rgba(255,255,255,0.5)",
                fontWeight: category===c ? 600 : 400 }}>
              {c}
            </button>
          ))}
        </div>

        {/* sort */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <span style={{ fontSize:11, color:"rgba(255,255,255,0.3)", flexShrink:0 }}>Sort by</span>
          {(["sales","rating","newest"] as const).map(s => (
            <button key={s} onClick={() => setSortBy(s)}
              style={{ padding:"3px 10px", borderRadius:20, border:"none", fontSize:11,
                cursor:"pointer",
                background: sortBy===s ? "rgba(201,169,110,0.15)" : "rgba(255,255,255,0.04)",
                color: sortBy===s ? gold : "rgba(255,255,255,0.4)",
                fontWeight: sortBy===s ? 600 : 400 }}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </button>
          ))}
        </div>

        {/* store grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(160px,1fr))", gap:12, paddingBottom:24 }}>
          {filtered.map(store => (
            <StoreCard key={store.id} store={store} onSelect={() => setSelectedStore(store)} />
          ))}
          {filtered.length === 0 && (
            <div style={{ gridColumn:"1/-1", textAlign:"center", padding:"40px 0",
              color:"rgba(255,255,255,0.25)", fontSize:13 }}>
              No stores found
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
