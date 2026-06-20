/**
 * FLEX — Demo Seed Script
 * Run once: node backend/seedDemo.js
 *
 * Creates 6 realistic fitness users, 25 posts, follow graph,
 * DM conversations, challenges, and links everything to the
 * main account (mohammaddarsani@gmail.com).
 */

require('dotenv').config();
const admin = require('firebase-admin');
const path  = require('path');

// ── Init ────────────────────────────────────────────────────────────────────
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

// ── Demo users ──────────────────────────────────────────────────────────────
const DEMO_USERS = [
  {
    email:        'alex.carter.flex@gmail.com',
    password:     'Flex@demo1',
    displayName:  'Alex Carter',
    username:     'alexcarter',
    accountType:  'user',
    bio:          'Powerlifter 🏋️ | 4x bodyweight deadlift club | Chasing PRs every day',
    fitnessGoal:  'Build Strength',
    fitnessLevel: 'Advanced',
    gym:          'Iron House Gym',
    location:     'Los Angeles, CA',
    avatar:       'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=200&h=200&fit=crop&crop=face',
    workouts: 312, followers: 1840, following: 203,
  },
  {
    email:        'sofia.mendez.flex@gmail.com',
    password:     'Flex@demo2',
    displayName:  'Sofia Mendez',
    username:     'sofiamendez',
    accountType:  'trainer',
    bio:          'NASM Certified Trainer 💪 | Specialising in women\'s strength | DMs open for coaching',
    fitnessGoal:  'Help Others',
    fitnessLevel: 'Expert',
    gym:          'EliteFit Studio',
    location:     'Miami, FL',
    avatar:       'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=200&h=200&fit=crop&crop=face',
    workouts: 540, followers: 4200, following: 310,
  },
  {
    email:        'james.okafor.flex@gmail.com',
    password:     'Flex@demo3',
    displayName:  'James Okafor',
    username:     'jamesokafor',
    accountType:  'user',
    bio:          'Marathon runner 🏃 + gym rat. Sub-3hr marathon & 200kg squat. Yes, both.',
    fitnessGoal:  'Endurance',
    fitnessLevel: 'Advanced',
    gym:          'City Athletics',
    location:     'New York, NY',
    avatar:       'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=200&h=200&fit=crop&crop=face',
    workouts: 489, followers: 2100, following: 445,
  },
  {
    email:        'priya.sharma.flex@gmail.com',
    password:     'Flex@demo4',
    displayName:  'Priya Sharma',
    username:     'priyasharma',
    accountType:  'user',
    bio:          'Yoga + weightlifting ✨ proving they go together. Wellness over everything.',
    fitnessGoal:  'Flexibility & Strength',
    fitnessLevel: 'Intermediate',
    gym:          'Zen & Iron',
    location:     'Austin, TX',
    avatar:       'https://images.unsplash.com/photo-1518611012118-696072aa579a?w=200&h=200&fit=crop&crop=face',
    workouts: 210, followers: 980, following: 320,
  },
  {
    email:        'marcus.bell.flex@gmail.com',
    password:     'Flex@demo5',
    displayName:  'Marcus Bell',
    username:     'marcusbell',
    accountType:  'user',
    bio:          'Body recomp journey 📉📈 | -30kg in 8 months | Proof that consistency > motivation',
    fitnessGoal:  'Lose Weight',
    fitnessLevel: 'Beginner',
    gym:          'Planet Fitness',
    location:     'Chicago, IL',
    avatar:       'https://images.unsplash.com/photo-1583454110551-21f2fa2afe61?w=200&h=200&fit=crop&crop=face',
    workouts: 98, followers: 560, following: 180,
  },
  {
    email:        'luna.park.flex@gmail.com',
    password:     'Flex@demo6',
    displayName:  'Luna Park',
    username:     'lunapark',
    accountType:  'user',
    bio:          'CrossFit Level 2 | Box owner @CrossFitSeoul | Coffee → WOD → repeat ☕🔥',
    fitnessGoal:  'Athletic Performance',
    fitnessLevel: 'Advanced',
    gym:          'CrossFit Seoul',
    location:     'Seoul, South Korea',
    avatar:       'https://images.unsplash.com/photo-1609899537878-48700f6a16c1?w=200&h=200&fit=crop&crop=face',
    workouts: 720, followers: 3300, following: 270,
  },
];

