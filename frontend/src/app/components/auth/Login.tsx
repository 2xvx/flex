import React, { useState, useEffect, useRef } from "react";
import { Mail, Lock, Eye, EyeOff, X, ArrowRight, Building2 } from "lucide-react";
import { toast } from "sonner";
import { API } from "../../../config";

// ── Palette ────────────────────────────────────────────────────────────────────
const G1  = "#c9a96e";   // gold primary
const G2  = "#e8c98a";   // gold light
const OB  = "#080608";   // obsidian
const OW  = "#f0ebe3";   // off-white
const LP  = "#0d0b08";   // left-panel base
const RP  = "#0c0a10";   // right-panel base

// ── Static data ────────────────────────────────────────────────────────────────
const STATS = [
  { num: "48k",  label: "Athletes"   },
  { num: "2.1M", label: "Workouts"   },
  { num: "14k",  label: "PRs broken" },
];

const TICKER = [
  "@marcus crushed 140 kg deadlift · new PR",
  "Platinum challenge · 30-day squat · 2 days left",
  "@coach_ali is streaming · 89 members watching",
  "@sara hit day 127 streak — elite tier unlocked",
  "14,230 PRs broken this month",
  "@james completed Day 30 of the push-up challenge",
];

// Kinetic quote data — each quote is an array of lines,
// each line is an array of { w: word, r: role }
// roles: 'dim' (barely visible) | 'mid' (semi-bright) | 'gold' (highlighted)
type KRole  = 'dim' | 'mid' | 'gold';
type KWord  = { w: string; r: KRole };
type KQuote = KWord[][];

const KINETIC_QUOTES: KQuote[] = [
  [
    [{ w: "Every",   r: "dim"  }, { w: "rep",      r: "mid"  }, { w: "counts.",  r: "dim"  }],
    [{ w: "Every",   r: "dim"  }, { w: "session",  r: "gold" }, { w: "matters.", r: "dim"  }],
  ],
  [
    [{ w: "Progress",r: "dim"  }, { w: "is",       r: "dim"  }, { w: "built",    r: "mid"  }],
    [{ w: "in",      r: "dim"  }, { w: "the",      r: "dim"  }, { w: "dark.",    r: "gold" }],
  ],
  [
    [{ w: "Your",    r: "dim"  }, { w: "limits",   r: "mid"  }, { w: "are",      r: "dim"  }],
    [{ w: "just",    r: "dim"  }, { w: "the",      r: "dim"  }, { w: "beginning.",r:"gold" }],
  ],
  [
    [{ w: "Consistency",r:"dim"}, { w: "beats",    r: "mid"  }],
    [{ w: "intensity.", r:"gold"}, { w: "Always.",  r: "dim"  }],
  ],
  [
    [{ w: "One",     r: "dim"  }, { w: "more.",    r: "gold" }],
    [{ w: "Always",  r: "dim"  }, { w: "one",      r: "mid"  }, { w: "more.",    r: "dim"  }],
  ],
  [
    [{ w: "The",     r: "dim"  }, { w: "weight",   r: "mid"  }, { w: "room",     r: "dim"  }],
    [{ w: "doesn't", r: "dim"  }, { w: "lie.",     r: "gold" }],
  ],
  [
    [{ w: "Champions",r:"gold" }, { w: "train.",   r: "dim"  }],
    [{ w: "Everyone", r:"dim"  }, { w: "else",     r: "mid"  }, { w: "exercises.",r:"dim"  }],
  ],
  [
    [{ w: "Earn",    r: "gold" }, { w: "your",     r: "dim"  }],
    [{ w: "recovery.",r:"mid"  }],
  ],
];

const AVATAR_GRADS = [
  "linear-gradient(135deg,#c9a96e,#8b6914)",
  "linear-gradient(135deg,#6d5c3a,#c9a96e)",
  "linear-gradient(135deg,#3a2e1a,#e8c98a)",
];

