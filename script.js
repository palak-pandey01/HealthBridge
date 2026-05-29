const API ='http://localhost:3001/api';
// ─── State ────────────────────────────────────────────────────────────────────
let currentUser = JSON.parse(localStorage.getItem('hb_user') || 'null');
let authToken   = localStorage.getItem('hb_token') || null;
let allDoctors  = [];
let selectedSlotId   = null;
let selectedDoctorId = null;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = `toast toast-${type} show`;
    setTimeout(() => t.classList.remove('show'), 3500);
}

function setLoading(btn, loading) {
    if (loading) {
        btn.dataset.orig = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Please wait...';
        btn.disabled = true;
    } else {
        btn.innerHTML = btn.dataset.orig;
        btn.disabled = false;
    }
}

async function apiFetch(endpoint, options = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (authToken) headers['Authorization'] = `Bearer ${authToken}`;
    const res = await fetch(`${API}${endpoint}`, { ...options, headers });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Something went wrong');
    return data;
}

function formatDate(dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

// ─── Auth UI ──────────────────────────────────────────────────────────────────
function updateAuthUI() {
    const loginItem      = document.getElementById('authNavItem');
    const userItem       = document.getElementById('userNavItem');
    const userNameEl     = document.getElementById('userNavName');
    const dashNavItem    = document.getElementById('dashboardNavItem');
    const patientSection = document.getElementById('patientDashboard');
    const doctorSection  = document.getElementById('doctorDashboard');

    if (currentUser) {
        loginItem.style.display   = 'none';
        userItem.style.display    = 'flex';
        dashNavItem.style.display = 'list-item';
        userNameEl.textContent    = `👋 ${currentUser.name}`;

        if (currentUser.role === 'patient') {
            patientSection.style.display = 'block';
            doctorSection.style.display  = 'none';
            fillPatientProfile();
            loadMyAppointments();
        } else if (currentUser.role === 'doctor') {
            patientSection.style.display = 'none';
            doctorSection.style.display  = 'block';
            fillDoctorProfile();
            loadDoctorAppointments();
        }

        // Scroll to dashboard
        setTimeout(() => {
            const section = currentUser.role === 'patient' ? patientSection : doctorSection;
            section.scrollIntoView({ behavior: 'smooth' });
        }, 300);

    } else {
        loginItem.style.display   = 'list-item';
        userItem.style.display    = 'none';
        dashNavItem.style.display = 'none';
        patientSection.style.display = 'none';
        doctorSection.style.display  = 'none';
    }
}

function fillPatientProfile() {
    document.getElementById('pd-name').textContent  = currentUser.name;
    document.getElementById('pd-email').textContent = currentUser.email;
    if (currentUser.phone) {
        document.getElementById('pd-phone').textContent   = currentUser.phone;
        document.getElementById('pd-phone-row').style.display = 'flex';
    }
}

function fillDoctorProfile() {
    document.getElementById('dd-name').textContent      = currentUser.name;
    document.getElementById('dd-email').textContent     = currentUser.email;
    document.getElementById('dd-specialty').textContent = currentUser.specialty || 'Doctor';
}

// Dashboard nav button
document.getElementById('dashboardNavBtn').addEventListener('click', e => {
    e.preventDefault();
    if (!currentUser) return;
    const section = currentUser.role === 'patient'
        ? document.getElementById('patientDashboard')
        : document.getElementById('doctorDashboard');
    section.scrollIntoView({ behavior: 'smooth' });
});

function saveAuth(token, user) {
    authToken   = token;
    currentUser = user;
    localStorage.setItem('hb_token', token);
    localStorage.setItem('hb_user', JSON.stringify(user));
    updateAuthUI();
}

function logout() {
    authToken   = null;
    currentUser = null;
    localStorage.removeItem('hb_token');
    localStorage.removeItem('hb_user');
    updateAuthUI();
    showToast('Logged out successfully');
}

// ─── Modals ───────────────────────────────────────────────────────────────────
function openModal(id)  { document.getElementById(id).style.display = 'block'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; }

document.getElementById('loginNavBtn').addEventListener('click', e => {
    e.preventDefault();
    openModal('loginModal');
});
document.getElementById('loginClose').addEventListener('click',  () => closeModal('loginModal'));
document.getElementById('signupClose').addEventListener('click', () => closeModal('signupModal'));
document.getElementById('doctorSignupClose').addEventListener('click', () => closeModal('doctorSignupModal'));
document.getElementById('bookingClose').addEventListener('click', () => closeModal('bookingModal'));

document.getElementById('openSignupLink').addEventListener('click', e => {
    e.preventDefault();
    closeModal('loginModal');
    openModal('signupModal');
});
document.getElementById('backToLoginLink').addEventListener('click', e => {
    e.preventDefault();
    closeModal('signupModal');
    openModal('loginModal');
});
document.getElementById('openDoctorSignupLink').addEventListener('click', e => {
    e.preventDefault();
    closeModal('loginModal');
    openModal('doctorSignupModal');
});
document.getElementById('backToDoctorLoginLink').addEventListener('click', e => {
    e.preventDefault();
    closeModal('doctorSignupModal');
    openModal('loginModal');
    // Switch to doctor tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('[data-tab="doctor"]').classList.add('active');
    document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
    document.getElementById('doctorForm').classList.add('active');
});

window.addEventListener('click', e => {
    ['loginModal','signupModal','doctorSignupModal','bookingModal'].forEach(id => {
        if (e.target === document.getElementById(id)) closeModal(id);
    });
});

// Tab switching in login modal
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.login-form').forEach(f => f.classList.remove('active'));
        document.getElementById(btn.dataset.tab + 'Form').classList.add('active');
    });
});