// ── Post templates ──────────────────────────────────────────────────────────
function buildPosts(userMap, ownerUid) {
  const now   = Date.now();
  const hour  = 3600_000;

  // helper
  const uid  = (username) => userMap[username];
  const user = (username, data) => ({
    id:       uid(username),
    name:     data.displayName,
    username: data.username,
    avatar:   data.avatar,
  });

  const alex   = DEMO_USERS[0];
  const sofia  = DEMO_USERS[1];
  const james  = DEMO_USERS[2];
  const priya  = DEMO_USERS[3];
  const marcus = DEMO_USERS[4];
  const luna   = DEMO_USERS[5];

  return [
    // ── Alex (powerlifter) ────────────────────────────────────────────────
    {
      user: user('alexcarter', alex),
      type: 'workout',
      workoutType: 'Strength',
      duration: 75, calories: 620,
      exercises: [
        { name: 'Deadlift',      sets: 5, reps: 3,  weight: 220 },
        { name: 'Squat',         sets: 4, reps: 5,  weight: 180 },
        { name: 'Bench Press',   sets: 4, reps: 6,  weight: 140 },
        { name: 'Barbell Row',   sets: 3, reps: 8,  weight: 100 },
      ],
      caption: '220kg deadlift PR today 🔥 6 months ago this was my 1RM. Trust the process.',
      image: 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?w=800&h=600&fit=crop',
      isPR: true,
      likes: 142, likedBy: [uid('sofiamendez'), uid('jamesokafor'), uid('lunapark'), ownerUid],
      comments: [
        { id: 'c1', user: user('sofiamendez', sofia), text: 'BEAST MODE 🔥🔥🔥 absolute monster pull!', createdAt: new Date(now - 2*hour).toISOString(), likes: 8, likedBy: [] },
        { id: 'c2', user: user('jamesokafor', james), text: 'Crazy progress bro. What program are you running?', createdAt: new Date(now - hour).toISOString(), likes: 3, likedBy: [] },
        { id: 'c3', user: { id: ownerUid, name: 'Mohamad', username: 'mohamad', avatar: '' }, text: 'Insane!! You\'re built different 💪', createdAt: new Date(now - 30*60000).toISOString(), likes: 2, likedBy: [] },
      ],
      visibility: 'public',
      createdAt: new Date(now - 3*hour).toISOString(),
    },
    {
      user: user('alexcarter', alex),
      type: 'workout',
      workoutType: 'Strength',
      duration: 60, calories: 510,
      exercises: [
        { name: 'Overhead Press', sets: 5, reps: 5, weight: 90 },
        { name: 'Pull-ups',       sets: 4, reps: 8, weight: 0  },
        { name: 'Dips',           sets: 3, reps: 12, weight: 20 },
      ],
      caption: 'Press day ✅ OHP finally feeling strong again after that shoulder tweak last month. Patience pays.',
      image: 'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?w=800&h=600&fit=crop',
      likes: 87, likedBy: [uid('lunapark'), uid('priyasharma'), ownerUid],
      comments: [
        { id: 'c4', user: user('lunapark', luna), text: 'Glad the shoulder is feeling better! Mobility work helping?', createdAt: new Date(now - 25*hour).toISOString(), likes: 4, likedBy: [] },
      ],
      visibility: 'public',
      createdAt: new Date(now - 26*hour).toISOString(),
    },

    // ── Sofia (trainer) ───────────────────────────────────────────────────
    {
      user: user('sofiamendez', sofia),
      type: 'workout',
      workoutType: 'HIIT',
      duration: 45, calories: 480,
      exercises: [
        { name: 'Box Jumps',        sets: 4, reps: 10, weight: 0 },
        { name: 'Kettlebell Swings',sets: 4, reps: 20, weight: 24 },
        { name: 'Battle Ropes',     sets: 3, reps: 30, weight: 0 },
        { name: 'Sled Push',        sets: 3, reps: 1,  weight: 80 },
      ],
      caption: '45 min HIIT session with my 6am crew 🌅 These women show up EVERY. SINGLE. DAY. That\'s what separates results from wishes. Tag a training partner below 👇',
      image: 'https://images.unsplash.com/photo-1518310383802-640c2de311b2?w=800&h=600&fit=crop',
      likes: 318, likedBy: [uid('alexcarter'), uid('jamesokafor'), uid('lunapark'), uid('priyasharma'), uid('marcusbell'), ownerUid],
      comments: [
        { id: 'c5', user: user('priyasharma', priya), text: 'This is goals 🙌 wish I had a crew like this', createdAt: new Date(now - 5*hour).toISOString(), likes: 12, likedBy: [] },
        { id: 'c6', user: user('marcusbell', marcus), text: 'Sofia you\'re literally the reason I don\'t skip mornings anymore 💪', createdAt: new Date(now - 4*hour).toISOString(), likes: 27, likedBy: [] },
        { id: 'c7', user: { id: ownerUid, name: 'Mohamad', username: 'mohamad', avatar: '' }, text: 'This is incredible motivation fr 🔥', createdAt: new Date(now - 3*hour).toISOString(), likes: 5, likedBy: [] },
      ],
      visibility: 'public',
      createdAt: new Date(now - 6*hour).toISOString(),
    },
    {
      user: user('sofiamendez', sofia),
      type: 'motivation',
      workoutType: '',
      duration: 0, calories: 0,
      exercises: [],
      caption: 'Hot take: you don\'t need motivation. You need a system.\n\nMotivation is a feeling — it comes and goes. Systems are decisions made in advance. Stop waiting to feel like it. Build the habit, follow the system, get the result. 🧠💪\n\n#FitnessMindset #Discipline #TrainerTalk',
      image: 'https://images.unsplash.com/photo-1526506118085-60ce8714f8c5?w=800&h=600&fit=crop',
      likes: 512, likedBy: [uid('alexcarter'), uid('jamesokafor'), uid('lunapark'), uid('priyasharma'), uid('marcusbell'), ownerUid],
      comments: [
        { id: 'c8', user: user('jamesokafor', james), text: 'This is the post I needed today. Screenshotted.', createdAt: new Date(now - 14*hour).toISOString(), likes: 44, likedBy: [] },
        { id: 'c9', user: user('lunapark', luna), text: 'Systems > feelings 🙌 preach!!', createdAt: new Date(now - 13*hour).toISOString(), likes: 31, likedBy: [] },
      ],
      visibility: 'public',
      createdAt: new Date(now - 15*hour).toISOString(),
    },

    // ── James (runner/lifter) ─────────────────────────────────────────────
    {
      user: user('jamesokafor', james),
      type: 'run',
      workoutType: 'Cardio',
      duration: 95, calories: 780,
      distance: 21.1, runTime: '1:38:42', pace: '4:41/km',
      caption: 'Half marathon done before breakfast ☀️ Legs felt heavy at 15km but pushed through. New PB by 4 minutes. The morning shifts are undefeated.',
      image: 'https://images.unsplash.com/photo-1476480862126-209bfaa8edc8?w=800&h=600&fit=crop',
      isPR: true,
      likes: 203, likedBy: [uid('alexcarter'), uid('sofiamendez'), uid('lunapark'), ownerUid],
      comments: [
        { id: 'c10', user: user('sofiamendez', sofia), text: 'Before BREAKFAST?? You are not human 😂🔥', createdAt: new Date(now - 7*hour).toISOString(), likes: 55, likedBy: [] },
        { id: 'c11', user: user('alexcarter', alex), text: 'PB!! Let\'s go James! What shoes?', createdAt: new Date(now - 6*hour).toISOString(), likes: 8, likedBy: [] },
      ],
      visibility: 'public',
      createdAt: new Date(now - 8*hour).toISOString(),
    },
    {
      user: user('jamesokafor', james),
      type: 'workout',
      workoutType: 'Legs',
      duration: 70, calories: 550,
      exercises: [
        { name: 'Back Squat',      sets: 5, reps: 5,  weight: 200 },
        { name: 'Romanian Deadlift',sets: 4, reps: 8,  weight: 140 },
        { name: 'Leg Press',       sets: 3, reps: 12, weight: 300 },
        { name: 'Calf Raises',     sets: 4, reps: 20, weight: 80  },
      ],
      caption: 'Leg day to complement the running. Runners who lift >>> Change my mind 🦵',
      image: 'https://images.unsplash.com/photo-1574680096145-d05b474e2155?w=800&h=600&fit=crop',
      likes: 134, likedBy: [uid('sofiamendez'), uid('alexcarter'), uid('lunapark'), ownerUid],
      comments: [
        { id: 'c12', user: user('alexcarter', alex), text: '200kg squat AND running half marathons? You\'re built different fr', createdAt: new Date(now - 32*hour).toISOString(), likes: 19, likedBy: [] },
      ],
      visibility: 'public',
      createdAt: new Date(now - 33*hour).toISOString(),
    },

    // ── Priya (yoga + weights) ────────────────────────────────────────────
    {
      user: user('priyasharma', priya),
      type: 'workout',
      workoutType: 'Yoga',
      duration: 60, calories: 280,
      exercises: [
        { name: 'Sun Salutations',  sets: 3, reps: 10, weight: 0 },
        { name: 'Warrior Sequence', sets: 2, reps: 5,  weight: 0 },
        { name: 'Handstand Work',   sets: 5, reps: 3,  weight: 0 },
        { name: 'Deep Stretch',     sets: 1, reps: 1,  weight: 0 },
      ],
      caption: 'Morning flow ✨ Sometimes the best workout is the one that calms your mind AND strengthens your body. Handstand holds are getting so much more controlled!',
      image: 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=800&h=600&fit=crop',
      likes: 241, likedBy: [uid('sofiamendez'), uid('jamesokafor'), uid('lunapark'), uid('marcusbell'), ownerUid],
      comments: [
        { id: 'c13', user: user('sofiamendez', sofia), text: 'Your handstands are getting incredible!! 🙌✨', createdAt: new Date(now - 10*hour).toISOString(), likes: 18, likedBy: [] },
        { id: 'c14', user: user('marcusbell', marcus), text: 'The balance you have is goals. I\'m still terrified of inversions 😅', createdAt: new Date(now - 9*hour).toISOString(), likes: 11, likedBy: [] },
      ],
      visibility: 'public',
      createdAt: new Date(now - 11*hour).toISOString(),
    },
    {
      user: user('priyasharma', priya),
      type: 'meal',
      workoutType: '',
      duration: 0, calories: 520,
      mealName: 'High Protein Buddha Bowl',
      protein: 42, carbs: 55, fat: 18,
      caption: 'Post-workout fuel 🥗 Quinoa + roasted chickpeas + grilled tofu + tahini. 42g protein, no meat. Yes it\'s possible. Yes it\'s delicious. Recipe in bio!',
      image: 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=800&h=600&fit=crop',
      likes: 178, likedBy: [uid('sofiamendez'), uid('jamesokafor'), ownerUid],
      comments: [
        { id: 'c15', user: user('jamesokafor', james), text: 'Need this recipe ASAP as a runner always looking for plant protein options', createdAt: new Date(now - 20*hour).toISOString(), likes: 7, likedBy: [] },
      ],
      visibility: 'public',
      createdAt: new Date(now - 22*hour).toISOString(),
    },

    // ── Marcus (transformation) ───────────────────────────────────────────
    {
      user: user('marcusbell', marcus),
      type: 'progress',
      workoutType: 'Progress',
      duration: 0, calories: 0,
      exercises: [],
      weight: 85, bodyFat: 18,
      caption: '8 months in 📸 Starting weight was 115kg. Now 85kg. I used to think this was impossible for someone like me. Still can\'t believe this is my body. Never giving up on this journey 💪 #Transformation #WeightLoss #NeverSettle',
      image: 'https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&h=600&fit=crop',
      likes: 487, likedBy: [uid('alexcarter'), uid('sofiamendez'), uid('jamesokafor'), uid('priyasharma'), uid('lunapark'), ownerUid],
      comments: [
        { id: 'c16', user: user('sofiamendez', sofia), text: 'Marcus this literally made me tear up. You should be SO proud!! 🥹🙌', createdAt: new Date(now - 2*hour).toISOString(), likes: 64, likedBy: [] },
        { id: 'c17', user: user('alexcarter', alex), text: 'Absolute legend. 30kg down is life-changing bro. Respect 🤝', createdAt: new Date(now - hour).toISOString(), likes: 38, likedBy: [] },
        { id: 'c18', user: user('lunapark', luna), text: 'This is the most inspiring thing on my feed today. KEEP GOING 🔥', createdAt: new Date(now - 45*60000).toISOString(), likes: 29, likedBy: [] },
        { id: 'c19', user: { id: ownerUid, name: 'Mohamad', username: 'mohamad', avatar: '' }, text: 'Proof that Flex works 💪 so proud of you man!', createdAt: new Date(now - 20*60000).toISOString(), likes: 15, likedBy: [] },
      ],
      visibility: 'public',
      createdAt: new Date(now - 3*hour).toISOString(),
    },
    {
      user: user('marcusbell', marcus),
      type: 'workout',
      workoutType: 'Full Body',
      duration: 50, calories: 390,
      exercises: [
        { name: 'Goblet Squat',   sets: 3, reps: 12, weight: 24 },
        { name: 'Push-ups',       sets: 3, reps: 15, weight: 0  },
        { name: 'Dumbbell Row',   sets: 3, reps: 12, weight: 22 },
        { name: 'Walking Lunges', sets: 3, reps: 20, weight: 16 },
        { name: 'Plank',          sets: 3, reps: 1,  weight: 0  },
      ],
      caption: 'Workout 98 ✅ When I started 8 months ago I couldn\'t finish this. Today I crushed it and had energy left over. This is what progress feels like.',
      image: 'https://images.unsplash.com/photo-1593079831268-3381b0db4a77?w=800&h=600&fit=crop',
      likes: 156, likedBy: [uid('sofiamendez'), uid('priyasharma'), uid('lunapark'), ownerUid],
      comments: [
        { id: 'c20', user: user('sofiamendez', sofia), text: '98 workouts!! That\'s almost 100 🎉 we need to celebrate that milestone!', createdAt: new Date(now - 28*hour).toISOString(), likes: 22, likedBy: [] },
      ],
      visibility: 'public',
      createdAt: new Date(now - 30*hour).toISOString(),
    },

    // ── Luna (CrossFit) ───────────────────────────────────────────────────
    {
      user: user('lunapark', luna),
      type: 'workout',
      workoutType: 'CrossFit',
      duration: 55, calories: 620,
      exercises: [
        { name: 'Clean & Jerk',   sets: 5, reps: 3,  weight: 75 },
        { name: 'Muscle-ups',     sets: 4, reps: 5,  weight: 0  },
        { name: 'Double-unders',  sets: 3, reps: 50, weight: 0  },
        { name: 'Wall Balls',     sets: 4, reps: 20, weight: 9  },
      ],
      caption: 'Today\'s WOD nearly broke me 😂 Clean & Jerk + muscle-ups at 6am is absolutely brutal but I\'m OBSESSED. Who else is addicted to this sport? 🙋‍♀️ #CrossFit #WOD #Seoul',
      image: 'https://images.unsplash.com/photo-1541534741688-6078c6bfb5c5?w=800&h=600&fit=crop',
      likes: 264, likedBy: [uid('alexcarter'), uid('sofiamendez'), uid('jamesokafor'), ownerUid],
      comments: [
        { id: 'c21', user: user('alexcarter', alex), text: 'Clean & Jerk at 6am is actually criminal 😂 Respect though', createdAt: new Date(now - 4*hour).toISOString(), likes: 31, likedBy: [] },
        { id: 'c22', user: user('sofiamendez', sofia), text: 'Muscle-ups AND 75kg C&J?? You\'re insane Luna 🔥', createdAt: new Date(now - 3*hour).toISOString(), likes: 24, likedBy: [] },
      ],
      visibility: 'public',
      createdAt: new Date(now - 5*hour).toISOString(),
    },
    {
      user: user('lunapark', luna),
      type: 'motivation',
      workoutType: '',
      duration: 0, calories: 0,
      exercises: [],
      caption: '5 things that changed my fitness forever:\n\n1️⃣ Tracking my workouts (seriously, data = progress)\n2️⃣ Sleeping 8 hours religiously\n3️⃣ Finding a community, not just a gym\n4️⃣ Protein first, every meal\n5️⃣ Comparing myself only to who I was yesterday\n\nSimple. Not easy. Worth it. 🏆',
      image: 'https://images.unsplash.com/photo-1552196563-55cd4e45efb3?w=800&h=600&fit=crop',
      likes: 891, likedBy: [uid('alexcarter'), uid('sofiamendez'), uid('jamesokafor'), uid('priyasharma'), uid('marcusbell'), ownerUid],
      comments: [
        { id: 'c23', user: user('marcusbell', marcus), text: 'Number 3 is everything. Finding this community literally changed my life', createdAt: new Date(now - 17*hour).toISOString(), likes: 87, likedBy: [] },
        { id: 'c24', user: user('jamesokafor', james), text: 'Save this post everyone. This is the list.', createdAt: new Date(now - 16*hour).toISOString(), likes: 61, likedBy: [] },
      ],
      visibility: 'public',
      createdAt: new Date(now - 18*hour).toISOString(),
    },

    // ── Owner (Mohamad) posts ─────────────────────────────────────────────
    {
      user: { id: ownerUid, name: 'Mohamad', username: 'mohamad', avatar: '' },
      type: 'workout',
      workoutType: 'Push',
      duration: 65, calories: 490,
      exercises: [
        { name: 'Bench Press',    sets: 4, reps: 8,  weight: 100 },
        { name: 'Incline DB Press',sets: 3, reps: 10, weight: 36 },
        { name: 'Cable Fly',      sets: 3, reps: 12, weight: 25  },
        { name: 'Tricep Pushdown',sets: 3, reps: 15, weight: 35  },
        { name: 'Lateral Raises', sets: 4, reps: 15, weight: 12  },
      ],
      caption: 'Push day locked in 🔒 Been consistent for 3 weeks now and the pumps are getting real. Building this app while building my physique — grind don\'t stop 💪',
      image: 'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&h=600&fit=crop',
      likes: 98, likedBy: [uid('alexcarter'), uid('sofiamendez'), uid('lunapark')],
      comments: [
        { id: 'c25', user: user('sofiamendez', sofia), text: 'Building an app AND staying consistent?? Respect the grind 🙌', createdAt: new Date(now - 12*hour).toISOString(), likes: 14, likedBy: [] },
        { id: 'c26', user: user('alexcarter', alex), text: 'Solid numbers bro! Bench going up?', createdAt: new Date(now - 11*hour).toISOString(), likes: 6, likedBy: [] },
      ],
      visibility: 'public',
      createdAt: new Date(now - 13*hour).toISOString(),
    },
  ];
}

