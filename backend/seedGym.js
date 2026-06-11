/**
 * seedGym.js — Creates a fully-populated demo gym in Firebase Auth + Firestore.
 * Run once from the backend folder:  node seedGym.js
 */

const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();
const auth = admin.auth();

// ── Gym details ───────────────────────────────────────────────────────────────
const GYM_EMAIL    = 'demo.gym@flexapp.com';
const GYM_PASSWORD = 'DemoGym@123';
const GYM_NAME     = 'Iron Palace Gym';

const gymProfile = {
  gymName:     GYM_NAME,
  email:       GYM_EMAIL,
  address:     '42 Fitness Boulevard',
  city:        'Dubai',
  country:     'UAE',
  phone:       '+971 4 000 1234',
  website:     'https://ironpalace.com',
  description: 'Dubai\'s premier strength and conditioning gym. State-of-the-art equipment, world-class coaches, and a community that pushes you to be your best every single day.',
  logoUrl:     'https://ui-avatars.com/api/?name=Iron+Palace&background=7c3aed&color=fff&size=200&bold=true',
  coverUrl:    '',
  amenities:   [
    'Free Weights', 'Cardio Machines', 'Weight Machines',
    'Sauna', 'Steam Room', 'Showers', 'Lockers', 'Parking',
    'Personal Training', 'Group Classes', 'Boxing Ring', 'Cafe / Juice Bar',
  ],
  hours: {
    monday:    { open: '05:30', close: '23:00', closed: false },
    tuesday:   { open: '05:30', close: '23:00', closed: false },
    wednesday: { open: '05:30', close: '23:00', closed: false },
    thursday:  { open: '05:30', close: '23:00', closed: false },
    friday:    { open: '06:00', close: '22:00', closed: false },
    saturday:  { open: '07:00', close: '21:00', closed: false },
    sunday:    { open: '08:00', close: '18:00', closed: false },
  },
  memberCount:  24,
  rating:       4.8,
  ratingCount:  17,
  createdAt:    new Date().toISOString(),
};

// ── Classes ───────────────────────────────────────────────────────────────────
const classes = [
  { name: 'Morning Power Yoga',  instructor: 'Sara Al Mansoori', dayOfWeek: 0, startTime: '06:00', endTime: '07:00', capacity: 20, enrolled: 14, type: 'Yoga',      description: 'Start your week strong with breathwork and power flows.' },
  { name: 'HIIT Blast',          instructor: 'Coach Mike',        dayOfWeek: 0, startTime: '18:00', endTime: '19:00', capacity: 15, enrolled: 15, type: 'HIIT',      description: 'High-intensity intervals to torch calories fast.' },
  { name: 'Strength & Power',    instructor: 'Omar Hassan',       dayOfWeek: 1, startTime: '07:00', endTime: '08:30', capacity: 12, enrolled: 9,  type: 'Strength',  description: 'Olympic lifting and compound movements.' },
  { name: 'Spinning Rush',       instructor: 'Lena Fischer',      dayOfWeek: 1, startTime: '19:00', endTime: '20:00', capacity: 18, enrolled: 18, type: 'Spinning',  description: 'High-energy cycling to your favourite beats.' },
  { name: 'BoxFit',              instructor: 'Coach Mike',        dayOfWeek: 2, startTime: '06:30', endTime: '07:30', capacity: 10, enrolled: 8,  type: 'Boxing',    description: 'Boxing drills for fitness and stress relief.' },
  { name: 'Pilates Core',        instructor: 'Sara Al Mansoori', dayOfWeek: 2, startTime: '10:00', endTime: '11:00', capacity: 12, enrolled: 6,  type: 'Pilates',   description: 'Deep core stability and postural alignment.' },
  { name: 'CrossFit WOD',        instructor: 'Omar Hassan',       dayOfWeek: 3, startTime: '06:00', endTime: '07:00', capacity: 16, enrolled: 12, type: 'CrossFit',  description: 'Today\'s workout of the day — scaled for all levels.' },
  { name: 'Evening Yoga Flow',   instructor: 'Sara Al Mansoori', dayOfWeek: 3, startTime: '20:00', endTime: '21:00', capacity: 20, enrolled: 11, type: 'Yoga',      description: 'Wind down with a restorative evening flow.' },
  { name: 'HIIT Blast',          instructor: 'Lena Fischer',      dayOfWeek: 4, startTime: '07:00', endTime: '08:00', capacity: 15, enrolled: 13, type: 'HIIT',      description: 'Friday morning fat-burner.' },
  { name: 'Strength & Power',    instructor: 'Omar Hassan',       dayOfWeek: 4, startTime: '17:30', endTime: '19:00', capacity: 12, enrolled: 10, type: 'Strength',  description: 'End of week heavy session.' },
  { name: 'Weekend Warrior HIIT',instructor: 'Coach Mike',        dayOfWeek: 5, startTime: '09:00', endTime: '10:00', capacity: 20, enrolled: 17, type: 'HIIT',      description: 'Kick off your weekend with a serious sweat.' },
  { name: 'Sunday Stretch & Recover', instructor: 'Sara Al Mansoori', dayOfWeek: 6, startTime: '10:00', endTime: '11:00', capacity: 20, enrolled: 8, type: 'Stretching', description: 'Full-body recovery and mobility session.' },
];

