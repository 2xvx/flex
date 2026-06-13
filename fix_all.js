const fs = require('fs');

function fix(p, fn) {
  const s = fs.readFileSync(p, 'utf8');
  const s2 = fn(s);
  fs.writeFileSync(p, s2, 'utf8');
  console.log((s2 !== s ? 'CHANGED' : 'no change') + ': ' + p);
}

// ════════════════════════════════════════════════════════
// 1. Login.tsx — remove Store tab + remove Google button
// ════════════════════════════════════════════════════════
fix('frontend/src/app/components/auth/Login.tsx', s => {
  // Remove store from mode type and array
  s = s.replace('onLogin:         (email: string, password: string, mode: "member" | "gym" | "store") => Promise<void>;', 
                'onLogin:         (email: string, password: string, mode: "member" | "gym") => Promise<void>;');
  s = s.replace('  onStoreSignup?:  () => void;\n', '');
  s = s.replace('  onGoogleLogin?:  (user: import("../../types").User) => void;\n', '');
  s = s.replace('export function Login({ onLogin, onSwitchToSignUp, onDemoLogin, onGymSignup, onStoreSignup, onGoogleLogin }: LoginProps)',
                'export function Login({ onLogin, onSwitchToSignUp, onDemoLogin, onGymSignup }: LoginProps)');
  s = s.replace('const [mode,        setMode]        = useState<"member" | "gym" | "store">("member");',
                'const [mode,        setMode]        = useState<"member" | "gym">("member");');
  s = s.replace('(["member", "gym", "store"] as const)', '(["member", "gym"] as const)');
  // Remove handleGoogle function (find and remove it)
  s = s.replace(/\n  const handleGoogle = async \(\) => \{[\s\S]*?  \};\n/, '\n');
  // Remove import of signInWithGoogle from authService
  s = s.replace('import { signInWithGoogle } from "../../../services/authService";\n', '');
  // Remove Google button block in JSX
  s = s.replace(/\s*\{\/\* Google \*\/\}[\s\S]*?Continue with Google\s*<\/button>/g, '');
  // Remove store-mode conditional texts
  s = s.replace(/mode === "store" \? <>Store<br \/><span[^>]*>[^<]*<\/span><\/> : /g, '');
  s = s.replace(/mode === "store" \? "Sign in to your store dashboard\." : /g, '');
  s = s.replace(/mode === "store" \? "Enter Store Hub" : /g, '');
  s = s.replace(/mode === "store" ? "Store portal" : /g, '');
  // Remove store portal text in subtitle
  s = s.replace(/ mode === "store" \? "Store portal" :/g, '');
  return s;
});

