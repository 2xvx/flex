import { useState, useRef, useEffect } from "react";
import { Store, Check, ArrowLeft, Eye, EyeOff, Coins, Users, ShoppingBag, Zap, Globe, Phone, Lock, Mail, User, FileText, Tag, ChevronDown } from "lucide-react";

// ── Custom dark dropdown ──────────────────────────────────────────────────────
function DarkSelect({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button type="button" onClick={() => setOpen(o => !o)} style={{
        width: "100%", background: "rgba(255,255,255,0.04)",
        border: `0.5px solid ${open ? "rgba(201,169,110,0.4)" : "rgba(255,255,255,0.1)"}`,
        borderRadius: 10, padding: "11px 14px", color: value ? "#fff" : "rgba(255,255,255,0.3)",
        fontSize: 13, outline: "none", cursor: "pointer", textAlign: "left",
        display: "flex", justifyContent: "space-between", alignItems: "center",
        transition: "border-color 0.15s",
      }}>
        <span>{value || placeholder || "Select…"}</span>
        <ChevronDown size={14} color="rgba(255,255,255,0.3)"
          style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }} />
      </button>
      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50,
          background: "#0d0b08", border: "0.5px solid rgba(201,169,110,0.18)",
          borderRadius: 10, overflow: "hidden",
          boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
        }}>
          {options.map(opt => (
            <button key={opt} type="button" onClick={() => { onChange(opt); setOpen(false); }}
              style={{
                width: "100%", padding: "10px 14px", background: value === opt ? "rgba(201,169,110,0.1)" : "transparent",
                border: "none", borderBottom: "0.5px solid rgba(255,255,255,0.04)",
                color: value === opt ? "#c9a96e" : "rgba(255,255,255,0.7)",
                fontSize: 13, cursor: "pointer", textAlign: "left",
                transition: "background 0.1s",
              }}
              onMouseEnter={e => { if (value !== opt) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { if (value !== opt) e.currentTarget.style.background = "transparent"; }}
            >
              {value === opt && <Check size={11} color="#c9a96e" style={{ marginRight: 8, display: "inline" }} />}
              {opt}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STORE_CATEGORIES = [
  "Clothing & Apparel","Performance Gear","Equipment & Weights",
  "Footwear","Supplements & Nutrition","Accessories","Recovery & Wellness","Other",
];

const gold = "#c9a96e";
const cardBg = "#0d0b08";

const inp: React.CSSProperties = {
  width: "100%", background: "rgba(255,255,255,0.04)",
  border: "0.5px solid rgba(255,255,255,0.1)", borderRadius: 10,
  padding: "11px 14px", color: "#fff", fontSize: 13,
  outline: "none", boxSizing: "border-box" as const,
};
const lbl: React.CSSProperties = {
  fontSize: 11, color: "rgba(255,255,255,0.45)",
  marginBottom: 5, display: "block", letterSpacing: 0.3,
};
const fieldRow: React.CSSProperties = {
  display: "flex", flexDirection: "column" as const, gap: 4,
};

export function StoreSignupPage({ onNavigate }: { onNavigate: (v: string) => void }) {
  const [step, setStep] = useState<"form" | "pending">("form");
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [form, setForm] = useState({
    // Account
    ownerName: "", email: "", password: "", confirmPassword: "",
    phone: "",
    // Store identity
    storeName: "", category: "Clothing & Apparel", bio: "",
    website: "", instagram: "", logo: "🏪",
    // Business
    monthlyRevenue: "", registrationNumber: "",
    agreeTerms: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const f = (k: keyof typeof form, v: any) => setForm(p => ({ ...p, [k]: v }));

  function validate() {
    const e: Record<string, string> = {};
    if (!form.ownerName.trim())      e.ownerName      = "Full name is required";
    if (!form.email.trim())          e.email          = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Enter a valid email";
    if (!form.password)              e.password       = "Password is required";
    else if (form.password.length < 8) e.password     = "At least 8 characters";
    if (form.confirmPassword !== form.password) e.confirmPassword = "Passwords do not match";
    if (!form.storeName.trim())      e.storeName      = "Store name is required";
    if (!form.bio.trim())            e.bio            = "Tell us about your store";
    if (!form.agreeTerms)            e.agreeTerms     = "You must agree to the terms";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function submit() {
    if (validate()) setStep("pending");
  }

  // ── Pending / success screen ────────────────────────────────────────────────
  if (step === "pending") {
    return (
      <div style={{ minHeight: "100vh", background: "#080608", color: "#fff",
        fontFamily: "system-ui,sans-serif", display: "flex", alignItems: "center",
        justifyContent: "center", padding: "0 20px" }}>
        <div style={{ maxWidth: 440, width: "100%", textAlign: "center" }}>
          <div style={{ width: 80, height: 80, borderRadius: 22, background: "rgba(201,169,110,0.08)",
            border: `1px solid ${gold}44`, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 38, margin: "0 auto 24px",
            boxShadow: "0 0 40px rgba(201,169,110,0.08)" }}>
            {form.logo}
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 6,
            background: "rgba(74,222,128,0.08)", border: "0.5px solid rgba(74,222,128,0.2)",
            borderRadius: 20, padding: "4px 12px", marginBottom: 16 }}>
            <Check size={12} color="#4ade80" />
            <span style={{ fontSize: 11, color: "#4ade80", fontWeight: 500 }}>Application received</span>
          </div>
          <h2 style={{ fontSize: 24, fontWeight: 600, color: gold, marginBottom: 8 }}>
            You're on the waitlist!
          </h2>
          <p style={{ fontSize: 14, color: "rgba(255,255,255,0.5)", lineHeight: 1.7, marginBottom: 28 }}>
            <strong style={{ color: "#fff" }}>{form.storeName}</strong> is under review.<br />
            We'll email <strong style={{ color: "#fff" }}>{form.email}</strong> within 2–3 business days.
          </p>

          {/* Steps */}
          <div style={{ background: cardBg, border: "0.5px solid rgba(255,255,255,0.07)",
            borderRadius: 14, padding: "18px 20px", marginBottom: 24, textAlign: "left" }}>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", marginBottom: 14,
              letterSpacing: 1, textTransform: "uppercase" }}>What happens next</p>
            {[
              { n: "1", label: "Admin reviews your application", sub: "Usually within 48 hours" },
              { n: "2", label: "Approval email sent", sub: "With your store dashboard link" },
              { n: "3", label: "Add products & go live", sub: "Start selling to 48k+ athletes" },
            ].map(s => (
              <div key={s.n} style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "flex-start" }}>
                <div style={{ width: 24, height: 24, borderRadius: "50%",
                  background: "rgba(201,169,110,0.1)", border: `0.5px solid ${gold}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, color: gold, fontWeight: 600, flexShrink: 0 }}>
                  {s.n}
                </div>
                <div>
                  <p style={{ fontSize: 13, color: "#fff", margin: 0, fontWeight: 500 }}>{s.label}</p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", margin: 0 }}>{s.sub}</p>
                </div>
              </div>
            ))}
          </div>

          <button onClick={() => onNavigate("flex-store")} style={{
            width: "100%", padding: "13px 0", borderRadius: 12,
            background: "rgba(201,169,110,0.08)", border: `0.5px solid ${gold}33`,
            color: gold, fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
            ← Back to Flex Store
          </button>
        </div>
      </div>
    );
  }

  // ── Application form ────────────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: "#080608", color: "#fff",
      fontFamily: "system-ui,sans-serif", paddingBottom: 80 }}>
      <div style={{ maxWidth: 520, margin: "0 auto", padding: "32px 20px 0" }}>

        {/* Back */}
        <button onClick={() => onNavigate("flex-store")} style={{
          background: "none", border: "none", color: "rgba(255,255,255,0.35)",
          cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
          fontSize: 12, marginBottom: 28, padding: 0 }}>
          <ArrowLeft size={14} /> Back to store
        </button>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
            <div style={{ background: "rgba(201,169,110,0.1)", borderRadius: 10, padding: 8 }}>
              <Store size={18} color={gold} />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: "#fff", margin: 0 }}>Open your store</h1>
          </div>
          <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
            Apply to sell on Flex and reach 48,000+ athletes
          </p>
        </div>

        {/* Perks */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, marginBottom: 28 }}>
          {[
            { icon: <Coins size={13} />, label: "Earn FP" },
            { icon: <Users size={13} />, label: "48k+ reach" },
            { icon: <Zap size={13} />, label: "Flash drops" },
            { icon: <ShoppingBag size={13} />, label: "Dashboard" },
          ].map(p => (
            <div key={p.label} style={{ background: cardBg, border: "0.5px solid rgba(255,255,255,0.07)",
              borderRadius: 10, padding: "10px 6px", textAlign: "center" }}>
              <div style={{ color: gold, display: "flex", justifyContent: "center", marginBottom: 4 }}>{p.icon}</div>
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.45)", margin: 0 }}>{p.label}</p>
            </div>
          ))}
        </div>

        {/* ── Section 1: Account ── */}
        <Section title="Account details" icon={<User size={14} color={gold} />}>
          <div style={fieldRow}>
            <span style={lbl}>Full name *</span>
            <input style={{ ...inp, borderColor: errors.ownerName ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.1)" }}
              value={form.ownerName} onChange={e => f("ownerName", e.target.value)}
              placeholder="Your full name" />
            {errors.ownerName && <Err msg={errors.ownerName} />}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldRow}>
              <span style={lbl}>Business email *</span>
              <div style={{ position: "relative" }}>
                <Mail size={13} color="rgba(255,255,255,0.2)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input style={{ ...inp, paddingLeft: 34, borderColor: errors.email ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.1)" }}
                  type="email" value={form.email} onChange={e => f("email", e.target.value)}
                  placeholder="store@brand.com" />
              </div>
              {errors.email && <Err msg={errors.email} />}
            </div>
            <div style={fieldRow}>
              <span style={lbl}>Phone (optional)</span>
              <div style={{ position: "relative" }}>
                <Phone size={13} color="rgba(255,255,255,0.2)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input style={{ ...inp, paddingLeft: 34 }}
                  type="tel" value={form.phone} onChange={e => f("phone", e.target.value)}
                  placeholder="+1 234 567 8900" />
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldRow}>
              <span style={lbl}>Password *</span>
              <div style={{ position: "relative" }}>
                <Lock size={13} color="rgba(255,255,255,0.2)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input style={{ ...inp, paddingLeft: 34, paddingRight: 38, borderColor: errors.password ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.1)" }}
                  type={showPass ? "text" : "password"} value={form.password}
                  onChange={e => f("password", e.target.value)} placeholder="Min. 8 characters" />
                <button type="button" onClick={() => setShowPass(s => !s)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0 }}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.password && <Err msg={errors.password} />}
            </div>
            <div style={fieldRow}>
              <span style={lbl}>Confirm password *</span>
              <div style={{ position: "relative" }}>
                <Lock size={13} color="rgba(255,255,255,0.2)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input style={{ ...inp, paddingLeft: 34, paddingRight: 38, borderColor: errors.confirmPassword ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.1)" }}
                  type={showConfirm ? "text" : "password"} value={form.confirmPassword}
                  onChange={e => f("confirmPassword", e.target.value)} placeholder="Repeat password" />
                <button type="button" onClick={() => setShowConfirm(s => !s)}
                  style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
                    background: "none", border: "none", cursor: "pointer", color: "rgba(255,255,255,0.3)", padding: 0 }}>
                  {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              {errors.confirmPassword && <Err msg={errors.confirmPassword} />}
            </div>
          </div>
        </Section>

        {/* ── Section 2: Store identity ── */}
        <Section title="Store identity" icon={<Tag size={14} color={gold} />}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 72px", gap: 10 }}>
            <div style={fieldRow}>
              <span style={lbl}>Store name *</span>
              <input style={{ ...inp, borderColor: errors.storeName ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.1)" }}
                value={form.storeName} onChange={e => f("storeName", e.target.value)}
                placeholder="e.g. Beast Athletics" />
              {errors.storeName && <Err msg={errors.storeName} />}
            </div>
            <div style={fieldRow}>
              <span style={lbl}>Logo</span>
              <input style={{ ...inp, textAlign: "center", fontSize: 22, padding: "6px 8px" }}
                value={form.logo} maxLength={2} onChange={e => f("logo", e.target.value)} />
            </div>
          </div>

          <div style={fieldRow}>
            <span style={lbl}>Category *</span>
            <DarkSelect value={form.category} onChange={v => f("category", v)} options={STORE_CATEGORIES} />
          </div>

          <div style={fieldRow}>
            <span style={lbl}>Store bio *</span>
            <textarea style={{ ...inp, minHeight: 88, resize: "vertical" as const,
              borderColor: errors.bio ? "rgba(248,113,113,0.5)" : "rgba(255,255,255,0.1)" }}
              value={form.bio} onChange={e => f("bio", e.target.value)}
              placeholder="Tell athletes what makes your brand unique..." />
            {errors.bio && <Err msg={errors.bio} />}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldRow}>
              <span style={lbl}>Website (optional)</span>
              <div style={{ position: "relative" }}>
                <Globe size={13} color="rgba(255,255,255,0.2)" style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }} />
                <input style={{ ...inp, paddingLeft: 34 }}
                  value={form.website} onChange={e => f("website", e.target.value)}
                  placeholder="yourbrand.com" />
              </div>
            </div>
            <div style={fieldRow}>
              <span style={lbl}>Instagram (optional)</span>
              <input style={inp} value={form.instagram}
                onChange={e => f("instagram", e.target.value)} placeholder="@yourbrand" />
            </div>
          </div>
        </Section>

        {/* ── Section 3: Business ── */}
        <Section title="Business info" icon={<FileText size={14} color={gold} />}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div style={fieldRow}>
              <span style={lbl}>Est. monthly revenue</span>
              <DarkSelect
                value={form.monthlyRevenue}
                onChange={v => f("monthlyRevenue", v)}
                placeholder="Select range"
                options={["Just starting","Under $1,000","$1,000 – $5,000","$5,000 – $20,000","$20,000+"]}
              />
            </div>
            <div style={fieldRow}>
              <span style={lbl}>Business reg. no. (optional)</span>
              <input style={inp} value={form.registrationNumber}
                onChange={e => f("registrationNumber", e.target.value)}
                placeholder="e.g. 12345678" />
            </div>
          </div>
        </Section>

        {/* ── Terms ── */}
        <div style={{ background: cardBg, border: "0.5px solid rgba(255,255,255,0.07)",
          borderRadius: 14, padding: "16px 18px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 12, cursor: "pointer" }}
            onClick={() => f("agreeTerms", !form.agreeTerms)}>
            <div style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, marginTop: 1,
              background: form.agreeTerms ? "rgba(201,169,110,0.15)" : "rgba(255,255,255,0.04)",
              border: errors.agreeTerms ? "0.5px solid rgba(248,113,113,0.5)" : form.agreeTerms ? `0.5px solid ${gold}` : "0.5px solid rgba(255,255,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}>
              {form.agreeTerms && <Check size={12} color={gold} />}
            </div>
            <p style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", margin: 0, lineHeight: 1.6 }}>
              I agree to the <span style={{ color: gold }}>Flex Store Terms</span> — stores keep 100% of FP earnings.
              Flex takes a <strong style={{ color: "#fff" }}>5% platform fee</strong> per transaction.
              Applications are reviewed within 2–3 business days.
            </p>
          </div>
          {errors.agreeTerms && <Err msg={errors.agreeTerms} />}
        </div>

        {/* Submit */}
        <button onClick={submit} style={{
          width: "100%", padding: "14px 0", borderRadius: 12,
          background: gold, color: "#000", border: "none",
          fontSize: 14, fontWeight: 700, cursor: "pointer", letterSpacing: 0.3 }}>
          Submit application →
        </button>

        <p style={{ fontSize: 11, color: "rgba(255,255,255,0.18)", textAlign: "center",
          marginTop: 14, lineHeight: 1.6 }}>
          Approved stores receive a verified badge and full merchant dashboard.
        </p>
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div style={{ background: cardBg, border: "0.5px solid rgba(255,255,255,0.07)",
      borderRadius: 14, padding: "18px 18px", marginBottom: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        {icon}
        <p style={{ fontSize: 13, fontWeight: 600, color: "#fff", margin: 0 }}>{title}</p>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {children}
      </div>
    </div>
  );
}

function Err({ msg }: { msg: string }) {
  return <p style={{ fontSize: 11, color: "#f87171", margin: "2px 0 0" }}>{msg}</p>;
}