// ── DM conversations ─────────────────────────────────────────────────────────
function buildConversations(userMap, ownerUid) {
  const uid = (username) => userMap[username];
  return [
    {
      participants: [ownerUid, uid('sofiamendez')],
      lastMessage: 'Let me know if you want a personalised plan!',
      lastMessageAt: new Date(Date.now() - 2*3600_000).toISOString(),
      unreadCounts: { [ownerUid]: 1 },
      messages: [
        { senderId: ownerUid,             text: 'Hey Sofia! Love your content. Do you do online coaching?', createdAt: new Date(Date.now() - 5*3600_000).toISOString() },
        { senderId: uid('sofiamendez'),   text: 'Hey!! Yes I do 😊 What are your goals?', createdAt: new Date(Date.now() - 4*3600_000).toISOString() },
        { senderId: ownerUid,             text: 'Mainly looking to build strength while staying lean. Been lifting 2 years', createdAt: new Date(Date.now() - 3.5*3600_000).toISOString() },
        { senderId: uid('sofiamendez'),   text: 'Perfect, that\'s exactly my speciality! Let me know if you want a personalised plan!', createdAt: new Date(Date.now() - 2*3600_000).toISOString() },
      ],
    },
    {
      participants: [ownerUid, uid('alexcarter')],
      lastMessage: 'Same! See you crushing it on the feed 💪',
      lastMessageAt: new Date(Date.now() - 24*3600_000).toISOString(),
      unreadCounts: {},
      messages: [
        { senderId: uid('alexcarter'),  text: 'Bro your push day numbers are solid. How long you been lifting?', createdAt: new Date(Date.now() - 26*3600_000).toISOString() },
        { senderId: ownerUid,           text: 'About 2 years! Still learning a lot. Your deadlift is insane btw', createdAt: new Date(Date.now() - 25*3600_000).toISOString() },
        { senderId: uid('alexcarter'),  text: 'Thanks man! Took 3 years to get there. Consistency is everything', createdAt: new Date(Date.now() - 24.5*3600_000).toISOString() },
        { senderId: ownerUid,           text: 'Facts! Keep inspiring bro 🔥', createdAt: new Date(Date.now() - 24.2*3600_000).toISOString() },
        { senderId: uid('alexcarter'),  text: 'Same! See you crushing it on the feed 💪', createdAt: new Date(Date.now() - 24*3600_000).toISOString() },
      ],
    },
    {
      participants: [ownerUid, uid('marcusbell')],
      lastMessage: 'This app is literally helping me stay accountable every day',
      lastMessageAt: new Date(Date.now() - 6*3600_000).toISOString(),
      unreadCounts: { [ownerUid]: 2 },
      messages: [
        { senderId: uid('marcusbell'),  text: 'Hey man, just wanted to say this app is amazing. The workout tracking is so clean', createdAt: new Date(Date.now() - 8*3600_000).toISOString() },
        { senderId: ownerUid,           text: 'That means everything to hear, seriously! How\'s the progress going?', createdAt: new Date(Date.now() - 7.5*3600_000).toISOString() },
        { senderId: uid('marcusbell'),  text: 'Down 30kg!! Couldn\'t have done it without having somewhere to log everything', createdAt: new Date(Date.now() - 7*3600_000).toISOString() },
        { senderId: ownerUid,           text: 'BRO. 30kg!! That\'s the most inspiring thing. You\'re the reason I built this 🙌', createdAt: new Date(Date.now() - 6.5*3600_000).toISOString() },
        { senderId: uid('marcusbell'),  text: 'This app is literally helping me stay accountable every day', createdAt: new Date(Date.now() - 6*3600_000).toISOString() },
      ],
    },
  ];
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🌱 FLEX DEMO SEED STARTING...\n');

  // 1. Get owner UID
  let ownerUid;
  try {
    const ownerRecord = await auth.getUserByEmail(OWNER_EMAIL);
    ownerUid = ownerRecord.uid;
    console.log(`✅ Owner found: ${OWNER_EMAIL} → ${ownerUid}`);
  } catch {
    console.error(`❌ Owner account not found for ${OWNER_EMAIL}. Log in to the app first.`);
    process.exit(1);
  }

  // 2. Create/get demo user accounts
  const userMap = {}; // username → uid
  for (const u of DEMO_USERS) {
    try {
      let record;
      try {
        record = await auth.getUserByEmail(u.email);
        console.log(`♻️  User exists: ${u.username}`);
      } catch {
        record = await auth.createUser({ email: u.email, password: u.password, displayName: u.displayName });
        console.log(`✅ Created user: ${u.username}`);
      }
      userMap[u.username] = record.uid;

      // Upsert Firestore profile
      await db.collection('users').doc(record.uid).set({
        email:        u.email,
        displayName:  u.displayName,
        username:     u.username,
        accountType:  u.accountType,
        bio:          u.bio,
        fitnessGoal:  u.fitnessGoal,
        fitnessLevel: u.fitnessLevel,
        gym:          u.gym || '',
        location:     u.location || '',
        avatar:       u.avatar,
        workouts:     u.workouts,
        followers:    u.followers,
        following:    u.following,
        createdAt:    new Date(Date.now() - Math.random()*90*24*3600_000).toISOString(),
      }, { merge: true });
    } catch (e) {
      console.error(`❌ Failed to create ${u.username}:`, e.message);
    }
  }

  // 3. Follow relationships — owner follows everyone, everyone follows owner
  const batch1 = db.batch();
  for (const [username, uid] of Object.entries(userMap)) {
    // owner → demo user
    const f1 = db.collection('follows').doc(`${ownerUid}_${uid}`);
    batch1.set(f1, { followerId: ownerUid, followingId: uid, createdAt: new Date().toISOString() }, { merge: true });
    // demo user → owner
    const f2 = db.collection('follows').doc(`${uid}_${ownerUid}`);
    batch1.set(f2, { followerId: uid, followingId: ownerUid, createdAt: new Date().toISOString() }, { merge: true });
  }
  // demo users follow each other (selective)
  const followPairs = [
    ['alexcarter','sofiamendez'], ['alexcarter','jamesokafor'], ['alexcarter','lunapark'],
    ['sofiamendez','alexcarter'], ['sofiamendez','jamesokafor'], ['sofiamendez','priyasharma'],
    ['sofiamendez','marcusbell'], ['jamesokafor','lunapark'], ['jamesokafor','alexcarter'],
    ['priyasharma','sofiamendez'], ['priyasharma','lunapark'], ['marcusbell','sofiamendez'],
    ['marcusbell','lunapark'], ['lunapark','alexcarter'], ['lunapark','jamesokafor'],
  ];
  for (const [a, b] of followPairs) {
    const fa = db.collection('follows').doc(`${userMap[a]}_${userMap[b]}`);
    batch1.set(fa, { followerId: userMap[a], followingId: userMap[b], createdAt: new Date().toISOString() }, { merge: true });
  }
  await batch1.commit();
  console.log('✅ Follow graph created');

  // 4. Posts
  const posts = buildPosts(userMap, ownerUid);
  for (const post of posts) {
    await db.collection('posts').add({
      ...post,
      reactions: { heart: Math.floor(Math.random()*30), fire: Math.floor(Math.random()*20), strong: Math.floor(Math.random()*15), clap: Math.floor(Math.random()*10) },
      userReactions: {},
    });
  }
  console.log(`✅ Created ${posts.length} posts`);

  // 5. DM conversations
  const convos = buildConversations(userMap, ownerUid);
  for (const convo of convos) {
    const convRef = db.collection('conversations').doc();
    const { messages, ...convData } = convo;
    await convRef.set({ ...convData, type: 'direct', createdAt: new Date().toISOString() });
    for (const msg of messages) {
      await convRef.collection('messages').add({ ...msg, read: true });
    }
  }
  console.log(`✅ Created ${convos.length} DM conversations`);

  // 6. Active challenge
  await db.collection('posts').add({
    user: { id: userMap['sofiamendez'], name: 'Sofia Mendez', username: 'sofiamendez', avatar: DEMO_USERS[1].avatar },
    type: 'workout',
    workoutType: 'Challenge',
    duration: 0, calories: 0,
    exercises: [],
    caption: '🏆 30-DAY STRENGTH CHALLENGE — starting Monday!\n\nJoin me for 30 days of progressive overload. All levels welcome. Full program pinned in my profile.\n\nComment "IN" to join and I\'ll add you to the tracking group! 💪\n\n#30DayChallenge #StrengthChallenge #FlexChallenge',
    image: 'https://images.unsplash.com/photo-1534258936925-c58bed479fcb?w=800&h=600&fit=crop',
    isChallenge: true,
    challengeTitle: '30-Day Strength Challenge',
    challengeParticipants: [userMap['sofiamendez'], userMap['alexcarter'], userMap['jamesokafor'], userMap['lunapark'], userMap['marcusbell'], ownerUid],
    likes: 234, likedBy: [userMap['alexcarter'], userMap['jamesokafor'], userMap['lunapark'], userMap['marcusbell'], ownerUid],
    comments: [
      { id: 'ch1', user: { id: userMap['alexcarter'], name: 'Alex Carter', username: 'alexcarter', avatar: DEMO_USERS[0].avatar }, text: 'IN 💪🔥', createdAt: new Date(Date.now() - 3*3600_000).toISOString(), likes: 12, likedBy: [] },
      { id: 'ch2', user: { id: userMap['marcusbell'], name: 'Marcus Bell', username: 'marcusbell', avatar: DEMO_USERS[4].avatar }, text: 'IN!! First challenge ever. Nervous but ready 😤', createdAt: new Date(Date.now() - 2*3600_000).toISOString(), likes: 28, likedBy: [] },
      { id: 'ch3', user: { id: ownerUid, name: 'Mohamad', username: 'mohamad', avatar: '' }, text: 'IN! Let\'s goooo 🔥', createdAt: new Date(Date.now() - 1*3600_000).toISOString(), likes: 9, likedBy: [] },
    ],
    reactions: { heart: 18, fire: 45, strong: 32, clap: 21 },
    userReactions: {},
    visibility: 'public',
    createdAt: new Date(Date.now() - 4*3600_000).toISOString(),
  });
  console.log('✅ Created challenge post');

  // 7. Leaderboard XP
  const xpData = [
    { uid: userMap['lunapark'],     xp: 9840, level: 12 },
    { uid: userMap['sofiamendez'],  xp: 8720, level: 11 },
    { uid: userMap['alexcarter'],   xp: 7650, level: 10 },
    { uid: userMap['jamesokafor'],  xp: 6430, level: 9  },
    { uid: ownerUid,                xp: 4200, level: 7  },
    { uid: userMap['priyasharma'],  xp: 3180, level: 6  },
    { uid: userMap['marcusbell'],   xp: 2240, level: 5  },
  ];
  const xpBatch = db.batch();
  for (const x of xpData) {
    xpBatch.set(db.collection('users').doc(x.uid), { xp: x.xp, level: x.level }, { merge: true });
    xpBatch.set(db.collection('xp').doc(x.uid), { uid: x.uid, xp: x.xp, level: x.level, updatedAt: new Date().toISOString() }, { merge: true });
  }
  await xpBatch.commit();
  console.log('✅ XP/Leaderboard seeded');

  console.log('\n🎉 SEED COMPLETE! Your app is ready for the presentation.\n');
  console.log('Demo accounts (all use these passwords):');
  DEMO_USERS.forEach(u => console.log(`  ${u.username.padEnd(15)} → ${u.email}  /  ${u.password}`));
  console.log('\nYour account (mohammaddarsani@gmail.com) is connected to all of them.\n');
  process.exit(0);
}

seed().catch(e => { console.error('❌ Seed failed:', e); process.exit(1); });