// ════════════════════════════════════════════════════════
// 2. SignUp.tsx — remove Google + fix autocomplete + add username
// ════════════════════════════════════════════════════════
fix('frontend/src/app/components/auth/SignUp.tsx', s => {
  // Remove Google-related import
  s = s.replace('import { signInWithGoogle } from "../../../services/authService";\n', '');
  // Remove onGoogleLogin prop
  s = s.replace('  onGoogleLogin?: (user: import("../../types").User) => void;\n', '');
  s = s.replace(/,\s*onGoogleLogin\b/g, '');
  // Remove handleGoogle function
  s = s.replace(/\n  const handleGoogle = async \(\) => \{[\s\S]*?  \};\n/, '\n');
  // Remove Google button + OR divider in JSX
  s = s.replace(/\s*\{\/\* OR divider \*\/\}[\s\S]*?Continue with Google[\s\S]*?<\/button>/g, '');
  s = s.replace(/\s*<div[\s\S]*?OR[\s\S]*?<\/div>\s*\n\s*\{\/\*.*[Gg]oogle/g, '\n          {/* Google removed');
  // Fix password autocomplete
  s = s.replace(
    'placeholder="Min. 8 characters" value={password}',
    'autoComplete="new-password" placeholder="Min. 8 characters" value={password}'
  );
  s = s.replace(
    'placeholder="Repeat your password" value={confirm}',
    'autoComplete="new-password" placeholder="Repeat your password" value={confirm}'
  );
  // Add username state after email state
  s = s.replace(
    '  const [email,       setEmail]       = useState("");',
    '  const [email,       setEmail]       = useState("");\n  const [username,    setUsername]    = useState("");\n  const [unAvail,     setUnAvail]     = useState(false);\n  const [unChecking,  setUnChecking]  = useState(false);'
  );
  // Add username check effect after email state setup
  s = s.replace(
    '  const strength = getStrength(password);',
    `  // Debounced username availability check
  const checkUsername = (val: string) => {
    const clean = val.toLowerCase().replace(/[^a-z0-9_.]/g, '');
    setUsername(clean);
    if (clean.length < 3) { setUnAvail(false); return; }
    setUnChecking(true);
    clearTimeout((window as any).__unTimer);
    (window as any).__unTimer = setTimeout(async () => {
      try {
        const r = await fetch(\`\${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/check-username/\${clean}\`);
        const d = await r.json();
        setUnAvail(!d.available);
      } catch { setUnAvail(false); }
      setUnChecking(false);
    }, 500);
  };

  const strength = getStrength(password);`
  );
  // Add username to handleSubmit validation
  s = s.replace(
    '    if (password !== confirm) return toast.error("Passwords don\'t match");',
    '    if (!username || username.length < 3) return toast.error("Username must be at least 3 characters");\n    if (unAvail) return toast.error("Username already taken");\n    if (password !== confirm) return toast.error("Passwords don\'t match");'
  );
  // Pass username to onSignUp
  s = s.replace(
    "      onSignUp({ name, email, password, accountType, specialty, bio });",
    "      onSignUp({ name, email, password, accountType, specialty, bio, username });"
  );
  // Add username input field after name field in the form
  // Find the email label and add username before it
  s = s.replace(
    '          {/* Email */}\n          <div>',
    `          {/* Username */}
          <div>
            <label style={{ fontSize: 10, color: "rgba(240,235,227,0.35)", letterSpacing: 1.2, textTransform: "uppercase", display: "block", marginBottom: 6 }}>Username</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 13, top: "50%", transform: "translateY(-50%)", color: "rgba(240,235,227,0.3)", fontSize: 14 }}>@</span>
              <input type="text" className="su-input" style={{ ...inputStyle, paddingLeft: 30, borderColor: username.length >= 3 ? (unAvail ? "rgba(239,68,68,0.4)" : unChecking ? "rgba(201,169,110,0.2)" : "rgba(34,197,94,0.4)") : "rgba(201,169,110,0.12)" }} placeholder="yourname" value={username} onChange={e => checkUsername(e.target.value)} required />
              {username.length >= 3 && <span style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", fontSize: 12 }}>{unChecking ? "⏳" : unAvail ? "❌" : "✅"}</span>}
            </div>
            {unAvail && <p style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>Username already taken</p>}
          </div>

          {/* Email */}
          <div>`
  );
  return s;
});

// ════════════════════════════════════════════════════════
// 3. App.tsx — remove Google + store props, fix error msg, pass username
// ════════════════════════════════════════════════════════
fix('frontend/src/app/App.tsx', s => {
  // Remove handleGoogleLogin function
  s = s.replace(/\n  const handleGoogleLogin = async[^}]+\};\n/g, '\n');
  // Remove onGoogleLogin props from SignUp and Login
  s = s.replace('\n          onGoogleLogin={handleGoogleLogin}', '');
  // Remove onStoreSignup prop from Login
  s = s.replace('\n          onStoreSignup={() => setCurrentView("store-signup")}', '');
  // Fix email-already-in-use error message
  s = s.replace(
    '    } catch (err: any) {\n      toast.error(err.message || "Sign up failed");\n    }',
    '    } catch (err: any) {\n      const msg = err.message || "";\n      if (/already.in.use|email.*exists/i.test(msg)) toast.error("Email already registered — try signing in instead.");\n      else toast.error(msg || "Sign up failed");\n    }'
  );
  return s;
});

// ════════════════════════════════════════════════════════
// 4. TrainPage.tsx — add challenges render block + import
// ════════════════════════════════════════════════════════
fix('frontend/src/app/components/TrainPage.tsx', s => {
  // Add WeeklyChallengePage import if not there
  if (!s.includes('WeeklyChallengePage')) {
    s = s.replace(
      "import { PRTracker } from './PRTracker';",
      "import { PRTracker } from './PRTracker';\nimport { WeeklyChallengePage } from './WeeklyChallengePage';"
    );
  }
  // Add challenges tab render
  s = s.replace(
    "      {tab === 'recap'       && <WeeklyRecapPage currentUser={currentUser} />}",
    "      {tab === 'challenges'  && <WeeklyChallengePage currentUser={currentUser} />}\n      {tab === 'recap'       && <WeeklyRecapPage currentUser={currentUser} />}"
  );
  return s;
});

// ════════════════════════════════════════════════════════
// 5. GymSignupPage.tsx — auto login after registration
// ════════════════════════════════════════════════════════
fix('frontend/src/app/components/GymSignupPage.tsx', s => {
  // Add signIn import if not there
  if (!s.includes("signIn") && !s.includes("signInWithEmail")) {
    s = s.replace(
      "import { API } from '../../config';",
      "import { API } from '../../config';\nimport { signIn } from '../../../services/authService';"
    );
  }
  // After res.ok block, add auto-login
  s = s.replace(
    "      if (!res.ok) {\n        const err = await res.json().catch(() => ({}));\n        throw new Error(err.error || 'Registration failed');\n      }",
    `      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Registration failed');
      }
      setDone(true);
      // Auto-login the gym account
      try {
        await signIn(email, password);
      } catch {}
      if (onBack) onBack();`
  );
  return s;
});

