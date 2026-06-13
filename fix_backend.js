const fs = require('fs');
const path = 'backend/server.js';
let s = fs.readFileSync(path, 'utf8');

// Add username check endpoint before the last app.listen or near auth routes
const endpoint = `
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

`;

// Insert before the last route or listen
s = s.replace('// POST /api/auth/send-otp', endpoint + '// POST /api/auth/send-otp');
fs.writeFileSync(path, s, 'utf8');
console.log('Backend username endpoint added');
