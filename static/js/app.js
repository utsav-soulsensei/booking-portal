document.addEventListener('DOMContentLoaded', () => {
  // Application State
  let currentLeader = null;
  let leaderUsers = [];

  // DOM Elements
  const authSection = document.getElementById('auth-section');
  const schedulingSection = document.getElementById('scheduling-section');
  const userBadge = document.getElementById('user-badge');
  const badgeName = document.getElementById('badge-name');
  const badgeAvatar = document.getElementById('badge-avatar');
  const btnLogout = document.getElementById('btn-logout');

  // Login Form Elements
  const loginForm = document.getElementById('login-form');
  const leaderSelect = document.getElementById('leader-select');
  const leaderPassword = document.getElementById('leader-password');
  const togglePassword = document.getElementById('toggle-password');
  const btnLogin = document.getElementById('btn-login');
  const authError = document.getElementById('auth-error');

  // Schedule Form Elements
  const scheduleForm = document.getElementById('schedule-form');
  const userSelect = document.getElementById('user-select');
  const userInfoCard = document.getElementById('user-info-card');
  const infoUserName = document.getElementById('info-user-name');
  const infoUserId = document.getElementById('info-user-id');
  const infoOooName = document.getElementById('info-ooo-name');
  const infoSessionTime = document.getElementById('info-session-time');
  const infoConfigTag = document.getElementById('info-config-tag');
  const appointmentDateTime = document.getElementById('appointment-date-time');
  const appointmentNotes = document.getElementById('appointment-notes');
  const btnSubmit = document.getElementById('btn-submit-appointment');
  const scheduleFeedback = document.getElementById('schedule-feedback');
  const btnRefreshData = document.getElementById('btn-refresh-data');

  // Appointments Table Elements
  const appointmentsCountBadge = document.getElementById('appointment-count-badge');
  const appointmentsLoading = document.getElementById('appointments-loading');
  const appointmentsEmpty = document.getElementById('appointments-empty');
  const appointmentsContainer = document.getElementById('appointments-list-container');
  const appointmentsTbody = document.getElementById('appointments-tbody');

  // --- Initial Setup ---
  initMinDateTime();
  loadLeaders();

  // Password visibility toggle
  togglePassword.addEventListener('click', () => {
    const isPass = leaderPassword.getAttribute('type') === 'password';
    leaderPassword.setAttribute('type', isPass ? 'text' : 'password');
    togglePassword.textContent = isPass ? '🔒' : '👁️';
  });

  // Set minimum date for appointment to current IST time
  function initMinDateTime() {
    const now = new Date();
    // Format YYYY-MM-DDTHH:mm
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    appointmentDateTime.min = `${year}-${month}-${day}T${hours}:${mins}`;
  }

  // Fetch leaders from API
  async function loadLeaders() {
    try {
      leaderSelect.innerHTML = '<option value="" disabled selected>Loading active leaders...</option>';
      const res = await fetch('/api/leaders');
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to load leaders');
      }

      leaderSelect.innerHTML = '<option value="" disabled selected>-- Select your name --</option>';
      data.leaders.forEach(leader => {
        const opt = document.createElement('option');
        opt.value = leader;
        opt.textContent = leader;
        leaderSelect.appendChild(opt);
      });
    } catch (err) {
      showError(authError, `Error loading leaders: ${err.message}`);
    }
  }

  // --- Authentication Handler ---
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(authError);

    const leaderName = leaderSelect.value;
    const password = leaderPassword.value.trim();

    if (!leaderName) {
      showError(authError, 'Please select your leader name.');
      return;
    }
    if (!password) {
      showError(authError, 'Please enter your 4-digit PIN.');
      return;
    }

    setLoading(btnLogin, true, 'Verifying...');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leader_name: leaderName, password: password })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Sign in failed. Check your password.');
      }

      // Successful login
      currentLeader = data.leader_name;
      leaderUsers = data.users || [];

      // Switch to scheduling view
      enterPortal();
    } catch (err) {
      showError(authError, err.message);
    } finally {
      setLoading(btnLogin, false, 'Access Portal');
    }
  });

  // Transition UI to authenticated state
  function enterPortal() {
    authSection.classList.add('hidden');
    schedulingSection.classList.remove('hidden');

    // Header badge
    userBadge.classList.remove('hidden');
    badgeName.textContent = currentLeader;
    badgeAvatar.textContent = currentLeader.charAt(0).toUpperCase();

    // Populate learner dropdown
    populateUserDropdown();

    // Load existing scheduled appointments for this leader
    loadAppointments();
  }

  // Logout handler
  btnLogout.addEventListener('click', () => {
    currentLeader = null;
    leaderUsers = [];
    leaderPassword.value = '';
    hideAlert(authError);
    hideAlert(scheduleFeedback);

    userBadge.classList.add('hidden');
    schedulingSection.classList.add('hidden');
    authSection.classList.remove('hidden');
  });

  // Populate users in dropdown
  function populateUserDropdown() {
    userSelect.innerHTML = '<option value="" disabled selected>-- Choose a learner from today\'s sessions --</option>';

    if (!leaderUsers || leaderUsers.length === 0) {
      const opt = document.createElement('option');
      opt.value = "";
      opt.textContent = "No learners scheduled today on Sheet 1";
      userSelect.appendChild(opt);
      userInfoCard.classList.add('hidden');
      return;
    }

    leaderUsers.forEach((u, idx) => {
      const opt = document.createElement('option');
      opt.value = idx;
      const svc = u.oneonone_name ? ` (${u.oneonone_name})` : '';
      const uid = u.user_id ? ` • ID: ${u.user_id}` : '';
      opt.textContent = `${u.user_name}${svc}${uid}`;
      userSelect.appendChild(opt);
    });
  }

  // Update learner details card on select change
  userSelect.addEventListener('change', () => {
    const idx = parseInt(userSelect.value, 10);
    if (isNaN(idx) || !leaderUsers[idx]) {
      userInfoCard.classList.add('hidden');
      return;
    }

    const u = leaderUsers[idx];
    infoUserName.textContent = u.user_name || '-';
    infoUserId.textContent = u.user_id || '-';
    infoOooName.textContent = u.oneonone_name || '1:1 Session';
    infoSessionTime.textContent = u.original_session || 'Today';
    infoConfigTag.textContent = u.config_id ? `Config #${u.config_id}` : '1:1';

    userInfoCard.classList.remove('hidden');
  });

  // --- Schedule Form Submit Handler ---
  scheduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideAlert(scheduleFeedback);

    const userIdx = parseInt(userSelect.value, 10);
    if (isNaN(userIdx) || !leaderUsers[userIdx]) {
      showError(scheduleFeedback, 'Please select a learner from the dropdown.');
      return;
    }

    const selectedUser = leaderUsers[userIdx];
    const dtVal = appointmentDateTime.value;

    if (!dtVal) {
      showError(scheduleFeedback, 'Please select a date and time for the appointment.');
      return;
    }

    // Format date string as YYYY-MM-DD HH:MM
    const formattedDt = dtVal.replace('T', ' ');

    setLoading(btnSubmit, true, 'Saving to Google Sheet...');

    const payload = {
      leader_name: currentLeader,
      user_id: selectedUser.user_id,
      user_name: selectedUser.user_name,
      oneonone_name: selectedUser.oneonone_name,
      config_id: selectedUser.config_id,
      scheduled_date_time: formattedDt,
      notes: appointmentNotes.value.trim()
    };

    try {
      const res = await fetch('/api/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to schedule appointment.');
      }

      // Success feedback
      showSuccess(scheduleFeedback, `✅ Appointment for ${selectedUser.user_name} scheduled successfully for ${formattedDt} and saved to Google Sheet!`);

      // Reset appointment inputs
      appointmentDateTime.value = '';
      appointmentNotes.value = '';

      // Reload appointments table
      loadAppointments();
    } catch (err) {
      showError(scheduleFeedback, err.message);
    } finally {
      setLoading(btnSubmit, false, 'Confirm & Save Appointment');
    }
  });

  // Refresh list button
  btnRefreshData.addEventListener('click', async () => {
    btnRefreshData.disabled = true;
    btnRefreshData.textContent = 'Refreshing...';
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leader_name: currentLeader, password: leaderPassword.value.trim() })
      });
      const data = await res.json();
      if (data.success) {
        leaderUsers = data.users || [];
        populateUserDropdown();
        loadAppointments();
        showSuccess(scheduleFeedback, 'Data refreshed from Google Sheet.');
      }
    } catch (e) {
      showError(scheduleFeedback, 'Failed to refresh: ' + e.message);
    } finally {
      btnRefreshData.disabled = false;
      btnRefreshData.textContent = '🔄 Refresh List';
    }
  });

  // Load scheduled appointments for current leader
  async function loadAppointments() {
    if (!currentLeader) return;

    appointmentsLoading.classList.remove('hidden');
    appointmentsEmpty.classList.add('hidden');
    appointmentsContainer.classList.add('hidden');

    try {
      const res = await fetch(`/api/appointments?leader=${encodeURIComponent(currentLeader)}`);
      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Error loading appointments');
      }

      const list = data.appointments || [];
      appointmentsCountBadge.textContent = `${list.length} saved`;

      if (list.length === 0) {
        appointmentsEmpty.classList.remove('hidden');
        return;
      }

      appointmentsTbody.innerHTML = '';
      list.forEach(app => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><strong>${escapeHtml(app['User Name'] || '-')}</strong></td>
          <td><code>${escapeHtml(app['User ID'] || '-')}</code></td>
          <td>${escapeHtml(app['One on One Name'] || '-')}</td>
          <td><strong>${escapeHtml(app['Scheduled Date and Time'] || '-')}</strong></td>
          <td>${escapeHtml(app['Notes'] || '—')}</td>
          <td><span class="status-pill">${escapeHtml(app['Status'] || 'Scheduled')}</span></td>
        `;
        appointmentsTbody.appendChild(tr);
      });

      appointmentsContainer.classList.remove('hidden');
    } catch (err) {
      console.error('Failed to load appointments:', err);
      appointmentsEmpty.innerHTML = `<p style="color: var(--error)">Error loading appointments: ${escapeHtml(err.message)}</p>`;
      appointmentsEmpty.classList.remove('hidden');
    } finally {
      appointmentsLoading.classList.add('hidden');
    }
  }

  // --- Utility Functions ---
  function setLoading(btn, isLoading, text) {
    const textEl = btn.querySelector('.btn-text-content');
    const spinEl = btn.querySelector('.spinner');
    btn.disabled = isLoading;
    if (textEl) textEl.textContent = text;
    if (spinEl) spinEl.classList.toggle('hidden', !isLoading);
  }

  function showError(el, msg) {
    el.className = 'alert alert-error';
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function showSuccess(el, msg) {
    el.className = 'alert alert-success';
    el.textContent = msg;
    el.classList.remove('hidden');
  }

  function hideAlert(el) {
    el.classList.add('hidden');
    el.textContent = '';
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>'"]/g, tag => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      "'": '&#39;',
      '"': '&quot;'
    }[tag] || tag));
  }
});