// ════════════════════════════════════════════════════════
// 6. Also fix cleanup (LeftSidebar + App store routes)
// ════════════════════════════════════════════════════════
fix('frontend/src/app/components/LeftSidebar.tsx', s => {
  s = s.replace('  ShoppingBag,\n', '');
  s = s.replace('  Wallet,\n', '');
  s = s.replace('  { id: "flex-store", label: "Flex Store", Icon: ShoppingBag },\n', '');
  s = s.replace('  { id: "flex-wallet", label: "Wallet", Icon: Wallet },\n', '');
  return s;
});

fix('frontend/src/app/App.tsx', s => {
  s = s.replace('import { FlexStorePage }      from "./components/FlexStorePage";\n', '');
  s = s.replace('import { FlexWalletPage }     from "./components/FlexWalletPage";\n', '');
  s = s.replace('import { StoreDashboard }     from "./components/StoreDashboard";\n', '');
  s = s.replace('import { StoreSignupPage }    from "./components/StoreSignupPage";\n', '');
  s = s.replace('import { FlexMerchantSystem } from "./components/FlexMerchantSystem";\n', '');
  s = s.replace('      if (mode === "store") { navigateTo("store-hub"); return; }\n', '');
  s = s.replace(/\n\s*\{\/\* ── Flex Store ── \*\/\}\s*\{currentView === "flex-store"[\s\S]*?\}\s*\)\}/g, '');
  s = s.replace(/\n\s*\{\/\* ── Flex Wallet ── \*\/\}\s*\{currentView === "flex-wallet"[\s\S]*?\}\s*\)\}/g, '');
  s = s.replace(/\n\s*\{\/\* ── Store Hub[\s\S]*?\}\s*\)\}/g, '');
  s = s.replace(/\n\s*\{\/\* ── Store Signup[\s\S]*?\}\s*\)\}/g, '');
  return s;
});

fix('frontend/src/app/components/TrainPage.tsx', s => {
  s = s.replace("  { id: 'live',         label: 'Session',       Icon: Play          },\n", '');
  s = s.replace("  { id: 'streams',      label: 'Live Streams',  Icon: Radio         },\n", '');
  s = s.replace("  { id: 'marketplace',  label: 'Marketplace',   Icon: ShoppingBag   },\n", '');
  s = s.replace("  { id: 'ai',           label: 'AI Workouts',   Icon: Sparkles      },\n", '');
  s = s.replace("import { MarketplacePage } from './MarketplacePage';\n", '');
  s = s.replace(/\s*\{tab === 'live'[^\n]*\}/g, '');
  s = s.replace(/\s*\{tab === 'streams'[^\n]*\}/g, '');
  s = s.replace(/\s*\{tab === 'marketplace'[^}]*\}/g, '');
  s = s.replace(/\s*\{tab === 'ai'[^\n]*\}/g, '');
  ['Play','Radio','Sparkles'].forEach(i => { s = s.replace(new RegExp(',\\s*' + i + '\\b'), ''); });
  return s;
});

fix('frontend/src/app/components/CommunityPage.tsx', s => {
  s = s.replace("import { WorkoutBuddyPage } from './WorkoutBuddyPage';\n", '');
  s = s.replace("  { id: 'accountability',label: 'Pairs',       Icon: UserCheck     },\n", '');
  s = s.replace("  { id: 'buddy',         label: 'Find Buddy',  Icon: UserPlus2     },\n", '');
  s = s.replace(/\s*\{tab === 'accountability'[^\n]*\}/g, '');
  s = s.replace(/\s*\{tab === 'buddy'[^\n]*\}/g, '');
  ['UserCheck','UserPlus2'].forEach(i => { s = s.replace(new RegExp(',\\s*' + i + '\\b'), ''); });
  return s;
});

fix('frontend/src/app/components/HealthPage.tsx', s => {
  s = s.replace("import { HealthIntegrationPage } from './HealthIntegrationPage';\n", '');
  s = s.replace("  { id: 'wearables', label: 'Wearables',  Icon: Watch,           color: 'border-[#c9a96e]' },\n", '');
  s = s.replace(/\s*\{tab === 'wearables'[^}]*\}/g, '');
  s = s.replace(/,\s*Watch\b/, '');
  return s;
});

fix('frontend/src/app/components/SettingsPage.tsx', s => {
  s = s.replace(
    "type Page = null | 'account' | 'privacy' | 'notifications' | 'fitness' | 'apps' | 'export';",
    "type Page = null | 'account' | 'privacy' | 'notifications' | 'fitness' | 'apps';"
  );
  s = s.replace(/,?\s*\{\s*id:\s*'export'[\s\S]*?label:\s*'Data & Export'[\s\S]*?\}/g, '');
  s = s.replace(/if \(page === 'export'\) \{[\s\S]*?return \([\s\S]*?\);\s*\}/g, '');
  return s;
});

console.log('\n✅ Done! Now run:\ngit add -A\ngit commit -m "fix: all 7 issues"\ngit push origin master');