document.getElementById('logoutBtn').addEventListener('click', logout);

// ─── Patient Login ────────────────────────────────────────────────────────────
document.getElementById('patientForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const errEl = document.getElementById('patientLoginError');
    errEl.textContent = '';
    setLoading(btn, true);
    try {
        const data = await apiFetch('/patient/login', {
            method: 'POST',
            body: JSON.stringify({
                email:    document.getElementById('patientEmail').value,
                password: document.getElementById('patientPassword').value
            })
        });
        saveAuth(data.token, data.user);
        closeModal('loginModal');
        showToast(`Welcome back, ${data.user.name}!`);
        e.target.reset();
    } catch (err) {
        errEl.textContent = err.message;
    } finally {
        setLoading(btn, false);
    }
});

// ─── Doctor Login ─────────────────────────────────────────────────────────────
document.getElementById('doctorForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const errEl = document.getElementById('doctorLoginError');
    errEl.textContent = '';
    setLoading(btn, true);
    try {
        const data = await apiFetch('/doctor/login', {
            method: 'POST',
            body: JSON.stringify({
                email:    document.getElementById('doctorEmail').value,
                password: document.getElementById('doctorPassword').value
            })
        });
        saveAuth(data.token, data.user);
        closeModal('loginModal');
        showToast(`Welcome, ${data.user.name}!`);
        e.target.reset();
    } catch (err) {
        errEl.textContent = err.message;
    } finally {
        setLoading(btn, false);
    }
});

// ─── Patient Signup ───────────────────────────────────────────────────────────
document.getElementById('signupForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.target.querySelector('button[type=submit]');
    const errEl = document.getElementById('signupError');
    errEl.textContent = '';
    setLoading(btn, true);
    try {
        const data = await apiFetch('/patient/register', {
            method: 'POST',
            body: JSON.stringify({
                name:     document.getElementById('signupName').value,
                email:    document.getElementById('signupEmail').value,
                phone:    document.getElementById('signupPhone').value,
                password: document.getElementById('signupPassword').value
            })
        });
        saveAuth(data.token, data.user);
        closeModal('signupModal');
        showToast(`Account created! Welcome, ${data.user.name}!`);
        e.target.reset();
    } catch (err) {
        errEl.textContent = err.message;
    } finally {
        setLoading(btn, false);
    }
});