// ── Inject keyframe animations once ───────────────────────────────────────────
function useGlobalStyles() {
  useEffect(() => {
    if (document.getElementById("lux-login-styles")) return;
    const el = document.createElement("style");
    el.id = "lux-login-styles";
    el.textContent = `
      @keyframes luxShimmer {
        0%,100% { opacity: 0.18; }
        50%      { opacity: 0.42; }
      }
      @keyframes luxGlow {
        0%,100% { opacity: 0.55; transform: scale(1); }
        50%      { opacity: 0.9;  transform: scale(1.14); }
      }
      @keyframes luxPing {
        0%   { transform: scale(1);   opacity: 0.75; }
        100% { transform: scale(2.6); opacity: 0;    }
      }
      @keyframes luxLogoGlow {
        0%,100% { box-shadow: 0 0 18px rgba(201,169,110,0.35); }
        50%      { box-shadow: 0 0 32px rgba(232,201,138,0.55); }
      }
      @keyframes luxTicker {
        from { transform: translateX(0); }
        to   { transform: translateX(-50%); }
      }
      @keyframes luxFadeUp {
        from { opacity: 0; transform: translateY(18px); }
        to   { opacity: 1; transform: translateY(0);    }
      }
      @keyframes luxWordIn {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0);    }
      }
      @keyframes luxCtaPulse {
        0%,100% { box-shadow: inset 0 0 0 0.5px rgba(201,169,110,0.35); }
        50%      { box-shadow: inset 0 0 0 0.5px rgba(232,201,138,0.6); }
      }
    `;
    document.head.appendChild(el);
    return () => el.remove();
  }, []);
}

// ── Forgot-password modal (luxury reskin) ──────────────────────────────────────
function ForgotModal({ onClose }: { onClose: () => void }) {
  const [email,   setEmail]   = useState("");
  const [sending, setSending] = useState(false);
  const [sent,    setSent]    = useState(false);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSending(true);
    try {
      const res  = await fetch(`${API}/forgot-password`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to send reset email");
      setSent(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 40,
          background: "rgba(8,6,8,0.85)", backdropFilter: "blur(6px)",
        }}
      />

      {/* Panel */}
      <div style={{
        position: "fixed", inset: 0, zIndex: 50,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
      }}>
        <div style={{
          width: "100%", maxWidth: 380,
          background: RP,
          border: `0.5px solid rgba(201,169,110,0.2)`,
          borderRadius: 16, padding: "32px 28px",
          animation: "luxFadeUp 0.22s ease-out both",
        }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
            <div>
              <p style={{ fontSize: 9, letterSpacing: 4, textTransform: "uppercase", color: `rgba(201,169,110,0.5)`, marginBottom: 8 }}>
                Account Recovery
              </p>
              <h2 style={{ fontSize: 20, fontWeight: 300, color: OW, margin: 0 }}>Reset your password</h2>
              <p style={{ fontSize: 11, color: `rgba(240,235,227,0.3)`, marginTop: 4 }}>We'll email you a secure link.</p>
            </div>
            <button
              type="button" onClick={onClose}
              style={{ background: "none", border: "none", cursor: "pointer", color: `rgba(240,235,227,0.25)`, padding: 4 }}
            >
              <X size={18} />
            </button>
          </div>

          {sent ? (
            <div style={{ textAlign: "center", padding: "8px 0" }}>
              <div style={{
                width: 52, height: 52, borderRadius: 12, margin: "0 auto 16px",
                background: `rgba(201,169,110,0.1)`,
                border: `0.5px solid rgba(201,169,110,0.25)`,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <Mail size={22} color={G1} />
              </div>
              <p style={{ color: OW, fontSize: 15, fontWeight: 400, marginBottom: 6 }}>Check your inbox</p>
              <p style={{ fontSize: 12, color: `rgba(240,235,227,0.3)`, lineHeight: 1.7 }}>
                We sent a reset link to <span style={{ color: `rgba(240,235,227,0.6)` }}>{email}</span>.
                It expires in 1 hour.
              </p>
              <button
                type="button" onClick={onClose}
                style={{
                  marginTop: 20, width: "100%", height: 42,
                  background: "transparent",
                  border: `0.5px solid rgba(201,169,110,0.3)`,
                  borderRadius: 0, cursor: "pointer",
                  fontSize: 10, letterSpacing: 4, textTransform: "uppercase", color: G1,
                }}
              >
                Back to login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSend}>
              <p style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: `rgba(201,169,110,0.45)`, marginBottom: 10 }}>
                Email address
              </p>
              <div style={{
                display: "flex", alignItems: "center", gap: 10,
                borderBottom: `0.5px solid rgba(240,235,227,0.12)`, paddingBottom: 10, marginBottom: 24,
              }}>
                <Mail size={14} color={`rgba(201,169,110,0.35)`} />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required autoFocus
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    fontSize: 13, color: OW,
                  }}
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                style={{
                  width: "100%", height: 44,
                  background: "transparent",
                  border: `0.5px solid rgba(201,169,110,0.35)`,
                  borderRadius: 0, cursor: sending ? "not-allowed" : "pointer",
                  opacity: sending ? 0.6 : 1,
                  fontSize: 10, letterSpacing: 4, textTransform: "uppercase", color: G1,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                }}
              >
                {sending ? "Sending…" : <>Send reset link <ArrowRight size={14} /></>}
              </button>
            </form>
          )}
        </div>
      </div>
    </>
  );
}

