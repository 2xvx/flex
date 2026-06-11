// createUsers.js
// Run once with: node createUsers.js
// Creates 3 normal users + 2 trainers directly in Firebase Auth + Firestore.

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

// ─── User definitions ─────────────────────────────────────────────────────────

const USERS = [
  // ── Normal users ──
  {
    email: 'sara.ahmed@fitconnect.com',
    password: 'Sara@123456',
    displayName: 'Sara Ahmed',
    username: 'sara_ahmed',
    accountType: 'user',
    bio: 'On a weight loss journey 💪 Down 12kg so far and not stopping!',
    fitnessGoal: 'Weight Loss',
    fitnessLevel: 'Beginner',
    gym: 'Gold\'s Gym Dubai',
    avatar: 'https://ui-avatars.com/api/?name=Sara+Ahmed&background=ec4899&color=fff&size=128',
    followers: 124,
    following: 87,
    workouts: 38,
  },
  {
    email: 'jake.morrison@fitconnect.com',
    password: 'Jake@123456',
    displayName: 'Jake Morrison',
    username: 'jake_lifts',
    accountType: 'user',
    bio: 'Chasing PRs every week 🏋️ Powerlifter by heart, office worker by day.',
    fitnessGoal: 'Build Muscle',
    fitnessLevel: 'Intermediate',
    gym: 'Iron Paradise Gym',
    avatar: 'https://ui-avatars.com/api/?name=Jake+Morrison&background=3b82f6&color=fff&size=128',
    followers: 210,
    following: 143,
    workouts: 95,
  },
  {
    email: 'layla.hassan@fitconnect.com',
    password: 'Layla@123456',
    displayName: 'Layla Hassan',
    username: 'layla_moves',
    accountType: 'user',
    bio: 'Yoga 🧘 + HIIT 🔥 = balance. Posting my daily workouts to stay accountable.',
    fitnessGoal: 'Stay Active',
    fitnessLevel: 'Intermediate',
    gym: 'Anytime Fitness',
    avatar: 'https://ui-avatars.com/api/?name=Layla+Hassan&background=8b5cf6&color=fff&size=128',
    followers: 312,
    following: 201,
    workouts: 67,
  },

  // ── Trainers ──
  {
    email: 'marcus.reid@fitconnect.com',
    password: 'Marcus@123456',
    displayName: 'Marcus Reid',
    username: 'coach_marcus',
    accountType: 'trainer',
    bio: 'Certified strength & conditioning coach. 8 years transforming everyday people into athletes.',
    fitnessGoal: 'Help Others',
    fitnessLevel: 'Expert',
    gym: 'Flex Performance Center',
    avatar: 'https://ui-avatars.com/api/?name=Marcus+Reid&background=f97316&color=fff&size=128',
    followers: 1840,
    following: 95,
    workouts: 430,
    trainerInfo: {
      hourlyRate: 85,
      currency: '$',
      experience: 8,
      specialties: ['Strength Training', 'Powerlifting', 'Muscle Building', 'Sports Performance'],
      sessionTypes: ['online', 'in-person'],
      availability: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        startTime: '07:00',
        endTime: '18:00',
      },
      trainerBio: 'I specialize in evidence-based strength programming. Whether you\'re a complete beginner or an experienced lifter, I build personalized programs that get real results. My clients average a 30% strength increase in 12 weeks.',
      rating: 4.9,
      totalSessions: 512,
    },
  },
  {
    email: 'aisha.karimi@fitconnect.com',
    password: 'Aisha@123456',
    displayName: 'Aisha Karimi',
    username: 'aisha_fit',
    accountType: 'trainer',
    bio: 'HIIT specialist & certified nutritionist 🥗 I help busy women lose weight without starving.',
    fitnessGoal: 'Help Others',
    fitnessLevel: 'Expert',
    gym: 'FitLife Studio',
    avatar: 'https://ui-avatars.com/api/?name=Aisha+Karimi&background=10b981&color=fff&size=128',
    followers: 3250,
    following: 112,
    workouts: 290,
    trainerInfo: {
      hourlyRate: 70,
      currency: '$',
      experience: 5,
      specialties: ['HIIT', 'Weight Loss', 'Nutrition', 'Cardio', 'Flexibility'],
      sessionTypes: ['online', 'in-person'],
      availability: {
        days: ['Monday', 'Wednesday', 'Friday', 'Saturday'],
        startTime: '06:00',
        endTime: '15:00',
      },
      trainerBio: 'I created my own fat-loss method combining HIIT and smart nutrition — 200+ women have used it to lose weight sustainably. No crash diets, no burnout. Just results that last.',
      rating: 4.8,
      totalSessions: 318,
    },
  },
];

// ─── Create function ──────────────────────────────────────────────────────────

async function createUser(userData) {
  const { email, password, displayName, username, accountType, bio,
          fitnessGoal, fitnessLevel, gym, avatar, followers, following,
          workouts, trainerInfo } = userData;

  try {
    // Check if already exists
    let userRecord;
    try {
      userRecord = await admin.auth().getUserByEmail(email);
      console.log(`⚠️  Already exists: ${displayName} (${email})`);
    } catch {
      // Create in Firebase Auth
      userRecord = await admin.auth().createUser({ email, password, displayName });
      console.log(`✅ Created auth: ${displayName}`);
    }

    // Write / overwrite Firestore profile
    const profile = {
      email, displayName, username, accountType,
      bio, fitnessGoal, fitnessLevel, gym, avatar,
      followers: followers ?? 0,
      following:  following ?? 0,
      workouts:   workouts  ?? 0,
      createdAt: new Date().toISOString(),
    };
    if (trainerInfo) profile.trainerInfo = trainerInfo;

    await db.collection('users').doc(userRecord.uid).set(profile, { merge: true });
    console.log(`   📝 Firestore profile saved for ${displayName}`);
    console.log(`   🆔 UID: ${userRecord.uid}`);
    console.log(`   📧 Email: ${email}`);
    console.log(`   🔑 Password: ${password}`);
    console.log('');

    return { uid: userRecord.uid, ...profile };
  } catch (err) {
    console.error(`❌ Failed to create ${displayName}:`, err.message);
    return null;
  }
}

// ─── Run ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('');
  console.log('════════════════════════════════════════');
  console.log('  FitConnect — Creating test users');
  console.log('════════════════════════════════════════');
  console.log('');

  const results = [];
  for (const user of USERS) {
    const result = await createUser(user);
    if (result) results.push(result);
  }

  console.log('════════════════════════════════════════');
  console.log(`  Done! ${results.length}/${USERS.length} users ready.`);
  console.log('════════════════════════════════════════');
  console.log('');
  console.log('Login credentials:');
  USERS.forEach(u => {
    console.log(`  [${u.accountType.toUpperCase().padEnd(7)}] ${u.displayName.padEnd(20)} ${u.email} / ${u.password}`);
  });
  console.log('');

  process.exit(0);
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
