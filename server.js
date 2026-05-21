const express = require('express');
const cors    = require('cors');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const path    = require('path');
const fs      = require('fs');

const app        = express();
const PORT       = 3001;
const JWT_SECRET = 'healthbridge_secret_2024';
const DB_FILE    = path.join(__dirname, 'db.json');

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '..')));

// ─── JSON DB helpers ──────────────────────────────────────────────────────────
function readDB() {
  if (!fs.existsSync(DB_FILE)) return { patients: [], doctors: [], slots: [], appointments: [] };
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}
function nextId(arr) {
  return arr.length === 0 ? 1 : Math.max(...arr.map(x => x.id)) + 1;
}

// ─── Seed doctors (only when DB is empty) ────────────────────────────────────
function seedDoctors() {
  const db = readDB();
  if (db.doctors && db.doctors.length > 0) return;

  const hash = bcrypt.hashSync('doctor123', 10);
  const doctors = [
    { id: 1, name: 'Dr. John Smith',    email: 'john.smith@healthbridge.com',    password: hash, specialty: 'Cardiologist', rating: 4.9, reviews: 127, photo: 'https://randomuser.me/api/portraits/men/32.jpg',   available: true },
    { id: 2, name: 'Dr. Sarah Johnson', email: 'sarah.johnson@healthbridge.com', password: hash, specialty: 'Dentist',      rating: 4.8, reviews: 89,  photo: 'https://randomuser.me/api/portraits/women/44.jpg', available: true },
    { id: 3, name: 'Dr. Michael Lee',   email: 'michael.lee@healthbridge.com',   password: hash, specialty: 'Neurologist',  rating: 4.9, reviews: 203, photo: 'https://randomuser.me/api/portraits/men/52.jpg',   available: true }
  ];

  const times = ['09:00 AM','10:00 AM','11:30 AM','01:00 PM','02:00 PM','03:30 PM','05:00 PM','06:00 PM'];
  const today = new Date();
  const dates = [0,1,2].map(d => {
    const dt = new Date(today);
    dt.setDate(today.getDate() + d);
    return dt.toISOString().split('T')[0];
  });

  let slotId = 1;
  const slots = [];
  doctors.forEach(doc => {
    dates.forEach(date => {
      times.forEach(time => {
        slots.push({ id: slotId++, doctor_id: doc.id, slot_time: time, slot_date: date, is_booked: false });
      });
    });
  });

  writeDB({ patients: [], doctors, slots, appointments: [] });
  console.log('✅ Doctors seeded with correct passwords');
}
seedDoctors();

// ─── Auth middleware ──────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Invalid or expired token' }); }
}

// ─── Patient Register ─────────────────────────────────────────────────────────
app.post('/api/patient/register', (req, res) => {
  const { name, email, password, phone } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are required' });
  const db = readDB();
  if (db.patients.find(p => p.email === email))
    return res.status(409).json({ error: 'Email already registered' });
  const patient = { id: nextId(db.patients), name, email, password: bcrypt.hashSync(password, 10), phone: phone || '', created_at: new Date().toISOString() };
  db.patients.push(patient);
  writeDB(db);
  const token = jwt.sign({ id: patient.id, role: 'patient', name, email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: patient.id, name, email, role: 'patient' } });
});

// ─── Patient Login ────────────────────────────────────────────────────────────
app.post('/api/patient/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const patient = db.patients.find(p => p.email === email);
  if (!patient || !bcrypt.compareSync(password, patient.password))
    return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign({ id: patient.id, role: 'patient', name: patient.name, email }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: patient.id, name: patient.name, email, role: 'patient' } });
});

// ─── Doctor Register ──────────────────────────────────────────────────────────
app.post('/api/doctor/register', (req, res) => {
  const { name, email, password, specialty, phone } = req.body;
  if (!name || !email || !password || !specialty)
    return res.status(400).json({ error: 'Name, email, password and specialty are required' });
  const db = readDB();
  if (db.doctors.find(d => d.email === email))
    return res.status(409).json({ error: 'Email already registered' });

  const times = ['09:00 AM','10:00 AM','11:30 AM','01:00 PM','02:00 PM','03:30 PM','05:00 PM','06:00 PM'];
  const today = new Date();
  const dates = [0,1,2].map(d => { const dt = new Date(today); dt.setDate(today.getDate()+d); return dt.toISOString().split('T')[0]; });

  const photos = ['men/10','men/20','men/30','women/10','women/20','women/30'];
  const photo  = `https://randomuser.me/api/portraits/${photos[Math.floor(Math.random()*photos.length)]}.jpg`;
  const doctor = { id: nextId(db.doctors), name, email, password: bcrypt.hashSync(password, 10), specialty, phone: phone||'', rating: 5.0, reviews: 0, photo, available: true, created_at: new Date().toISOString() };
  db.doctors.push(doctor);

  const maxSlotId = db.slots.length > 0 ? Math.max(...db.slots.map(s => s.id)) : 0;
  let slotId = maxSlotId + 1;
  dates.forEach(date => times.forEach(time => db.slots.push({ id: slotId++, doctor_id: doctor.id, slot_time: time, slot_date: date, is_booked: false })));
  writeDB(db);

  const token = jwt.sign({ id: doctor.id, role: 'doctor', name: doctor.name, email, specialty }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: doctor.id, name: doctor.name, email, specialty, role: 'doctor' } });
});

