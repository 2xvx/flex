// Run: node deleteUser.js <username_or_email>
require('dotenv').config();
const admin = require('firebase-admin');
let serviceAccount;
try { serviceAccount = require('./serviceAccountKey.json'); }
catch { serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT); }

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();
const auth = admin.auth();

async function deleteUser(usernameOrEmail) {
  let uid, email = usernameOrEmail;

  // Try to find by username in Firestore first
  if (!usernameOrEmail.includes('@')) {
    const snap = await db.collection('users')
      .where('username', '==', usernameOrEmail.toLowerCase()).limit(1).get();
    if (snap.empty) {
      console.log('❌ No user found with username:', usernameOrEmail);
      process.exit(1);
    }
    uid = snap.docs[0].id;
    email = snap.docs[0].data().email;
    console.log(`Found user: ${email} (uid: ${uid})`);
  } else {
    try {
      const u = await auth.getUserByEmail(email);
      uid = u.uid;
    } catch {
      console.log('❌ No Firebase Auth user found for:', email);
      process.exit(1);
    }
  }

  // Delete from Firebase Auth
  try { await auth.deleteUser(uid); console.log('✅ Deleted from Firebase Auth'); }
  catch (e) { console.log('⚠️  Auth delete failed:', e.message); }

  // Delete Firestore user doc
  try { await db.collection('users').doc(uid).delete(); console.log('✅ Deleted from Firestore'); }
  catch (e) { console.log('⚠️  Firestore delete failed:', e.message); }

  console.log(`\n🗑️  User "${usernameOrEmail}" fully deleted.`);
  process.exit(0);
}

const target = process.argv[2];
if (!target) { console.log('Usage: node deleteUser.js <username_or_email>'); process.exit(1); }
deleteUser(target);