// ─── Doctor Signup ────────────────────────────────────────────────────────────
document.getElementById('doctorSignupForm').addEventListener('submit', async e => {
    e.preventDefault();
    const btn   = e.target.querySelector('button[type=submit]');
    const errEl = document.getElementById('doctorSignupError');
    errEl.textContent = '';
    setLoading(btn, true);
    try {
        const data = await apiFetch('/doctor/register', {
            method: 'POST',
            body: JSON.stringify({
                name:      document.getElementById('dsName').value,
                email:     document.getElementById('dsEmail').value,
                specialty: document.getElementById('dsSpecialty').value,
                phone:     document.getElementById('dsPhone').value,
                password:  document.getElementById('dsPassword').value
            })
        });
        saveAuth(data.token, data.user);
        closeModal('doctorSignupModal');
        showToast(`Welcome Dr. ${data.user.name.replace('Dr. ','')}! Your account is ready.`);
        e.target.reset();
        loadDoctors(); // refresh doctors list
    } catch (err) {
        errEl.textContent = err.message;
    } finally {
        setLoading(btn, false);
    }
});

// ─── Load Doctors ─────────────────────────────────────────────────────────────
async function loadDoctors() {
    const grid = document.getElementById('doctorsGrid');
    try {
        allDoctors = await apiFetch('/doctors');
        renderDoctors(allDoctors);
    } catch {
        grid.innerHTML = '<p style="color:var(--danger);text-align:center;">Could not load doctors. Make sure the backend is running.</p>';
    }
}

function renderDoctors(doctors) {
    const grid = document.getElementById('doctorsGrid');
    if (!doctors.length) {
        grid.innerHTML = '<p style="text-align:center;color:var(--text-secondary);">No doctors found.</p>';
        return;
    }
    grid.innerHTML = doctors.map(doc => `
        <div class="doctor-card" data-id="${doc.id}">
            <div class="doctor-avatar">
                <img src="${doc.photo}" alt="${doc.name}" onerror="this.src='https://randomuser.me/api/portraits/lego/1.jpg'">
            </div>
            <h3>${doc.name}</h3>
            <p class="specialty">${doc.specialty}</p>
            <div class="rating">
                <i class="fas fa-star"></i>
                <span>${doc.rating} (${doc.reviews})</span>
            </div>
            <button class="btn-book-doctor" onclick="openBooking(${doc.id})">
                <i class="fas fa-calendar-plus"></i> Book Now
            </button>
        </div>
    `).join('');

    // Animate cards
    document.querySelectorAll('.doctor-card').forEach((card, i) => {
        card.style.opacity = '0';
        card.style.transform = 'translateY(30px)';
        card.style.transition = `all 0.5s ease ${i * 0.1}s`;
        setTimeout(() => {
            card.style.opacity = '1';
            card.style.transform = 'translateY(0)';
        }, 100);
    });
}

// ─── Search ───────────────────────────────────────────────────────────────────
document.getElementById('searchBtn').addEventListener('click', () => {
    const q = document.getElementById('searchInput').value.toLowerCase();
    const s = document.getElementById('specialtyFilter').value.toLowerCase();
    const filtered = allDoctors.filter(d =>
        (!q || d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q)) &&
        (!s || d.specialty.toLowerCase().includes(s))
    );
    renderDoctors(filtered);
    document.getElementById('doctors').scrollIntoView({ behavior: 'smooth' });
});

document.getElementById('searchInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('searchBtn').click();
});

