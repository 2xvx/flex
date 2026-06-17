require('dotenv').config();
const express = require('express');
const admin = require('firebase-admin');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
// Load Firebase service account from env var (production) or file (local dev)
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = require("./serviceAccountKey.json");
}

// ─── Firebase Web API Key ─────────────────────────────────────────────────────
const FIREBASE_WEB_API_KEY = process.env.FIREBASE_WEB_API_KEY || '';

// ─── Nodemailer / Brevo SMTP ──────────────────────────────────────────────────
const mailer = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.BREVO_SMTP_USER || '',
    pass: process.env.BREVO_SMTP_KEY  || '',
  },
});

const FROM_NAME  = process.env.BREVO_FROM_NAME  || 'Flex';
const FROM_EMAIL = process.env.BREVO_FROM_EMAIL || process.env.BREVO_SMTP_USER || '';

function otpEmailHtml(code, name) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f0d12;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0d12;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#1a1625;border-radius:20px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#7c3aed,#a855f7);padding:32px 40px;text-align:center;">
            <p style="margin:0;color:#fff;font-size:28px;font-weight:900;letter-spacing:6px;text-transform:uppercase;">FLEX</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:40px;">
            <p style="margin:0 0 8px;color:rgba(255,255,255,0.9);font-size:22px;font-weight:700;">Verify your email</p>
            <p style="margin:0 0 32px;color:rgba(255,255,255,0.45);font-size:14px;line-height:1.6;">
              Hi${name ? ' ' + name : ''}! Use the code below to verify your account. It expires in <strong style="color:rgba(255,255,255,0.7)">15 minutes</strong>.
            </p>

            <!-- Code box -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr><td style="background:#0f0d12;border:1px solid rgba(124,58,237,0.4);border-radius:16px;padding:28px;text-align:center;">
                <p style="margin:0;color:#fff;font-size:44px;font-weight:900;letter-spacing:18px;font-family:'Courier New',monospace;">${code}</p>
              </td></tr>
            </table>

            <p style="margin:28px 0 0;color:rgba(255,255,255,0.3);font-size:12px;line-height:1.6;">
              If you didn't request this, you can safely ignore this email.<br>Never share this code with anyone.
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid rgba(255,255,255,0.06);text-align:center;">
            <p style="margin:0;color:rgba(255,255,255,0.2);font-size:11px;">© ${new Date().getFullYear()} Flex · All rights reserved</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const app = express();

// ─── CORS — only allow the Vite dev server (add your prod domain here too) ────
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:3000',
  'capacitor://localhost',   // Capacitor Android/iOS native app
  'http://localhost',        // Capacitor on some devices
  process.env.FRONTEND_URL, // set in .env for production
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Postman, mobile apps)
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return callback(null, true);
    callback(null, true); // DEV: allow all origins
  },
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Limit JSON body size to prevent payload flooding
app.use(express.json({ limit: '500mb' }));

// ─── RATE LIMITING (zero-dependency, in-memory) ───────────────────────────────
// Stores hit timestamps per IP in a Map. Old entries are evicted each request.
const _rlStore = new Map();
const makeRateLimiter = (windowMs, max, message) => (req, res, next) => {
  const ip  = req.ip || req.socket?.remoteAddress || 'unknown';
  const now = Date.now();
  const hits = (_rlStore.get(ip) || []).filter(t => now - t < windowMs);
  hits.push(now);
  _rlStore.set(ip, hits);
  if (hits.length > max) return res.status(429).json({ error: message });
  next();
};

const authLimiter = makeRateLimiter(15 * 60 * 1000, 50,  'Too many login attempts. Try again in 15 minutes.');
const apiLimiter  = makeRateLimiter(60  * 1000,      300, 'Too many requests. Slow down.');

app.use('/api/', apiLimiter);
app.post('/api/login',  authLimiter);
app.post('/api/signup', authLimiter);

// ─── Firebase init ────────────────────────────────────────────────────────────
try {
  if (!admin.apps.length) {
    admin.initializeApp({
      credential:    admin.credential.cert(serviceAccount),
      storageBucket: 'fitconnect-937d0.firebasestorage.app',
    });
    console.log('✅ Firebase Admin initialized');
  }
} catch (err) {
  console.error('❌ Firebase init failed:', err.message);
  process.exit(1);
}

const db     = admin.firestore();
const bucket = admin.storage().bucket();

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
// Verifies the Firebase ID token sent as "Authorization: Bearer <token>".
// Attach to any route that needs a real authenticated user.
const verifyToken = async (req, res, next) => {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization token' });
  }
  try {
    const decoded = await admin.auth().verifyIdToken(auth.slice(7));
    req.uid = decoded.uid; // caller's verified uid — use instead of trusting body
    next();
  } catch {
    return res.status(401).json({ error: 'Token expired or invalid. Please log in again.' });
  }
};

// ─── VERIFY OWNER ─────────────────────────────────────────────────────────────
// Ensures the token's uid matches :uid in the route param.
// Must be used AFTER verifyToken.
const verifyOwner = (req, res, next) => {
  if (req.uid !== req.params.uid) {
    return res.status(403).json({ error: 'You can only modify your own account.' });
  }
  next();
};

// ─── VERIFY ADMIN ─────────────────────────────────────────────────────────────
// Checks that the verified user has accountType === 'admin' in Firestore.
// Must be used AFTER verifyToken.
const verifyAdmin = async (req, res, next) => {
  try {
    const doc = await db.collection('users').doc(req.uid).get();
    if (!doc.exists || doc.data().accountType !== 'admin') {
      return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
  } catch {
    return res.status(500).json({ error: 'Authorization check failed.' });
  }
};

// ─── SANITIZE ─────────────────────────────────────────────────────────────────
// Strips HTML angle brackets to prevent stored XSS and trims the string.
// React already escapes on render, but defence-in-depth means we also sanitize
// at the point of storage.
const sanitize = (str, maxLen = 1000) => {
  if (typeof str !== 'string') return str;
  return str
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .trim()
    .slice(0, maxLen);
};

// ─── IMAGE UPLOAD ─────────────────────────────────────────────────────────────
// Accepts a base64-encoded image string, uploads it to Firebase Storage,
// makes it publicly readable, and returns a permanent HTTPS URL.
// The frontend should call this BEFORE creating a post/comment so Firestore
// stores a URL instead of a raw base64 string.
app.post('/api/upload', verifyToken, async (req, res) => {
  const { base64, folder = 'posts', filename } = req.body;
  if (!base64) return res.status(400).json({ error: 'base64 required' });

  try {
    const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) return res.status(400).json({ error: 'Invalid base64 format' });
    const mimeType = matches[1];
    const buffer   = Buffer.from(matches[2], 'base64');
    const ext      = mimeType.split('/')[1]?.replace('jpeg', 'jpg') || 'jpg';
    const name     = filename || `${Date.now()}_${Math.random().toString(36).substr(2, 8)}.${ext}`;
    const filepath = `${folder}/${req.uid}/${name}`;

    const fileRef = bucket.file(filepath);
    await fileRef.save(buffer, { metadata: { contentType: mimeType } });
    await fileRef.makePublic();

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filepath)}?alt=media`;
    res.json({ url });
  } catch (e) {
    console.error('Upload failed:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ─── SIGN UP ──────────────────────────────────────────────────────────────────
app.post('/api/signup', async (req, res) => {
  const { email, password, displayName, accountType, location, username: requestedUsername, specialty, bio } = req.body;
  try {
    const userRecord = await admin.auth().createUser({ email, password, displayName });
    const passwordHash = await bcrypt.hash(password, 10);

    // Use the requested username if provided; otherwise auto-generate from displayName
    let username = (requestedUsername || '').toLowerCase().replace(/[^a-z0-9_.]/g, '').slice(0, 30);
    if (!username || username.length < 3) {
      username = (displayName || email.split('@')[0]).toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 20) || 'user';
    }
    // Ensure uniqueness
    const existingSnap = await db.collection('users').where('username', '==', username).limit(1).get();
    if (!existingSnap.empty) {
      username = `${username}${Math.floor(1000 + Math.random() * 9000)}`;
    }

    await db.collection('users').doc(userRecord.uid).set({
      email,
      displayName,
      username,
      accountType: accountType || 'user',
      specialty: specialty || '',
      bio: bio || '',
      location: location || '',
      passwordHash,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ message: 'User created successfully', uid: userRecord.uid, username });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(400).json({ error: error.message });
  }
});

// ─── FORGOT PASSWORD ──────────────────────────────────────────────────────────
// Public endpoint — no auth required.
// Uses Firebase Auth REST API to send a password-reset email.
app.post('/api/forgot-password', async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  try {
    // Verify user exists first
    await admin.auth().getUserByEmail(email);

    // Generate a password reset link using Admin SDK (no web API key needed)
    const resetLink = await admin.auth().generatePasswordResetLink(email);

    // Send via Brevo SMTP if credentials are set; otherwise fall back to Firebase REST API
    const BREVO_USER = process.env.BREVO_SMTP_USER;
    const BREVO_KEY  = process.env.BREVO_SMTP_KEY;

    if (BREVO_USER && BREVO_KEY) {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: 'smtp-relay.brevo.com',
        port: 587,
        secure: false,
        auth: { user: BREVO_USER, pass: BREVO_KEY },
      });
      await transporter.sendMail({
        from: `"${process.env.BREVO_FROM_NAME || 'Flex'}" <${process.env.BREVO_FROM_EMAIL || BREVO_USER}>`,
        to: email,
        subject: 'Reset your Flex password',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;background:#080608;color:#f0ebe3;padding:32px;border-radius:12px">
            <h2 style="color:#c9a96e;margin-bottom:8px">Reset your password</h2>
            <p style="color:rgba(240,235,227,0.6);margin-bottom:24px">Click the button below to set a new password. This link expires in 1 hour.</p>
            <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#c9a96e,#a07840);color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:600">Reset Password</a>
            <p style="color:rgba(240,235,227,0.3);font-size:11px;margin-top:24px">If you didn't request this, you can safely ignore this email.</p>
          </div>
        `,
      });
    } else if (FIREBASE_WEB_API_KEY && FIREBASE_WEB_API_KEY !== 'your_firebase_web_api_key_here') {
      // Fall back to Firebase REST API
      const fbRes = await fetch(
        `https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode?key=${FIREBASE_WEB_API_KEY}`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestType: 'PASSWORD_RESET', email }) }
      );
      if (!fbRes.ok) { const err = await fbRes.json(); throw new Error(err?.error?.message || 'Firebase error'); }
    } else {
      throw new Error('Email service not configured');
    }

    res.json({ message: 'Password reset email sent' });
  } catch (error) {
    const msg = error.message || '';
    if (msg.includes('USER_NOT_FOUND') || msg.includes('auth/user-not-found')) {
      return res.status(404).json({ error: 'No account found with this email address.' });
    }
    console.error('forgot-password error:', msg);
    res.status(500).json({ error: 'Failed to send reset email. Please try again.' });
  }
});

// ─── LOGIN ────────────────────────────────────────────────────────────────────
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }
  // Block login entirely if the Web API Key hasn't been configured
  if (!FIREBASE_WEB_API_KEY || FIREBASE_WEB_API_KEY === 'your_firebase_web_api_key_here') {
    return res.status(500).json({
      error: 'Server is not configured for password verification. Add FIREBASE_WEB_API_KEY to backend/.env'
    });
  }
  try {
    // Verify password via Firebase Auth REST API
    const authRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, returnSecureToken: true }),
      }
    );
    if (!authRes.ok) {
      const errData = await authRes.json();
      const msg = errData?.error?.message || 'INVALID_PASSWORD';
      if (msg.includes('INVALID_PASSWORD') || msg.includes('INVALID_LOGIN_CREDENTIALS')) {
        return res.status(401).json({ error: 'Incorrect password. Please try again.' });
      }
      if (msg.includes('EMAIL_NOT_FOUND')) {
        return res.status(401).json({ error: 'No account found with this email.' });
      }
      if (msg.includes('TOO_MANY_ATTEMPTS')) {
        return res.status(429).json({ error: 'Too many failed attempts. Try again later.' });
      }
      return res.status(401).json({ error: 'Login failed. Check your credentials.' });
    }
    const authData = await authRes.json();
    const idToken      = authData.idToken;      // signed Firebase ID token — expires in 1h
    const refreshToken = authData.refreshToken; // used to get new ID tokens silently
    // Fetch full user profile from Firestore
    const userRecord = await admin.auth().getUserByEmail(email);
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    let userData;
    if (userDoc.exists) {
      userData = userDoc.data();
    } else {
      // Firestore doc missing — auto-create so the profile page works
      const fallbackUsername = (userRecord.displayName || email.split('@')[0])
        .toLowerCase().replace(/\s+/g, '');
      userData = {
        email: userRecord.email,
        displayName: userRecord.displayName || email.split('@')[0],
        username: fallbackUsername,
        accountType: 'user',
        bio: '',
        fitnessGoal: '',
        fitnessLevel: 'Intermediate',
        gym: '',
        workouts: 0,
        followers: 0,
        following: 0,
        createdAt: new Date().toISOString(),
      };
      await db.collection('users').doc(userRecord.uid).set(userData);
      console.log(`✅ Auto-created missing Firestore profile for ${userRecord.uid}`);
    }
    res.status(200).json({
      message: 'Login successful',
      idToken,                    // ← returned to frontend for secure session (1h TTL)
      refreshToken,               // ← use to silently refresh idToken after expiry
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName,
      ...userData,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(401).json({ error: 'Login failed. Check your credentials.' });
  }
});