// ─── Doctor Login ─────────────────────────────────────────────────────────────
app.post('/api/doctor/login', (req, res) => {
  const { email, password } = req.body;
  const db = readDB();
  const doctor = db.doctors.find(d => d.email === email);
  if (!doctor || !bcrypt.compareSync(password, doctor.password))
    return res.status(401).json({ error: 'Invalid email or password' });
  const token = jwt.sign({ id: doctor.id, role: 'doctor', name: doctor.name, email, specialty: doctor.specialty }, JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { id: doctor.id, name: doctor.name, email, specialty: doctor.specialty, role: 'doctor' } });
});

// ─── Get All Doctors ──────────────────────────────────────────────────────────
app.get('/api/doctors', (req, res) => {
  const db = readDB();
  res.json(db.doctors.filter(d => d.available).map(({ id, name, specialty, rating, reviews, photo }) => ({ id, name, specialty, rating, reviews, photo })));
});

// ─── Get Doctor Slots ─────────────────────────────────────────────────────────
app.get('/api/doctors/:id/slots', (req, res) => {
  const db    = readDB();
  const docId = parseInt(req.params.id);
  let slots   = db.slots.filter(s => s.doctor_id === docId && !s.is_booked);
  if (req.query.date) slots = slots.filter(s => s.slot_date === req.query.date);
  res.json(slots.sort((a,b) => a.slot_time.localeCompare(b.slot_time)));
});

// ─── Book Appointment ─────────────────────────────────────────────────────────
app.post('/api/appointments', auth, (req, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Only patients can book appointments' });
  const { doctor_id, slot_id, notes } = req.body;
  if (!doctor_id || !slot_id) return res.status(400).json({ error: 'doctor_id and slot_id are required' });

  const db   = readDB();
  const slot = db.slots.find(s => s.id === slot_id && s.doctor_id === doctor_id);
  if (!slot)          return res.status(404).json({ error: 'Slot not found' });
  if (slot.is_booked) return res.status(409).json({ error: 'Slot already booked. Please choose another time.' });

  const dup = db.appointments.find(a => a.patient_id === req.user.id && a.doctor_id === doctor_id && a.slot_date === slot.slot_date && a.status !== 'cancelled');
  if (dup) return res.status(409).json({ error: 'You already have an appointment with this doctor on this date' });

  slot.is_booked = true;
  const appt = { id: nextId(db.appointments), patient_id: req.user.id, doctor_id, slot_id, slot_time: slot.slot_time, slot_date: slot.slot_date, notes: notes||'', status: 'confirmed', created_at: new Date().toISOString() };
  db.appointments.push(appt);
  writeDB(db);

  const doctor = db.doctors.find(d => d.id === doctor_id);
  res.json({ message: 'Appointment booked successfully', appointment: { id: appt.id, doctor_name: doctor.name, specialty: doctor.specialty, photo: doctor.photo, slot_time: slot.slot_time, slot_date: slot.slot_date, status: 'confirmed' } });
});

// ─── My Appointments (patient) ────────────────────────────────────────────────
app.get('/api/appointments/my', auth, (req, res) => {
  if (req.user.role !== 'patient') return res.status(403).json({ error: 'Access denied' });
  const db = readDB();
  const appts = db.appointments.filter(a => a.patient_id === req.user.id)
    .map(a => { const doc = db.doctors.find(d => d.id === a.doctor_id); return { ...a, doctor_name: doc?.name, specialty: doc?.specialty, photo: doc?.photo }; })
    .sort((a,b) => b.created_at.localeCompare(a.created_at));
  res.json(appts);
});

// ─── Cancel Appointment ───────────────────────────────────────────────────────
app.patch('/api/appointments/:id/cancel', auth, (req, res) => {
  const db   = readDB();
  const appt = db.appointments.find(a => a.id === parseInt(req.params.id) && a.patient_id === req.user.id);
  if (!appt)                       return res.status(404).json({ error: 'Appointment not found' });
  if (appt.status === 'cancelled') return res.status(400).json({ error: 'Already cancelled' });
  appt.status = 'cancelled';
  const slot  = db.slots.find(s => s.id === appt.slot_id);
  if (slot) slot.is_booked = false;
  writeDB(db);
  res.json({ message: 'Appointment cancelled successfully' });
});

// ─── Doctor Appointments ──────────────────────────────────────────────────────
app.get('/api/doctor/appointments', auth, (req, res) => {
  if (req.user.role !== 'doctor') return res.status(403).json({ error: 'Access denied' });
  const db = readDB();
  const appts = db.appointments.filter(a => a.doctor_id === req.user.id)
    .map(a => { const p = db.patients.find(p => p.id === a.patient_id); return { ...a, patient_name: p?.name, patient_email: p?.email, patient_phone: p?.phone }; })
    .sort((a,b) => a.slot_date.localeCompare(b.slot_date) || a.slot_time.localeCompare(b.slot_time));
  res.json(appts);
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 HealthBridge running → http://localhost:${PORT}`);
  console.log(`🔑 Doctor logins (password: doctor123)`);
  console.log(`   john.smith@healthbridge.com`);
  console.log(`   sarah.johnson@healthbridge.com`);
  console.log(`   michael.lee@healthbridge.com\n`);
});
