import re, os

BASE = os.path.dirname(os.path.abspath(__file__))

def fix(rel, fn):
    p = os.path.join(BASE, rel)
    with open(p, encoding='utf-8') as f: s = f.read()
    s2 = fn(s)
    with open(p, 'w', encoding='utf-8') as f: f.write(s2)
    print(f"{'CHANGED' if s2!=s else 'no change'}: {rel}")

# ── LeftSidebar ──────────────────────────────────────────────────────────────
def fix_sidebar(s):
    s = s.replace('  ShoppingBag,\n', '')
    s = s.replace('  Wallet,\n', '')
    s = s.replace('  { id: "flex-store", label: "Flex Store", Icon: ShoppingBag },\n', '')
    s = s.replace('  { id: "flex-wallet", label: "Wallet", Icon: Wallet },\n', '')
    s = re.sub(
        r'\s*\{currentUser\?\.accountType === "store" && \([\s\S]*?<NavBtn\s+id="store-hub"[\s\S]*?\)\s*\}\s*\)\s*\}',
        '', s)
    return s
fix('frontend/src/app/components/LeftSidebar.tsx', fix_sidebar)

# ── App.tsx ──────────────────────────────────────────────────────────────────
def fix_app(s):
    for imp in [
        'import { FlexStorePage }      from "./components/FlexStorePage";\n',
        'import { FlexWalletPage }     from "./components/FlexWalletPage";\n',
        'import { StoreDashboard }     from "./components/StoreDashboard";\n',
        'import { StoreSignupPage }    from "./components/StoreSignupPage";\n',
        'import { FlexMerchantSystem } from "./components/FlexMerchantSystem";\n',
    ]:
        s = s.replace(imp, '')
    s = s.replace('      if (mode === "store") { navigateTo("store-hub"); return; }\n', '')
    s = s.replace('          onStoreSignup={() => setCurrentView("store-signup")}\n', '')
    for block in [
        '\n          {/* ── Flex Store ── */}\n          {currentView === "flex-store" && (\n            <FlexStorePage onNavigate={navigateTo} />\n          )}',
        '\n\n          {/* ── Flex Wallet ── */}\n          {currentView === "flex-wallet" && (\n            <FlexWalletPage onNavigate={navigateTo} />\n          )}',
        '\n\n          {/* ── Store Hub (merchant dashboard) ── */}\n          {currentView === "store-hub" && currentUser?.accountType === "store" && (\n            <StoreDashboard currentUser={currentUser} onNavigate={navigateTo} />\n          )}',
        '\n\n          {/* ── Store Signup ── */}\n          {currentView === "store-signup" && (\n            <StoreSignupPage onNavigate={navigateTo} />\n          )}',
    ]:
        s = s.replace(block, '')
    s = re.sub(r'"flex-store", "flex-wallet", "store-hub", "store-signup",\s*\n\s*', '', s)
    s = re.sub(r'"flex-store", "flex-wallet", "store-hub",\s*\n\s*', '', s)
    s = s.replace('"store-signup", ', '')
    return s
fix('frontend/src/app/App.tsx', fix_app)

# ── TrainPage ────────────────────────────────────────────────────────────────
def fix_train(s):
    s = s.replace("import { MarketplacePage } from './MarketplacePage';\n", '')
    for line in [
        "  { id: 'live',         label: 'Session',       Icon: Play          },\n",
        "  { id: 'streams',      label: 'Live Streams',  Icon: Radio         },\n",
        "  { id: 'marketplace',  label: 'Marketplace',   Icon: ShoppingBag   },\n",
        "  { id: 'ai',           label: 'AI Workouts',   Icon: Sparkles      },\n",
    ]:
        s = s.replace(line, '')
    s = re.sub(r"\s*\{tab === 'live'[^\n]*\}", '', s)
    s = re.sub(r"\s*\{tab === 'streams'[^\n]*\}", '', s)
    s = re.sub(r"\s*\{tab === 'marketplace' && <MarketplacePage[^}]*\}", '', s)
    s = re.sub(r"\s*\{tab === 'ai'[^\n]*\}", '', s)
    s = re.sub(r'< className="w-3 h-3" />', '', s)
    for icon in ['Play', 'Radio', 'ShoppingBag', 'Sparkles']:
        s = re.sub(rf',\s*{icon}\b', '', s)
    return s
fix('frontend/src/app/components/TrainPage.tsx', fix_train)

# ── CommunityPage ────────────────────────────────────────────────────────────
def fix_community(s):
    s = s.replace("import { WorkoutBuddyPage } from './WorkoutBuddyPage';\n", '')
    s = s.replace("  { id: 'accountability',label: 'Pairs',       Icon: UserCheck     },\n", '')
    s = s.replace("  { id: 'buddy',         label: 'Find Buddy',  Icon: UserPlus2     },\n", '')
    s = re.sub(r"\s*\{tab === 'accountability'[^\n]*\}", '', s)
    s = re.sub(r"\s*\{tab === 'buddy'[^\n]*\}", '', s)
    for icon in ['UserCheck', 'UserPlus2']:
        s = re.sub(rf',\s*{icon}\b', '', s)
    return s
fix('frontend/src/app/components/CommunityPage.tsx', fix_community)

# ── HealthPage ───────────────────────────────────────────────────────────────
def fix_health(s):
    s = s.replace("import { HealthIntegrationPage } from './HealthIntegrationPage';\n", '')
    s = s.replace("  { id: 'wearables', label: 'Wearables',  Icon: Watch,           color: 'border-[#c9a96e]' },\n", '')
    s = re.sub(r"\s*\{tab === 'wearables'[^\}]*\}", '', s)
    s = re.sub(r',\s*Watch\b', '', s)
    return s
fix('frontend/src/app/components/HealthPage.tsx', fix_health)

# ── SettingsPage ─────────────────────────────────────────────────────────────
def fix_settings(s):
    s = s.replace(
        "type Page = null | 'account' | 'privacy' | 'notifications' | 'fitness' | 'apps' | 'export';",
        "type Page = null | 'account' | 'privacy' | 'notifications' | 'fitness' | 'apps';"
    )
    s = re.sub(r",?\s*\{\s*id:\s*'export'[^}]+label:\s*'Data & Export'[^}]+\}", '', s, flags=re.DOTALL)
    s = re.sub(r"if \(page === 'export'\) \{.*?return \(.*?\);\s*\}", '', s, flags=re.DOTALL)
    return s
fix('frontend/src/app/components/SettingsPage.tsx', fix_settings)

print("\nAll done! Now run: git add -A && git commit -m 'cleanup' && git push origin master")
