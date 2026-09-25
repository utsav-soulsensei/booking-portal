// SoulSensei Leader Appointment Portal
const SPREADSHEET_ID = '1q-gadAgzT7Rim6p_3GvIPwTj_nznz_IkGrzLG3XP6NI';
const GVIZ_SHEET1_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Sheet1`;
const GVIZ_SCHEDULED_URL = `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/gviz/tq?tqx=out:json&sheet=Scheduled%20Appointments`;
// Google Apps Script Webhook URL (Runs serverless inside Google Sheets)
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxGbYIB1XBg8Y-N7nvx7yKLh_BDFIhbxYxcAHiJcT55J3_WyQjIyFl4yAaNKH2fn_q8Uw/exec';

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

  // Initialize
  initMinDateTime();
  loadSheetData();

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

  // --- Helpers for GViz Parsing & Date Normalization ---
  function getGvizValue(cell) {
    if (!cell) return '';
    if (cell.f !== undefined && cell.f !== null) {
      return String(cell.f).trim();
    }
    if (cell.v !== undefined && cell.v !== null) {
      const vStr = String(cell.v).trim();
      const dateMatch = vStr.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+)(?:,(\d+))?)?\)$/);
      if (dateMatch) {
        const year = dateMatch[1];
        const month = String(parseInt(dateMatch[2], 10) + 1).padStart(2, '0');
        const day = String(parseInt(dateMatch[3], 10)).padStart(2, '0');
        const hour = dateMatch[4] !== undefined ? String(parseInt(dateMatch[4], 10)).padStart(2, '0') : '00';
        const min = dateMatch[5] !== undefined ? String(parseInt(dateMatch[5], 10)).padStart(2, '0') : '00';
        return `${year}-${month}-${day} ${hour}:${min}`;
      }
      return vStr;
    }
    return '';
  }

  function normalizeDateTime(dtStr) {
    if (!dtStr) return '';
    const str = String(dtStr).trim();
    const dateMatch = str.match(/^Date\((\d+),(\d+),(\d+)(?:,(\d+),(\d+)(?:,(\d+))?)?\)$/);
    if (dateMatch) {
      const year = dateMatch[1];
      const month = String(parseInt(dateMatch[2], 10) + 1).padStart(2, '0');
      const day = String(parseInt(dateMatch[3], 10)).padStart(2, '0');
      const hour = dateMatch[4] !== undefined ? String(parseInt(dateMatch[4], 10)).padStart(2, '0') : '00';
      const min = dateMatch[5] !== undefined ? String(parseInt(dateMatch[5], 10)).padStart(2, '0') : '00';
      return `${year}-${month}-${day} ${hour}:${min}`;
    }
    const cleaned = str.replace('T', ' ');
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(cleaned)) {
      return cleaned.substring(0, 16);
    }
    return cleaned;
  }

  function getAppointmentKey(app) {
    const uid = String(app.user_id || app.user_name || '').trim().toLowerCase();
    const dt = normalizeDateTime(app.scheduled_date_time);
    return `${uid}_${dt}`;
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
        if (!r.c) return null;
        return {
          leader_name: getGvizValue(r.c[colLeader]),
          oneonone_name: getGvizValue(r.c[colOoo]),
          config_id: getGvizValue(r.c[colCfg]),
          user_id: getGvizValue(r.c[colUid]),
          user_name: getGvizValue(r.c[colUname]),
          session_time: getGvizValue(r.c[colTime]),
          password: getGvizValue(r.c[colPwd])
        };
      }).filter(r => r && r.leader_name);

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
      const timeStr = u.session_time ? ` [${u.session_time}]` : '';
      const svc = u.oneonone_name ? ` • ${u.oneonone_name}` : '';
      const uid = u.user_id ? ` (ID: ${u.user_id})` : '';
      opt.textContent = `${u.user_name || 'User'}${timeStr}${svc}${uid}`;
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
  let isSubmitting = false;

  scheduleForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
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
    isSubmitting = true;
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
    let errorMessage = '';

    const webhookUrl = APPS_SCRIPT_URL || localStorage.getItem('SOULSENSEI_WEBHOOK_URL');

    try {
      if (webhookUrl) {
        try {
          await fetch(webhookUrl, {
            method: 'POST',
            mode: 'no-cors',
            cache: 'no-cache',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
          });
          savedRemote = true;
        } catch (err) {
          console.warn('Apps Script POST error, trying GET fallback:', err);
          try {
            const params = new URLSearchParams(payload).toString();
            await fetch(`${webhookUrl}?${params}`, { mode: 'no-cors' });
            savedRemote = true;
          } catch (e2) {
            errorMessage = e2.message;
          }
        }
      } else {
        errorMessage = 'Google Apps Script Webhook is not configured yet.';
      }

      if (savedRemote) {
        saveToLocalStorage(payload);
        showSuccess(
          scheduleFeedback,
          `✅ Appointment for ${selectedUser.user_name} scheduled for ${formattedDt}!`
        );
        appointmentDateTime.value = '';
        appointmentNotes.value = '';
        loadAppointments();
        setTimeout(() => loadAppointments(), 3000);
      } else {
        saveToLocalStorage({ ...payload, sync_status: 'Unsynced' });
        showError(
          scheduleFeedback,
          `⚠️ ${errorMessage} Your entry was saved locally in the browser.`
        );
        loadAppointments();
      }
    } finally {
      isSubmitting = false;
      setLoading(btnSubmit, false, 'Confirm & Save Appointment');
    }
  });

  // Local storage cache helper
  function saveToLocalStorage(appointment) {
    const list = JSON.parse(localStorage.getItem('SOULSENSEI_LOCAL_APPOINTMENTS') || '[]');
    const newEntry = {
      ...appointment,
      scheduled_date_time: normalizeDateTime(appointment.scheduled_date_time),
      Timestamp: new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }),
      status: appointment.status || 'Scheduled'
    };
    const newKey = getAppointmentKey(newEntry);
    const filtered = list.filter(item => getAppointmentKey(item) !== newKey);
    filtered.unshift(newEntry);
    localStorage.setItem('SOULSENSEI_LOCAL_APPOINTMENTS', JSON.stringify(filtered));
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
        const cols = (gvizData.table.cols || []).map(c => (c.label || c.id || '').trim());
        const colLeader = cols.indexOf('Leader Name') !== -1 ? cols.indexOf('Leader Name') : 1;
        const colOoo = cols.indexOf('One on One Name') !== -1 ? cols.indexOf('One on One Name') : 2;
        const colCfg = cols.indexOf('One on One Config ID') !== -1 ? cols.indexOf('One on One Config ID') : 3;
        const colUid = cols.indexOf('User ID') !== -1 ? cols.indexOf('User ID') : 4;
        const colUname = cols.indexOf('User Name') !== -1 ? cols.indexOf('User Name') : 5;
        const colTime = cols.indexOf('Scheduled Date and Time') !== -1 ? cols.indexOf('Scheduled Date and Time') : 6;
        const colNotes = cols.indexOf('Notes') !== -1 ? cols.indexOf('Notes') : 7;
        const colStatus = cols.indexOf('Status') !== -1 ? cols.indexOf('Status') : 8;

        rows.forEach(r => {
          if (!r.c) return;
          const leader = getGvizValue(r.c[colLeader]);
          if (leader === 'Leader Name' || !leader) return;

          if (leader.toLowerCase() === currentLeader.toLowerCase()) {
            allAppointments.push({
              leader_name: leader,
              oneonone_name: getGvizValue(r.c[colOoo]),
              config_id: getGvizValue(r.c[colCfg]),
              user_id: getGvizValue(r.c[colUid]),
              user_name: getGvizValue(r.c[colUname]),
              scheduled_date_time: normalizeDateTime(getGvizValue(r.c[colTime])),
              notes: getGvizValue(r.c[colNotes]),
              status: getGvizValue(r.c[colStatus]) || 'Scheduled'
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

    // Merge: Google Sheets appointments are the source of truth
    const seen = new Set();
    const merged = [];

    allAppointments.forEach(a => {
      const key = getAppointmentKey(a);
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push(a);
      }
    });

    // Add local storage appointments only if they are not yet synced to Google Sheets
    const remainingLocal = [];
    leaderLocal.forEach(a => {
      const key = getAppointmentKey(a);
      if (key && !seen.has(key)) {
        seen.add(key);
        merged.push({
          ...a,
          scheduled_date_time: normalizeDateTime(a.scheduled_date_time)
        });
        remainingLocal.push(a);
      }
    });

    // Clean up local storage so synced appointments do not linger
    const otherLeaderLocal = local.filter(a => !a.leader_name || a.leader_name.toLowerCase() !== currentLeader.toLowerCase());
    localStorage.setItem('SOULSENSEI_LOCAL_APPOINTMENTS', JSON.stringify([...remainingLocal, ...otherLeaderLocal]));

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
