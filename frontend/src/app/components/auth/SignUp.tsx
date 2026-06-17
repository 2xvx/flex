import { useState, useEffect } from "react";
import { Mail, Lock, Eye, EyeOff, User, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { API } from "../../../config";

interface SignUpProps {
  onSignUp: (data: SignUpData) => void;
  onSwitchToLogin: () => void;
}

export interface SignUpData {
  name: string;
  email: string;
  password: string;
  accountType: "user" | "trainer";
  location?: string;
  specialty?: string;
  bio?: string;
  username: string;
}

const TRAINER_SPECIALTIES = [
  "Strength Training", "HIIT", "Weight Loss", "Yoga",
  "Cardio", "CrossFit", "Nutrition", "Pilates", "Boxing", "Rehabilitation",
];

function getStrength(pw: string): { score: number; label: string; color: string } {
  let score = 0;
  if (pw.length >= 8)          score++;
  if (pw.length >= 12)         score++;
  if (/[A-Z]/.test(pw))        score++;
  if (/[0-9]/.test(pw))        score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak",   color: "#ef4444" };
  if (score <= 3) return { score, label: "Fair",   color: "#f59e0b" };
  return              { score, label: "Strong", color: "#22c55e" };
}

const G = "#c9a96e";
const inputStyle = {
  width: "100%",
  background: "rgba(240,235,227,0.04)",
  border: "1px solid rgba(201,169,110,0.12)",
  borderRadius: 12,
  padding: "11px 14px",
  fontSize: 13,
  color: "#f0ebe3",
  outline: "none",
  transition: "border-color 0.2s",
} as React.CSSProperties;

export function SignUp({ onSignUp, onSwitchToLogin }: SignUpProps) {
  const [accountType,  setAccountType]  = useState<"user" | "trainer">("user");
  const [name,         setName]         = useState("");
  const [email,        setEmail]        = useState("");
  const [password,     setPassword]     = useState("");
  const [confirm,      setConfirm]      = useState("");
  const [showPw,       setShowPw]       = useState(false);
  const [showCf,       setShowCf]       = useState(false);
  const [agreed,       setAgreed]       = useState(false);
  const [loading,      setLoading]      = useState(false);
  const [mounted,      setMounted]      = useState(false);
  const [specialty,    setSpecialty]    = useState("");
  const [bio,          setBio]          = useState("");
  const [username,     setUsername]     = useState("");
  const [unAvail,      setUnAvail]      = useState(false);
  const [unChecking,   setUnChecking]   = useState(false);
  const [showSpecMenu, setShowSpecMenu] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  const checkUsername = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    setUsername(clean);
    if (clean.length < 3) { setUnAvail(false); return; }
    setUnChecking(true);
    clearTimeout((window as any).__unTimer);
    (window as any).__unTimer = setTimeout(async () => {
      try {
        const r = await fetch(`${API}/check-username/${clean}`);
        const d = await r.json();
        setUnAvail(!d.available);
      } catch { setUnAvail(false); }
      setUnChecking(false);
    }, 500);
  };



  const strength = getStrength(password);
  const pwMatch  = confirm.length > 0 && password === confirm;
  const pwMiss   = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreed)              return toast.error("Please agree to the terms first");
    if (password !== confirm) return toast.error("Passwords don't match");
    if (password.length < 8)  return toast.error("Password must be at least 8 characters");
    if (!username || username.length < 3)     return toast.error("Username must be at least 3 characters");
    if (unAvail)                               return toast.error("That username is already taken");
    if (accountType === "trainer" && !specialty) return toast.error("Please select your specialty");

    setLoading(true);
    try {
      const res = await fetch(`${API}/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          displayName: name,
          username,
          accountType,
          specialty: accountType === "trainer" ? specialty : undefined,
          bio:       accountType === "trainer" ? bio       : undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Signup failed");

      toast.success("Account created! Welcome to Flex 💪");
      onSignUp({ name, email, password, accountType, specialty, bio, username });
      onSwitchToLogin();
    } catch (err: any) {
      toast.error(err.message || "Could not connect to the server");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, background: "#080608", position: "relative", overflow: "hidden" }}>

      {/* Ambient glows */}
      <div aria-hidden style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none", zIndex: 0 }}>
        <div style={{ position: "absolute", top: "-10%", right: "-5%", width: 480, height: 480, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,169,110,0.13) 0%, transparent 65%)", animation: "drift1 10s ease-in-out infinite alternate" }} />
        <div style={{ position: "absolute", bottom: "-8%", left: "5%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(201,169,110,0.09) 0%, transparent 65%)", animation: "drift2 13s ease-in-out infinite alternate" }} />
      </div>

      <style>{`
        @keyframes drift1 { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(-30px,30px) scale(1.1)} }
        @keyframes drift2 { 0%{transform:translate(0,0) scale(1)} 100%{transform:translate(25px,-20px) scale(1.08)} }
        @keyframes luxGlow { 0%,100%{filter:drop-shadow(0 0 6px rgba(201,169,110,0.3))} 50%{filter:drop-shadow(0 0 14px rgba(201,169,110,0.55))} }
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        .su-input:focus { border-color: rgba(201,169,110,0.45) !important; }
        .su-input::placeholder { color: rgba(240,235,227,0.2); }
        .spec-opt:hover { background: rgba(201,169,110,0.07) !important; }
      `}</style>

      {/* Card */}
      <div style={{
        width: "100%", maxWidth: 420, position: "relative", zIndex: 10, margin: "32px 0",
        background: "linear-gradient(160deg, rgba(20,16,10,0.97) 0%, rgba(13,11,8,0.99) 100%)",
        border: "0.5px solid rgba(201,169,110,0.18)", borderRadius: 20,
        boxShadow: "0 32px 80px rgba(0,0,0,0.6), inset 0 0 0 0.5px rgba(201,169,110,0.05)",
        padding: "32px 28px",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(16px)",
        transition: "opacity 0.6s ease, transform 0.6s ease",
      }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 26 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" style={{ flexShrink: 0, animation: "luxGlow 4s ease-in-out infinite" }}>
              <polygon points="18,2 32,10 32,26 18,34 4,26 4,10" fill="rgba(201,169,110,0.07)" stroke="#c9a96e" strokeWidth="1"/>
              <polygon points="18,8 27,13 27,23 18,28 9,23 9,13" fill="rgba(201,169,110,0.1)"/>
              <text x="18" y="23" fontFamily="Georgia,serif" fontSize="11" fontWeight="700" fill="#c9a96e" textAnchor="middle">FX</text>
            </svg>
            <div style={{ textAlign: "left" }}>
              <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: 3, textTransform: "uppercase", color: G, lineHeight: 1 }}>FLEX</p>
              <p style={{ fontSize: 8, letterSpacing: 2, textTransform: "uppercase", color: "rgba(240,235,227,0.25)", marginTop: 2 }}>Elite Fitness Platform</p>
            </div>
          </div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f0ebe3", marginBottom: 4 }}>Create Account</h1>
          <p style={{ fontSize: 11, color: "rgba(240,235,227,0.32)", letterSpacing: 0.3 }}>Join the fitness community</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Account type */}
          <div>
            <p style={{ fontSize: 10, color: "rgba(240,235,227,0.35)", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 8 }}>I am a</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {(["user", "trainer"] as const).map(type => {
                const active = accountType === type;
                return (
                  <button key={type} type="button" onClick={() => setAccountType(type)} style={{
                    padding: "11px 8px", borderRadius: 12,
                    border: `1px solid ${active ? "rgba(201,169,110,0.45)" : "rgba(201,169,110,0.08)"}`,
                    background: active ? "rgba(201,169,110,0.11)" : "rgba(240,235,227,0.02)",
                    color: active ? G : "rgba(240,235,227,0.35)",
                    cursor: "pointer", transition: "all 0.2s",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 6,
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%",
                      background: active ? "rgba(201,169,110,0.15)" : "rgba(240,235,227,0.04)",
                      border: `1px solid ${active ? "rgba(201,169,110,0.35)" : "rgba(240,235,227,0.06)"}`,
                      display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                    }}>
                      {type === "user"
                        ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? G : "rgba(240,235,227,0.3)"} strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                        : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? G : "rgba(240,235,227,0.3)"} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 4v16M18 4v16M6 12h12M3 8h3M18 8h3M3 16h3M18 16h3"/></svg>
                      }
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 500 }}>{type === "user" ? "Member" : "Trainer"}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Full name */}
          <div>
            <label style={{ fontSize: 10, color: "rgba(240,235,227,0.35)", letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Full Name</label>
            <div style={{ position: "relative" }}>
              <User style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "rgba(240,235,227,0.2)" }} />
              <input className="su-input" style={{ ...inputStyle, paddingLeft: 38 }} placeholder="Your full name" value={name} onChange={e => setName(e.target.value)} required />
            </div>
          </div>

          {/* Email */}
          <div>
            <label style={{ fontSize: 10, color: "rgba(240,235,227,0.35)", letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Email</label>
            <div style={{ position: "relative" }}>
              <Mail style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "rgba(240,235,227,0.2)" }} />
              <input type="email" className="su-input" style={{ ...inputStyle, paddingLeft: 38 }} placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
          </div>
              {/* Username */}
              <div style={{ position: "relative" }}>
                <div style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "rgba(201,169,110,0.4)", pointerEvents: "none" }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/></svg>
                </div>
                <input
                  type="text"
                  className="su-input"
                  style={{ ...inputStyle, paddingLeft: 38, paddingRight: unAvail ? 90 : 38, borderColor: unAvail ? "rgba(239,68,68,0.4)" : username.length >= 3 && !unAvail && !unChecking ? "rgba(34,197,94,0.4)" : "rgba(201,169,110,0.12)" }}
                  placeholder="e.g. flex_athlete"
                  value={username}
                  onChange={e => checkUsername(e.target.value)}
                  autoComplete="username"
                />
                {unChecking && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "rgba(201,169,110,0.5)" }}>checking…</span>}
                {!unChecking && unAvail && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "rgba(239,68,68,0.7)" }}>taken</span>}
                {!unChecking && !unAvail && username.length >= 3 && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "rgba(34,197,94,0.7)" }}>✓</span>}
              </div>


          {/* Password */}
          <div>
            <label style={{ fontSize: 10, color: "rgba(240,235,227,0.35)", letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Password</label>
            <div style={{ position: "relative" }}>
              <Lock style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "rgba(240,235,227,0.2)" }} />
              <input type={showPw ? "text" : "password"} autoComplete="new-password" className="su-input" style={{ ...inputStyle, paddingLeft: 38, paddingRight: 42 }} placeholder="Min. 8 characters" value={password} onChange={e => setPassword(e.target.value)} required />
              <button type="button" onClick={() => setShowPw(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(240,235,227,0.25)", padding: 0, display: "flex" }}>
                {showPw ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
              </button>
            </div>
            {password.length > 0 && (
              <div style={{ marginTop: 7 }}>
                <div style={{ display: "flex", gap: 3, marginBottom: 3 }}>
                  {[1,2,3,4,5].map(i => (
                    <div key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= strength.score ? strength.color : "rgba(240,235,227,0.07)", transition: "background 0.3s" }} />
                  ))}
                </div>
                <p style={{ fontSize: 10, color: strength.color, letterSpacing: 0.5 }}>{strength.label} password</p>
              </div>
            )}
          </div>

          {/* Confirm password */}
          <div>
            <label style={{ fontSize: 10, color: "rgba(240,235,227,0.35)", letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Confirm Password</label>
            <div style={{ position: "relative" }}>
              <Lock style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "rgba(240,235,227,0.2)" }} />
              <input type={showCf ? "text" : "password"} autoComplete="new-password" className="su-input" style={{ ...inputStyle, paddingLeft: 38, paddingRight: 42, borderColor: pwMatch ? "rgba(34,197,94,0.4)" : pwMiss ? "rgba(239,68,68,0.4)" : "rgba(201,169,110,0.12)" }} placeholder="Repeat your password" value={confirm} onChange={e => setConfirm(e.target.value)} required />
              <button type="button" onClick={() => setShowCf(v => !v)} style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", color: "rgba(240,235,227,0.25)", padding: 0, display: "flex" }}>
                {showCf ? <EyeOff style={{ width: 15, height: 15 }} /> : <Eye style={{ width: 15, height: 15 }} />}
              </button>
            </div>
            {pwMiss  && <p style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>Passwords don't match</p>}
            {pwMatch && <p style={{ fontSize: 10, color: "#22c55e", marginTop: 4 }}>Passwords match ✓</p>}
          </div>

          {/* Trainer extras */}
          {accountType === "trainer" && (
            <div style={{ background: "rgba(201,169,110,0.04)", border: "1px solid rgba(201,169,110,0.1)", borderRadius: 12, padding: "14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
              <p style={{ fontSize: 10, color: "rgba(201,169,110,0.7)", letterSpacing: 1.2, textTransform: "uppercase" }}>Trainer Profile</p>

              {/* Specialty */}
              <div>
                <label style={{ fontSize: 10, color: "rgba(240,235,227,0.35)", letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Specialty *</label>
                <div style={{ position: "relative" }}>
                  <button type="button" onClick={() => setShowSpecMenu(v => !v)} style={{ width: "100%", textAlign: "left", ...inputStyle, display: "flex", alignItems: "center", justifyContent: "space-between", color: specialty ? "#f0ebe3" : "rgba(240,235,227,0.2)", cursor: "pointer" }}>
                    {specialty || "Select your specialty"}
                    <ChevronDown style={{ width: 13, height: 13, opacity: 0.4, transform: showSpecMenu ? "rotate(180deg)" : "none", transition: "transform 0.2s", flexShrink: 0 }} />
                  </button>
                  {showSpecMenu && (
                    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 50, background: "#110e09", border: "1px solid rgba(201,169,110,0.18)", borderRadius: 12, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.5)", maxHeight: 220, overflowY: "auto" }}>
                      {TRAINER_SPECIALTIES.map(s => (
                        <button key={s} type="button" className="spec-opt" onClick={() => { setSpecialty(s); setShowSpecMenu(false); }} style={{ width: "100%", textAlign: "left", padding: "9px 14px", background: specialty === s ? "rgba(201,169,110,0.1)" : "none", border: "none", color: specialty === s ? G : "rgba(240,235,227,0.5)", fontSize: 12, cursor: "pointer", borderBottom: "1px solid rgba(255,255,255,0.03)", display: "block" }}>
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Bio */}
              <div>
                <label style={{ fontSize: 10, color: "rgba(240,235,227,0.35)", letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Short Bio <span style={{ opacity: 0.4, fontSize: 9 }}>(optional)</span></label>
                <textarea className="su-input" style={{ ...inputStyle, resize: "none", height: 68, lineHeight: 1.5 } as React.CSSProperties} placeholder="Tell clients about your experience…" value={bio} onChange={e => setBio(e.target.value)} />
              </div>
            </div>
          )}

          {/* Terms */}
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
            <button type="button" onClick={() => setAgreed(v => !v)} style={{ width: 17, height: 17, borderRadius: 5, flexShrink: 0, marginTop: 1, border: agreed ? "1px solid rgba(201,169,110,0.55)" : "1px solid rgba(240,235,227,0.14)", background: agreed ? "rgba(201,169,110,0.16)" : "rgba(240,235,227,0.03)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all 0.2s" }}>
              {agreed && <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 4.5l2 2L7.5 2" stroke="#c9a96e" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            </button>
            <p style={{ fontSize: 11, color: "rgba(240,235,227,0.36)", lineHeight: 1.5 }}>
              I agree to the{" "}<span style={{ color: G, cursor: "pointer" }}>Terms of Service</span>{" "}and{" "}<span style={{ color: G, cursor: "pointer" }}>Privacy Policy</span>
            </p>
          </div>

          {/* Submit */}
          <button type="submit" disabled={!agreed || loading || pwMiss} style={{
            width: "100%", padding: "13px",
            background: agreed && !loading && !pwMiss ? "linear-gradient(135deg,#c9a96e 0%,#a07840 100%)" : "rgba(201,169,110,0.1)",
            border: "none", borderRadius: 12,
            color: agreed && !loading && !pwMiss ? "#fff" : "rgba(240,235,227,0.22)",
            fontSize: 13, fontWeight: 600, letterSpacing: 0.5,
            cursor: agreed && !loading && !pwMiss ? "pointer" : "not-allowed",
            transition: "all 0.25s", display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            {loading
              ? <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: "spin 1s linear infinite" }}><path d="M21 12a9 9 0 11-6.219-8.56"/></svg>Creating account…</>
              : <>Create Account <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></>
            }
          </button>
        </form>


        {/* Sign in link */}
        <div style={{ marginTop: 22, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <div style={{ flex: 1, height: 0.5, background: "rgba(201,169,110,0.1)" }} />
            <span style={{ fontSize: 10, color: "rgba(240,235,227,0.2)", letterSpacing: 1, textTransform: "uppercase" }}>Already a member?</span>
            <div style={{ flex: 1, height: 0.5, background: "rgba(201,169,110,0.1)" }} />
          </div>
          <button type="button" onClick={onSwitchToLogin} style={{ background: "none", border: "none", cursor: "pointer", color: G, fontSize: 13, fontWeight: 500, textDecoration: "underline", textDecorationColor: "rgba(201,169,110,0.3)" }}>
            Sign in to your account →
          </button>
        </div>
      </div>
    </div>
  );
}
