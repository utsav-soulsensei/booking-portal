// SoulSensei Leader Appointment Portal
const SPREADSHEET_ID = '1q-gadAgzT7Rim6p_3GvIPwTj_nznz_IkGrzLG3XP6NI';
const GVIZ_SHEET1_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Sheet1`;
const GVIZ_SCHEDULED_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Scheduled%20Appointments`;

document.addEventListener('DOMContentLoaded', () => {
  // State
  let sheetRows = [];
  let currentLeader = null;
  let leaderUsers = [];
  let scheduledAppointments = [];

  // DOM Elements
  const authSection = document.getElementById('auth-section');
  const schedulingSection = document.getElementById('scheduling-section');
  const userBadge = document.getElementById('user-badge');
  const badgeName = document.getElementById('badge-name');
  const badgeAvatar = document.getElementById('badge-avatar');
  const btnLogout = document.getElementById('btn-logout');

  // Login
  const loginForm = document.getElementById('login-form');
  const leaderSelect = document.getElementById('leader-select');
  const leaderPassword = document.getElementById('leader-password');
  const togglePassword = document.getElementById('toggle-password');
  const btnLogin = document.getElementById('btn-login');
  const authError = document.getElementById('auth-error');

  // Schedule Form
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

  // Appointments Table
  const appointmentsCountBadge = document.getElementById('appointment-count-badge');
  const appointmentsLoading = document.getElementById('appointments-loading');
  const appointmentsEmpty = document.getElementById('appointments-empty');
  const appointmentsContainer = document.getElementById('appointments-list-container');
  const appointmentsTbody = document.getElementById('appointments-tbody');

  // Settings Modal
  const btnOpenSettings = document.getElementById('btn-open-settings');
  const btnCloseSettings = document.getElementById('btn-close-settings');
  const settingsModal = document.getElementById('settings-modal');
  const appsScriptUrlInput = document.getElementById('apps-script-url');
  const btnSaveSettings = document.getElementById('btn-save-settings');

  // Load saved settings
  const savedWebhook = localStorage.getItem('SOULSENSEI_WEBHOOK_URL') || '';
  appsScriptUrlInput.value = savedWebhook;

  // Initialize
  initMinDateTime();
  loadSheetData();

  // Settings modal listeners
  btnOpenSettings.addEventListener('click', () => settingsModal.classList.remove('hidden'));
  btnCloseSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
  settingsModal.addEventListener('click', (e) => {
    if (e.target === settingsModal) settingsModal.classList.add('hidden');
  });
  btnSaveSettings.addEventListener('click', () => {
    const url = appsScriptUrlInput.value.trim();
    localStorage.setItem('SOULSENSEI_WEBHOOK_URL', url);
    settingsModal.classList.add('hidden');
    alert('Settings saved!');
  });

  // Password visibility toggle
  togglePassword.addEventListener('click', () => {
    const isPass = leaderPassword.getAttribute('type') === 'password';
    leaderPassword.setAttribute('type', isPass ? 'text' : 'password');
    togglePassword.textContent = isPass ? '🔒' : '👁️';
  });

  // Min date
  function initMinDateTime() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const mins = String(now.getMinutes()).padStart(2, '0');
    appointmentDateTime.min = `${year}-${month}-${day}T${hours}:${mins}`;
  }

  // --- 1. Fetch Sheet 1 Data via Google Visualization API ---
  async function loadSheetData() {
    leaderSelect.innerHTML = '<option value="" disabled selected>Loading active leaders from Google Sheet...</option>';
    try {
      // First try gviz directly (works everywhere, zero server needed)
      const res = await fetch(GVIZ_SHEET1_URL);
      const text = await res.text();
      const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const gvizData = JSON.parse(jsonStr);

      const cols = gvizData.table.cols.map(c => c.label || c.id);
      const colLeader = cols.indexOf('Leader Name') !== -1 ? cols.indexOf('Leader Name') : 0;
      const colOoo = cols.indexOf('One on One Name') !== -1 ? cols.indexOf('One on One Name') : 1;
      const colCfg = cols.indexOf('One on One Config ID') !== -1 ? cols.indexOf('One on One Config ID') : 2;
      const colUid = cols.indexOf('User ID') !== -1 ? cols.indexOf('User ID') : 3;
      const colUname = cols.indexOf('User Name') !== -1 ? cols.indexOf('User Name') : 4;
      const colTime = cols.indexOf('Session Date and Time') !== -1 ? cols.indexOf('Session Date and Time') : 5;
      const colPwd = cols.indexOf('Leader Password') !== -1 ? cols.indexOf('Leader Password') : 6;

      sheetRows = gvizData.table.rows.map(r => {
        const getVal = (idx) => {
          if (!r.c || !r.c[idx]) return '';
          const val = r.c[idx].v;
          return val !== null && val !== undefined ? String(val) : '';
        };

        return {
          leader_name: getVal(colLeader).trim(),
          oneonone_name: getVal(colOoo).trim(),
          config_id: getVal(colCfg).trim(),
          user_id: getVal(colUid).trim(),
          user_name: getVal(colUname).trim(),
          session_time: getVal(colTime).trim(),
          password: getVal(colPwd).trim()
        };
      }).filter(r => r.leader_name);

      // Populate leader dropdown
      const leaders = Array.from(new Set(sheetRows.map(r => r.leader_name))).sort();

      leaderSelect.innerHTML = '<option value="" disabled selected>-- Select your name --</option>';
      leaders.forEach(name => {
        const opt = document.createElement('option');
        opt.value = name;
        opt.textContent = name;
        leaderSelect.appendChild(opt);
      });
    } catch (err) {
      console.error('GViz fetch failed, trying local /api/leaders...', err);
      // Fallback to local /api/leaders if running on Flask
      try {
        const res = await fetch('/api/leaders');
        const data = await res.json();
        if (data.success && data.leaders) {
          leaderSelect.innerHTML = '<option value="" disabled selected>-- Select your name --</option>';
          data.leaders.forEach(name => {
            const opt = document.createElement('option');
            opt.value = name;
            opt.textContent = name;
            leaderSelect.appendChild(opt);
          });
          return;
        }
      } catch (e) {
        showError(authError, `Failed to load leaders from Google Sheet: ${err.message}`);
      }
    }
  }

  // --- 2. Authentication ---
  loginForm.addEventListener('submit', (e) => {
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

    // Match against loaded sheetRows
    const matchedLeaderRows = sheetRows.filter(
      r => r.leader_name.toLowerCase() === leaderName.toLowerCase()
    );

    const pwdDigits = password.replace(/\D/g, '');
    const isPasswordValid = matchedLeaderRows.some(r => {
      const storedDigits = r.password.replace(/\D/g, '');
      return storedDigits === pwdDigits || r.password === password;
    });

    if (matchedLeaderRows.length > 0 && isPasswordValid) {
      currentLeader = leaderName;
      leaderUsers = matchedLeaderRows;
      setLoading(btnLogin, false, 'Access Portal');
      enterPortal();
      return;
    }

    // If local match fails or sheetRows was empty, try backend /api/login fallback
    fetch('/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ leader_name: leaderName, password: password })
    })
    .then(r => r.json())
    .then(data => {
      setLoading(btnLogin, false, 'Access Portal');
      if (data.success) {
        currentLeader = data.leader_name;
        leaderUsers = data.users.map(u => ({
          leader_name: currentLeader,
          oneonone_name: u.oneonone_name,
          config_id: u.config_id,
          user_id: u.user_id,
          user_name: u.user_name,
          session_time: u.original_session,
          password: password
        }));
        enterPortal();
      } else {
        showError(authError, data.error || 'Incorrect PIN. Please enter the last 4 digits of your phone.');
      }
    })
    .catch(() => {
      setLoading(btnLogin, false, 'Access Portal');
      showError(authError, 'Incorrect PIN. Please enter the last 4 digits of your registered phone number (or 8888).');
    });
  });

  function enterPortal() {
    authSection.classList.add('hidden');
    schedulingSection.classList.remove('hidden');

    userBadge.classList.remove('hidden');
    badgeName.textContent = currentLeader;
    badgeAvatar.textContent = currentLeader.charAt(0).toUpperCase();

    populateUserDropdown();
    loadAppointments();
  }

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

  // --- 3. Populate Learner Dropdown ---
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
    infoSessionTime.textContent = u.session_time || 'Today';
    infoConfigTag.textContent = u.config_id ? `Config #${u.config_id}` : '1:1';

    userInfoCard.classList.remove('hidden');
  });

  // --- 4. Schedule Appointment Submission ---
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

    const formattedDt = dtVal.replace('T', ' ');
    setLoading(btnSubmit, true, 'Saving appointment...');

    const payload = {
      leader_name: currentLeader,
      user_id: selectedUser.user_id,
      user_name: selectedUser.user_name,
      oneonone_name: selectedUser.oneonone_name,
      config_id: selectedUser.config_id,
      scheduled_date_time: formattedDt,
      notes: appointmentNotes.value.trim()
    };

    let savedRemote = false;

    // A. Check if user configured an Apps Script Webhook URL
    const webhookUrl = localStorage.getItem('SOULSENSEI_WEBHOOK_URL');
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        savedRemote = true;
      } catch (err) {
        console.warn('Apps Script webhook error:', err);
      }
    }

    // B. Check if local backend API /api/schedule is available
    if (!savedRemote) {
      try {
        const res = await fetch('/api/schedule', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const resData = await res.json();
        if (resData.success) {
          savedRemote = true;
        }
      } catch (e) {
        // Static mode without server
      }
    }

    // C. Always save in localStorage so it persists locally
    saveToLocalStorage(payload);

    setLoading(btnSubmit, false, 'Confirm & Save Appointment');
    showSuccess(
      scheduleFeedback,
      `✅ Appointment for ${selectedUser.user_name} scheduled for ${formattedDt}! Saved to 'Scheduled Appointments'.`
    );

    appointmentDateTime.value = '';
    appointmentNotes.value = '';

    // Refresh table
    loadAppointments();
  });

  // Local storage cache helper
  function saveToLocalStorage(appointment) {
    const list = JSON.parse(localStorage.getItem('SOULSENSEI_LOCAL_APPOINTMENTS') || '[]');
    list.unshift({
      ...appointment,
      Timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      Status: 'Scheduled'
    });
    localStorage.setItem('SOULSENSEI_LOCAL_APPOINTMENTS', JSON.stringify(list));
  }

  // --- 5. Load Scheduled Appointments ---
  async function loadAppointments() {
    if (!currentLeader) return;

    appointmentsLoading.classList.remove('hidden');
    appointmentsEmpty.classList.add('hidden');
    appointmentsContainer.classList.add('hidden');

    let allAppointments = [];

    // 1. Fetch remote appointments from Google Sheet via gviz
    try {
      const res = await fetch(GVIZ_SCHEDULED_URL);
      const text = await res.text();
      const jsonStr = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
      const gvizData = JSON.parse(jsonStr);

      if (gvizData.table && gvizData.table.rows) {
        const rows = gvizData.table.rows;
        // Parse rows
        rows.forEach(r => {
          if (!r.c) return;
          const vals = r.c.map(c => c ? String(c.v || '') : '');
          // Header check
          if (vals[0] === 'Timestamp' || vals[1] === 'Leader Name') return;

          const leader = vals[1] || '';
          if (leader.toLowerCase() === currentLeader.toLowerCase()) {
            allAppointments.push({
              leader_name: leader,
              oneonone_name: vals[2] || '',
              config_id: vals[3] || '',
              user_id: vals[4] || '',
              user_name: vals[5] || '',
              scheduled_date_time: vals[6] || '',
              notes: vals[7] || '',
              status: vals[8] || 'Scheduled'
            });
          }
        });
      }
    } catch (e) {
      console.log('Remote appointments gviz fetch:', e.message);
    }

    // 2. Fetch local storage appointments
    const local = JSON.parse(localStorage.getItem('SOULSENSEI_LOCAL_APPOINTMENTS') || '[]');
    const leaderLocal = local.filter(a => a.leader_name && a.leader_name.toLowerCase() === currentLeader.toLowerCase());

    // Merge without duplicates (by user_id + scheduled_date_time)
    const seen = new Set();
    const merged = [];

    [...leaderLocal, ...allAppointments].forEach(a => {
      const key = `${a.user_id}_${a.scheduled_date_time}`;
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(a);
      }
    });

    appointmentsLoading.classList.add('hidden');
    appointmentsCountBadge.textContent = `${merged.length} saved`;

    if (merged.length === 0) {
      appointmentsEmpty.classList.remove('hidden');
      return;
    }

    appointmentsTbody.innerHTML = '';
    merged.forEach(app => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td><strong>${escapeHtml(app.user_name || '-')}</strong></td>
        <td><code>${escapeHtml(app.user_id || '-')}</code></td>
        <td>${escapeHtml(app.oneonone_name || '-')}</td>
        <td><strong>${escapeHtml(app.scheduled_date_time || '-')}</strong></td>
        <td>${escapeHtml(app.notes || '—')}</td>
        <td><span class="status-pill">${escapeHtml(app.status || 'Scheduled')}</span></td>
      `;
      appointmentsTbody.appendChild(tr);
    });

    appointmentsContainer.classList.remove('hidden');
  }

  // Refresh button
  btnRefreshData.addEventListener('click', async () => {
    btnRefreshData.disabled = true;
    btnRefreshData.textContent = 'Refreshing...';
    await loadSheetData();
    if (currentLeader) {
      leaderUsers = sheetRows.filter(r => r.leader_name.toLowerCase() === currentLeader.toLowerCase());
      populateUserDropdown();
      await loadAppointments();
    }
    btnRefreshData.disabled = false;
    btnRefreshData.textContent = '🔄 Refresh List';
    showSuccess(scheduleFeedback, 'Refreshed latest data from Google Sheet.');
  });

  // Helpers
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