// ── Members ───────────────────────────────────────────────────────────────────
const members = [
  { name: 'Ahmed Al Rashid',  photoUrl: 'https://ui-avatars.com/api/?name=Ahmed+Al+Rashid&background=0ea5e9&color=fff',  plan: 'yearly',   status: 'active' },
  { name: 'Fatima Noor',      photoUrl: 'https://ui-avatars.com/api/?name=Fatima+Noor&background=ec4899&color=fff',       plan: 'monthly',  status: 'active' },
  { name: 'James O\'Brien',   photoUrl: 'https://ui-avatars.com/api/?name=James+OBrien&background=8b5cf6&color=fff',      plan: 'monthly',  status: 'active' },
  { name: 'Layla Hassan',     photoUrl: 'https://ui-avatars.com/api/?name=Layla+Hassan&background=10b981&color=fff',      plan: 'yearly',   status: 'active' },
  { name: 'Marcus Chen',      photoUrl: 'https://ui-avatars.com/api/?name=Marcus+Chen&background=f59e0b&color=fff',       plan: 'monthly',  status: 'active' },
  { name: 'Priya Sharma',     photoUrl: 'https://ui-avatars.com/api/?name=Priya+Sharma&background=ef4444&color=fff',      plan: 'yearly',   status: 'active' },
  { name: 'David Kim',        photoUrl: 'https://ui-avatars.com/api/?name=David+Kim&background=06b6d4&color=fff',         plan: 'monthly',  status: 'active' },
  { name: 'Sofia Rodriguez',  photoUrl: 'https://ui-avatars.com/api/?name=Sofia+Rodriguez&background=d946ef&color=fff',   plan: 'monthly',  status: 'active' },
  { name: 'Yusuf Ibrahim',    photoUrl: 'https://ui-avatars.com/api/?name=Yusuf+Ibrahim&background=84cc16&color=fff',     plan: 'yearly',   status: 'active' },
  { name: 'Emma Lindqvist',   photoUrl: 'https://ui-avatars.com/api/?name=Emma+Lindqvist&background=f97316&color=fff',    plan: 'monthly',  status: 'active' },
  { name: 'Khalid Al Zaabi',  photoUrl: 'https://ui-avatars.com/api/?name=Khalid+Al+Zaabi&background=0ea5e9&color=fff',  plan: 'yearly',   status: 'active' },
  { name: 'Nadia Petrov',     photoUrl: 'https://ui-avatars.com/api/?name=Nadia+Petrov&background=ec4899&color=fff',      plan: 'monthly',  status: 'active' },
  { name: 'Tom Wallace',      photoUrl: 'https://ui-avatars.com/api/?name=Tom+Wallace&background=8b5cf6&color=fff',       plan: 'monthly',  status: 'active' },
  { name: 'Hana Mori',        photoUrl: 'https://ui-avatars.com/api/?name=Hana+Mori&background=10b981&color=fff',         plan: 'yearly',   status: 'active' },
  { name: 'Carlos Vega',      photoUrl: 'https://ui-avatars.com/api/?name=Carlos+Vega&background=f59e0b&color=fff',       plan: 'monthly',  status: 'inactive' },
  { name: 'Aisha Malik',      photoUrl: 'https://ui-avatars.com/api/?name=Aisha+Malik&background=ef4444&color=fff',       plan: 'monthly',  status: 'active' },
  { name: 'Ryan Park',        photoUrl: 'https://ui-avatars.com/api/?name=Ryan+Park&background=06b6d4&color=fff',         plan: 'yearly',   status: 'active' },
  { name: 'Isabella Rossi',   photoUrl: 'https://ui-avatars.com/api/?name=Isabella+Rossi&background=d946ef&color=fff',    plan: 'monthly',  status: 'active' },
  { name: 'Mohammed Saleh',   photoUrl: 'https://ui-avatars.com/api/?name=Mohammed+Saleh&background=84cc16&color=fff',    plan: 'yearly',   status: 'active' },
  { name: 'Nina Johansson',   photoUrl: 'https://ui-avatars.com/api/?name=Nina+Johansson&background=f97316&color=fff',    plan: 'monthly',  status: 'active' },
  { name: 'Omar Farouq',      photoUrl: 'https://ui-avatars.com/api/?name=Omar+Farouq&background=0ea5e9&color=fff',       plan: 'monthly',  status: 'active' },
  { name: 'Zoe Williams',     photoUrl: 'https://ui-avatars.com/api/?name=Zoe+Williams&background=ec4899&color=fff',      plan: 'yearly',   status: 'active' },
  { name: 'Tariq Bin Laden',  photoUrl: 'https://ui-avatars.com/api/?name=Tariq+BL&background=8b5cf6&color=fff',          plan: 'monthly',  status: 'inactive' },
  { name: 'Mei Zhang',        photoUrl: 'https://ui-avatars.com/api/?name=Mei+Zhang&background=10b981&color=fff',         plan: 'yearly',   status: 'active' },
];