// ─── Booking Flow ─────────────────────────────────────────────────────────────
async function openBooking(doctorId) {
    if (!currentUser) {
        showToast('Please login to book an appointment', 'error');
        openModal('loginModal');
        return;
    }
    if (currentUser.role === 'doctor') {
        showToast('Doctors cannot book appointments', 'error');
        return;
    }

    selectedDoctorId = doctorId;
    selectedSlotId   = null;
    const doctor = allDoctors.find(d => d.id === doctorId);

    document.getElementById('bookingDoctorInfo').innerHTML = `
        <div class="booking-doc-header">
            <img src="${doctor.photo}" alt="${doctor.name}">
            <div>
                <h3>${doctor.name}</h3>
                <p>${doctor.specialty}</p>
                <div class="rating"><i class="fas fa-star"></i> ${doctor.rating} (${doctor.reviews} reviews)</div>
            </div>
        </div>
    `;

    document.getElementById('bookingError').textContent = '';
    document.getElementById('confirmBookingBtn').disabled = true;
    document.getElementById('slotsGrid').innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading slots...</div>';
    document.getElementById('dateTabs').innerHTML = '';

    openModal('bookingModal');

    try {
        // Get next 3 days
        const today = new Date();
        const dates = [0, 1, 2].map(d => {
            const dt = new Date(today);
            dt.setDate(today.getDate() + d);
            return dt.toISOString().split('T')[0];
        });

        // Load slots for first date
        await renderSlots(doctorId, dates, dates[0]);

        // Build date tabs
        const tabsEl = document.getElementById('dateTabs');
        tabsEl.innerHTML = dates.map((date, i) => `
            <button class="date-tab ${i === 0 ? 'active' : ''}" data-date="${date}">
                ${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : formatDate(date)}
            </button>
        `).join('');

        tabsEl.querySelectorAll('.date-tab').forEach(tab => {
            tab.addEventListener('click', async () => {
                tabsEl.querySelectorAll('.date-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                selectedSlotId = null;
                document.getElementById('confirmBookingBtn').disabled = true;
                await renderSlots(doctorId, dates, tab.dataset.date);
            });
        });
    } catch {
        document.getElementById('slotsGrid').innerHTML = '<p style="color:var(--danger)">Could not load slots.</p>';
    }
}

async function renderSlots(doctorId, dates, date) {
    const grid = document.getElementById('slotsGrid');
    grid.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i></div>';
    const slots = await apiFetch(`/doctors/${doctorId}/slots?date=${date}`);
    if (!slots.length) {
        grid.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:1rem;">No available slots for this date.</p>';
        return;
    }
    grid.innerHTML = slots.map(s => `
        <button class="slot-btn available" data-slot-id="${s.id}" onclick="selectSlot(this, ${s.id})">
            <i class="fas fa-clock"></i> ${s.slot_time}
        </button>
    `).join('');
}

function selectSlot(el, slotId) {
    document.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('selected'));
    el.classList.add('selected');
    selectedSlotId = slotId;
    document.getElementById('confirmBookingBtn').disabled = false;
}

document.getElementById('confirmBookingBtn').addEventListener('click', async () => {
    if (!selectedSlotId || !selectedDoctorId) return;
    const btn = document.getElementById('confirmBookingBtn');
    const errEl = document.getElementById('bookingError');
    errEl.textContent = '';
    setLoading(btn, true);
    try {
        const data = await apiFetch('/appointments', {
            method: 'POST',
            body: JSON.stringify({
                doctor_id: selectedDoctorId,
                slot_id:   selectedSlotId,
                notes:     document.getElementById('bookingNotes').value
            })
        });
        closeModal('bookingModal');
        showToast(`Appointment confirmed with ${data.appointment.doctor_name} on ${formatDate(data.appointment.slot_date)} at ${data.appointment.slot_time}`);
        loadMyAppointments();
        document.getElementById('appointments').scrollIntoView({ behavior: 'smooth' });
    } catch (err) {
        errEl.textContent = err.message;
    } finally {
        setLoading(btn, false);
    }
});

// Hero book button
document.getElementById('heroBookBtn').addEventListener('click', () => {
    if (!currentUser) {
        openModal('loginModal');
    } else {
        document.getElementById('doctors').scrollIntoView({ behavior: 'smooth' });
    }
});

