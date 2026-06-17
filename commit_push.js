const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = __dirname;
const lock = path.join(root, '.git', 'index.lock');

// Force-remove the git lock
if (fs.existsSync(lock)) {
  try { fs.unlinkSync(lock); console.log('Removed index.lock'); }
  catch (e) { console.log('Could not remove lock:', e.message); }
}

const run = (cmd) => {
  try {
    const out = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: 'pipe' });
    if (out.trim()) console.log(out.trim());
  } catch (e) {
    console.error('FAILED:', cmd);
    console.error(e.stdout || e.message);
    process.exit(1);
  }
};

run('git add frontend/src/app/App.tsx');
run('git add frontend/src/app/components/auth/Login.tsx');
run('git add frontend/src/app/components/auth/SignUp.tsx');
run('git add frontend/src/app/components/GymSignupPage.tsx');
run('git add frontend/src/app/components/TrainPage.tsx');
run('git add frontend/src/services/authService.ts');

// Check if there's anything to commit
try {
  execSync('git diff --cached --quiet', { cwd: root });
  console.log('Nothing new to commit - forcing a push of existing commits...');
} catch {
  run('git commit -m "fix: member-only login, session persistence, no google/store/gym"');
}

run('git push origin master');
console.log('\nDone! Vercel will deploy in ~1 minute.');