// ── Announcements ─────────────────────────────────────────────────────────────
const announcements = [
  {
    text: '🎉 Ramadan Special: All memberships 30% off this month! Use code RAMADAN30 at the front desk.',
    createdAt: new Date(Date.now() - 1 * 24 * 3600000).toISOString(),
  },
  {
    text: '🏆 Congratulations to our May Leaderboard winners! Ahmed Al Rashid (1st), Priya Sharma (2nd), Khalid Al Zaabi (3rd). Prizes available at reception.',
    createdAt: new Date(Date.now() - 3 * 24 * 3600000).toISOString(),
  },
  {
    text: '⚠️ The sauna will be under maintenance this Saturday 9am–2pm. We apologise for the inconvenience.',
    createdAt: new Date(Date.now() - 5 * 24 * 3600000).toISOString(),
  },
  {
    text: '🆕 New class alert! "BoxFit" with Coach Mike is now on the Wednesday morning schedule at 6:30am. Spots are limited — book now through the app!',
    createdAt: new Date(Date.now() - 8 * 24 * 3600000).toISOString(),
  },
  {
    text: '💪 Iron Palace is proud to welcome our new head coach, Omar Hassan! Omar brings 10 years of Olympic lifting experience. Book a free intro session.',
    createdAt: new Date(Date.now() - 14 * 24 * 3600000).toISOString(),
  },
];

