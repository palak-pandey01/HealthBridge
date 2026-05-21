const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_FILE = path.join(__dirname, 'db.json');
const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));

const newHash = bcrypt.hashSync('doctor123', 10);
console.log('Generated hash:', newHash);
console.log('Verify:', bcrypt.compareSync('doctor123', newHash));

db.doctors.forEach(doc => {
  doc.password = newHash;
  console.log(`Updated password for ${doc.name}`);
});

fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
console.log('\n✅ All doctor passwords fixed! You can now login with password: doctor123');