// ─── TOKEN REFRESH ────────────────────────────────────────────────────────────
// Exchange a Firebase refresh token for a fresh ID token.
// Called by the frontend when any protected request returns 401.
app.post('/api/refresh-token', async (req, res) => {
  const { refreshToken } = req.body;
  if (!refreshToken) return res.status(400).json({ error: 'Missing refreshToken' });
  if (!FIREBASE_WEB_API_KEY) return res.status(500).json({ error: 'Server not configured' });
  try {
    const r = await fetch(
      `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_WEB_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ grant_type: 'refresh_token', refresh_token: refreshToken }),
      }
    );
    if (!r.ok) return res.status(401).json({ error: 'Token refresh failed' });
    const data = await r.json();
    res.json({ idToken: data.id_token, refreshToken: data.refresh_token });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── VIDEO UPLOAD ─────────────────────────────────────────────────────────────
// ─── VIDEO UPLOAD (local filesystem) ─────────────────────────────────────────
// POST /api/upload-video
// Accepts multipart/form-data with field "video".
// Streams the file directly to Firebase Storage and returns a public URL.
// Returns: { url: string }

const multer  = require('multer');
const pathMod = require('path');

// Keep video in memory so we can pipe it to Firebase Storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const ok = /^video\//.test(file.mimetype) ||
               /\.(mp4|mov|webm|avi|mkv|m4v)$/i.test(file.originalname);
    if (ok) cb(null, true);
    else    cb(new Error('Only video files are allowed'));
  },
});

app.post('/api/upload-video', verifyToken, upload.single('video'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No video file provided' });

    const ext      = (req.file.originalname.split('.').pop() || 'mp4')
                       .toLowerCase().replace('quicktime', 'mov');
    const filename = `videos/${req.uid}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
    const fileRef  = bucket.file(filename);

    await fileRef.save(req.file.buffer, {
      metadata: { contentType: req.file.mimetype || `video/${ext}` },
    });
    await fileRef.makePublic();

    const url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media`;
    console.log('✅ Video uploaded to Firebase Storage:', filename,
      `(${(req.file.size / 1024 / 1024).toFixed(1)} MB)`);
    res.json({ url });
  } catch (e) {
    console.error('Video upload error:', e);
    res.status(500).json({ error: e.message });
  }
});

// ─── GET POSTS (paginated) ────────────────────────────────────────────────────
// ?cursor=<createdAt ISO string>  — fetch the next page starting after this timestamp
// ?limit=<n>                      — page size (default 20, max 50)
//
// Response: { posts: [...], nextCursor: string|null, hasMore: boolean }
app.get('/api/posts', async (req, res) => {
  const pageSize    = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const cursor      = typeof req.query.cursor === 'string' ? req.query.cursor : null;
  const workoutType = typeof req.query.workoutType === 'string' ? req.query.workoutType : null;
  const sort        = typeof req.query.sort === 'string' ? req.query.sort : 'newest'; // 'newest' | 'trending'
  const followingOf = typeof req.query.followingOf === 'string' ? req.query.followingOf : null;

  try {
    // If "following only" filter: get followee IDs first
    let followingIds = null; // string[] | null
    if (followingOf) {
      const followsSnap = await db.collection('follows')
        .where('followerId', '==', followingOf)
        .limit(200).get();
      followingIds = followsSnap.docs.map(d => d.data().followingId);
      if (followingIds.length === 0) {
        return res.json({ posts: [], nextCursor: null, hasMore: false });
      }
    }

    let query = db.collection('posts').orderBy('createdAt', 'desc').limit(500);
    const snapshot = await query.get();
    let posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Filter by workout type
    if (workoutType) {
      const wt = workoutType.toLowerCase();
      posts = posts.filter(p => (p.workoutType || '').toLowerCase().includes(wt));
    }

    // Filter by following
    if (followingIds) {
      posts = posts.filter(p => followingIds.includes(p.user?.id || p.userId || ''));
    }

    // Sort
    if (sort === 'trending') {
      // Trending = likes + comments in the last 48 hours, weighted
      const cutoff = new Date(Date.now() - 48 * 3600_000).toISOString();
      posts.sort((a, b) => {
        const recencyA = (a.createdAt || '') > cutoff ? 2 : 1;
        const recencyB = (b.createdAt || '') > cutoff ? 2 : 1;
        const scoreA = ((a.likes || 0) + (a.comments?.length || 0) * 2) * recencyA;
        const scoreB = ((b.likes || 0) + (b.comments?.length || 0) * 2) * recencyB;
        return scoreB - scoreA;
      });
    } else {
      posts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    }

    // Paginate in-memory (cursor = index)
    const cursorIdx  = cursor ? parseInt(cursor, 10) : 0;
    const page       = posts.slice(cursorIdx, cursorIdx + pageSize);
    const hasMore    = cursorIdx + pageSize < posts.length;
    const nextCursor = hasMore ? String(cursorIdx + pageSize) : null;

    // Enrich each post with the requesting user's reaction (if auth header present)
    const authHeader = req.headers.authorization;
    let requestingUid = null;
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = await admin.auth().verifyIdToken(authHeader.split(' ')[1]);
        requestingUid = decoded.uid;
      } catch {}
    }
    const enriched = page.map(p => ({
      ...p,
      isLiked: requestingUid ? (p.likedBy || []).includes(requestingUid) : false,
      userReaction: requestingUid ? (p.userReactions?.[requestingUid] || null) : null,
    }));

    res.status(200).json({ posts: enriched, nextCursor, hasMore });
  } catch (error) {
    console.error('Get posts error:', error);
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
});

// ─── CREATE POST ──────────────────────────────────────────────────────────────
app.post('/api/posts', verifyToken, async (req, res) => {
  const {
    user,
    type,                             // 'workout' | 'progress' | 'meal' | 'run' | 'motivation'
    workoutType, duration, calories, exercises,  // workout
    weight, bodyFat,                  // progress
    mealName, protein, carbs, fat,    // meal
    distance, runTime, pace,          // run
    caption, image, videoUrl, mood, location, visibility, music, isPR
  } = req.body;
  if (user?.id && user.id !== req.uid) {
    return res.status(403).json({ error: 'User ID mismatch.' });
  }
  const postType = ['workout','progress','meal','run','motivation'].includes(type) ? type : 'workout';
  try {
    const newPost = {
      user: user || null,
      type: postType,
      // Workout fields
      workoutType: sanitize(workoutType || '', 50),
      duration: Number(duration) || 0,
      calories: Number(calories) || 0,
      exercises: exercises || [],
      // Progress fields
      weight: weight != null ? Number(weight) : null,
      bodyFat: bodyFat != null ? Number(bodyFat) : null,
      // Meal fields
      mealName: mealName ? sanitize(mealName, 80) : null,
      protein: protein != null ? Number(protein) : null,
      carbs: carbs != null ? Number(carbs) : null,
      fat: fat != null ? Number(fat) : null,
      // Run fields
      distance: distance != null ? Number(distance) : null,
      runTime: runTime ? sanitize(runTime, 20) : null,
      pace: pace ? sanitize(pace, 20) : null,
      // Common
      caption: sanitize(caption || '', 500),
      image: image || null,
      videoUrl: videoUrl || null,
      mood: mood || null,
      location: location ? sanitize(location, 100) : null,
      visibility: visibility || 'public',
      music: music ? sanitize(music, 100) : null,
      isPR: isPR === true,
      likes: 0,
      likedBy: [],
      reactions: { heart: 0, fire: 0, strong: 0, clap: 0 },
      userReactions: {},
      comments: [],
      createdAt: new Date().toISOString(),
    };
    const docRef = await db.collection('posts').add(newPost);
    res.status(201).json({ id: docRef.id, ...newPost });
  } catch (error) {
    console.error('Create post error:', error);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

// ─── LIKE / UNLIKE A POST ─────────────────────────────────────────────────────
// ── Reactions (fire / strong / clap / heart) ─────────────────────────────────
app.post('/api/posts/:id/react', verifyToken, async (req, res) => {
  const userId = req.uid;
  const { reactionType } = req.body; // null = remove reaction
  const VALID = ['heart', 'fire', 'strong', 'clap'];
  if (reactionType !== null && !VALID.includes(reactionType)) {
    return res.status(400).json({ error: 'Invalid reaction type' });
  }
  const postRef = db.collection('posts').doc(req.params.id);
  try {
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Post not found' });
    const post = postDoc.data();
    const userReactions = post.userReactions || {}; // { userId: 'fire' }
    const reactions = post.reactions || { heart: 0, fire: 0, strong: 0, clap: 0 };
    const prevReaction = userReactions[userId] || null;
    const update = { reactions: { ...reactions }, userReactions: { ...userReactions } };
    // Remove previous reaction
    if (prevReaction) update.reactions[prevReaction] = Math.max(0, (update.reactions[prevReaction] || 0) - 1);
    // Add new reaction (if not toggling off)
    if (reactionType && reactionType !== prevReaction) {
      update.reactions[reactionType] = (update.reactions[reactionType] || 0) + 1;
      update.userReactions[userId] = reactionType;
    } else {
      delete update.userReactions[userId];
    }
    await postRef.update(update);
    res.json({ success: true, reactions: update.reactions, userReaction: reactionType !== prevReaction ? reactionType : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/posts/:id/like', verifyToken, async (req, res) => {
  const userId = req.uid; // always use the verified token, never trust body
  const postRef = db.collection('posts').doc(req.params.id);
  try {
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Post not found' });

    const post = postDoc.data();
    const likedBy = post.likedBy || [];
    const isLiked = likedBy.includes(userId);
    const newLikes = isLiked ? Math.max(0, (post.likes || 0) - 1) : (post.likes || 0) + 1;

    await postRef.update({
      likes: newLikes,
      likedBy: isLiked
        ? likedBy.filter(id => id !== userId)
        : [...likedBy, userId],
    });

    // ── Hype alert: when a post first hits 5 likes, notify the author ──
    if (!isLiked && newLikes === 5) {
      const authorId = post.user?.id;
      if (authorId && authorId !== userId) {
        await createNotification(
          authorId,
          'like_hype',
          'Your post is on fire! 🔥',
          '5 people liked your post — you\'re crushing it!',
          { postId: req.params.id }
        );
      }
    }

    res.status(200).json({ success: true, isLiked: !isLiked });
  } catch (error) {
    console.error('Like error:', error);
    res.status(500).json({ error: 'Failed to update like' });
  }
});

// ─── ADD COMMENT ──────────────────────────────────────────────────────────────
app.post('/api/posts/:id/comment', verifyToken, async (req, res) => {
  const { text, user, image } = req.body;
  // Verify the comment is attributed to the actual logged-in user
  if (user?.id && user.id !== req.uid) {
    return res.status(403).json({ error: 'User ID mismatch.' });
  }
  const postRef = db.collection('posts').doc(req.params.id);
  try {
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Post not found' });

    const newComment = {
      id: `c_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      text: sanitize(text || '', 500),
      image: image || null,
      user: user || null,
      timestamp: new Date().toISOString(),
    };
    await postRef.update({
      comments: admin.firestore.FieldValue.arrayUnion(newComment),
    });

    // ── Trainer shoutout: notify post author if a trainer commented ──
    const post = postDoc.data();
    const authorId = post?.user?.id;
    if (user?.accountType === 'trainer' && authorId && authorId !== user.id) {
      const trainerName = user.name || user.displayName || 'A trainer';
      await createNotification(
        authorId,
        'trainer_shoutout',
        `${trainerName} commented on your post! ⭐`,
        `"${text.slice(0, 80)}${text.length > 80 ? '…' : ''}"`,
        { postId: req.params.id, trainerId: user.id, trainerName }
      );
    }

    res.status(201).json(newComment);
  } catch (error) {
    console.error('Comment error:', error);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// ─── TIMESTAMPED COMMENT (Form Check clips) ───────────────────────────────────
app.post('/api/posts/:id/timestamp-comment', verifyToken, async (req, res) => {
  const uid = req.uid;
  const { text, timestamp } = req.body;
  if (!text || typeof timestamp !== 'number') return res.status(400).json({ error: 'text and timestamp required' });
  try {
    const postRef = db.collection('posts').doc(req.params.id);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Post not found' });
    const userSnap = await db.collection('users').doc(uid).get();
    const u = userSnap.exists ? userSnap.data() : {};
    const comment = {
      uid,
      name:      u.displayName || u.name || 'User',
      avatar:    u.avatar || '',
      text:      sanitize(String(text), 300),
      timestamp: Math.max(0, Math.round(Number(timestamp))),
      createdAt: new Date().toISOString(),
    };
    await postRef.update({ timestampComments: admin.firestore.FieldValue.arrayUnion(comment) });
    res.status(201).json(comment);
  } catch (err) {
    console.error('Timestamp comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

// ─── JOIN CHALLENGE (Challenge clips) ─────────────────────────────────────────
app.post('/api/posts/:id/join-challenge', verifyToken, async (req, res) => {
  const uid = req.uid;
  try {
    const postRef = db.collection('posts').doc(req.params.id);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Post not found' });
    const data = postDoc.data();
    const joined = data.challengeJoined || [];
    if (joined.includes(uid)) return res.status(409).json({ error: 'Already joined' });
    await postRef.update({
      challengeJoined:       admin.firestore.FieldValue.arrayUnion(uid),
      challengeParticipants: (data.challengeParticipants || 0) + 1,
    });
    // Notify the original poster
    const authorId = data.user?.id;
    if (authorId && authorId !== uid) {
      const userSnap = await db.collection('users').doc(uid).get();
      const u = userSnap.exists ? userSnap.data() : {};
      const joinerName = u.displayName || u.name || 'Someone';
      await createNotification(
        authorId, 'challenge_join',
        `${joinerName} joined your challenge! ⚔️`,
        `"${data.challengeName || 'Your challenge'}" now has ${(data.challengeParticipants || 0) + 1} participants`,
        { postId: req.params.id }
      );
    }
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Join challenge error:', err);
    res.status(500).json({ error: 'Failed to join challenge' });
  }
});

// ─── REPOST ───────────────────────────────────────────────────────────────────
app.post('/api/posts/:id/repost', verifyToken, async (req, res) => {
  const origId = req.params.id;
  const reposterUid = req.uid;
  try {
    const origDoc = await db.collection('posts').doc(origId).get();
    if (!origDoc.exists) return res.status(404).json({ error: 'Post not found' });
    const orig = origDoc.data();

    // Prevent double-repost
    const existing = await db.collection('posts')
      .where('repostOf', '==', origId)
      .where('userId', '==', reposterUid)
      .limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'Already reposted' });

    const userSnap = await db.collection('users').doc(reposterUid).get();
    const u = userSnap.exists ? userSnap.data() : {};

    const repost = {
      userId:      reposterUid,
      repostOf:    origId,
      repostUser:  { id: reposterUid, name: u.displayName || 'User', avatar: u.avatar || '', username: u.username || '' },
      // Copy original content
      workoutType: orig.workoutType,
      duration:    orig.duration,
      calories:    orig.calories,
      caption:     orig.caption || '',
      image:       orig.image   || null,
      imageUrl:    orig.imageUrl || null,
      user:        orig.user,
      likes:       0,
      likedBy:     [],
      comments:    [],
      createdAt:   new Date().toISOString(),
    };
    const docRef = await db.collection('posts').add(repost);
    res.status(201).json({ id: docRef.id, ...repost });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── LIKE A COMMENT ───────────────────────────────────────────────────────────
app.post('/api/posts/:id/comments/:commentId/like', verifyToken, async (req, res) => {
  const { id: postId, commentId } = req.params;
  const userId = req.uid;
  try {
    const postRef = db.collection('posts').doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Post not found' });
    const comments = postDoc.data().comments || [];
    const idx = comments.findIndex(c => c.id === commentId);
    if (idx === -1) return res.status(404).json({ error: 'Comment not found' });
    const likedBy = comments[idx].likedBy || [];
    const isLiked = likedBy.includes(userId);
    comments[idx] = {
      ...comments[idx],
      likedBy: isLiked ? likedBy.filter(id => id !== userId) : [...likedBy, userId],
      likes:   isLiked ? Math.max(0, (comments[idx].likes || 0) - 1) : (comments[idx].likes || 0) + 1,
    };
    await postRef.update({ comments });
    res.json({ liked: !isLiked, likes: comments[idx].likes });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── REPLY TO A COMMENT ───────────────────────────────────────────────────────
app.post('/api/posts/:id/comments/:commentId/reply', verifyToken, async (req, res) => {
  const { id: postId, commentId } = req.params;
  const { text, user } = req.body;
  if (!text?.trim()) return res.status(400).json({ error: 'text required' });
  try {
    const postRef = db.collection('posts').doc(postId);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Post not found' });
    const comments = postDoc.data().comments || [];
    const idx = comments.findIndex(c => c.id === commentId);
    if (idx === -1) return res.status(404).json({ error: 'Comment not found' });
    const reply = {
      id: `r_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      text: sanitize(text, 300),
      user: user || null,
      timestamp: new Date().toISOString(),
      likes: 0, likedBy: [],
    };
    if (!comments[idx].replies) comments[idx].replies = [];
    comments[idx].replies.push(reply);
    await postRef.update({ comments });
    res.status(201).json(reply);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED HELPERS  (used by multiple route sections below)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── createNotification ───────────────────────────────────────────────────────
// Writes a notification document for a user.
// Called automatically by like, comment, duel, and badge logic.
const createNotification = async (userId, type, title, message, data = {}) => {
  try {
    await db.collection('notifications').add({
      userId, type, title, message,
      data, isRead: false,
      createdAt: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Failed to create notification:', e.message);
  }
};

// ─── awardBadge ───────────────────────────────────────────────────────────────
// Awards a badge to a user if they don't already have it.
// Automatically creates a badge_earned notification.
const awardBadge = async (userId, type, title, description, icon) => {
  try {
    const existing = await db.collection('badges')
      .where('userId', '==', userId)
      .where('type',   '==', type)
      .get();
    if (!existing.empty) return null; // already earned

    const badge = { userId, type, title, description, icon, earnedAt: new Date().toISOString() };
    const docRef = await db.collection('badges').add(badge);

    await createNotification(
      userId, 'badge_earned',
      `Badge unlocked: ${title}! ${icon}`,
      description,
      { badgeType: type, icon }
    );
    return { id: docRef.id, ...badge };
  } catch (e) {
    console.error('Failed to award badge:', e.message);
    return null;
  }
};

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN ROUTES
// All routes below are admin-only operations.
// They interact directly with Firebase Auth + Firestore.
// ═══════════════════════════════════════════════════════════════════════════════

// Helper: write an entry to the admin_logs collection every time an admin
// performs a destructive or sensitive action. This creates an audit trail.
const logAdminAction = async (adminId, action, targetId = '', details = '') => {
  try {
    await db.collection('admin_logs').add({
      adminId,
      action,
      targetId,
      details,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error('Failed to write admin log:', e.message);
  }
};

// ─── GET ALL USERS ────────────────────────────────────────────────────────────
// Reads every document in the Firestore "users" collection.
// Returns profile data including role, ban status, and creation date.
app.get('/api/admin/users', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('users').get();
    const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    res.status(200).json(users);
  } catch (error) {
    console.error('Admin get users error:', error);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

// ─── BAN / UNBAN USER ────────────────────────────────────────────────────────
// Sets banned:true on the Firestore profile AND disables the account in
// Firebase Auth so they cannot log in. Toggling calls the same route.
app.patch('/api/admin/users/:uid/ban', verifyToken, verifyAdmin, async (req, res) => {
  const { uid } = req.params;
  const { banned, reason = '', adminId = '' } = req.body;
  try {
    // Disable or re-enable in Firebase Authentication
    await admin.auth().updateUser(uid, { disabled: banned });
    // Record the ban status in Firestore
    await db.collection('users').doc(uid).update({
      banned,
      bannedAt:     banned ? new Date().toISOString() : null,
      bannedReason: banned ? reason : '',
    });
    await logAdminAction(adminId, banned ? 'BAN_USER' : 'UNBAN_USER', uid, reason);
    res.status(200).json({ success: true, banned });
  } catch (error) {
    console.error('Ban user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── CHANGE USER ROLE ─────────────────────────────────────────────────────────
// Updates the accountType field in Firestore.
// Valid roles: 'user', 'trainer', 'admin'
app.patch('/api/admin/users/:uid/role', verifyToken, verifyAdmin, async (req, res) => {
  const { uid } = req.params;
  const { role, adminId = '' } = req.body;
  const validRoles = ['user', 'trainer', 'admin'];
  if (!validRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role. Must be user, trainer, or admin.' });
  }
  try {
    await db.collection('users').doc(uid).update({ accountType: role });
    await logAdminAction(adminId, 'CHANGE_ROLE', uid, `Changed to ${role}`);
    res.status(200).json({ success: true, role });
  } catch (error) {
    console.error('Change role error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── DELETE USER ACCOUNT ──────────────────────────────────────────────────────
// Permanently removes the user from Firebase Authentication AND Firestore.
// This is irreversible.
app.delete('/api/admin/users/:uid', verifyToken, verifyAdmin, async (req, res) => {
  const { uid } = req.params;
  const { adminId = '' } = req.body;
  try {
    await admin.auth().deleteUser(uid);                     // Remove from Firebase Auth
    await db.collection('users').doc(uid).delete();        // Remove Firestore profile
    await logAdminAction(adminId, 'DELETE_USER', uid, 'Account permanently deleted');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── SEND PASSWORD RESET EMAIL ────────────────────────────────────────────────
// Firebase Admin generates a password reset link and sends it to the user's
// email. Uses Firebase's built-in email system — no extra config needed.
// Set a user's password directly (admin only — useful for testing)
app.post('/api/admin/users/:uid/set-password', verifyToken, verifyAdmin, async (req, res) => {
  const { password } = req.body;
  if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    // Update Firebase Auth
    await admin.auth().updateUser(req.params.uid, { password });
    // Also store bcrypt hash in Firestore so admin can view it
    const passwordHash = await bcrypt.hash(password, 10);
    await db.collection('users').doc(req.params.uid).update({ passwordHash });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set password: ' + err.message });
  }
});

app.post('/api/admin/users/:uid/reset', verifyToken, verifyAdmin, async (req, res) => {
  const { uid } = req.params;
  const { adminId = '' } = req.body;
  try {
    const userRecord = await admin.auth().getUser(uid);
    const link = await admin.auth().generatePasswordResetLink(userRecord.email);
    await logAdminAction(adminId, 'RESET_PASSWORD', uid, `Reset link sent to ${userRecord.email}`);
    res.status(200).json({ success: true, email: userRecord.email, link });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── DELETE A POST ────────────────────────────────────────────────────────────
// Removes a post document from Firestore permanently.
app.delete('/api/admin/posts/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { adminId = '' } = req.body;
  try {
    await db.collection('posts').doc(id).delete();
    await logAdminAction(adminId, 'DELETE_POST', id, 'Post removed by admin');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── PIN / UNPIN A POST ───────────────────────────────────────────────────────
// Sets pinned:true so the Feed can show pinned posts at the top.
app.patch('/api/admin/posts/:id/pin', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { pinned, adminId = '' } = req.body;
  try {
    await db.collection('posts').doc(id).update({ pinned });
    await logAdminAction(adminId, pinned ? 'PIN_POST' : 'UNPIN_POST', id);
    res.status(200).json({ success: true, pinned });
  } catch (error) {
    console.error('Pin post error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── DELETE A COMMENT ────────────────────────────────────────────────────────
// Uses Firestore arrayRemove to remove a specific comment object from the
// post's comments array, matched by comment ID.
app.delete('/api/admin/posts/:id/comment', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { comment, adminId = '' } = req.body;   // full comment object
  try {
    await db.collection('posts').doc(id).update({
      comments: admin.firestore.FieldValue.arrayRemove(comment),
    });
    await logAdminAction(adminId, 'DELETE_COMMENT', id, `Comment ${comment?.id} removed`);
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── GET CHALLENGES ───────────────────────────────────────────────────────────

// ─── Admin: view stored password hash for a user ──────────────────────────────
app.get('/api/admin/users/:uid/password-hash', verifyToken, verifyAdmin, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.uid).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    const { passwordHash } = doc.data();
    if (!passwordHash) return res.json({ hash: null, message: 'No password hash stored (user signed up before hashing was added)' });
    res.json({ hash: passwordHash });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/challenges', async (req, res) => {
  try {
    const snapshot = await db.collection('challenges').orderBy('createdAt', 'desc').get();
    const challenges = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.status(200).json(challenges);
  } catch (error) {
    // fallback if no index yet
    try {
      const snapshot = await db.collection('challenges').get();
      const challenges = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.status(200).json(challenges);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch challenges' });
    }
  }
});

// ─── CREATE A CHALLENGE ───────────────────────────────────────────────────────
// Saves a new challenge to Firestore. The Feed and user pages can then read
// these challenges to show to all users.
app.post('/api/admin/challenges', verifyToken, verifyAdmin, async (req, res) => {
  const { title, description, type, targetValue, durationDays, adminId = '' } = req.body;
  try {
    const challenge = {
      title, description,
      type: type || 'posts',       // 'posts' | 'streak' | 'calories'
      targetValue: targetValue || 10,
      durationDays: durationDays || 30,
      participants: 0,
      isActive: true,
      createdBy: adminId,
      createdAt: new Date().toISOString(),
    };
    const docRef = await db.collection('challenges').add(challenge);
    await logAdminAction(adminId, 'CREATE_CHALLENGE', docRef.id, title);
    res.status(201).json({ id: docRef.id, ...challenge });
  } catch (error) {
    console.error('Create challenge error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── DELETE A CHALLENGE ───────────────────────────────────────────────────────
app.delete('/api/admin/challenges/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  const { adminId = '' } = req.body;
  try {
    await db.collection('challenges').doc(id).delete();
    await logAdminAction(adminId, 'DELETE_CHALLENGE', id);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── USER-INITIATED CHALLENGES ───────────────────────────────────────────────
// POST /api/challenges — send a challenge from the challenger to a target user
app.post('/api/challenges', verifyToken, async (req, res) => {
  const { challengerId, challengerName, targetId, targetName, type, durationDays } = req.body;
  if (!challengerId || !targetId || challengerId === targetId) {
    return res.status(400).json({ error: 'Invalid challenge request' });
  }
  try {
    const now   = new Date();
    const start = now.toISOString().split('T')[0];
    const end   = new Date(now.getTime() + (parseInt(durationDays) || 7) * 86400000).toISOString().split('T')[0];
    const challenge = {
      title:          `${challengerName} challenged ${targetName}`,
      description:    `A personal challenge between two users`,
      type:           type || 'workouts',
      participants:   [challengerId, targetId],
      participantNames: { [challengerId]: challengerName, [targetId]: targetName },
      scores:         { [challengerId]: 0, [targetId]: 0 },
      status:         'pending',   // pending → active (when accepted) → completed
      startDate:      start,
      endDate:        end,
      durationDays:   parseInt(durationDays) || 7,
      createdBy:      challengerId,
      createdAt:      now.toISOString(),
    };
    const ref = await db.collection('challenges').add(challenge);
    // Drop a notification for the target user
    await db.collection('notifications').add({
      userId:    targetId,
      type:      'challenge',
      message:   `${challengerName} challenged you! ⚔️`,
      challengeId: ref.id,
      fromUserId:  challengerId,
      fromName:    challengerName,
      read:      false,
      createdAt: now.toISOString(),
    });
    res.status(201).json({ id: ref.id, ...challenge });
  } catch (err) {
    console.error('Create challenge error:', err);
    res.status(500).json({ error: 'Failed to create challenge' });
  }
});

// GET /api/challenges/mine — list challenges involving the current user
app.get('/api/challenges/mine', verifyToken, async (req, res) => {
  const uid = req.uid;
  try {
    const snap = await db.collection('challenges')
      .where('participants', 'array-contains', uid)
      .orderBy('createdAt', 'desc')
      .limit(20)
      .get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.status(200).json(items);
  } catch (err) {
    console.error('Get challenges error:', err);
    res.status(500).json({ error: 'Failed to fetch challenges' });
  }
});

// PATCH /api/challenges/:id/accept — target user accepts the challenge
app.patch('/api/challenges/:id/accept', verifyToken, async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection('challenges').doc(id).update({ status: 'active' });
    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to accept challenge' });
  }
});

// ─── GET ANNOUNCEMENTS ────────────────────────────────────────────────────────
app.get('/api/admin/announcements', async (req, res) => {
  try {
    const snapshot = await db.collection('announcements').get();
    const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.status(200).json(items);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// ─── SEND AN ANNOUNCEMENT ─────────────────────────────────────────────────────
// Saves a message to the announcements collection.
// Users see the latest active announcement at the top of the feed.
app.post('/api/admin/announcements', verifyToken, verifyAdmin, async (req, res) => {
  const { title, message, type = 'info', adminId = '' } = req.body;
  try {
    const announcement = {
      title, message,
      type,            // 'info' | 'warning' | 'success'
      isActive: true,
      createdBy: adminId,
      createdAt: new Date().toISOString(),
    };
    const docRef = await db.collection('announcements').add(announcement);
    await logAdminAction(adminId, 'SEND_ANNOUNCEMENT', docRef.id, title);
    res.status(201).json({ id: docRef.id, ...announcement });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── DELETE ANNOUNCEMENT ──────────────────────────────────────────────────────
app.delete('/api/admin/announcements/:id', verifyToken, verifyAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await db.collection('announcements').doc(id).delete();
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── ACTIVITY LOG ─────────────────────────────────────────────────────────────
// Returns the most recent 50 admin actions from the admin_logs collection.
app.get('/api/admin/logs', async (req, res) => {
  try {
    const snapshot = await db.collection('admin_logs').get();
    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    logs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
    res.status(200).json(logs.slice(0, 50));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch logs' });
  }
});

// ─── ADMIN: RESET ALL FOLLOWS ─────────────────────────────────────────────────
// Clears the entire `follows` collection and sets followers/following to 0 on
// every user document. Admin-only, one-shot utility.
app.post('/api/admin/reset-follows', verifyToken, verifyAdmin, async (req, res) => {
  try {
    // 1. Delete all docs in `follows` collection (batch of 500)
    const followsSnap = await db.collection('follows').get();
    const batches = [];
    let batch = db.batch();
    let opCount = 0;
    followsSnap.docs.forEach(doc => {
      batch.delete(doc.ref);
      opCount++;
      if (opCount === 500) {
        batches.push(batch.commit());
        batch = db.batch();
        opCount = 0;
      }
    });
    if (opCount > 0) batches.push(batch.commit());
    await Promise.all(batches);

    // 2. Reset followers/following counters on all user docs
    const usersSnap = await db.collection('users').get();
    const userBatches = [];
    let uBatch = db.batch();
    let uCount = 0;
    usersSnap.docs.forEach(doc => {
      uBatch.update(doc.ref, { followers: 0, following: 0 });
      uCount++;
      if (uCount === 500) {
        userBatches.push(uBatch.commit());
        uBatch = db.batch();
        uCount = 0;
      }
    });
    if (uCount > 0) userBatches.push(uBatch.commit());
    await Promise.all(userBatches);

    res.json({
      success: true,
      followDocsDeleted: followsSnap.size,
      usersReset: usersSnap.size,
    });
  } catch (err) {
    console.error('reset-follows error:', err);
    res.status(500).json({ error: 'Failed to reset follows: ' + err.message });
  }
});

// ─── DEMO LOGIN ───────────────────────────────────────────────────────────────
// Creates real Firebase accounts for demo users on first use.
// Subsequent calls just return the existing account.
const DEMO_ACCOUNTS = {
  user: {
    email: 'demo.user@fitconnect.com',
    password: 'DemoUser@123',
    displayName: 'Demo User',
    accountType: 'user',
    username: 'demouser',
    bio: 'Fitness enthusiast 💪 — demo account',
    fitnessGoal: 'Build Muscle',
    fitnessLevel: 'Intermediate',
    avatar: 'https://ui-avatars.com/api/?name=Demo+User&background=0ea5e9&color=fff',
  },
  trainer: {
    email: 'demo.trainer@fitconnect.com',
    password: 'DemoTrainer@123',
    displayName: 'Demo Trainer',
    accountType: 'trainer',
    username: 'demotrainer',
    bio: 'Professional fitness trainer 💪 — demo account',
    fitnessGoal: 'Help Others',
    fitnessLevel: 'Expert',
    avatar: 'https://ui-avatars.com/api/?name=Demo+Trainer&background=f97316&color=fff',
  },
  admin: {
    email: 'demo.admin@fitconnect.com',
    password: 'DemoAdmin@123',
    displayName: 'Demo Admin',
    accountType: 'admin',
    username: 'demoadmin',
    bio: 'Platform administrator 🔧 — demo account',
    fitnessGoal: 'Manage Platform',
    fitnessLevel: 'Expert',
    avatar: 'https://ui-avatars.com/api/?name=Demo+Admin&background=a855f7&color=fff',
  },
};

app.post('/api/demo-login', async (req, res) => {
  const { accountType } = req.body;
  const demo = DEMO_ACCOUNTS[accountType];
  if (!demo) return res.status(400).json({ error: 'Invalid account type' });

  try {
    let userRecord;
    try {
      // Try to fetch the existing demo account from Firebase
      userRecord = await admin.auth().getUserByEmail(demo.email);
    } catch {
      // First time: create the demo account in Firebase Auth
      userRecord = await admin.auth().createUser({
        email: demo.email,
        password: demo.password,
        displayName: demo.displayName,
      });
      // Also save its profile in Firestore
      await db.collection('users').doc(userRecord.uid).set({
        email: demo.email,
        displayName: demo.displayName,
        username: demo.username,
        accountType: demo.accountType,
        bio: demo.bio,
        fitnessGoal: demo.fitnessGoal,
        fitnessLevel: demo.fitnessLevel,
        avatar: demo.avatar,
        workouts: 0,
        followers: 0,
        following: 0,
        createdAt: new Date().toISOString(),
      });
      console.log(`✅ Created demo ${accountType} account in Firebase`);
    }

    // Fetch the Firestore profile
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    // Get a signed ID token for this demo user via Firebase REST API
    let idToken = null, refreshToken = null;
    if (FIREBASE_WEB_API_KEY) {
      try {
        const tokenRes = await fetch(
          `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${FIREBASE_WEB_API_KEY}`,
          { method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: demo.email, password: demo.password, returnSecureToken: true }) }
        );
        if (tokenRes.ok) {
          const td = await tokenRes.json();
          idToken      = td.idToken;
          refreshToken = td.refreshToken;
        }
      } catch { /* token optional for demo */ }
    }

    res.status(200).json({
      idToken,
      refreshToken,
      uid: userRecord.uid,
      email: userRecord.email,
      displayName: userRecord.displayName || demo.displayName,
      ...userData,
    });
  } catch (error) {
    console.error('Demo login error:', error);
    res.status(500).json({ error: 'Failed to start demo session' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PERSONAL RECORDS (PR) ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── LOG A PR ─────────────────────────────────────────────────────────────────
app.post('/api/prs', verifyToken, async (req, res) => {
  const { userId, exercise, weight, reps, notes } = req.body;
  // Always attribute the PR to the token owner, not the client-supplied userId
  if (userId && userId !== req.uid) {
    return res.status(403).json({ error: 'User ID mismatch.' });
  }
  const safeUserId = req.uid;
  try {
    const pr = {
      userId: safeUserId, exercise: sanitize(exercise || '', 100),
      weight: weight || 0,
      reps:   reps   || 0,
      notes:  notes  || '',
      date:   new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    };
    const docRef = await db.collection('personal_records').add(pr);

    // Auto-badge: 10 PRs logged
    const snap = await db.collection('personal_records').where('userId', '==', safeUserId).get();
    if (snap.size >= 10) {
      await awardBadge(userId, 'pr_10', 'PR Machine', 'Logged 10 personal records', '💪');
    }

    res.status(201).json({ id: docRef.id, ...pr });
  } catch (error) {
    console.error('Create PR error:', error);
    res.status(500).json({ error: 'Failed to create PR' });
  }
});

// ─── GET ALL PRs FOR A USER ───────────────────────────────────────────────────
app.get('/api/users/:uid/prs', async (req, res) => {
  const { uid } = req.params;
  try {
    const snap = await db.collection('personal_records').where('userId', '==', uid).get();
    const prs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    prs.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    res.status(200).json(prs);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch PRs' });
  }
});

// ─── DELETE A PR ──────────────────────────────────────────────────────────────
app.delete('/api/prs/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('personal_records').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'PR not found' });
    if (doc.data().userId !== req.uid) return res.status(403).json({ error: 'Not your PR.' });
    await db.collection('personal_records').doc(req.params.id).delete();
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete PR' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BADGE ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET ALL BADGES FOR A USER ────────────────────────────────────────────────
app.get('/api/users/:uid/badges', async (req, res) => {
  const { uid } = req.params;
  try {
    const snap = await db.collection('badges').where('userId', '==', uid).get();
    const badges = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    badges.sort((a, b) => (b.earnedAt || '').localeCompare(a.earnedAt || ''));
    res.status(200).json(badges);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch badges' });
  }
});

// ─── CHECK POST COUNT BADGES ──────────────────────────────────────────────────
// Called after each new post to auto-award milestone badges.
app.post('/api/users/:uid/check-badges', async (req, res) => {
  const { uid } = req.params;
  try {
    const postSnap = await db.collection('posts').where('user.id', '==', uid).get();
    const count = postSnap.size;

    if (count >= 1)   await awardBadge(uid, 'first_post',  'First Step',     'Posted your first workout', '⭐');
    if (count >= 10)  await awardBadge(uid, 'posts_10',   'Getting Started', '10 workouts logged',        '🏅');
    if (count >= 50)  await awardBadge(uid, 'posts_50',   'Dedicated',       '50 workouts posted',        '🔥');
    if (count >= 100) await awardBadge(uid, 'posts_100',  'Century Club',    '100 workouts posted',       '💯');

    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check badges' });
  }
});

// ─── CHECK STREAK BADGE ───────────────────────────────────────────────────────
// Called from the frontend when the user logs in.
app.post('/api/users/:uid/check-streak', async (req, res) => {
  const { uid, streakDays } = req.body;
  try {
    if (streakDays >= 7)  await awardBadge(uid, 'streak_7',  'Week Warrior',  '7-day workout streak',   '🏆');
    if (streakDays >= 30) await awardBadge(uid, 'streak_30', '30-Day Legend', '30-day workout streak',  '🌟');

    // Streak protection notification (if after 8pm local, no post today)
    const { hasPostedToday, localHour } = req.body;
    if (!hasPostedToday && localHour >= 20 && streakDays > 0) {
      // Check if we already sent one today to avoid spam
      const todayStr = new Date().toISOString().split('T')[0];
      const existing = await db.collection('notifications')
        .where('userId', '==', uid)
        .where('type',   '==', 'streak_warning')
        .get();
      const sentToday = existing.docs.some(d =>
        (d.data().createdAt || '').startsWith(todayStr)
      );
      if (!sentToday) {
        const hoursLeft = 24 - localHour;
        await createNotification(
          uid,
          'streak_warning',
          `Your ${streakDays}-day streak ends in ${hoursLeft}h! ⚡`,
          "Post a workout before midnight to keep your streak alive.",
          { streakDays }
        );
      }
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check streak' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// NOTIFICATION ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET NOTIFICATIONS ────────────────────────────────────────────────────────
app.get('/api/users/:uid/notifications', async (req, res) => {
  const { uid } = req.params;
  try {
    const snap = await db.collection('notifications').where('userId', '==', uid).get();
    const notifs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    notifs.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.status(200).json(notifs.slice(0, 50));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ─── MARK ONE NOTIFICATION AS READ ───────────────────────────────────────────
app.patch('/api/notifications/:id/read', async (req, res) => {
  try {
    await db.collection('notifications').doc(req.params.id).update({ isRead: true });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark as read' });
  }
});

// ─── MARK ALL NOTIFICATIONS AS READ ──────────────────────────────────────────
app.patch('/api/users/:uid/notifications/read-all', async (req, res) => {
  const { uid } = req.params;
  try {
    const snap = await db.collection('notifications')
      .where('userId', '==', uid)
      .where('isRead', '==', false)
      .get();
    const batch = db.batch();
    snap.docs.forEach(doc => batch.update(doc.ref, { isRead: true }));
    await batch.commit();
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to mark all as read' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DUEL ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── CREATE A DUEL CHALLENGE ──────────────────────────────────────────────────
app.post('/api/duels', async (req, res) => {
  const { challengerId, challengerName, challengedId, challengedName,
          exercise, goalType, goalTarget, durationDays } = req.body;
  try {
    const duel = {
      challengerId, challengerName, challengerScore: 0,
      challengedId, challengedName, challengedScore: 0,
      exercise,
      goalType:    goalType    || 'reps',
      goalTarget:  goalTarget  || 100,
      durationDays: durationDays || 7,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    const docRef = await db.collection('duels').add(duel);

    await createNotification(
      challengedId, 'duel_request',
      `${challengerName} challenged you! ⚔️`,
      `${exercise} — reach ${goalTarget} ${goalType} in ${durationDays} days`,
      { duelId: docRef.id }
    );

    res.status(201).json({ id: docRef.id, ...duel });
  } catch (error) {
    console.error('Create duel error:', error);
    res.status(500).json({ error: 'Failed to create duel' });
  }
});

// ─── GET ALL DUELS FOR A USER ─────────────────────────────────────────────────
app.get('/api/users/:uid/duels', async (req, res) => {
  const { uid } = req.params;
  try {
    const [asChallenger, asChallenged] = await Promise.all([
      db.collection('duels').where('challengerId', '==', uid).get(),
      db.collection('duels').where('challengedId', '==', uid).get(),
    ]);
    const seen = new Set();
    const duels = [
      ...asChallenger.docs.map(d => ({ id: d.id, ...d.data() })),
      ...asChallenged.docs.map(d => ({ id: d.id, ...d.data() })),
    ].filter(d => { if (seen.has(d.id)) return false; seen.add(d.id); return true; });
    duels.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.status(200).json(duels);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch duels' });
  }
});

// ─── ACCEPT A DUEL ────────────────────────────────────────────────────────────
app.patch('/api/duels/:id/accept', async (req, res) => {
  const { id } = req.params;
  try {
    const duelDoc = await db.collection('duels').doc(id).get();
    if (!duelDoc.exists) return res.status(404).json({ error: 'Duel not found' });
    const duel = duelDoc.data();
    const startDate = new Date().toISOString().split('T')[0];
    const endDate   = new Date(Date.now() + duel.durationDays * 86400000).toISOString().split('T')[0];
    await db.collection('duels').doc(id).update({ status: 'active', startDate, endDate });
    await createNotification(
      duel.challengerId, 'duel_update',
      `${duel.challengedName} accepted your duel! 🔥`,
      `${duel.exercise} is now live. Good luck!`,
      { duelId: id }
    );
    res.status(200).json({ success: true, startDate, endDate });
  } catch (error) {
    res.status(500).json({ error: 'Failed to accept duel' });
  }
});

// ─── DECLINE A DUEL ───────────────────────────────────────────────────────────
app.patch('/api/duels/:id/decline', async (req, res) => {
  try {
    await db.collection('duels').doc(req.params.id).update({ status: 'declined' });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to decline duel' });
  }
});

// ─── UPDATE DUEL SCORE ────────────────────────────────────────────────────────
// Called when a user increments their score (+1 rep, +weight, etc.)
app.patch('/api/duels/:id/score', async (req, res) => {
  const { id } = req.params;
  const { userId, score } = req.body;
  try {
    const duelDoc = await db.collection('duels').doc(id).get();
    if (!duelDoc.exists) return res.status(404).json({ error: 'Duel not found' });
    const duel = duelDoc.data();
    const isChallenger = duel.challengerId === userId;
    const field        = isChallenger ? 'challengerScore' : 'challengedScore';
    await db.collection('duels').doc(id).update({ [field]: score });

    // If winner reached goal target
    if (score >= duel.goalTarget && duel.status === 'active') {
      await db.collection('duels').doc(id).update({ status: 'completed', winnerId: userId });
      await awardBadge(userId, 'duel_winner', 'Duel Champion', 'Won a head-to-head duel', '⚔️');
      const opponentId = isChallenger ? duel.challengedId : duel.challengerId;
      const winnerName = isChallenger ? duel.challengerName : duel.challengedName;
      await createNotification(
        opponentId, 'duel_update',
        `${winnerName} won the duel!`,
        `${duel.exercise} challenge complete. Better luck next time!`,
        { duelId: id }
      );
    }

    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Failed to update score' });
  }
});

// ─── LOOK UP USER BY USERNAME (for duel invite) ───────────────────────────────
// ─── FOLLOW (request-based) ───────────────────────────────────────────────────
// Doc ID pattern: "{fromUid}_{toUid}" — avoids compound Firestore indexes.
app.post('/api/users/:uid/follow', verifyToken, async (req, res) => {
  const targetId = req.params.uid;
  const fromUid  = req.uid;
  if (fromUid === targetId) return res.status(400).json({ error: 'Cannot follow yourself' });
  try {
    // Already following?
    const followDoc = await db.collection('follows').doc(`${fromUid}_${targetId}`).get();
    if (followDoc.exists) return res.status(200).json({ alreadyFollowing: true });

    const [fromSnap, targetSnap] = await Promise.all([
      db.collection('users').doc(fromUid).get(),
      db.collection('users').doc(targetId).get(),
    ]);
    const fromData   = fromSnap.data()   || {};
    const targetData = targetSnap.data() || {};
    const isPrivate  = !!targetData.isPrivate;

    // PUBLIC account → instant follow (no approval needed)
    if (!isPrivate) {
      const batch = db.batch();
      batch.set(db.collection('follows').doc(`${fromUid}_${targetId}`), {
        followerId: fromUid, targetId, createdAt: new Date().toISOString(),
      });
      batch.update(db.collection('users').doc(targetId), { followers: admin.firestore.FieldValue.increment(1) });
      batch.update(db.collection('users').doc(fromUid),  { following: admin.firestore.FieldValue.increment(1) });
      await batch.commit();

      // Open / create a 1-on-1 conversation
      const convId  = [fromUid, targetId].sort().join('_');
      const convRef = db.collection('conversations').doc(convId);
      if (!(await convRef.get()).exists) {
        await convRef.set({
          participants:  [fromUid, targetId],
          type: 'direct',
          createdAt:     new Date().toISOString(),
          lastMessage:   '',
          lastMessageAt: new Date().toISOString(),
          unreadCounts:  { [fromUid]: 0, [targetId]: 0 },
        });
      }
      await Promise.all([fromUid, targetId].map(u =>
        db.collection('users').doc(u).update({
          conversationIds: admin.firestore.FieldValue.arrayUnion(convId),
        }).catch(() => {})
      ));

      await createNotification(targetId, 'follow', 'New follower',
        `${fromData.displayName || 'Someone'} started following you`,
        { fromUid }
      );
      return res.status(201).json({ success: true, followed: true, conversationId: convId });
    }

    // PRIVATE account → send a follow request
    const reqRef  = db.collection('follow_requests').doc(`${fromUid}_${targetId}`);
    const reqSnap = await reqRef.get();
    if (reqSnap.exists && reqSnap.data().status === 'pending') {
      return res.status(200).json({ alreadyRequested: true });
    }

    await reqRef.set({
      fromUid,
      toUid:     targetId,
      status:    'pending',
      createdAt: new Date().toISOString(),
      fromUser: {
        name:     fromData.displayName || fromData.name || 'Unknown',
        avatar:   fromData.avatar    || '',
        username: fromData.username  || '',
      },
    });

    await createNotification(targetId, 'follow_request', 'New follow request',
      `${fromData.displayName || 'Someone'} wants to follow you`,
      { requestId: `${fromUid}_${targetId}`, fromUid }
    );

    res.status(201).json({ success: true, requested: true, requestId: `${fromUid}_${targetId}` });
  } catch (err) {
    console.error('follow request error:', err);
    res.status(500).json({ error: 'Follow request failed' });
  }
});

// GET /api/follow-requests — incoming pending requests (single-field query, no compound index)
app.get('/api/follow-requests', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('follow_requests').where('toUid', '==', req.uid).get();
    const requests = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(r => r.status === 'pending')
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ requests });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch follow requests' });
  }
});

// GET /api/follow-requests/sent — uids with a pending outgoing request
app.get('/api/follow-requests/sent', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('follow_requests').where('fromUid', '==', req.uid).get();
    const pendingUids = snap.docs
      .filter(d => d.data().status === 'pending')
      .map(d => d.data().toUid);
    res.json({ pendingUids });
  } catch {
    res.status(500).json({ error: 'Failed to fetch sent requests' });
  }
});

// POST /api/follow-requests/:requestId/accept
app.post('/api/follow-requests/:requestId/accept', verifyToken, async (req, res) => {
  // requestId is "{fromUid}_{toUid}"
  const { requestId } = req.params;
  try {
    const reqDoc = await db.collection('follow_requests').doc(requestId).get();
    if (!reqDoc.exists) return res.status(404).json({ error: 'Request not found' });
    const { fromUid, toUid } = reqDoc.data();
    if (toUid !== req.uid) return res.status(403).json({ error: 'Not your request to accept' });

    const batch = db.batch();
    batch.set(db.collection('follows').doc(`${fromUid}_${toUid}`), {
      followerId: fromUid, targetId: toUid, createdAt: new Date().toISOString(),
    });
    batch.update(db.collection('users').doc(toUid),   { followers: admin.firestore.FieldValue.increment(1) });
    batch.update(db.collection('users').doc(fromUid), { following: admin.firestore.FieldValue.increment(1) });
    batch.update(db.collection('follow_requests').doc(requestId), { status: 'accepted' });
    await batch.commit();

    const toData = (await db.collection('users').doc(toUid).get()).data() || {};
    await createNotification(fromUid, 'follow_accepted', 'Follow request accepted',
      `${toData.displayName || 'Someone'} accepted your follow request`,
      { fromUid: toUid }
    );

    // Open / create a 1-on-1 conversation and register it on both user docs
    const convId  = [fromUid, toUid].sort().join('_');
    const convRef = db.collection('conversations').doc(convId);
    if (!(await convRef.get()).exists) {
      await convRef.set({
        participants:  [fromUid, toUid],
        type: 'direct',
        createdAt:     new Date().toISOString(),
        lastMessage:   '',
        lastMessageAt: new Date().toISOString(),
        unreadCounts:  { [fromUid]: 0, [toUid]: 0 },
      });
    }
    // Register on both users so GET /api/conversations works index-free
    await Promise.all([fromUid, toUid].map(u =>
      db.collection('users').doc(u).update({
        conversationIds: admin.firestore.FieldValue.arrayUnion(convId),
      }).catch(() => {})
    ));

    res.json({ success: true, conversationId: convId });
  } catch (err) {
    console.error('accept request error:', err);
    res.status(500).json({ error: 'Accept failed: ' + err.message });
  }
});

// POST /api/follow-requests/:requestId/decline
app.post('/api/follow-requests/:requestId/decline', verifyToken, async (req, res) => {
  const { requestId } = req.params;
  try {
    const reqDoc = await db.collection('follow_requests').doc(requestId).get();
    if (!reqDoc.exists) return res.status(404).json({ error: 'Request not found' });
    const { toUid } = reqDoc.data();
    if (toUid !== req.uid) return res.status(403).json({ error: 'Not your request' });
    await db.collection('follow_requests').doc(requestId).delete();
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Decline failed' });
  }
});

// POST /api/users/:uid/unfollow — authenticated caller unfollows :uid
// Also cancels any pending follow request if no active follow relationship exists
app.post('/api/users/:uid/unfollow', verifyToken, async (req, res) => {
  const targetId  = req.params.uid;
  const followerId = req.uid;
  try {
    const followId  = `${followerId}_${targetId}`;
    const followRef = db.collection('follows').doc(followId);
    const existing  = await followRef.get();

    if (!existing.exists) {
      // Check for a pending follow request and cancel it
      const reqRef  = db.collection('follow_requests').doc(`${followerId}_${targetId}`);
      const reqSnap = await reqRef.get();
      if (reqSnap.exists) {
        await reqRef.delete();
        return res.status(200).json({ success: true, cancelledRequest: true });
      }
      return res.status(200).json({ wasNotFollowing: true });
    }

    const batch = db.batch();
    batch.delete(followRef);
    batch.update(db.collection('users').doc(targetId),   { followers: admin.firestore.FieldValue.increment(-1) });
    batch.update(db.collection('users').doc(followerId), { following: admin.firestore.FieldValue.increment(-1) });
    await batch.commit();
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Unfollow failed' });
  }
});

// GET /api/users/:uid/following — returns array of uids that :uid follows
app.get('/api/users/:uid/following', async (req, res) => {
  try {
    const snap = await db.collection('follows').where('followerId', '==', req.params.uid).get();
    const ids = snap.docs.map(d => d.data().targetId);
    res.status(200).json({ following: ids });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch following list' });
  }
});

// GET /api/users/:uid/followers — returns full profiles of users who follow :uid
app.get('/api/users/:uid/followers', async (req, res) => {
  try {
    const snap = await db.collection('follows').where('targetId', '==', req.params.uid).get();
    const followerIds = snap.docs.map(d => d.data().followerId);
    if (followerIds.length === 0) return res.status(200).json({ users: [] });
    const users = [];
    for (let i = 0; i < followerIds.length; i += 10) {
      const batch = followerIds.slice(i, i + 10);
      const userSnap = await db.collection('users')
        .where(admin.firestore.FieldPath.documentId(), 'in', batch).get();
      userSnap.docs.forEach(d => users.push({
        uid: d.id,
        displayName: d.data().displayName,
        username: d.data().username,
        avatar: d.data().avatar,
        fitnessLevel: d.data().fitnessLevel,
        accountType: d.data().accountType,
      }));
    }
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch followers' });
  }
});

// GET /api/users/:uid/following-users — returns full profiles of users :uid follows
app.get('/api/users/:uid/following-users', async (req, res) => {
  try {
    const snap = await db.collection('follows').where('followerId', '==', req.params.uid).get();
    const followingIds = snap.docs.map(d => d.data().targetId);
    if (followingIds.length === 0) return res.status(200).json({ users: [] });
    const users = [];
    for (let i = 0; i < followingIds.length; i += 10) {
      const batch = followingIds.slice(i, i + 10);
      const userSnap = await db.collection('users')
        .where(admin.firestore.FieldPath.documentId(), 'in', batch).get();
      userSnap.docs.forEach(d => users.push({
        uid: d.id,
        displayName: d.data().displayName,
        username: d.data().username,
        avatar: d.data().avatar,
        fitnessLevel: d.data().fitnessLevel,
        accountType: d.data().accountType,
      }));
    }
    res.status(200).json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch following users' });
  }
});

// ─── SEARCH USERS ─────────────────────────────────────────────────────────────
app.get('/api/users/search', async (req, res) => {
  let { username } = req.query;
  if (!username) return res.status(400).json({ error: 'username required' });
  // Strip leading @ and normalize to lowercase so "@Aisha_Fit" finds "aisha_fit"
  username = String(username).replace(/^@/, '').toLowerCase().trim();
  if (!username) return res.status(400).json({ error: 'username required' });
  try {
    // Try exact lowercase match first
    let snap = await db.collection('users').where('username', '==', username).limit(1).get();
    if (snap.empty) {
      // Try case-insensitive prefix scan (Firestore doesn't support ilike, so scan top 200)
      const allSnap = await db.collection('users').limit(200).get();
      const match = allSnap.docs.find(d => {
        const u = (d.data().username || '').toLowerCase();
        return u === username;
      });
      if (!match) return res.status(404).json({ error: 'User not found' });
      return res.status(200).json({ uid: match.id, ...match.data() });
    }
    const doc = snap.docs[0];
    res.status(200).json({ uid: doc.id, ...doc.data() });
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROFILE & TRAINER ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET USER PROFILE ─────────────────────────────────────────────────────────
// Returns the Firestore user doc + all their posts.
// Used by ProfilePage to render any user's public profile.
app.get('/api/users/:uid/profile', async (req, res) => {
  const { uid } = req.params;
  if (!uid) return res.status(400).json({ error: 'Missing uid' });
  try {
    let userDoc = await db.collection('users').doc(uid).get();
    // If Firestore doc is missing, try to create it from Firebase Auth data
    if (!userDoc.exists) {
      try {
        const authUser = await admin.auth().getUser(uid);
        const email = authUser.email || '';
        const fallbackUsername = (authUser.displayName || email.split('@')[0])
          .toLowerCase().replace(/\s+/g, '');
        const newData = {
          email,
          displayName: authUser.displayName || email.split('@')[0] || 'User',
          username: fallbackUsername,
          accountType: 'user',
          bio: '',
          fitnessGoal: '',
          fitnessLevel: 'Intermediate',
          gym: '',
          workouts: 0,
          followers: 0,
          following: 0,
          createdAt: new Date().toISOString(),
        };
        await db.collection('users').doc(uid).set(newData);
        userDoc = await db.collection('users').doc(uid).get();
        console.log(`✅ Auto-created missing Firestore profile for ${uid} via profile endpoint`);
      } catch {
        return res.status(404).json({ error: 'User not found' });
      }
    }

    const userData   = userDoc.data() || {};
    const isPrivate  = !!userData.isPrivate;
    const requesterId = req.query.requesterId || '';

    // For private accounts, check if requester follows this user
    let isFollowingPrivate = false;
    if (isPrivate && requesterId && requesterId !== uid) {
      const followDoc = await db.collection('follows').doc(`${requesterId}_${uid}`).get();
      isFollowingPrivate = followDoc.exists;
    }

    // Private account + not owner + not following → hide posts
    const isOwner = requesterId === uid;
    const postsHidden = isPrivate && !isOwner && !isFollowingPrivate;

    // Check if requester has a pending follow request to this user
    let hasPendingRequest = false;
    if (isPrivate && requesterId && requesterId !== uid && !isFollowingPrivate) {
      const reqDoc = await db.collection('follow_requests').doc(`${requesterId}_${uid}`).get();
      hasPendingRequest = reqDoc.exists && reqDoc.data()?.status === 'pending';
    }

    // Fetch this user's posts (filtering by user.id stored in each post)
    let posts = [];
    if (!postsHidden) {
      try {
        const postsSnap = await db.collection('posts').where('user.id', '==', uid).get();
        posts = postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        posts.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      } catch (e) {
        // Posts index may not be ready; return empty array rather than failing
        console.warn('Could not fetch user posts:', e.message);
      }
    }

    res.status(200).json({ uid, ...userData, posts, postsHidden, hasPendingRequest });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

// ─── NEAR ME ──────────────────────────────────────────────────────────────────
// GET /api/users/near-me?gym=GymName
app.get('/api/users/near-me', verifyToken, async (req, res) => {
  const { gym } = req.query;
  if (!gym || String(gym).trim().length < 2) return res.status(400).json({ error: 'gym required' });
  try {
    const snap = await db.collection('users').where('gym', '==', String(gym).trim()).limit(30).get();
    const users = snap.docs
      .filter(d => d.id !== req.uid)
      .map(d => {
        const data = d.data();
        return { uid: d.id, name: data.displayName || data.name || '', username: data.username || '', avatar: data.avatar || '', accountType: data.accountType || 'user', bio: data.bio || '', followers: data.followers || 0 };
      });
    res.json({ users });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ─── PEOPLE LIKE ME ───────────────────────────────────────────────────────────
// GET /api/users/people-like-me
app.get('/api/users/people-like-me', verifyToken, async (req, res) => {
  const uid = req.uid;
  try {
    const userDoc = await db.collection('users').doc(uid).get();
    const { fitnessGoal = '', fitnessLevel = '' } = userDoc.data() || {};
    let users = [];
    if (fitnessGoal) {
      const snap = await db.collection('users').where('fitnessGoal', '==', fitnessGoal).limit(15).get();
      users = snap.docs.filter(d => d.id !== uid).map(d => {
        const data = d.data();
        return { uid: d.id, name: data.displayName || data.name || '', username: data.username || '', avatar: data.avatar || '', accountType: data.accountType || 'user', bio: data.bio || '', followers: data.followers || 0, fitnessGoal: data.fitnessGoal || '' };
      });
    }
    if (users.length < 5 && fitnessLevel) {
      const snap2 = await db.collection('users').where('fitnessLevel', '==', fitnessLevel).limit(10).get();
      const extra = snap2.docs.filter(d => d.id !== uid && !users.find(u => u.uid === d.id)).map(d => {
        const data = d.data();
        return { uid: d.id, name: data.displayName || data.name || '', username: data.username || '', avatar: data.avatar || '', accountType: data.accountType || 'user', bio: data.bio || '', followers: data.followers || 0, fitnessGoal: data.fitnessGoal || '' };
      });
      users = [...users, ...extra].slice(0, 10);
    }
    res.json({ users });
  } catch (err) { res.status(500).json({ error: 'Failed' }); }
});

// ─── UPDATE OWN PROFILE ───────────────────────────────────────────────────────
// Lets a user update their bio, fitnessGoal, gym, etc.
app.patch('/api/users/:uid/profile', verifyToken, verifyOwner, async (req, res) => {
  const { uid } = req.params;
  const { bio, fitnessGoal, fitnessLevel, gym, avatar, isPrivate, username } = req.body;
  try {
    const updates = {};
    if (bio         !== undefined) updates.bio         = sanitize(bio, 300);
    if (fitnessGoal !== undefined) updates.fitnessGoal = sanitize(fitnessGoal, 100);
    if (fitnessLevel !== undefined) updates.fitnessLevel = sanitize(fitnessLevel, 50);
    if (gym         !== undefined) updates.gym         = sanitize(gym, 100);
    if (avatar      !== undefined) updates.avatar      = avatar;
    if (isPrivate   !== undefined) updates.isPrivate   = !!isPrivate;
    if (typeof req.body.gender !== 'undefined') updates.gender = String(req.body.gender).slice(0, 30);
    // Pinned PRs — array of { exercise, value, unit }
    if (Array.isArray(req.body.pinnedPRs)) {
      updates.pinnedPRs = req.body.pinnedPRs.slice(0, 5).map(pr => ({
        exercise: String(pr.exercise || '').slice(0, 50),
        value:    String(pr.value    || '').slice(0, 20),
        unit:     String(pr.unit     || '').slice(0, 10),
      }));
    }
    if (username !== undefined) {
      const clean = String(username).replace(/[^a-zA-Z0-9_]/g, '').toLowerCase().slice(0, 20);
      if (clean.length >= 3) {
        const existing = await db.collection('users').where('username', '==', clean).limit(1).get();
        const takenByOther = !existing.empty && existing.docs[0].id !== uid;
        if (takenByOther) return res.status(409).json({ error: 'Username already taken' });
        updates.username = clean;
      }
    }
    await db.collection('users').doc(uid).update(updates);
    res.status(200).json({ success: true, ...updates });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// ─── UPDATE TRAINER INFO ──────────────────────────────────────────────────────
// Trainers call this to set their pricing, availability, specialties, etc.
// Stored as a nested `trainerInfo` object on their Firestore user doc.
app.patch('/api/users/:uid/trainer', verifyToken, verifyOwner, async (req, res) => {
  const { uid } = req.params;
  const { trainerInfo } = req.body;
  try {
    await db.collection('users').doc(uid).update({ trainerInfo });
    res.status(200).json({ success: true, trainerInfo });
  } catch (error) {
    console.error('Update trainer info error:', error);
    res.status(500).json({ error: 'Failed to update trainer info' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKING ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── CREATE A BOOKING ─────────────────────────────────────────────────────────
// A client submits a session request to a trainer.
// Starts with status='pending' — the trainer must confirm.
app.post('/api/bookings', verifyToken, async (req, res) => {
  const { trainerId, trainerName, clientId, clientName, date, timeSlot, sessionType, notes, price } = req.body;
  if (clientId !== req.uid) {
    return res.status(403).json({ error: 'You can only create bookings for yourself.' });
  }
  try {
    const booking = {
      trainerId,
      trainerName,
      clientId,
      clientName,
      date,
      timeSlot,
      sessionType,
      status: 'pending',
      notes: notes || '',
      price: price || 0,
      createdAt: new Date().toISOString(),
    };
    const docRef = await db.collection('bookings').add(booking);
    // Notify the trainer about the new booking request
    await createNotification(
      trainerId,
      'booking_request',
      '📅 New booking request',
      `${clientName} wants to book a ${sessionType} session on ${date} at ${timeSlot}.`,
      { bookingId: docRef.id, clientId, clientName, date, timeSlot, sessionType }
    );
    res.status(201).json({ id: docRef.id, ...booking });
  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// ─── GET BOOKINGS FOR A USER ──────────────────────────────────────────────────
// Pass ?role=trainer to get bookings where this uid is the trainer.
// Pass ?role=client  to get bookings where this uid is the client.
app.get('/api/users/:uid/bookings', async (req, res) => {
  const { uid } = req.params;
  const { role } = req.query;
  try {
    const field = role === 'client' ? 'clientId' : 'trainerId';
    const snap = await db.collection('bookings').where(field, '==', uid).get();
    const bookings = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    bookings.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.status(200).json(bookings);
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// ─── UPDATE BOOKING STATUS ────────────────────────────────────────────────────
// Trainer confirms, cancels, or marks as completed.
// Valid statuses: 'pending' | 'confirmed' | 'cancelled' | 'completed'
app.patch('/api/bookings/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const valid = ['pending', 'confirmed', 'cancelled', 'completed'];
  if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid status' });
  try {
    await db.collection('bookings').doc(id).update({ status });
    res.status(200).json({ success: true, status });
  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

// ─── BOOKING RESPOND (trainer accept/decline with message) ────────────────────
app.patch('/api/bookings/:id/respond', verifyToken, async (req, res) => {
  const { decision, message } = req.body; // decision: 'confirmed' | 'declined'
  if (!['confirmed', 'declined'].includes(decision)) return res.status(400).json({ error: 'decision must be confirmed or declined' });
  try {
    const ref = db.collection('bookings').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Booking not found' });
    const booking = doc.data();
    if (booking.trainerId !== req.uid) return res.status(403).json({ error: 'Only the trainer can respond' });
    const status = decision === 'confirmed' ? 'confirmed' : 'cancelled';
    await ref.update({ status, trainerMessage: sanitize(message || '', 500), respondedAt: new Date().toISOString() });
    const trainerSnap = await db.collection('users').doc(req.uid).get();
    const t = trainerSnap.exists ? trainerSnap.data() : {};
    const trainerName = t.displayName || t.name || 'Your trainer';
    await createNotification(
      booking.clientId,
      decision === 'confirmed' ? 'booking_confirmed' : 'booking_declined',
      decision === 'confirmed' ? `✅ Booking confirmed by ${trainerName}!` : `❌ Booking declined by ${trainerName}`,
      message ? `"${message.slice(0, 120)}"` : (decision === 'confirmed' ? `See you on ${booking.date} at ${booking.timeSlot}.` : 'Please book another slot.'),
      { bookingId: req.params.id }
    );
    res.json({ success: true, status });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── ASSIGN PROGRAM TO CLIENT ─────────────────────────────────────────────────
app.post('/api/trainer/assign-program', verifyToken, async (req, res) => {
  const trainerId = req.uid;
  const { clientId, programId, note } = req.body;
  if (!clientId || !programId) return res.status(400).json({ error: 'clientId and programId required' });
  try {
    // Verify trainer status
    const tSnap = await db.collection('users').doc(trainerId).get();
    if (!tSnap.exists || tSnap.data().accountType !== 'trainer') return res.status(403).json({ error: 'Trainer account required' });
    const t = tSnap.data();
    const progSnap = await db.collection('programs').doc(programId).get();
    if (!progSnap.exists) return res.status(404).json({ error: 'Program not found' });
    const prog = progSnap.data();
    await db.collection('assignedPrograms').add({
      trainerId, clientId, programId,
      programName: prog.name,
      trainerName: t.displayName || t.name || 'Trainer',
      trainerAvatar: t.avatar || '',
      note: sanitize(note || '', 300),
      assignedAt: new Date().toISOString(),
      status: 'active',
    });
    await createNotification(clientId, 'program_assigned',
      `${t.displayName || 'Your trainer'} assigned you a program 💪`,
      `"${prog.name}" — check your Train page to start`,
      { programId }
    );
    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/trainer/assigned-programs — trainer's assignments list
app.get('/api/trainer/assigned-programs', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('assignedPrograms').where('trainerId', '==', req.uid).get();
    res.json({ assignments: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/train/assigned — client gets programs assigned to them
app.get('/api/train/assigned', verifyToken, async (req, res) => {
  const uid = req.uid;
  try {
    const snap = await db.collection('assignedPrograms').where('clientId', '==', uid).where('status', '==', 'active').get();
    const assignments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    const enriched = await Promise.all(assignments.map(async a => {
      const progSnap = await db.collection('programs').doc(a.programId).get();
      return { ...a, program: progSnap.exists ? { id: progSnap.id, ...progSnap.data() } : null };
    }));
    res.json({ assignments: enriched.filter(a => a.program) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── SESSION NOTES ────────────────────────────────────────────────────────────
// GET /api/trainer/notes?clientId=xxx
app.get('/api/trainer/notes', verifyToken, async (req, res) => {
  const { clientId } = req.query;
  try {
    let q = db.collection('sessionNotes').where('trainerId', '==', req.uid);
    if (clientId) q = q.where('clientId', '==', String(clientId));
    const snap = await q.orderBy('createdAt', 'desc').limit(50).get();
    res.json({ notes: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/trainer/notes
app.post('/api/trainer/notes', verifyToken, async (req, res) => {
  const { clientId, clientName, sessionDate, content, bookingId } = req.body;
  if (!clientId || !content) return res.status(400).json({ error: 'clientId and content required' });
  try {
    const tSnap = await db.collection('users').doc(req.uid).get();
    if (!tSnap.exists || tSnap.data().accountType !== 'trainer') return res.status(403).json({ error: 'Trainer only' });
    const ref = await db.collection('sessionNotes').add({
      trainerId: req.uid,
      clientId: String(clientId),
      clientName: sanitize(clientName || '', 80),
      sessionDate: String(sessionDate || new Date().toISOString().slice(0,10)),
      content: sanitize(content, 2000),
      bookingId: bookingId || null,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/trainer/notes/:id
app.patch('/api/trainer/notes/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('sessionNotes').doc(req.params.id).get();
    if (!doc.exists || doc.data().trainerId !== req.uid) return res.status(403).json({ error: 'Forbidden' });
    await doc.ref.update({ content: sanitize(req.body.content || '', 2000), updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/trainer/notes/:id
app.delete('/api/trainer/notes/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('sessionNotes').doc(req.params.id).get();
    if (!doc.exists || doc.data().trainerId !== req.uid) return res.status(403).json({ error: 'Forbidden' });
    await doc.ref.delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── PROGRAM MARKETPLACE ──────────────────────────────────────────────────────
// GET /api/marketplace/programs
app.get('/api/marketplace/programs', async (req, res) => {
  try {
    const snap = await db.collection('marketplacePrograms').where('published', '==', true).get();
    const programs = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => (b.purchases||0)-(a.purchases||0));
    res.json({ programs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/marketplace/programs — trainer publishes a program
app.post('/api/marketplace/programs', verifyToken, async (req, res) => {
  const { programId, price, description, category } = req.body;
  if (!programId || !price) return res.status(400).json({ error: 'programId and price required' });
  try {
    const tSnap = await db.collection('users').doc(req.uid).get();
    if (!tSnap.exists || tSnap.data().accountType !== 'trainer') return res.status(403).json({ error: 'Trainer only' });
    const t = tSnap.data();
    const pSnap = await db.collection('programs').doc(programId).get();
    if (!pSnap.exists || pSnap.data().authorId !== req.uid) return res.status(403).json({ error: 'You can only publish your own programs' });
    const p = pSnap.data();
    // Check if already published
    const existingSnap = await db.collection('marketplacePrograms').where('programId', '==', programId).limit(1).get();
    if (!existingSnap.empty) {
      await existingSnap.docs[0].ref.update({ price: Number(price), description: sanitize(description || '', 500), published: true });
      return res.json({ id: existingSnap.docs[0].id, updated: true });
    }
    const ref = await db.collection('marketplacePrograms').add({
      programId, price: Number(price), published: true,
      trainerId: req.uid,
      trainerName: t.displayName || t.name || 'Trainer',
      trainerAvatar: t.avatar || '',
      trainerVerified: !!(t.verified),
      name: p.name, description: sanitize(description || p.description || '', 500),
      category: String(category || 'general'),
      weeks: p.weeks?.length || 0,
      purchases: 0, rating: 0, reviews: 0,
      publishedAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/marketplace/programs/:id/purchase — buy a marketplace program
app.post('/api/marketplace/programs/:id/purchase', verifyToken, async (req, res) => {
  const uid = req.uid;
  try {
    const ref = db.collection('marketplacePrograms').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists || !doc.data().published) return res.status(404).json({ error: 'Program not found' });
    const mp = doc.data();
    // Check not already purchased
    const already = await db.collection('purchases').where('userId','==',uid).where('marketplaceProgramId','==',req.params.id).limit(1).get();
    if (!already.empty) return res.status(409).json({ error: 'Already purchased' });
    await db.collection('purchases').add({
      userId: uid, marketplaceProgramId: req.params.id,
      programId: mp.programId, trainerId: mp.trainerId,
      price: mp.price, purchasedAt: new Date().toISOString(),
    });
    await ref.update({ purchases: admin.firestore.FieldValue.increment(1) });
    // Notify trainer
    const uSnap = await db.collection('users').doc(uid).get();
    const u = uSnap.exists ? uSnap.data() : {};
    await createNotification(mp.trainerId, 'program_purchased',
      `💰 ${u.displayName || 'Someone'} purchased your program!`,
      `"${mp.name}" — £${mp.price}`,
      { marketplaceProgramId: req.params.id }
    );
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/marketplace/programs/mine — trainer's published programs
app.get('/api/marketplace/programs/mine', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('marketplacePrograms').where('trainerId', '==', req.uid).get();
    res.json({ programs: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/marketplace/programs/purchased — user's purchased programs
app.get('/api/marketplace/programs/purchased', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('purchases').where('userId', '==', req.uid).get();
    res.json({ purchases: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── TRAINER AVAILABILITY BLOCKS ──────────────────────────────────────────────
app.patch('/api/users/:uid/trainer/availability-blocks', verifyToken, verifyOwner, async (req, res) => {
  const { blocks } = req.body; // [{ day: 0-6, slots: [{ start: '09:00', end: '17:00' }] }]
  if (!Array.isArray(blocks)) return res.status(400).json({ error: 'blocks array required' });
  try {
    await db.collection('users').doc(req.params.uid).update({
      'trainerInfo.availabilityBlocks': blocks.slice(0, 21), // max 3 blocks per day * 7 days
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── TRAINER EARNINGS ─────────────────────────────────────────────────────────
app.get('/api/users/:uid/trainer/earnings', verifyToken, verifyOwner, async (req, res) => {
  try {
    const snap = await db.collection('bookings')
      .where('trainerId', '==', req.params.uid)
      .where('status', 'in', ['confirmed', 'completed']).get();
    const bookings = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Group by month
    const byMonth = {};
    for (const b of bookings) {
      const date = b.createdAt ? new Date(b.createdAt) : new Date();
      const key = `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`;
      if (!byMonth[key]) byMonth[key] = { revenue: 0, count: 0 };
      byMonth[key].revenue += Number(b.price || 0);
      byMonth[key].count++;
    }
    const monthlyData = Object.entries(byMonth).sort((a,b) => a[0].localeCompare(b[0])).slice(-12).map(([month, d]) => ({ month, ...d }));
    const totalRevenue = bookings.reduce((a, b) => a + Number(b.price || 0), 0);
    // Marketplace earnings
    const mpSnap = await db.collection('purchases').where('trainerId', '==', req.params.uid).get();
    const marketplaceRevenue = mpSnap.docs.reduce((a, d) => a + Number(d.data().price || 0), 0);
    res.json({ monthlyData, totalRevenue, marketplaceRevenue, totalSessions: bookings.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── TRAINER SPOTLIGHT (Explore) ──────────────────────────────────────────────
app.get('/api/explore/trainer-spotlight', async (req, res) => {
  try {
    // Show ALL trainer accounts — sort verified ones first, then by followers
    const snap = await db.collection('users')
      .where('accountType', '==', 'trainer')
      .limit(20).get();
    const trainers = snap.docs
      .map(d => {
        const u = d.data();
        return {
          uid: d.id,
          name: u.displayName || u.name || 'Trainer',
          username: u.username || '',
          avatar: u.avatar || '',
          bio: u.bio || '',
          followers: u.followers || 0,
          verified: !!u.verified,
          trainerInfo: {
            specialty: u.trainerInfo?.specialty || '',
            rate: u.trainerInfo?.rate || 0,
            currency: u.trainerInfo?.currency || 'GBP',
          },
        };
      })
      // verified first, then by follower count
      .sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0) || b.followers - a.followers)
      .slice(0, 12);
    res.json({ trainers });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPLORE ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── DISCOVERY FEED ───────────────────────────────────────────────────────────
// Returns posts from users other than the requester, sorted by engagement.
// Simple algorithm: (likes * 2 + comments) weighted by recency.
app.get('/api/explore/feed', async (req, res) => {
  const { userId } = req.query;
  try {
    const snap = await db.collection('posts').limit(100).get();
    let posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    // Exclude current user's own posts
    if (userId) posts = posts.filter(p => p.user?.id !== userId);

    // Score by engagement + recency
    const now = Date.now();
    posts = posts.map(p => {
      const ageHours = (now - new Date(p.createdAt || 0).getTime()) / 3600000;
      const engScore = (p.likes || 0) * 2 + (p.comments?.length || 0);
      const score    = engScore / Math.max(1, Math.log(ageHours + 2));
      return { ...p, _score: score };
    });
    posts.sort((a, b) => b._score - a._score);

    res.status(200).json(posts.slice(0, 30));
  } catch (error) {
    console.error('Explore feed error:', error);
    res.status(500).json({ error: 'Failed to fetch explore feed' });
  }
});

// ─── PEOPLE YOU MAY KNOW ──────────────────────────────────────────────────────
// Returns up to 8 users that the requesting user doesn't already follow.
// Used by the Explore Discover tab for user recommendations.
app.get('/api/explore/suggestions', async (req, res) => {
  const { uid } = req.query;
  try {
    // Get the list of UIDs the current user follows
    let followingIds = new Set();
    if (uid) {
      const followSnap = await db.collection('follows')
        .where('followerId', '==', uid).get();
      followSnap.docs.forEach(d => followingIds.add(d.data().followingId));
    }

    // Fetch a batch of users, exclude self + already-followed
    const snap = await db.collection('users').limit(50).get();
    const suggestions = snap.docs
      .map(d => ({ uid: d.id, ...d.data() }))
      .filter(u => u.uid !== uid && !followingIds.has(u.uid))
      .slice(0, 8)
      .map(u => ({
        uid: u.uid,
        name: u.displayName || u.email?.split('@')[0] || 'User',
        username: u.username || '',
        avatar: u.avatar || '',
        accountType: u.accountType || 'user',
        bio: u.bio || '',
        followers: u.followers || 0,
      }));

    res.json(suggestions);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── TRAINER MARKETPLACE ──────────────────────────────────────────────────────
// Returns all users with accountType === 'trainer' who have a trainerInfo set.
app.get('/api/explore/trainers', async (req, res) => {
  try {
    const snap = await db.collection('users').where('accountType', '==', 'trainer').get();
    const trainers = snap.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
    // Sort by rating descending
    trainers.sort((a, b) => (b.trainerInfo?.rating || 0) - (a.trainerInfo?.rating || 0));
    res.status(200).json(trainers);
  } catch (error) {
    console.error('Trainers error:', error);
    res.status(500).json({ error: 'Failed to fetch trainers' });
  }
});

// ─── TRENDING EXERCISES ───────────────────────────────────────────────────────
// Counts exercise occurrences across posts from the last 7 days.
// Returns top 10 exercises with their post counts.
app.get('/api/explore/trending', async (req, res) => {
  try {
    const since = new Date(Date.now() - 7 * 86400000).toISOString();
    const snap  = await db.collection('posts').limit(200).get();
    const counts = {};

    snap.docs.forEach(doc => {
      const data = doc.data();
      if ((data.createdAt || '') < since) return;
      // Count the post's workoutType
      if (data.workoutType) {
        counts[data.workoutType] = (counts[data.workoutType] || 0) + 1;
      }
      // Also count individual exercises inside the post
      (data.exercises || []).forEach(ex => {
        if (ex.name) counts[ex.name] = (counts[ex.name] || 0) + 1;
      });
    });

    const trending = Object.entries(counts)
      .map(([exercise, count]) => ({ exercise, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const totalPosts = snap.docs.filter(doc => (doc.data().createdAt || '') >= since).length;
    res.status(200).json({ trending, totalPosts });
  } catch (error) {
    console.error('Trending error:', error);
    res.status(500).json({ error: 'Failed to fetch trending' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET LEADERBOARD ──────────────────────────────────────────────────────────
// category: 'workouts' | 'likes' | 'prs' | 'streak'
// Returns top 20 users ranked by that metric.
app.get('/api/leaderboard', async (req, res) => {
  const { category = 'workouts', period = 'week' } = req.query;
  // Compute the since-timestamp for time-bounded queries
  const now = Date.now();
  const since = period === 'week'
    ? new Date(now - 7  * 86400000).toISOString()
    : period === 'month'
    ? new Date(now - 30 * 86400000).toISOString()
    : null; // null = all time
  try {
    const usersSnap = await db.collection('users').get();
    const users = usersSnap.docs
      .filter(doc => !doc.data().isDemo && !doc.data().banned)  // exclude demo + banned
      .map(doc => ({
        uid: doc.id,
        name: doc.data().displayName || doc.data().name || 'Unknown',
        username: doc.data().username || '',
        avatar: doc.data().avatar || '',
        accountType: doc.data().accountType || 'user',
      }));

    let ranked = [];

    const periodLabel = period === 'week' ? 'this week' : period === 'month' ? 'this month' : 'all time';

    if (category === 'workouts') {
      const postsSnap = await db.collection('posts').limit(500).get();
      const counts = {};
      postsSnap.docs.forEach(doc => {
        const d = doc.data();
        if (since && (d.createdAt || '') < since) return;
        const uid = d.user?.id;
        if (uid) counts[uid] = (counts[uid] || 0) + 1;
      });
      ranked = users
        .map(u => ({ ...u, score: counts[u.uid] || 0, label: `workouts ${periodLabel}` }))
        .filter(u => u.score > 0)
        .sort((a, b) => b.score - a.score);

    } else if (category === 'likes') {
      const postsSnap = await db.collection('posts').limit(500).get();
      const totals = {};
      postsSnap.docs.forEach(doc => {
        const d = doc.data();
        if (since && (d.createdAt || '') < since) return;
        const uid = d.user?.id;
        if (uid) totals[uid] = (totals[uid] || 0) + (d.likes || 0);
      });
      ranked = users
        .map(u => ({ ...u, score: totals[u.uid] || 0, label: `likes ${periodLabel}` }))
        .filter(u => u.score > 0)
        .sort((a, b) => b.score - a.score);

    } else if (category === 'prs') {
      const prsSnap = await db.collection('personal_records').limit(500).get();
      const counts = {};
      prsSnap.docs.forEach(doc => {
        const d = doc.data();
        if (since && (d.createdAt || '') < since) return;
        const uid = d.userId;
        if (uid) counts[uid] = (counts[uid] || 0) + 1;
      });
      ranked = users
        .map(u => ({ ...u, score: counts[u.uid] || 0, label: `personal records ${periodLabel}` }))
        .filter(u => u.score > 0)
        .sort((a, b) => b.score - a.score);

    } else if (category === 'streak') {
      // Consecutive posting days ending today, per user
      const postsSnap = await db.collection('posts').limit(500).get();
      const datesByUser = {};
      postsSnap.docs.forEach(doc => {
        const d = doc.data();
        const uid = d.user?.id;
        const date = (d.createdAt || '').split('T')[0];
        if (uid && date) {
          if (!datesByUser[uid]) datesByUser[uid] = new Set();
          datesByUser[uid].add(date);
        }
      });

      const calcStreak = (dateSet) => {
        if (!dateSet || dateSet.size === 0) return 0;
        const sorted = [...dateSet].sort().reverse();
        let streak = 0;
        let cur = new Date(); cur.setHours(12,0,0,0);
        for (const d of sorted) {
          const dDate = new Date(d + 'T12:00:00');
          const diff  = Math.round((cur - dDate) / 86400000);
          if (diff <= 1) { streak++; cur = dDate; }
          else break;
        }
        return streak;
      };

      ranked = users
        .map(u => ({ ...u, score: calcStreak(datesByUser[u.uid]), label: 'day streak' }))
        .filter(u => u.score > 0)
        .sort((a, b) => b.score - a.score);

    } else if (category === 'followers') {
      // Rank by follower count stored on the user document
      ranked = users
        .map(u => {
          const raw = usersSnap.docs.find(d => d.id === u.uid)?.data();
          const followerCount = raw?.followers || 0;
          return { ...u, score: followerCount, label: 'followers' };
        })
        .filter(u => u.score > 0)
        .sort((a, b) => b.score - a.score);
    }

    // Compute the requesting user's rank (optional uid query param)
    const { uid: reqUid } = req.query;
    const allRanked = ranked;

    // Always include the requesting user in the leaderboard even if score=0
    let top20 = allRanked.slice(0, 20);
    let myRank = null;
    if (reqUid) {
      const idx = allRanked.findIndex(u => u.uid === reqUid);
      if (idx >= 0) {
        myRank = { rank: idx + 1, score: allRanked[idx].score };
      } else {
        // User has score 0 — add them at the bottom so they still appear
        const reqUser = users.find(u => u.uid === reqUid);
        if (reqUser) {
          const entry = { ...reqUser, score: 0, label: ranked[0]?.label || '' };
          myRank = { rank: allRanked.length + 1, score: 0 };
          if (!top20.find(u => u.uid === reqUid)) top20 = [...top20, entry].slice(0, 20);
        }
      }
    }

    res.status(200).json({ leaderboard: top20, myRank });
  } catch (error) {
    console.error('Leaderboard error:', error);
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SETTINGS ROUTES
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET USER SETTINGS ────────────────────────────────────────────────────────
app.get('/api/users/:uid/settings', async (req, res) => {
  const { uid } = req.params;
  try {
    const doc = await db.collection('users').doc(uid).get();
    if (!doc.exists) return res.status(404).json({ error: 'User not found' });
    const settings = doc.data().settings || {};
    res.status(200).json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// ─── SAVE USER SETTINGS ───────────────────────────────────────────────────────
// Merges the provided settings object into the user's Firestore doc.
app.patch('/api/users/:uid/settings', verifyToken, verifyOwner, async (req, res) => {
  const { uid } = req.params;
  const { settings } = req.body;
  try {
    await db.collection('users').doc(uid).update({ settings });
    res.status(200).json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save settings' });
  }
});

// ─── SEND PASSWORD RESET (self-service) ───────────────────────────────────────
// User-initiated reset from Settings page — sends reset email to their address.
app.post('/api/users/:uid/send-reset', async (req, res) => {
  const { uid } = req.params;
  try {
    const userRecord = await admin.auth().getUser(uid);
    await admin.auth().generatePasswordResetLink(userRecord.email);
    res.status(200).json({ success: true, email: userRecord.email });
  } catch (error) {
    res.status(500).json({ error: 'Failed to send reset email' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXPLORE ROUTES (discovery feed)
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/explore/posts', async (req, res) => {
  const { userId } = req.query;
  try {
    const snap = await db.collection('posts').orderBy('likes', 'desc').limit(40).get();
    let posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    if (userId) posts = posts.filter(p => p.user?.id !== userId);
    res.status(200).json(posts);
  } catch {
    try {
      const snap = await db.collection('posts').limit(40).get();
      let posts = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      if (userId) posts = posts.filter(p => p.user?.id !== userId);
      posts.sort((a, b) => (b.likes || 0) - (a.likes || 0));
      res.status(200).json(posts);
    } catch (e) {
      res.status(500).json({ error: 'Failed to fetch explore posts' });
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// LEADERBOARD — hall of fame
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/leaderboard/hall-of-fame', async (req, res) => {
  try {
    const snap = await db.collection('hall_of_fame').get();
    const entries = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    entries.sort((a, b) => (b.weekOf || '').localeCompare(a.weekOf || ''));
    res.status(200).json({ hallOfFame: entries.slice(0, 10) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch hall of fame' });
  }
});

app.post('/api/leaderboard/hall-of-fame', async (req, res) => {
  const { uid, name, avatar, score, category, weekOf } = req.body;
  try {
    const entry = { uid, name, avatar, score, category, weekOf: weekOf || new Date().toISOString().split('T')[0] };
    const docRef = await db.collection('hall_of_fame').add(entry);
    res.status(201).json({ id: docRef.id, ...entry });
  } catch (error) {
    res.status(500).json({ error: 'Failed to record champion' });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT SETTINGS — password, email, display name
// ═══════════════════════════════════════════════════════════════════════════════

app.patch('/api/users/:uid/password', verifyToken, verifyOwner, async (req, res) => {
  const { uid } = req.params;
  const { newPassword } = req.body;
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters' });
  try {
    await admin.auth().updateUser(uid, { password: newPassword });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.patch('/api/users/:uid/email-update', verifyToken, verifyOwner, async (req, res) => {
  const { uid } = req.params;
  const { newEmail } = req.body;
  try {
    await admin.auth().updateUser(uid, { email: newEmail });
    await db.collection('users').doc(uid).update({ email: newEmail });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─── SELF-DELETE ACCOUNT ─────────────────────────────────────────────────────
app.delete('/api/users/:uid/account', verifyToken, verifyOwner, async (req, res) => {
  const { uid } = req.params;
  try {
    await admin.auth().deleteUser(uid);
    await db.collection('users').doc(uid).delete();
    // Clean up user's posts
    const postsSnap = await db.collection('posts').where('user.id', '==', uid).get();
    const batch = db.batch();
    postsSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    res.status(200).json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ─── UPDATE STREAK ON NEW POST ────────────────────────────────────────────────
app.post('/api/users/:uid/update-streak', verifyToken, async (req, res) => {
  const { uid } = req.params;
  if (uid !== req.uid) return res.status(403).json({ error: 'Forbidden' });
  try {
    // Compute streak from actual post history in Firestore
    const postsSnap = await db.collection('posts').where('user.id', '==', uid).get();
    const postedDays = new Set();
    postsSnap.forEach(doc => {
      const ts = doc.data().createdAt || doc.data().timestamp || '';
      if (ts) postedDays.add(new Date(ts).toISOString().slice(0, 10));
    });

    // Walk backwards from today counting consecutive days
    let streakDays = 0;
    const cursor = new Date();
    cursor.setHours(0, 0, 0, 0);
    while (true) {
      const day = cursor.toISOString().slice(0, 10);
      if (!postedDays.has(day)) break;
      streakDays++;
      cursor.setDate(cursor.getDate() - 1);
    }

    const today = new Date().toISOString().slice(0, 10);
    const hasPostedToday = postedDays.has(today);

    await db.collection('users').doc(uid).update({
      streakDays,
      lastPostDate: [...postedDays].sort().pop() || '',
      hasPostedToday,
    });

    res.json({ streakDays, hasPostedToday });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/users/:uid/account', verifyToken, verifyOwner, async (req, res) => {
  const { uid } = req.params;
  const { displayName, username } = req.body;
  try {
    const safeName     = displayName ? sanitize(displayName, 60) : undefined;
    const safeUsername = username    ? sanitize(username, 30).replace(/\s+/g, '') : undefined;
    if (safeName) await admin.auth().updateUser(uid, { displayName: safeName });
    const updates = {};
    if (safeName)     updates.displayName = safeName;
    if (safeUsername) updates.username    = safeUsername;
    if (Object.keys(updates).length) await db.collection('users').doc(uid).update(updates);
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════════
// GLOBAL SEARCH
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/search?q=<query>&type=all|users|posts|exercises|gyms
app.get('/api/search', async (req, res) => {
  // Strip a leading @ so searching "@marcus" finds user "coach_marcus"
  const q    = (req.query.q || '').toLowerCase().trim().replace(/^@/, '');
  const type = req.query.type || 'all';
  if (q.length < 2) return res.json({ users: [], posts: [], exercises: [], gyms: [] });
  try {
    let users = [], posts = [], exercises = [], gyms = [];

    if (type === 'all' || type === 'users') {
      const snap = await db.collection('users').limit(100).get();
      users = snap.docs
        .map(d => ({ uid: d.id, ...d.data() }))
        .filter(u =>
          (u.displayName || '').toLowerCase().includes(q) ||
          (u.username    || '').toLowerCase().includes(q) ||
          (u.bio         || '').toLowerCase().includes(q)
        )
        .slice(0, 10)
        .map(u => ({
          uid: u.uid, name: u.displayName || u.email,
          username: u.username || '', avatar: u.avatar || '',
          accountType: u.accountType || 'user', bio: u.bio || '',
          followers: u.followers || 0, verified: !!u.verified,
        }));
    }

    if (type === 'all' || type === 'posts') {
      const snap = await db.collection('posts').orderBy('createdAt','desc').limit(100).get();
      posts = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(p =>
          (p.caption     || '').toLowerCase().includes(q) ||
          (p.workoutType || '').toLowerCase().includes(q) ||
          (p.exercises   || []).some(e => (e.name || '').toLowerCase().includes(q))
        )
        .slice(0, 10);
    }

    if (type === 'all' || type === 'exercises') {
      const snap = await db.collection('exercises').limit(200).get();
      exercises = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(e =>
          (e.name        || '').toLowerCase().includes(q) ||
          (e.category    || '').toLowerCase().includes(q) ||
          (e.equipment   || []).some(eq => eq.toLowerCase().includes(q)) ||
          (e.primaryMuscles || []).some(m => m.toLowerCase().includes(q))
        )
        .slice(0, 8)
        .map(e => ({
          id: e.id, name: e.name, category: e.category,
          difficulty: e.difficulty, equipment: e.equipment || [],
          primaryMuscles: e.primaryMuscles || [],
          authorName: e.authorName || '', authorAvatar: e.authorAvatar || '',
          authorVerified: e.authorVerified || false,
        }));
    }

    if (type === 'all' || type === 'gyms') {
      const snap = await db.collection('gyms').limit(100).get();
      gyms = snap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .filter(g =>
          (g.name        || '').toLowerCase().includes(q) ||
          (g.city        || '').toLowerCase().includes(q) ||
          (g.address     || '').toLowerCase().includes(q) ||
          (g.description || '').toLowerCase().includes(q)
        )
        .slice(0, 6)
        .map(g => ({
          id: g.id, name: g.name, city: g.city, address: g.address,
          coverPhoto: g.coverPhoto || null, rating: g.rating || 0,
          amenities: (g.amenities || []).slice(0, 4),
          monthlyFee: g.monthlyFee || null,
        }));
    }

    res.json({ users, posts, exercises, gyms });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/posts/hashtag/:tag
app.get('/api/posts/hashtag/:tag', async (req, res) => {
  const tag = req.params.tag.toLowerCase();
  try {
    const snap = await db.collection('posts').orderBy('createdAt','desc').limit(100).get();
    const posts = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => (p.caption || '').toLowerCase().includes('#' + tag))
      .slice(0, 30);
    res.json({ posts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// POST EDITING
// ═══════════════════════════════════════════════════════════════════════════════

// ─── GET SINGLE POST ──────────────────────────────────────────────────────────
app.get('/api/posts/:id', async (req, res) => {
  try {
    const doc = await db.collection('posts').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Post not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/posts/:id', verifyToken, async (req, res) => {
  const { workoutType, duration, calories, caption, exercises, music, isPR } = req.body;
  try {
    const ref = db.collection('posts').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Post not found' });
    const postData = doc.data();
    const ownerId = postData.userId || postData.user?.id || postData.authorId;
    if (ownerId && ownerId !== req.uid) {
      const callerSnap = await db.collection('users').doc(req.uid).get();
      const isAdmin = callerSnap.exists && callerSnap.data().accountType === 'admin';
      if (!isAdmin) return res.status(403).json({ error: 'Not your post' });
    }
    const updates = { updatedAt: new Date().toISOString() };
    if (workoutType !== undefined) updates.workoutType = sanitize(workoutType, 60);
    if (caption     !== undefined) updates.caption     = sanitize(caption, 2000);
    if (duration    !== undefined) updates.duration    = Number(duration);
    if (calories    !== undefined) updates.calories    = Number(calories);
    if (exercises   !== undefined) updates.exercises   = exercises;
    if (music       !== undefined) updates.music       = music ? sanitize(music, 100) : null;
    if (isPR        !== undefined) updates.isPR        = isPR === true;
    await ref.update(updates);
    res.json({ success: true, updates });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/posts/:id — owner can delete their own post
app.delete('/api/posts/:id', verifyToken, async (req, res) => {
  try {
    const ref = db.collection('posts').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Post not found' });
    const postData = doc.data();
    const ownerId = postData.userId || postData.user?.id || postData.authorId;
    if (ownerId && ownerId !== req.uid) {
      // Also allow admins to delete any post
      const callerSnap = await db.collection('users').doc(req.uid).get();
      const isAdmin = callerSnap.exists && callerSnap.data().accountType === 'admin';
      if (!isAdmin) return res.status(403).json({ error: 'Not your post' });
    }
    await ref.delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DIRECT MESSAGING
// ═══════════════════════════════════════════════════════════════════════════════

// ── Helper: enrich a conversation Firestore doc into the API shape ─────────
async function enrichConversation(d, uid) {
  const data    = d.data ? d.data() : d;
  const docId   = d.id || data._id;
  const convType = data.type || 'direct'; // 'direct' | 'group' | 'community'
  const base    = {
    id:            docId,
    type:          convType,
    lastMessage:   data.lastMessage   || '',
    lastMessageAt: data.lastMessageAt || '',
    unreadCount:   (data.unreadCounts || {})[uid] || 0,
  };

  if (convType === 'community') {
    return {
      ...base,
      name:  data.name  || 'Community',
      emoji: data.emoji || '👥',
      participantCount: (data.participants || []).length,
    };
  }

  if (convType === 'group') {
    const others = (data.participants || []).filter(p => p !== uid).slice(0, 3);
    const profiles = await Promise.all(others.map(async pid => {
      try {
        const u = (await db.collection('users').doc(pid).get()).data() || {};
        return { uid: pid, name: u.displayName || 'User', avatar: u.avatar || '' };
      } catch { return { uid: pid, name: 'User', avatar: '' }; }
    }));
    return { ...base, name: data.name || 'Group Chat', participantCount: (data.participants || []).length, participantProfiles: profiles };
  }

  // direct
  const otherId = (data.participants || []).find(p => p !== uid);
  let otherUser = { uid: otherId, name: 'User', username: '', avatar: '' };
  if (otherId) {
    try {
      const uSnap = await db.collection('users').doc(otherId).get();
      if (uSnap.exists) {
        const u = uSnap.data();
        otherUser = { uid: otherId, name: u.displayName || u.email || 'User', username: u.username || '', avatar: u.avatar || '' };
      }
    } catch {}
  }
  return { ...base, name: otherUser.name, otherUser };
}

app.get('/api/conversations', verifyToken, async (req, res) => {
  const uid = req.uid;
  try {
    // Strategy: read conversationIds stored on the user document (arrayUnion'd on
    // every conversation create/join).  Zero Firestore indexes required.
    // Falls back to array-contains query for legacy conversations that pre-date this field.
    const userSnap = await db.collection('users').doc(uid).get();
    const userData = userSnap.exists ? userSnap.data() : {};
    const storedIds = Array.isArray(userData.conversationIds) ? userData.conversationIds : [];

    let docs = [];

    if (storedIds.length > 0) {
      // Fetch by ID — no index, no query
      try {
        const refs = storedIds.slice(0, 50).map(id => db.collection('conversations').doc(id));
        const snaps = await db.getAll(...refs);
        docs = snaps.filter(s => s.exists);
      } catch (e) {
        console.error('[GET /api/conversations] getAll error:', e.message);
      }
    } else {
      // Legacy fallback: query by participants array
      try {
        const snap = await db.collection('conversations')
          .where('participants', 'array-contains', uid)
          .limit(50).get();
        docs = snap.docs;
        // Back-fill conversationIds on the user doc so future loads are fast
        if (snap.docs.length > 0) {
          const ids = snap.docs.map(d => d.id);
          await db.collection('users').doc(uid).update({
            conversationIds: admin.firestore.FieldValue.arrayUnion(...ids),
          }).catch(() => {});
        }
      } catch (e) {
        console.error('[GET /api/conversations] query error:', e.message);
        // Return empty rather than 500 — index may not exist yet
        return res.json({ conversations: [] });
      }
    }

    const convs = (await Promise.allSettled(docs.map(d => enrichConversation(d, uid))))
      .filter(r => r.status === 'fulfilled')
      .map(r => r.value);
    convs.sort((a, b) => {
      const ta = a.lastMessageAt ? new Date(a.lastMessageAt).getTime() : 0;
      const tb = b.lastMessageAt ? new Date(b.lastMessageAt).getTime() : 0;
      return tb - ta;
    });
    res.json({ conversations: convs });
  } catch (e) {
    console.error('[GET /api/conversations] error:', e);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/conversations — start or open a 1-on-1 DM
app.post('/api/conversations', verifyToken, async (req, res) => {
  const { toUid } = req.body;
  if (!toUid) return res.status(400).json({ error: 'toUid required' });
  const convId = [req.uid, toUid].sort().join('_');
  try {
    const ref = db.collection('conversations').doc(convId);
    if (!(await ref.get()).exists) {
      await ref.set({
        participants: [req.uid, toUid],
        type: 'direct',
        lastMessage: '', lastMessageAt: new Date().toISOString(),
        unreadCounts: { [req.uid]: 0, [toUid]: 0 },
        createdAt: new Date().toISOString(),
      });
    }
    // Register conversation ID on both user docs so GET /api/conversations is index-free
    await Promise.all([req.uid, toUid].map(u =>
      db.collection('users').doc(u).update({
        conversationIds: admin.firestore.FieldValue.arrayUnion(convId),
      }).catch(() => {})
    ));
    res.json({ conversationId: convId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/conversations/group — create a group chat
app.post('/api/conversations/group', verifyToken, async (req, res) => {
  const { participantUids, name } = req.body;
  if (!Array.isArray(participantUids) || participantUids.length < 1) {
    return res.status(400).json({ error: 'Need at least 1 other participant' });
  }
  const allParticipants = [...new Set([req.uid, ...participantUids])];
  const convId = `group_${Date.now()}_${req.uid.slice(0, 6)}`;
  try {
    await db.collection('conversations').doc(convId).set({
      participants:  allParticipants,
      type:          'group',
      name:          (name || 'Group Chat').trim().slice(0, 60),
      createdBy:     req.uid,
      lastMessage:   '',
      lastMessageAt: new Date().toISOString(),
      unreadCounts:  Object.fromEntries(allParticipants.map(u => [u, 0])),
      createdAt:     new Date().toISOString(),
    });
    // Register conversation ID on all participant user docs
    await Promise.all(allParticipants.map(u =>
      db.collection('users').doc(u).update({
        conversationIds: admin.firestore.FieldValue.arrayUnion(convId),
      }).catch(() => {})
    ));
    res.json({ conversationId: convId });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/conversations/:id/messages', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('conversations').doc(req.params.id)
      .collection('messages').orderBy('createdAt','asc').limit(100).get();
    const messages = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    await db.collection('conversations').doc(req.params.id)
      .update({ ['unreadCounts.' + req.uid]: 0 });
    res.json({ messages });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// SSE — real-time message stream (token passed as ?token= because EventSource can't set headers)
app.get('/api/conversations/:id/stream', async (req, res) => {
  const token = req.query.token || (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  let uid;
  try {
    const decoded = await admin.auth().verifyIdToken(token);
    uid = decoded.uid;
  } catch { return res.status(401).json({ error: 'Invalid token' }); }

  const convId = req.params.id;
  try {
    const convDoc = await db.collection('conversations').doc(convId).get();
    if (!convDoc.exists || !convDoc.data().participants?.includes(uid))
      return res.status(403).json({ error: 'Forbidden' });
  } catch (e) { return res.status(500).json({ error: e.message }); }

  res.set({
    'Content-Type':     'text/event-stream',
    'Cache-Control':    'no-cache, no-store',
    'Connection':       'keep-alive',
    'X-Accel-Buffering':'no',
  });
  res.flushHeaders();

  // Keep-alive ping every 25 s to prevent proxy timeouts
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  // Stream new AND modified messages (reactions update modified docs)
  const unsubscribe = db.collection('conversations').doc(convId)
    .collection('messages')
    .orderBy('createdAt', 'asc')
    .onSnapshot(snap => {
      snap.docChanges().forEach(change => {
        if (change.type === 'added' || change.type === 'modified') {
          const msg = { id: change.doc.id, ...change.doc.data(), _changeType: change.type };
          res.write(`data: ${JSON.stringify(msg)}\n\n`);
        }
      });
    }, () => res.end());

  req.on('close', () => { clearInterval(keepAlive); unsubscribe(); });
});

// Toggle emoji reaction on a message
app.post('/api/conversations/:id/messages/:msgId/react', verifyToken, async (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'emoji required' });
  try {
    const convRef = db.collection('conversations').doc(req.params.id);
    const convDoc = await convRef.get();
    if (!convDoc.exists || !convDoc.data().participants?.includes(req.uid))
      return res.status(403).json({ error: 'Forbidden' });

    const msgRef  = convRef.collection('messages').doc(req.params.msgId);
    const msgDoc  = await msgRef.get();
    if (!msgDoc.exists) return res.status(404).json({ error: 'Message not found' });

    const reactions = msgDoc.data().reactions || {};
    const users     = reactions[emoji] || [];
    const hasReacted = users.includes(req.uid);

    if (hasReacted) {
      // Remove reaction
      const updated = users.filter(u => u !== req.uid);
      if (updated.length === 0) {
        delete reactions[emoji];
      } else {
        reactions[emoji] = updated;
      }
    } else {
      reactions[emoji] = [...users, req.uid];
    }

    await msgRef.update({ reactions });
    res.json({ reactions });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/conversations/:id/messages', verifyToken, async (req, res) => {
  const { text, image, audio } = req.body;
  if (!text && !image && !audio) return res.status(400).json({ error: 'text or image or audio required' });
  try {
    const convRef = db.collection('conversations').doc(req.params.id);
    let convDoc = await convRef.get();

    // Auto-create a DM conversation if it doesn't exist yet (handles race conditions
    // where the frontend has a convId before Firestore has the doc)
    if (!convDoc.exists) {
      const parts = req.params.id.split('_');
      // Only auto-create for direct (uid_uid) format, not group chats
      if (parts.length === 2 && !req.params.id.startsWith('group_')) {
        const [uid1, uid2] = parts;
        await convRef.set({
          participants:  [uid1, uid2],
          type:          'direct',
          lastMessage:   '',
          lastMessageAt: new Date().toISOString(),
          unreadCounts:  { [uid1]: 0, [uid2]: 0 },
          createdAt:     new Date().toISOString(),
        });
        await Promise.all([uid1, uid2].map(u =>
          db.collection('users').doc(u).update({
            conversationIds: admin.firestore.FieldValue.arrayUnion(req.params.id),
          }).catch(() => {})
        ));
        convDoc = await convRef.get();
      } else {
        return res.status(404).json({ error: 'Conversation not found' });
      }
    }
    const participants  = convDoc.data().participants || [];
    const recipientId   = participants.find(p => p !== req.uid);
    const msgRef = await convRef.collection('messages').add({
      senderId: req.uid,
      text:      text ? sanitize(text, 2000) : '',
      image:     image || null,
      audio:     audio || null,
      createdAt: new Date().toISOString(),
      readBy:    [req.uid],
    });
    const msgData = { id: msgRef.id, senderId: req.uid, text: text ? sanitize(text, 2000) : '', image: image || null, audio: audio || null, createdAt: new Date().toISOString(), readBy: [req.uid] };
    const preview = text ? sanitize(text, 60) : audio ? '🎤 Voice message' : 'Sent an image';
    const upd = { lastMessage: preview, lastMessageAt: new Date().toISOString() };
    if (recipientId) upd['unreadCounts.' + recipientId] = (convDoc.data().unreadCounts?.[recipientId] || 0) + 1;
    await convRef.update(upd);
    if (recipientId) {
      const sSnap = await db.collection('users').doc(req.uid).get();
      const sName = sSnap.exists ? (sSnap.data().displayName || 'Someone') : 'Someone';
      await sendPushNotification(recipientId, sName + ' sent you a message', preview, { type: 'message', convId: req.params.id });
    }
    res.json({ id: msgRef.id, message: msgData });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// REELS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/reels', async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit || '20'), 50);
  try {
    const snap = await db.collection('posts').orderBy('createdAt','desc').limit(200).get();
    let docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Include posts that have a video URL OR an image (video clips take priority)
    const withMedia = docs.filter(p => p.videoUrl || p.image);
    const result  = (withMedia.length >= 3 ? withMedia : docs).slice(0, limit);
    const enriched = await Promise.all(result.map(async p => {
      // Support both post schemas: user.id (new) and userId (old)
      const ownerId = p.user?.id || p.userId || p.authorId || '';
      // If the post already has a well-formed user object, use it
      if (p.user?.name && p.user?.id) {
        return { ...p, isLiked: false };
      }
      let user = { id: ownerId, name: 'User', username: '', avatar: '' };
      try {
        if (ownerId) {
          const uSnap = await db.collection('users').doc(ownerId).get();
          if (uSnap.exists) {
            const u = uSnap.data();
            user = { id: ownerId, name: u.displayName || u.email, username: u.username || '', avatar: u.avatar || '' };
          }
        }
      } catch {}
      return { ...p, user, isLiked: false };
    }));
    res.json({ reels: enriched });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// PROGRESS PHOTOS
// ═══════════════════════════════════════════════════════════════════════════════

app.get('/api/progress/:uid', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('progressPhotos')
      .where('userId','==', req.params.uid)
      .orderBy('createdAt','desc').limit(30).get();
    res.json({ photos: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/progress', verifyToken, async (req, res) => {
  const { imageUrl, label, note, weight } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });
  try {
    const ref = db.collection('progressPhotos').doc();
    await ref.set({
      id: ref.id, userId: req.uid, imageUrl,
      label: label || '', note: note || '',
      weight: weight || null,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
// Mark conversation as read
app.post('/api/conversations/:id/read', verifyToken, async (req, res) => {
  try {
    await db.collection('conversations').doc(req.params.id).update({
      [`unreadCounts.${req.uid}`]: 0,
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// Update FCM token
app.post('/api/users/:uid/fcm-token', verifyToken, verifyOwner, async (req, res) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ error: 'token required' });
  try {
    await db.collection('users').doc(req.params.uid).update({ fcmToken: token });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// EMAIL VERIFICATION — OTP CODE SYSTEM
// ════════════════════════════════════════════════════════════════════════════


// GET /api/check-username/:username — check if username is available
app.get('/api/check-username/:username', async (req, res) => {
  try {
    const username = req.params.username.toLowerCase().trim();
    if (!username || username.length < 3) return res.json({ available: false });
    const snap = await db.collection('users').where('username', '==', username).limit(1).get();
    res.json({ available: snap.empty });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/resolve-username/:username — return email for a given username (for username login)
app.get('/api/resolve-username/:username', async (req, res) => {
  const { username } = req.params;
  if (!username) return res.status(400).json({ error: 'username required' });
  try {
    const snap = await db.collection('users')
      .where('username', '==', username.toLowerCase())
      .limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'No account found with that username' });
    const userData = snap.docs[0].data();
    res.json({ email: userData.email });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/send-otp — generate a 6-digit code, store in Firestore, email it
app.post('/api/auth/send-otp', verifyToken, async (req, res) => {
  try {
    const uid = req.uid;
    const userRecord = await admin.auth().getUser(uid);
    const email = userRecord.email;
    if (!email) return res.status(400).json({ error: 'No email on account' });

    // Rate-limit: max 1 send per 60 seconds
    const existing = await db.collection('emailOtps').doc(uid).get();
    if (existing.exists) {
      const sentAt = new Date(existing.data().sentAt).getTime();
      if (Date.now() - sentAt < 60_000) {
        return res.status(429).json({ error: 'Please wait 60 seconds before requesting another code.' });
      }
    }

    // Generate 6-digit code
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000).toISOString();

    // Store in Firestore
    await db.collection('emailOtps').doc(uid).set({ code, expiresAt, sentAt: new Date().toISOString(), email });

    // Fetch display name
    const userDoc = await db.collection('users').doc(uid).get();
    const name = userDoc.exists ? (userDoc.data().displayName || userDoc.data().name || '') : '';

    // Send email
    await mailer.sendMail({
      from: `"${FROM_NAME}" <${FROM_EMAIL}>`,
      to: email,
      subject: `${code} is your Flex verification code`,
      html: otpEmailHtml(code, name),
    });

    res.json({ ok: true, email: email.replace(/(.{2})(.*)(@.*)/, '$1***$3') });
  } catch (e) {
    console.error('send-otp error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// POST /api/auth/verify-otp — check submitted code, mark email verified on match
app.post('/api/auth/verify-otp', verifyToken, async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'code required' });
  try {
    const uid = req.uid;
    const doc = await db.collection('emailOtps').doc(uid).get();
    if (!doc.exists) return res.status(400).json({ error: 'No code found — request a new one.' });

    const { code: stored, expiresAt } = doc.data();
    if (new Date() > new Date(expiresAt)) {
      await doc.ref.delete();
      return res.status(400).json({ error: 'Code expired — request a new one.' });
    }
    if (code.trim() !== stored) {
      return res.status(400).json({ error: 'Incorrect code — please try again.' });
    }

    // Mark email verified in Firebase Auth
    await admin.auth().updateUser(uid, { emailVerified: true });
    // Clean up
    await doc.ref.delete();
    res.json({ ok: true });
  } catch (e) {
    console.error('verify-otp error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// GET /api/email-verified — check verification status
app.get('/api/email-verified', verifyToken, async (req, res) => {
  try {
    const user = await admin.auth().getUser(req.uid);
    res.json({ emailVerified: user.emailVerified });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// POST SAVES / BOOKMARKS
// ════════════════════════════════════════════════════════════════════════════

app.post('/api/posts/:id/save', verifyToken, async (req, res) => {
  const userId = req.uid;
  const postId = req.params.id;
  try {
    const ref = db.collection('users').doc(userId);
    const doc = await ref.get();
    const saved = doc.data()?.savedPosts || [];
    const alreadySaved = saved.includes(postId);
    if (alreadySaved) {
      await ref.update({ savedPosts: admin.firestore.FieldValue.arrayRemove(postId) });
      res.json({ saved: false });
    } else {
      await ref.update({ savedPosts: admin.firestore.FieldValue.arrayUnion(postId) });
      res.json({ saved: true });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:uid/saved-posts', verifyToken, async (req, res) => {
  if (req.uid !== req.params.uid) return res.status(403).json({ error: 'Forbidden' });
  try {
    const userDoc = await db.collection('users').doc(req.params.uid).get();
    const savedIds = userDoc.data()?.savedPosts || [];
    if (savedIds.length === 0) return res.json({ posts: [] });
    // Fetch each saved post (batched by 10 — Firestore 'in' limit)
    const posts = [];
    for (let i = 0; i < savedIds.length; i += 10) {
      const chunk = savedIds.slice(i, i + 10);
      const snap = await db.collection('posts').where(admin.firestore.FieldPath.documentId(), 'in', chunk).get();
      snap.forEach(d => posts.push({ id: d.id, ...d.data() }));
    }
    res.json({ posts });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// BLOCK / MUTE USERS
// ════════════════════════════════════════════════════════════════════════════

app.post('/api/users/:uid/block', verifyToken, async (req, res) => {
  const callerId = req.uid;
  const targetId = req.params.uid;
  if (callerId === targetId) return res.status(400).json({ error: 'Cannot block yourself' });
  try {
    const ref = db.collection('users').doc(callerId);
    const doc = await ref.get();
    const blocked = doc.data()?.blockedUsers || [];
    const isBlocked = blocked.includes(targetId);
    if (isBlocked) {
      await ref.update({ blockedUsers: admin.firestore.FieldValue.arrayRemove(targetId) });
      res.json({ blocked: false });
    } else {
      await ref.update({ blockedUsers: admin.firestore.FieldValue.arrayUnion(targetId) });
      // Also remove from following both directions
      await ref.update({ following: admin.firestore.FieldValue.arrayRemove(targetId) });
      await db.collection('users').doc(targetId).update({ following: admin.firestore.FieldValue.arrayRemove(callerId) });
      res.json({ blocked: true });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:uid/mute', verifyToken, async (req, res) => {
  const callerId = req.uid;
  const targetId = req.params.uid;
  if (callerId === targetId) return res.status(400).json({ error: 'Cannot mute yourself' });
  try {
    const ref = db.collection('users').doc(callerId);
    const doc = await ref.get();
    const muted = doc.data()?.mutedUsers || [];
    const isMuted = muted.includes(targetId);
    if (isMuted) {
      await ref.update({ mutedUsers: admin.firestore.FieldValue.arrayRemove(targetId) });
      res.json({ muted: false });
    } else {
      await ref.update({ mutedUsers: admin.firestore.FieldValue.arrayUnion(targetId) });
      res.json({ muted: true });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:uid/block-mute-list', verifyToken, async (req, res) => {
  if (req.uid !== req.params.uid) return res.status(403).json({ error: 'Forbidden' });
  try {
    const doc = await db.collection('users').doc(req.params.uid).get();
    const data = doc.data() || {};
    res.json({ blockedUsers: data.blockedUsers || [], mutedUsers: data.mutedUsers || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// STORIES (24-HOUR POSTS)
// ════════════════════════════════════════════════════════════════════════════

app.post('/api/stories', verifyToken, async (req, res) => {
  const { imageUrl, caption } = req.body;
  if (!imageUrl) return res.status(400).json({ error: 'imageUrl required' });
  try {
    const userDoc = await db.collection('users').doc(req.uid).get();
    const userData = userDoc.data() || {};
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const storyRef = await db.collection('stories').add({
      userId: req.uid,
      user: {
        id: req.uid,
        name: userData.displayName || 'User',
        username: userData.username || userData.email?.split('@')[0] || 'user',
        avatar: userData.avatar || '',
      },
      imageUrl,
      caption: caption || '',
      createdAt: new Date().toISOString(),
      expiresAt,
      views: [],
    });
    res.status(201).json({ id: storyRef.id, expiresAt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/stories', verifyToken, async (req, res) => {
  try {
    const now = new Date().toISOString();
    const snap = await db.collection('stories').where('expiresAt', '>', now).orderBy('expiresAt').get();
    // Group by userId
    const grouped = {};
    snap.forEach(doc => {
      const data = { id: doc.id, ...doc.data() };
      const uid = data.userId;
      if (!grouped[uid]) grouped[uid] = { user: data.user, stories: [] };
      grouped[uid].stories.push(data);
    });
    res.json({ storyGroups: Object.values(grouped) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/stories/:id/view', verifyToken, async (req, res) => {
  try {
    await db.collection('stories').doc(req.params.id).update({
      views: admin.firestore.FieldValue.arrayUnion(req.uid),
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// BODY STATS TRACKER
// ════════════════════════════════════════════════════════════════════════════

app.post('/api/users/:uid/body-stats', verifyToken, verifyOwner, async (req, res) => {
  const { weight, bodyFat, waist, chest, arms, hips, date } = req.body;
  try {
    const ref = await db.collection('users').doc(req.params.uid).collection('bodyStats').add({
      weight: weight || null,
      bodyFat: bodyFat || null,
      waist: waist || null,
      chest: chest || null,
      arms: arms || null,
      hips: hips || null,
      date: date || new Date().toISOString().split('T')[0],
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:uid/body-stats', verifyToken, verifyOwner, async (req, res) => {
  try {
    let snap;
    try {
      snap = await db.collection('users').doc(req.params.uid)
        .collection('bodyStats').orderBy('date', 'asc').get();
    } catch {
      // orderBy may fail if Firestore index isn't ready yet — fall back to unordered
      snap = await db.collection('users').doc(req.params.uid)
        .collection('bodyStats').get();
    }
    const stats = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
    res.json({ stats });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// GOALS
// ════════════════════════════════════════════════════════════════════════════

app.post('/api/users/:uid/goals', verifyToken, verifyOwner, async (req, res) => {
  const { title, targetValue, unit, deadline, category } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const ref = await db.collection('users').doc(req.params.uid).collection('goals').add({
      title,
      targetValue: targetValue || null,
      unit: unit || '',
      deadline: deadline || null,
      category: category || 'general',
      currentValue: 0,
      checkIns: [],
      completed: false,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:uid/goals', verifyToken, verifyOwner, async (req, res) => {
  try {
    let snap;
    try {
      snap = await db.collection('users').doc(req.params.uid)
        .collection('goals').orderBy('createdAt', 'desc').get();
    } catch {
      snap = await db.collection('users').doc(req.params.uid)
        .collection('goals').get();
    }
    const goals = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ goals });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:uid/goals/:goalId/checkin', verifyToken, verifyOwner, async (req, res) => {
  const { value, note } = req.body;
  if (value === undefined) return res.status(400).json({ error: 'value required' });
  try {
    const goalRef = db.collection('users').doc(req.params.uid).collection('goals').doc(req.params.goalId);
    const goalDoc = await goalRef.get();
    if (!goalDoc.exists) return res.status(404).json({ error: 'Goal not found' });
    const goal = goalDoc.data();
    const checkIn = { value, note: note || '', date: new Date().toISOString() };
    const newCheckIns = [...(goal.checkIns || []), checkIn];
    const completed = goal.targetValue ? value >= goal.targetValue : false;
    await goalRef.update({ currentValue: value, checkIns: newCheckIns, completed });
    res.json({ currentValue: value, completed });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:uid/goals/:goalId', verifyToken, verifyOwner, async (req, res) => {
  try {
    await db.collection('users').doc(req.params.uid).collection('goals').doc(req.params.goalId).delete();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ════════════════════════════════════════════════════════════════════════════
// WORKOUT PROGRAMS
// ════════════════════════════════════════════════════════════════════════════

app.post('/api/programs', verifyToken, async (req, res) => {
  const { name, description, weeks, isPublic } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const userDoc = await db.collection('users').doc(req.uid).get();
    const userData = userDoc.data() || {};
    const ref = await db.collection('programs').add({
      name,
      description: description || '',
      weeks: weeks || [],
      isPublic: isPublic !== false,
      authorId: req.uid,
      author: {
        id: req.uid,
        name: userData.displayName || 'User',
        username: userData.username || userData.email?.split('@')[0] || 'user',
        avatar: userData.avatar || '',
      },
      saves: 0,
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/programs', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('programs').where('isPublic', '==', true).get();
    const programs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
      .slice(0, 20);
    res.json({ programs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/programs/mine', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('programs').where('authorId', '==', req.uid).get();
    const programs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json({ programs });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/programs/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('programs').doc(req.params.id).get();
    if (!doc.exists || doc.data().authorId !== req.uid) return res.status(403).json({ error: 'Forbidden' });
    const { name, description, weeks, isPublic } = req.body;
    await db.collection('programs').doc(req.params.id).update({ name, description, weeks, isPublic });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/programs/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('programs').doc(req.params.id).get();
    if (!doc.exists || doc.data().authorId !== req.uid) return res.status(403).json({ error: 'Forbidden' });
    await db.collection('programs').doc(req.params.id).delete();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

const PORT = process.env.PORT || 5000;



// ─── Progress Photos ──────────────────────────────────────────────────────────
app.get('/api/users/:uid/progress-photos', verifyToken, async (req, res) => {
  if (req.uid !== req.params.uid) return res.status(403).json({ error: 'Forbidden' });
  try {
    const snap = await db.collection('progressPhotos').where('userId', '==', req.params.uid).get();
    const photos = snap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    res.json({ photos });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:uid/progress-photos', verifyToken, async (req, res) => {
  if (req.uid !== req.params.uid) return res.status(403).json({ error: 'Forbidden' });
  const { photo, date, note } = req.body;
  if (!photo) return res.status(400).json({ error: 'photo required' });
  try {
    let url = photo;
    // Upload to Firebase Storage if it's base64
    if (photo.startsWith('data:image')) {
      const matches = photo.match(/^data:(image\/\w+);base64,(.+)$/);
      if (matches) {
        const mimeType = matches[1];
        const base64Data = matches[2];
        const buf = Buffer.from(base64Data, 'base64');
        const ext = mimeType.split('/')[1] || 'jpg';
        const filename = `progress-photos/${req.params.uid}/${Date.now()}.${ext}`;
        const file = bucket.file(filename);
        await file.save(buf, { metadata: { contentType: mimeType } });
        await file.makePublic();
        url = `https://firebasestorage.googleapis.com/v0/b/${bucket.name}/o/${encodeURIComponent(filename)}?alt=media`;
      }
    }
    const ref = await db.collection('progressPhotos').add({
      userId: req.params.uid, url, date: date || new Date().toISOString().split('T')[0],
      note: note || '', createdAt: new Date().toISOString(),
    });
    res.status(201).json({ photo: { id: ref.id, url, date, note } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:uid/progress-photos/:photoId', verifyToken, async (req, res) => {
  if (req.uid !== req.params.uid) return res.status(403).json({ error: 'Forbidden' });
  try {
    await db.collection('progressPhotos').doc(req.params.photoId).delete();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Active program ───────────────────────────────────────────────────────────
app.patch('/api/users/:uid/active-program', verifyToken, async (req, res) => {
  const { uid } = req.params;
  if (req.uid !== uid) return res.status(403).json({ error: 'Forbidden' });
  const { programId, programName, currentWeek, currentDay } = req.body;
  try {
    await db.collection('users').doc(uid).update({
      activeProgram: programId ? { programId, programName, currentWeek: currentWeek || 0, currentDay: currentDay || 0, startedAt: new Date().toISOString() } : null,
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/users/:uid/active-program/progress', verifyToken, async (req, res) => {
  const { uid } = req.params;
  if (req.uid !== uid) return res.status(403).json({ error: 'Forbidden' });
  const { currentWeek, currentDay } = req.body;
  try {
    const snap = await db.collection('users').doc(uid).get();
    const ap = snap.data()?.activeProgram;
    if (!ap) return res.status(404).json({ error: 'No active program' });
    await db.collection('users').doc(uid).update({
      'activeProgram.currentWeek': currentWeek,
      'activeProgram.currentDay':  currentDay,
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Google OAuth upsert ──────────────────────────────────────────────────────
app.post('/api/google-auth', verifyToken, async (req, res) => {
  try {
    const { displayName, email, avatar } = req.body;
    const uid = req.uid;
    const userRef  = db.collection('users').doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      // New Google user — create profile
      const username = (email || '').split('@')[0].replace(/[^a-z0-9_]/gi, '').toLowerCase() || 'user' + Date.now();
      // Ensure username is unique
      const taken = await db.collection('users').where('username', '==', username).get();
      const finalUsername = taken.empty ? username : username + Math.floor(Math.random() * 9000 + 1000);
      await userRef.set({
        displayName: displayName || email?.split('@')[0] || 'User',
        email:       email || '',
        avatar:      avatar || '',
        username:    finalUsername,
        accountType: 'user',
        bio:         '',
        fitnessGoal: '',
        fitnessLevel:'Beginner',
        gym:         '',
        followers:   0,
        following:   0,
        workouts:    0,
        isPrivate:   false,
        emailVerified: true,
        createdAt:   new Date().toISOString(),
      });
    }

    const snap    = await userRef.get();
    const profile = snap.data() || {};

    // Issue a fresh custom token via Firebase Admin
    const customToken = await admin.auth().createCustomToken(uid);

    // Exchange custom token for idToken using REST API
    const exchRes = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=${FIREBASE_WEB_API_KEY}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: customToken, returnSecureToken: true }) }
    );
    const exchData = await exchRes.json();

    res.json({
      uid,
      displayName:  profile.displayName,
      email:        profile.email,
      avatar:       profile.avatar,
      username:     profile.username,
      accountType:  profile.accountType || 'user',
      bio:          profile.bio || '',
      fitnessGoal:  profile.fitnessGoal || '',
      fitnessLevel: profile.fitnessLevel || 'Beginner',
      gym:          profile.gym || '',
      followers:    profile.followers || 0,
      following:    profile.following || 0,
      workouts:     profile.workouts  || 0,
      idToken:      exchData.idToken      || '',
      refreshToken: exchData.refreshToken || '',
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});



// ═══════════════════════════════════════════════════════════════════════════════
// EXERCISE LIBRARY
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/exercises — browse/search public exercises
app.get('/api/exercises', async (req, res) => {
  try {
    const { q, category, difficulty } = req.query;
    let query = db.collection('exercises');
    if (category)   query = query.where('category', '==', category);
    if (difficulty) query = query.where('difficulty', '==', difficulty);
    const snap = await query.orderBy('createdAt', 'desc').limit(50).get();
    let exercises = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    // Text search client-side (Firestore free tier has no full-text)
    if (q) {
      const ql = q.toLowerCase();
      exercises = exercises.filter(ex =>
        ex.name?.toLowerCase().includes(ql) ||
        ex.primaryMuscles?.some(m => m.toLowerCase().includes(ql)) ||
        ex.equipment?.some(e => e.toLowerCase().includes(ql))
      );
    }
    res.json({ exercises });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/exercises/mine — trainer's own entries
app.get('/api/exercises/mine', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('exercises').where('authorId', '==', req.uid).orderBy('createdAt', 'desc').get();
    res.json({ exercises: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/exercises/:id — single entry
app.get('/api/exercises/:id', async (req, res) => {
  try {
    const doc = await db.collection('exercises').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    res.json({ exercise: { id: doc.id, ...doc.data() } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/exercises — trainer publishes a new exercise guide
app.post('/api/exercises', verifyToken, async (req, res) => {
  try {
    const authorSnap = await db.collection('users').doc(req.uid).get();
    const author = authorSnap.exists ? authorSnap.data() : {};
    if (author.accountType !== 'trainer') return res.status(403).json({ error: 'Trainer accounts only' });

    const { name, category, difficulty, equipment, primaryMuscles, secondaryMuscles,
            photos, videoUrl, steps, mistakes, variations, trainerTip } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
    if (!steps?.filter(s => s?.trim()).length) return res.status(400).json({ error: 'At least one step required' });

    const exercise = {
      name:            sanitize(name, 100),
      category:        category   || 'Strength',
      difficulty:      difficulty || 'intermediate',
      equipment:       Array.isArray(equipment) ? equipment.slice(0, 10) : [],
      primaryMuscles:  Array.isArray(primaryMuscles) ? primaryMuscles.slice(0, 8) : [],
      secondaryMuscles:Array.isArray(secondaryMuscles) ? secondaryMuscles.slice(0, 8) : [],
      photos:          Array.isArray(photos) ? photos.slice(0, 4) : [],
      videoUrl:        videoUrl || null,
      steps:           (steps || []).filter(s => s?.trim()).slice(0, 12).map(s => sanitize(s, 300)),
      mistakes:        (mistakes || []).filter(s => s?.trim()).slice(0, 8).map(s => sanitize(s, 300)),
      variations:      (variations || []).slice(0, 6).map(v => ({ name: sanitize(v.name || '', 100), type: v.type === 'easier' ? 'easier' : 'harder' })),
      trainerTip:      sanitize(trainerTip || '', 400),
      authorId:        req.uid,
      authorName:      author.displayName || author.name || 'Trainer',
      authorAvatar:    author.avatar || null,
      authorVerified:  !!(author.verified),
      saves:           0,
      savedBy:         [],
      viewCount:       0,
      createdAt:       new Date().toISOString(),
      updatedAt:       new Date().toISOString(),
    };
    const ref = await db.collection('exercises').add(exercise);
    res.status(201).json({ exercise: { id: ref.id, ...exercise } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/exercises/:id — update (author only)
app.patch('/api/exercises/:id', verifyToken, async (req, res) => {
  try {
    const ref = db.collection('exercises').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    if (doc.data().authorId !== req.uid) return res.status(403).json({ error: 'Not your exercise' });
    const { name, category, difficulty, equipment, primaryMuscles, secondaryMuscles,
            photos, videoUrl, steps, mistakes, variations, trainerTip } = req.body;
    const update = {
      ...(name      && { name: sanitize(name, 100) }),
      ...(category  && { category }),
      ...(difficulty && { difficulty }),
      ...(equipment  && { equipment: Array.isArray(equipment) ? equipment.slice(0, 10) : [] }),
      ...(primaryMuscles   && { primaryMuscles:   primaryMuscles.slice(0, 8) }),
      ...(secondaryMuscles && { secondaryMuscles: secondaryMuscles.slice(0, 8) }),
      ...(photos     && { photos: photos.slice(0, 4) }),
      ...(videoUrl   !== undefined && { videoUrl: videoUrl || null }),
      ...(steps      && { steps: steps.filter(s => s?.trim()).slice(0, 12).map(s => sanitize(s, 300)) }),
      ...(mistakes   && { mistakes: mistakes.filter(s => s?.trim()).slice(0, 8).map(s => sanitize(s, 300)) }),
      ...(variations && { variations: variations.slice(0, 6).map(v => ({ name: sanitize(v.name || '', 100), type: v.type === 'easier' ? 'easier' : 'harder' })) }),
      ...(trainerTip !== undefined && { trainerTip: sanitize(trainerTip, 400) }),
      updatedAt: new Date().toISOString(),
    };
    await ref.update(update);
    const updated = await ref.get();
    res.json({ exercise: { id: updated.id, ...updated.data() } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/exercises/:id — author or admin
app.delete('/api/exercises/:id', verifyToken, async (req, res) => {
  try {
    const ref = db.collection('exercises').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const callerSnap = await db.collection('users').doc(req.uid).get();
    const caller = callerSnap.exists ? callerSnap.data() : {};
    if (doc.data().authorId !== req.uid && caller.accountType !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await ref.delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/exercises/:id/save — toggle save
app.post('/api/exercises/:id/save', verifyToken, async (req, res) => {
  try {
    const ref = db.collection('exercises').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const savedBy = doc.data().savedBy || [];
    const saved = savedBy.includes(req.uid);
    await ref.update({
      savedBy: saved
        ? admin.firestore.FieldValue.arrayRemove(req.uid)
        : admin.firestore.FieldValue.arrayUnion(req.uid),
      saves: admin.firestore.FieldValue.increment(saved ? -1 : 1),
    });
    res.json({ saved: !saved });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// TRAINER GYM OWNERSHIP
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/trainer/my-gym — fetch the gym this trainer owns (if any)
app.get('/api/trainer/my-gym', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('gyms').where('ownerId', '==', req.uid).limit(1).get();
    if (snap.empty) return res.json({ gym: null });
    const doc = snap.docs[0];
    res.json({ gym: { id: doc.id, ...doc.data() } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/trainer/my-gym — create or update the trainer's gym listing
app.post('/api/trainer/my-gym', verifyToken, async (req, res) => {
  try {
    const callerSnap = await db.collection('users').doc(req.uid).get();
    const caller = callerSnap.exists ? callerSnap.data() : {};
    if (caller.accountType !== 'trainer') return res.status(403).json({ error: 'Trainer account required' });

    const {
      name, address, city, postcode, phone, website, instagram,
      description, openHours, openingHours, monthlyFee, dayPass, amenities, coverPhoto,
    } = req.body;
    if (!name || !address || !city) return res.status(400).json({ error: 'name, address and city are required' });

    const gymData = {
      name: sanitize(name, 100),
      address: sanitize(address, 200),
      city: sanitize(city, 80),
      postcode: sanitize(postcode || '', 20),
      phone: sanitize(phone || '', 30),
      website: sanitize(website || '', 200),
      instagram: sanitize(instagram || '', 80),
      description: sanitize(description || '', 500),
      openHours: sanitize(openHours || openingHours || '', 200),
      monthlyFee: monthlyFee != null ? Number(monthlyFee) : null,
      dayPass: dayPass != null ? Number(dayPass) : null,
      amenities: Array.isArray(amenities) ? amenities.slice(0, 20) : [],
      coverPhoto: coverPhoto || null,
      ownerId: req.uid,
      ownerName: caller.displayName || caller.name || 'Trainer',
      ownerAvatar: caller.avatar || null,
      ownerVerified: !!(caller.verified),
      updatedAt: new Date().toISOString(),
    };

    // Check if gym already exists for this trainer
    const existing = await db.collection('gyms').where('ownerId', '==', req.uid).limit(1).get();
    let gymId;
    if (!existing.empty) {
      gymId = existing.docs[0].id;
      await db.collection('gyms').doc(gymId).update(gymData);
    } else {
      gymData.createdAt = new Date().toISOString();
      gymData.rating = 0;
      gymData.reviewCount = 0;
      gymData.memberCount = 0;
      const ref = await db.collection('gyms').add(gymData);
      gymId = ref.id;
    }
    res.json({ gym: { id: gymId, ...gymData } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GYMS DIRECTORY
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/gyms — list all gyms
app.get('/api/gyms', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('gyms').get();
    const gyms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    gyms.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    res.json(gyms);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/gyms — admin only, create a gym
app.post('/api/gyms', verifyToken, async (req, res) => {
  try {
    const callerSnap = await db.collection('users').doc(req.uid).get();
    const caller = callerSnap.exists ? callerSnap.data() : {};
    if (caller.accountType !== 'admin') return res.status(403).json({ error: 'Admin only' });

    const { name, address, city, country, description, lat, lng, photo } = req.body;
    if (!name || !address || !city || !country) {
      return res.status(400).json({ error: 'name, address, city, country required' });
    }
    const ref = db.collection('gyms').doc();
    const gym = {
      name: name.trim(),
      address: address.trim(),
      city: city.trim(),
      country: country.trim(),
      description: (description || '').trim(),
      lat: lat || null,
      lng: lng || null,
      photo: photo || null,
      createdBy: req.uid,
      createdAt: new Date().toISOString(),
    };
    await ref.set(gym);
    res.json({ id: ref.id, ...gym });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/gyms/:id — single gym
app.get('/api/gyms/:id', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('gyms').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Gym not found' });
    res.json({ id: snap.id, ...snap.data() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/gyms/:id/members — users who have checked into this gym
app.get('/api/gyms/:id/members', verifyToken, async (req, res) => {
  try {
    const gymSnap = await db.collection('gyms').doc(req.params.id).get();
    if (!gymSnap.exists) return res.status(404).json({ error: 'Gym not found' });
    const gymName = gymSnap.data().name;

    const usersSnap = await db.collection('users')
      .where('gym', '==', gymName).get();
    const members = usersSnap.docs.map(d => ({
      id: d.id,
      displayName: d.data().displayName || 'Athlete',
      username: d.data().username || '',
      avatar: d.data().avatar || null,
      fitnessLevel: d.data().fitnessLevel || '',
    }));
    res.json(members);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GYM BRANCHES ────────────────────────────────────────────────────────────
// GET /api/gyms/:id/branches
app.get('/api/gyms/:id/branches', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('gyms').doc(req.params.id).collection('branches').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/gyms/:id/branches
app.post('/api/gyms/:id/branches', verifyToken, async (req, res) => {
  try {
    const ref = db.collection('gyms').doc(req.params.id).collection('branches').doc();
    const branch = { ...req.body, createdAt: new Date().toISOString() };
    await ref.set(branch);
    res.json({ id: ref.id, ...branch });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/gyms/:id/branches/:branchId
app.delete('/api/gyms/:id/branches/:branchId', verifyToken, async (req, res) => {
  try {
    await db.collection('gyms').doc(req.params.id).collection('branches').doc(req.params.branchId).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GYM CONTRACTS ───────────────────────────────────────────────────────────
// GET /api/gyms/:id/contracts
app.get('/api/gyms/:id/contracts', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('gyms').doc(req.params.id).collection('contracts').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/gyms/:id/contracts
app.post('/api/gyms/:id/contracts', verifyToken, async (req, res) => {
  try {
    const ref = db.collection('gyms').doc(req.params.id).collection('contracts').doc();
    const contract = { ...req.body, createdAt: new Date().toISOString() };
    await ref.set(contract);
    res.json({ id: ref.id, ...contract });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PUT /api/gyms/:id/contracts/:contractId
app.put('/api/gyms/:id/contracts/:contractId', verifyToken, async (req, res) => {
  try {
    const ref = db.collection('gyms').doc(req.params.id).collection('contracts').doc(req.params.contractId);
    await ref.update({ ...req.body, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/gyms/:id/contracts/:contractId
app.delete('/api/gyms/:id/contracts/:contractId', verifyToken, async (req, res) => {
  try {
    await db.collection('gyms').doc(req.params.id).collection('contracts').doc(req.params.contractId).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── BUDDY MATCHING ───────────────────────────────────────────────────────────
// GET /api/users/:uid/buddy-matches — find users with similar fitness profile
app.get('/api/users/:uid/buddy-matches', verifyToken, async (req, res) => {
  try {
    const userSnap = await db.collection('users').doc(req.params.uid).get();
    if (!userSnap.exists) return res.status(404).json({ error: 'User not found' });
    const user = userSnap.data();
    const allSnap = await db.collection('users').limit(200).get();
    const matches = allSnap.docs
      .filter(d => d.id !== req.params.uid)
      .map(d => {
        const other = d.data();
        let score = 0;
        if (user.fitnessLevel && other.fitnessLevel === user.fitnessLevel) score += 3;
        if (user.gym && other.gym === user.gym) score += 2;
        if (Array.isArray(user.goals) && Array.isArray(other.goals)) {
          score += user.goals.filter(g => other.goals.includes(g)).length;
        }
        return { id: d.id, displayName: other.displayName, username: other.username, avatar: other.avatar || null, fitnessLevel: other.fitnessLevel, gym: other.gym, score };
      })
      .filter(m => m.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 20);
    res.json(matches);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users/:uid/buddy-action — send/accept/reject buddy request
app.post('/api/users/:uid/buddy-action', verifyToken, async (req, res) => {
  try {
    const { action, targetUid } = req.body; // action: 'request'|'accept'|'reject'|'remove'
    if (!action || !targetUid) return res.status(400).json({ error: 'action and targetUid required' });
    const ref = db.collection('buddyRequests').doc(`${req.params.uid}_${targetUid}`);
    if (action === 'request') {
      await ref.set({ from: req.params.uid, to: targetUid, status: 'pending', createdAt: new Date().toISOString() });
    } else if (action === 'accept') {
      await ref.update({ status: 'accepted', updatedAt: new Date().toISOString() });
    } else if (action === 'reject') {
      await ref.update({ status: 'rejected', updatedAt: new Date().toISOString() });
    } else if (action === 'remove') {
      await ref.delete();
    } else {
      return res.status(400).json({ error: 'Unknown action' });
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// COMMUNITY MEALS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/meals — list community meals (optional ?category=)
app.get('/api/meals', verifyToken, async (req, res) => {
  try {
    const { category } = req.query;
    let query = db.collection('meals');
    const snap = await query.get();
    let meals = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    if (category && category !== 'all') {
      meals = meals.filter(m => m.category === category);
    }
    meals.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
    // attach save flag for requester
    const savedSnap = await db.collection('mealSaves')
      .where('uid', '==', req.uid).get();
    const savedIds = new Set(savedSnap.docs.map(d => d.data().mealId));
    meals = meals.map(m => ({ ...m, saved: savedIds.has(m.id) }));
    res.json(meals);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/meals — trainers/admins post a meal
app.post('/api/meals', verifyToken, async (req, res) => {
  try {
    const callerSnap = await db.collection('users').doc(req.uid).get();
    const caller = callerSnap.exists ? callerSnap.data() : {};
    if (!['trainer', 'admin'].includes(caller.accountType)) {
      return res.status(403).json({ error: 'Trainers and admins only' });
    }
    const { name, description, category, calories, protein, carbs, fat, ingredients, instructions, photo } = req.body;
    if (!name || !category) return res.status(400).json({ error: 'name and category required' });
    const ref = db.collection('meals').doc();
    const meal = {
      name: (name || '').trim(),
      description: (description || '').trim(),
      category: category || 'other',
      calories: Number(calories) || 0,
      protein: Number(protein) || 0,
      carbs: Number(carbs) || 0,
      fat: Number(fat) || 0,
      ingredients: ingredients || [],
      instructions: (instructions || '').trim(),
      photo: photo || null,
      authorId: req.uid,
      authorName: caller.displayName || 'Trainer',
      authorAvatar: caller.avatar || null,
      saves: 0,
      createdAt: new Date().toISOString(),
    };
    await ref.set(meal);
    res.json({ id: ref.id, ...meal });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/meals/:id/save — toggle save/unsave a meal
app.post('/api/meals/:id/save', verifyToken, async (req, res) => {
  try {
    const mealId = req.params.id;
    const uid = req.uid;
    const saveDocId = `${uid}_${mealId}`;
    const saveRef = db.collection('mealSaves').doc(saveDocId);
    const mealRef = db.collection('meals').doc(mealId);

    const saveSnap = await saveRef.get();
    if (saveSnap.exists) {
      await saveRef.delete();
      await mealRef.update({ saves: admin.firestore.FieldValue.increment(-1) });
      res.json({ saved: false });
    } else {
      await saveRef.set({ uid, mealId, savedAt: new Date().toISOString() });
      await mealRef.update({ saves: admin.firestore.FieldValue.increment(1) }).catch(() => {});
      res.json({ saved: true });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/meals/saved — get meals saved by the current user
app.get('/api/meals/saved', verifyToken, async (req, res) => {
  try {
    const savedSnap = await db.collection('mealSaves')
      .where('uid', '==', req.uid).get();
    const mealIds = savedSnap.docs.map(d => d.data().mealId);
    if (mealIds.length === 0) return res.json([]);
    const meals = [];
    for (const mid of mealIds) {
      const snap = await db.collection('meals').doc(mid).get();
      if (snap.exists) meals.push({ id: snap.id, ...snap.data(), saved: true });
    }
    res.json(meals);
  } catch (e) { res.status(500).json({ error: e.message }); }
});



// ─── LIVE STREAMING ───────────────────────────────────────────────────────────
// In-memory SSE clients for live stream reactions/presence
const liveStreamClients = {}; // streamId -> Set of { res, uid }

function broadcastToStream(streamId, data) {
  const clients = liveStreamClients[streamId];
  if (!clients) return;
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(client => {
    try { client.res.write(payload); } catch {}
  });
}

// GET /api/livestreams — all active streams
app.get('/api/livestreams', async (req, res) => {
  try {
    const snap = await db.collection('livestreams').where('status', '==', 'live').orderBy('startedAt', 'desc').get();
    res.json({ streams: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/livestreams — trainer starts a live stream
app.post('/api/livestreams', verifyToken, async (req, res) => {
  const { title, description, category } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });
  try {
    const uSnap = await db.collection('users').doc(req.uid).get();
    if (!uSnap.exists) return res.status(404).json({ error: 'User not found' });
    const u = uSnap.data();
    // End any existing live stream by this trainer
    const existing = await db.collection('livestreams').where('trainerId', '==', req.uid).where('status', '==', 'live').get();
    for (const doc of existing.docs) await doc.ref.update({ status: 'ended', endedAt: new Date().toISOString() });

    const ref = await db.collection('livestreams').add({
      title: sanitize(title, 100),
      description: sanitize(description || '', 300),
      category: String(category || 'workout'),
      trainerId: req.uid,
      trainerName: u.displayName || u.name || 'Trainer',
      trainerAvatar: u.avatar || '',
      trainerVerified: !!(u.verified),
      status: 'live',
      viewerCount: 0,
      reactions: {},
      startedAt: new Date().toISOString(),
      endedAt: null,
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/livestreams/:id — stream details
app.get('/api/livestreams/:id', async (req, res) => {
  try {
    const doc = await db.collection('livestreams').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Stream not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/livestreams/:id/end — trainer ends stream, auto-saves clip
app.post('/api/livestreams/:id/end', verifyToken, async (req, res) => {
  try {
    const ref = db.collection('livestreams').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Stream not found' });
    if (doc.data().trainerId !== req.uid) return res.status(403).json({ error: 'Forbidden' });
    const now = new Date().toISOString();
    await ref.update({ status: 'ended', endedAt: now });
    // Auto-save to clips
    const d = doc.data();
    await db.collection('clips').add({
      userId: req.uid,
      title: `[Live Replay] ${d.title}`,
      description: d.description || '',
      category: d.category,
      peakViewers: d.viewerCount || 0,
      totalReactions: Object.values(d.reactions || {}).reduce((a, v) => a + v, 0),
      isLiveReplay: true,
      streamId: req.params.id,
      createdAt: now,
    });
    broadcastToStream(req.params.id, { type: 'stream_ended' });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/livestreams/:id/react — viewer sends emoji reaction
app.post('/api/livestreams/:id/react', verifyToken, async (req, res) => {
  const { emoji } = req.body;
  if (!emoji) return res.status(400).json({ error: 'emoji required' });
  try {
    const ref = db.collection('livestreams').doc(req.params.id);
    await ref.update({ [`reactions.${emoji}`]: admin.firestore.FieldValue.increment(1) });
    const uSnap = await db.collection('users').doc(req.uid).get();
    const uName = uSnap.exists ? (uSnap.data().displayName || 'Someone') : 'Someone';
    broadcastToStream(req.params.id, { type: 'reaction', emoji, userId: req.uid, userName: uName });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/livestreams/:id/join
app.post('/api/livestreams/:id/join', verifyToken, async (req, res) => {
  try {
    await db.collection('livestreams').doc(req.params.id).update({
      viewerCount: admin.firestore.FieldValue.increment(1),
    });
    const doc = await db.collection('livestreams').doc(req.params.id).get();
    broadcastToStream(req.params.id, { type: 'viewer_count', count: doc.data().viewerCount || 0 });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/livestreams/:id/leave
app.post('/api/livestreams/:id/leave', verifyToken, async (req, res) => {
  try {
    const ref = db.collection('livestreams').doc(req.params.id);
    const doc = await ref.get();
    const current = doc.exists ? (doc.data().viewerCount || 0) : 0;
    if (current > 0) {
      await ref.update({ viewerCount: admin.firestore.FieldValue.increment(-1) });
      const updated = await ref.get();
      broadcastToStream(req.params.id, { type: 'viewer_count', count: updated.data().viewerCount || 0 });
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/livestreams/:id/sse — SSE for reactions and viewer count
app.get('/api/livestreams/:id/sse', (req, res) => {
  const streamId = req.params.id;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();
  res.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

  const clientObj = { res, uid: req.query.uid || 'anon' };
  if (!liveStreamClients[streamId]) liveStreamClients[streamId] = new Set();
  liveStreamClients[streamId].add(clientObj);

  const keepAlive = setInterval(() => { try { res.write(': ping\n\n'); } catch {} }, 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    if (liveStreamClients[streamId]) {
      liveStreamClients[streamId].delete(clientObj);
      if (liveStreamClients[streamId].size === 0) delete liveStreamClients[streamId];
    }
  });
});


// ─── WEARABLE / HEALTH INTEGRATIONS ──────────────────────────────────────────

// GET /api/users/:uid/integrations — list connected services
app.get('/api/users/:uid/integrations', verifyToken, verifyOwner, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.params.uid).collection('healthIntegrations').get();
    const integrations = snap.docs.map(d => ({
      service: d.id,
      connected: true,
      connectedAt: d.data().connectedAt,
      lastSync: d.data().lastSync || null,
      scopes: d.data().scopes || [],
    }));
    res.json({ integrations });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users/:uid/integrations — connect a service (stores auth token placeholder)
app.post('/api/users/:uid/integrations', verifyToken, verifyOwner, async (req, res) => {
  const { service, accessToken, refreshToken, scopes } = req.body;
  if (!service) return res.status(400).json({ error: 'service required' });
  const allowed = ['fitbit', 'garmin', 'google_fit', 'apple_health', 'samsung_health', 'polar', 'whoop'];
  if (!allowed.includes(service)) return res.status(400).json({ error: 'Unknown service' });
  try {
    await db.collection('users').doc(req.params.uid).collection('healthIntegrations').doc(service).set({
      service,
      accessToken: accessToken || 'demo_token',
      refreshToken: refreshToken || '',
      scopes: scopes || ['activity', 'heartrate', 'sleep', 'nutrition'],
      connectedAt: new Date().toISOString(),
      lastSync: null,
    }, { merge: true });
    res.json({ success: true, service });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/users/:uid/integrations/:service — disconnect
app.delete('/api/users/:uid/integrations/:service', verifyToken, verifyOwner, async (req, res) => {
  try {
    await db.collection('users').doc(req.params.uid).collection('healthIntegrations').doc(req.params.service).delete();
    // Also clear synced data for this service
    const dataSnap = await db.collection('users').doc(req.params.uid).collection('healthData')
      .where('source', '==', req.params.service).get();
    const batch = db.batch();
    dataSnap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users/:uid/integrations/:service/sync — simulate a data sync
app.post('/api/users/:uid/integrations/:service/sync', verifyToken, verifyOwner, async (req, res) => {
  const uid = req.params.uid;
  const service = req.params.service;
  try {
    const intRef = db.collection('users').doc(uid).collection('healthIntegrations').doc(service);
    const intDoc = await intRef.get();
    if (!intDoc.exists) return res.status(404).json({ error: 'Service not connected' });

    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    // Store simulated health data (real implementation would call service API)
    const { data } = req.body; // Client can send real data from native layer
    if (data && Array.isArray(data)) {
      const batch = db.batch();
      for (const entry of data.slice(0, 50)) {
        const ref = db.collection('users').doc(uid).collection('healthData').doc();
        batch.set(ref, { ...entry, source: service, syncedAt: now.toISOString() });
      }
      await batch.commit();
    }
    await intRef.update({ lastSync: now.toISOString() });
    res.json({ success: true, syncedAt: now.toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users/:uid/integrations/health-data — get synced data
app.get('/api/users/:uid/integrations/health-data', verifyToken, verifyOwner, async (req, res) => {
  try {
    const { type, from, to } = req.query;
    let query = db.collection('users').doc(req.params.uid).collection('healthData');
    if (type) query = query.where('type', '==', type);
    const snap = await query.orderBy('date', 'desc').limit(100).get();
    res.json({ data: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users/:uid/integrations/health-data — write a single health data point (from native layer)
app.post('/api/users/:uid/integrations/health-data', verifyToken, verifyOwner, async (req, res) => {
  const { type, value, unit, date, source } = req.body;
  if (!type || value == null) return res.status(400).json({ error: 'type and value required' });
  try {
    const ref = await db.collection('users').doc(req.params.uid).collection('healthData').add({
      type, value: Number(value), unit: unit || '', date: date || new Date().toISOString().slice(0, 10),
      source: source || 'manual', syncedAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/auth/fitbit — initiate Fitbit OAuth (redirect)
app.get('/api/auth/fitbit', (req, res) => {
  const clientId = process.env.FITBIT_CLIENT_ID || 'FITBIT_CLIENT_ID_HERE';
  const redirect = encodeURIComponent(`${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/fitbit/callback`);
  const scope = 'activity+heartrate+sleep+nutrition+profile';
  res.redirect(`https://www.fitbit.com/oauth2/authorize?response_type=code&client_id=${clientId}&redirect_uri=${redirect}&scope=${scope}&expires_in=604800`);
});

// GET /api/auth/garmin — initiate Garmin OAuth
app.get('/api/auth/garmin', (req, res) => {
  res.json({ message: 'Garmin OAuth — add GARMIN_CONSUMER_KEY to env and implement OAuth 1.0a flow' });
});

// GET /api/auth/google-fit — initiate Google Fit OAuth
app.get('/api/auth/google-fit', (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID || 'GOOGLE_CLIENT_ID_HERE';
  const redirect = encodeURIComponent(`${process.env.BASE_URL || 'http://localhost:5000'}/api/auth/google-fit/callback`);
  const scope = encodeURIComponent('https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/fitness.heart_rate.read https://www.googleapis.com/auth/fitness.sleep.read');
  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?response_type=code&client_id=${clientId}&redirect_uri=${redirect}&scope=${scope}&access_type=offline`);
});


// ─── Community Pulse ──────────────────────────────────────────────────────────

// GET /api/stats/today — workouts logged since midnight today
app.get('/api/stats/today', async (req, res) => {
  try {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const snap = await db.collection('workouts')
      .where('createdAt', '>=', midnight.toISOString())
      .get();
    res.json({ workoutsToday: snap.size });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/activity/recent — last 30 interesting events across PRs, posts, streams
app.get('/api/activity/recent', async (req, res) => {
  try {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const events = [];

    // Recent PRs
    const prSnap = await db.collectionGroup('personalRecords')
      .where('createdAt', '>=', since)
      .orderBy('createdAt', 'desc')
      .limit(15)
      .get();
    prSnap.forEach(d => {
      const pr = d.data();
      events.push({
        id: d.id,
        type: 'pr',
        message: `${pr.username || pr.userId?.slice(0,6) || 'Someone'} hit a new ${pr.exercise} PR — ${pr.weight}kg × ${pr.reps}`,
        avatar: pr.avatar || null,
        ts: pr.createdAt,
      });
    });

    // Recent posts
    const postSnap = await db.collection('workouts')
      .where('createdAt', '>=', since)
      .orderBy('createdAt', 'desc')
      .limit(15)
      .get();
    postSnap.forEach(d => {
      const p = d.data();
      events.push({
        id: d.id,
        type: 'workout',
        message: `${p.user?.username || p.user?.name || 'Someone'} logged ${p.workoutType || 'a workout'}`,
        avatar: p.user?.avatar || null,
        ts: p.createdAt || p.timestamp,
      });
    });

    // Active live streams
    const streamSnap = await db.collection('livestreams')
      .where('status', '==', 'live')
      .limit(5)
      .get();
    streamSnap.forEach(d => {
      const s = d.data();
      events.push({
        id: d.id,
        type: 'stream',
        message: `${s.trainerName || 'A trainer'} is streaming live — ${s.title || s.category || 'Workout'}`,
        avatar: s.trainerAvatar || null,
        ts: s.startedAt,
      });
    });

    // Sort newest first, cap at 30
    events.sort((a, b) => (b.ts || '').localeCompare(a.ts || ''));
    res.json({ events: events.slice(0, 30) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// PATCH /api/users/:uid/workout-status — mark user as currently working out
app.patch('/api/users/:uid/workout-status', verifyToken, async (req, res) => {
  if (req.uid !== req.params.uid) return res.status(403).json({ error: 'Forbidden' });
  const { workingOut } = req.body;
  try {
    const update = workingOut
      ? { workingOut: true, workingOutSince: new Date().toISOString() }
      : { workingOut: false, workingOutSince: null };
    await db.collection('users').doc(req.params.uid).update(update);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.listen(PORT, () => console.log(`Flex API running on port ${PORT}`));


// ============================================================
// STORY HIGHLIGHTS
// ============================================================

app.post('/api/users/:uid/highlights', verifyToken, verifyOwner, async (req, res) => {
  const { name, coverUrl } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  try {
    const ref = await db.collection('users').doc(req.params.uid)
      .collection('highlights').add({ name, coverUrl: coverUrl || '', stories: [], createdAt: new Date().toISOString() });
    res.status(201).json({ id: ref.id, name, coverUrl: coverUrl || '', stories: [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:uid/highlights', async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.params.uid)
      .collection('highlights').orderBy('createdAt', 'asc').get();
    res.json({ highlights: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:uid/highlights/:hid/stories', verifyToken, verifyOwner, async (req, res) => {
  const { story } = req.body;
  if (!story) return res.status(400).json({ error: 'story required' });
  try {
    const ref = db.collection('users').doc(req.params.uid).collection('highlights').doc(req.params.hid);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Highlight not found' });
    const existing = doc.data().stories || [];
    if (existing.find(s => s.id === story.id)) return res.json({ ok: true, alreadyAdded: true });
    const newStories = [...existing, story];
    const update = { stories: newStories };
    if (!doc.data().coverUrl && story.imageUrl) update.coverUrl = story.imageUrl;
    await ref.update(update);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:uid/highlights/:hid/stories/:storyId', verifyToken, verifyOwner, async (req, res) => {
  try {
    const ref = db.collection('users').doc(req.params.uid).collection('highlights').doc(req.params.hid);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Highlight not found' });
    await ref.update({ stories: (doc.data().stories || []).filter(s => s.id !== req.params.storyId) });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:uid/highlights/:hid', verifyToken, verifyOwner, async (req, res) => {
  try {
    await db.collection('users').doc(req.params.uid).collection('highlights').doc(req.params.hid).delete();
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// TRAINER ANALYTICS
// ============================================================

app.get('/api/users/:uid/trainer/analytics', verifyToken, verifyOwner, async (req, res) => {
  try {
    const uid = req.params.uid;
    const bookingsSnap = await db.collection('bookings').where('trainerId', '==', uid).get();
    const bookings = bookingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    const completed = bookings.filter(b => b.status === 'completed').length;
    const cancelled = bookings.filter(b => b.status === 'cancelled').length;
    const pending   = bookings.filter(b => b.status === 'pending').length;
    const totalEarnings = bookings.filter(b => b.status === 'completed' || b.status === 'confirmed')
      .reduce((sum, b) => sum + (b.price || 0), 0);
    const clientIds = [...new Set(bookings.map(b => b.clientId).filter(Boolean))];
    const now = new Date();
    const monthlyData = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const label = d.toLocaleString('default', { month: 'short' });
      const count = bookings.filter(b => {
        if (!b.date) return false;
        const bd = new Date(b.date);
        return bd.getFullYear() === d.getFullYear() && bd.getMonth() === d.getMonth();
      }).length;
      monthlyData.push({ label, count });
    }
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.data() || {};
    res.json({
      totalBookings: bookings.length, confirmed, completed, cancelled, pending,
      totalEarnings, uniqueClients: clientIds.length,
      monthlyData, followerCount: userData.followerCount || 0, profileViews: userData.profileViews || 0,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users/:uid/view', async (req, res) => {
  const { viewerId } = req.body;
  if (viewerId === req.params.uid) return res.json({ ok: true });
  try {
    await db.collection('users').doc(req.params.uid).update({
      profileViews: admin.firestore.FieldValue.increment(1),
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// NUTRITION LOGGING
// ============================================================

app.post('/api/users/:uid/nutrition', verifyToken, verifyOwner, async (req, res) => {
  const { date, meals } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });
  try {
    await db.collection('users').doc(req.params.uid).collection('nutrition').doc(date)
      .set({ date, meals: meals || [], updatedAt: new Date().toISOString() }, { merge: true });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:uid/nutrition/:date', verifyToken, verifyOwner, async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.uid).collection('nutrition').doc(req.params.date).get();
    if (!doc.exists) return res.json({ date: req.params.date, meals: [] });
    res.json({ id: doc.id, ...doc.data() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:uid/nutrition', verifyToken, verifyOwner, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.params.uid).collection('nutrition')
      .orderBy('date', 'desc').limit(30).get();
    res.json({ logs: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// AI WORKOUT SUGGESTIONS (rule-based)
// ============================================================

app.get('/api/users/:uid/workout-suggestions', verifyToken, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.params.uid).get();
    const u = userDoc.data() || {};
    const goal      = (u.fitnessGoal  || '').toLowerCase();
    const level     = (u.fitnessLevel || 'beginner').toLowerCase();
    const frequency = parseInt(u.workoutFrequency || '3', 10);

    const plans = {
      'weight loss': {
        beginner:     ['20-min brisk walk','Bodyweight squats 3x15','Push-ups 3x10','Plank 3x30s','Jumping jacks 3x30'],
        intermediate: ['30-min run','HIIT circuit 4x45s','Kettlebell swings 4x15','Box jumps 3x12','Mountain climbers 3x20'],
        advanced:     ['45-min interval run','Barbell complex 5x5','Battle ropes 5x30s','Burpees 4x20','Sprint intervals 8x30s'],
      },
      'muscle building': {
        beginner:     ['Goblet squat 3x12','Dumbbell press 3x12','Bent-over rows 3x12','Lunges 3x12','Bicep curls 3x15'],
        intermediate: ['Barbell squat 4x8','Bench press 4x8','Deadlift 3x6','Pull-ups 4x8','Overhead press 4x8'],
        advanced:     ['Heavy deadlift 5x5','Weighted pull-ups 4x6','Barbell row 4x6','Incline press 4x6','Front squat 4x5'],
      },
      'strength': {
        beginner:     ['Goblet squat 3x5','Push-up progression 3x8','Romanian deadlift 3x8','Plank 3x45s','Farmer carries 3x30m'],
        intermediate: ['Squat 4x5','Bench press 4x5','Deadlift 3x5','Press 4x5','Barbell row 4x5'],
        advanced:     ['Squat max effort 5x3','Deadlift max effort 5x2','Bench 5x3','Weighted dips 4x5','Floor press 4x5'],
      },
      'endurance': {
        beginner:     ['20-min easy jog','Cycling 30 min','Jump rope 3x2min','Swimming 20 min','Walking lunges 3x20'],
        intermediate: ['5K tempo run','Cycling intervals 45min','Row machine 4x500m','Stair climb 20min','Circuit training 30min'],
        advanced:     ['10K run','Cycling 90 min','Swim 1500m','Triathlon training block','VO2 max intervals 6x4min'],
      },
    };

    const goalKey = Object.keys(plans).find(k => goal.includes(k)) || 'muscle building';
    const lvlKey  = ['beginner','intermediate','advanced'].includes(level) ? level : 'beginner';
    const exercises = plans[goalKey][lvlKey];

    const days = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const workoutDays = days.filter((_, i) => {
      if (frequency >= 7) return true;
      if (frequency >= 5) return i < 5;
      if (frequency >= 4) return [0,1,3,4].includes(i);
      if (frequency >= 3) return [0,2,4].includes(i);
      return [0,3].includes(i);
    });

    const weekPlan = workoutDays.map((day, i) => ({
      day,
      focus: i % 2 === 0 ? 'Push / Compound' : 'Pull / Accessory',
      exercises: exercises.slice(0, 5),
    }));

    res.json({
      goal: goalKey, level: lvlKey, frequency,
      weekPlan,
      tips: [
        'Warm up for 5-10 minutes before each session.',
        'Rest 60-90 seconds between sets.',
        'Stay hydrated -- aim for 2-3 litres of water per day.',
        'Sleep 7-9 hours for optimal recovery.',
        'You are training ' + frequency + 'x/week -- great consistency!',
      ],
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// ACTIVITY STATUS (last seen / online dot in DMs)
// ============================================================

app.post('/api/users/:uid/presence', verifyToken, verifyOwner, async (req, res) => {
  try {
    await db.collection('users').doc(req.params.uid).update({
      lastSeen: new Date().toISOString(),
      isOnline: req.body.online !== false,
    });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/users/:uid/presence', async (req, res) => {
  try {
    const doc = await db.collection('users').doc(req.params.uid).get();
    const d = doc.data() || {};
    res.json({ lastSeen: d.lastSeen || null, isOnline: d.isOnline || false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// =============================================================================
// FEATURES: VERIFICATION, SUBSCRIPTION, CLIENTS, COMMUNITIES, WEEKLY RECAP
// =============================================================================

// --- VERIFY USER (admin only) ------------------------------------------------
app.patch('/api/admin/users/:uid/verify', verifyToken, verifyAdmin, async (req, res) => {
  const { uid } = req.params;
  const { verified, adminId = '' } = req.body;
  try {
    await db.collection('users').doc(uid).update({ verified: !!verified });
    await logAdminAction(adminId, verified ? 'VERIFY_USER' : 'UNVERIFY_USER', uid, '');
    res.json({ success: true, verified: !!verified });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- TRAINER SUBSCRIPTION ----------------------------------------------------
app.post('/api/users/:uid/subscription', verifyToken, verifyOwner, async (req, res) => {
  try {
    const plan = {
      active: true, tier: 'pro', price: 29,
      startedAt: new Date().toISOString(),
      renewsAt: new Date(Date.now() + 30*24*60*60*1000).toISOString(),
    };
    await db.collection('users').doc(req.params.uid).update({ subscription: plan });
    res.json({ subscription: plan });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:uid/subscription', verifyToken, verifyOwner, async (req, res) => {
  try {
    await db.collection('users').doc(req.params.uid).update({
      subscription: { active: false, tier: 'free', cancelledAt: new Date().toISOString() },
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- MY CLIENTS (trainer) ----------------------------------------------------
app.get('/api/users/:uid/trainer/clients', verifyToken, verifyOwner, async (req, res) => {
  try {
    const bookingsSnap = await db.collection('bookings')
      .where('trainerId', '==', req.params.uid).get();
    const clientIds = [...new Set(bookingsSnap.docs.map(d => d.data().userId))];

    const clients = await Promise.all(clientIds.map(async clientId => {
      const [userSnap, workoutsSnap] = await Promise.all([
        db.collection('users').doc(clientId).get(),
        db.collection('posts').where('user.id', '==', clientId)
          .orderBy('createdAt', 'desc').limit(5).get().catch(() => ({ size: 0, docs: [] })),
      ]);
      if (!userSnap.exists) return null;
      const u = userSnap.data();
      const userBookings = bookingsSnap.docs.filter(d => d.data().userId === clientId);
      return {
        id: clientId,
        displayName: u.displayName || 'User',
        username: u.username || '',
        avatar: u.avatar || null,
        fitnessGoal: u.fitnessGoal || '',
        totalBookings: userBookings.length,
        lastBookingDate: userBookings.map(d => d.data().createdAt).sort().reverse()[0] || null,
        recentWorkouts: workoutsSnap.size,
        recentWorkoutNames: workoutsSnap.docs.slice(0, 3)
          .map(d => d.data().workoutType || d.data().caption?.slice(0,30) || 'Workout'),
      };
    }));
    res.json({ clients: clients.filter(Boolean) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// --- COMMUNITIES -------------------------------------------------------------
const DEFAULT_COMMUNITIES = [
  { id: 'hiit-crew',      name: 'HIIT Crew',            emoji: '🔥', description: 'High-intensity interval training enthusiasts',    category: 'cardio'    },
  { id: 'powerlifters',   name: 'Powerlifters',          emoji: '🏋️', description: 'Squat, bench, deadlift — the big three',          category: 'strength'  },
  { id: 'runners-club',   name: 'Runners Club',          emoji: '🏃', description: 'Road runners, trail runners, track athletes',    category: 'cardio'    },
  { id: 'bodybuilding',   name: 'Bodybuilding',          emoji: '💪', description: 'Hypertrophy, aesthetics, competition prep',       category: 'strength'  },
  { id: 'yoga-flow',      name: 'Yoga & Flexibility',    emoji: '🧘', description: 'Yoga, pilates, mobility and stretching',         category: 'wellness'  },
  { id: 'crossfit',       name: 'CrossFit',              emoji: '⚡', description: 'WODs, box life, functional fitness',             category: 'mixed'     },
  { id: 'cycling-crew',   name: 'Cycling Crew',          emoji: '🚴', description: 'Road cycling, mountain biking, spin classes',    category: 'cardio'    },
  { id: 'nutrition-talk', name: 'Nutrition Talk',        emoji: '🥗', description: 'Macros, meal prep, and diet advice',             category: 'wellness'  },
];

app.get('/api/communities', async (req, res) => {
  try {
    const snap = await db.collection('communities').get();
    if (snap.empty) {
      const batch = db.batch();
      for (const c of DEFAULT_COMMUNITIES) {
        batch.set(db.collection('communities').doc(c.id), {
          ...c, memberCount: 0, members: [], createdAt: new Date().toISOString(),
        });
      }
      await batch.commit();
      return res.json({ communities: DEFAULT_COMMUNITIES.map(c => ({ ...c, memberCount: 0, members: [] })) });
    }
    res.json({ communities: snap.docs.map(d => ({ id: d.id, ...d.data() })) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/communities/:id — single community
app.get('/api/communities/:id', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('communities').doc(req.params.id).get();
    if (!snap.exists) return res.status(404).json({ error: 'Community not found' });
    res.json({ id: snap.id, ...snap.data() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/communities/:id/join', verifyToken, async (req, res) => {
  try {
    const ref = db.collection('communities').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Community not found' });
    const members = doc.data().members || [];
    if (!members.includes(req.uid)) {
      await ref.update({
        members: admin.firestore.FieldValue.arrayUnion(req.uid),
        memberCount: (doc.data().memberCount || 0) + 1,
      });
    }
    const convId = 'community_' + req.params.id;
    const convRef = db.collection('conversations').doc(convId);
    const convDoc = await convRef.get();
    if (!convDoc.exists) {
      await convRef.set({
        type: 'community', communityId: req.params.id,
        name: doc.data().name, emoji: doc.data().emoji,
        participants: [req.uid], lastMessage: '',
        lastMessageAt: new Date().toISOString(),
        unreadCounts: {}, createdAt: new Date().toISOString(),
      });
    } else {
      await convRef.update({ participants: admin.firestore.FieldValue.arrayUnion(req.uid) });
    }
    await db.collection('users').doc(req.uid)
      .update({ conversationIds: admin.firestore.FieldValue.arrayUnion(convId) }).catch(() => {});
    res.json({ success: true, joined: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/communities/:id/leave', verifyToken, async (req, res) => {
  try {
    const ref = db.collection('communities').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Community not found' });
    await ref.update({
      members: admin.firestore.FieldValue.arrayRemove(req.uid),
      memberCount: Math.max(0, (doc.data().memberCount || 1) - 1),
    });
    const convId = 'community_' + req.params.id;
    await db.collection('conversations').doc(convId)
      .update({ participants: admin.firestore.FieldValue.arrayRemove(req.uid) }).catch(() => {});
    await db.collection('users').doc(req.uid)
      .update({ conversationIds: admin.firestore.FieldValue.arrayRemove(convId) }).catch(() => {});
    res.json({ success: true, joined: false });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GROUP WORKOUT EVENTS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/communities/:id/feed — workout posts from all members
app.get('/api/communities/:id/feed', verifyToken, async (req, res) => {
  try {
    const commDoc = await db.collection('communities').doc(req.params.id).get();
    if (!commDoc.exists) return res.status(404).json({ error: 'Community not found' });
    const members = commDoc.data().members || [];
    if (members.length === 0) return res.json({ posts: [] });

    // Firestore 'in' supports max 30 items — chunk if needed
    const chunks = [];
    for (let i = 0; i < members.length; i += 30) chunks.push(members.slice(i, i + 30));

    const allPosts = [];
    for (const chunk of chunks) {
      const snap = await db.collection('posts')
        .where('user.id', 'in', chunk)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();
      snap.docs.forEach(d => allPosts.push({ id: d.id, ...d.data() }));
    }

    allPosts.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ posts: allPosts.slice(0, 50) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/communities/:id/events
app.get('/api/communities/:id/events', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('communities').doc(req.params.id)
      .collection('events').orderBy('eventAt', 'asc').limit(50).get();
    const events = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ events });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/communities/:id/events — create event
app.post('/api/communities/:id/events', verifyToken, async (req, res) => {
  const uid = req.uid;
  const { title, description, eventAt, location, maxAttendees } = req.body;
  if (!title || !eventAt) return res.status(400).json({ error: 'title and eventAt required' });
  try {
    const commDoc = await db.collection('communities').doc(req.params.id).get();
    if (!commDoc.exists) return res.status(404).json({ error: 'Community not found' });
    if (!commDoc.data().members?.includes(uid)) return res.status(403).json({ error: 'Join the community first' });
    const userSnap = await db.collection('users').doc(uid).get();
    const u = userSnap.exists ? userSnap.data() : {};
    const ref = await db.collection('communities').doc(req.params.id).collection('events').add({
      title: sanitize(title, 100),
      description: sanitize(description || '', 500),
      eventAt: String(eventAt),
      location: sanitize(location || '', 100),
      maxAttendees: Number(maxAttendees) || 0,
      creatorId: uid,
      creatorName: u.displayName || u.name || 'User',
      creatorAvatar: u.avatar || '',
      attendees: [uid],
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/communities/:id/events/:eid/rsvp — toggle RSVP
app.post('/api/communities/:id/events/:eid/rsvp', verifyToken, async (req, res) => {
  const uid = req.uid;
  try {
    const ref = db.collection('communities').doc(req.params.id).collection('events').doc(req.params.eid);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Event not found' });
    const data = doc.data();
    const attendees = data.attendees || [];
    const going = attendees.includes(uid);
    if (!going && data.maxAttendees > 0 && attendees.length >= data.maxAttendees) {
      return res.status(409).json({ error: 'Event is full' });
    }
    await ref.update({
      attendees: going
        ? admin.firestore.FieldValue.arrayRemove(uid)
        : admin.firestore.FieldValue.arrayUnion(uid),
    });
    res.json({ going: !going, attendees: going ? attendees.length - 1 : attendees.length + 1 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNTABILITY PAIRS
// ═══════════════════════════════════════════════════════════════════════════════

// GET /api/accountability/my-pair
app.get('/api/accountability/my-pair', verifyToken, async (req, res) => {
  const uid = req.uid;
  try {
    const snap = await db.collection('accountabilityPairs')
      .where('members', 'array-contains', uid).limit(1).get();
    if (snap.empty) return res.json({ pair: null });
    const pair = { id: snap.docs[0].id, ...snap.docs[0].data() };
    // Enrich partner profile
    const partnerId = pair.members.find(m => m !== uid);
    if (partnerId) {
      const pSnap = await db.collection('users').doc(partnerId).get();
      if (pSnap.exists) {
        const p = pSnap.data();
        pair.partner = { uid: partnerId, name: p.displayName || p.name || 'User', avatar: p.avatar || '', username: p.username || '', fitnessGoal: p.fitnessGoal || '' };
        // Last workout
        const wSnap = await db.collection('posts').where('user.id', '==', partnerId).orderBy('createdAt', 'desc').limit(1).get();
        pair.partner.lastWorkout = wSnap.empty ? null : (wSnap.docs[0].data().createdAt || null);
      }
    }
    res.json({ pair });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/accountability/find-match — find or create pair
app.post('/api/accountability/find-match', verifyToken, async (req, res) => {
  const uid = req.uid;
  try {
    // Check already paired
    const existing = await db.collection('accountabilityPairs')
      .where('members', 'array-contains', uid).limit(1).get();
    if (!existing.empty) return res.status(409).json({ error: 'Already in a pair' });

    const userDoc = await db.collection('users').doc(uid).get();
    const { fitnessGoal = '' } = userDoc.data() || {};

    // Find unpaired user with same goal who is waiting
    // Filter uid in-code to avoid needing a composite Firestore index
    const waitingSnap = await db.collection('accountabilityWaiting')
      .where('fitnessGoal', '==', fitnessGoal.toLowerCase()).limit(10).get();

    let partnerId = null;
    for (const doc of waitingSnap.docs.filter(d => d.data().uid !== uid)) {
      // Verify still unpaired
      const pairCheck = await db.collection('accountabilityPairs')
        .where('members', 'array-contains', doc.data().uid).limit(1).get();
      if (pairCheck.empty) { partnerId = doc.data().uid; await doc.ref.delete(); break; }
    }

    if (partnerId) {
      // Create pair
      const ref = await db.collection('accountabilityPairs').add({
        members: [uid, partnerId],
        fitnessGoal,
        createdAt: new Date().toISOString(),
        lastNudge: {},
      });
      // Notify partner
      const u = userDoc.data() || {};
      await createNotification(partnerId, 'accountability_match',
        'Accountability pair found! 🤝',
        `${u.displayName || 'Someone'} with the same goal is your new accountability partner`,
        { pairId: ref.id }
      );
      res.json({ paired: true, pairId: ref.id });
    } else {
      // Join waiting list
      await db.collection('accountabilityWaiting').doc(uid).set({
        uid, fitnessGoal: fitnessGoal.toLowerCase(), joinedAt: new Date().toISOString(),
      });
      res.json({ paired: false, waiting: true });
    }
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/accountability/nudge — send nudge to partner
app.post('/api/accountability/nudge', verifyToken, async (req, res) => {
  const uid = req.uid;
  try {
    const snap = await db.collection('accountabilityPairs')
      .where('members', 'array-contains', uid).limit(1).get();
    if (snap.empty) return res.status(404).json({ error: 'No pair found' });
    const pair = snap.docs[0];
    const partnerId = pair.data().members.find(m => m !== uid);
    const userSnap = await db.collection('users').doc(uid).get();
    const u = userSnap.exists ? userSnap.data() : {};
    await createNotification(partnerId, 'accountability_nudge',
      `${u.displayName || 'Your partner'} is checking on you 👀`,
      'They noticed you haven\'t logged a workout recently — time to get moving!',
      {}
    );
    await pair.ref.update({ [`lastNudge.${uid}`]: new Date().toISOString() });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/accountability/leave — leave pair
app.delete('/api/accountability/leave', verifyToken, async (req, res) => {
  const uid = req.uid;
  try {
    const snap = await db.collection('accountabilityPairs')
      .where('members', 'array-contains', uid).limit(1).get();
    if (!snap.empty) await snap.docs[0].ref.delete();
    await db.collection('accountabilityWaiting').doc(uid).delete().catch(() => {});
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY GROUP CHALLENGE
// ═══════════════════════════════════════════════════════════════════════════════

const CHALLENGE_ROTATION = [
  { type: 'workouts', label: 'Most Workouts', unit: 'sessions', emoji: '🏋️' },
  { type: 'duration', label: 'Longest Total Time', unit: 'minutes', emoji: '⏱️' },
  { type: 'calories', label: 'Most Calories Burned', unit: 'kcal', emoji: '🔥' },
  { type: 'streak',   label: 'Best Workout Streak', unit: 'days', emoji: '⚡' },
];

// GET /api/communities/:id/weekly-challenge
app.get('/api/communities/:id/weekly-challenge', verifyToken, async (req, res) => {
  try {
    const commDoc = await db.collection('communities').doc(req.params.id).get();
    if (!commDoc.exists) return res.status(404).json({ error: 'Community not found' });
    const members = commDoc.data().members || [];

    // Determine this week's challenge type by ISO week number
    const now = new Date();
    const weekNum = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000));
    const challenge = CHALLENGE_ROTATION[weekNum % CHALLENGE_ROTATION.length];

    // Week boundaries
    const dayOfWeek = now.getDay() || 7;
    const weekStart = new Date(now); weekStart.setDate(now.getDate() - dayOfWeek + 1); weekStart.setHours(0,0,0,0);
    const weekEnd   = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 7);

    // Score each member
    const scores = await Promise.all(members.slice(0, 20).map(async uid => {
      const uSnap = await db.collection('users').doc(uid).get();
      if (!uSnap.exists) return null;
      const u = uSnap.data();
      let score = 0;
      const postsSnap = await db.collection('posts').where('user.id', '==', uid).get();
      const weekPosts = postsSnap.docs.filter(d => {
        const t = d.data().createdAt;
        const ms = t?.seconds ? t.seconds * 1000 : new Date(t || 0).getTime();
        return ms >= weekStart.getTime() && ms < weekEnd.getTime();
      }).map(d => d.data());
      if (challenge.type === 'workouts') score = weekPosts.length;
      if (challenge.type === 'duration') score = weekPosts.reduce((a, p) => a + (p.duration || 0), 0);
      if (challenge.type === 'calories') score = weekPosts.reduce((a, p) => a + (p.calories || 0), 0);
      if (challenge.type === 'streak') {
        const days = new Set(weekPosts.map(p => { const ms = p.createdAt?.seconds ? p.createdAt.seconds * 1000 : new Date(p.createdAt || 0).getTime(); return new Date(ms).toDateString(); }));
        score = days.size;
      }
      return { uid, name: u.displayName || u.name || 'User', avatar: u.avatar || '', score };
    }));

    const leaderboard = scores.filter(Boolean).sort((a, b) => b.score - a.score);
    res.json({ challenge, leaderboard, weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// DATA EXPORT
// ═══════════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════════
// DATA EXPORT
// ═══════════════════════════════════════════════════════════════════════════════



// ─── HABITS & SUPPLEMENTS ─────────────────────────────────────────────────────

// GET /api/users/:uid/habits
app.get('/api/users/:uid/habits', verifyToken, async (req, res) => {
  const today = new Date().toISOString().slice(0, 10);
  try {
    const snap = await db.collection('users').doc(req.params.uid)
      .collection('habits').orderBy('createdAt', 'desc').get();
    const habits = snap.docs.map(d => {
      const data = d.data();
      const checkins = data.checkins || [];
      const completedToday = checkins.includes(today);
      return { id: d.id, ...data, completedToday };
    });
    res.json({ habits });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users/:uid/habits — create habit
app.post('/api/users/:uid/habits', verifyToken, async (req, res) => {
  if (req.uid !== req.params.uid) return res.status(403).json({ error: 'Forbidden' });
  const { name, icon, color, type } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name required' });
  const habit = {
    name: sanitize(name, 60),
    icon: icon || '✅',
    color: color || 'violet',
    type: type === 'supplement' ? 'supplement' : 'habit',
    targetDays: [],
    streak: 0,
    longestStreak: 0,
    checkins: [],
    lastCheckin: null,
    createdAt: new Date().toISOString(),
  };
  try {
    const ref = await db.collection('users').doc(req.params.uid).collection('habits').add(habit);
    res.status(201).json({ habit: { id: ref.id, ...habit, completedToday: false } });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users/:uid/habits/:id/checkin — mark done today
app.post('/api/users/:uid/habits/:id/checkin', verifyToken, async (req, res) => {
  if (req.uid !== req.params.uid) return res.status(403).json({ error: 'Forbidden' });
  const today = new Date().toISOString().slice(0, 10);
  try {
    const ref = db.collection('users').doc(req.params.uid).collection('habits').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const data   = doc.data();
    const checkins = data.checkins || [];
    if (checkins.includes(today)) return res.json({ already: true });

    // Calculate streak
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const newStreak = (data.lastCheckin === yesterday || data.lastCheckin === today)
      ? (data.streak || 0) + 1 : 1;
    const longest = Math.max(data.longestStreak || 0, newStreak);
    const updatedCheckins = [...checkins.slice(-29), today]; // keep last 30

    await ref.update({
      checkins: updatedCheckins,
      lastCheckin: today,
      streak: newStreak,
      longestStreak: longest,
    });
    res.json({ streak: newStreak, longestStreak: longest });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/users/:uid/habits/:id/checkin — uncheck today
app.delete('/api/users/:uid/habits/:id/checkin', verifyToken, async (req, res) => {
  if (req.uid !== req.params.uid) return res.status(403).json({ error: 'Forbidden' });
  const today = new Date().toISOString().slice(0, 10);
  try {
    const ref = db.collection('users').doc(req.params.uid).collection('habits').doc(req.params.id);
    const doc = await ref.get();
    if (!doc.exists) return res.status(404).json({ error: 'Not found' });
    const data = doc.data();
    const checkins = (data.checkins || []).filter(d => d !== today);
    const newStreak = Math.max(0, (data.streak || 1) - 1);
    await ref.update({ checkins, streak: newStreak, lastCheckin: checkins[checkins.length - 1] || null });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/users/:uid/habits/:id
app.delete('/api/users/:uid/habits/:id', verifyToken, async (req, res) => {
  if (req.uid !== req.params.uid) return res.status(403).json({ error: 'Forbidden' });
  try {
    await db.collection('users').doc(req.params.uid).collection('habits').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── BODY MEASUREMENTS ────────────────────────────────────────────────────────

// GET /api/users/:uid/measurements
app.get('/api/users/:uid/measurements', verifyToken, async (req, res) => {
  try {
    const snap = await db.collection('users').doc(req.params.uid)
      .collection('measurements').orderBy('date', 'desc').limit(100).get();
    const measurements = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json({ measurements });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// POST /api/users/:uid/measurements
app.post('/api/users/:uid/measurements', verifyToken, async (req, res) => {
  if (req.uid !== req.params.uid) return res.status(403).json({ error: 'Forbidden' });
  const allowed = ['date','unit','chest','waist','hips','shoulders','leftArm','rightArm','leftThigh','rightThigh','neck','notes'];
  const data = {};
  allowed.forEach(k => { if (req.body[k] != null) data[k] = req.body[k]; });
  if (!data['date']) data['date'] = new Date().toISOString().slice(0, 10);
  data['createdAt'] = new Date().toISOString();
  try {
    const ref = await db.collection('users').doc(req.params.uid)
      .collection('measurements').add(data);
    res.status(201).json({ id: ref.id, ...data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// DELETE /api/users/:uid/measurements/:id
app.delete('/api/users/:uid/measurements/:id', verifyToken, async (req, res) => {
  if (req.uid !== req.params.uid) return res.status(403).json({ error: 'Forbidden' });
  try {
    await db.collection('users').doc(req.params.uid)
      .collection('measurements').doc(req.params.id).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// GET /api/users/:uid/heatmap — last 365 days of workout activity
app.get('/api/users/:uid/heatmap', verifyToken, async (req, res) => {
  const { uid } = req.params;
  try {
    const since = new Date();
    since.setDate(since.getDate() - 364);
    since.setHours(0, 0, 0, 0);

    const postsSnap = await db.collection('posts')
      .where('user.id', '==', uid)
      .get();

    // Build a map of dateStr -> count
    const counts = {};
    postsSnap.forEach(doc => {
      const p = doc.data();
      const d = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
      if (d < since) return;
      const key = d.toISOString().slice(0, 10); // YYYY-MM-DD
      counts[key] = (counts[key] || 0) + 1;
    });

    res.json({ counts });
  } catch (e) {
    console.error('heatmap error', e);
    res.status(500).json({ error: 'Failed' });
  }
});

// GET /api/users/:uid/weekly-recap
app.get('/api/users/:uid/weekly-recap', verifyToken, async (req, res) => {
  const { uid } = req.params;
  if (uid !== req.uid) return res.status(403).json({ error: 'Forbidden' });
  try {
    // Calculate current week boundaries (Monday → Sunday)
    const now = new Date();
    const day = now.getDay(); // 0=Sun,1=Mon,...
    const diffToMonday = (day === 0 ? -6 : 1 - day);
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() + diffToMonday);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);

    // Fetch user profile for display name, avatar, goal
    const userDoc = await db.collection('users').doc(uid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    // Fetch all posts this week
    const postsSnap = await db.collection('posts')
      .where('user.id', '==', uid)
      .get();

    let totalWorkouts = 0;
    let totalMinutes = 0;
    let totalCaloriesBurned = 0;
    const workoutDaysSet = new Set();
    const exerciseCounts = {};

    postsSnap.forEach(doc => {
      const p = doc.data();
      const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
      if (createdAt < weekStart || createdAt > weekEnd) return;

      totalWorkouts++;
      totalMinutes += Number(p.duration || p.workoutDuration || 0);
      totalCaloriesBurned += Number(p.calories || p.caloriesBurned || 0);
      workoutDaysSet.add(createdAt.toDateString());

      // Count exercises
      const exercises = p.exercises || [];
      exercises.forEach(ex => {
        const name = ex.name || ex.exercise || 'Unknown';
        exerciseCounts[name] = (exerciseCounts[name] || 0) + 1;
      });
    });

    // Top exercise
    const topExercise = Object.keys(exerciseCounts).length > 0
      ? Object.entries(exerciseCounts).sort((a, b) => b[1] - a[1])[0][0]
      : null;

    // Fetch nutrition logs this week
    let totalCaloriesLogged = 0;
    try {
      const nutritionSnap = await db.collection('nutrition_logs')
        .where('userId', '==', uid)
        .get();
      nutritionSnap.forEach(doc => {
        const n = doc.data();
        const logDate = n.date ? new Date(n.date) : null;
        if (!logDate || logDate < weekStart || logDate > weekEnd) return;
        const entries = n.entries || [];
        entries.forEach(e => { totalCaloriesLogged += Number(e.calories || 0); });
      });
    } catch (_) {}

    // Get streak from user doc
    const streak = Number(userData.streak || 0);

    // ── Last week for comparison ──────────────────────────────────────────
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekEnd);
    lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);

    let lwWorkouts = 0, lwMinutes = 0, lwCaloriesBurned = 0, lwCaloriesLogged = 0;
    const lwDays = new Set();

    postsSnap.forEach(doc => {
      const p = doc.data();
      const createdAt = p.createdAt?.toDate ? p.createdAt.toDate() : new Date(p.createdAt || 0);
      if (createdAt < lastWeekStart || createdAt > lastWeekEnd) return;
      lwWorkouts++;
      lwMinutes += Number(p.duration || p.workoutDuration || 0);
      lwCaloriesBurned += Number(p.calories || p.caloriesBurned || 0);
      lwDays.add(createdAt.toDateString());
    });

    try {
      const nutritionSnap2 = await db.collection('nutrition_logs').where('userId', '==', uid).get();
      nutritionSnap2.forEach(doc => {
        const n = doc.data();
        const logDate = n.date ? new Date(n.date) : null;
        if (!logDate || logDate < lastWeekStart || logDate > lastWeekEnd) return;
        (n.entries || []).forEach(e => { lwCaloriesLogged += Number(e.calories || 0); });
      });
    } catch (_) {}

    res.json({
      week: { start: weekStart.toISOString(), end: weekEnd.toISOString() },
      totalWorkouts, totalMinutes, totalCaloriesBurned, totalCaloriesLogged,
      workoutDays: workoutDaysSet.size, topExercise, streak,
      fitnessGoal: userData.fitnessGoal || userData.goal || '',
      displayName: userData.name || userData.displayName || 'You',
      avatar: userData.avatar || userData.photoURL || null,
      lastWeek: {
        totalWorkouts: lwWorkouts,
        totalMinutes: lwMinutes,
        totalCaloriesBurned: lwCaloriesBurned,
        totalCaloriesLogged: lwCaloriesLogged,
        workoutDays: lwDays.size,
      },
    });
  } catch (e) {
    console.error('weekly-recap error', e);
    res.status(500).json({ error: 'Failed to load recap' });
  }
});

// GET /api/users/:uid/export
app.get('/api/users/:uid/export', verifyToken, verifyOwner, async (req, res) => {
  const uid = req.params.uid;
  try {
    const [postsSnap, workoutsSnap, mealsSnap, userSnap] = await Promise.all([
      db.collection('posts').where('user.id', '==', uid).orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('workouts').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('meals').where('userId', '==', uid).orderBy('createdAt', 'desc').limit(200).get(),
      db.collection('users').doc(uid).get(),
    ]);

    const rows = [['Type', 'Date', 'Title / Description', 'Detail 1', 'Detail 2']];

    postsSnap.docs.forEach(d => {
      const p = d.data();
      rows.push(['Post', p.createdAt || '', sanitize(p.caption || ''), (p.hashtags || []).join(' '), p.workoutType || '']);
    });
    workoutsSnap.docs.forEach(d => {
      const w = d.data();
      rows.push(['Workout', w.createdAt || '', sanitize(w.name || ''), `${w.duration || 0} min`, `${w.calories || 0} kcal`]);
    });
    mealsSnap.docs.forEach(d => {
      const m = d.data();
      rows.push(['Meal', m.createdAt || '', sanitize(m.name || ''), `${m.calories || 0} kcal`, `P:${m.protein||0}g C:${m.carbs||0}g F:${m.fat||0}g`]);
    });

    const csv = rows.map(r =>
      r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')
    ).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="flex-data-${uid}.csv"`);
    res.send(csv);
  } catch (e) {
    console.error('export error', e);
    res.status(500).json({ error: e.message });
  }
});


// ============================================================
// GYM USER TYPE — Registration, Profile, Members, Classes, Check-in
// ============================================================

// ── Helpers ──────────────────────────────────────────────────────────────────
function gymOwnerOnly(req, res, next) {
  // req.uid set by verifyToken; gymId from params must match gym's ownerUid
  next(); // ownership checked inside each handler after fetching gym doc
}

// ── POST /api/gyms/register ──────────────────────────────────────────────────
// Creates a Firebase Auth user + Firestore gym doc in one shot.
app.post('/api/gyms/register', async (req, res) => {
  try {
    const { email, password, gymName, address, city, country, phone, website, description } = req.body;
    if (!email || !password || !gymName) return res.status(400).json({ error: 'email, password and gymName required' });

    // Create Firebase Auth user
    const userRecord = await admin.auth().createUser({ email, password, displayName: gymName });
    const uid = userRecord.uid;

    // Set custom claim so client knows this is a gym account
    await admin.auth().setCustomUserClaims(uid, { role: 'gym' });

    const gymData = {
      ownerUid: uid,
      gymName: sanitize(gymName),
      email: sanitize(email),
      address: sanitize(address || ''),
      city: sanitize(city || ''),
      country: sanitize(country || ''),
      phone: sanitize(phone || ''),
      website: sanitize(website || ''),
      description: sanitize(description || ''),
      logoUrl: '',
      coverUrl: '',
      amenities: [],
      hours: {
        monday: { open: '06:00', close: '22:00', closed: false },
        tuesday: { open: '06:00', close: '22:00', closed: false },
        wednesday: { open: '06:00', close: '22:00', closed: false },
        thursday: { open: '06:00', close: '22:00', closed: false },
        friday: { open: '06:00', close: '22:00', closed: false },
        saturday: { open: '08:00', close: '20:00', closed: false },
        sunday: { open: '08:00', close: '18:00', closed: false },
      },
      memberCount: 0,
      rating: 0,
      ratingCount: 0,
      createdAt: new Date().toISOString(),
    };

    await db.collection('gyms').doc(uid).set(gymData);

    // Also create a minimal user doc so the gym shows in Firestore
    await db.collection('users').doc(uid).set({
      uid,
      role: 'gym',
      email: sanitize(email),
      name: sanitize(gymName),
      username: sanitize(gymName.toLowerCase().replace(/\s+/g, '_')),
      createdAt: new Date().toISOString(),
    });

    res.status(201).json({ uid, gymName, message: 'Gym registered successfully' });
  } catch (e) {
    console.error('gym register error', e);
    res.status(500).json({ error: e.message });
  }
});

// ── GET /api/gyms ─────────────────────────────────────────────────────────────
// List all gyms (for Gyms directory page)
app.get('/api/gyms', async (req, res) => {
  try {
    const snap = await db.collection('gyms').orderBy('gymName').limit(50).get();
    const gyms = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(gyms);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/gyms/:id ─────────────────────────────────────────────────────────
app.get('/api/gyms/:id', async (req, res) => {
  try {
    const doc = await db.collection('gyms').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Gym not found' });
    res.json({ id: doc.id, ...doc.data() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── PUT /api/gyms/:id ─────────────────────────────────────────────────────────
// Update gym profile (owner only)
app.put('/api/gyms/:id', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('gyms').doc(req.params.id).get();
    if (!doc.exists) return res.status(404).json({ error: 'Gym not found' });
    if (doc.data().ownerUid !== req.uid) return res.status(403).json({ error: 'Forbidden' });

    const allowed = ['gymName','address','city','country','phone','website','description','logoUrl','coverUrl','amenities','hours'];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) {
        update[key] = typeof req.body[key] === 'string' ? sanitize(req.body[key]) : req.body[key];
      }
    }
    update.updatedAt = new Date().toISOString();
    await db.collection('gyms').doc(req.params.id).update(update);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/gyms/:id/stats ──────────────────────────────────────────────────
// Dashboard stats for gym owner
app.get('/api/gyms/:id/stats', verifyToken, async (req, res) => {
  try {
    const gymDoc = await db.collection('gyms').doc(req.params.id).get();
    if (!gymDoc.exists) return res.status(404).json({ error: 'Not found' });
    if (gymDoc.data().ownerUid !== req.uid) return res.status(403).json({ error: 'Forbidden' });

    const gymId = req.params.id;

    // Member count
    const membersSnap = await db.collection('gyms').doc(gymId).collection('members')
      .where('status', '==', 'active').get();
    const memberCount = membersSnap.size;

    // Check-ins today
    const todayStart = new Date(); todayStart.setHours(0,0,0,0);
    const checkinsToday = await db.collection('gyms').doc(gymId).collection('checkins')
      .where('checkedInAt', '>=', todayStart.toISOString()).get();

    // Check-ins this week (last 7 days)
    const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7);
    const checkinsWeek = await db.collection('gyms').doc(gymId).collection('checkins')
      .where('checkedInAt', '>=', weekAgo.toISOString()).orderBy('checkedInAt').get();

    // Build daily check-in counts for chart
    const dailyCounts = {};
    for (let i = 6; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0,10);
      dailyCounts[key] = 0;
    }
    checkinsWeek.docs.forEach(d => {
      const key = (d.data().checkedInAt || '').slice(0,10);
      if (dailyCounts[key] !== undefined) dailyCounts[key]++;
    });

    // Classes count
    const classesSnap = await db.collection('gyms').doc(gymId).collection('classes').get();

    // New members this month
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
    const newMembers = membersSnap.docs.filter(d => (d.data().joinedAt || '') >= monthStart.toISOString()).length;

    res.json({
      memberCount,
      checkinsToday: checkinsToday.size,
      checkinsThisWeek: checkinsWeek.size,
      dailyCheckins: Object.entries(dailyCounts).map(([date, count]) => ({ date, count })),
      classCount: classesSnap.size,
      newMembersThisMonth: newMembers,
    });
  } catch (e) { console.error('gym stats error', e); res.status(500).json({ error: e.message }); }
});

// ── GET /api/gyms/:id/members ────────────────────────────────────────────────
app.get('/api/gyms/:id/members', verifyToken, async (req, res) => {
  try {
    const gymDoc = await db.collection('gyms').doc(req.params.id).get();
    if (!gymDoc.exists) return res.status(404).json({ error: 'Not found' });
    if (gymDoc.data().ownerUid !== req.uid) return res.status(403).json({ error: 'Forbidden' });

    const snap = await db.collection('gyms').doc(req.params.id).collection('members')
      .orderBy('joinedAt', 'desc').limit(100).get();
    const members = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(members);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/gyms/:id/members ───────────────────────────────────────────────
// A user joins a gym
app.post('/api/gyms/:id/members', verifyToken, async (req, res) => {
  try {
    const gymId = req.params.id;
    const gymDoc = await db.collection('gyms').doc(gymId).get();
    if (!gymDoc.exists) return res.status(404).json({ error: 'Gym not found' });

    const { plan = 'monthly' } = req.body;

    // Get user info
    const userDoc = await db.collection('users').doc(req.uid).get();
    const user = userDoc.data() || {};

    // Check if already a member
    const existing = await db.collection('gyms').doc(gymId).collection('members').doc(req.uid).get();
    if (existing.exists && existing.data().status === 'active') {
      return res.status(409).json({ error: 'Already a member' });
    }

    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + (plan === 'yearly' ? 12 : 1));

    const memberData = {
      uid: req.uid,
      name: sanitize(user.name || user.username || ''),
      photoUrl: user.photoUrl || '',
      plan,
      status: 'active',
      joinedAt: new Date().toISOString(),
      expiresAt: expiry.toISOString(),
    };

    await db.collection('gyms').doc(gymId).collection('members').doc(req.uid).set(memberData);
    await db.collection('gyms').doc(gymId).update({ memberCount: admin.firestore.FieldValue.increment(1) });

    // Store gym on user's profile
    await db.collection('users').doc(req.uid).update({
      gymId,
      gymName: gymDoc.data().gymName,
    });

    res.status(201).json({ success: true, expiresAt: expiry.toISOString() });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/gyms/:id/members/:memberId ───────────────────────────────────
// Gym owner removes a member (or member leaves)
app.delete('/api/gyms/:id/members/:memberId', verifyToken, async (req, res) => {
  try {
    const gymDoc = await db.collection('gyms').doc(req.params.id).get();
    if (!gymDoc.exists) return res.status(404).json({ error: 'Not found' });
    const isOwner = gymDoc.data().ownerUid === req.uid;
    const isSelf  = req.params.memberId === req.uid;
    if (!isOwner && !isSelf) return res.status(403).json({ error: 'Forbidden' });

    await db.collection('gyms').doc(req.params.id).collection('members').doc(req.params.memberId).update({
      status: 'inactive', removedAt: new Date().toISOString(),
    });
    await db.collection('gyms').doc(req.params.id).update({ memberCount: admin.firestore.FieldValue.increment(-1) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/gyms/:id/membership ────────────────────────────────────────────
// Check if the calling user is a member of this gym
app.get('/api/gyms/:id/membership', verifyToken, async (req, res) => {
  try {
    const doc = await db.collection('gyms').doc(req.params.id).collection('members').doc(req.uid).get();
    if (!doc.exists) return res.json({ isMember: false });
    const data = doc.data();
    res.json({ isMember: data.status === 'active', membership: data });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/gyms/:id/classes ────────────────────────────────────────────────
app.get('/api/gyms/:id/classes', async (req, res) => {
  try {
    const snap = await db.collection('gyms').doc(req.params.id).collection('classes')
      .orderBy('dayOfWeek').orderBy('startTime').get();
    const classes = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    res.json(classes);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/gyms/:id/classes ───────────────────────────────────────────────
app.post('/api/gyms/:id/classes', verifyToken, async (req, res) => {
  try {
    const gymDoc = await db.collection('gyms').doc(req.params.id).get();
    if (!gymDoc.exists) return res.status(404).json({ error: 'Not found' });
    if (gymDoc.data().ownerUid !== req.uid) return res.status(403).json({ error: 'Forbidden' });

    const { name, instructor, dayOfWeek, startTime, endTime, capacity, description, type } = req.body;
    if (!name || !dayOfWeek || !startTime) return res.status(400).json({ error: 'name, dayOfWeek, startTime required' });

    const classData = {
      name: sanitize(name),
      instructor: sanitize(instructor || ''),
      dayOfWeek: Number(dayOfWeek), // 0=Mon … 6=Sun
      startTime: sanitize(startTime),
      endTime: sanitize(endTime || ''),
      capacity: Number(capacity) || 20,
      enrolled: 0,
      description: sanitize(description || ''),
      type: sanitize(type || 'general'),
      createdAt: new Date().toISOString(),
    };

    const ref = await db.collection('gyms').doc(req.params.id).collection('classes').add(classData);
    res.status(201).json({ id: ref.id, ...classData });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/gyms/:id/classes/:classId ────────────────────────────────────
app.delete('/api/gyms/:id/classes/:classId', verifyToken, async (req, res) => {
  try {
    const gymDoc = await db.collection('gyms').doc(req.params.id).get();
    if (!gymDoc.exists || gymDoc.data().ownerUid !== req.uid) return res.status(403).json({ error: 'Forbidden' });
    await db.collection('gyms').doc(req.params.id).collection('classes').doc(req.params.classId).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/gyms/:id/classes/:classId/book ────────────────────────────────
// Member books a spot in a class
app.post('/api/gyms/:id/classes/:classId/book', verifyToken, async (req, res) => {
  try {
    const classRef = db.collection('gyms').doc(req.params.id).collection('classes').doc(req.params.classId);
    const classDoc = await classRef.get();
    if (!classDoc.exists) return res.status(404).json({ error: 'Class not found' });

    const data = classDoc.data();
    if (data.enrolled >= data.capacity) return res.status(409).json({ error: 'Class is full' });

    // Check if already booked
    const bookingRef = classRef.collection('bookings').doc(req.uid);
    const existing = await bookingRef.get();
    if (existing.exists) return res.status(409).json({ error: 'Already booked' });

    const userDoc = await db.collection('users').doc(req.uid).get();
    const user = userDoc.data() || {};

    await bookingRef.set({
      uid: req.uid,
      name: user.name || user.username || '',
      bookedAt: new Date().toISOString(),
    });
    await classRef.update({ enrolled: admin.firestore.FieldValue.increment(1) });

    res.status(201).json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── DELETE /api/gyms/:id/classes/:classId/book ──────────────────────────────
// Cancel a class booking
app.delete('/api/gyms/:id/classes/:classId/book', verifyToken, async (req, res) => {
  try {
    const classRef = db.collection('gyms').doc(req.params.id).collection('classes').doc(req.params.classId);
    const bookingRef = classRef.collection('bookings').doc(req.uid);
    const existing = await bookingRef.get();
    if (!existing.exists) return res.status(404).json({ error: 'No booking found' });

    await bookingRef.delete();
    await classRef.update({ enrolled: admin.firestore.FieldValue.increment(-1) });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/gyms/:id/checkin ───────────────────────────────────────────────
// Member checks in — called from QR scan or manual
app.post('/api/gyms/:id/checkin', verifyToken, async (req, res) => {
  try {
    const gymId = req.params.id;
    const gymDoc = await db.collection('gyms').doc(gymId).get();
    if (!gymDoc.exists) return res.status(404).json({ error: 'Gym not found' });

    // Verify membership
    const memberDoc = await db.collection('gyms').doc(gymId).collection('members').doc(req.uid).get();
    if (!memberDoc.exists || memberDoc.data().status !== 'active') {
      return res.status(403).json({ error: 'Not an active member of this gym' });
    }

    // Prevent duplicate check-in within 1 hour
    const oneHourAgo = new Date(Date.now() - 3600000).toISOString();
    const recentCheckin = await db.collection('gyms').doc(gymId).collection('checkins')
      .where('uid', '==', req.uid)
      .where('checkedInAt', '>=', oneHourAgo)
      .limit(1).get();

    if (!recentCheckin.empty) {
      return res.status(429).json({ error: 'Already checked in recently' });
    }

    const userDoc = await db.collection('users').doc(req.uid).get();
    const user = userDoc.data() || {};

    const checkinData = {
      uid: req.uid,
      name: user.name || user.username || '',
      photoUrl: user.photoUrl || '',
      checkedInAt: new Date().toISOString(),
    };

    await db.collection('gyms').doc(gymId).collection('checkins').add(checkinData);
    res.status(201).json({ success: true, checkedInAt: checkinData.checkedInAt });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/gyms/:id/checkins ───────────────────────────────────────────────
// Recent check-ins (gym owner view)
app.get('/api/gyms/:id/checkins', verifyToken, async (req, res) => {
  try {
    const gymDoc = await db.collection('gyms').doc(req.params.id).get();
    if (!gymDoc.exists) return res.status(404).json({ error: 'Not found' });
    if (gymDoc.data().ownerUid !== req.uid) return res.status(403).json({ error: 'Forbidden' });

    const snap = await db.collection('gyms').doc(req.params.id).collection('checkins')
      .orderBy('checkedInAt', 'desc').limit(50).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/gyms/:id/announcements ────────────────────────────────────────
app.post('/api/gyms/:id/announcements', verifyToken, async (req, res) => {
  try {
    const gymDoc = await db.collection('gyms').doc(req.params.id).get();
    if (!gymDoc.exists || gymDoc.data().ownerUid !== req.uid) return res.status(403).json({ error: 'Forbidden' });

    const { text, imageUrl } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });

    const ref = await db.collection('gyms').doc(req.params.id).collection('announcements').add({
      text: sanitize(text),
      imageUrl: imageUrl || '',
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── GET /api/gyms/:id/announcements ─────────────────────────────────────────
app.get('/api/gyms/:id/announcements', async (req, res) => {
  try {
    const snap = await db.collection('gyms').doc(req.params.id).collection('announcements')
      .orderBy('createdAt', 'desc').limit(20).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── POST /api/gyms/:id/rate ──────────────────────────────────────────────────
app.post('/api/gyms/:id/rate', verifyToken, async (req, res) => {
  try {
    const { rating } = req.body;
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: 'rating must be 1-5' });

    const gymId = req.params.id;
    const ratingRef = db.collection('gyms').doc(gymId).collection('ratings').doc(req.uid);
    await ratingRef.set({ rating: Number(rating), ratedAt: new Date().toISOString() });

    // Recalculate average
    const ratingsSnap = await db.collection('gyms').doc(gymId).collection('ratings').get();
    const total = ratingsSnap.docs.reduce((sum, d) => sum + (d.data().rating || 0), 0);
    const avg = ratingsSnap.size > 0 ? Math.round((total / ratingsSnap.size) * 10) / 10 : 0;

    await db.collection('gyms').doc(gymId).update({ rating: avg, ratingCount: ratingsSnap.size });
    res.json({ rating: avg, ratingCount: ratingsSnap.size });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
// GYM PRO SYSTEMS — 12 additional management modules
// ═══════════════════════════════════════════════════════════════════════════════

// Helper: verify gym owner — returns gymDoc or null (sends error itself)
async function verifyGymOwner(gymId, uid, res) {
  const gymDoc = await db.collection('gyms').doc(gymId).get();
  if (!gymDoc.exists) { res.status(404).json({ error: 'Gym not found' }); return null; }
  if (gymDoc.data().ownerUid !== uid) { res.status(403).json({ error: 'Forbidden' }); return null; }
  return gymDoc;
}

// ── 1. BILLING & PAYMENTS ────────────────────────────────────────────────────
app.get('/api/gyms/:id/payments', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const snap = await db.collection('gyms').doc(req.params.id).collection('payments')
      .orderBy('createdAt', 'desc').limit(100).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gyms/:id/payments', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const { memberName, memberId, amount, plan, status, dueDate, note } = req.body;
    if (!memberName || !amount) return res.status(400).json({ error: 'memberName and amount required' });
    const ref = await db.collection('gyms').doc(req.params.id).collection('payments').add({
      memberName: sanitize(memberName),
      memberId: memberId || '',
      amount: Number(amount),
      plan: plan || 'monthly',
      status: status || 'pending',
      dueDate: dueDate || '',
      note: sanitize(note || ''),
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/gyms/:id/payments/:pid', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const { status, amount, note, dueDate } = req.body;
    const update = { updatedAt: new Date().toISOString() };
    if (status) update.status = status;
    if (amount !== undefined) update.amount = Number(amount);
    if (note !== undefined) update.note = sanitize(note);
    if (dueDate !== undefined) update.dueDate = dueDate;
    await db.collection('gyms').doc(req.params.id).collection('payments').doc(req.params.pid).update(update);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/gyms/:id/payments/:pid', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    await db.collection('gyms').doc(req.params.id).collection('payments').doc(req.params.pid).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 2. REVENUE ANALYTICS ─────────────────────────────────────────────────────
app.get('/api/gyms/:id/revenue', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const snap = await db.collection('gyms').doc(req.params.id).collection('payments').get();
    const payments = snap.docs.map(d => d.data());
    const paid = payments.filter(p => p.status === 'paid');
    const totalRevenue = paid.reduce((s, p) => s + (p.amount || 0), 0);
    const overdue = payments.filter(p => p.status === 'overdue').reduce((s, p) => s + (p.amount || 0), 0);
    const pending = payments.filter(p => p.status === 'pending').reduce((s, p) => s + (p.amount || 0), 0);
    const now = new Date();
    const monthly = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('default', { month: 'short' });
      const monthPaid = paid.filter(p => (p.createdAt || '').startsWith(key));
      monthly.push({ month: key, label, total: monthPaid.reduce((s, p) => s + (p.amount || 0), 0), count: monthPaid.length });
    }
    const byPlan = {};
    paid.forEach(p => { byPlan[p.plan || 'monthly'] = (byPlan[p.plan || 'monthly'] || 0) + (p.amount || 0); });
    res.json({ totalRevenue, overdue, pending, monthly, byPlan });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 3. PERSONAL TRAINERS ─────────────────────────────────────────────────────
app.get('/api/gyms/:id/trainers', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const snap = await db.collection('gyms').doc(req.params.id).collection('trainers').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gyms/:id/trainers', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const { name, specialty, email, phone, bio, hourlyRate } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const ref = await db.collection('gyms').doc(req.params.id).collection('trainers').add({
      name: sanitize(name), specialty: sanitize(specialty || ''), email: sanitize(email || ''),
      phone: sanitize(phone || ''), bio: sanitize(bio || ''), hourlyRate: Number(hourlyRate) || 0,
      assignedMembers: [], createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/gyms/:id/trainers/:tid', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const update = { updatedAt: new Date().toISOString() };
    ['name','specialty','email','phone','bio','hourlyRate','assignedMembers'].forEach(f => {
      if (req.body[f] !== undefined) update[f] = typeof req.body[f] === 'string' ? sanitize(req.body[f]) : req.body[f];
    });
    await db.collection('gyms').doc(req.params.id).collection('trainers').doc(req.params.tid).update(update);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/gyms/:id/trainers/:tid', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    await db.collection('gyms').doc(req.params.id).collection('trainers').doc(req.params.tid).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 4. EQUIPMENT TRACKER ─────────────────────────────────────────────────────
app.get('/api/gyms/:id/equipment', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const snap = await db.collection('gyms').doc(req.params.id).collection('equipment').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gyms/:id/equipment', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const { name, type, brand, condition, purchaseDate, lastMaintenance, nextMaintenance, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const ref = await db.collection('gyms').doc(req.params.id).collection('equipment').add({
      name: sanitize(name), type: sanitize(type || ''), brand: sanitize(brand || ''),
      condition: condition || 'good', purchaseDate: purchaseDate || '',
      lastMaintenance: lastMaintenance || '', nextMaintenance: nextMaintenance || '',
      notes: sanitize(notes || ''), createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/gyms/:id/equipment/:eid', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const update = { updatedAt: new Date().toISOString() };
    ['name','type','brand','condition','purchaseDate','lastMaintenance','nextMaintenance','notes'].forEach(f => {
      if (req.body[f] !== undefined) update[f] = typeof req.body[f] === 'string' ? sanitize(req.body[f]) : req.body[f];
    });
    await db.collection('gyms').doc(req.params.id).collection('equipment').doc(req.params.eid).update(update);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/gyms/:id/equipment/:eid', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    await db.collection('gyms').doc(req.params.id).collection('equipment').doc(req.params.eid).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 5. CHALLENGES & LEADERBOARDS ─────────────────────────────────────────────
app.get('/api/gyms/:id/challenges', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const snap = await db.collection('gyms').doc(req.params.id).collection('challenges').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gyms/:id/challenges', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const { name, description, goalType, goalValue, startDate, endDate, reward } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const ref = await db.collection('gyms').doc(req.params.id).collection('challenges').add({
      name: sanitize(name), description: sanitize(description || ''),
      goalType: goalType || 'checkins', goalValue: Number(goalValue) || 10,
      startDate: startDate || new Date().toISOString().slice(0, 10),
      endDate: endDate || '', reward: sanitize(reward || ''),
      active: true, createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/gyms/:id/challenges/:cid', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    await db.collection('gyms').doc(req.params.id).collection('challenges').doc(req.params.cid).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/gyms/:id/challenges/:cid/leaderboard', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const challengeDoc = await db.collection('gyms').doc(req.params.id).collection('challenges').doc(req.params.cid).get();
    if (!challengeDoc.exists) return res.status(404).json({ error: 'Challenge not found' });
    const challenge = challengeDoc.data();
    const snap = await db.collection('gyms').doc(req.params.id).collection('checkins').get();
    const counts = {};
    snap.docs.forEach(d => {
      const data = d.data();
      if (challenge.startDate && data.checkedInAt < challenge.startDate) return;
      if (challenge.endDate && data.checkedInAt > challenge.endDate + 'T23:59:59') return;
      const uid = data.uid;
      if (!counts[uid]) counts[uid] = { name: data.name, photoUrl: data.photoUrl || '', count: 0 };
      counts[uid].count++;
    });
    const leaderboard = Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 20);
    res.json(leaderboard);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 6. MEMBER PROGRESS ───────────────────────────────────────────────────────
app.get('/api/gyms/:id/progress/:memberId', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const snap = await db.collection('gyms').doc(req.params.id)
      .collection('progress').doc(req.params.memberId)
      .collection('entries').orderBy('date', 'desc').limit(50).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gyms/:id/progress/:memberId', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const { date, weight, bodyFat, chest, waist, hips, notes, prs } = req.body;
    const ref = await db.collection('gyms').doc(req.params.id)
      .collection('progress').doc(req.params.memberId)
      .collection('entries').add({
        date: date || new Date().toISOString().slice(0, 10),
        weight: Number(weight) || 0, bodyFat: Number(bodyFat) || 0,
        chest: Number(chest) || 0, waist: Number(waist) || 0, hips: Number(hips) || 0,
        notes: sanitize(notes || ''), prs: prs || {},
        createdAt: new Date().toISOString(),
      });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 7. DAY PASSES & VISITORS ─────────────────────────────────────────────────
app.get('/api/gyms/:id/passes', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const snap = await db.collection('gyms').doc(req.params.id).collection('passes')
      .orderBy('createdAt', 'desc').limit(100).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gyms/:id/passes', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const { visitorName, email, phone, type, price, startDate, note } = req.body;
    if (!visitorName) return res.status(400).json({ error: 'visitorName required' });
    const start = startDate || new Date().toISOString().slice(0, 10);
    const days = type === 'week' ? 7 : type === 'month' ? 30 : 1;
    const expiry = new Date(start); expiry.setDate(expiry.getDate() + days);
    const ref = await db.collection('gyms').doc(req.params.id).collection('passes').add({
      visitorName: sanitize(visitorName), email: sanitize(email || ''), phone: sanitize(phone || ''),
      type: type || 'day', price: Number(price) || 0, startDate: start,
      expiresAt: expiry.toISOString().slice(0, 10), note: sanitize(note || ''),
      status: 'active', createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/gyms/:id/passes/:passId', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    await db.collection('gyms').doc(req.params.id).collection('passes').doc(req.params.passId)
      .update({ status: req.body.status || 'expired', updatedAt: new Date().toISOString() });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 8. MEMBER MESSAGING ──────────────────────────────────────────────────────
app.get('/api/gyms/:id/messages', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const snap = await db.collection('gyms').doc(req.params.id).collection('messages')
      .orderBy('sentAt', 'desc').limit(50).get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gyms/:id/messages', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const { recipient, recipientId, subject, body } = req.body;
    if (!body) return res.status(400).json({ error: 'body required' });
    const ref = await db.collection('gyms').doc(req.params.id).collection('messages').add({
      recipient: sanitize(recipient || 'All Members'), recipientId: recipientId || null,
      subject: sanitize(subject || ''), body: sanitize(body), sentAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── 9. NUTRITION & DIET PLANS ────────────────────────────────────────────────
app.get('/api/gyms/:id/nutrition', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const snap = await db.collection('gyms').doc(req.params.id).collection('nutrition').orderBy('createdAt', 'desc').get();
    res.json(snap.docs.map(d => ({ id: d.id, ...d.data() })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/gyms/:id/nutrition', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const { name, calories, protein, carbs, fat, meals, notes, assignedTo } = req.body;
    if (!name) return res.status(400).json({ error: 'name required' });
    const ref = await db.collection('gyms').doc(req.params.id).collection('nutrition').add({
      name: sanitize(name), calories: Number(calories) || 0, protein: Number(protein) || 0,
      carbs: Number(carbs) || 0, fat: Number(fat) || 0,
      meals: meals || [], notes: sanitize(notes || ''), assignedTo: assignedTo || [],
      createdAt: new Date().toISOString(),
    });
    res.status(201).json({ id: ref.id });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/gyms/:id/nutrition/:nid', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    const update = { updatedAt: new Date().toISOString() };
    ['name','calories','protein','carbs','fat','meals','notes','assignedTo'].forEach(f => {
      if (req.body[f] !== undefined) update[f] = req.body[f];
    });
    await db.collection('gyms').doc(req.params.id).collection('nutrition').doc(req.params.nid).update(update);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/gyms/:id/nutrition/:nid', verifyToken, async (req, res) => {
  try {
    const gymDoc = await verifyGymOwner(req.params.id, req.uid, res);
    if (!gymDoc) return;
    await db.collection('gyms').doc(req.params.id)
    await db.collection('gyms').doc(req.params.id).collection('nutrition').doc(req.params.nid).delete();
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ============================================================
// ADMIN — PLATFORM HEALTH & MODERATION QUEUE
// ============================================================


// GET /api/challenges/active — returns the current active challenge set by admin (or empty)
app.get('/api/challenges/active', async (req, res) => {
  try {
    const snap = await db.collection('challenges')
      .where('active', '==', true)
      .orderBy('createdAt', 'desc')
      .limit(1).get();
    if (snap.empty) return res.json({ challenge: null });
    const data = snap.docs[0].data();
    res.json({ challenge: { id: snap.docs[0].id, title: data.title, description: data.description, endsAt: data.endsAt } });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/challenges — admin creates a challenge
app.post('/api/challenges', verifyToken, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.uid).get();
    if (userDoc.data()?.accountType !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const { title, description, endsAt } = req.body;
    if (!title) return res.status(400).json({ error: 'title required' });
    // Deactivate any existing active challenges
    const existing = await db.collection('challenges').where('active', '==', true).get();
    const batch = db.batch();
    existing.docs.forEach(d => batch.update(d.ref, { active: false }));
    const newRef = db.collection('challenges').doc();
    batch.set(newRef, { title, description: description || '', endsAt: endsAt || null, active: true, createdAt: new Date().toISOString(), createdBy: req.uid });
    await batch.commit();
    res.json({ id: newRef.id, title });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/challenges/active — admin deactivates the current challenge
app.delete('/api/challenges/active', verifyToken, async (req, res) => {
  try {
    const userDoc = await db.collection('users').doc(req.uid).get();
    if (userDoc.data()?.accountType !== 'admin') return res.status(403).json({ error: 'Admin only' });
    const snap = await db.collection('challenges').where('active', '==', true).get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.update(d.ref, { active: false }));
    await batch.commit();
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// ── KEEP-ALIVE — prevents Render free tier from sleeping ─────────────────────
// Pings itself every 10 minutes so cold-start delay doesn't hit users
const SELF_URL = process.env.RENDER_EXTERNAL_URL || `http://localhost:${process.env.PORT || 5000}`;
setInterval(async () => {
  try {
    const http = require('http'), https = require('https');
    const mod = SELF_URL.startsWith('https') ? https : http;
    mod.get(`${SELF_URL}/api/health`, () => {}).on('error', () => {});
  } catch {}
}, 10 * 60 * 1000); // every 10 minutes

// GET /api/admin/health — API status + signups today + active recently
app.get('/api/admin/health', verifyToken, async (req, res) => {
  try {
    const userSnap = await db.collection('users').get();
    const now = new Date();    const todayStr = now.toDateString();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

    let newToday = 0;
    let activeRecently = 0;
    userSnap.forEach(doc => {
      const d = doc.data();
      if (d.createdAt && new Date(d.createdAt).toDateString() === todayStr) newToday++;
      if (d.lastActive && d.lastActive > oneDayAgo) activeRecently++;
      else if (d.workingOut) activeRecently++;
    });

    res.json({ ok: true, newToday, activeRecently, ts: now.toISOString() });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/posts/:id/report — any authenticated user can report a post
app.post('/api/posts/:id/report', verifyToken, async (req, res) => {
  try {
    const { reason = 'No reason given' } = req.body;
    const postRef = db.collection('posts').doc(req.params.id);
    const postDoc = await postRef.get();
    if (!postDoc.exists) return res.status(404).json({ error: 'Post not found' });

    await db.collection('reportedPosts').add({
      postId: req.params.id,
      reportedBy: req.uid,
      reason: String(reason).slice(0, 300),
      postData: postDoc.data(),
      createdAt: new Date().toISOString(),
      status: 'pending',
    });

    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});
