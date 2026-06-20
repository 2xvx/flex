/**
 * FLEX — Full Demo Seed (ALL features)
 * Run: node backend/seedAll.js
 *
 * Covers: Feed, Reels/Clips, Programs, PRs, Meals, Habits,
 *         Goals, Nutrition, Progress Photos, Communities, Challenges
 */

require('dotenv').config();
const admin = require('firebase-admin');
const path  = require('path');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(
      require(path.join(__dirname, 'serviceAccountKey.json'))
    ),
  });
}
const db   = admin.firestore();
const auth = admin.auth();

const OWNER_EMAIL = 'mohammaddarsani@gmail.com';

// ─── Demo users (same as seedDemo) ───────────────────────────────────────────
const DEMO_USERS = [
  {
    email: 'alex.carter.flex@gmail.com', password: 'Flex@demo1',
    displayName: 'Alex Carter', username: 'alexcarter', accountType: 'user',
    bio: 'Powerlifter 🏋️ | 4x bodyweight deadlift club | Chasing PRs every day',
    fitnessGoal: 'Build Strength', fitnessLevel: 'Advanced', gym: 'Iron House Gym', location: 'Los Angeles, CA',
    avatar: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=200&h=200&fit=crop&crop=face',
    workouts: 312, followers: 1840, following: 203,
  },
  {
    email: 'sofia.mendez.flex@gmail.com', password: 'Flex@demo2',
    displayName: 'Sofia Mendez', username: 'sofiamendez', accountType: 'trainer',
    bio: 'NASM Certified Trainer 💪 | Specialising in women\'s strength | DMs open for coaching',
    fitnessGoal: 'Help Others', fitnessLevel: 'Expert', gym: 'EliteFit Studio', location: 'Miami, FL',
    avatar: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=200&h=200&fit=crop&crop=face',
    workouts: 540, followers: 4200, following: 310,
  },
  {
    email: 'james.okafor.flex@gmail.com', password: 'Flex@demo3',
    displayName: 'James Okafor', username: 'jamesokafor', accountType: 'user',
    bio: 'Marathon runner 🏃 + gym rat. Sub-3hr marathon & 200kg squat. Yes, both.',
    fitnessGoal: 'Endurance', fitnessLevel: 'Advanced', gym: 'City Athletics', location: 'New York, NY',
    avatar: 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=200&h=200&fit=crop&crop=face',
    workouts: 489, followers: 2100, following: 445,
  },
  {
    email: 'priya.sharma.flex@gmail.com', password: 'Flex@demo4',
    displayName: 'Priya Sharma', username: 'priyasharma', accountType: 'user',
    bio: 'Yoga + weightlifting ✨ proving they go together. Wellness over everything.',
    fitnessGoal: 'Flexibility & Strength', fitnessLevel: 'Intermediate', gym: 'Zen & Iron', location: 'Austin, TX',
    avatar: 'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=200&h=200&fit=crop&crop=face',
    workouts: 210, followers: 980, following: 320,
  },
  {
    email: 'marcus.bell.flex@gmail.com', password: 'Flex@demo5',
    displayName: 'Marcus Bell', username: 'marcusbell', accountType: 'user',
    bio: 'Body recomp journey 📉📈 | -30kg in 8 months | Proof that consistency > motivation',
    fitnessGoal: 'Lose Weight', fitnessLevel: 'Beginner', gym: 'Planet Fitness', location: 'Chicago, IL',
    avatar: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=200&h=200&fit=crop&crop=face',
    workouts: 98, followers: 560, following: 180,
  },
  {
    email: 'luna.park.flex@gmail.com', password: 'Flex@demo6',
    displayName: 'Luna Park', username: 'lunapark', accountType: 'user',
    bio: 'CrossFit Level 2 | Box owner @CrossFitSeoul | Coffee → WOD → repeat ☕🔥',
    fitnessGoal: 'Athletic Performance', fitnessLevel: 'Advanced', gym: 'CrossFit Seoul', location: 'Seoul, South Korea',
    avatar: 'https://images.unsplash.com/photo-1609899537878-48700f6a16c1?w=200&h=200&fit=crop&crop=face',
    workouts: 720, followers: 3300, following: 270,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const today     = new Date();
const daysAgo   = (n) => new Date(today - n * 86400000).toISOString().split('T')[0];
const hoursAgo  = (n) => new Date(Date.now() - n * 3600000).toISOString();
const minsAgo   = (n) => new Date(Date.now() - n * 60000).toISOString();

// ─── Main ─────────────────────────────────────────────────────────────────────
async function seedAll() {
  console.log('\n🌱 FLEX FULL SEED STARTING...\n');

  // ── 1. Resolve owner UID ──────────────────────────────────────────────────
  let ownerUid;
  try {
    ownerUid = (await auth.getUserByEmail(OWNER_EMAIL)).uid;
    console.log(`✅ Owner: ${OWNER_EMAIL} → ${ownerUid}`);
  } catch {
    console.error(`❌ Owner not found for ${OWNER_EMAIL}. Log in first.`);
    process.exit(1);
  }

  // ── 2. Create / upsert demo users ─────────────────────────────────────────
  const userMap = {}; // username → uid
  for (const u of DEMO_USERS) {
    try {
      let record;
      try { record = await auth.getUserByEmail(u.email); console.log(`♻️  ${u.username}`); }
      catch { record = await auth.createUser({ email: u.email, password: u.password, displayName: u.displayName }); console.log(`✅ Created ${u.username}`); }
      userMap[u.username] = record.uid;
      await db.collection('users').doc(record.uid).set({
        email: u.email, displayName: u.displayName, username: u.username,
        accountType: u.accountType, bio: u.bio, fitnessGoal: u.fitnessGoal,
        fitnessLevel: u.fitnessLevel, gym: u.gym || '', location: u.location || '',
        avatar: u.avatar, workouts: u.workouts, followers: u.followers, following: u.following,
        createdAt: hoursAgo(Math.floor(Math.random() * 2160)),
      }, { merge: true });
    } catch (e) { console.error(`❌ ${u.username}:`, e.message); }
  }
  const uid = (username) => userMap[username];
  const userObj = (username) => {
    const u = DEMO_USERS.find(x => x.username === username);
    return { id: uid(username), name: u.displayName, username: u.username, avatar: u.avatar };
  };
  const ownerObj = { id: ownerUid, name: 'Mohamad', username: 'mohamad', avatar: '' };

  // ── 3. Follows ────────────────────────────────────────────────────────────
  const followBatch = db.batch();
  for (const [username, dUid] of Object.entries(userMap)) {
    followBatch.set(db.collection('follows').doc(`${ownerUid}_${dUid}`),
      { followerId: ownerUid, followingId: dUid, createdAt: hoursAgo(48) }, { merge: true });
    followBatch.set(db.collection('follows').doc(`${dUid}_${ownerUid}`),
      { followerId: dUid, followingId: ownerUid, createdAt: hoursAgo(48) }, { merge: true });
  }
  const pairs = [
    ['alexcarter','sofiamendez'],['alexcarter','jamesokafor'],['alexcarter','lunapark'],
    ['sofiamendez','alexcarter'],['sofiamendez','jamesokafor'],['sofiamendez','priyasharma'],
    ['sofiamendez','marcusbell'],['jamesokafor','lunapark'],['jamesokafor','alexcarter'],
    ['priyasharma','sofiamendez'],['priyasharma','lunapark'],['marcusbell','sofiamendez'],
    ['marcusbell','lunapark'],['lunapark','alexcarter'],['lunapark','jamesokafor'],
  ];
  for (const [a, b] of pairs) {
    followBatch.set(db.collection('follows').doc(`${uid(a)}_${uid(b)}`),
      { followerId: uid(a), followingId: uid(b), createdAt: hoursAgo(72) }, { merge: true });
  }
  await followBatch.commit();
  console.log('✅ Follows');

  // ── 4. Feed posts ─────────────────────────────────────────────────────────
  const posts = [
    {
      user: userObj('alexcarter'), type: 'workout', workoutType: 'Strength',
      duration: 75, calories: 620,
      exercises: [
        { name: 'Deadlift', sets: 5, reps: 3, weight: 220 },
        { name: 'Squat', sets: 4, reps: 5, weight: 180 },
        { name: 'Bench Press', sets: 4, reps: 6, weight: 140 },
        { name: 'Barbell Row', sets: 3, reps: 8, weight: 100 },
      ],
      caption: '220kg deadlift PR today 🔥 6 months ago this was my 1RM. Trust the process.',
      image: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=800&h=600&fit=crop',
      isPR: true,
      likes: 142, likedBy: [uid('sofiamendez'), uid('jamesokafor'), uid('lunapark'), ownerUid],
      comments: [
        { id: 'c1', user: userObj('sofiamendez'), text: 'BEAST MODE 🔥🔥🔥', createdAt: hoursAgo(2), likes: 8, likedBy: [] },
        { id: 'c2', user: userObj('jamesokafor'), text: 'What program are you running?', createdAt: hoursAgo(1), likes: 3, likedBy: [] },
        { id: 'c3', user: ownerObj, text: 'Insane!! You\'re built different 💪', createdAt: minsAgo(30), likes: 2, likedBy: [] },
      ],
      createdAt: hoursAgo(3),
    },
    {
      user: userObj('sofiamendez'), type: 'workout', workoutType: 'HIIT',
      duration: 45, calories: 480,
      exercises: [
        { name: 'Box Jumps', sets: 4, reps: 10, weight: 0 },
        { name: 'Kettlebell Swings', sets: 4, reps: 20, weight: 24 },
        { name: 'Battle Ropes', sets: 3, reps: 30, weight: 0 },
        { name: 'Sled Push', sets: 3, reps: 1, weight: 80 },
      ],
      caption: '45 min HIIT session with my 6am crew 🌅 These women show up EVERY. SINGLE. DAY.',
      image: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=800&h=600&fit=crop',
      likes: 318, likedBy: [uid('alexcarter'), uid('jamesokafor'), uid('lunapark'), uid('priyasharma'), uid('marcusbell'), ownerUid],
      comments: [
        { id: 'c4', user: userObj('priyasharma'), text: 'This is goals 🙌', createdAt: hoursAgo(5), likes: 12, likedBy: [] },
        { id: 'c5', user: userObj('marcusbell'), text: 'Sofia you\'re literally the reason I don\'t skip mornings anymore 💪', createdAt: hoursAgo(4), likes: 27, likedBy: [] },
        { id: 'c6', user: ownerObj, text: 'Incredible motivation 🔥', createdAt: hoursAgo(3), likes: 5, likedBy: [] },
      ],
      createdAt: hoursAgo(6),
    },
    {
      user: userObj('sofiamendez'), type: 'motivation', workoutType: '',
      duration: 0, calories: 0, exercises: [],
      caption: 'Hot take: you don\'t need motivation. You need a system.\n\nMotivation is a feeling — it comes and goes. Systems are decisions made in advance. Stop waiting to feel like it. 🧠💪',
      image: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&h=600&fit=crop',
      likes: 512, likedBy: [uid('alexcarter'), uid('jamesokafor'), uid('lunapark'), uid('priyasharma'), uid('marcusbell'), ownerUid],
      comments: [
        { id: 'c7', user: userObj('jamesokafor'), text: 'This is the post I needed today. Screenshotted.', createdAt: hoursAgo(14), likes: 44, likedBy: [] },
        { id: 'c8', user: userObj('lunapark'), text: 'Systems > feelings 🙌 preach!!', createdAt: hoursAgo(13), likes: 31, likedBy: [] },
      ],
      createdAt: hoursAgo(15),
    },
    {
      user: userObj('jamesokafor'), type: 'run', workoutType: 'Cardio',
      duration: 95, calories: 780, distance: 21.1, runTime: '1:38:42', pace: '4:41/km',
      exercises: [],
      caption: 'Half marathon done before breakfast ☀️ New PB by 4 minutes. The morning shifts are undefeated.',
      image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&h=600&fit=crop',
      isPR: true,
      likes: 203, likedBy: [uid('alexcarter'), uid('sofiamendez'), uid('lunapark'), ownerUid],
      comments: [
        { id: 'c9', user: userObj('sofiamendez'), text: 'Before BREAKFAST?? You are not human 😂🔥', createdAt: hoursAgo(7), likes: 55, likedBy: [] },
      ],
      createdAt: hoursAgo(8),
    },
    {
      user: userObj('marcusbell'), type: 'progress', workoutType: 'Progress',
      duration: 0, calories: 0, exercises: [], weight: 85, bodyFat: 18,
      caption: '8 months in 📸 Starting weight was 115kg. Now 85kg. Never giving up on this journey 💪 #Transformation',
      image: 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&h=600&fit=crop',
      likes: 487, likedBy: [uid('alexcarter'), uid('sofiamendez'), uid('jamesokafor'), uid('priyasharma'), uid('lunapark'), ownerUid],
      comments: [
        { id: 'c10', user: userObj('sofiamendez'), text: 'Marcus this literally made me tear up 🥹 You should be SO proud!!', createdAt: hoursAgo(2), likes: 64, likedBy: [] },
        { id: 'c11', user: userObj('alexcarter'), text: '30kg down is life-changing bro. Respect 🤝', createdAt: hoursAgo(1), likes: 38, likedBy: [] },
        { id: 'c12', user: ownerObj, text: 'Proof that Flex works 💪 so proud of you man!', createdAt: minsAgo(20), likes: 15, likedBy: [] },
      ],
      createdAt: hoursAgo(3),
    },
    {
      user: userObj('priyasharma'), type: 'workout', workoutType: 'Yoga',
      duration: 60, calories: 280,
      exercises: [
        { name: 'Sun Salutations', sets: 3, reps: 10, weight: 0 },
        { name: 'Warrior Sequence', sets: 2, reps: 5, weight: 0 },
        { name: 'Handstand Work', sets: 5, reps: 3, weight: 0 },
      ],
      caption: 'Morning flow ✨ Handstand holds are getting so much more controlled!',
      image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=600&fit=crop',
      likes: 241, likedBy: [uid('sofiamendez'), uid('jamesokafor'), uid('lunapark'), uid('marcusbell'), ownerUid],
      comments: [
        { id: 'c13', user: userObj('sofiamendez'), text: 'Your handstands are getting incredible!! 🙌✨', createdAt: hoursAgo(10), likes: 18, likedBy: [] },
      ],
      createdAt: hoursAgo(11),
    },
    {
      user: userObj('lunapark'), type: 'motivation', workoutType: '',
      duration: 0, calories: 0, exercises: [],
      caption: '5 things that changed my fitness forever:\n\n1️⃣ Tracking my workouts\n2️⃣ Sleeping 8 hours religiously\n3️⃣ Finding a community, not just a gym\n4️⃣ Protein first, every meal\n5️⃣ Comparing myself only to who I was yesterday\n\nSimple. Not easy. Worth it. 🏆',
      image: 'https://images.unsplash.com/photo-1552196563-55cd4e45efb3?w=800&h=600&fit=crop',
      likes: 891, likedBy: [uid('alexcarter'), uid('sofiamendez'), uid('jamesokafor'), uid('priyasharma'), uid('marcusbell'), ownerUid],
      comments: [
        { id: 'c14', user: userObj('marcusbell'), text: 'Number 3 is everything. Finding this community literally changed my life', createdAt: hoursAgo(17), likes: 87, likedBy: [] },
        { id: 'c15', user: userObj('jamesokafor'), text: 'Save this post everyone. This is the list.', createdAt: hoursAgo(16), likes: 61, likedBy: [] },
      ],
      createdAt: hoursAgo(18),
    },
    {
      user: ownerObj, type: 'workout', workoutType: 'Push',
      duration: 65, calories: 490,
      exercises: [
        { name: 'Bench Press', sets: 4, reps: 8, weight: 100 },
        { name: 'Incline DB Press', sets: 3, reps: 10, weight: 36 },
        { name: 'Cable Fly', sets: 3, reps: 12, weight: 25 },
        { name: 'Tricep Pushdown', sets: 3, reps: 15, weight: 35 },
        { name: 'Lateral Raises', sets: 4, reps: 15, weight: 12 },
      ],
      caption: 'Push day locked in 🔒 Been consistent for 3 weeks now and the pumps are getting real. Grind don\'t stop 💪',
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop',
      likes: 98, likedBy: [uid('alexcarter'), uid('sofiamendez'), uid('lunapark')],
      comments: [
        { id: 'c16', user: userObj('sofiamendez'), text: 'Building an app AND staying consistent?? Respect the grind 🙌', createdAt: hoursAgo(12), likes: 14, likedBy: [] },
        { id: 'c17', user: userObj('alexcarter'), text: 'Solid numbers bro! Bench going up?', createdAt: hoursAgo(11), likes: 6, likedBy: [] },
      ],
      createdAt: hoursAgo(13),
    },
    // Challenge post
    {
      user: userObj('sofiamendez'), type: 'workout', workoutType: 'Challenge',
      duration: 0, calories: 0, exercises: [],
      caption: '🏆 30-DAY STRENGTH CHALLENGE — starting Monday!\n\nJoin me for 30 days of progressive overload. All levels welcome.\n\nComment "IN" to join! 💪 #30DayChallenge #FlexChallenge',
      image: 'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=800&h=600&fit=crop',
      isChallenge: true, challengeTitle: '30-Day Strength Challenge',
      challengeParticipants: [uid('sofiamendez'), uid('alexcarter'), uid('jamesokafor'), uid('lunapark'), uid('marcusbell'), ownerUid],
      likes: 234, likedBy: [uid('alexcarter'), uid('jamesokafor'), uid('lunapark'), uid('marcusbell'), ownerUid],
      comments: [
        { id: 'ch1', user: userObj('alexcarter'), text: 'IN 💪🔥', createdAt: hoursAgo(3), likes: 12, likedBy: [] },
        { id: 'ch2', user: userObj('marcusbell'), text: 'IN!! First challenge ever. Nervous but ready 😤', createdAt: hoursAgo(2), likes: 28, likedBy: [] },
        { id: 'ch3', user: ownerObj, text: 'IN! Let\'s goooo 🔥', createdAt: hoursAgo(1), likes: 9, likedBy: [] },
      ],
      createdAt: hoursAgo(4),
    },
  ];

  for (const post of posts) {
    await db.collection('posts').add({
      ...post,
      visibility: 'public',
      reactions: { heart: Math.floor(Math.random()*30), fire: Math.floor(Math.random()*20), strong: Math.floor(Math.random()*15), clap: Math.floor(Math.random()*10) },
      userReactions: {},
    });
  }
  console.log(`✅ Feed posts (${posts.length})`);

  // ── 5. Reels / Clips (2 video posts) ─────────────────────────────────────
  // These are free public MP4s — real fitness workout clips
  const reelPosts = [
    {
      user: userObj('lunapark'),
      type: 'workout', workoutType: 'CrossFit',
      duration: 0, calories: 0, exercises: [],
      caption: '🔥 WOD highlight — 100 wall balls for time. 6:42. New PR!! The lungs wanted to quit, the mind said no. #CrossFit #WOD #Reels',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
      image: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&h=600&fit=crop',
      likes: 344, likedBy: [uid('alexcarter'), uid('sofiamendez'), uid('jamesokafor'), ownerUid],
      comments: [
        { id: 'r1', user: userObj('alexcarter'), text: 'That pace is INSANE 🔥', createdAt: hoursAgo(1), likes: 22, likedBy: [] },
        { id: 'r2', user: userObj('sofiamendez'), text: 'Luna you are an absolute machine 😤💪', createdAt: minsAgo(45), likes: 19, likedBy: [] },
        { id: 'r3', user: ownerObj, text: 'Clipping this for motivation forever 🙌', createdAt: minsAgo(20), likes: 8, likedBy: [] },
      ],
      isPR: true, visibility: 'public', createdAt: hoursAgo(2),
      reactions: { heart: 28, fire: 67, strong: 44, clap: 15 }, userReactions: {},
    },
    {
      user: userObj('alexcarter'),
      type: 'workout', workoutType: 'Strength',
      duration: 0, calories: 0, exercises: [],
      caption: '220kg deadlift form check 📹 Finally hitting depth consistently. 3 years in the making. Drop a 💪 if you want the program!',
      videoUrl: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
      image: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=800&h=600&fit=crop',
      likes: 521, likedBy: [uid('sofiamendez'), uid('jamesokafor'), uid('lunapark'), uid('priyasharma'), uid('marcusbell'), ownerUid],
      comments: [
        { id: 'r4', user: userObj('sofiamendez'), text: 'Form is PERFECT. Textbook hinge 🙌', createdAt: hoursAgo(5), likes: 41, likedBy: [] },
        { id: 'r5', user: userObj('jamesokafor'), text: 'The lockout is clean bro! Send program 💪💪', createdAt: hoursAgo(4), likes: 26, likedBy: [] },
        { id: 'r6', user: ownerObj, text: '💪💪💪 sending program pls!!', createdAt: hoursAgo(3), likes: 11, likedBy: [] },
      ],
      visibility: 'public', createdAt: hoursAgo(6),
      reactions: { heart: 45, fire: 89, strong: 72, clap: 33 }, userReactions: {},
    },
  ];
  for (const reel of reelPosts) {
    await db.collection('posts').add(reel);
  }
  console.log('✅ Reels/Clips (2 video posts)');

  // ── 6. Programs ───────────────────────────────────────────────────────────
  const programs = [
    {
      name: 'Sofia\'s 8-Week Strength Foundation',
      description: 'Perfect for beginners to intermediate lifters. Build a solid base of strength with progressive overload, 4 days/week. Used by 200+ of my clients.',
      isPublic: true,
      authorId: uid('sofiamendez'),
      author: userObj('sofiamendez'),
      saves: 87,
      difficulty: 'Intermediate',
      goal: 'Build Strength',
      daysPerWeek: 4,
      weeks: [
        {
          weekNumber: 1, label: 'Week 1 — Foundation',
          days: [
            { day: 1, label: 'Upper A', exercises: [{ name: 'Bench Press', sets: 3, reps: 8, weight: 0 }, { name: 'Barbell Row', sets: 3, reps: 8, weight: 0 }, { name: 'Overhead Press', sets: 3, reps: 10, weight: 0 }] },
            { day: 2, label: 'Lower A', exercises: [{ name: 'Squat', sets: 3, reps: 8, weight: 0 }, { name: 'Romanian Deadlift', sets: 3, reps: 10, weight: 0 }, { name: 'Leg Press', sets: 3, reps: 12, weight: 0 }] },
            { day: 3, label: 'Rest / Cardio', exercises: [] },
            { day: 4, label: 'Upper B', exercises: [{ name: 'Incline DB Press', sets: 3, reps: 10, weight: 0 }, { name: 'Pull-ups', sets: 3, reps: 6, weight: 0 }, { name: 'Lateral Raises', sets: 3, reps: 15, weight: 0 }] },
            { day: 5, label: 'Lower B', exercises: [{ name: 'Deadlift', sets: 3, reps: 5, weight: 0 }, { name: 'Bulgarian Split Squat', sets: 3, reps: 10, weight: 0 }, { name: 'Calf Raises', sets: 4, reps: 15, weight: 0 }] },
          ],
        },
      ],
      createdAt: hoursAgo(240),
    },
    {
      name: 'Alex\'s Powerlifting Peaking Block',
      description: '6-week peaking program for your next powerlifting meet. Squat, bench, deadlift focused. Not for beginners.',
      isPublic: true,
      authorId: uid('alexcarter'),
      author: userObj('alexcarter'),
      saves: 143,
      difficulty: 'Advanced',
      goal: 'Powerlifting',
      daysPerWeek: 4,
      weeks: [
        {
          weekNumber: 1, label: 'Week 1 — Volume',
          days: [
            { day: 1, label: 'Squat + Accessory', exercises: [{ name: 'Back Squat', sets: 5, reps: 5, weight: 0 }, { name: 'Pause Squat', sets: 3, reps: 3, weight: 0 }, { name: 'Leg Press', sets: 3, reps: 10, weight: 0 }] },
            { day: 2, label: 'Bench + Accessory', exercises: [{ name: 'Bench Press', sets: 5, reps: 5, weight: 0 }, { name: 'Close Grip Bench', sets: 3, reps: 6, weight: 0 }, { name: 'Tricep Dips', sets: 3, reps: 10, weight: 0 }] },
            { day: 3, label: 'Deadlift + Accessory', exercises: [{ name: 'Conventional Deadlift', sets: 5, reps: 3, weight: 0 }, { name: 'Romanian Deadlift', sets: 3, reps: 6, weight: 0 }, { name: 'Barbell Row', sets: 3, reps: 8, weight: 0 }] },
          ],
        },
      ],
      createdAt: hoursAgo(120),
    },
    {
      name: 'Luna\'s CrossFit Beginner 30-Day',
      description: 'New to CrossFit? This 30-day intro program eases you into functional fitness. Daily WODs scaled for beginners. Join 500+ people who started here.',
      isPublic: true,
      authorId: uid('lunapark'),
      author: userObj('lunapark'),
      saves: 212,
      difficulty: 'Beginner',
      goal: 'Fitness',
      daysPerWeek: 5,
      weeks: [
        {
          weekNumber: 1, label: 'Week 1 — Movement Basics',
          days: [
            { day: 1, label: 'Day 1 — Air Squats & Push-ups', exercises: [{ name: 'Air Squat', sets: 4, reps: 15, weight: 0 }, { name: 'Push-ups', sets: 4, reps: 10, weight: 0 }, { name: 'Plank', sets: 3, reps: 1, weight: 0 }] },
            { day: 2, label: 'Day 2 — KB Intro', exercises: [{ name: 'KB Deadlift', sets: 3, reps: 10, weight: 16 }, { name: 'KB Goblet Squat', sets: 3, reps: 10, weight: 16 }, { name: 'KB Swing', sets: 3, reps: 15, weight: 16 }] },
            { day: 3, label: 'Day 3 — Cardio', exercises: [{ name: 'Row 1000m', sets: 1, reps: 1, weight: 0 }, { name: 'Jump Rope', sets: 3, reps: 50, weight: 0 }] },
          ],
        },
      ],
      createdAt: hoursAgo(72),
    },
    {
      name: 'My Push Pull Legs',
      description: 'My personal PPL program. 6 days/week, progressive overload.',
      isPublic: true,
      authorId: ownerUid,
      author: ownerObj,
      saves: 12,
      difficulty: 'Intermediate',
      goal: 'Build Muscle',
      daysPerWeek: 6,
      weeks: [
        {
          weekNumber: 1, label: 'Week 1',
          days: [
            { day: 1, label: 'Push', exercises: [{ name: 'Bench Press', sets: 4, reps: 8, weight: 100 }, { name: 'Overhead Press', sets: 3, reps: 10, weight: 70 }, { name: 'Lateral Raises', sets: 4, reps: 15, weight: 12 }] },
            { day: 2, label: 'Pull', exercises: [{ name: 'Deadlift', sets: 3, reps: 5, weight: 140 }, { name: 'Pull-ups', sets: 4, reps: 8, weight: 0 }, { name: 'Barbell Row', sets: 4, reps: 8, weight: 80 }] },
            { day: 3, label: 'Legs', exercises: [{ name: 'Squat', sets: 4, reps: 6, weight: 120 }, { name: 'Leg Press', sets: 3, reps: 12, weight: 200 }, { name: 'Calf Raises', sets: 4, reps: 20, weight: 60 }] },
          ],
        },
      ],
      createdAt: hoursAgo(48),
    },
  ];
  for (const prog of programs) {
    await db.collection('programs').add({ ...prog });
  }
  console.log(`✅ Programs (${programs.length})`);

  // ── 7. Personal Records (for owner) ──────────────────────────────────────
  const prs = [
    { exercise: 'Bench Press',      weight: 110, reps: 3,  notes: 'Finally broke the 110 barrier!', date: daysAgo(2)  },
    { exercise: 'Bench Press',      weight: 100, reps: 5,  notes: '', date: daysAgo(14) },
    { exercise: 'Bench Press',      weight: 95,  reps: 5,  notes: '', date: daysAgo(30) },
    { exercise: 'Squat',            weight: 130, reps: 5,  notes: 'Depth felt solid', date: daysAgo(3)  },
    { exercise: 'Squat',            weight: 120, reps: 5,  notes: '', date: daysAgo(20) },
    { exercise: 'Deadlift',         weight: 160, reps: 3,  notes: '🔥 Grip held the whole way', date: daysAgo(1)  },
    { exercise: 'Deadlift',         weight: 150, reps: 3,  notes: '', date: daysAgo(18) },
    { exercise: 'Overhead Press',   weight: 75,  reps: 5,  notes: '', date: daysAgo(5)  },
    { exercise: 'Incline DB Press', weight: 40,  reps: 5,  notes: 'PR — up from 36', date: daysAgo(4)  },
    { exercise: 'Incline DB Press', weight: 36,  reps: 7,  notes: '', date: daysAgo(22) },
    { exercise: 'Pull-ups',         weight: 104, reps: 2,  notes: 'Weighted pull-up bodyweight + 20kg plate', date: daysAgo(40) },
    { exercise: 'Barbell Row',      weight: 90,  reps: 8,  notes: 'Clean reps, no body English', date: daysAgo(7)  },
  ];
  for (const pr of prs) {
    await db.collection('personal_records').add({ userId: ownerUid, ...pr, createdAt: new Date(pr.date).toISOString() });
  }
  console.log(`✅ Personal Records (${prs.length})`);

  // ── 8. Healthy Meals (posted by Sofia = trainer) ──────────────────────────
  const meals = [
    {
      name: 'High Protein Chicken Bowl',
      description: 'My go-to post-workout meal. Simple, fast, and hits 50g protein easily.',
      category: 'lunch',
      calories: 620, protein: 52, carbs: 58, fat: 14,
      ingredients: ['200g chicken breast', '150g brown rice', '1 cup broccoli', '1 tbsp olive oil', 'Salt, pepper, garlic powder'],
      instructions: 'Cook rice. Season and grill chicken 6 min each side. Steam broccoli. Assemble and drizzle oil.',
      photo: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop',
      authorId: uid('sofiamendez'), authorName: 'Sofia Mendez', authorAvatar: DEMO_USERS[1].avatar,
      saves: 124, createdAt: hoursAgo(48),
    },
    {
      name: 'Pre-Workout Oatmeal Power Bowl',
      description: 'Eat this 90 mins before training. Slow carbs + protein = sustained energy.',
      category: 'breakfast',
      calories: 480, protein: 28, carbs: 72, fat: 10,
      ingredients: ['100g rolled oats', '1 scoop vanilla protein', '1 banana', '1 tbsp almond butter', '200ml almond milk', 'Blueberries'],
      instructions: 'Cook oats with almond milk. Stir in protein powder off heat. Top with banana, almond butter, and blueberries.',
      photo: 'https://images.unsplash.com/photo-1484723091739-30990806eb62?w=800&h=600&fit=crop',
      authorId: uid('sofiamendez'), authorName: 'Sofia Mendez', authorAvatar: DEMO_USERS[1].avatar,
      saves: 98, createdAt: hoursAgo(72),
    },
    {
      name: 'Vegan Protein Buddha Bowl',
      description: 'Proof you can hit 42g protein with zero meat. My most requested recipe.',
      category: 'dinner',
      calories: 520, protein: 42, carbs: 55, fat: 18,
      ingredients: ['150g quinoa', '1 can chickpeas (roasted)', '200g firm tofu', '2 tbsp tahini', 'Lemon juice', 'Mixed greens'],
      instructions: 'Cook quinoa. Roast chickpeas at 200°C for 25min. Pan-fry tofu. Mix tahini + lemon for dressing. Assemble.',
      photo: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=800&h=600&fit=crop',
      authorId: uid('priyasharma'), authorName: 'Priya Sharma', authorAvatar: DEMO_USERS[3].avatar,
      saves: 71, createdAt: hoursAgo(96),
    },
    {
      name: 'Overnight Protein Oats',
      description: 'Zero morning prep. Make it the night before and it\'s ready when you wake up.',
      category: 'breakfast',
      calories: 410, protein: 34, carbs: 48, fat: 8,
      ingredients: ['80g oats', '1 scoop chocolate protein', '200ml Greek yogurt', '1 tbsp chia seeds', '100ml milk'],
      instructions: 'Mix everything in a jar. Seal and refrigerate overnight. Top with berries in the morning.',
      photo: 'https://images.unsplash.com/photo-1571748982800-fa51082c2224?w=800&h=600&fit=crop',
      authorId: uid('sofiamendez'), authorName: 'Sofia Mendez', authorAvatar: DEMO_USERS[1].avatar,
      saves: 156, createdAt: hoursAgo(120),
    },
    {
      name: 'Salmon & Sweet Potato Recovery Meal',
      description: 'Best post-leg-day meal. Omega-3 reduces inflammation, sweet potato refills glycogen.',
      category: 'dinner',
      calories: 580, protein: 44, carbs: 52, fat: 16,
      ingredients: ['200g salmon fillet', '1 large sweet potato', '2 cups spinach', '1 tbsp olive oil', 'Lemon, dill, garlic'],
      instructions: 'Bake sweet potato 45min at 200°C. Season and pan-sear salmon 4 min each side. Wilt spinach. Serve.',
      photo: 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=800&h=600&fit=crop',
      authorId: uid('sofiamendez'), authorName: 'Sofia Mendez', authorAvatar: DEMO_USERS[1].avatar,
      saves: 203, createdAt: hoursAgo(144),
    },
  ];
  for (const meal of meals) {
    await db.collection('meals').add(meal);
  }
  console.log(`✅ Meals (${meals.length})`);

  // ── 9. Habits (for owner) ─────────────────────────────────────────────────
  const habitsRef = db.collection('users').doc(ownerUid).collection('habits');
  const habits = [
    { name: 'Take Creatine', type: 'supplement', icon: '💊', frequency: 'daily', streak: 14, completedDates: [daysAgo(0), daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(4), daysAgo(5), daysAgo(6), daysAgo(7), daysAgo(8), daysAgo(9), daysAgo(10), daysAgo(11), daysAgo(12), daysAgo(13)], createdAt: hoursAgo(336) },
    { name: 'Whey Protein Post-Workout', type: 'supplement', icon: '🥛', frequency: 'daily', streak: 21, completedDates: [daysAgo(0), daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(4), daysAgo(5), daysAgo(6), daysAgo(7), daysAgo(8), daysAgo(9), daysAgo(10), daysAgo(11), daysAgo(12), daysAgo(13), daysAgo(14), daysAgo(15), daysAgo(16), daysAgo(17), daysAgo(18), daysAgo(19), daysAgo(20)], createdAt: hoursAgo(504) },
    { name: 'Morning Walk (10 min)', type: 'habit', icon: '🚶', frequency: 'daily', streak: 7, completedDates: [daysAgo(0), daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(4), daysAgo(5), daysAgo(6)], createdAt: hoursAgo(168) },
    { name: 'Vitamin D', type: 'supplement', icon: '☀️', frequency: 'daily', streak: 30, completedDates: [daysAgo(0), daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(4), daysAgo(5), daysAgo(6), daysAgo(7), daysAgo(8), daysAgo(9)], createdAt: hoursAgo(720) },
    { name: '8 Hours Sleep', type: 'habit', icon: '😴', frequency: 'daily', streak: 5, completedDates: [daysAgo(0), daysAgo(1), daysAgo(2), daysAgo(3), daysAgo(4)], createdAt: hoursAgo(120) },
  ];
  for (const habit of habits) {
    await habitsRef.add(habit);
  }
  console.log(`✅ Habits (${habits.length})`);

  // ── 10. Goals (for owner) ─────────────────────────────────────────────────
  const goalsRef = db.collection('users').doc(ownerUid).collection('goals');
  const goals = [
    { title: 'Bench Press 120kg', category: 'strength', targetValue: 120, currentValue: 110, unit: 'kg', deadline: daysAgo(-60), checkins: [{ date: daysAgo(14), value: 100 }, { date: daysAgo(7), value: 105 }, { date: daysAgo(2), value: 110 }], completed: false, createdAt: hoursAgo(336) },
    { title: 'Deadlift 180kg', category: 'strength', targetValue: 180, currentValue: 160, unit: 'kg', deadline: daysAgo(-90), checkins: [{ date: daysAgo(21), value: 140 }, { date: daysAgo(10), value: 150 }, { date: daysAgo(1), value: 160 }], completed: false, createdAt: hoursAgo(500) },
    { title: 'Lose 5kg body fat', category: 'weight', targetValue: 80, currentValue: 83, unit: 'kg', deadline: daysAgo(-45), checkins: [{ date: daysAgo(14), value: 86 }, { date: daysAgo(7), value: 84.5 }, { date: daysAgo(1), value: 83 }], completed: false, createdAt: hoursAgo(200) },
    { title: '100 consecutive push-ups', category: 'endurance', targetValue: 100, currentValue: 65, unit: 'reps', deadline: daysAgo(-30), checkins: [{ date: daysAgo(21), value: 45 }, { date: daysAgo(10), value: 55 }, { date: daysAgo(3), value: 65 }], completed: false, createdAt: hoursAgo(150) },
  ];
  for (const goal of goals) {
    await goalsRef.add({ ...goal, createdAt: goal.createdAt });
  }
  console.log(`✅ Goals (${goals.length})`);

  // ── 11. Nutrition logs (for owner — last 7 days) ──────────────────────────
  const nutritionRef = db.collection('users').doc(ownerUid).collection('nutrition');
  const nutritionLogs = [
    { date: daysAgo(0), calories: 2480, protein: 178, carbs: 245, fat: 68, water: 7, createdAt: hoursAgo(2) },
    { date: daysAgo(1), calories: 2310, protein: 162, carbs: 228, fat: 71, water: 8, createdAt: hoursAgo(26) },
    { date: daysAgo(2), calories: 2550, protein: 190, carbs: 260, fat: 65, water: 6, createdAt: hoursAgo(50) },
    { date: daysAgo(3), calories: 2200, protein: 155, carbs: 218, fat: 72, water: 8, createdAt: hoursAgo(74) },
    { date: daysAgo(4), calories: 2420, protein: 175, carbs: 240, fat: 68, water: 7, createdAt: hoursAgo(98) },
    { date: daysAgo(5), calories: 2380, protein: 168, carbs: 235, fat: 70, water: 9, createdAt: hoursAgo(122) },
    { date: daysAgo(6), calories: 2290, protein: 160, carbs: 225, fat: 67, water: 8, createdAt: hoursAgo(146) },
  ];
  for (const log of nutritionLogs) {
    await nutritionRef.doc(log.date).set(log);
  }
  console.log(`✅ Nutrition logs (7 days)`);

  // ── 12. Progress Photos (for owner) ──────────────────────────────────────
  const progressPhotos = [
    { userId: ownerUid, url: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=600&h=800&fit=crop', caption: 'Week 1 — Starting point 💪', weight: 88, createdAt: hoursAgo(504) },
    { userId: ownerUid, url: 'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=600&h=800&fit=crop', caption: 'Week 4 — Feeling the difference!', weight: 86, createdAt: hoursAgo(336) },
    { userId: ownerUid, url: 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&h=800&fit=crop', caption: 'Week 8 — Visible progress 🔥', weight: 83, createdAt: hoursAgo(168) },
  ];
  for (const photo of progressPhotos) {
    await db.collection('progressPhotos').add(photo);
  }
  console.log(`✅ Progress Photos (${progressPhotos.length})`);

  // ── 13. Communities — seed member counts ──────────────────────────────────
  const communities = [
    { id: 'powerlifters',   memberCount: 847,  members: [ownerUid, uid('alexcarter'), uid('jamesokafor')] },
    { id: 'hiit-crew',      memberCount: 1240, members: [ownerUid, uid('sofiamendez'), uid('lunapark'), uid('marcusbell')] },
    { id: 'runners-club',   memberCount: 634,  members: [uid('jamesokafor'), uid('lunapark')] },
    { id: 'bodybuilding',   memberCount: 921,  members: [ownerUid, uid('alexcarter'), uid('sofiamendez')] },
    { id: 'yoga-flow',      memberCount: 512,  members: [uid('priyasharma'), uid('sofiamendez')] },
    { id: 'crossfit',       memberCount: 1089, members: [ownerUid, uid('lunapark'), uid('jamesokafor'), uid('alexcarter')] },
    { id: 'cycling-crew',   memberCount: 378,  members: [] },
    { id: 'nutrition-talk', memberCount: 693,  members: [ownerUid, uid('priyasharma'), uid('sofiamendez'), uid('marcusbell')] },
  ];
  const commBatch = db.batch();
  for (const c of communities) {
    commBatch.set(db.collection('communities').doc(c.id), {
      ...c, name: c.id, createdAt: hoursAgo(720),
    }, { merge: true });
  }
  await commBatch.commit();
  console.log(`✅ Communities (${communities.length})`);

  // ── 14. DM Conversations ─────────────────────────────────────────────────
  const convos = [
    {
      participants: [ownerUid, uid('sofiamendez')],
      lastMessage: 'Let me know if you want a personalised plan!',
      lastMessageAt: hoursAgo(2),
      unreadCounts: { [ownerUid]: 1 },
      msgs: [
        { senderId: ownerUid,           text: 'Hey Sofia! Love your content. Do you do online coaching?', createdAt: hoursAgo(5) },
        { senderId: uid('sofiamendez'), text: 'Hey!! Yes I do 😊 What are your goals?', createdAt: hoursAgo(4) },
        { senderId: ownerUid,           text: 'Mainly building strength while staying lean. Been lifting 2 years', createdAt: hoursAgo(3.5) },
        { senderId: uid('sofiamendez'), text: 'Perfect, that\'s exactly my speciality! Let me know if you want a personalised plan!', createdAt: hoursAgo(2) },
      ],
    },
    {
      participants: [ownerUid, uid('marcusbell')],
      lastMessage: 'This app is literally helping me stay accountable every day',
      lastMessageAt: hoursAgo(6),
      unreadCounts: { [ownerUid]: 2 },
      msgs: [
        { senderId: uid('marcusbell'), text: 'Hey man, just wanted to say this app is amazing. The workout tracking is so clean', createdAt: hoursAgo(8) },
        { senderId: ownerUid,          text: 'That means everything to hear, seriously! How\'s the progress going?', createdAt: hoursAgo(7.5) },
        { senderId: uid('marcusbell'), text: 'Down 30kg!! Couldn\'t have done it without having somewhere to log everything', createdAt: hoursAgo(7) },
        { senderId: ownerUid,          text: 'BRO. 30kg!! That\'s the most inspiring thing. You\'re the reason I built this 🙌', createdAt: hoursAgo(6.5) },
        { senderId: uid('marcusbell'), text: 'This app is literally helping me stay accountable every day', createdAt: hoursAgo(6) },
      ],
    },
    {
      participants: [ownerUid, uid('alexcarter')],
      lastMessage: 'Same! See you crushing it on the feed 💪',
      lastMessageAt: hoursAgo(24),
      unreadCounts: {},
      msgs: [
        { senderId: uid('alexcarter'), text: 'Bro your push day numbers are solid. How long you been lifting?', createdAt: hoursAgo(26) },
        { senderId: ownerUid,          text: 'About 2 years! Still learning. Your deadlift is insane btw', createdAt: hoursAgo(25) },
        { senderId: uid('alexcarter'), text: 'Thanks man! Took 3 years to get there. Consistency is everything', createdAt: hoursAgo(24.5) },
        { senderId: ownerUid,          text: 'Keep inspiring bro 🔥', createdAt: hoursAgo(24.2) },
        { senderId: uid('alexcarter'), text: 'Same! See you crushing it on the feed 💪', createdAt: hoursAgo(24) },
      ],
    },
  ];
  for (const c of convos) {
    const ref = db.collection('conversations').doc();
    const { msgs, ...data } = c;
    await ref.set({ ...data, type: 'direct', createdAt: hoursAgo(48) });
    for (const m of msgs) await ref.collection('messages').add({ ...m, read: true });
  }
  console.log(`✅ DM Conversations (${convos.length})`);

  // ── 15. XP / Leaderboard ─────────────────────────────────────────────────
  const xpData = [
    { uid: uid('lunapark'),    xp: 9840, level: 12 },
    { uid: uid('sofiamendez'), xp: 8720, level: 11 },
    { uid: uid('alexcarter'),  xp: 7650, level: 10 },
    { uid: uid('jamesokafor'), xp: 6430, level: 9  },
    { uid: ownerUid,           xp: 4200, level: 7  },
    { uid: uid('priyasharma'), xp: 3180, level: 6  },
    { uid: uid('marcusbell'),  xp: 2240, level: 5  },
  ];
  const xpBatch = db.batch();
  for (const x of xpData) {
    xpBatch.set(db.collection('users').doc(x.uid), { xp: x.xp, level: x.level }, { merge: true });
    xpBatch.set(db.collection('xp').doc(x.uid), { uid: x.uid, xp: x.xp, level: x.level, updatedAt: new Date().toISOString() }, { merge: true });
  }
  await xpBatch.commit();
  console.log('✅ XP / Leaderboard');

  // ── 16. Stories (expire 24h from now) ───────────────────────────────────────
  const expiresAt = new Date(Date.now() + 24 * 3600000).toISOString();
  const stories = [
    { userId: uid('sofiamendez'), user: userObj('sofiamendez'), imageUrl: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=600&h=900&fit=crop', caption: '6am crew showing UP 🔥', createdAt: hoursAgo(1), expiresAt, views: [] },
    { userId: uid('sofiamendez'), user: userObj('sofiamendez'), imageUrl: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=600&h=900&fit=crop', caption: 'Post-workout protein 💪', createdAt: hoursAgo(0.5), expiresAt, views: [] },
    { userId: uid('alexcarter'),  user: userObj('alexcarter'),  imageUrl: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=600&h=900&fit=crop', caption: '220kg. Done. 🏆', createdAt: hoursAgo(2), expiresAt, views: [] },
    { userId: uid('jamesokafor'), user: userObj('jamesokafor'), imageUrl: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=600&h=900&fit=crop', caption: 'Morning miles ☀️', createdAt: hoursAgo(3), expiresAt, views: [] },
    { userId: uid('lunapark'),    user: userObj('lunapark'),    imageUrl: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=600&h=900&fit=crop', caption: 'WOD complete 💥', createdAt: hoursAgo(1.5), expiresAt, views: [] },
    { userId: uid('priyasharma'), user: userObj('priyasharma'), imageUrl: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=600&h=900&fit=crop', caption: 'Morning flow 🧘✨', createdAt: hoursAgo(4), expiresAt, views: [] },
    { userId: uid('marcusbell'),  user: userObj('marcusbell'),  imageUrl: 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=600&h=900&fit=crop', caption: '-30kg. Still going 💪', createdAt: hoursAgo(2.5), expiresAt, views: [] },
    { userId: ownerUid, user: ownerObj, imageUrl: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=600&h=900&fit=crop', caption: 'Push day ✅', createdAt: hoursAgo(0.3), expiresAt, views: [] },
  ];
  for (const s of stories) await db.collection('stories').add(s);
  console.log(`✅ Stories (${stories.length})`);

  // ── 17. Trainer profiles (trainerInfo for Sofia + Luna) ───────────────────
  await db.collection('users').doc(uid('sofiamendez')).set({
    trainerInfo: {
      specialties: ['Strength Training', 'HIIT', 'Weight Loss'],
      sessionTypes: ['online', 'in-person'],
      hourlyRate: 85, currency: '$',
      experience: 6,
      rating: 4.9, totalSessions: 312,
      bio: 'NASM certified. 6 years helping clients build strength and confidence.',
    },
    verified: true,
  }, { merge: true });
  await db.collection('users').doc(uid('lunapark')).set({
    trainerInfo: {
      specialties: ['Crossfit', 'HIIT', 'Strength Training'],
      sessionTypes: ['in-person'],
      hourlyRate: 70, currency: '$',
      experience: 8,
      rating: 4.8, totalSessions: 520,
      bio: 'CrossFit Level 2 coach and box owner. Scaling WODs for all levels.',
    },
    verified: true,
  }, { merge: true });
  console.log('✅ Trainer profiles (Sofia + Luna)');

  // ── 18. Gyms ─────────────────────────────────────────────────────────────
  const gyms = [
    {
      name: 'Iron Palace Gym', address: '42 Fitness Boulevard', city: 'Dubai', country: 'UAE',
      description: "Dubai's premier strength and conditioning gym. State-of-the-art equipment, world-class coaches, and a community that pushes you to be your best.",
      lat: 25.2048, lng: 55.2708,
      photo: 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&h=500&fit=crop',
      amenities: ['Free Weights', 'Cardio Machines', 'Sauna', 'Personal Training', 'Group Classes', 'Cafe'],
      rating: 4.8, ratingCount: 124, memberCount: 340,
      hours: { monday: '05:30–23:00', tuesday: '05:30–23:00', wednesday: '05:30–23:00', thursday: '05:30–23:00', friday: '06:00–22:00', saturday: '07:00–21:00', sunday: '08:00–18:00' },
      createdBy: ownerUid, createdAt: hoursAgo(720),
    },
    {
      name: 'EliteFit Studio', address: '118 Ocean Drive', city: 'Miami', country: 'USA',
      description: "South Beach's top functional fitness studio. HIIT, strength, and mobility in a boutique setting. Home gym of Sofia Mendez.",
      lat: 25.7907, lng: -80.1300,
      photo: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&h=500&fit=crop',
      amenities: ['Free Weights', 'HIIT Area', 'Yoga Studio', 'Personal Training', 'Showers', 'Parking'],
      rating: 4.9, ratingCount: 87, memberCount: 210,
      hours: { monday: '06:00–22:00', tuesday: '06:00–22:00', wednesday: '06:00–22:00', thursday: '06:00–22:00', friday: '06:00–21:00', saturday: '08:00–20:00', sunday: '09:00–17:00' },
      createdBy: ownerUid, createdAt: hoursAgo(600),
    },
    {
      name: 'Iron House Gym', address: '7 Muscle Beach Ave', city: 'Los Angeles', country: 'USA',
      description: 'Old-school heavy iron gym. No fluff — just plates, chalk, and serious lifters. Home of multiple powerlifting state champions.',
      lat: 34.0522, lng: -118.2437,
      photo: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=800&h=500&fit=crop',
      amenities: ['Free Weights', 'Powerlifting Platforms', 'Chalk Allowed', 'Strongman Equipment', 'Lockers'],
      rating: 4.7, ratingCount: 203, memberCount: 180,
      hours: { monday: '04:00–24:00', tuesday: '04:00–24:00', wednesday: '04:00–24:00', thursday: '04:00–24:00', friday: '04:00–22:00', saturday: '06:00–22:00', sunday: '07:00–20:00' },
      createdBy: ownerUid, createdAt: hoursAgo(500),
    },
    {
      name: 'CrossFit Seoul', address: '23 Gangnam-daero', city: 'Seoul', country: 'South Korea',
      description: 'Premier CrossFit box in Gangnam. Daily WODs, Olympic lifting, and a community like no other. Owned by Luna Park.',
      lat: 37.4979, lng: 127.0276,
      photo: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&h=500&fit=crop',
      amenities: ['CrossFit Equipment', 'Olympic Platforms', 'Pull-up Rigs', 'Group Classes', 'Showers'],
      rating: 4.9, ratingCount: 156, memberCount: 290,
      hours: { monday: '06:00–22:00', tuesday: '06:00–22:00', wednesday: '06:00–22:00', thursday: '06:00–22:00', friday: '06:00–21:00', saturday: '08:00–18:00', sunday: 'Closed' },
      createdBy: ownerUid, createdAt: hoursAgo(400),
    },
    {
      name: 'City Athletics NYC', address: '500 W 36th St', city: 'New York', country: 'USA',
      description: 'Full-service athletic facility in Midtown Manhattan. Running track, weights, cardio, and Olympic-size pool.',
      lat: 40.7549, lng: -74.0020,
      photo: 'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=800&h=500&fit=crop',
      amenities: ['Running Track', 'Free Weights', 'Cardio Machines', 'Pool', 'Basketball Court', 'Sauna', 'Cafe'],
      rating: 4.6, ratingCount: 312, memberCount: 1200,
      hours: { monday: '05:00–23:00', tuesday: '05:00–23:00', wednesday: '05:00–23:00', thursday: '05:00–23:00', friday: '05:00–22:00', saturday: '06:00–21:00', sunday: '07:00–20:00' },
      createdBy: ownerUid, createdAt: hoursAgo(300),
    },
  ];
  for (const gym of gyms) await db.collection('gyms').add(gym);
  console.log(`✅ Gyms (${gyms.length})`);

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log('\n🎉 ALL DONE! App is fully loaded for your presentation.\n');
  console.log('What\'s seeded:');
  console.log('  📱 Feed        — 9 posts (workouts, runs, progress, motivation, challenge)');
  console.log('  🎬 Reels       — 2 video clips (Luna + Alex)');
  console.log('  📋 Programs    — 4 programs (Sofia, Alex, Luna, yours)');
  console.log('  🏆 PRs         — 12 personal records with history charts');
  console.log('  🥗 Meals       — 5 healthy meals (trainer curated)');
  console.log('  🔥 Habits      — 5 habits with streaks up to 30 days');
  console.log('  🎯 Goals       — 4 active goals with progress charts');
  console.log('  📊 Nutrition   — 7 days of macro tracking');
  console.log('  📸 Progress    — 3 progress photos (8-week journey)');
  console.log('  👥 Communities — 8 communities with real member counts');
  console.log('  💬 DMs         — 3 conversations (Sofia, Marcus, Alex)');
  console.log('  🏅 Leaderboard — 7 users ranked by XP\n');
  console.log('Demo accounts:');
  DEMO_USERS.forEach(u => console.log(`  ${u.username.padEnd(15)} ${u.email}  /  ${u.password}`));
  process.exit(0);
}

seedAll().catch(e => { console.error('❌ Seed failed:', e); process.exit(1); });
