const fs = require('fs');

function fix(p, fn) {
  const s = fs.readFileSync(p, 'utf8');
  const s2 = fn(s);
  fs.writeFileSync(p, s2, 'utf8');
  console.log((s2 !== s ? 'CHANGED' : 'no change') + ': ' + p);
}

// LeftSidebar
fix('frontend/src/app/components/LeftSidebar.tsx', s => {
  s = s.replace('  ShoppingBag,\n', '');
  s = s.replace('  Wallet,\n', '');
  s = s.replace('  { id: "flex-store", label: "Flex Store", Icon: ShoppingBag },\n', '');
  s = s.replace('  { id: "flex-wallet", label: "Wallet", Icon: Wallet },\n', '');
  s = s.replace(/\s*\{currentUser\?\.accountType === "store" && \([\s\S]*?<NavBtn\s+id="store-hub"[\s\S]*?\)\s*\}\s*\)\s*\}/g, '');
  return s;
});

// App.tsx
fix('frontend/src/app/App.tsx', s => {
  s = s.replace('import { FlexStorePage }      from "./components/FlexStorePage";\n', '');
  s = s.replace('import { FlexWalletPage }     from "./components/FlexWalletPage";\n', '');
  s = s.replace('import { StoreDashboard }     from "./components/StoreDashboard";\n', '');
  s = s.replace('import { StoreSignupPage }    from "./components/StoreSignupPage";\n', '');
  s = s.replace('import { FlexMerchantSystem } from "./components/FlexMerchantSystem";\n', '');
  s = s.replace('      if (mode === "store") { navigateTo("store-hub"); return; }\n', '');
  s = s.replace('          onStoreSignup={() => setCurrentView("store-signup")}\n', '');
  s = s.replace(/\n\s*\{\/\* ── Flex Store[^}]+FlexStorePage[^}]+\}\s*\)\}/g, '');
  s = s.replace(/\n\s*\{\/\* ── Flex Wallet[^}]+FlexWalletPage[^}]+\}\s*\)\}/g, '');
  s = s.replace(/\n\s*\{\/\* ── Store Hub[^}]+StoreDashboard[^}]+\}\s*\)\}/g, '');
  s = s.replace(/\n\s*\{\/\* ── Store Signup[^}]+StoreSignupPage[^}]+\}\s*\)\}/g, '');
  s = s.replace(/"flex-store", "flex-wallet", "store-hub", "store-signup",\n  /g, '');
  s = s.replace(/"flex-store", "flex-wallet", "store-hub",\n  /g, '');
  s = s.replace('"store-signup", ', '');
  return s;
});

// TrainPage
fix('frontend/src/app/components/TrainPage.tsx', s => {
  s = s.replace("import { MarketplacePage } from './MarketplacePage';\n", '');
  s = s.replace("  { id: 'live',         label: 'Session',       Icon: Play          },\n", '');
  s = s.replace("  { id: 'streams',      label: 'Live Streams',  Icon: Radio         },\n", '');
  s = s.replace("  { id: 'marketplace',  label: 'Marketplace',   Icon: ShoppingBag   },\n", '');
  s = s.replace("  { id: 'ai',           label: 'AI Workouts',   Icon: Sparkles      },\n", '');
  s = s.replace(/\s*\{tab === 'live'[^\n]*\}/g, '');
  s = s.replace(/\s*\{tab === 'streams'[^\n]*\}/g, '');
  s = s.replace(/\s*\{tab === 'marketplace' && <MarketplacePage[^}]*\}/g, '');
  s = s.replace(/\s*\{tab === 'ai'[^\n]*\}/g, '');
  s = s.replace(/< className="w-3 h-3" \/>/g, '');
  ['Play','Radio','ShoppingBag','Sparkles'].forEach(i => {
    s = s.replace(new RegExp(',\\s*' + i + '\\b'), '');
  });
  return s;
});

// CommunityPage
fix('frontend/src/app/components/CommunityPage.tsx', s => {
  s = s.replace("import { WorkoutBuddyPage } from './WorkoutBuddyPage';\n", '');
  s = s.replace("  { id: 'accountability',label: 'Pairs',       Icon: UserCheck     },\n", '');
  s = s.replace("  { id: 'buddy',         label: 'Find Buddy',  Icon: UserPlus2     },\n", '');
  s = s.replace(/\s*\{tab === 'accountability'[^\n]*\}/g, '');
  s = s.replace(/\s*\{tab === 'buddy'[^\n]*\}/g, '');
  ['UserCheck','UserPlus2'].forEach(i => {
    s = s.replace(new RegExp(',\\s*' + i + '\\b'), '');
  });
  return s;
});

// HealthPage
fix('frontend/src/app/components/HealthPage.tsx', s => {
  s = s.replace("import { HealthIntegrationPage } from './HealthIntegrationPage';\n", '');
  s = s.replace("  { id: 'wearables', label: 'Wearables',  Icon: Watch,           color: 'border-[#c9a96e]' },\n", '');
  s = s.replace(/\s*\{tab === 'wearables'[^}]*\}/g, '');
  s = s.replace(/,\s*Watch\b/, '');
  return s;
});

// SettingsPage
fix('frontend/src/app/components/SettingsPage.tsx', s => {
  s = s.replace(
    "type Page = null | 'account' | 'privacy' | 'notifications' | 'fitness' | 'apps' | 'export';",
    "type Page = null | 'account' | 'privacy' | 'notifications' | 'fitness' | 'apps';"
  );
  s = s.replace(/,?\s*\{\s*id:\s*'export'[\s\S]*?label:\s*'Data & Export'[\s\S]*?\}/g, '');
  s = s.replace(/if \(page === 'export'\) \{[\s\S]*?return \([\s\S]*?\);\s*\}/g, '');
  return s;
});

console.log('\nDone! Run: git add -A && git commit -m "cleanup" && git push origin master');