// ── Main Login ─────────────────────────────────────────────────────────────────
interface LoginProps {
  onLogin:         (email: string, password: string, mode: "member" | "gym") => Promise<void>;
  onSwitchToSignUp: () => void;
  onDemoLogin:     (accountType: "user" | "trainer" | "admin") => void;
  onGymSignup?:    () => void;
}

export function Login({ onLogin, onSwitchToSignUp, onDemoLogin, onGymSignup }: LoginProps) {
  useGlobalStyles();

  const [email,       setEmail]       = useState("");
  const [password,    setPassword]    = useState("");
  const [showPass,    setShowPass]    = useState(false);
  const [mode,        setMode]        = useState<"member" | "gym">("member");
  const [showForgot,  setShowForgot]  = useState(false);
  const [mounted,     setMounted]     = useState(false);
  const [quoteIdx,    setQuoteIdx]    = useState(0);
  const [quoteKey,    setQuoteKey]    = useState(0);
  const [tickerIdx,   setTickerIdx]   = useState(0);
  const [loginError,  setLoginError]  = useState<string | null>(null);
  const [submitting,  setSubmitting]  = useState(false);
  const tickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Rotate motivational quote every 4 s
  useEffect(() => {
    const id = setInterval(() => {
      setQuoteIdx(i => (i + 1) % KINETIC_QUOTES.length);
      setQuoteKey(k => k + 1);
    }, 4000);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(null);
    setSubmitting(true);
    try {
      await onLogin(email, password, mode);
    } catch (err: any) {
      const msg: string = err.message || "Login failed";
      const noAccount = /not found|no user|user.+not|does not exist/i.test(msg);
      setLoginError(
        noAccount
          ? "No account found with this email — Sign up!"
          : /password|wrong|invalid credential/i.test(msg)
          ? "Wrong password"
          : msg
      );
    } finally {
      setSubmitting(false);
    }
  };


  const doubled = [...TICKER, ...TICKER]; // seamless loop

  return (
    <div style={{
      minHeight: "100vh", background: OB,
      display: "flex", flexDirection: "column",
      opacity: mounted ? 1 : 0,
      transition: "opacity 0.5s ease",
    }}>

      {/* ── Main split row ──────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: "flex", minHeight: 0 }}>

        {/* ════════ LEFT PANEL ════════ */}
        <div style={{
          flex: "1 1 0", position: "relative", overflow: "hidden",
          display: "flex", flexDirection: "column", justifyContent: "flex-start",
          padding: "48px 60px 140px", gap: 0,
        }}>
          {/* ── Photo mosaic background ── */}
          <div style={{
            position: "absolute", inset: 0,
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gridTemplateRows: "repeat(3, 1fr)",
            gap: 3,
          }}>
            {([
              // Row 1
              [1552249, "man doing pull-ups"],
              [841130,  "barbell rack"],
              [1229356, "dumbbell closeup"],
              [2261477, "man at gym"],
              // Row 2
              [3837757, "man lifting weights"],
              [1431282, "man workout bench"],
              [4162449, "man training gym"],
              [703012,  "man barbell lift"],
              // Row 3
              [3253501, "man performance training"],
              [2294361, "barbell weights floor"],
              [1550649, "man gym session"],
              [414029,  "male runner athlete"],
            ] as [number, string][]).map(([id, alt], i) => (
              <div key={i} style={{
                overflow: "hidden", position: "relative",
                background: i % 3 === 0 ? "#111008" : i % 3 === 1 ? "#0d0b08" : "#0f0e06",
              }}>
                <img
                  src={`https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=400&h=300&fit=crop`}
                  alt={alt}
                  loading="eager"
                  onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0"; }}
                  style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%",
                    objectFit: "cover",
                    filter: "blur(4px) saturate(0.2) brightness(0.45) sepia(0.5)",
                    transform: "scale(1.12)",
                  }}
                />
              </div>
            ))}
          </div>

          {/* Mosaic dark overlay */}
          <div style={{
            position: "absolute", inset: 0,
            background: "rgba(8,6,8,0.72)",
          }} />

          {/* Warm glow orb */}
          <div style={{
            position: "absolute", width: 500, height: 500, borderRadius: "50%",
            background: `radial-gradient(circle, rgba(201,169,110,0.09) 0%, transparent 65%)`,
            top: "-100px", left: "-100px",
            animation: "luxGlow 9s ease-in-out infinite",
          }} />

          {/* Gold shimmer lines */}
          {[28, 72].map((top, i) => (
            <div key={i} style={{
              position: "absolute", left: 0, right: 0, height: 0.5, top: `${top}%`,
              background: `linear-gradient(90deg, transparent 0%, ${G1} 30%, ${G2} 50%, ${G1} 70%, transparent 100%)`,
              animation: `luxShimmer 6s ease-in-out infinite ${i * 3}s`,
            }} />
          ))}

          {/* Right edge hairline */}
          <div style={{
            position: "absolute", top: 0, right: 0, bottom: 0, width: 0.5,
            background: `linear-gradient(180deg, transparent 0%, ${G1} 25%, ${G2} 50%, ${G1} 75%, transparent 100%)`,
            opacity: 0.25,
          }} />

          {/* ── Brand ── */}
          <div style={{ position: "relative", zIndex: 2, animation: "luxFadeUp 0.6s ease-out both", marginBottom: 32 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none"
                style={{ flexShrink: 0, filter: "drop-shadow(0 0 8px rgba(201,169,110,0.4))", animation: "luxLogoGlow 4s ease-in-out infinite" }}>
                <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="rgba(201,169,110,0.07)" stroke="#c9a96e" strokeWidth="1"/>
                <polygon points="20,9 30,15 30,25 20,31 10,25 10,15" fill="rgba(201,169,110,0.1)"/>
                {mode === "gym"
                  ? <><line x1="20" y1="13" x2="20" y2="27" stroke="#c9a96e" strokeWidth="1.2" strokeLinecap="round"/><line x1="13" y1="20" x2="27" y2="20" stroke="#c9a96e" strokeWidth="1.2" strokeLinecap="round"/></>
                  : <text x="20" y="25" fontFamily="Georgia,serif" fontSize="13" fontWeight="700" fill="#c9a96e" textAnchor="middle">FX</text>
                }
              </svg>
              <div>
                <p style={{ fontSize: 13, letterSpacing: 7, textTransform: "uppercase", color: `rgba(201,169,110,0.75)`, fontWeight: 400, marginBottom: 2 }}>
                  Flex
                </p>
                <p style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: `rgba(240,235,227,0.2)` }}>
                  Elite Fitness Platform
                </p>
              </div>
            </div>

            {/* Headline */}
            <h1 style={{ fontSize: 40, fontWeight: 300, color: OW, lineHeight: 1.15, letterSpacing: -1, marginBottom: 16 }}>
              Train like<br />
              <span style={{ fontWeight: 500, color: "#fff" }}>you mean it.</span>
            </h1>
            <p style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", color: `rgba(240,235,227,0.25)`, lineHeight: 2.2 }}>
              Elite fitness · Premium community<br />Exclusive coaching
            </p>
          </div>

          {/* ── Kinetic word-by-word quote ── */}
          <div style={{ position: "relative", zIndex: 2, marginBottom: 44 }}>
            {/* Vertical gold rule */}
            <div style={{
              position: "absolute", left: 0, top: 2, bottom: 18, width: 1.5,
              background: `linear-gradient(180deg, ${G1}, rgba(201,169,110,0.1))`,
              borderRadius: 1,
            }} />

            <div key={quoteKey} style={{ paddingLeft: 20 }}>
              {/* Lines of kinetic words */}
              {KINETIC_QUOTES[quoteIdx].map((line, lineIdx) => {
                // running word index for stagger offset
                const wordsBefore = KINETIC_QUOTES[quoteIdx]
                  .slice(0, lineIdx)
                  .reduce((acc, l) => acc + l.length, 0);
                return (
                  <div
                    key={lineIdx}
                    style={{
                      display: "flex", flexWrap: "wrap", gap: "0 10px",
                      marginBottom: lineIdx < KINETIC_QUOTES[quoteIdx].length - 1 ? 6 : 0,
                    }}
                  >
                    {line.map((kw, wi) => {
                      const globalIdx = wordsBefore + wi;
                      const delay = `${globalIdx * 0.09}s`;
                      const isGold = kw.r === "gold";
                      const isMid  = kw.r === "mid";
                      return (
                        <span
                          key={wi}
                          style={{
                            display: "inline-block",
                            fontSize: 24,
                            fontWeight: isGold ? 500 : isMid ? 400 : 300,
                            letterSpacing: -0.5,
                            lineHeight: 1.2,
                            animation: `luxWordIn 0.55s cubic-bezier(0.22,1,0.36,1) ${delay} both`,
                            // Gold words get gradient text
                            ...(isGold ? {
                              background: `linear-gradient(90deg, ${G1}, ${G2})`,
                              WebkitBackgroundClip: "text",
                              WebkitTextFillColor: "transparent",
                            } : {
                              color: isMid
                                ? `rgba(240,235,227,0.62)`
                                : `rgba(240,235,227,0.28)`,
                            }),
                          }}
                        >
                          {kw.w}
                        </span>
                      );
                    })}
                  </div>
                );
              })}

              {/* Progress pip row */}
              <div style={{ display: "flex", gap: 5, marginTop: 14 }}>
                {KINETIC_QUOTES.map((_, i) => (
                  <div key={i} style={{
                    height: 1.5, borderRadius: 1,
                    width: i === quoteIdx ? 18 : 4,
                    background: i === quoteIdx
                      ? `linear-gradient(90deg, ${G1}, ${G2})`
                      : `rgba(201,169,110,0.15)`,
                    transition: "width 0.45s cubic-bezier(0.4,0,0.2,1), background 0.45s",
                  }} />
                ))}
              </div>
            </div>
          </div>

          {/* ── Stats ── */}
          <div style={{
            position: "relative", zIndex: 2,
            display: "flex", gap: 36,
            animation: "luxFadeUp 0.6s ease-out 0.15s both",
            marginBottom: 40,
          }}>
            {STATS.map(s => (
              <div key={s.label}>
                <p style={{
                  fontSize: 28, fontWeight: 300, letterSpacing: -1, marginBottom: 4,
                  background: `linear-gradient(135deg, ${G1}, ${G2}, ${G1})`,
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}>
                  {s.num}
                </p>
                <p style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: `rgba(240,235,227,0.22)` }}>
                  {s.label}
                </p>
              </div>
            ))}
          </div>

          {/* ── Testimonial — pinned to bottom ── */}
          <div style={{
            position: "absolute", bottom: 56, left: 60, right: 60,
            zIndex: 2,
            animation: "luxFadeUp 0.6s ease-out 0.3s both",
          }}>
            <div style={{ width: 28, height: 0.5, background: `linear-gradient(90deg, ${G1}, transparent)`, marginBottom: 12 }} />
            <p style={{ fontSize: 12, color: `rgba(240,235,227,0.35)`, lineHeight: 1.8, fontStyle: "italic", marginBottom: 10 }}>
              "The only platform that matched my obsession with progress."
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 26, height: 26, borderRadius: "50%",
                background: `linear-gradient(135deg, ${G1}, #8b6914)`,
                border: `0.5px solid rgba(201,169,110,0.3)`,
              }} />
              <p style={{ fontSize: 9, letterSpacing: 2, textTransform: "uppercase", color: `rgba(201,169,110,0.45)` }}>
                @marcus — 127-day streak · Gold member
              </p>
            </div>
          </div>
        </div>

        {/* ════════ RIGHT PANEL ════════ */}
        <div style={{
          width: 440, flexShrink: 0, position: "relative", overflow: "hidden",
          background: RP,
          display: "flex", flexDirection: "column",
          padding: "48px 36px 32px",
          animation: "luxFadeUp 0.5s ease-out 0.1s both",
        }}>
          {/* Subtle bg gradient */}
          <div style={{
            position: "absolute", inset: 0,
            background: `radial-gradient(ellipse at 80% 10%, #080608 0%, ${RP} 60%)`,
            pointerEvents: "none",
          }} />

          {/* Left hairline */}
          <div style={{
            position: "absolute", top: 0, left: 0, bottom: 0, width: 0.5,
            background: `linear-gradient(180deg, transparent 0%, rgba(201,169,110,0.12) 30%, rgba(201,169,110,0.25) 50%, rgba(201,169,110,0.12) 70%, transparent 100%)`,
          }} />

          {/* ── Form heading ── */}
          <div style={{ position: "relative", zIndex: 2, marginBottom: 36 }}>
            <p style={{ fontSize: 9, letterSpacing: 4, textTransform: "uppercase", color: `rgba(201,169,110,0.5)`, marginBottom: 10 }}>
              {mode === "gym" ? "Gym portal" : "Member access"}
            </p>
            <h2 style={{ fontSize: 28, fontWeight: 300, color: OW, lineHeight: 1.2, letterSpacing: -0.5, marginBottom: 4 }}>
              <>Welcome<br /><span style={{ fontWeight: 500, color: "#fff" }}>back.</span></>
            </h2>
            <p style={{ fontSize: 11, color: `rgba(240,235,227,0.25)` }}>
              {"Your journey continues here."}
            </p>
          </div>

          {/* ── Tabs ── */}
          <div style={{
            position: "relative", zIndex: 2,
            display: "flex", gap: 0,
            borderBottom: `0.5px solid rgba(255,255,255,0.06)`,
            marginBottom: 32,
          }}>
            {(["member", "gym"] as const).map((m, i, arr) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                style={{
                  background: "none", border: "none", cursor: "pointer",
                  padding: "8px 0", marginRight: i < arr.length - 1 ? 28 : 0,
                  marginBottom: -0.5,
                  fontSize: 10, letterSpacing: 3, textTransform: "uppercase",
                  color: mode === m ? G1 : `rgba(255,255,255,0.22)`,
                  borderBottom: mode === m ? `1px solid ${G1}` : "1px solid transparent",
                  transition: "color 0.25s, border-color 0.25s",
                }}
              >
                {m === "member" ? "Member" : "Gym"}
              </button>
            ))}
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} style={{ position: "relative", zIndex: 2, flex: 1, display: "flex", flexDirection: "column", gap: 0 }}>

            {/* Email */}
            <div style={{ marginBottom: 24 }}>
              <p style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: loginError ? `rgba(239,68,68,0.7)` : `rgba(201,169,110,0.45)`, marginBottom: 12 }}>
                Email
              </p>
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                borderBottom: `0.5px solid ${loginError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.1)"}`,
                paddingBottom: 12, transition: "border-color 0.2s",
              }}>
                <Mail size={14} color={loginError ? `rgba(239,68,68,0.5)` : `rgba(201,169,110,0.3)`} strokeWidth={1.5} />
                <input
                  type="email" required
                  placeholder="you@example.com"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setLoginError(null); }}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    fontSize: 13, color: OW,
                  }}
                />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: loginError ? 12 : 32 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <p style={{ fontSize: 9, letterSpacing: 3, textTransform: "uppercase", color: loginError ? `rgba(239,68,68,0.7)` : `rgba(201,169,110,0.45)` }}>
                  Password
                </p>
                <button
                  type="button"
                  onClick={() => setShowForgot(true)}
                  style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 9, letterSpacing: 2, textTransform: "uppercase",
                    color: `rgba(201,169,110,0.35)`,
                  }}
                >
                  Forgot?
                </button>
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                borderBottom: `0.5px solid ${loginError ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.1)"}`,
                paddingBottom: 12, transition: "border-color 0.2s",
              }}>
                <Lock size={14} color={loginError ? `rgba(239,68,68,0.5)` : `rgba(201,169,110,0.3)`} strokeWidth={1.5} />
                <input
                  type={showPass ? "text" : "password"} required
                  placeholder="••••••••"
                  value={password}
                  onChange={e => { setPassword(e.target.value); setLoginError(null); }}
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    fontSize: 13, color: OW,
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: `rgba(201,169,110,0.3)` }}
                >
                  {showPass ? <EyeOff size={14} strokeWidth={1.5} /> : <Eye size={14} strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {/* Inline login error */}
            {loginError && (
              <div style={{
                marginBottom: 24,
                display: "flex", alignItems: "center", gap: 8,
                background: "rgba(239,68,68,0.07)",
                border: "0.5px solid rgba(239,68,68,0.25)",
                borderRadius: 0, padding: "9px 12px",
              }}>
                <span style={{ fontSize: 11, color: "rgba(239,68,68,0.85)", lineHeight: 1.5 }}>
                  {loginError}
                  {/Sign up/i.test(loginError) && (
                    <> <button type="button" onClick={onSwitchToSignUp} style={{ background: "none", border: "none", cursor: "pointer", color: G1, fontSize: 11, padding: 0, textDecoration: "underline" }}>Sign up now</button></>
                  )}
                </span>
              </div>
            )}

            {/* CTA */}
            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%", height: 46,
                background: `rgba(201,169,110,0.07)`,
                border: `0.5px solid rgba(201,169,110,0.35)`,
                borderRadius: 0, cursor: submitting ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
                fontSize: 10, letterSpacing: 5, textTransform: "uppercase",
                color: G1, opacity: submitting ? 0.6 : 1,
                animation: "luxCtaPulse 3s ease-in-out infinite",
                transition: "background 0.2s",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = `rgba(201,169,110,0.13)`)}
              onMouseLeave={e => (e.currentTarget.style.background = `rgba(201,169,110,0.07)`)}
            >
              {submitting ? "Signing in…" : mode === "gym" ? "Enter Dashboard" : "Enter"}
              {!submitting && <ArrowRight size={14} strokeWidth={1.5} />}
            </button>

            {/* Footer links */}
            <div style={{ marginTop: "auto", paddingTop: 24 }}>
              <div style={{ height: 0.5, background: `rgba(255,255,255,0.04)`, marginBottom: 20 }} />
              {mode === "gym" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, textAlign: "center" }}>
                  {onGymSignup && (
                    <button type="button" onClick={onGymSignup} style={{
                      background: "none", border: `0.5px solid rgba(201,169,110,0.18)`,
                      cursor: "pointer", padding: "8px 0",
                      fontSize: 9, letterSpacing: 3, textTransform: "uppercase",
                      color: `rgba(201,169,110,0.45)`,
                    }}>
                      Register your gym →
                    </button>
                  )}
                  <button type="button" onClick={() => setMode("member")} style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 9, letterSpacing: 2, textTransform: "uppercase",
                    color: `rgba(255,255,255,0.15)`,
                  }}>
                    ← Member login
                  </button>
                </div>
              ) : (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button type="button" onClick={onSwitchToSignUp} style={{
                    background: "none", border: "none", cursor: "pointer",
                    fontSize: 9, letterSpacing: 2, textTransform: "uppercase",
                    color: `rgba(201,169,110,0.4)`,
                  }}>
                    Create account
                  </button>
                  {onGymSignup && (
                    <button type="button" onClick={() => setMode("gym")} style={{
                      background: "none", border: "none", cursor: "pointer",
                      fontSize: 9, letterSpacing: 2, textTransform: "uppercase",
                      color: `rgba(255,255,255,0.15)`,
                    }}>
                      Gym portal →
                    </button>
                  )}
                </div>
              )}
            </div>
          </form>
        </div>
      </div>

      {/* ════════ LUXURY BOTTOM BAR ════════ */}
      <div style={{
        background: `rgba(8,6,8,0.96)`,
        borderTop: `0.5px solid rgba(201,169,110,0.15)`,
        padding: "10px 28px",
        display: "flex", alignItems: "center", gap: 0,
        backdropFilter: "blur(12px)",
        flexShrink: 0,
      }}>

        {/* Live indicator */}
        <div style={{
          display: "flex", alignItems: "center", gap: 8,
          paddingRight: 20,
          borderRight: `0.5px solid rgba(201,169,110,0.12)`,
          flexShrink: 0,
        }}>
          <div style={{ position: "relative", width: 8, height: 8 }}>
            <div style={{
              position: "absolute", inset: 0, borderRadius: "50%",
              background: G1,
              animation: "luxPing 2s ease-out infinite",
            }} />
            <div style={{
              position: "absolute", inset: 1.5, borderRadius: "50%",
              background: G2,
            }} />
          </div>
          <span style={{ fontSize: 8, letterSpacing: 3, textTransform: "uppercase", color: `rgba(201,169,110,0.5)` }}>
            Live
          </span>
        </div>

        {/* Ticker */}
        <div style={{
          flex: 1, overflow: "hidden", position: "relative",
          maskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to right, transparent 0%, black 8%, black 92%, transparent 100%)",
        }}>
          <div
            key={tickerIdx}
            style={{
              display: "flex", alignItems: "center",
              paddingLeft: 28,
              animation: `luxTicker 0.4s ease`,
            }}
          >
            <span style={{
              fontSize: 10, letterSpacing: 1.5,
              textTransform: "uppercase",
              color: `rgba(201,169,110,0.55)`,
              whiteSpace: "nowrap",
            }}>
              {TICKER[tickerIdx % TICKER.length]}
            </span>
          </div>
        </div>

        {/* Right spacer */}
        <div style={{ width: 28, flexShrink: 0 }} />
      </div>

    </div>
  );
}