// ── Check-ins (last 7 days) ───────────────────────────────────────────────────
function makeCheckins() {
  const checkins = [];
  const memberNames = members.map(m => m.name);
  for (let day = 6; day >= 0; day--) {
    const count = Math.floor(Math.random() * 12) + 4; // 4–15 per day
    for (let i = 0; i < count; i++) {
      const name = memberNames[Math.floor(Math.random() * memberNames.length)];
      const hoursAgo = day * 24 + Math.floor(Math.random() * 14) + 6;
      checkins.push({
        name,
        photoUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=7c3aed&color=fff`,
        checkedInAt: new Date(Date.now() - hoursAgo * 3600000).toISOString(),
        uid: `mock_${name.replace(/\s/g,'_').toLowerCase()}`,
      });
    }
  }
  return checkins;
}

// ── Main seed function ────────────────────────────────────────────────────────
async function seed() {
  console.log('\n🏋️  Seeding demo gym: Iron Palace Gym\n');

  // 1. Create or get Firebase Auth user
  let uid;
  try {
    const existing = await auth.getUserByEmail(GYM_EMAIL);
    uid = existing.uid;
    console.log(`✅ Auth user already exists: ${uid}`);
  } catch {
    const newUser = await auth.createUser({
      email: GYM_EMAIL,
      password: GYM_PASSWORD,
      displayName: GYM_NAME,
    });
    uid = newUser.uid;
    console.log(`✅ Created Auth user: ${uid}`);
  }

  // 2. Set custom claim role: 'gym'
  await auth.setCustomUserClaims(uid, { role: 'gym' });
  console.log('✅ Custom claim set: role = gym');

  // 3. Write gym profile to Firestore gyms/{uid}
  await db.collection('gyms').doc(uid).set({ ...gymProfile, ownerUid: uid });
  console.log('✅ Gym profile written to Firestore → gyms/' + uid);

  // 4. Write minimal user doc (so gym shows in users collection too)
  await db.collection('users').doc(uid).set({
    uid,
    role: 'gym',
    email: GYM_EMAIL,
    name: GYM_NAME,
    username: 'ironpalace',
    photoUrl: gymProfile.logoUrl,
    createdAt: gymProfile.createdAt,
  });
  console.log('✅ User doc written → users/' + uid);

  // 5. Classes
  const classRef = db.collection('gyms').doc(uid).collection('classes');
  for (const cls of classes) {
    await classRef.add({ ...cls, createdAt: gymProfile.createdAt });
  }
  console.log(`✅ ${classes.length} classes added`);

  // 6. Members
  const membersRef = db.collection('gyms').doc(uid).collection('members');
  let mid = 1;
  for (const m of members) {
    const expiry = new Date();
    expiry.setMonth(expiry.getMonth() + (m.plan === 'yearly' ? 12 : 1));
    const joinedDaysAgo = Math.floor(Math.random() * 180);
    await membersRef.doc(`member_${mid++}`).set({
      ...m,
      uid: `member_uid_${mid}`,
      joinedAt:  new Date(Date.now() - joinedDaysAgo * 86400000).toISOString(),
      expiresAt: expiry.toISOString(),
    });
  }
  console.log(`✅ ${members.length} members added`);

  // 7. Check-ins
  const checkinsRef = db.collection('gyms').doc(uid).collection('checkins');
  const checkins = makeCheckins();
  for (const c of checkins) {
    await checkinsRef.add(c);
  }
  console.log(`✅ ${checkins.length} check-ins added`);

  // 8. Announcements
  const annRef = db.collection('gyms').doc(uid).collection('announcements');
  for (const a of announcements) {
    await annRef.add(a);
  }
  console.log(`✅ ${announcements.length} announcements added`);

  // 9. Ratings
  const ratingsRef = db.collection('gyms').doc(uid).collection('ratings');
  const raters = ['u1','u2','u3','u4','u5','u6','u7','u8','u9','u10','u11','u12','u13','u14','u15','u16','u17'];
  const ratingValues = [5,5,5,4,5,5,4,5,5,4,5,5,5,4,5,4,5];
  for (let i = 0; i < raters.length; i++) {
    await ratingsRef.doc(raters[i]).set({ rating: ratingValues[i], ratedAt: gymProfile.createdAt });
  }
  console.log(`✅ ${raters.length} ratings added`);

  console.log('\n🎉 Done! Demo gym is ready.\n');
  console.log('──────────────────────────────────────────');
  console.log('  Login email:    demo.gym@flexapp.com');
  console.log('  Login password: DemoGym@123');
  console.log('  Firestore doc:  gyms/' + uid);
  console.log('──────────────────────────────────────────\n');

  process.exit(0);
}

seed().catch(e => {
  console.error('❌ Seed failed:', e.message);
  process.exit(1);
});