// ─── My Appointments ──────────────────────────────────────────────────────────
async function loadMyAppointments() {
    const list = document.getElementById('appointmentsList');
    list.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const appts = await apiFetch('/appointments/my');

        // Fill stats
        const confirmed = appts.filter(a => a.status === 'confirmed').length;
        const cancelled = appts.filter(a => a.status === 'cancelled').length;
        document.getElementById('stat-total').textContent     = appts.length;
        document.getElementById('stat-confirmed').textContent = confirmed;
        document.getElementById('stat-cancelled').textContent = cancelled;
        document.getElementById('pd-appt-count').textContent  = `${appts.length} appointment${appts.length !== 1 ? 's' : ''}`;

        if (!appts.length) {
            list.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-times"></i><p>No appointments yet. Book your first appointment!</p></div>';
            return;
        }
        list.innerHTML = appts.map(a => `
            <div class="appt-card ${a.status}">
                <img src="${a.photo}" alt="${a.doctor_name}" class="appt-doc-img">
                <div class="appt-info">
                    <h4>${a.doctor_name}</h4>
                    <p><i class="fas fa-stethoscope"></i> ${a.specialty}</p>
                    <p><i class="fas fa-calendar"></i> ${formatDate(a.slot_date)} &nbsp; <i class="fas fa-clock"></i> ${a.slot_time}</p>
                    ${a.notes ? `<p><i class="fas fa-notes-medical"></i> ${a.notes}</p>` : ''}
                </div>
                <div class="appt-status">
                    <span class="status-badge status-${a.status}">${a.status}</span>
                    ${a.status !== 'cancelled' ? `<button class="btn-cancel" onclick="cancelAppointment(${a.id})"><i class="fas fa-times"></i> Cancel</button>` : ''}
                </div>
            </div>
        `).join('');
    } catch {
        list.innerHTML = '<p style="color:var(--danger)">Could not load appointments.</p>';
    }
}

async function cancelAppointment(id) {
    if (!confirm('Cancel this appointment?')) return;
    try {
        await apiFetch(`/appointments/${id}/cancel`, { method: 'PATCH' });
        showToast('Appointment cancelled');
        loadMyAppointments();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ─── Doctor Dashboard ─────────────────────────────────────────────────────────
async function loadDoctorAppointments() {
    const list = document.getElementById('doctorAppointmentsList');
    list.innerHTML = '<div class="loading-spinner"><i class="fas fa-spinner fa-spin"></i> Loading...</div>';
    try {
        const appts = await apiFetch('/doctor/appointments');

        // Fill stats
        const todayStr     = new Date().toISOString().split('T')[0];
        const todayAppts   = appts.filter(a => a.slot_date === todayStr && a.status !== 'cancelled').length;
        const uniquePats   = new Set(appts.filter(a => a.status !== 'cancelled').map(a => a.patient_id)).size;
        document.getElementById('dstat-total').textContent    = appts.filter(a => a.status !== 'cancelled').length;
        document.getElementById('dstat-today').textContent    = todayAppts;
        document.getElementById('dstat-patients').textContent = uniquePats;
        document.getElementById('dd-patient-count').textContent = `${uniquePats} patient${uniquePats !== 1 ? 's' : ''}`;

        if (!appts.length) {
            list.innerHTML = '<div class="empty-state"><i class="fas fa-calendar-times"></i><p>No appointments scheduled yet.</p></div>';
            return;
        }
        list.innerHTML = appts.map(a => `
            <div class="appt-card ${a.status}">
                <div class="appt-patient-avatar"><i class="fas fa-user-circle"></i></div>
                <div class="appt-info">
                    <h4>${a.patient_name}</h4>
                    <p><i class="fas fa-envelope"></i> ${a.patient_email}</p>
                    ${a.patient_phone ? `<p><i class="fas fa-phone"></i> ${a.patient_phone}</p>` : ''}
                    <p><i class="fas fa-calendar"></i> ${formatDate(a.slot_date)} &nbsp; <i class="fas fa-clock"></i> ${a.slot_time}</p>
                    ${a.notes ? `<p><i class="fas fa-notes-medical"></i> ${a.notes}</p>` : ''}
                </div>
                <div class="appt-status">
                    <span class="status-badge status-${a.status}">${a.status}</span>
                </div>
            </div>
        `).join('');
    } catch {
        list.innerHTML = '<p style="color:var(--danger)">Could not load appointments.</p>';
    }
}

// ─── Mobile Nav ───────────────────────────────────────────────────────────────
const hamburger = document.querySelector('.hamburger');
const navMenu   = document.querySelector('.nav-menu');
hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
});
document.querySelectorAll('.nav-link').forEach(n => n.addEventListener('click', () => {
    hamburger.classList.remove('active');
    navMenu.classList.remove('active');
}));

// Smooth scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        const target = document.querySelector(this.getAttribute('href'));
        if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    });
});

// ─── Init ─────────────────────────────────────────────────────────────────────
updateAuthUI();
loadDoctors();
