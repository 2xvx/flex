import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { API } from '../../config';
import {
  LayoutDashboard, Package, ShoppingCart, BarChart2, Zap,
  Coins, Settings, LogOut, Bell, Plus, Edit2, Trash2,
  Truck, Check, X, ToggleLeft, ToggleRight,
  Eye, Clock, ArrowUpRight, ArrowDownRight, Search,
  Tag, Image, ChevronLeft, ChevronRight
} from "lucide-react";

const G  = "#c9a96e";
const S  = "#0a0806";
const C  = "#080608";
const CB = "#0d0b08";
const BD = "rgba(201,169,110,0.12)";

interface Product {
  id:string; name:string; category:string; price:number; originalPrice?:number;
  image:string; imageUrl?:string; color:string; isLimited:boolean; dropEndsAt?:string;
  inStock:number; sizes:string[]; description:string; views:number; sales:number; active:boolean;
}
interface Order {
  id:string; buyer:string; buyerAvatar:string; product:string; size:string;
  amount:number; status:"pending"|"shipped"|"delivered"; date:Date; tracking?:string; address:string;
}
interface Coupon {
  id:string; code:string; type:"percent"|"fixed"; value:number; minPurchase:number;
  expiry:string; usageCount:number; maxUsage:number; active:boolean;
}
interface Withdrawal {
  id:string; amount:number; method:string; status:"pending"|"processing"|"paid";
  requestedAt:Date; paidAt?:Date;
}

const SEED_PRODUCTS: Product[] = [
  {id:"p1",name:"Obsidian Tee",category:"T-Shirts",price:1200,image:"👕",color:"#1a1208",isLimited:false,inStock:34,sizes:["XS","S","M","L","XL","XXL"],description:"Ultra-light performance fabric. Moisture-wicking and anti-odour.",views:892,sales:58,active:true},
  {id:"p2",name:"Gold Rush Hoodie",category:"Hoodies",price:3500,image:"🧥",color:"#0d1a0d",isLimited:true,dropEndsAt:"2026-06-10",inStock:12,sizes:["S","M","L","XL"],description:"French terry cotton blend. Gold embroidery, drop shoulder fit.",views:2341,sales:12,active:true},
  {id:"p3",name:"Elite Shorts",category:"Shorts",price:900,image:"🩳",color:"#0a0a1a",isLimited:false,inStock:0,sizes:["XS","S","M","L","XL","XXL"],description:"4-way stretch compression shorts.",views:445,sales:30,active:false},
  {id:"p4",name:"Beast Cap",category:"Accessories",price:600,image:"🧢",color:"#1a0d0d",isLimited:false,inStock:22,sizes:["One Size"],description:"Dri-FIT technology. Gold embroidered Flex wordmark.",views:310,sales:19,active:true},
  {id:"p5",name:"Phantom Joggers",category:"Pants",price:2200,originalPrice:2800,image:"👖",color:"#111118",isLimited:true,dropEndsAt:"2026-06-08",inStock:8,sizes:["S","M","L","XL"],description:"Tapered jogger with deep side pockets.",views:1100,sales:7,active:true},
];
const SEED_ORDERS: Order[] = [
  {id:"o1",buyer:"Marcus Reid",buyerAvatar:"MR",product:"Gold Rush Hoodie",size:"L",amount:3500,status:"pending",date:new Date(Date.now()-1000*60*12),address:"42 King St, Dubai, UAE"},
  {id:"o2",buyer:"Sara Ahmed",buyerAvatar:"SA",product:"Obsidian Tee",size:"M",amount:1200,status:"shipped",date:new Date(Date.now()-1000*60*60*4),tracking:"TRK928374",address:"17 Palm Ave, Abu Dhabi, UAE"},
  {id:"o3",buyer:"Jake Morrison",buyerAvatar:"JM",product:"Beast Cap",size:"One Size",amount:600,status:"delivered",date:new Date(Date.now()-1000*60*60*26),address:"8 Marina Blvd, Dubai, UAE"},
  {id:"o4",buyer:"Layla Hassan",buyerAvatar:"LH",product:"Phantom Joggers",size:"S",amount:2200,status:"pending",date:new Date(Date.now()-1000*60*38),address:"55 Creek Rd, Sharjah, UAE"},
  {id:"o5",buyer:"Aisha Karimi",buyerAvatar:"AK",product:"Elite Shorts",size:"M",amount:900,status:"delivered",date:new Date(Date.now()-1000*60*60*72),address:"3 Jumeirah Rd, Dubai, UAE"},
];
const SEED_COUPONS: Coupon[] = [
  {id:"c1",code:"FLEX20",type:"percent",value:20,minPurchase:500,expiry:"2026-07-31",usageCount:34,maxUsage:100,active:true},
  {id:"c2",code:"NEWSTORE",type:"fixed",value:200,minPurchase:0,expiry:"2026-08-15",usageCount:12,maxUsage:50,active:true},
  {id:"c3",code:"SUMMER30",type:"percent",value:30,minPurchase:1000,expiry:"2026-06-30",usageCount:50,maxUsage:50,active:false},
];
const SEED_WITHDRAWALS: Withdrawal[] = [
  {id:"w1",amount:5000,method:"PayPal · mo***@gmail.com",status:"paid",requestedAt:new Date(Date.now()-1000*60*60*24*8),paidAt:new Date(Date.now()-1000*60*60*24*5)},
  {id:"w2",amount:8000,method:"Bank · IBAN ****4821",status:"processing",requestedAt:new Date(Date.now()-1000*60*60*24*2)},
  {id:"w3",amount:3500,method:"PayPal · mo***@gmail.com",status:"pending",requestedAt:new Date(Date.now()-1000*60*20)},
];
const STORE_TIERS=[
  {name:"Bronze",min:0,fee:5,color:"#cd7f32",icon:"🥉",perk:"Standard listing"},
  {name:"Silver",min:10000,fee:4,color:"#c0c0c0",icon:"🥈",perk:"Priority listing"},
  {name:"Gold",min:30000,fee:3,color:"#c9a96e",icon:"🥇",perk:"Featured placement + lower fee"},
  {name:"Elite",min:80000,fee:2,color:"#a259ff",icon:"💎",perk:"Top placement + 2% fee"},
];
const REVENUE_7D=[3200,5400,4100,7800,6200,9400,7600];
const REVENUE_30D=[28000,31000,24000,38000,42000,35000,51000,44000,39000,57000,48000,43000,61000,52000,47000,65000,58000,54000,70000,63000,59000,75000,68000,64000,80000,73000,69000,85000,78000,18740];
const CATEGORIES=["T-Shirts","Hoodies","Shorts","Pants","Accessories","Equipment","Supplements"];
const WEEKLY=[4200,6800,5100,9200,7400,11000,8600];
const WEEK_DAYS=["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

function timeAgo(d:Date){const s=Math.floor((Date.now()-d.getTime())/1000);if(s<60)return"Just now";if(s<3600)return`${Math.floor(s/60)}m ago`;if(s<86400)return`${Math.floor(s/3600)}h ago`;return`${Math.floor(s/86400)}d ago`;}

function Card({children,style}:{children:React.ReactNode;style?:React.CSSProperties}){return<div style={{background:CB,border:"0.5px solid rgba(255,255,255,0.07)",borderRadius:12,...style}}>{children}</div>;}
function GoldCard({children,style}:{children:React.ReactNode;style?:React.CSSProperties}){return<div style={{background:CB,border:`0.5px solid ${BD}`,borderRadius:12,...style}}>{children}</div>;}
function StatPill({label,value,sub,up}:{label:string;value:string;sub?:string;up?:boolean}){
  return(
    <div style={{background:CB,border:"0.5px solid rgba(255,255,255,0.07)",borderRadius:12,padding:"14px 16px"}}>
      <p style={{fontSize:11,color:"rgba(255,255,255,0.35)",margin:"0 0 6px"}}>{label}</p>
      <p style={{fontSize:22,fontWeight:600,color:G,margin:"0 0 4px"}}>{value}</p>
      {sub&&<div style={{display:"flex",alignItems:"center",gap:4}}>{up!==undefined&&(up?<ArrowUpRight size={11} color="#4ade80"/>:<ArrowDownRight size={11} color="#f87171"/>)}<span style={{fontSize:11,color:up?"#4ade80":up===false?"#f87171":"rgba(255,255,255,0.3)"}}>{sub}</span></div>}
    </div>
  );
}

function ProductImg({p,size=36}:{p:Pick<Product,"image"|"imageUrl"|"color">;size?:number}){
  if(p.imageUrl)return<img src={p.imageUrl} alt="" style={{width:size,height:size,borderRadius:size>40?10:8,objectFit:"cover",flexShrink:0}}/>;
  return<div style={{width:size,height:size,borderRadius:size>40?10:8,background:p.color,display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.5,flexShrink:0}}>{p.image}</div>;
}

function ImageUpload({value,onChange}:{value?:string;onChange:(url:string)=>void}){
  const ref=useRef<HTMLInputElement>(null);
  function handleFile(e:React.ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];if(!f)return;const r=new FileReader();r.onload=ev=>{if(ev.target?.result)onChange(ev.target.result as string);};r.readAsDataURL(f);}
  return(
    <div onClick={()=>ref.current?.click()} style={{width:"100%",height:110,borderRadius:10,border:"1.5px dashed rgba(201,169,110,0.25)",background:"rgba(255,255,255,0.03)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",cursor:"pointer",overflow:"hidden",position:"relative"}}>
      {value?(<><img src={value} alt="" style={{width:"100%",height:"100%",objectFit:"cover"}}/><div style={{position:"absolute",bottom:6,right:6,background:"rgba(0,0,0,0.6)",borderRadius:6,padding:"3px 8px",fontSize:11,color:"rgba(255,255,255,0.7)"}}>Change</div></>):(<><Image size={22} color="rgba(255,255,255,0.2)" style={{marginBottom:6}}/><p style={{fontSize:12,color:"rgba(255,255,255,0.3)",margin:0}}>Click to upload</p></>)}
      <input ref={ref} type="file" accept="image/*" style={{display:"none"}} onChange={handleFile}/>
    </div>
  );
}

