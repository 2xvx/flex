# Flex — Deployment Guide

## Overview
- **Frontend** → Vercel  
- **Backend API** → Render  

---

## Step 1 — Push to GitHub

1. Go to [github.com](https://github.com) → New repository → name it `flex`
2. In your project root (`C:\Users\OMEN\OneDrive\سطح المكتب\Flex`), open a terminal and run:

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/flex.git
git push -u origin main
```

> The `.gitignore` already excludes `serviceAccountKey.json` and `.env` — they will NOT be uploaded to GitHub.

---

## Step 2 — Deploy Backend to Render

1. Go to [render.com](https://render.com) → Sign up / Log in
2. Click **New +** → **Web Service**
3. Connect your GitHub account and select the `flex` repo
4. Configure:
   - **Root Directory:** `backend`
   - **Runtime:** Node
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
5. Under **Environment Variables**, add these one by one:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `FIREBASE_WEB_API_KEY` | `AIzaSyDYIbJ010CGwWqBLtv4j_TqA6l31HJUrEU` |
| `FIREBASE_SERVICE_ACCOUNT` | *(paste the JSON below — the whole thing as one line)* |
| `BREVO_SMTP_USER` | `abfa7a001@smtp-brevo.com` |
| `BREVO_SMTP_KEY` | `xsmtpsib-06cc382f7461cae3555bb55eb10e3792e1977e01a63faaf5b808dd467a388510-Gq53vABe7Czk8K5L` |
| `BREVO_FROM_NAME` | `Flex` |
| `BREVO_FROM_EMAIL` | `mohammaddarsani@gmail.com` |

**FIREBASE_SERVICE_ACCOUNT value** (copy the entire line below):
```
{"type":"service_account","project_id":"fitconnect-937d0","private_key_id":"c7424af8ee25ddd6b95d8541a8f234e1dc7bdb48","private_key":"-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDHsgbkGAjt7GwI\nPNW+gtDojh5EkFEegdxpsRsIjGo+zyGuWy3CfQXVj+np9lfMEiyy8jGmmyTdUZKq\nc3Jj8gmyDPaoSC0hjcMGXKXbH+Xy2FEgyQhc0OGJTQwC0u9/O22Tfa5Ky7hZ5Ms4\n8fACoqsmCalCWE426z5pEWGvpKJNuRh4PCRXnlyFnT69/msWCopiRa4wy0l1YWuA\nTzd6I1nBibHNMR0iHMIwyDmIiLlFuM1C3Q2EtxYRD+pYckRZjik7DdpxUJZuWfSf\nghmWUx/iCYXcFjKuFYwAQJBFjYHEpqwFUKm1fjbQ8Hh8XE3fJ2JJKc5v963M3Wap\nTc1auzjTAgMBAAECggEAQ4iZ2v6j2m6nlFuaf4y3AMa7Rr21qUcKlvXNqiTuc2JS\nRihQv+LPG8vJNBXa2ElXM4dDsk/qdix1mM5lI5bBn6TRr9SE6sGJ8HdZodLWTbvJ\nJ/jEqrr7Yxca1kOmuhULeCM7U9E0fbYp4g6z9/gyQDFpO+YoQVtqJlc5/ZAEUZsL\nwuw/WjIi9pf3Pk9U7atYbESCihsf7cdulezMi6p3mNRBfLOmeRYv2qCuFJLFNqgU\n8UR9DWno9VwzgMm4WrdG56n8+5W4Uc/ARiryjHXsoS1mUa3NXIgp83iU0mz4eRNd\nv4HCPwz35RHQGDBm5y3zLyMTcNaouYIXHPXA9v0bgQKBgQDpDkI0ke8FvQ6jCw1n\nkmEjKoxmTiCC+J5PJllBdigRB66p5dZOf/S0TvzMq2I2xnIow1iHGp4qv5zqaj5i\nbgIap7RtdrO42qUgUDb+3yv9WkBOVHK80eJ3M8GxZVzLhKet8X4YXNqQntjP6uw/\nHDN0/t4MBDmOFdK/cbYDj2PEgQKBgQDbWvvPddScVof38a1gfASU+sLIiKbnz8zr\nMDIHouNDAUwZ3v2UtG7tzXWklKZHP+aNeVDbGp/ZHgBYVSB1ak0PGhB1mETuuS5k\nTiW2eydsL9n+fJbLdoaY9VUDj2QYeCUfb9KGP5bnYW+D/8en39M3qEGlZTijuVeh\nV9fw05UDUwKBgQDO/VIB3Oc84ohAeQ2DwrexgxXFu3gWuvfn9nhpsqatUXRpA3BO\nskjFaC4RHdqSKbi0yaM0A4kdEKgubwRPacNGp1KRsk63TMJCK9xcjBxG3cSljU2G\ntKb+FiLfCtbbD0vaKtVCkB2zOtH4AH+pIcP2EnNmms3/ixRt4nG1QcJrgQKBgBgV\n2WhiK8IuzicvZjYd5/Ljxdd3CbySWJHKbPPhssp8rfp5PabCWRvLX4t+tvND1PDb\nzUEBn2Obo7YPQs0hquxplD0VRxxfQPTKj+GFjEKYznre+z/D9+t7pKYLbJYzOwBE\nqv0Kpmspi7EWuLl6HhsSYoLipmFzzGdu2csbsFT5AoGBALEh+Zd54n3g6r65fEdV\nFWuHjieiSI25zfzuoWHRdm1Zp7BhUbmPRyV8ASCq3n7NeZDH7YuEgA8brb7Xp7s8\n/DFq54ZFs2asi8VqZJ0CUh9FRGqbAQ/lvzy5nSs9Gb1yH+NkDXD3Z8RxkVeP9UjQ\n9nEbTBwyENBBDVkyMQMu1c/A\n-----END PRIVATE KEY-----\n","client_email":"firebase-adminsdk-fbsvc@fitconnect-937d0.iam.gserviceaccount.com","client_id":"102726162194615046229","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_x509_cert_url":"https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40fitconnect-937d0.iam.gserviceaccount.com","universe_domain":"googleapis.com"}
```

6. Click **Create Web Service** — Render will build and deploy.
7. Once deployed, copy your backend URL (e.g. `https://flex-api.onrender.com`)

---

## Step 3 — Deploy Frontend to Vercel

1. Go to [vercel.com](https://vercel.com) → Sign up / Log in with GitHub
2. Click **Add New Project** → Import the `flex` repo
3. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite (auto-detected)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Under **Environment Variables**, add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://flex-api.onrender.com` *(your Render URL from Step 2)* |

5. Click **Deploy** — Vercel builds and gives you a live URL like `https://flex-app.vercel.app`

---

## Step 4 — Update Firebase Auth Allowed Domains

1. Go to [Firebase Console](https://console.firebase.google.com) → `fitconnect-937d0`
2. **Authentication** → **Settings** → **Authorized domains**
3. Add your Vercel domain: `flex-app.vercel.app`

---

## Done! 🎉

Your app is live. Share the Vercel URL with your professors.
