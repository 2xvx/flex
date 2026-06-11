const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const STORE = {
  email: 'demo.store@flexapp.com',
  password: 'Store@123456',
  displayName: 'Flex Originals',
  username: 'flex_originals',
  accountType: 'store',
  storeName: 'Flex Originals',
  storeCategory: 'Clothing',
  storeBio: 'Official Flex gear. Obsidian & gold aesthetic for elite athletes.',
  storeApproved: true,
  bio: 'Official Flex clothing store.',
  avatar: '',
  followers: 8420,
  following: 0,
  workouts: 0,
};

async function run() {
  let userRecord;
  try {
    userRecord = await admin.auth().getUserByEmail(STORE.email);
    console.log(`Already exists: ${STORE.displayName}`);
  } catch {
    userRecord = await admin.auth().createUser({
      email: STORE.email,
      password: STORE.password,
      displayName: STORE.displayName,
    });
    console.log(`Created auth user: ${STORE.displayName}`);
  }

  await db.collection('users').doc(userRecord.uid).set({
    id: userRecord.uid,
    email: STORE.email,
    displayName: STORE.displayName,
    name: STORE.displayName,
    username: STORE.username,
    accountType: STORE.accountType,
    storeName: STORE.storeName,
    storeCategory: STORE.storeCategory,
    storeBio: STORE.storeBio,
    storeApproved: STORE.storeApproved,
    bio: STORE.bio,
    avatar: '',
    followers: STORE.followers,
    following: STORE.following,
    workouts: 0,
    createdAt: new Date().toISOString(),
  }, { merge: true });

  console.log('\n✅ Store account ready!');
  console.log('   Email   :', STORE.email);
  console.log('   Password:', STORE.password);
  console.log('   Tab     : Store (on the login page)');
  process.exit(0);
}

run().catch(e => { console.error(e); process.exit(1); });