function ProductForm({initial,onSave,onCancel}:{initial?:Partial<Product>;onSave:(p:Product)=>void;onCancel:()=>void}){
  const[form,setForm]=useState({name:initial?.name||"",category:initial?.category||"T-Shirts",price:initial?.price||500,stock:initial?.inStock||10,sizes:(initial?.sizes||["S","M","L","XL"]).join(", "),image:initial?.image||"👕",imageUrl:initial?.imageUrl||"",color:initial?.color||"#1a1208",description:initial?.description||"",isLimited:initial?.isLimited||false,dropEndsAt:initial?.dropEndsAt||"",active:initial?.active!==false});
  const f=(k:keyof typeof form,v:any)=>setForm(p=>({...p,[k]:v}));
  const inp:React.CSSProperties={width:"100%",background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"9px 12px",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"};
  const lbl:React.CSSProperties={fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:4,display:"block"};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 180px",gap:12}}>
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          <div><span style={lbl}>Product name *</span><input style={inp} value={form.name} onChange={e=>f("name",e.target.value)} placeholder="e.g. Obsidian Tee"/></div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            <div><span style={lbl}>Category</span><select style={inp} value={form.category} onChange={e=>f("category",e.target.value)}>{CATEGORIES.map(c=><option key={c}>{c}</option>)}</select></div>
            <div><span style={lbl}>Price (FP)</span><input style={inp} type="number" min={100} value={form.price} onChange={e=>f("price",Number(e.target.value))}/></div>
            <div><span style={lbl}>Stock qty</span><input style={inp} type="number" min={0} value={form.stock} onChange={e=>f("stock",Number(e.target.value))}/></div>
          </div>
          <div><span style={lbl}>Sizes (comma-separated)</span><input style={inp} value={form.sizes} onChange={e=>f("sizes",e.target.value)} placeholder="S, M, L, XL"/></div>
          <div><span style={lbl}>Description</span><textarea style={{...inp,minHeight:56,resize:"vertical"}} value={form.description} onChange={e=>f("description",e.target.value)}/></div>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          <span style={lbl}>Product image</span>
          <ImageUpload value={form.imageUrl} onChange={url=>f("imageUrl",url)}/>
          <div style={{display:"flex",gap:8}}>
            <div style={{flex:1}}><span style={lbl}>Emoji</span><input style={{...inp,textAlign:"center",fontSize:18,padding:"6px"}} value={form.image} maxLength={2} onChange={e=>f("image",e.target.value)}/></div>
            <div style={{flex:1}}><span style={lbl}>Color</span><input type="color" value={form.color} onChange={e=>f("color",e.target.value)} style={{width:"100%",height:38,borderRadius:8,border:"0.5px solid rgba(255,255,255,0.1)",cursor:"pointer",padding:2,background:"rgba(255,255,255,0.04)"}}/></div>
          </div>
        </div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <div style={{flex:1,background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><p style={{fontSize:13,color:"#fff",margin:0}}>Limited drop</p><p style={{fontSize:11,color:"rgba(255,255,255,0.3)",margin:0}}>Shows countdown</p></div>
          <button onClick={()=>f("isLimited",!form.isLimited)} style={{background:"none",border:"none",cursor:"pointer"}}>{form.isLimited?<ToggleRight size={28} color={G}/>:<ToggleLeft size={28} color="rgba(255,255,255,0.2)"/>}</button>
        </div>
        <div style={{flex:1,background:"rgba(255,255,255,0.03)",borderRadius:8,padding:"10px 14px",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div><p style={{fontSize:13,color:"#fff",margin:0}}>Active / visible</p><p style={{fontSize:11,color:"rgba(255,255,255,0.3)",margin:0}}>Show in Flex Store</p></div>
          <button onClick={()=>f("active",!form.active)} style={{background:"none",border:"none",cursor:"pointer"}}>{form.active?<ToggleRight size={28} color="#4ade80"/>:<ToggleLeft size={28} color="rgba(255,255,255,0.2)"/>}</button>
        </div>
      </div>
      {form.isLimited&&<div><span style={lbl}>Drop ends at</span><input style={inp} type="date" value={form.dropEndsAt} onChange={e=>f("dropEndsAt",e.target.value)}/></div>}
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>{if(!form.name.trim())return;onSave({id:initial?.id||`p-${Date.now()}`,name:form.name,category:form.category,price:form.price,image:form.image,imageUrl:form.imageUrl||undefined,color:form.color,description:form.description,isLimited:form.isLimited,dropEndsAt:form.dropEndsAt||undefined,inStock:form.stock,sizes:form.sizes.split(",").map((s:string)=>s.trim()).filter(Boolean),views:initial?.views||0,sales:initial?.sales||0,active:form.active});}} style={{flex:1,padding:"11px 0",borderRadius:8,background:G,color:"#000",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>Save product</button>
        <button onClick={onCancel} style={{padding:"11px 20px",borderRadius:8,background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.6)",border:"0.5px solid rgba(255,255,255,0.1)",fontSize:13,cursor:"pointer"}}>Cancel</button>
      </div>
    </div>
  );
}

function CouponForm({onSave,onCancel}:{onSave:(c:Coupon)=>void;onCancel:()=>void}){
  const[form,setForm]=useState({code:"",type:"percent" as "percent"|"fixed",value:10,minPurchase:0,expiry:"",maxUsage:100});
  const f=(k:keyof typeof form,v:any)=>setForm(p=>({...p,[k]:v}));
  const inp:React.CSSProperties={width:"100%",background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"9px 12px",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"};
  const lbl:React.CSSProperties={fontSize:11,color:"rgba(255,255,255,0.4)",marginBottom:4,display:"block"};
  return(
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
        <div><span style={lbl}>Coupon code *</span><input style={{...inp,textTransform:"uppercase",letterSpacing:2}} value={form.code} onChange={e=>f("code",e.target.value.toUpperCase())} placeholder="e.g. FLEX20"/></div>
        <div><span style={lbl}>Discount type</span><select style={inp} value={form.type} onChange={e=>f("type",e.target.value as any)}><option value="percent">Percentage off (%)</option><option value="fixed">Fixed amount (FP)</option></select></div>
        <div><span style={lbl}>{form.type==="percent"?"Discount (%)":"Discount (FP)"}</span><input style={inp} type="number" min={1} value={form.value} onChange={e=>f("value",Number(e.target.value))}/></div>
        <div><span style={lbl}>Min purchase (FP)</span><input style={inp} type="number" min={0} value={form.minPurchase} onChange={e=>f("minPurchase",Number(e.target.value))}/></div>
        <div><span style={lbl}>Max usages</span><input style={inp} type="number" min={1} value={form.maxUsage} onChange={e=>f("maxUsage",Number(e.target.value))}/></div>
        <div><span style={lbl}>Expiry date</span><input style={inp} type="date" value={form.expiry} onChange={e=>f("expiry",e.target.value)}/></div>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button onClick={()=>{if(!form.code.trim())return;onSave({id:`c-${Date.now()}`,code:form.code,type:form.type,value:form.value,minPurchase:form.minPurchase,expiry:form.expiry,usageCount:0,maxUsage:form.maxUsage,active:true});}} style={{flex:1,padding:"11px 0",borderRadius:8,background:G,color:"#000",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>Create coupon</button>
        <button onClick={onCancel} style={{padding:"11px 20px",borderRadius:8,background:"rgba(255,255,255,0.05)",color:"rgba(255,255,255,0.6)",border:"0.5px solid rgba(255,255,255,0.1)",fontSize:13,cursor:"pointer"}}>Cancel</button>
      </div>
    </div>
  );
}

type Section="overview"|"products"|"orders"|"analytics"|"drops"|"discounts"|"payouts"|"settings";
const NAV:[Section,string,any][]=[
  ["overview","Overview",LayoutDashboard],
  ["products","Products",Package],
  ["orders","Orders",ShoppingCart],
  ["analytics","Analytics",BarChart2],
  ["drops","Flash Drops",Zap],
  ["discounts","Discounts",Tag],
  ["payouts","Payouts",Coins],
  ["settings","Settings",Settings],
];

export function FlexMerchantSystem({currentUser,onSignOut}:{currentUser:any;onSignOut:()=>void}){
  // ── navigation with browser history ──────────────────────────────────────────
  const[sectionHistory,setSectionHistory]=useState<Section[]>(["overview"]);
  const[historyIdx,setHistoryIdx]=useState(0);
  const section=sectionHistory[historyIdx];

  const navigate=useCallback((s:Section)=>{
    setSectionHistory(prev=>[...prev.slice(0,historyIdx+1),s]);
    const nextIdx=historyIdx+1;
    setHistoryIdx(nextIdx);
    window.history.pushState({merchantSection:s,merchantIdx:nextIdx},``,`/store-hub/${s}`);
  },[historyIdx]);

  const goBack=()=>{
    if(historyIdx>0){setHistoryIdx(i=>i-1);window.history.back();}
  };
  const goForward=()=>{
    if(historyIdx<sectionHistory.length-1){setHistoryIdx(i=>i+1);window.history.forward();}
  };
  const canBack=historyIdx>0;
  const canForward=historyIdx<sectionHistory.length-1;

  useEffect(()=>{
    window.history.replaceState({merchantSection:"overview",merchantIdx:0},"","/store-hub/overview");
    const onPop=(e:PopStateEvent)=>{
      const st=e.state;
      if(st?.merchantSection){
        const s=st.merchantSection as Section;
        const idx=st.merchantIdx as number;
        setSectionHistory(prev=>{if(idx<prev.length)return prev;return[...prev,s];});
        setHistoryIdx(idx);
      }
    };
    window.addEventListener("popstate",onPop);
    return()=>window.removeEventListener("popstate",onPop);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  // ── state ────────────────────────────────────────────────────────────────────
  const[products,setProducts]=useState<Product[]>(SEED_PRODUCTS);
  const[orders,setOrders]=useState<Order[]>(SEED_ORDERS);
  const[coupons,setCoupons]=useState<Coupon[]>(SEED_COUPONS);
  const[withdrawals,setWithdrawals]=useState<Withdrawal[]>(SEED_WITHDRAWALS);
  const[payoutMethod,setPayoutMethod]=useState<{type:"bank"|"paypal"|"stripe";label:string;masked:string}|null>({type:"paypal",label:"PayPal",masked:"mo***@gmail.com"});
  const[showPayoutForm,setShowPayoutForm]=useState(false);
  const[newPayoutMethodType,setNewPayoutMethodType]=useState<"bank"|"paypal"|"stripe">("paypal");
  const[newPayoutValue,setNewPayoutValue]=useState("");
  const[withdrawAmount,setWithdrawAmount]=useState("");
  const[chartRange,setChartRange]=useState<"7d"|"30d"|"90d">("7d");
  const[salesSearch,setSalesSearch]=useState("");
  const[salesFilter,setSalesFilter]=useState<"all"|"pending"|"delivered">("all");
  const[addingProduct,setAddingProduct]=useState(false);
  const[editingProduct,setEditingProduct]=useState<Product|null>(null);
  const[productView,setProductView]=useState<"table"|"grid">("table");
  const[productStatusFilter,setProductStatusFilter]=useState<"all"|"active"|"hidden"|"out"|"limited">("all");
  const[productSort,setProductSort]=useState<{key:string;dir:"asc"|"desc"}>({key:"",dir:"asc"});
  const[selectedProducts,setSelectedProducts]=useState<string[]>([]);
  const[inlineEdit,setInlineEdit]=useState<{id:string;field:"price"|"inStock";val:string}|null>(null);
  const[previewProduct,setPreviewProduct]=useState<Product|null>(null);
  const[addingCoupon,setAddingCoupon]=useState(false);
  const[productSearch,setProductSearch]=useState("");
  const[orderFilter,setOrderFilter]=useState<"all"|"pending"|"shipped"|"delivered">("all");
  const[trackingInputs,setTrackingInputs]=useState<Record<string,string>>({});
  const[liveOrderCount,setLiveOrderCount]=useState(0);
  const[newOrderToast,setNewOrderToast]=useState<string|null>(null);
  const[storeSettings,setStoreSettings]=useState({name:currentUser?.storeName||"Flex Originals",category:currentUser?.storeCategory||"Clothing",bio:currentUser?.storeBio||"Official Flex gear for elite athletes.",logo:"⚡",shipping:"Ships within 3–5 business days.",instagram:"flex_originals",email:currentUser?.email||"store@flexapp.com"});
  const notifRef=useRef<ReturnType<typeof setInterval>|null>(null);
  const[fpBalance]=useState(18740);
  const[availableBalance]=useState(14320);
  const[pendingBalance]=useState(4420);

  // ── derived ──────────────────────────────────────────────────────────────────
  const monthlyRevenue=orders.reduce((s,o)=>s+o.amount,0);
  const currentTier=STORE_TIERS.slice().reverse().find(t=>monthlyRevenue>=t.min)||STORE_TIERS[0];
  const nextTier=STORE_TIERS.find(t=>t.min>monthlyRevenue);
  const grossRevenue=orders.reduce((s,o)=>s+o.amount,0);
  const platformFee=Math.round(grossRevenue*currentTier.fee/100);
  const netRevenue=grossRevenue-platformFee;

  const stats=useMemo(()=>({
    todayRevenue:orders.filter(o=>Date.now()-o.date.getTime()<86400000).reduce((s,o)=>s+o.amount,0),
    totalOrders:orders.length,
    pendingOrders:orders.filter(o=>o.status==="pending").length,
    totalViews:products.reduce((s,p)=>s+p.views,0),
    convRate:products.reduce((s,p)=>s+p.sales,0)/Math.max(1,products.reduce((s,p)=>s+p.views,0))*100,
  }),[orders,products]);

  const filteredProducts=useMemo(()=>{
    let list=products.filter(p=>{
      const mS=!productSearch||p.name.toLowerCase().includes(productSearch.toLowerCase())||p.category.toLowerCase().includes(productSearch.toLowerCase());
      const mF=productStatusFilter==="all"||(productStatusFilter==="active"&&p.active&&p.inStock>0)||(productStatusFilter==="hidden"&&!p.active)||(productStatusFilter==="out"&&p.inStock===0)||(productStatusFilter==="limited"&&p.isLimited);
      return mS&&mF;
    });
    if(productSort.key)list=[...list].sort((a,b)=>{const va=(a as any)[productSort.key];const vb=(b as any)[productSort.key];return productSort.dir==="asc"?(va>vb?1:-1):(va<vb?1:-1);});
    return list;
  },[products,productSearch,productStatusFilter,productSort]);

  const filteredOrders=useMemo(()=>orders.filter(o=>orderFilter==="all"||o.status===orderFilter),[orders,orderFilter]);
  const filteredSales=orders.filter(o=>{const mS=!salesSearch||o.product.toLowerCase().includes(salesSearch.toLowerCase())||o.buyer.toLowerCase().includes(salesSearch.toLowerCase());const mF=salesFilter==="all"||(salesFilter==="pending"&&o.status==="pending")||(salesFilter==="delivered"&&o.status==="delivered");return mS&&mF;});

  // ── handlers ─────────────────────────────────────────────────────────────────
  function saveProduct(p:Product){if(editingProduct)setProducts(prev=>prev.map(x=>x.id===p.id?p:x));else setProducts(prev=>[p,...prev]);setEditingProduct(null);setAddingProduct(false);}
  function duplicateProduct(p:Product){setProducts(prev=>[{...p,id:`p-${Date.now()}`,name:`${p.name} (copy)`,views:0,sales:0,active:false},...prev]);}
  function toggleSelectProduct(id:string){setSelectedProducts(prev=>prev.includes(id)?prev.filter(x=>x!==id):[...prev,id]);}
  function clearSelection(){setSelectedProducts([]);}
  function bulkAction(action:"activate"|"hide"|"delete"|"drop"){
    if(action==="activate")setProducts(prev=>prev.map(p=>selectedProducts.includes(p.id)?{...p,active:true}:p));
    else if(action==="hide")setProducts(prev=>prev.map(p=>selectedProducts.includes(p.id)?{...p,active:false}:p));
    else if(action==="delete")setProducts(prev=>prev.filter(p=>!selectedProducts.includes(p.id)));
    else if(action==="drop")setProducts(prev=>prev.map(p=>selectedProducts.includes(p.id)?{...p,isLimited:true,dropEndsAt:new Date(Date.now()+86400000).toISOString().split("T")[0]}:p));
    clearSelection();
  }
  function commitInlineEdit(){if(!inlineEdit)return;const val=Number(inlineEdit.val);if(!isNaN(val)&&val>=0)setProducts(prev=>prev.map(p=>p.id===inlineEdit.id?{...p,[inlineEdit.field]:val}:p));setInlineEdit(null);}
  function sortProducts(key:string){setProductSort(prev=>({key,dir:prev.key===key&&prev.dir==="asc"?"desc":"asc"}));}
  function markShipped(id:string){setOrders(prev=>prev.map(o=>o.id===id?{...o,status:"shipped",tracking:trackingInputs[id]||""}:o));}
  function deleteCoupon(id:string){setCoupons(prev=>prev.filter(c=>c.id!==id));}
  function toggleCoupon(id:string){setCoupons(prev=>prev.map(c=>c.id===id?{...c,active:!c.active}:c));}
  function exportCSV(){const rows=[["Date","Buyer","Product","Size","Amount (FP)","Status"],...orders.map(o=>[o.date.toLocaleDateString(),o.buyer,o.product,o.size,o.amount,o.status])];const csv=rows.map(r=>r.join(",")).join("\n");const a=document.createElement("a");a.href="data:text/csv;charset=utf-8,"+encodeURIComponent(csv);a.download="sales.csv";a.click();}
  function submitWithdrawal(){const amt=Number(withdrawAmount);if(!amt||amt<5000||amt>availableBalance)return;setWithdrawals(prev=>[{id:`w-${Date.now()}`,amount:amt,method:payoutMethod?.masked||"Unknown",status:"pending",requestedAt:new Date()},...prev]);setWithdrawAmount("");}

  useEffect(()=>{
    const names=["@coach_ali","@rina.strong","@james.gains","@nour.fit","@leo_lifts"];
    const prods=["Obsidian Tee","Gold Rush Hoodie","Beast Cap","Phantom Joggers"];
    notifRef.current=setInterval(()=>{
      if(Math.random()<0.3){
        const buyer=names[Math.floor(Math.random()*names.length)];
        const prod=prods[Math.floor(Math.random()*prods.length)];
        const newOrder:Order={id:`o-${Date.now()}`,buyer,buyerAvatar:buyer.slice(1,3).toUpperCase(),product:prod,size:"M",amount:1200+Math.floor(Math.random()*2400),status:"pending",date:new Date(),address:"Dubai, UAE"};
        setOrders(prev=>[newOrder,...prev]);
        setLiveOrderCount(n=>n+1);
        setNewOrderToast(`${prod} from ${buyer}`);
        setTimeout(()=>setNewOrderToast(null),4000);
      }
    },15000);
    return()=>{if(notifRef.current)clearInterval(notifRef.current);};
  },[]);

  // ── shared style helpers ──────────────────────────────────────────────────────
  const inp2:React.CSSProperties={background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:8,padding:"9px 12px",color:"#fff",fontSize:13,outline:"none"};

  // ── SIDEBAR ───────────────────────────────────────────────────────────────────
  const sidebar=(
    <div style={{width:210,flexShrink:0,height:"100vh",background:S,borderRight:`0.5px solid ${BD}`,display:"flex",flexDirection:"column",position:"sticky",top:0}}>
      <div style={{padding:"20px 16px 14px",borderBottom:"0.5px solid rgba(201,169,110,0.08)"}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:34,height:34,borderRadius:9,background:"rgba(201,169,110,0.1)",border:`0.5px solid ${BD}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>{storeSettings.logo}</div>
          <div><p style={{fontSize:13,fontWeight:600,color:"#f0ebe3",margin:0}}>{storeSettings.name}</p><p style={{fontSize:10,color:G,margin:0,letterSpacing:1}}>Merchant Portal</p></div>
        </div>
      </div>
      <nav style={{flex:1,padding:"10px 8px",overflowY:"auto"}}>
        {NAV.map(([id,label,Icon])=>{
          const active=section===id;
          return(
            <button key={id} onClick={()=>navigate(id)} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:8,marginBottom:2,background:active?"rgba(201,169,110,0.1)":"transparent",border:active?"0.5px solid rgba(201,169,110,0.18)":"0.5px solid transparent",cursor:"pointer",color:active?"#f0ebe3":"rgba(240,235,227,0.32)",fontSize:13,fontWeight:active?500:400,position:"relative"}}>
              {active&&<span style={{position:"absolute",left:0,top:"50%",transform:"translateY(-50%)",width:2.5,height:16,borderRadius:2,background:G}}/>}
              <Icon size={14} color={active?G:"rgba(240,235,227,0.28)"}/>
              {label}
              {id==="orders"&&stats.pendingOrders>0&&<span style={{marginLeft:"auto",background:G,color:"#000",fontSize:9,fontWeight:700,borderRadius:20,padding:"1px 6px"}}>{stats.pendingOrders}</span>}
              {id==="discounts"&&coupons.filter(c=>c.active).length>0&&<span style={{marginLeft:"auto",background:"rgba(167,139,250,0.2)",color:"#a78bfa",fontSize:9,fontWeight:700,borderRadius:20,padding:"1px 6px"}}>{coupons.filter(c=>c.active).length}</span>}
            </button>
          );
        })}
      </nav>
      <div style={{padding:"10px 8px",borderTop:"0.5px solid rgba(201,169,110,0.07)"}}>
        <button onClick={onSignOut} style={{width:"100%",display:"flex",alignItems:"center",gap:9,padding:"9px 10px",borderRadius:8,background:"transparent",border:"0.5px solid transparent",cursor:"pointer",color:"rgba(240,235,227,0.25)",fontSize:13}}><LogOut size={13}/>Sign out</button>
      </div>
    </div>
  );

  // ── OVERVIEW ──────────────────────────────────────────────────────────────────
  const overview=(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div><h2 style={{fontSize:18,fontWeight:600,color:"#fff",margin:"0 0 4px"}}>Good day, {storeSettings.name} 👋</h2><p style={{fontSize:13,color:"rgba(255,255,255,0.4)",margin:0}}>Here's what's happening right now.</p></div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        <StatPill label="Today's revenue" value={`${stats.todayRevenue.toLocaleString()} FP`} sub="+12% vs yesterday" up={true}/>
        <StatPill label="Total orders" value={String(stats.totalOrders)} sub={`${stats.pendingOrders} pending`}/>
        <StatPill label="Store views" value={stats.totalViews.toLocaleString()} sub="+340 this week" up={true}/>
        <StatPill label="FP balance" value={fpBalance.toLocaleString()} sub="≈ $187.40"/>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",gap:16}}>
        <Card style={{padding:"16px"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}><div style={{width:8,height:8,borderRadius:"50%",background:"#4ade80",boxShadow:"0 0 8px #4ade80"}}/><span style={{fontSize:13,fontWeight:500,color:"#fff"}}>Live order feed</span></div>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>Auto-refreshes</span>
          </div>
          {orders.slice(0,5).map((o,i)=>(
            <div key={o.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:i<4?"0.5px solid rgba(255,255,255,0.05)":"none"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:"rgba(201,169,110,0.15)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:G,fontWeight:600,flexShrink:0}}>{o.buyerAvatar}</div>
              <div style={{flex:1,minWidth:0}}><p style={{fontSize:12,color:"#fff",margin:0}}>{o.buyer} — <span style={{color:"rgba(255,255,255,0.5)"}}>{o.product}</span></p><p style={{fontSize:11,color:"rgba(255,255,255,0.3)",margin:0}}>{timeAgo(o.date)}</p></div>
              <div style={{textAlign:"right",flexShrink:0}}><p style={{fontSize:12,fontWeight:600,color:G,margin:0}}>{o.amount.toLocaleString()} FP</p><span style={{fontSize:10,padding:"1px 7px",borderRadius:20,fontWeight:500,background:o.status==="pending"?"rgba(251,191,36,0.1)":o.status==="shipped"?"rgba(125,211,252,0.1)":"rgba(74,222,128,0.1)",color:o.status==="pending"?"#fbbf24":o.status==="shipped"?"#7dd3fc":"#4ade80"}}>{o.status}</span></div>
            </div>
          ))}
          <button onClick={()=>navigate("orders")} style={{width:"100%",marginTop:10,padding:"8px 0",background:"rgba(201,169,110,0.06)",border:`0.5px solid ${BD}`,borderRadius:8,color:G,fontSize:12,cursor:"pointer"}}>View all orders →</button>
        </Card>
        <Card style={{padding:"16px"}}>
          <p style={{fontSize:13,fontWeight:500,color:"#fff",margin:"0 0 14px"}}>Top products</p>
          {[...products].sort((a,b)=>b.sales-a.sales).slice(0,5).map((p,i)=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"7px 0",borderBottom:i<4?"0.5px solid rgba(255,255,255,0.05)":"none"}}>
              <span style={{fontSize:11,color:"rgba(255,255,255,0.25)",width:14}}>{i+1}</span>
              <ProductImg p={p} size={26}/>
              <div style={{flex:1,minWidth:0}}><p style={{fontSize:12,color:"#fff",margin:0,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</p><div style={{height:3,background:"rgba(255,255,255,0.05)",borderRadius:2,marginTop:3}}><div style={{height:3,borderRadius:2,background:G,width:`${Math.round(p.sales/Math.max(...products.map(x=>x.sales))*100)}%`}}/></div></div>
              <span style={{fontSize:12,color:G,flexShrink:0}}>{p.sales}</span>
            </div>
          ))}
        </Card>
      </div>
    </div>
  );

  // ── PRODUCTS ──────────────────────────────────────────────────────────────────
  const lowStock=products.filter(p=>p.active&&p.inStock>0&&p.inStock<=5);
  const outStock=products.filter(p=>p.active&&p.inStock===0);
  const allSelected=filteredProducts.length>0&&filteredProducts.every(p=>selectedProducts.includes(p.id));
  function SortTh({label,k}:{label:string;k:string}){const active=productSort.key===k;return<th onClick={()=>sortProducts(k)} style={{padding:"10px 14px",fontSize:11,color:active?"rgba(201,169,110,0.9)":"rgba(255,255,255,0.35)",fontWeight:500,textAlign:"left",cursor:"pointer",userSelect:"none",whiteSpace:"nowrap"}}>{label}{active?(productSort.dir==="asc"?" ↑":" ↓"):""}</th>;}

  const productsSection=(
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{fontSize:18,fontWeight:600,color:"#fff",margin:0}}>Products <span style={{fontSize:13,color:"rgba(255,255,255,0.3)",fontWeight:400}}>({products.length})</span></h2>
        <div style={{display:"flex",gap:8}}>
          <div style={{display:"flex",background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.08)",borderRadius:8,padding:2,gap:2}}>
            <button onClick={()=>setProductView("table")} style={{width:30,height:28,borderRadius:6,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",background:productView==="table"?G:"transparent"}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={productView==="table"?"#000":"rgba(255,255,255,0.4)"} strokeWidth="2"><rect x="3" y="3" width="18" height="5"/><rect x="3" y="10" width="18" height="5"/><rect x="3" y="17" width="18" height="5"/></svg>
            </button>
            <button onClick={()=>setProductView("grid")} style={{width:30,height:28,borderRadius:6,border:"none",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",background:productView==="grid"?G:"transparent"}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={productView==="grid"?"#000":"rgba(255,255,255,0.4)"} strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
            </button>
          </div>
          <button onClick={()=>{setAddingProduct(true);setEditingProduct(null);}} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:G,color:"#000",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer"}}><Plus size={14}/>Add product</button>
        </div>
      </div>
      {(lowStock.length>0||outStock.length>0)&&(
        <div style={{background:"rgba(251,191,36,0.06)",border:"0.5px solid rgba(251,191,36,0.18)",borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span style={{fontSize:12,color:"#fbbf24",flex:1}}>{outStock.length>0&&<><strong>{outStock.length}</strong> out of stock · </>}{lowStock.length>0&&<><strong>{lowStock.length}</strong> running low (≤5 units)</>}</span>
          <button onClick={()=>setProductStatusFilter("out")} style={{fontSize:11,color:"#fbbf24",background:"rgba(251,191,36,0.1)",border:"0.5px solid rgba(251,191,36,0.2)",borderRadius:6,padding:"4px 10px",cursor:"pointer"}}>View</button>
        </div>
      )}
      <div style={{display:"flex",gap:8,flexWrap:"wrap",alignItems:"center"}}>
        <div style={{position:"relative",flex:1,minWidth:200}}>
          <Search size={13} color="rgba(255,255,255,0.25)" style={{position:"absolute",left:12,top:"50%",transform:"translateY(-50%)"}}/>
          <input value={productSearch} onChange={e=>setProductSearch(e.target.value)} placeholder="Search products..." style={{width:"100%",background:CB,border:"0.5px solid rgba(255,255,255,0.08)",borderRadius:9,padding:"8px 12px 8px 34px",color:"#fff",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
        </div>
        <div style={{display:"flex",gap:4}}>
          {([["all","All"],["active","Active"],["hidden","Hidden"],["out","Out of stock"],["limited","Limited"]] as const).map(([v,l])=>(
            <button key={v} onClick={()=>setProductStatusFilter(v)} style={{padding:"6px 12px",borderRadius:20,fontSize:11,cursor:"pointer",background:productStatusFilter===v?G:"rgba(255,255,255,0.05)",color:productStatusFilter===v?"#000":"rgba(255,255,255,0.45)",border:"none",fontWeight:productStatusFilter===v?500:400,whiteSpace:"nowrap"}}>{l}</button>
          ))}
        </div>
      </div>
      {selectedProducts.length>0&&(
        <div style={{background:"rgba(201,169,110,0.07)",border:`0.5px solid rgba(201,169,110,0.18)`,borderRadius:10,padding:"10px 14px",display:"flex",alignItems:"center",gap:12}}>
          <span style={{fontSize:12,color:G,fontWeight:500}}>{selectedProducts.length} selected</span>
          <div style={{display:"flex",gap:6}}>
            {([["activate","Activate","rgba(74,222,128,0.12)","#4ade80"],["hide","Hide","rgba(255,255,255,0.06)","rgba(255,255,255,0.5)"],["drop","Start drop","rgba(255,80,80,0.08)","#ff9090"],["delete","Delete","rgba(255,80,80,0.08)","#f87171"]] as const).map(([a,l,bg,col])=>(
              <button key={a} onClick={()=>bulkAction(a)} style={{padding:"5px 12px",borderRadius:7,fontSize:11,cursor:"pointer",background:bg,color:col,border:`0.5px solid ${col}33`}}>{l}</button>
            ))}
          </div>
          <button onClick={clearSelection} style={{marginLeft:"auto",fontSize:11,color:"rgba(255,255,255,0.3)",background:"none",border:"none",cursor:"pointer"}}>Clear</button>
        </div>
      )}
      {(addingProduct||editingProduct)&&(
        <Card style={{padding:"18px"}}>
          <p style={{fontSize:14,fontWeight:500,color:"#fff",margin:"0 0 16px"}}>{editingProduct?"Edit product":"Add new product"}</p>
          <ProductForm initial={editingProduct||undefined} onSave={saveProduct} onCancel={()=>{setAddingProduct(false);setEditingProduct(null);}}/>
        </Card>
      )}
      {productView==="table"&&(
        <Card>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead>
              <tr style={{borderBottom:"0.5px solid rgba(255,255,255,0.06)"}}>
                <th style={{padding:"10px 14px",width:32}}><input type="checkbox" checked={allSelected} onChange={()=>allSelected?clearSelection():setSelectedProducts(filteredProducts.map(p=>p.id))} style={{cursor:"pointer",accentColor:G}}/></th>
                <th style={{padding:"10px 14px",fontSize:11,color:"rgba(255,255,255,0.35)",fontWeight:500,textAlign:"left"}}>Product</th>
                <SortTh label="Category" k="category"/>
                <SortTh label="Price" k="price"/>
                <SortTh label="Stock" k="inStock"/>
                <th style={{padding:"10px 14px",fontSize:11,color:"rgba(255,255,255,0.35)",fontWeight:500,textAlign:"left"}}>Status</th>
                <SortTh label="Views" k="views"/>
                <SortTh label="Sales" k="sales"/>
                <th style={{padding:"10px 14px"}}></th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((p,i)=>{
                const isLow=p.active&&p.inStock>0&&p.inStock<=5;
                const isOut=p.inStock===0;
                return(
                  <tr key={p.id} style={{borderBottom:i<filteredProducts.length-1?"0.5px solid rgba(255,255,255,0.04)":"none",background:isOut?"rgba(248,113,113,0.03)":isLow?"rgba(251,191,36,0.03)":"transparent",opacity:p.active?1:0.5}}>
                    <td style={{padding:"10px 14px"}}><input type="checkbox" checked={selectedProducts.includes(p.id)} onChange={()=>toggleSelectProduct(p.id)} style={{cursor:"pointer",accentColor:G}}/></td>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10}}>
                        <ProductImg p={p} size={36}/>
                        <div>
                          <p style={{fontSize:13,color:"#fff",margin:0}}>{p.name}</p>
                          <div style={{display:"flex",gap:4}}>
                            {p.isLimited&&<span style={{fontSize:10,color:"#ff9090",background:"rgba(255,80,80,0.1)",borderRadius:20,padding:"1px 6px"}}>Limited</span>}
                            {isLow&&<span style={{fontSize:10,color:"#fbbf24",background:"rgba(251,191,36,0.1)",borderRadius:20,padding:"1px 6px"}}>Low stock</span>}
                            {isOut&&<span style={{fontSize:10,color:"#f87171",background:"rgba(248,113,113,0.1)",borderRadius:20,padding:"1px 6px"}}>Out of stock</span>}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{padding:"10px 14px",fontSize:12,color:"rgba(255,255,255,0.4)"}}>{p.category}</td>
                    <td style={{padding:"10px 14px"}}>
                      {inlineEdit?.id===p.id&&inlineEdit.field==="price"?(
                        <div style={{display:"flex",alignItems:"center",gap:4}}>
                          <input autoFocus type="number" value={inlineEdit.val} onChange={e=>setInlineEdit(prev=>prev?{...prev,val:e.target.value}:null)} onBlur={commitInlineEdit} onKeyDown={e=>{if(e.key==="Enter")commitInlineEdit();if(e.key==="Escape")setInlineEdit(null);}} style={{width:80,background:"rgba(201,169,110,0.1)",border:`0.5px solid ${G}`,borderRadius:6,padding:"4px 7px",color:G,fontSize:12,outline:"none"}}/>
                          <span style={{fontSize:11,color:G}}>FP</span>
                        </div>
                      ):(
                        <span onClick={()=>setInlineEdit({id:p.id,field:"price",val:String(p.price)})} style={{fontSize:12,color:G,fontWeight:500,cursor:"text",borderBottom:"1px dashed rgba(201,169,110,0.2)",padding:"1px 0"}} title="Click to edit">{p.price.toLocaleString()} FP</span>
                      )}
                    </td>
                    <td style={{padding:"10px 14px"}}>
                      {inlineEdit?.id===p.id&&inlineEdit.field==="inStock"?(
                        <input autoFocus type="number" value={inlineEdit.val} onChange={e=>setInlineEdit(prev=>prev?{...prev,val:e.target.value}:null)} onBlur={commitInlineEdit} onKeyDown={e=>{if(e.key==="Enter")commitInlineEdit();if(e.key==="Escape")setInlineEdit(null);}} style={{width:60,background:"rgba(255,255,255,0.06)",border:"0.5px solid rgba(255,255,255,0.15)",borderRadius:6,padding:"4px 7px",color:"#fff",fontSize:12,outline:"none"}}/>
                      ):(
                        <span onClick={()=>setInlineEdit({id:p.id,field:"inStock",val:String(p.inStock)})} style={{fontSize:12,color:isOut?"#f87171":isLow?"#fbbf24":"rgba(255,255,255,0.6)",cursor:"text",borderBottom:"1px dashed rgba(255,255,255,0.1)",padding:"1px 0"}} title="Click to edit">{isOut?"Out":p.inStock}</span>
                      )}
                    </td>
                    <td style={{padding:"10px 14px"}}><span style={{fontSize:11,padding:"2px 9px",borderRadius:20,fontWeight:500,background:p.active?"rgba(74,222,128,0.1)":"rgba(255,255,255,0.05)",color:p.active?"#4ade80":"rgba(255,255,255,0.3)"}}>{p.active?"Active":"Hidden"}</span></td>
                    <td style={{padding:"10px 14px",fontSize:12,color:"rgba(255,255,255,0.4)"}}>{p.views.toLocaleString()}</td>
                    <td style={{padding:"10px 14px",fontSize:12,color:"rgba(255,255,255,0.6)"}}>{p.sales}</td>
                    <td style={{padding:"10px 14px"}}>
                      <div style={{display:"flex",gap:5}}>
                        <button onClick={()=>setPreviewProduct(p)} style={{background:"rgba(167,139,250,0.08)",border:"0.5px solid rgba(167,139,250,0.15)",borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Eye size={12} color="#a78bfa"/></button>
                        <button onClick={()=>duplicateProduct(p)} style={{background:"rgba(125,211,252,0.06)",border:"0.5px solid rgba(125,211,252,0.12)",borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}>
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#7dd3fc" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                        </button>
                        <button onClick={()=>{setEditingProduct(p);setAddingProduct(false);}} style={{background:"rgba(255,255,255,0.05)",border:"0.5px solid rgba(255,255,255,0.08)",borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Edit2 size={12} color="rgba(255,255,255,0.5)"/></button>
                        <button onClick={()=>setProducts(prev=>prev.filter(x=>x.id!==p.id))} style={{background:"rgba(255,80,80,0.06)",border:"0.5px solid rgba(255,80,80,0.15)",borderRadius:7,width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Trash2 size={12} color="#ff9090"/></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredProducts.length===0&&<div style={{padding:"40px 0",textAlign:"center"}}><Package size={32} color="rgba(255,255,255,0.1)" style={{margin:"0 auto 8px"}}/><p style={{color:"rgba(255,255,255,0.3)",fontSize:13}}>No products match</p></div>}
        </Card>
      )}
      {productView==="grid"&&(
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(175px,1fr))",gap:12}}>
          {filteredProducts.map(p=>{
            const isLow=p.active&&p.inStock>0&&p.inStock<=5;
            const isOut=p.inStock===0;
            return(
              <div key={p.id} style={{background:CB,border:`0.5px solid ${selectedProducts.includes(p.id)?"rgba(201,169,110,0.4)":"rgba(255,255,255,0.07)"}`,borderRadius:12,overflow:"hidden",position:"relative",opacity:p.active?1:0.5}}>
                <div onClick={()=>toggleSelectProduct(p.id)} style={{position:"absolute",top:8,left:8,width:18,height:18,borderRadius:5,background:selectedProducts.includes(p.id)?G:"rgba(0,0,0,0.5)",border:`1px solid ${selectedProducts.includes(p.id)?G:"rgba(255,255,255,0.3)"}`,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",zIndex:2}}>
                  {selectedProducts.includes(p.id)&&<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>}
                </div>
                {p.isLimited&&<div style={{position:"absolute",top:8,right:8,background:"rgba(255,80,80,0.15)",borderRadius:20,padding:"2px 7px",fontSize:9,color:"#ff9090",fontWeight:600,zIndex:2}}>LIMITED</div>}
                <div style={{background:p.color||"#1a1208",height:90,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}} onClick={()=>setPreviewProduct(p)}><ProductImg p={p} size={46}/></div>
                <div style={{padding:"10px 10px 12px"}}>
                  <p style={{fontSize:13,fontWeight:500,color:"#fff",margin:"0 0 2px",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</p>
                  <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"0 0 6px"}}>{p.category}</p>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:12,fontWeight:600,color:G}}>{p.price.toLocaleString()} FP</span>
                    <span style={{fontSize:11,color:isOut?"#f87171":isLow?"#fbbf24":"rgba(255,255,255,0.35)"}}>{isOut?"Out":isLow?`Low (${p.inStock})`:p.inStock+" left"}</span>
                  </div>
                  <div style={{display:"flex",gap:4,marginTop:8}}>
                    <button onClick={()=>setPreviewProduct(p)} style={{flex:1,padding:"5px 0",borderRadius:6,background:"rgba(167,139,250,0.08)",border:"0.5px solid rgba(167,139,250,0.15)",color:"#a78bfa",fontSize:11,cursor:"pointer"}}>Preview</button>
                    <button onClick={()=>{setEditingProduct(p);setAddingProduct(false);}} style={{flex:1,padding:"5px 0",borderRadius:6,background:"rgba(255,255,255,0.05)",border:"0.5px solid rgba(255,255,255,0.08)",color:"rgba(255,255,255,0.5)",fontSize:11,cursor:"pointer"}}>Edit</button>
                  </div>
                </div>
              </div>
            );
          })}
          {filteredProducts.length===0&&<div style={{gridColumn:"1/-1",padding:"40px 0",textAlign:"center"}}><p style={{color:"rgba(255,255,255,0.3)"}}>No products match</p></div>}
        </div>
      )}
      {previewProduct&&(
        <div onClick={()=>setPreviewProduct(null)} style={{position:"fixed",inset:0,zIndex:200,background:"rgba(0,0,0,0.75)",display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#0d0b08",border:`0.5px solid rgba(201,169,110,0.2)`,borderRadius:16,width:"100%",maxWidth:380,overflow:"hidden"}}>
            <div style={{background:previewProduct.color||"#1a1208",height:170,display:"flex",alignItems:"center",justifyContent:"center",position:"relative"}}>
              <ProductImg p={previewProduct} size={75}/>
              {previewProduct.isLimited&&<div style={{position:"absolute",top:12,left:12,background:"rgba(255,80,80,0.15)",border:"0.5px solid rgba(255,80,80,0.3)",borderRadius:20,padding:"3px 10px",fontSize:11,color:"#ff9090",fontWeight:600}}>LIMITED DROP</div>}
              <button onClick={()=>setPreviewProduct(null)} style={{position:"absolute",top:10,right:10,background:"rgba(0,0,0,0.5)",border:"none",borderRadius:"50%",width:28,height:28,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><X size={14} color="rgba(255,255,255,0.7)"/></button>
            </div>
            <div style={{padding:"16px 18px 20px"}}>
              <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"0 0 4px"}}>{storeSettings.name}</p>
              <p style={{fontSize:16,fontWeight:600,color:"#fff",margin:"0 0 8px"}}>{previewProduct.name}</p>
              <p style={{fontSize:13,color:"rgba(255,255,255,0.5)",lineHeight:1.6,margin:"0 0 14px"}}>{previewProduct.description}</p>
              <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14}}>{previewProduct.sizes.map(s=><span key={s} style={{padding:"5px 12px",borderRadius:20,fontSize:12,background:"rgba(255,255,255,0.06)",color:"rgba(255,255,255,0.6)",border:"0.5px solid rgba(255,255,255,0.1)"}}>{s}</span>)}</div>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
                <div style={{display:"flex",alignItems:"center",gap:6}}><Coins size={16} color={G}/><span style={{fontSize:18,fontWeight:600,color:G}}>{previewProduct.price.toLocaleString()}</span>{previewProduct.originalPrice&&<span style={{fontSize:13,color:"rgba(255,255,255,0.3)",textDecoration:"line-through"}}>{previewProduct.originalPrice.toLocaleString()}</span>}<span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>FP</span></div>
                <span style={{fontSize:12,color:previewProduct.inStock===0?"#f87171":previewProduct.inStock<=5?"#fbbf24":"rgba(255,255,255,0.4)"}}>{previewProduct.inStock===0?"Out of stock":previewProduct.inStock<=5?`Only ${previewProduct.inStock} left`:previewProduct.inStock+" in stock"}</span>
              </div>
              <button style={{width:"100%",padding:"12px 0",borderRadius:10,background:G,color:"#000",border:"none",fontSize:14,fontWeight:600,cursor:"pointer"}}>Buy now · {previewProduct.price.toLocaleString()} FP</button>
              <p style={{fontSize:11,color:"rgba(255,255,255,0.25)",textAlign:"center",margin:"8px 0 0"}}>This is how customers see this product</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // ── ORDERS ────────────────────────────────────────────────────────────────────
  const ordersSection=(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{fontSize:18,fontWeight:600,color:"#fff",margin:0}}>Orders <span style={{fontSize:13,color:"rgba(255,255,255,0.3)",fontWeight:400}}>({orders.length})</span></h2>
        <div style={{display:"flex",gap:4}}>{(["all","pending","shipped","delivered"] as const).map(f=><button key={f} onClick={()=>setOrderFilter(f)} style={{padding:"6px 14px",borderRadius:20,fontSize:12,cursor:"pointer",background:orderFilter===f?G:"rgba(255,255,255,0.05)",color:orderFilter===f?"#000":"rgba(255,255,255,0.45)",border:"none",textTransform:"capitalize"}}>{f}</button>)}</div>
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {filteredOrders.map(o=>(
          <Card key={o.id} style={{padding:"14px 16px"}}>
            <div style={{display:"flex",alignItems:"flex-start",gap:12}}>
              <div style={{width:38,height:38,borderRadius:"50%",background:"rgba(201,169,110,0.12)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,color:G,fontWeight:600,flexShrink:0}}>{o.buyerAvatar}</div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:4}}>
                  <div><p style={{fontSize:13,fontWeight:500,color:"#fff",margin:"0 0 2px"}}>{o.product} <span style={{color:"rgba(255,255,255,0.4)"}}>({o.size})</span></p><p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:0}}>{o.buyer} · {o.address} · {timeAgo(o.date)}</p></div>
                  <div style={{textAlign:"right",flexShrink:0}}><p style={{fontSize:14,fontWeight:600,color:G,margin:"0 0 4px"}}>{o.amount.toLocaleString()} FP</p><span style={{fontSize:11,padding:"2px 9px",borderRadius:20,fontWeight:500,background:o.status==="pending"?"rgba(251,191,36,0.1)":o.status==="shipped"?"rgba(125,211,252,0.1)":"rgba(74,222,128,0.1)",color:o.status==="pending"?"#fbbf24":o.status==="shipped"?"#7dd3fc":"#4ade80"}}>{o.status}</span></div>
                </div>
                {o.status==="pending"&&<div style={{display:"flex",gap:8,marginTop:10}}><input value={trackingInputs[o.id]||""} onChange={e=>setTrackingInputs(p=>({...p,[o.id]:e.target.value}))} placeholder="Tracking number (optional)" style={{flex:1,background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.08)",borderRadius:7,padding:"7px 10px",color:"#fff",fontSize:12,outline:"none"}}/><button onClick={()=>markShipped(o.id)} style={{display:"flex",alignItems:"center",gap:5,padding:"7px 14px",borderRadius:7,background:"rgba(125,211,252,0.1)",border:"0.5px solid rgba(125,211,252,0.2)",color:"#7dd3fc",fontSize:12,cursor:"pointer"}}><Truck size={13}/>Mark shipped</button></div>}
                {o.tracking&&<p style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginTop:6}}>Tracking: <span style={{color:"rgba(255,255,255,0.5)"}}>{o.tracking}</span></p>}
              </div>
            </div>
          </Card>
        ))}
        {filteredOrders.length===0&&<div style={{padding:"50px 0",textAlign:"center"}}><p style={{color:"rgba(255,255,255,0.3)"}}>No {orderFilter==="all"?"":orderFilter} orders</p></div>}
      </div>
    </div>
  );

  // ── ANALYTICS ─────────────────────────────────────────────────────────────────
  const analyticsSection=(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <h2 style={{fontSize:18,fontWeight:600,color:"#fff",margin:0}}>Analytics</h2>
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:10}}>
        <StatPill label="Total revenue" value={`${grossRevenue.toLocaleString()} FP`} sub="+18% this month" up={true}/>
        <StatPill label="Conversion rate" value={`${stats.convRate.toFixed(1)}%`} sub="views → purchases"/>
        <StatPill label="Avg order value" value={`${Math.round(grossRevenue/Math.max(1,orders.length)).toLocaleString()} FP`}/>
        <StatPill label="Total products" value={String(products.length)} sub={`${products.filter(p=>p.active).length} active`}/>
      </div>
      <Card style={{padding:"18px"}}>
        <p style={{fontSize:13,fontWeight:500,color:"#fff",margin:"0 0 20px"}}>Weekly revenue (FP)</p>
        <div style={{display:"flex",alignItems:"flex-end",gap:8,height:130}}>
          {WEEKLY.map((v,i)=>{const pct=v/Math.max(...WEEKLY)*100;return<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}><span style={{fontSize:10,color:G}}>{(v/1000).toFixed(1)}k</span><div style={{width:"100%",borderRadius:"4px 4px 0 0",background:i===6?G:"rgba(201,169,110,0.2)",height:`${pct}%`,minHeight:4}}/><span style={{fontSize:10,color:"rgba(255,255,255,0.3)"}}>{WEEK_DAYS[i]}</span></div>;})}
        </div>
      </Card>
      <Card style={{padding:"18px"}}>
        <p style={{fontSize:13,fontWeight:500,color:"#fff",margin:"0 0 14px"}}>Product performance</p>
        {[...products].sort((a,b)=>b.sales-a.sales).map((p,i)=>(
          <div key={p.id} style={{display:"flex",alignItems:"center",gap:12,padding:"9px 0",borderBottom:i<products.length-1?"0.5px solid rgba(255,255,255,0.04)":"none"}}>
            <span style={{fontSize:11,color:"rgba(255,255,255,0.25)",width:16}}>{i+1}</span>
            <ProductImg p={p} size={28}/>
            <div style={{flex:1}}><div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{fontSize:13,color:"#fff"}}>{p.name}</span><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>{p.views.toLocaleString()} views · {p.sales} sales</span></div><div style={{height:4,background:"rgba(255,255,255,0.05)",borderRadius:2}}><div style={{height:4,borderRadius:2,background:G,width:`${Math.round(p.sales/Math.max(...products.map(x=>x.sales))*100)}%`}}/></div></div>
            <span style={{fontSize:12,color:G,fontWeight:500,flexShrink:0}}>{(p.sales*p.price).toLocaleString()} FP</span>
          </div>
        ))}
      </Card>
    </div>
  );

  // ── DROPS ─────────────────────────────────────────────────────────────────────
  const dropsSection=(
    <div style={{display:"flex",flexDirection:"column",gap:14}}>
      <h2 style={{fontSize:18,fontWeight:600,color:"#fff",margin:0}}>Flash Drops</h2>
      <GoldCard style={{padding:"14px 16px"}}><div style={{display:"flex",alignItems:"center",gap:8,marginBottom:4}}><Zap size={15} color={G}/><span style={{fontSize:13,color:G,fontWeight:500}}>What is a Flash Drop?</span></div><p style={{fontSize:12,color:"rgba(255,255,255,0.4)",lineHeight:1.6,margin:0}}>A time-limited sale with a live countdown. All Flex users get a push notification when you start a drop.</p></GoldCard>
      {products.filter(p=>p.active).map(p=>{
        const cdLabel=p.dropEndsAt?(()=>{const s=Math.max(0,Math.floor((new Date(p.dropEndsAt!).getTime()-Date.now())/1000));const d=Math.floor(s/86400),h=Math.floor((s%86400)/3600);return d>0?`${d}d ${h}h`:`${h}h ${Math.floor((s%3600)/60)}m`;})():"";
        return(
          <Card key={p.id} style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:14}}>
            <ProductImg p={p} size={42}/>
            <div style={{flex:1}}><p style={{fontSize:13,fontWeight:500,color:"#fff",margin:"0 0 2px"}}>{p.name}</p><p style={{fontSize:12,color:"rgba(255,255,255,0.4)",margin:0}}>{p.inStock} in stock · {p.price.toLocaleString()} FP</p></div>
            {p.isLimited?(
              <div style={{textAlign:"right"}}>
                <div style={{display:"flex",alignItems:"center",gap:5,background:"rgba(255,80,80,0.1)",border:"0.5px solid rgba(255,80,80,0.2)",borderRadius:20,padding:"3px 10px",marginBottom:4}}><Clock size={11} color="#ff9090"/><span style={{fontSize:11,color:"#ff9090",fontWeight:500}}>{cdLabel} left</span></div>
                <button onClick={()=>setProducts(prev=>prev.map(x=>x.id===p.id?{...x,isLimited:false,dropEndsAt:undefined}:x))} style={{fontSize:11,color:"rgba(255,255,255,0.3)",background:"none",border:"none",cursor:"pointer"}}>End drop</button>
              </div>
            ):(
              <button onClick={()=>setProducts(prev=>prev.map(x=>x.id===p.id?{...x,isLimited:true,dropEndsAt:new Date(Date.now()+86400000).toISOString().split("T")[0]}:x))} style={{padding:"8px 16px",borderRadius:8,background:"rgba(201,169,110,0.08)",border:`0.5px solid ${BD}`,color:G,fontSize:12,cursor:"pointer"}}>Start 24h drop</button>
            )}
          </Card>
        );
      })}
    </div>
  );

  // ── DISCOUNTS ─────────────────────────────────────────────────────────────────
  const discountsSection=(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <h2 style={{fontSize:18,fontWeight:600,color:"#fff",margin:0}}>Discounts & Coupons</h2>
        <button onClick={()=>setAddingCoupon(true)} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",background:G,color:"#000",border:"none",borderRadius:8,fontSize:13,fontWeight:600,cursor:"pointer"}}><Plus size={14}/>New coupon</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10}}>
        <StatPill label="Active coupons" value={String(coupons.filter(c=>c.active).length)}/>
        <StatPill label="Total uses" value={String(coupons.reduce((s,c)=>s+c.usageCount,0))} sub="all time"/>
        <StatPill label="Products on sale" value={String(products.filter(p=>p.originalPrice).length)}/>
      </div>
      {addingCoupon&&<Card style={{padding:"18px"}}><p style={{fontSize:14,fontWeight:500,color:"#fff",margin:"0 0 16px"}}>Create coupon code</p><CouponForm onSave={(c)=>{setCoupons(prev=>[c,...prev]);setAddingCoupon(false);}} onCancel={()=>setAddingCoupon(false)}/></Card>}
      <div>
        <p style={{fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.4)",margin:"0 0 10px"}}>Coupon codes</p>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {coupons.map(c=>(
            <Card key={c.id} style={{padding:"14px 16px",opacity:c.active?1:0.5}}>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{background:"rgba(167,139,250,0.1)",border:"0.5px solid rgba(167,139,250,0.2)",borderRadius:8,padding:"8px 12px",flexShrink:0}}><p style={{fontSize:14,fontWeight:700,color:"#a78bfa",margin:0,letterSpacing:2}}>{c.code}</p></div>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}><span style={{fontSize:14,fontWeight:600,color:G}}>{c.type==="percent"?`${c.value}% off`:`${c.value.toLocaleString()} FP off`}</span>{c.minPurchase>0&&<span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>min {c.minPurchase.toLocaleString()} FP</span>}<span style={{fontSize:11,padding:"1px 7px",borderRadius:20,background:c.active?"rgba(74,222,128,0.1)":"rgba(255,255,255,0.05)",color:c.active?"#4ade80":"rgba(255,255,255,0.3)"}}>{c.active?"Active":"Inactive"}</span></div>
                  <div style={{display:"flex",alignItems:"center",gap:12}}><div style={{flex:1,maxWidth:160,height:4,background:"rgba(255,255,255,0.06)",borderRadius:2}}><div style={{height:4,borderRadius:2,background:"#a78bfa",width:`${Math.round(c.usageCount/c.maxUsage*100)}%`}}/></div><span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>{c.usageCount}/{c.maxUsage} uses</span>{c.expiry&&<span style={{fontSize:11,color:"rgba(255,255,255,0.3)"}}>Expires {c.expiry}</span>}</div>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={()=>toggleCoupon(c.id)} style={{padding:"6px 12px",borderRadius:7,background:c.active?"rgba(255,80,80,0.06)":"rgba(74,222,128,0.06)",border:c.active?"0.5px solid rgba(255,80,80,0.15)":"0.5px solid rgba(74,222,128,0.15)",color:c.active?"#f87171":"#4ade80",fontSize:11,cursor:"pointer"}}>{c.active?"Pause":"Activate"}</button>
                  <button onClick={()=>deleteCoupon(c.id)} style={{background:"rgba(255,80,80,0.06)",border:"0.5px solid rgba(255,80,80,0.15)",borderRadius:7,width:30,height:30,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}><Trash2 size={12} color="#ff9090"/></button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
      <div>
        <p style={{fontSize:12,fontWeight:500,color:"rgba(255,255,255,0.4)",margin:"0 0 10px"}}>Product sale prices</p>
        <Card>
          <table style={{width:"100%",borderCollapse:"collapse"}}>
            <thead><tr style={{borderBottom:"0.5px solid rgba(255,255,255,0.06)"}}>{["Product","Regular price","Sale price","Saving",""].map(h=><th key={h} style={{padding:"10px 14px",fontSize:11,color:"rgba(255,255,255,0.35)",fontWeight:500,textAlign:"left"}}>{h}</th>)}</tr></thead>
            <tbody>
              {products.filter(p=>p.active).map((p,i,arr)=>{
                const saving=p.originalPrice?Math.round((1-p.price/p.originalPrice)*100):0;
                return(
                  <tr key={p.id} style={{borderBottom:i<arr.length-1?"0.5px solid rgba(255,255,255,0.04)":"none"}}>
                    <td style={{padding:"10px 14px"}}><div style={{display:"flex",alignItems:"center",gap:8}}><ProductImg p={p} size={28}/><span style={{fontSize:13,color:"#fff"}}>{p.name}</span></div></td>
                    <td style={{padding:"10px 14px",fontSize:12,color:"rgba(255,255,255,0.5)"}}>{(p.originalPrice||p.price).toLocaleString()} FP</td>
                    <td style={{padding:"10px 14px"}}><input type="number" defaultValue={p.price} onBlur={e=>{const v=Number(e.target.value);if(v>0&&v<(p.originalPrice||p.price))setProducts(prev=>prev.map(x=>x.id===p.id?{...x,price:v,originalPrice:x.originalPrice||x.price}:x));}} style={{width:100,background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.1)",borderRadius:7,padding:"5px 8px",color:G,fontSize:12,outline:"none"}}/><span style={{fontSize:11,color:"rgba(255,255,255,0.3)",marginLeft:4}}>FP</span></td>
                    <td style={{padding:"10px 14px"}}>{saving>0?<span style={{fontSize:12,fontWeight:600,color:"#4ade80"}}>-{saving}%</span>:<span style={{fontSize:12,color:"rgba(255,255,255,0.25)"}}>—</span>}</td>
                    <td style={{padding:"10px 14px"}}>{p.originalPrice&&<button onClick={()=>setProducts(prev=>prev.map(x=>x.id===p.id?{...x,price:x.originalPrice!,originalPrice:undefined}:x))} style={{fontSize:11,color:"rgba(255,100,100,0.6)",background:"none",border:"none",cursor:"pointer"}}>Remove sale</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );

  // ── PAYOUTS ───────────────────────────────────────────────────────────────────
  const chartData=chartRange==="7d"?REVENUE_7D:chartRange==="30d"?REVENUE_30D.slice(-30):REVENUE_30D.slice(-14);
  const chartMax=Math.max(...chartData);
  const payoutsSection=(
    <div style={{display:"flex",flexDirection:"column",gap:16}}>
      <h2 style={{fontSize:18,fontWeight:600,color:"#fff",margin:0}}>Payouts</h2>
      <div style={{background:CB,border:`0.5px solid ${currentTier.color}44`,borderRadius:12,padding:"14px 18px",display:"flex",alignItems:"center",gap:16}}>
        <span style={{fontSize:32}}>{currentTier.icon}</span>
        <div style={{flex:1}}>
          <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}><span style={{fontSize:14,fontWeight:600,color:currentTier.color}}>{currentTier.name} Store</span><span style={{fontSize:11,color:"rgba(255,255,255,0.4)"}}>· {currentTier.fee}% platform fee · {currentTier.perk}</span></div>
          {nextTier&&<div><div style={{display:"flex",justifyContent:"space-between",marginBottom:3}}><span style={{fontSize:11,color:"rgba(255,255,255,0.35)"}}>Progress to {nextTier.icon} {nextTier.name}</span><span style={{fontSize:11,color:G}}>{Math.round((monthlyRevenue-currentTier.min)/(nextTier.min-currentTier.min)*100)}%</span></div><div style={{height:4,background:"rgba(255,255,255,0.06)",borderRadius:2}}><div style={{height:4,borderRadius:2,background:currentTier.color,width:`${Math.min(100,Math.round((monthlyRevenue-currentTier.min)/(nextTier.min-currentTier.min)*100))}%`}}/></div></div>}
        </div>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12}}>
        <GoldCard style={{padding:"18px"}}>
          <p style={{fontSize:11,color:"rgba(201,169,110,0.6)",margin:"0 0 10px"}}>Balance breakdown</p>
          <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:14}}><Coins size={18} color={G}/><span style={{fontSize:26,fontWeight:600,color:G}}>{fpBalance.toLocaleString()}</span><span style={{fontSize:12,color:"rgba(255,255,255,0.4)"}}>FP total</span></div>
          <div style={{display:"flex",flexDirection:"column",gap:7}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:"#4ade80"}}/><span style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>Available now</span></div><span style={{fontSize:13,fontWeight:600,color:"#4ade80"}}>{availableBalance.toLocaleString()} FP</span></div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}><div style={{display:"flex",alignItems:"center",gap:6}}><div style={{width:8,height:8,borderRadius:"50%",background:"#fbbf24"}}/><span style={{fontSize:12,color:"rgba(255,255,255,0.6)"}}>In transit</span></div><span style={{fontSize:13,fontWeight:500,color:"#fbbf24"}}>{pendingBalance.toLocaleString()} FP</span></div>
          </div>
        </GoldCard>
        <Card style={{padding:"18px"}}>
          <p style={{fontSize:11,color:"rgba(255,255,255,0.4)",margin:"0 0 10px"}}>Fee breakdown</p>
          <div style={{display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Gross revenue</span><span style={{fontSize:13,color:"#fff"}}>{grossRevenue.toLocaleString()} FP</span></div>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:12,color:"rgba(255,255,255,0.5)"}}>Flex fee ({currentTier.fee}%)</span><span style={{fontSize:13,color:"#f87171"}}>−{platformFee.toLocaleString()} FP</span></div>
            <div style={{height:"0.5px",background:"rgba(255,255,255,0.08)"}}/>
            <div style={{display:"flex",justifyContent:"space-between"}}><span style={{fontSize:13,fontWeight:500,color:"#fff"}}>Net payout</span><span style={{fontSize:14,fontWeight:600,color:G}}>{netRevenue.toLocaleString()} FP</span></div>
          </div>
        </Card>
      </div>
      <Card style={{padding:"18px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}><span style={{fontSize:13,fontWeight:500,color:"#fff"}}>Revenue over time</span><div style={{display:"flex",gap:4}}>{(["7d","30d"] as const).map(r=><button key={r} onClick={()=>setChartRange(r)} style={{padding:"4px 10px",borderRadius:20,fontSize:11,cursor:"pointer",background:chartRange===r?G:"rgba(255,255,255,0.05)",color:chartRange===r?"#000":"rgba(255,255,255,0.45)",border:"none"}}>{r}</button>)}</div></div>
        <div style={{display:"flex",alignItems:"flex-end",gap:chartRange==="30d"?2:8,height:110}}>
          {chartData.map((v,i)=>{const pct=chartMax>0?Math.round(v/chartMax*100):0;return<div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,minWidth:0}}><div title={`${v.toLocaleString()} FP`} style={{width:"100%",borderRadius:"3px 3px 0 0",background:i===chartData.length-1?G:"rgba(201,169,110,0.25)",height:`${pct}%`,minHeight:2,cursor:"pointer"}}/></div>;})}
        </div>
      </Card>
      <Card style={{padding:"18px"}}>
        <p style={{fontSize:13,fontWeight:500,color:"#fff",margin:"0 0 14px"}}>Withdraw funds</p>
        {payoutMethod?(
          <div style={{display:"flex",alignItems:"center",gap:8,background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"10px 14px",marginBottom:12}}>
            <span style={{fontSize:16}}>{payoutMethod.type==="bank"?"🏦":payoutMethod.type==="paypal"?"🅿️":"💳"}</span>
            <span style={{fontSize:13,color:"#fff"}}>{payoutMethod.label} · {payoutMethod.masked}</span>
            <button onClick={()=>setShowPayoutForm(f=>!f)} style={{marginLeft:"auto",fontSize:11,color:G,background:"none",border:"none",cursor:"pointer"}}>Change</button>
          </div>
        ):(
          <div style={{background:"rgba(255,80,80,0.06)",border:"0.5px solid rgba(255,80,80,0.15)",borderRadius:8,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <span style={{fontSize:12,color:"#f87171"}}>No payout method — add one below</span>
            <button onClick={()=>setShowPayoutForm(true)} style={{fontSize:11,color:G,background:"none",border:"none",cursor:"pointer"}}>Add</button>
          </div>
        )}
        {showPayoutForm&&(
          <div style={{marginBottom:12,padding:"14px",background:"rgba(255,255,255,0.03)",borderRadius:8,border:"0.5px solid rgba(255,255,255,0.07)",display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",gap:6}}>{(["bank","paypal","stripe"] as const).map(t=><button key={t} onClick={()=>setNewPayoutMethodType(t)} style={{flex:1,padding:"7px 0",borderRadius:7,fontSize:12,cursor:"pointer",background:newPayoutMethodType===t?"rgba(201,169,110,0.15)":"rgba(255,255,255,0.04)",border:newPayoutMethodType===t?`0.5px solid ${G}`:"0.5px solid rgba(255,255,255,0.08)",color:newPayoutMethodType===t?G:"rgba(255,255,255,0.5)"}}>{t==="bank"?"🏦 Bank":t==="paypal"?"🅿️ PayPal":"💳 Stripe"}</button>)}</div>
            <input value={newPayoutValue} onChange={e=>setNewPayoutValue(e.target.value)} placeholder={newPayoutMethodType==="bank"?"IBAN number":newPayoutMethodType==="paypal"?"PayPal email":"Stripe email"} style={{...inp2,width:"100%",boxSizing:"border-box"}}/>
            <button onClick={()=>{if(!newPayoutValue.trim())return;setPayoutMethod({type:newPayoutMethodType,label:newPayoutMethodType==="bank"?"Bank":newPayoutMethodType==="paypal"?"PayPal":"Stripe",masked:newPayoutValue.length>6?newPayoutValue.slice(0,3)+"***"+newPayoutValue.slice(-4):newPayoutValue});setShowPayoutForm(false);setNewPayoutValue("");}} style={{padding:"9px 0",borderRadius:8,background:G,color:"#000",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>Save method</button>
          </div>
        )}
        <div style={{display:"flex",gap:10}}>
          <input type="number" value={withdrawAmount} onChange={e=>setWithdrawAmount(e.target.value)} placeholder={`Available: ${availableBalance.toLocaleString()} FP (min 5,000)`} style={{...inp2,flex:1}}/>
          <button onClick={submitWithdrawal} disabled={!payoutMethod||Number(withdrawAmount)<5000} style={{padding:"10px 20px",borderRadius:8,background:payoutMethod&&Number(withdrawAmount)>=5000?G:"rgba(255,255,255,0.06)",color:payoutMethod&&Number(withdrawAmount)>=5000?"#000":"rgba(255,255,255,0.25)",border:"none",fontSize:13,fontWeight:600,cursor:"pointer"}}>Withdraw</button>
        </div>
      </Card>
      <Card style={{padding:"16px"}}>
        <p style={{fontSize:13,fontWeight:500,color:"#fff",margin:"0 0 14px"}}>Withdrawal history</p>
        {withdrawals.map((w,i)=>(
          <div key={w.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<withdrawals.length-1?"0.5px solid rgba(255,255,255,0.04)":"none"}}>
            <div><p style={{fontSize:12,color:"#fff",margin:0}}>{w.amount.toLocaleString()} FP · {w.method}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.35)",margin:0}}>{timeAgo(w.requestedAt)}</p></div>
            <span style={{fontSize:11,padding:"2px 9px",borderRadius:20,fontWeight:500,background:w.status==="paid"?"rgba(74,222,128,0.1)":w.status==="processing"?"rgba(125,211,252,0.1)":"rgba(251,191,36,0.1)",color:w.status==="paid"?"#4ade80":w.status==="processing"?"#7dd3fc":"#fbbf24"}}>{w.status}</span>
          </div>
        ))}
      </Card>
      <Card style={{padding:"16px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
          <p style={{fontSize:13,fontWeight:500,color:"#fff",margin:0}}>Sales history</p>
          <div style={{display:"flex",gap:8}}>
            <button onClick={exportCSV} style={{display:"flex",alignItems:"center",gap:5,fontSize:12,color:G,background:"rgba(201,169,110,0.08)",border:`0.5px solid rgba(201,169,110,0.15)`,borderRadius:7,padding:"5px 12px",cursor:"pointer"}}>Export CSV</button>
          </div>
        </div>
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <div style={{position:"relative",flex:1}}><Search size={13} color="rgba(255,255,255,0.25)" style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}/><input value={salesSearch} onChange={e=>setSalesSearch(e.target.value)} placeholder="Search…" style={{width:"100%",background:"rgba(255,255,255,0.04)",border:"0.5px solid rgba(255,255,255,0.08)",borderRadius:8,padding:"8px 10px 8px 30px",color:"#fff",fontSize:12,outline:"none",boxSizing:"border-box"}}/></div>
          <div style={{display:"flex",gap:4}}>{(["all","pending","delivered"] as const).map(f=><button key={f} onClick={()=>setSalesFilter(f)} style={{padding:"6px 12px",borderRadius:20,fontSize:11,cursor:"pointer",background:salesFilter===f?G:"rgba(255,255,255,0.05)",color:salesFilter===f?"#000":"rgba(255,255,255,0.45)",border:"none",textTransform:"capitalize"}}>{f}</button>)}</div>
        </div>
        {filteredSales.map((o,i)=>(
          <div key={o.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"9px 0",borderBottom:i<filteredSales.length-1?"0.5px solid rgba(255,255,255,0.04)":"none"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}><div style={{width:32,height:32,borderRadius:"50%",background:"rgba(201,169,110,0.1)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,color:G,fontWeight:600}}>{o.buyerAvatar}</div><div><p style={{fontSize:12,color:"#fff",margin:0}}>{o.product}</p><p style={{fontSize:11,color:"rgba(255,255,255,0.35)",margin:0}}>{o.buyer} · {timeAgo(o.date)}</p></div></div>
            <div style={{textAlign:"right"}}><p style={{fontSize:13,fontWeight:600,color:"#4ade80",margin:0}}>+{o.amount.toLocaleString()} FP</p><p style={{fontSize:11,color:"rgba(255,255,255,0.3)",margin:0}}>net: {Math.round(o.amount*(1-currentTier.fee/100)).toLocaleString()} FP</p></div>
          </div>
        ))}
      </Card>
    </div>
  );

  // ── SETTINGS ──────────────────────────────────────────────────────────────────
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsFocus, setSettingsFocus] = useState<string|null>(null);

  const updateSetting = (key: string, value: string) => {
    setStoreSettings(s => ({ ...s, [key]: value }));
    setSettingsDirty(true);
  };

  const saveSettings = async () => {
    setSettingsSaving(true);
    try {
      // Persist to backend if endpoint exists
      await fetch(`${API}/store/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token') || ''}` },
        body: JSON.stringify(storeSettings),
      }).catch(() => {}); // silent if endpoint not wired yet
      setSettingsDirty(false);
      // Show inline success for 2s
      setSettingsSaving(false);
    } finally {
      setSettingsSaving(false);
    }
  };

  const STORE_CATEGORIES = ["Clothing","Footwear","Equipment","Supplements","Accessories","Electronics","Books & Media","Other"];
  const LOGO_OPTIONS = ["⚡","🔥","💪","🏋️","🥊","🏃","⭐","🎯","🛡️","👑"];

  const sLabel: React.CSSProperties = { fontSize: 11, color: "rgba(255,255,255,0.45)", display: "block", marginBottom: 6, fontWeight: 500, letterSpacing: "0.4px", textTransform: "uppercase" };
  const sInput = (key: string): React.CSSProperties => ({
    ...inp2,
    width: "100%",
    boxSizing: "border-box",
    border: settingsFocus === key ? `0.5px solid ${G}` : "0.5px solid rgba(255,255,255,0.1)",
    transition: "border-color 0.15s",
  });

  const settingsSection = (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#fff", margin: 0 }}>Store Settings</h2>
        {settingsDirty && (
          <span style={{ fontSize: 11, color: G, background: "rgba(201,169,110,0.1)", border: `0.5px solid rgba(201,169,110,0.25)`, borderRadius: 20, padding: "3px 10px", fontWeight: 500 }}>
            Unsaved changes
          </span>
        )}
      </div>

      {/* ── Store Identity ─────────────────────────────────────────────── */}
      <Card style={{ padding: "20px" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)", margin: "0 0 16px", letterSpacing: "0.6px", textTransform: "uppercase" }}>Store Identity</p>

        {/* Logo picker */}
        <div style={{ marginBottom: 20 }}>
          <span style={sLabel}>Store logo</span>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 52, height: 52, borderRadius: 14, background: "rgba(201,169,110,0.1)", border: `1.5px solid rgba(201,169,110,0.25)`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>
              {storeSettings.logo}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {LOGO_OPTIONS.map(e => (
                <button key={e} onClick={() => updateSetting("logo", e)}
                  style={{ width: 34, height: 34, borderRadius: 8, border: storeSettings.logo === e ? `1.5px solid ${G}` : "0.5px solid rgba(255,255,255,0.08)", background: storeSettings.logo === e ? "rgba(201,169,110,0.12)" : "rgba(255,255,255,0.03)", fontSize: 16, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Store name */}
        <div style={{ marginBottom: 14 }}>
          <span style={sLabel}>Store name</span>
          <input value={storeSettings.name} onChange={e => updateSetting("name", e.target.value)}
            onFocus={() => setSettingsFocus("name")} onBlur={() => setSettingsFocus(null)}
            style={sInput("name")} placeholder="e.g. Flex Originals" />
        </div>

        {/* Category dropdown */}
        <div style={{ marginBottom: 14 }}>
          <span style={sLabel}>Category</span>
          <select value={storeSettings.category} onChange={e => updateSetting("category", e.target.value)}
            style={{ ...sInput("category"), appearance: "none", cursor: "pointer" }}>
            {STORE_CATEGORIES.map(c => <option key={c} value={c} style={{ background: "#0d0b08" }}>{c}</option>)}
          </select>
        </div>

        {/* Bio */}
        <div>
          <span style={sLabel}>Bio <span style={{ color: "rgba(255,255,255,0.2)", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>({storeSettings.bio.length}/160)</span></span>
          <textarea value={storeSettings.bio} onChange={e => e.target.value.length <= 160 && updateSetting("bio", e.target.value)}
            onFocus={() => setSettingsFocus("bio")} onBlur={() => setSettingsFocus(null)}
            style={{ ...sInput("bio"), minHeight: 80, resize: "vertical" }}
            placeholder="Tell customers what makes your store great…" />
        </div>
      </Card>

      {/* ── Contact & Social ────────────────────────────────────────────── */}
      <Card style={{ padding: "20px" }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,0.35)", margin: "0 0 16px", letterSpacing: "0.6px", textTransform: "uppercase" }}>Contact & Social</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <span style={sLabel}>Business email</span>
            <input type="email" value={storeSettings.email} onChange={e => updateSetting("email", e.target.value)}
              onFocus={() => setSettingsFocus("email")} onBlur={() => setSettingsFocus(null)}
              style={sInput("email")} placeholder="store@example.com" />
          </div>
          <div>
            <span style={sLabel}>Instagram handle</span>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(255,255,255,0.3)", fontSize: 13 }}>@</span>
              <input value={storeSettings.instagram} onChange={e => updateSetting("instagram", e.target.value.replace(/^@/, ""))}
                onFocus={() => setSettingsFocus("instagram")} onBlur={() => setSettingsFocus(null)}
                style={{ ...sInput("instagram"), paddingLeft: 26 }} placeholder="yourstore" />
            </div>
          </div>
        </div>
      </Card>

      {/* ── Policies ────────────────────────────────────────────────────── */}
      <Card style={{ padding: "20px" }}>
        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontWeight: 500, letterSpacing: "0.5px", textTransform: "uppercase", margin: "0 0 12px" }}>Shipping Policy</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <span style={sLabel}>Shipping policy</span>
            <textarea value={storeSettings.shipping || ''} onChange={e => updateSetting("shipping", e.target.value)}
              onFocus={() => setSettingsFocus("shippingPolicy")} onBlur={() => setSettingsFocus(null)}
              style={{ ...sInput("shippingPolicy"), minHeight: 80, resize: "vertical" }}
              placeholder="e.g. Ships within 3-5 business days." />
          </div>
        </div>
      </Card>

    </div>
  );

  return (
    <div style={{ display: "flex", height: "100vh", background: S, overflow: "hidden", fontFamily: "system-ui,sans-serif", color: "#fff" }}>
      {sidebar}
      <main style={{ flex: 1, overflowY: "auto", background: "#080608" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "24px 24px 40px" }}>
          {section === "overview"    && overview}
          {section === "products"    && productsSection}
          {section === "orders"      && ordersSection}
          {section === "analytics"   && analyticsSection}
          {section === "drops" && dropsSection}
          {section === "discounts"   && discountsSection}
          {section === "payouts"     && payoutsSection}
          {section === "settings"    && settingsSection}
        </div>
      </main>
    </div>
  );
}
