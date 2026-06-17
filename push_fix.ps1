Remove-Item ".git\index.lock" -ErrorAction SilentlyContinue
git add frontend/src/app/App.tsx
git add frontend/src/app/components/auth/Login.tsx
git add frontend/src/app/components/auth/SignUp.tsx
git add frontend/src/app/components/GymSignupPage.tsx
git add frontend/src/app/components/TrainPage.tsx
git add frontend/src/services/authService.ts
git commit -m "fix: remove google, store, gym tabs; fix session persistence on refresh"
git push
