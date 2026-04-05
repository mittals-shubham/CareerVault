/* ═══════════════════════════════════════════
   CareerVault — Application Logic
   ═══════════════════════════════════════════ */

/* ─────────────────────────────────────────
   AUTH MODULE  (must be global so Google GIS can call handleGoogleCredential)
   ─────────────────────────────────────────── */
window._cvUser = null; // { sub, name, email, picture }

/** Decode a JWT payload (no verification needed — GIS verifies server-side) */
function _decodeJWT(token) {
  try {
    const payload = token.split('.')[1];
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch { return null; }
}

/** Called by Google Identity Services after a successful sign-in */
function handleGoogleCredential(response) {
  const payload = _decodeJWT(response.credential);
  if (!payload) return;
  const user = {
    sub: payload.sub,
    name: payload.name,
    email: payload.email,
    picture: payload.picture,
  };
  // Persist session (credential token) so we can restore on page reload
  localStorage.setItem('cv_auth_user', JSON.stringify(user));
  _activateUser(user);
}

/** Activate a user — set prefix, update UI, hide login overlay */
function _activateUser(user) {
  window._cvUser = user;
  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.classList.add('hidden');

  const signoutBtn = document.getElementById('btn-signout');
  if (signoutBtn) signoutBtn.style.display = 'inline-flex';

  // Notify the main app to re-render all sections with the new user scope
  window.dispatchEvent(new Event('cv_user_activated'));
}

/** Sign out — clear session, show login overlay */
window.signOut = function () {
  localStorage.removeItem('cv_auth_user');
  window._cvUser = null;

  const overlay = document.getElementById('login-overlay');
  if (overlay) overlay.classList.remove('hidden');

  const signoutBtn = document.getElementById('btn-signout');
  if (signoutBtn) signoutBtn.style.display = 'none';

  // Revoke Google session so the picker shows again
  if (window.google && google.accounts && google.accounts.id) {
    google.accounts.id.disableAutoSelect();
  }

  // Notify the main app to clear/re-render
  window.dispatchEvent(new Event('cv_user_signed_out'));
};

/** On page load — check for saved session */
function initAuth() {
  // Wire sign-out button
  const signoutBtn = document.getElementById('btn-signout');
  if (signoutBtn) signoutBtn.addEventListener('click', window.signOut);

  const saved = localStorage.getItem('cv_auth_user');
  if (saved) {
    try {
      const user = JSON.parse(saved);
      if (user && user.sub) {
        _activateUser(user);
        return; // skip showing login overlay
      }
    } catch { /* fall through to show login */ }
  }
  // Show the login overlay (it's already visible in HTML — nothing to do)
}

// Run auth init as soon as DOM is ready
document.addEventListener('DOMContentLoaded', initAuth);

(function () {
  'use strict';

  // ─── Storage Keys ───
  const KEYS = {
    profile: 'cv_profile',
    education: 'cv_education',
    experience: 'cv_experience',
    documents: 'cv_documents',
    skills: 'cv_skills',
    photo: 'cv_photo',
  };

  // ─── Storage Helpers (per-user scoped via Google sub) ───
  function _userKey(key) {
    // If user is signed in, scope the key to their Google ID
    const uid = window._cvUser && window._cvUser.sub;
    if (uid) {
      // Convert 'cv_profile' → 'cv_<uid>_profile'
      return key.replace(/^cv_/, `cv_${uid}_`);
    }
    return key;
  }

  const store = {
    get(key) { try { return JSON.parse(localStorage.getItem(_userKey(key))); } catch { return null; } },
    set(key, data) { localStorage.setItem(_userKey(key), JSON.stringify(data)); },
    remove(key) { localStorage.removeItem(_userKey(key)); },
    // Raw access (unscoped) for auth-level keys
    getRaw(key) { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    setRaw(key, v) { localStorage.setItem(key, JSON.stringify(v)); },
  };

  // ─── DOM Refs ───
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const sidebar = $('#sidebar');
  const sidebarOverlay = $('#sidebar-overlay');
  const btnMenu = $('#btn-menu');

  // ─── Navigation ───
  function navigateTo(sectionId) {
    $$('.section').forEach((s) => s.classList.remove('active'));
    $$('.nav-item').forEach((n) => n.classList.remove('active'));

    const target = $(`#section-${sectionId}`);
    const navTarget = $(`[data-section="${sectionId}"]`);
    if (target) target.classList.add('active');
    if (navTarget) navTarget.classList.add('active');

    // Re-trigger animation
    if (target) {
      target.style.animation = 'none';
      target.offsetHeight; // reflow
      target.style.animation = '';
    }

    // Close mobile sidebar
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  }

  // Sidebar nav clicks
  $$('.nav-item').forEach((item) => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      navigateTo(item.dataset.section);
    });
  });

  // Quick action cards
  $$('.quick-action-card').forEach((card) => {
    card.addEventListener('click', () => navigateTo(card.dataset.goto));
  });

  // Get Started button
  const btnGetStarted = $('#btn-get-started');
  if (btnGetStarted) btnGetStarted.addEventListener('click', () => navigateTo('profile'));

  // Mobile menu
  btnMenu.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    sidebarOverlay.classList.toggle('active');
  });
  sidebarOverlay.addEventListener('click', () => {
    sidebar.classList.remove('open');
    sidebarOverlay.classList.remove('active');
  });

  // ─── Theme Toggle ───
  const themeToggle = $('#btn-theme-toggle');
  const themeIcon = $('#theme-icon');

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeIcon.textContent = theme === 'dark' ? 'light_mode' : 'dark_mode';
    localStorage.setItem('cv_theme', theme);
  }

  // Init theme from saved preference
  const savedTheme = localStorage.getItem('cv_theme') || 'light';
  applyTheme(savedTheme);

  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

  // ─── Toast ───
  function showToast(message, type = 'success') {
    const container = $('#toast-container');
    const icons = { success: 'check_circle', error: 'error', info: 'info' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="material-icons-round">${icons[type] || 'info'}</span><span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; toast.style.transform = 'translateX(40px)'; setTimeout(() => toast.remove(), 300); }, 3000);
  }

  // ─── Custom Confirm (replaces native confirm) ───
  function showConfirm(message, onConfirm) {
    const html = `
      <div style="text-align:center;padding:var(--sp-4) 0;">
        <span class="material-icons-round" style="font-size:48px;color:var(--clr-danger);margin-bottom:var(--sp-4);">warning</span>
        <p style="font-size:var(--fs-base);color:var(--clr-text);margin-bottom:var(--sp-6);">${message}</p>
        <div style="display:flex;gap:var(--sp-3);justify-content:center;">
          <button class="btn btn-outline" id="confirm-cancel">Cancel</button>
          <button class="btn btn-primary" id="confirm-yes" style="background:var(--clr-danger);"><span class="material-icons-round">delete</span> Delete</button>
        </div>
      </div>
    `;
    openModal('Confirm Delete', html);
    $('#confirm-cancel').addEventListener('click', closeModal);
    $('#confirm-yes').addEventListener('click', () => {
      closeModal();
      onConfirm();
    });
  }

  // ─── Single Item Action Helpers ───
  function confirmSingleDelete(message, listGetter, listSaver, listRenderer, index) {
    showConfirm(message, () => {
      const list = listGetter();
      list.splice(index, 1);
      listSaver(list);
      listRenderer();
      if (typeof renderResumePreview === 'function') renderResumePreview();
      showToast('Record deleted.', 'info');
    });
  }

  // ─── List Selection Helper (used by sections for "Select All" / "Delete Selected") ───
  function initListSelection(sectionId, listGetter, listSaver, listRenderer) {
    const chkAll = $('#chk-all-' + sectionId);
    const btnDel = $('#btn-clear-' + sectionId);
    const wrapAll = $('#wrap-select-' + sectionId);

    const updateHeader = () => {
      const list = listGetter();
      if (!chkAll || !btnDel || !wrapAll) return;
      if (list.length === 0) {
        wrapAll.style.display = 'none';
        btnDel.style.display = 'none';
      } else {
        wrapAll.style.display = list.length > 1 ? 'flex' : 'none';
        btnDel.style.display = 'flex';
      }
      chkAll.checked = false;
      btnDel.disabled = true;
    };

    if (chkAll) {
      chkAll.addEventListener('change', (e) => {
        const checkboxes = document.querySelectorAll('.chk-item-' + sectionId);
        checkboxes.forEach(chk => chk.checked = e.target.checked);
        btnDel.disabled = !e.target.checked || checkboxes.length === 0;
      });
    }

    if (btnDel) {
      btnDel.addEventListener('click', () => {
        const checkboxes = document.querySelectorAll('.chk-item-' + sectionId + ':checked');
        if (!checkboxes.length) return;
        
        showConfirm('Delete ' + checkboxes.length + ' selected item(s)?', () => {
          let list = listGetter();
          const indices = Array.from(checkboxes).map(chk => parseInt(chk.value)).sort((a,b) => b - a);
          indices.forEach(idx => list.splice(idx, 1));
          listSaver(list);
          listRenderer();
          if (typeof renderResumePreview === 'function') renderResumePreview();
          showToast(indices.length + ' item(s) deleted.', 'info');
        });
      });
    }

    return {
      updateHeader,
      bindCheckboxes: () => {
        const checkboxes = document.querySelectorAll('.chk-item-' + sectionId);
        checkboxes.forEach(chk => {
          chk.addEventListener('change', () => {
            const checkedCount = document.querySelectorAll('.chk-item-' + sectionId + ':checked').length;
            if (chkAll) chkAll.checked = (checkedCount === checkboxes.length && checkboxes.length > 0);
            if (btnDel) btnDel.disabled = checkedCount === 0;
          });
        });
      }
    };
  }

  // ─── Modal ───
  const modalOverlay = $('#modal-overlay');
  const modalTitle = $('#modal-title');
  const modalBody = $('#modal-body');
  const modalClose = $('#modal-close');

  function openModal(title, contentHTML) {
    modalTitle.textContent = title;
    modalBody.innerHTML = contentHTML;
    modalOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  }

  function closeModal() {
    modalOverlay.classList.remove('active');
    document.body.style.overflow = '';
  }

  modalClose.addEventListener('click', closeModal);
  modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeModal(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

  // ─── User Badge & Greeting ───
  function updateUserBadge() {
    const profile = store.get(KEYS.profile) || {};
    const avatarEl = $('#user-avatar');
    const nameEl = $('#user-name');
    const emailEl = $('#user-email');
    const greetingEl = $('#greeting-text');

    // Greeting based on time of day
    const hour = new Date().getHours();
    let greet = 'Good evening';
    if (hour < 12) greet = 'Good morning';
    else if (hour < 17) greet = 'Good afternoon';

    const first = (profile.firstName || (window._cvUser && window._cvUser.name ? window._cvUser.name.split(' ')[0] : 'Guest')).trim();
    const last = (profile.lastName || '').trim();
    const email = profile.email || (window._cvUser ? window._cvUser.email : 'Set up your profile');

    if (nameEl) nameEl.textContent = first + (last ? ' ' + last : '');
    if (emailEl) emailEl.textContent = email;
    if (greetingEl) greetingEl.textContent = `${greet}, ${first} 👋`;

    if (avatarEl) {
      const photo = store.get(KEYS.photo);
      if (photo) {
        avatarEl.innerHTML = `<img src="${photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
      } else if (window._cvUser && window._cvUser.picture) {
        avatarEl.innerHTML = `<img src="${window._cvUser.picture}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" referrerpolicy="no-referrer" />`;
      } else {
        const initials = (first && first !== 'Guest' ? first[0] + (last[0] || '') : 'GU').toUpperCase();
        avatarEl.innerHTML = `<span class="avatar-initials">${initials}</span>`;
      }
    }
  }

  // Clicking the badge navigates to profile
  $('#user-profile-badge').addEventListener('click', () => navigateTo('profile'));

  // ═══════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════
  function renderDashboard() {
    const profile = store.get(KEYS.profile);
    const education = store.get(KEYS.education) || [];
    const experience = store.get(KEYS.experience) || [];
    const documents = store.get(KEYS.documents) || [];

    const profileComplete = profile ? calcProfileCompletion(profile) : 0;

    const statsHTML = `
      <div class="stat-card" onclick="document.querySelector('[data-section=profile]').click()">
        <div class="stat-icon profile"><span class="material-icons-round">person</span></div>
        <div class="stat-info"><h4>${profileComplete}%</h4><p>Profile Complete</p></div>
      </div>
      <div class="stat-card" onclick="document.querySelector('[data-section=education]').click()">
        <div class="stat-icon education"><span class="material-icons-round">school</span></div>
        <div class="stat-info"><h4>${education.length}</h4><p>Education Records</p></div>
      </div>
      <div class="stat-card" onclick="document.querySelector('[data-section=experience]').click()">
        <div class="stat-icon experience"><span class="material-icons-round">business_center</span></div>
        <div class="stat-info"><h4>${experience.length}</h4><p>Experience Records</p></div>
      </div>
      <div class="stat-card" onclick="document.querySelector('[data-section=documents]').click()">
        <div class="stat-icon documents"><span class="material-icons-round">folder_open</span></div>
        <div class="stat-info"><h4>${documents.length}</h4><p>Documents</p></div>
      </div>
    `;
    $('#stats-grid').innerHTML = statsHTML;

    // Show/hide welcome vs quick actions
    const hasData = profile || education.length || experience.length || documents.length;
    $('#dashboard-welcome').style.display = hasData ? 'none' : 'block';
    $('#dashboard-recent').style.display = hasData ? 'block' : 'block';
  }

  function calcProfileCompletion(p) {
    const fields = ['firstName', 'lastName', 'email', 'phone', 'dob', 'gender', 'address'];
    const filled = fields.filter((f) => p[f] && String(p[f]).trim()).length;
    return Math.round((filled / fields.length) * 100);
  }

  // ═══════════════════════════════════════════
  // PROFILE
  // ═══════════════════════════════════════════
  const profileForm = $('#profile-form');
  const profileFields = ['firstName', 'lastName', 'email', 'phone', 'dob', 'gender', 'address', 'linkedin', 'github'];

  function loadProfile() {
    const data = store.get(KEYS.profile) || {};
    let isModified = false;

    // Auto-fill from Google info
    if (window._cvUser) {
      if (data.email !== window._cvUser.email) {
        data.email = window._cvUser.email;
        isModified = true;
      }
      if (!data.firstName && !data.lastName) {
        const parts = (window._cvUser.name || '').split(' ');
        data.firstName = parts[0] || '';
        data.lastName = parts.slice(1).join(' ');
        isModified = true;
      }
    }

    if (isModified) store.set(KEYS.profile, data);

    profileFields.forEach((f) => {
      const el = $(`#profile-${f}`);
      if (el) {
        el.value = data[f] !== undefined ? data[f] : '';
      }
    });
  }

  profileForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = {};
    profileFields.forEach((f) => { data[f] = $(`#profile-${f}`).value; });
    store.set(KEYS.profile, data);
    showToast('Profile saved successfully!');
    renderDashboard();
    renderProfileProgress();
    renderQuickCopy();
    updateUserBadge();
  });

  // ═══════════════════════════════════════════
  // EDUCATION
  // ═══════════════════════════════════════════
  function getEducation() { return store.get(KEYS.education) || []; }
  function saveEducation(list) { store.set(KEYS.education, list); }

  function renderEducation() {
    const list = getEducation();
    const container = $('#education-list');
    const empty = $('#education-empty');

    if (typeof eduSelection !== 'undefined') eduSelection.updateHeader();

    if (!list.length) {
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    const hasMultiple = list.length > 1;
    container.innerHTML = list.map((item, i) => `
      <div class="record-card edu" ${hasMultiple ? 'style="display:flex;align-items:flex-start;gap:12px;"' : ''}>
        ${hasMultiple ? `<input type="checkbox" class="chk-item-education" value="${i}" style="margin-top:4px;accent-color:var(--clr-primary);width:16px;height:16px;cursor:pointer;flex-shrink:0" title="Select item" />` : ''}
        <div class="record-info" ${hasMultiple ? 'style="flex:1"' : ''}>
          <h4>${escHTML(item.degree)}</h4>
          <p>${escHTML(item.institution)}</p>
          <div class="record-meta">
            <span class="tag"><span class="material-icons-round">calendar_today</span>${escHTML(item.yearFrom || '')}${item.yearTo ? ' – ' + escHTML(item.yearTo) : ''}</span>
            ${item.grade ? `<span class="tag"><span class="material-icons-round">grade</span>${escHTML(item.grade)}</span>` : ''}
            ${item.field ? `<span class="tag"><span class="material-icons-round">category</span>${escHTML(item.field)}</span>` : ''}
          </div>
        </div>
        <div class="record-actions">
          <button class="btn btn-outline btn-sm" onclick="CV.editEducation(${i})"><span class="material-icons-round">edit</span></button>
          ${!hasMultiple ? `<button class="btn btn-danger-outline btn-sm" onclick="CV.deleteEducation(${i})"><span class="material-icons-round">delete</span></button>` : ''}
        </div>
      </div>
    `).join('');
    
    if (typeof eduSelection !== 'undefined') {
      eduSelection.bindCheckboxes();
    }
  }

  function openEducationModal(index) {
    const isEdit = index !== undefined;
    const item = isEdit ? getEducation()[index] : {};

    const html = `
      <form id="edu-form" class="form-grid">
        <div class="form-group full-width">
          <label for="edu-degree">Degree / Qualification *</label>
          <input type="text" id="edu-degree" value="${escAttr(item.degree)}" placeholder="B.Tech in Computer Science" required />
        </div>
        <div class="form-group full-width">
          <label for="edu-institution">Institution *</label>
          <input type="text" id="edu-institution" value="${escAttr(item.institution)}" placeholder="ABC University" required />
        </div>
        <div class="form-group">
          <label for="edu-field">Field of Study</label>
          <input type="text" id="edu-field" value="${escAttr(item.field)}" placeholder="Computer Science" />
        </div>
        <div class="form-group">
          <label for="edu-grade">Grade / CGPA / %</label>
          <input type="text" id="edu-grade" value="${escAttr(item.grade)}" placeholder="8.5 CGPA" />
        </div>
        <div class="form-group">
          <label for="edu-yearFrom">Start Year</label>
          <input type="text" id="edu-yearFrom" value="${escAttr(item.yearFrom)}" placeholder="2019" />
        </div>
        <div class="form-group">
          <label for="edu-yearTo">End Year</label>
          <input type="text" id="edu-yearTo" value="${escAttr(item.yearTo)}" placeholder="2023" />
        </div>
        <div class="form-actions full-width">
          <button type="button" class="btn btn-outline" onclick="CV.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary"><span class="material-icons-round">save</span> ${isEdit ? 'Update' : 'Add'}</button>
        </div>
      </form>
    `;

    openModal(isEdit ? 'Edit Education' : 'Add Education', html);

    $('#edu-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const record = {
        degree: $('#edu-degree').value.trim(),
        institution: $('#edu-institution').value.trim(),
        field: $('#edu-field').value.trim(),
        grade: $('#edu-grade').value.trim(),
        yearFrom: $('#edu-yearFrom').value.trim(),
        yearTo: $('#edu-yearTo').value.trim(),
      };
      const list = getEducation();
      if (isEdit) { list[index] = record; } else { list.push(record); }
      saveEducation(list);
      closeModal();
      renderEducation();
      renderDashboard();
      showToast(isEdit ? 'Education updated!' : 'Education added!');
    });
  }

  $('#btn-add-education').addEventListener('click', () => openEducationModal());
  
  const eduSelection = initListSelection('education', getEducation, saveEducation, () => { renderEducation(); renderDashboard(); });

  // ═══════════════════════════════════════════
  // EXPERIENCE
  // ═══════════════════════════════════════════
  function getExperience() { return store.get(KEYS.experience) || []; }
  function saveExperience(list) { store.set(KEYS.experience, list); }

  function renderExperience() {
    const list = getExperience();
    const container = $('#experience-list');
    const empty = $('#experience-empty');

    if (typeof expSelection !== 'undefined') expSelection.updateHeader();

    if (!list.length) {
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    const hasMultiple = list.length > 1;
    container.innerHTML = list.map((item, i) => `
      <div class="record-card exp" ${hasMultiple ? 'style="display:flex;align-items:flex-start;gap:12px;"' : ''}>
        ${hasMultiple ? `<input type="checkbox" class="chk-item-experience" value="${i}" style="margin-top:4px;accent-color:var(--clr-primary);width:16px;height:16px;cursor:pointer;flex-shrink:0" title="Select item" />` : ''}
        <div class="record-info" ${hasMultiple ? 'style="flex:1"' : ''}>
          <h4>${escHTML(item.role)}</h4>
          <p>${escHTML(item.company)}</p>
          <div class="record-meta">
            <span class="tag"><span class="material-icons-round">calendar_today</span>${escHTML(item.dateFrom || '')}${item.dateTo ? ' – ' + escHTML(item.dateTo) : ' – Present'}</span>
            ${item.salary ? `<span class="tag"><span class="material-icons-round">payments</span>${escHTML(item.salary)}</span>` : ''}
            ${item.location ? `<span class="tag"><span class="material-icons-round">location_on</span>${escHTML(item.location)}</span>` : ''}
          </div>
        </div>
        <div class="record-actions">
          <button class="btn btn-outline btn-sm" onclick="CV.editExperience(${i})"><span class="material-icons-round">edit</span></button>
          ${!hasMultiple ? `<button class="btn btn-danger-outline btn-sm" onclick="CV.deleteExperience(${i})"><span class="material-icons-round">delete</span></button>` : ''}
        </div>
      </div>
    `).join('');

    if (typeof expSelection !== 'undefined') {
      expSelection.bindCheckboxes();
    }
  }

  function openExperienceModal(index) {
    const isEdit = index !== undefined;
    const item = isEdit ? getExperience()[index] : {};

    const html = `
      <form id="exp-form" class="form-grid">
        <div class="form-group full-width">
          <label for="exp-role">Job Title / Role *</label>
          <input type="text" id="exp-role" value="${escAttr(item.role)}" placeholder="Software Engineer" required />
        </div>
        <div class="form-group full-width">
          <label for="exp-company">Company *</label>
          <input type="text" id="exp-company" value="${escAttr(item.company)}" placeholder="Google" required />
        </div>
        <div class="form-group">
          <label for="exp-location">Location</label>
          <input type="text" id="exp-location" value="${escAttr(item.location)}" placeholder="Bangalore, India" />
        </div>
        <div class="form-group">
          <label for="exp-salary">Salary / CTC</label>
          <input type="text" id="exp-salary" value="${escAttr(item.salary)}" placeholder="₹12,00,000 / year" />
        </div>
        <div class="form-group">
          <label for="exp-dateFrom">Start Date</label>
          <input type="text" id="exp-dateFrom" value="${escAttr(item.dateFrom)}" placeholder="Jan 2023" />
        </div>
        <div class="form-group">
          <label for="exp-dateTo">End Date</label>
          <input type="text" id="exp-dateTo" value="${escAttr(item.dateTo)}" placeholder="Present" />
        </div>
        <div class="form-group full-width">
          <label for="exp-description">Description</label>
          <textarea id="exp-description" rows="3" placeholder="Key responsibilities and achievements...">${escHTML(item.description || '')}</textarea>
        </div>
        <div class="form-actions full-width">
          <button type="button" class="btn btn-outline" onclick="CV.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary"><span class="material-icons-round">save</span> ${isEdit ? 'Update' : 'Add'}</button>
        </div>
      </form>
    `;

    openModal(isEdit ? 'Edit Experience' : 'Add Experience', html);

    $('#exp-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const record = {
        role: $('#exp-role').value.trim(),
        company: $('#exp-company').value.trim(),
        location: $('#exp-location').value.trim(),
        salary: $('#exp-salary').value.trim(),
        dateFrom: $('#exp-dateFrom').value.trim(),
        dateTo: $('#exp-dateTo').value.trim(),
        description: $('#exp-description').value.trim(),
      };
      const list = getExperience();
      if (isEdit) { list[index] = record; } else { list.push(record); }
      saveExperience(list);
      closeModal();
      renderExperience();
      renderDashboard();
      showToast(isEdit ? 'Experience updated!' : 'Experience added!');
    });
  }

  $('#btn-add-experience').addEventListener('click', () => openExperienceModal());

  const expSelection = initListSelection('experience', getExperience, saveExperience, () => { renderExperience(); renderDashboard(); });

  // ═══════════════════════════════════════════
  // DOCUMENTS
  // ═══════════════════════════════════════════
  function getDocuments() { return store.get(KEYS.documents) || []; }
  function saveDocuments(list) { store.set(KEYS.documents, list); }

  function renderDocuments() {
    const list = getDocuments();
    const container = $('#documents-list');
    const empty = $('#documents-empty');

    if (typeof docSelection !== 'undefined') docSelection.updateHeader();

    if (!list.length) {
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';

    const iconMap = {
      'application/pdf': 'picture_as_pdf',
      'image/png': 'image',
      'image/jpeg': 'image',
      'image/jpg': 'image',
      'image/gif': 'image',
      'image/webp': 'image',
    };

    const hasMultiple = list.length > 1;
    container.innerHTML = list.map((doc, i) => {
      const icon = iconMap[doc.type] || 'description';
      const sizeKB = doc.size ? (doc.size / 1024).toFixed(1) : '—';
      return `
        <div class="doc-card" ${hasMultiple ? 'style="padding-top:var(--sp-6)"' : ''}>
          ${hasMultiple ? `<input type="checkbox" class="chk-item-documents" value="${i}" style="position:absolute; top:12px; right:12px; accent-color:var(--clr-primary);width:16px;height:16px;cursor:pointer;z-index:2" title="Select item" />` : ''}
          <span class="material-icons-round doc-icon">${icon}</span>
          <h4>${escHTML(doc.label || doc.name)}</h4>
          <p class="doc-meta">${escHTML(doc.name)} · ${sizeKB} KB</p>
          <div class="doc-actions">
            <button class="btn btn-outline btn-sm" onclick="CV.viewDocument(${i})"><span class="material-icons-round">visibility</span> View</button>
            ${!hasMultiple ? `<button class="btn btn-danger-outline btn-sm" onclick="CV.deleteDocument(${i})"><span class="material-icons-round">delete</span></button>` : ''}
          </div>
        </div>
      `;
    }).join('');

    if (typeof docSelection !== 'undefined') {
      docSelection.bindCheckboxes();
    }
  }

  function openDocumentModal() {
    const html = `
      <form id="doc-form">
        <div class="form-group" style="margin-bottom: var(--sp-4);">
          <label for="doc-label">Document Label *</label>
          <input type="text" id="doc-label" placeholder="Resume, Aadhaar Card, Payslip..." required />
        </div>
        <div class="file-upload-area" id="file-upload-area">
          <span class="material-icons-round">cloud_upload</span>
          <p><strong>Click to upload</strong> or drag and drop</p>
          <p style="font-size:.75rem;margin-top:4px;">PDF, images, docs (max 5 MB)</p>
          <input type="file" id="doc-file" accept=".pdf,.png,.jpg,.jpeg,.gif,.webp,.doc,.docx" />
          <div class="file-name" id="file-name-display"></div>
        </div>
        <div class="form-actions">
          <button type="button" class="btn btn-outline" onclick="CV.closeModal()">Cancel</button>
          <button type="submit" class="btn btn-primary"><span class="material-icons-round">upload</span> Upload</button>
        </div>
      </form>
    `;

    openModal('Upload Document', html);

    const fileInput = $('#doc-file');
    const fileNameDisplay = $('#file-name-display');
    const uploadArea = $('#file-upload-area');

    fileInput.addEventListener('change', () => {
      if (fileInput.files.length) {
        fileNameDisplay.textContent = '✓ ' + fileInput.files[0].name;
      }
    });

    // Drag and drop
    uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.classList.add('drag-over'); });
    uploadArea.addEventListener('dragleave', () => uploadArea.classList.remove('drag-over'));
    uploadArea.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadArea.classList.remove('drag-over');
      if (e.dataTransfer.files.length) {
        fileInput.files = e.dataTransfer.files;
        fileNameDisplay.textContent = '✓ ' + e.dataTransfer.files[0].name;
      }
    });

    $('#doc-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const label = $('#doc-label').value.trim();
      const file = fileInput.files[0];
      if (!file) { showToast('Please select a file.', 'error'); return; }
      if (file.size > 5 * 1024 * 1024) { showToast('File exceeds 5 MB limit.', 'error'); return; }

      const reader = new FileReader();
      reader.onload = () => {
        const list = getDocuments();
        list.push({
          label,
          name: file.name,
          type: file.type,
          size: file.size,
          data: reader.result,
          uploaded: new Date().toISOString(),
        });
        try {
          saveDocuments(list);
        } catch (err) {
          showToast('Storage full! File too large for local storage.', 'error');
          return;
        }
        closeModal();
        renderDocuments();
        renderDashboard();
        showToast('Document uploaded!');
      };
      reader.readAsDataURL(file);
    });
  }

  function viewDocument(index) {
    const doc = getDocuments()[index];
    if (!doc || !doc.data) return;
    const win = window.open();
    if (doc.type === 'application/pdf' || doc.type.startsWith('image/')) {
      win.document.write(`
        <html><head><title>${doc.label || doc.name}</title></head>
        <body style="margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#1e293b;">
          ${doc.type.startsWith('image/')
          ? `<img src="${doc.data}" style="max-width:100%;max-height:100vh;" />`
          : `<iframe src="${doc.data}" style="width:100%;height:100vh;border:none;"></iframe>`
        }
        </body></html>
      `);
    } else {
      // Trigger download for other types
      const a = document.createElement('a');
      a.href = doc.data;
      a.download = doc.name;
      a.click();
    }
  }

  $('#btn-add-document').addEventListener('click', () => openDocumentModal());

  const docSelection = initListSelection('documents', getDocuments, saveDocuments, () => { renderDocuments(); renderDashboard(); });

  // ═══════════════════════════════════════════
  // FEATURE: PROFILE PHOTO
  // ═══════════════════════════════════════════
  function loadProfilePhoto() {
    const photo = store.get(KEYS.photo);
    const preview = $('#photo-preview');
    const removeBtn = $('#btn-remove-photo');
    if (!preview) return;

    if (photo) {
      preview.innerHTML = `<img src="${photo}" alt="Profile photo" />`;
      if (removeBtn) removeBtn.style.display = 'inline-flex';
    } else if (window._cvUser && window._cvUser.picture) {
      preview.innerHTML = `<img src="${window._cvUser.picture}" alt="Profile photo" referrerpolicy="no-referrer" />`;
      if (removeBtn) removeBtn.style.display = 'none';
    } else {
      preview.innerHTML = '<span class="material-icons-round">person</span>';
      if (removeBtn) removeBtn.style.display = 'none';
    }
  }

  function updateAvatarWithPhoto() {
    updateUserBadge(); // updateUserBadge now correctly handles the photo/Google/initials fallback
  }

  const photoInput = $('#profile-photo-input');
  if (photoInput) {
    photoInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 2 * 1024 * 1024) { showToast('Photo must be under 2MB.', 'error'); return; }
      const reader = new FileReader();
      reader.onload = (ev) => {
        store.set(KEYS.photo, ev.target.result);
        loadProfilePhoto();
        updateAvatarWithPhoto();
        showToast('Profile photo updated!', 'success');
      };
      reader.readAsDataURL(file);
    });
  }

  const removePhotoBtn = $('#btn-remove-photo');
  if (removePhotoBtn) {
    removePhotoBtn.addEventListener('click', () => {
      store.remove(KEYS.photo);
      loadProfilePhoto();
      updateUserBadge(); // restore initials
      showToast('Photo removed.', 'info');
    });
  }

  // ═══════════════════════════════════════════
  // FEATURE: PROFILE PROGRESS BAR + QUICK COPY
  // ═══════════════════════════════════════════
  const PROFILE_FIELDS_LABELS = [
    { field: 'firstName', label: 'First Name' },
    { field: 'lastName', label: 'Last Name' },
    { field: 'email', label: 'Email' },
    { field: 'phone', label: 'Phone' },
    { field: 'dob', label: 'Date of Birth' },
    { field: 'gender', label: 'Gender' },
    { field: 'address', label: 'Address' },
    { field: 'linkedin', label: 'LinkedIn' },
    { field: 'github', label: 'GitHub' },
  ];

  function renderProfileProgress() {
    const profile = store.get(KEYS.profile) || {};
    const filled = PROFILE_FIELDS_LABELS.filter(f => profile[f.field] && String(profile[f.field]).trim());
    const pct = Math.round((filled.length / PROFILE_FIELDS_LABELS.length) * 100);
    const missing = PROFILE_FIELDS_LABELS.filter(f => !profile[f.field] || !String(profile[f.field]).trim()).map(f => f.label);

    const card = $('#profile-progress-card');
    const fill = $('#progress-bar-fill');
    const pctEl = $('#progress-pct-label');
    const missEl = $('#progress-missing');
    if (!card) return;

    card.style.display = 'block';
    pctEl.textContent = pct + '%';
    fill.style.width = pct + '%';
    // colour the bar by strength
    fill.style.background = pct < 40
      ? 'linear-gradient(90deg, var(--clr-danger), #f97316)'
      : pct < 75
        ? 'linear-gradient(90deg, var(--clr-warning), var(--clr-primary-lt))'
        : 'linear-gradient(90deg, var(--clr-primary), var(--clr-success))';

    missEl.textContent = missing.length
      ? `Still missing: ${missing.slice(0, 4).join(', ')}${missing.length > 4 ? ` +${missing.length - 4} more` : ''}`
      : '✅ Profile is 100% complete!';
  }

  const COPY_FIELDS = ['email', 'phone', 'linkedin', 'github'];
  const COPY_LABELS = { email: 'Email', phone: 'Phone', linkedin: 'LinkedIn', github: 'GitHub' };

  function renderQuickCopy() {
    const profile = store.get(KEYS.profile) || {};
    const grid = $('#copy-grid');
    const card = $('#profile-quickcopy');
    if (!grid || !card) return;

    const items = COPY_FIELDS.filter(f => profile[f] && String(profile[f]).trim());
    if (!items.length) { card.style.display = 'none'; return; }
    card.style.display = 'block';

    grid.innerHTML = items.map(f => `
      <div class="copy-item">
        <div class="copy-item-info">
          <span class="copy-item-label">${COPY_LABELS[f]}</span>
          <span class="copy-item-value" title="${escAttr(profile[f])}">${escHTML(profile[f])}</span>
        </div>
        <button class="copy-btn" id="copy-btn-${f}" title="Copy ${COPY_LABELS[f]}" onclick="CV.copyField('${f}', '${escAttr(profile[f])}')"><span class="material-icons-round">content_copy</span></button>
      </div>
    `).join('');
  }

  function copyField(field, value) {
    navigator.clipboard.writeText(value).then(() => {
      const btn = $(`#copy-btn-${field}`);
      if (btn) {
        btn.classList.add('copied');
        btn.innerHTML = '<span class="material-icons-round">check</span>';
        setTimeout(() => {
          btn.classList.remove('copied');
          btn.innerHTML = '<span class="material-icons-round">content_copy</span>';
        }, 1800);
      }
      showToast(`${COPY_LABELS[field] || 'Value'} copied!`, 'success');
    }).catch(() => showToast('Copy failed – please copy manually.', 'error'));
  }

  // ═══════════════════════════════════════════
  // FEATURE: SKILLS CRUD
  // ═══════════════════════════════════════════
  function getSkills() { return store.get(KEYS.skills) || []; }
  function saveSkills(d) { store.set(KEYS.skills, d); }

  function renderSkills() {
    const skills = getSkills();
    const board = $('#skills-board');
    if (!board) return;

    if (typeof skillSelection !== 'undefined') skillSelection.updateHeader();

    board.innerHTML = '';
    if (!skills.length) { board.style.display = 'none'; return; }
    board.style.display = 'flex';

    const hasMultiple = skills.length > 1;
    const levels = ['Expert', 'Intermediate', 'Beginner'];
    levels.forEach(level => {
      const group = skills.filter(s => s.level === level);
      if (!group.length) return;
      const div = document.createElement('div');
      div.className = 'skill-group';
      const levelColors = { Expert: '🟢', Intermediate: '🔵', Beginner: '⚪' };
      div.innerHTML = `<h4><span class="skill-group-label ${level}">${levelColors[level]} ${level}</span></h4>
        <div class="skill-group-chips">
          ${group.map((s, gi) => {
        const realIdx = skills.findIndex(sk => sk.name === s.name && sk.level === s.level);
        return `<span class="skill-chip ${level}">
          ${hasMultiple ? `<input type="checkbox" class="chk-item-skills" value="${realIdx}" style="accent-color:var(--clr-primary);cursor:pointer;margin-right:6px;vertical-align:middle;margin-top:-2px;width:14px;height:14px;" />` : ''}
          ${escHTML(s.name)}
          ${!hasMultiple ? `<button class="skill-chip-del" onclick="CV.deleteSkill(${realIdx})" title="Remove">✕</button>` : ''}
        </span>`;
      }).join('')}
        </div>`;
      board.appendChild(div);
    });

    if (typeof skillSelection !== 'undefined') {
      skillSelection.bindCheckboxes();
    }
  }

  function addSkill() {
    const nameInput = $('#skill-name-input');
    const levelInput = $('#skill-level-input');
    const name = nameInput.value.trim();
    const level = levelInput.value;
    if (!name) { showToast('Enter a skill name.', 'error'); nameInput.focus(); return; }
    const skills = getSkills();
    if (skills.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      showToast('Skill already exists.', 'error'); return;
    }
    skills.push({ name, level });
    saveSkills(skills);
    renderSkills();
    nameInput.value = '';
    nameInput.focus();
    showToast(`"${name}" added!`, 'success');
  }

  $('#btn-add-skill').addEventListener('click', addSkill);

  const skillSelection = initListSelection('skills', getSkills, saveSkills, () => { renderSkills(); renderDashboard(); });
  $('#skill-name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } });

  // ═══════════════════════════════════════════
  // ═══════════════════════════════════════════
  // FEATURE: IMPORT (Resume + JSON backup)
  // ═══════════════════════════════════════════

  // ─── Parse plain text resume into vault sections ───
  function parseResumeText(text) {
    const rawLines = text.split(/\r?\n/).map(l => l.trim());
    const lines = rawLines.filter(Boolean);
    const fullText = text;

    const profile = {};
    const skills = [];
    const education = [];
    const experience = [];
    const projects = [];

    /* ─── Contact info ─── */
    const emailMatch = fullText.match(/[\w.+-]+@[\w-]+\.[\w.]+/);
    if (emailMatch) profile.email = emailMatch[0];

    const phoneMatch = fullText.match(/(?:\+91[\s-]?)?[6-9]\d{9}|(?:\+?[\d][\s-]?){10,13}/);
    if (phoneMatch) profile.phone = phoneMatch[0].replace(/\s/g, '').slice(0, 15);

    const linkedInMatch = fullText.match(/linkedin\.com\/in\/[\w%-]+/i);
    if (linkedInMatch) profile.linkedin = 'https://' + linkedInMatch[0];

    const githubMatch = fullText.match(/github\.com\/[\w-]+/i);
    if (githubMatch) profile.github = 'https://' + githubMatch[0];

    const portfolioMatch = fullText.match(/(?:portfolio|website)[:\s]+([https?://]?[\w.-]+\.[\w]{2,}\/[\S]*)/i);
    if (portfolioMatch) profile.website = portfolioMatch[1];

    /* ─── Name: first Title Case line, 2–5 words, no digits, no @/:// ─── */
    const nameLine = lines.find(l =>
      /^[A-Z][a-zA-Z]+(?: [A-Z]?[a-zA-Z]+){1,4}$/.test(l) &&
      !l.includes('@') && !l.includes('://') && l.split(' ').length <= 5
    );
    if (nameLine) {
      const parts = nameLine.trim().split(/\s+/);
      profile.firstName = parts[0];
      profile.lastName = parts.slice(1).join(' ');
    }

    /* ─── Section detection ─── */
    const SECTION_RE = {
      summary: /^[^a-z]*((professional\s+)?summary|objective|profile|about\s*(me)?)[^a-z]*$/i,
      skills: /^[^a-z]*((technical\s+|key\s+|core\s+)?skills?|competencies)[^a-z]*$/i,
      experience: /^[^a-z]*((work\s+|professional\s+)?experience|employment(\s+history)?|work\s+history)[^a-z]*$/i,
      education: /^[^a-z]*(education(\s+&\s+training)?|academic(s)?|academics\s+background)[^a-z]*$/i,
      projects: /^[^a-z]*((key\s+|personal\s+|academic\s+)?projects?)[^a-z]*$/i,
      certifications: /^[^a-z]*(certifications?|courses?|awards?|honors?)[^a-z]*$/i,
    };

    let currentSection = null;
    const blocks = { summary: [], skills: [], experience: [], education: [], projects: [], certifications: [] };

    lines.forEach(line => {
      const sectionKey = Object.keys(SECTION_RE).find(k => SECTION_RE[k].test(line));
      if (sectionKey) { currentSection = sectionKey; return; }
      if (currentSection) blocks[currentSection].push(line);
    });

    /* ─── Summary ─── */
    if (blocks.summary.length) {
      profile.summary = blocks.summary.join(' ').replace(/\s+/g, ' ').trim();
    }

    /* ─── Skills ─── */
    const skillLines = blocks.skills;
    skillLines.forEach(line => {
      // Each line may be comma / bullet / pipe / tab separated
      const items = line
        .split(/[,|•·\t]+/)
        .map(s => s.replace(/^[\s\-–•*►▪]+/, '').trim())
        .filter(s => s.length > 1 && s.length < 60 && !/^(and|or|the|in|with|using)$/i.test(s));
      items.forEach(s => {
        if (!skills.find(x => x.name.toLowerCase() === s.toLowerCase())) {
          skills.push({ name: s, level: 'Intermediate' });
        }
      });
    });

    /* ─── Experience ─── */
    const expLines = blocks.experience;
    if (expLines.length) {
      const months = 'Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|August|September|October|November|December';
      const dateBoundRe = new RegExp(`\\b(?:${months})\\s*\\d{4}\\b|\\b(?:0?[1-9]|1[0-2])\\/(?:19|20)\\d{2}\\b|\\b\\d{4}\\s*[-–to]+[\\s\\w]*\\b(?:\\d{4}|present|current|now)\\b`, 'i');
      let cur = null;
      expLines.forEach(line => {
        if (dateBoundRe.test(line)) {
          if (cur) experience.push(cur);
          const dates = line.match(new RegExp(`(?:(?:${months})\\s*\\d{4})|(?:(?:0?[1-9]|1[0-2])\\/(?:19|20)\\d{2})|\\d{4}`, 'gi')) || [];
          cur = {
            role: '',
            company: '',
            dateFrom: dates[0] || '',
            dateTo: /present|current|now/i.test(line) ? '' : (dates[1] || ''),
            description: '',
            _rawLines: [line],
          };
        } else if (cur) {
          cur._rawLines.push(line);
        } else {
          if (!cur) cur = { role: '', company: '', dateFrom: '', dateTo: '', description: '', _rawLines: [line] };
          else cur._rawLines.push(line);
        }
      });
      if (cur) experience.push(cur);

      experience.forEach(e => {
        const lines = e._rawLines;
        const dateIdx = lines.findIndex(l => dateBoundRe.test(l));
        
        let headerLines = [];
        let descLines = [];
        
        if (dateIdx === -1) {
            headerLines = lines.slice(0, 2);
            descLines = lines.slice(2);
        } else {
            headerLines = lines.slice(0, dateIdx + 1);
            descLines = lines.slice(dateIdx + 1);
        }
        
        let headStr = headerLines.join(' | ');
        headStr = headStr.replace(dateBoundRe, '').replace(new RegExp(`(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|January|February|March|April|August|September|October|November|December)\\s*\\d{4})|(?:(?:0?[1-9]|1[0-2])\\/(?:19|20)\\d{2})|\\d{4}`, 'gi'), '').replace(/\b(?:present|current|now)\b/i, '').trim();
        
        let parts = headStr.split(/\||•|·|\t|\-(?=\s)|\–(?=\s)/).map(p => p.trim()).filter(p => p.length > 2);
        
        if (parts.length >= 2) {
            e.role = parts[0];
            e.company = parts[1];
        } else if (parts.length === 1) {
            const byAt = parts[0].split(/\b(?:at|@)\b/i);
            if (byAt.length > 1) {
                e.role = byAt[0].trim();
                e.company = byAt[1].trim();
            } else {
                e.role = parts[0];
                e.company = '';
            }
        }
        
        e.description = descLines.join('\n').replace(/^[\s\-–•*►▪]+/, '').trim();
        delete e._rawLines;
      });
    }

    /* ─── Education ─── */
    const eduLines = blocks.education;
    if (eduLines.length) {
      const degreeRe = /\b(b\.?tech|m\.?tech|b\.?e\.?|b\.?sc|m\.?sc|mba|bca|mca|bachelor|master|phd|ph\.d|diploma|10th|12th|hsc|ssc|sslc)\b/gi;
      const yearRe = /\b(19|20)\d{2}\b/g;
      
      let curEdu = null;
      eduLines.forEach(line => {
        degreeRe.lastIndex = 0;
        if (degreeRe.test(line)) {
          if (curEdu) education.push(curEdu);
          curEdu = { text: line };
        } else if (curEdu) {
          curEdu.text += ' | ' + line;
        } else {
          curEdu = { text: line };
        }
      });
      if (curEdu) education.push(curEdu);

      education.forEach(e => {
        let t = e.text;
        
        const yrs = t.match(yearRe) || [];
        e.yearFrom = yrs.length > 1 ? yrs[0] : '';
        e.yearTo = yrs.length > 1 ? yrs[1] : (yrs[0] || '');
        t = t.replace(yearRe, '');

        const gradeRe = /(cgpa|gpa|score|%)?[^\w]*(?:[1-9]\d(?:\.\d+)?%|[1-9](?:\.\d{1,2})\s*(?:\/\s*10)?|first class|distinction|honors)/i;
        const gradeMatch = t.match(gradeRe);
        e.grade = gradeMatch ? gradeMatch[0].replace(/^[^a-z0-9]+/i, '').trim().slice(0, 20) : '';
        if (gradeMatch) t = t.replace(gradeMatch[0], '');

        degreeRe.lastIndex = 0;
        const dMatch = t.match(degreeRe);
        e.degree = dMatch ? dMatch[0].toUpperCase() : '';
        if (dMatch) t = t.replace(dMatch[0], '');

        e.institution = t.replace(/[|\-,]/g, ' ').replace(/\s+/g, ' ').trim();
        delete e.text;
      });
    }

    /* ─── Projects ─── */
    const projLines = blocks.projects;
    if (projLines.length) {
      const techRe = /\b(react|vue|angular|node|express|django|flask|spring|mongodb|mysql|postgresql|firebase|aws|gcp|azure|docker|kubernetes|redis|python|java|typescript|javascript|html|css|sass|flutter|android|ios|tensorflow|pytorch|graphql|rest)\b/i;
      const urlRe = /https?:\/\/[\S]+/g;
      let curProj = null;

      projLines.forEach(line => {
        // A project title is usually a short non-bullet line with title case or all-caps, not a description
        const isTitleLike = line.length < 80 && /^[A-Z]/.test(line) &&
          !techRe.test(line) && !urlRe.test(line) &&
          !/^[\-•*►▪]/.test(line);

        if (isTitleLike && (!curProj || projLines.indexOf(line) > 0)) {
          if (curProj) projects.push(curProj);
          curProj = { title: line, description: '', techStack: [], liveUrl: '', repoUrl: '', role: '' };
        } else if (curProj) {
          // Extract URLs
          (line.match(urlRe) || []).forEach(url => {
            if (/github\.com/i.test(url)) curProj.repoUrl = url;
            else if (!curProj.liveUrl) curProj.liveUrl = url;
          });
          // Extract tech stack
          (line.match(new RegExp(techRe.source, 'gi')) || []).forEach(t => {
            if (!curProj.techStack.includes(t)) curProj.techStack.push(t);
          });
          // Description
          const cleaned = line.replace(/^[\s\-–•*►▪]+/, '').trim();
          if (cleaned && !curProj.liveUrl.includes(cleaned)) {
            curProj.description += (curProj.description ? ' ' : '') + cleaned;
          }
        }
      });
      if (curProj) projects.push(curProj);
    }

    return { profile, skills, education, experience, projects };
  }

  function applyParsedResume(parsed) {
    // Merge profile — only fill blank fields
    const existing = store.get(KEYS.profile) || {};
    const merged = { ...existing };
    Object.entries(parsed.profile).forEach(([k, v]) => { if (v && !merged[k]) merged[k] = v; });
    store.set(KEYS.profile, merged);

    // Skills — deduplicated merge
    if (parsed.skills.length) {
      const exSkills = store.get(KEYS.skills) || [];
      const existing = new Set(exSkills.map(s => s.name.toLowerCase()));
      parsed.skills.forEach(s => {
        if (!existing.has(s.name.toLowerCase())) exSkills.push(s);
      });
      store.set(KEYS.skills, exSkills);
    }

    // Education — append & sort (newest first)
    if (parsed.education.length) {
      const exEdu = store.get(KEYS.education) || [];
      const combined = [...exEdu, ...parsed.education];
      combined.sort((a, b) => {
        const aYear = parseInt((String(a.yearTo || a.yearFrom).match(/\d{4}/) || [0])[0]);
        const bYear = parseInt((String(b.yearTo || b.yearFrom).match(/\d{4}/) || [0])[0]);
        return bYear - aYear;
      });
      store.set(KEYS.education, combined);
    }

    // Experience — append & sort (Current first, then newest first)
    if (parsed.experience.length) {
      const exExp = store.get(KEYS.experience) || [];
      const mapped = parsed.experience.map(e => ({
        role: e.role || e.jobTitle || '',
        company: e.company || '',
        dateFrom: e.dateFrom || e.startDate || '',
        dateTo: e.dateTo || e.endDate || '',
        description: e.description || '',
        location: e.location || '',
        salary: '',
      }));
      
      const combined = [...exExp, ...mapped];
      
      // Sort logic
      combined.sort((a, b) => {
        const aIsCur = /present|current|now/i.test(a.dateTo) || (!a.dateTo && a.dateFrom);
        const bIsCur = /present|current|now/i.test(b.dateTo) || (!b.dateTo && b.dateFrom);
        if (aIsCur && !bIsCur) return -1;
        if (!aIsCur && bIsCur) return 1;
        
        // Extract years if present
        const aYear = (a.dateFrom.match(/\d{4}/) || [0])[0];
        const bYear = (b.dateFrom.match(/\d{4}/) || [0])[0];
        return parseInt(bYear) - parseInt(aYear); // Descending
      });
      
      store.set(KEYS.experience, combined);
    }

    // Projects — append & sort (newest first)
    if (parsed.projects && parsed.projects.length) {
      const exProj = store.get('cv_projects') || [];
      const mapped = parsed.projects.map(p => ({
        title: p.title || '',
        description: p.description || '',
        techStack: p.techStack || [],
        liveUrl: p.liveUrl || '',
        repoUrl: p.repoUrl || '',
        role: p.role || '',
        startDate: '',
        endDate: '',
        current: false,
      }));
      const combined = [...exProj, ...mapped];
      store.set('cv_projects', combined);
    }

    // Re-render everything
    loadProfile();
    renderDashboard();
    renderEducation();
    renderExperience();
    renderSkills();
    renderProfileProgress();
    renderQuickCopy();
    updateUserBadge();
    if (typeof renderProjects === 'function') renderProjects();

    const counts = [
      parsed.skills.length ? `${parsed.skills.length} skills` : '',
      parsed.education.length ? `${parsed.education.length} education` : '',
      parsed.experience.length ? `${parsed.experience.length} experience` : '',
      parsed.projects?.length ? `${parsed.projects.length} projects` : '',
    ].filter(Boolean).join(', ');

    showToast(`Resume imported! Parsed: ${counts || 'contact info & summary'} ✓`, 'success');
  }

  function importData(file) {
    if (!file) return;
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();

    if (ext === 'json') {
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target.result);
          // Check if it's a CareerVault backup (has cv_ keys)
          const isVaultBackup = Object.keys(data).some(k => k.startsWith('cv_'));
          if (isVaultBackup) {
            Object.entries(data).forEach(([key, value]) => {
              localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
            });
            loadProfile(); renderDashboard(); renderEducation(); renderExperience();
            renderDocuments(); renderSkills(); renderProfileProgress();
            renderQuickCopy(); loadProfilePhoto(); updateUserBadge(); updateAvatarWithPhoto();
            if (data['cv_theme']) applyTheme(data['cv_theme']);
            showToast('Vault backup restored successfully! 🎉', 'success');
          } else {
            showToast('Not a CareerVault backup file.', 'error');
          }
        } catch { showToast('Invalid JSON file.', 'error'); }
      };
      reader.readAsText(file);
    } else if (ext === 'txt') {
      reader.onload = (e) => {
        const parsed = parseResumeText(e.target.result);
        applyParsedResume(parsed);
      };
      reader.readAsText(file);
    } else if (ext === 'docx') {
      // Use mammoth.js (loaded via CDN) for proper Word text extraction
      if (typeof mammoth === 'undefined') {
        showToast('Word parser not loaded — try refreshing or use .txt instead.', 'error');
        return;
      }
      reader.onload = async (e) => {
        try {
          showToast('Reading Word file…', 'info');
          const result = await mammoth.extractRawText({ arrayBuffer: e.target.result });
          if (result.value && result.value.length > 20) {
            // Store file in Documents
            storeFileInDocuments(file, e.target.result, 'word');
            // Parse text into vault sections
            const parsed = parseResumeText(result.value);
            applyParsedResume(parsed);
          } else {
            showToast('Could not extract text from Word file.', 'error');
          }
        } catch (err) {
          showToast('Error reading Word file. Try saving as .txt first.', 'error');
        }
      };
      reader.readAsArrayBuffer(file);
    } else if (ext === 'pdf') {
      // Read PDF: store in Documents AND extract text for section filling
      reader.onload = async (e) => {
        showToast('Reading PDF…', 'info');
        // Step 1: always store in Documents
        storeFileInDocuments(file, e.target.result, 'pdf');

        // Step 2: try text extraction via PDF.js
        // Use disableWorker:true to avoid CORS issues in file:// context
        if (typeof pdfjsLib === 'undefined') {
          showToast('PDF stored in Documents! (PDF.js not loaded — install from online to also parse sections.)', 'success');
          return;
        }
        try {
          pdfjsLib.GlobalWorkerOptions.workerSrc = '';
          const loadingTask = pdfjsLib.getDocument({
            data: new Uint8Array(e.target.result),
            useWorkerFetch: false,
            isEvalSupported: false,
          });
          const pdf = await loadingTask.promise;
          let fullText = '';
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            
            let lastY = -1;
            let pageText = '';
            content.items.forEach(item => {
              if (lastY !== -1 && Math.abs(lastY - item.transform[5]) > 5) {
                pageText += '\n'; // Add newline if Y coordinate changes significantly
              } else if (lastY !== -1) {
                pageText += ' '; // Slight X spacing
              }
              pageText += item.str.trim();
              lastY = item.transform[5];
            });
            fullText += pageText + '\n\n';
          }
          if (fullText.trim().length > 30) {
            const parsed = parseResumeText(fullText);
            applyParsedResume(parsed); // shows its own toast with counts
          } else {
            showToast('PDF added to Documents. (Could not extract text — may be a scanned/image PDF.)', 'success');
          }
        } catch (err) {
          showToast('PDF added to Documents! Text parsing failed — try a text-based PDF.', 'success');
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      showToast('Unsupported file type. Use .pdf, .docx, .txt, or .json', 'error');
    }
  }

  // ─── Helper: store a file blob in the Documents section ───
  function storeFileInDocuments(file, arrayBuffer, type) {
    try {
      const base64 = arrayBufferToBase64(arrayBuffer);
      const mimeType = type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      const list = getDocuments();
      // Avoid duplicate filenames — remove old entry with same name
      const idx = list.findIndex(d => d.name === file.name);
      if (idx >= 0) list.splice(idx, 1);
      list.unshift({
        label: file.name.replace(/\.(pdf|docx)$/i, ''),
        name: file.name,
        type: mimeType,
        size: file.size,
        data: `data:${mimeType};base64,${base64}`,
        uploaded: new Date().toISOString(),
      });
      saveDocuments(list);
      renderDocuments();
      renderDashboard();
    } catch (err) {
      // localStorage may be full — skip silently (text parsing still happens)
    }
  }

  // ─── Helper: ArrayBuffer → base64 string ───
  function arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    const chunkSize = 8192;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }

  const importFileInput = $('#import-file-input');
  if (importFileInput) {
    importFileInput.addEventListener('change', (e) => {
      importData(e.target.files[0]);
      e.target.value = '';
    });
  }


  // ═══════════════════════════════════════════
  // FEATURE: PAST PROJECTS CRUD
  // ═══════════════════════════════════════════
  function getProjects() { return store.get('cv_projects') || []; }
  function saveProjects(d) { store.set('cv_projects', d); }

  function renderProjects() {
    const projects = getProjects();
    const list = $('#projects-list');
    const empty = $('#projects-empty');
    if (!list) return;
    if (!projects.length) {
      list.innerHTML = '';
      if (empty) empty.style.display = 'flex';
      return;
    }
    if (empty) empty.style.display = 'none';

    const hasMultiple = projects.length > 1;
    list.innerHTML = projects.map((p, i) => {
      const tech = (p.techStack || []).map(t => `<span class="tech-chip">${escHTML(t)}</span>`).join('');
      const dur = p.startDate ? `${p.startDate}${p.current ? ' – Present' : p.endDate ? ' – ' + p.endDate : ''}` : '';
      const liveLink = p.liveUrl ? `<a href="${escAttr(p.liveUrl)}" target="_blank" class="project-link"><span class="material-icons-round">open_in_new</span> Live Demo</a>` : '';
      const repoLink = p.repoUrl ? `<a href="${escAttr(p.repoUrl)}" target="_blank" class="project-link"><span class="material-icons-round">code</span> Repository</a>` : '';
      return `
      <div class="project-card" ${hasMultiple ? 'style="display:flex;align-items:flex-start;gap:12px;"' : ''}>
        ${hasMultiple ? `<input type="checkbox" class="chk-item-projects" value="${i}" style="margin-top:6px;accent-color:var(--clr-primary);width:16px;height:16px;cursor:pointer;flex-shrink:0" title="Select item" />` : ''}
        <div ${hasMultiple ? 'style="flex:1"' : ''}>
          <div class="project-card-header">
            <div>
            <div class="project-card-title">${escHTML(p.title)}</div>
            ${p.role ? `<div class="project-card-role">${escHTML(p.role)}</div>` : ''}
            ${dur ? `<div class="project-card-duration">${escHTML(dur)}</div>` : ''}
          </div>
          <div class="project-card-actions">
            <button class="btn btn-sm btn-outline" onclick="CV.editProject(${i})">
              <span class="material-icons-round">edit</span>
            </button>
            ${!hasMultiple ? `<button class="btn btn-sm btn-outline" onclick="CV.deleteProject(${i})" style="color:var(--clr-danger);border-color:var(--clr-danger)"><span class="material-icons-round">delete</span></button>` : ''}
          </div>
        </div>
        ${p.description ? `<div class="project-card-desc">${escHTML(p.description)}</div>` : ''}
        ${tech ? `<div class="project-card-tech">${tech}</div>` : ''}
        ${(liveLink || repoLink) ? `<div class="project-card-links">${liveLink}${repoLink}</div>` : ''}
        </div>
      </div>`;
    }).join('');

    if (typeof projSelection !== 'undefined') {
      projSelection.updateHeader();
      projSelection.bindCheckboxes();
    }
  }

  function openProjectModal(editIndex = null) {
    const projects = getProjects();
    const p = editIndex !== null ? projects[editIndex] : {};
    const techVal = (p.techStack || []).join(', ');
    openModal(editIndex !== null ? 'Edit Project' : 'Add Project', `
      <div class="form-grid">
        <div class="form-group full-width">
          <label>Project Title *</label>
          <input id="m-ptitle" value="${escAttr(p.title || '')}" placeholder="My Awesome App" required />
        </div>
        <div class="form-group">
          <label>Your Role</label>
          <input id="m-prole" value="${escAttr(p.role || '')}" placeholder="Lead Developer" />
        </div>
        <div class="form-group">
          <label>Tech Stack <small>(comma separated)</small></label>
          <input id="m-ptech" value="${escAttr(techVal)}" placeholder="React, Node.js, MongoDB" />
        </div>
        <div class="form-group full-width">
          <label>Description</label>
          <textarea id="m-pdesc" rows="3" placeholder="What problem does this solve?">${escHTML(p.description || '')}</textarea>
        </div>
        <div class="form-group">
          <label>Start Date <small>(e.g. Jan 2024)</small></label>
          <input id="m-pstart" value="${escAttr(p.startDate || '')}" placeholder="Jan 2024" />
        </div>
        <div class="form-group">
          <label>End Date</label>
          <input id="m-pend" value="${escAttr(p.endDate || '')}" placeholder="Mar 2024" ${p.current ? 'disabled' : ''} />
        </div>
        <div class="form-group full-width">
          <label class="toggle-item" style="margin-bottom:var(--sp-2)">
            <input type="checkbox" id="m-pcurrent" ${p.current ? 'checked' : ''} onchange="document.getElementById('m-pend').disabled=this.checked" />
            <span>Currently ongoing</span>
          </label>
        </div>
        <div class="form-group">
          <label>Live URL</label>
          <input id="m-plive" value="${escAttr(p.liveUrl || '')}" placeholder="https://myapp.com" type="url" />
        </div>
        <div class="form-group">
          <label>Repository URL</label>
          <input id="m-prepo" value="${escAttr(p.repoUrl || '')}" placeholder="https://github.com/..." type="url" />
        </div>
      </div>
      <div class="form-actions">
        <button class="btn btn-primary" onclick="CV.saveProject(${editIndex})">
          <span class="material-icons-round">save</span> ${editIndex !== null ? 'Update' : 'Add'} Project
        </button>
      </div>
    `);
  }

  function saveProject(editIndex) {
    const title = $('#m-ptitle').value.trim();
    if (!title) { showToast('Project title is required.', 'error'); return; }
    const tech = $('#m-ptech').value.split(',').map(t => t.trim()).filter(Boolean);
    const entry = {
      title,
      role: $('#m-prole').value.trim(),
      description: $('#m-pdesc').value.trim(),
      techStack: tech,
      startDate: $('#m-pstart').value.trim(),
      endDate: $('#m-pend').value.trim(),
      current: $('#m-pcurrent').checked,
      liveUrl: $('#m-plive').value.trim(),
      repoUrl: $('#m-prepo').value.trim(),
    };
    const projects = getProjects();
    if (editIndex !== null && editIndex !== undefined) projects[editIndex] = entry;
    else projects.push(entry);
    saveProjects(projects);
    closeModal();
    renderProjects();
    showToast(editIndex !== null ? 'Project updated!' : 'Project added!', 'success');
  }

  $('#btn-add-project').addEventListener('click', () => openProjectModal());

  const projSelection = initListSelection('projects', getProjects, saveProjects, () => { renderProjects(); renderDashboard(); });

  // ═══════════════════════════════════════════
  // FEATURE: RESUME BUILDER
  // ═══════════════════════════════════════════
  let resumeState = {
    theme: 'classic',
    fontSize: 'standard',
    sections: { summary: true, skills: true, experience: true, education: true, projects: true },
    showPhoto: true,
    showLinks: true,
  };

  function getResumeOptions() {
    return { ...resumeState };
  }

  function renderResumePreview(tailoringData) {
    const sheet = $('#resume-sheet');
    if (!sheet) return;
    const opts = getResumeOptions();
    const profile = store.get(KEYS.profile) || {};
    const skills = tailoringData ? tailoringData.skills : (store.get(KEYS.skills) || []);
    const edu = store.get(KEYS.education) || [];
    const exp = store.get(KEYS.experience) || [];
    const proj = store.get('cv_projects') || [];
    const photo = store.get(KEYS.photo);
    const tailored = !!tailoringData;

    // Apply theme + font-size class
    sheet.className = `resume-sheet theme-${opts.theme} fs-${opts.fontSize}`;

    const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Your Name';
    const contactItems = [];
    if (profile.email) contactItems.push(`<span>✉ ${escHTML(profile.email)}</span>`);
    if (profile.phone) contactItems.push(`<span>📞 ${escHTML(profile.phone)}</span>`);
    if (profile.address) contactItems.push(`<span>📍 ${escHTML(profile.address)}</span>`);
    if (opts.showLinks) {
      if (profile.linkedin) contactItems.push(`<a href="${escAttr(profile.linkedin)}" target="_blank">🔗 LinkedIn</a>`);
      if (profile.github) contactItems.push(`<a href="${escAttr(profile.github)}"   target="_blank">💻 GitHub</a>`);
    }

    // Photo HTML
    let photoHTML = '';
    if (opts.showPhoto) {
      if (photo) photoHTML = `<img src="${photo}" class="rs-photo" alt="Photo" />`;
      else photoHTML = `<div class="rs-photo-placeholder">👤</div>`;
    }

    // ─── Skills block ───
    let skillsHTML = '';
    if (opts.sections.skills && skills.length) {
      const levels = ['Expert', 'Intermediate', 'Beginner'];
      skillsHTML = `
        <div class="rs-section">
          <div class="rs-section-title">Skills</div>
          ${levels.map(lv => {
        const grp = skills.filter(s => s.level === lv);
        if (!grp.length) return '';
        return `<div class="rs-skills-group">
              <div class="rs-skill-level">${lv}</div>
              <div class="rs-skill-chips">${grp.map(s => `<span class="rs-skill-chip">${escHTML(s.name)}</span>`).join('')}</div>
            </div>`;
      }).join('')}
        </div>`;
    }

    // ─── Education block ───
    let eduHTML = '';
    if (opts.sections.education && edu.length) {
      eduHTML = `
        <div class="rs-section">
          <div class="rs-section-title">Education</div>
          ${edu.map(e => `
            <div class="rs-entry">
              <div class="rs-entry-header">
                <div>
                  <div class="rs-entry-title">${escHTML(e.institution || e.college || '')}</div>
                  <div class="rs-entry-sub">${escHTML(e.degree || '')}${e.field ? ', ' + escHTML(e.field) : ''}</div>
                </div>
                <div class="rs-entry-meta">${escHTML(e.passingYear || e.year || '')}<br>${e.percentage ? escHTML(e.percentage) + '%' : e.cgpa ? 'CGPA ' + escHTML(e.cgpa) : ''}</div>
              </div>
            </div>`).join('')}
        </div>`;
    }

    // ─── Experience block ───
    let expHTML = '';
    if (opts.sections.experience && exp.length) {
      expHTML = `
        <div class="rs-section">
          <div class="rs-section-title">Experience</div>
          ${exp.map(e => {
        const dur = `${e.startDate || ''}${e.currentlyWorking ? ' – Present' : e.endDate ? ' – ' + e.endDate : ''}`;
        return `
            <div class="rs-entry">
              <div class="rs-entry-header">
                <div>
                  <div class="rs-entry-title">${escHTML(e.jobTitle || e.role || '')}</div>
                  <div class="rs-entry-sub">${escHTML(e.company || '')}</div>
                </div>
                <div class="rs-entry-meta">${escHTML(dur)}<br>${e.salary ? '₹ ' + escHTML(e.salary) : ''}</div>
              </div>
              ${e.description ? `<div class="rs-entry-desc">${escHTML(e.description)}</div>` : ''}
            </div>`;
      }).join('')}
        </div>`;
    }

    // ─── Projects block ───
    let projHTML = '';
    if (opts.sections.projects && proj.length) {
      projHTML = `
        <div class="rs-section">
          <div class="rs-section-title">Projects</div>
          ${proj.map(p => {
        const dur = `${p.startDate || ''}${p.current ? ' – Present' : p.endDate ? ' – ' + p.endDate : ''}`;
        const techTags = (p.techStack || []).map(t => `<span class="rs-tech-tag">${escHTML(t)}</span>`).join('');
        const links = [];
        if (opts.showLinks && p.liveUrl) links.push(`<a href="${escAttr(p.liveUrl)}" target="_blank">Live Demo</a>`);
        if (opts.showLinks && p.repoUrl) links.push(`<a href="${escAttr(p.repoUrl)}" target="_blank">Repository</a>`);
        return `
            <div class="rs-entry">
              <div class="rs-entry-header">
                <div>
                  <div class="rs-entry-title">${escHTML(p.title || '')}</div>
                  ${p.role ? `<div class="rs-entry-sub">${escHTML(p.role)}</div>` : ''}
                </div>
                ${dur ? `<div class="rs-entry-meta">${escHTML(dur)}</div>` : ''}
              </div>
              ${p.description ? `<div class="rs-entry-desc">${escHTML(p.description)}</div>` : ''}
              ${techTags ? `<div class="rs-entry-tech">${techTags}</div>` : ''}
              ${links.length ? `<div class="rs-entry-links">${links.join(' ')}</div>` : ''}
            </div>`;
      }).join('')}
        </div>`;
    }

    // ─── Summary ───
    const summaryText = profile.summary || '';
    let summaryHTML = '';
    if (opts.sections.summary) {
      const autoSummary = tailored
        ? tailoringData.summary
        : summaryText || (exp.length
          ? `${exp.length} year${exp.length > 1 ? 's' : ''} of professional experience with expertise in ${skills.slice(0, 3).map(s => s.name).join(', ') || 'various technologies'}.`
          : skills.length ? `Skilled professional with expertise in ${skills.slice(0, 4).map(s => s.name).join(', ')}.` : '');
      if (autoSummary) {
        summaryHTML = `
          <div class="rs-section">
            <div class="rs-section-title">Summary</div>
            <div class="rs-summary">${escHTML(autoSummary)}</div>
          </div>`;
      }
    }

    sheet.innerHTML = `
      <div class="rs-header">
        <div class="rs-header-inner">
          ${photoHTML}
          <div>
            <div class="rs-name">${escHTML(fullName)}</div>
            ${exp.length ? `<div class="rs-title">${escHTML(exp[0].jobTitle || exp[0].role || '')}</div>` : ''}
            <div class="rs-contact">${contactItems.join('')}</div>
          </div>
        </div>
      </div>
      <div class="rs-body">
        <div class="rs-left">
          ${summaryHTML}
          ${skillsHTML}
          ${eduHTML}
        </div>
        <div class="rs-right">
          ${expHTML}
          ${projHTML}
        </div>
      </div>`;

    computeATSScore(opts, profile, skills, exp, edu, proj);
  }

  // ─── ATS Score ───
  function computeATSScore(opts, profile, skills, exp, edu, proj) {
    const hints = [];
    let score = 0;
    const add = (pts, hint) => { score += pts; if (hint) hints.push(hint); };

    // Profile completeness
    if (profile.firstName && profile.lastName) add(10);
    else hints.push('Add your full name');
    if (profile.email) add(8); else hints.push('Add your email address');
    if (profile.phone) add(5); else hints.push('Add a phone number');
    if (profile.address) add(5); else hints.push('Add your location/city');
    if (profile.linkedin) add(5); else hints.push('Add a LinkedIn URL');
    if (profile.github) add(3);

    // Content
    if (skills.length >= 5) add(15); else if (skills.length) add(8, skills.length < 5 ? 'Add at least 5 skills' : null);
    else hints.push('Add your skills');
    if (exp.length >= 1) add(20); else hints.push('Add work experience');
    if (exp.length >= 2) add(5);
    if (edu.length >= 1) add(10); else hints.push('Add education details');
    if (proj.length >= 1) add(8); else hints.push('Add at least one project');
    if (proj.length >= 2) add(4);

    // Description quality
    const hasDescriptions = exp.some(e => e.description && e.description.length > 50);
    if (hasDescriptions) add(10); else hints.push('Add descriptions to your experience entries');

    // Photo
    const photo = store.get(KEYS.photo);
    if (photo) add(2);

    const pct = Math.min(score, 100);
    const bar = $('#ats-bar');
    const pctEl = $('#ats-pct');
    const labelEl = $('#ats-score-label');
    const hintsEl = $('#ats-hints');
    if (!bar) return;

    bar.style.width = pct + '%';
    bar.style.background = pct < 50 ? 'linear-gradient(90deg,var(--clr-danger),#f97316)' :
      pct < 80 ? 'linear-gradient(90deg,var(--clr-warning),var(--clr-primary-lt))' :
        'linear-gradient(90deg,var(--clr-primary),var(--clr-success))';
    pctEl.textContent = pct + '%';
    labelEl.textContent = pct < 50 ? 'Needs improvement' : pct < 80 ? 'Good' : 'Excellent';
    hintsEl.innerHTML = hints.slice(0, 5).map(h => `<li>${h}</li>`).join('');
  }

  // ─── Controls wiring ───
  function initResumeControls() {
    // Theme pills → resumeState
    $$('.theme-pill[data-theme]').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.theme-pill[data-theme]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        resumeState.theme = btn.dataset.theme;
        renderResumePreview();
      });
    });

    // Font size pills → resumeState
    $$('.theme-pill[data-fontsize]').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.theme-pill[data-fontsize]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        resumeState.fontSize = btn.dataset.fontsize;
        renderResumePreview();
      });
    });

    // Section toggles → resumeState.sections
    $$('.resume-toggle').forEach(cb => {
      cb.addEventListener('change', () => {
        resumeState.sections[cb.dataset.sec] = cb.checked;
        renderResumePreview();
      });
    });

    // Photo / links options → resumeState
    const photoOpt = $('#resume-show-photo');
    const linksOpt = $('#resume-show-links');
    if (photoOpt) photoOpt.addEventListener('change', () => { resumeState.showPhoto = photoOpt.checked; renderResumePreview(); });
    if (linksOpt) linksOpt.addEventListener('change', () => { resumeState.showLinks = linksOpt.checked; renderResumePreview(); });
  }

  // ─── PDF Download — clone sheet into a clean print container ───
  function downloadResumePDF() {
    const sheet = $('#resume-sheet');
    if (!sheet) { showToast('Build the resume preview first.', 'error'); return; }

    // Remove any previous print container
    const old = document.getElementById('resume-print-container');
    if (old) old.remove();

    // Clone the sheet and put it directly in <body> in a dedicated wrapper
    const container = document.createElement('div');
    container.id = 'resume-print-container';
    container.style.cssText = 'position:fixed;top:0;left:0;width:100%;z-index:99999;background:#fff;';
    const clone = sheet.cloneNode(true);
    clone.id = 'resume-sheet'; // keep same id so CSS targets it
    clone.style.cssText = 'box-shadow:none;border-radius:0;width:100%;margin:0;';
    container.appendChild(clone);
    document.body.appendChild(container);

    // Brief delay then print; clean up after dialog closes
    setTimeout(() => {
      window.print();
      // Remove after a short delay — long enough that the print dialog captured it
      setTimeout(() => container.remove(), 2000);
    }, 150);
  }

  // ─── Word (.docx-compatible HTML/XML) Download ───
  function downloadResumeDoc() {
    // Build Word XML directly from the vault data — guarantees correct formatting
    const profile = store.get(KEYS.profile) || {};
    const skills = store.get(KEYS.skills) || [];
    const edu = store.get(KEYS.education) || [];
    const exp = store.get(KEYS.experience) || [];
    const proj = store.get('cv_projects') || [];

    const name = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Your Name';
    const contact = [profile.email, profile.phone, profile.linkedin, profile.github]
      .filter(Boolean).join('  |  ');

    const esc = s => (s || '').toString()
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

    // Build section HTML blocks
    const sectionHdr = (t) =>
      `<tr><td colspan="2" style="font-family:Calibri,Arial;font-size:12pt;font-weight:bold;
        color:#1e3a5f;border-bottom:2pt solid #1e3a5f;padding:10pt 0 2pt;
        letter-spacing:1pt;text-transform:uppercase;">${esc(t)}</td></tr>
       <tr><td colspan="2" style="padding:4pt;"></td></tr>`;

    const row = (label, val) => `<tr>
      <td style="font-family:Calibri,Arial;font-size:10pt;font-weight:bold;width:30%;vertical-align:top;padding:2pt 6pt 2pt 0;">${esc(label)}</td>
      <td style="font-family:Calibri,Arial;font-size:10pt;vertical-align:top;padding:2pt 0;">${esc(val)}</td>
    </tr>`;

    let bodyHTML = '';

    // Summary
    if (profile.summary) {
      bodyHTML += sectionHdr('Professional Summary');
      bodyHTML += `<tr><td colspan="2" style="font-family:Calibri,Arial;font-size:10pt;color:#333;padding:4pt 0 8pt;line-height:1.5;">${esc(profile.summary)}</td></tr>`;
    }

    // Experience
    if (exp.length) {
      bodyHTML += sectionHdr('Work Experience');
      exp.forEach(e => {
        const dates = [e.dateFrom, e.dateTo || 'Present'].filter(Boolean).join(' – ');
        bodyHTML += `<tr>
          <td colspan="2" style="font-family:Calibri,Arial;padding:4pt 0 2pt;">
            <span style="font-size:11pt;font-weight:bold;color:#1a1a2e;">${esc(e.role || e.jobTitle)}</span>
            &nbsp;&nbsp;<span style="font-size:10pt;color:#555;">${esc(e.company)}</span>
            <span style="font-size:9pt;color:#888;float:right;">${esc(dates)}</span>
          </td>
        </tr>`;
        if (e.description) {
          bodyHTML += `<tr><td colspan="2" style="font-family:Calibri,Arial;font-size:10pt;color:#444;padding-bottom:8pt;line-height:1.4;">${esc(e.description)}</td></tr>`;
        }
      });
    }

    // Education
    if (edu.length) {
      bodyHTML += sectionHdr('Education');
      edu.forEach(e => {
        const years = [e.yearFrom, e.yearTo].filter(Boolean).join(' – ');
        bodyHTML += `<tr>
          <td colspan="2" style="font-family:Calibri,Arial;padding:4pt 0 2pt;">
            <span style="font-size:11pt;font-weight:bold;color:#1a1a2e;">${esc(e.degree)}</span>
            &nbsp;&nbsp;<span style="font-size:10pt;color:#555;">${esc(e.institution)}</span>
            <span style="font-size:9pt;color:#888;float:right;">${esc(years)}</span>
          </td>
        </tr>`;
        if (e.grade) bodyHTML += `<tr><td colspan="2" style="font-family:Calibri,Arial;font-size:9pt;color:#666;padding-bottom:6pt;">Grade: ${esc(e.grade)}</td></tr>`;
      });
    }

    // Skills
    if (skills.length) {
      bodyHTML += sectionHdr('Skills');
      const grouped = {};
      skills.forEach(s => { (grouped[s.level] = grouped[s.level] || []).push(s.name); });
      Object.entries(grouped).forEach(([level, names]) => {
        bodyHTML += row(level, names.join(', '));
      });
    }

    // Projects
    if (proj.length) {
      bodyHTML += sectionHdr('Projects');
      proj.forEach(p => {
        bodyHTML += `<tr>
          <td colspan="2" style="font-family:Calibri,Arial;padding:4pt 0 2pt;">
            <span style="font-size:11pt;font-weight:bold;color:#1a1a2e;">${esc(p.title)}</span>
            ${p.techStack && p.techStack.length ? `&nbsp;&nbsp;<span style="font-size:9pt;color:#555;">[${esc(p.techStack.join(', '))}]</span>` : ''}
          </td>
        </tr>`;
        if (p.description) bodyHTML += `<tr><td colspan="2" style="font-family:Calibri,Arial;font-size:10pt;color:#444;padding-bottom:6pt;">${esc(p.description)}</td></tr>`;
        if (p.liveUrl || p.repoUrl) {
          const links = [p.liveUrl && `Live: ${p.liveUrl}`, p.repoUrl && `Repo: ${p.repoUrl}`].filter(Boolean).join('  |  ');
          bodyHTML += `<tr><td colspan="2" style="font-family:Calibri,Arial;font-size:9pt;color:#1e3a5f;padding-bottom:8pt;">${esc(links)}</td></tr>`;
        }
      });
    }

    const docHTML = `
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
<meta charset="UTF-8">
<meta name=ProgId content=Word.Document>
<meta name=Generator content="Microsoft Word 15">
<!--[if gte mso 9]><xml><w:WordDocument>
  <w:View>Print</w:View><w:Zoom>100</w:Zoom><w:DoNotOptimizeForBrowser/>
</w:WordDocument></xml><![endif]-->
<style>
  @page Section1 { size:595.3pt 841.9pt; margin:56.7pt 56.7pt 56.7pt 56.7pt; mso-page-orientation:portrait; }
  body { font-family:Calibri,Arial,sans-serif; margin:0; }
  div.Section1 { page:Section1; }
</style>
</head>
<body>
<div class="Section1">
  <!-- HEADER -->
  <table width="100%" border="0" cellpadding="0" cellspacing="0"
    style="background-color:#1e3a5f;padding:24pt 32pt;margin-bottom:0;">
    <tr>
      <td style="font-family:Calibri,Arial;color:#ffffff;">
        <div style="font-size:22pt;font-weight:700;letter-spacing:0.5pt;">${esc(name)}</div>
        ${exp.length ? `<div style="font-size:11pt;opacity:0.85;margin-top:4pt;">${esc(exp[0].role || exp[0].jobTitle || '')}</div>` : ''}
        <div style="font-size:9pt;margin-top:8pt;opacity:0.8;">${esc(contact)}</div>
      </td>
    </tr>
  </table>
  <!-- BODY -->
  <table width="100%" border="0" cellpadding="0" cellspacing="0" style="padding:16pt 32pt;">
    ${bodyHTML}
  </table>
</div>
</body></html>`;

    const blob = new Blob(['\ufeff', docHTML], { type: 'application/msword' });
    const a = document.createElement('a');
    const fname = [profile.firstName, profile.lastName].filter(Boolean).join('_') || 'Resume';
    a.href = URL.createObjectURL(blob);
    a.download = `${fname}_Resume.doc`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    showToast('Word document downloaded!', 'success');
  }

  const pdfBtn = $('#btn-download-pdf');
  const wordBtn = $('#btn-download-word');
  if (pdfBtn) pdfBtn.addEventListener('click', downloadResumePDF);
  if (wordBtn) wordBtn.addEventListener('click', downloadResumeDoc);
  // backward compat if old button exists
  const legacyBtn = $('#btn-download-resume');
  if (legacyBtn) legacyBtn.addEventListener('click', downloadResumePDF);

  // Re-render whenever user navigates to Resume
  const origNavigateTo = navigateTo;
  // We wrap navigateTo to fire renderResumePreview when hitting 'resume'
  // (we re-declare navigateTo below — patch the nav-item listener instead)
  $$('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      if (item.dataset.section === 'resume') {
        setTimeout(renderResumePreview, 50);
      }
    });
  });
  // Also handle sidebar-action-btn Resume link
  const resumeNavBtn = $('#nav-resume');
  if (resumeNavBtn) resumeNavBtn.addEventListener('click', (e) => {
    e.preventDefault();
    navigateTo('resume');
    setTimeout(renderResumePreview, 50);
  });

  // ═══════════════════════════════════════════
  // FEATURE: AI RESUME TAILORING
  // ═══════════════════════════════════════════
  let _tailoringData = null; // null = no tailoring active

  // ─── Extract role title from JD ───
  function extractRoleFromJD(jd) {
    const patterns = [
      /looking for (?:a |an )?([A-Za-z\s\/\-+#.]{4,40}?)(?:\s+with|\s+to|\s+who|\.|,)/i,
      /(?:hiring|seeking|need|want) (?:a |an )?([A-Za-z\s\/\-+#.]{4,40}?)(?:\s+with|\s+to|\s+who|\.|,)/i,
      /position\s*[:\-]?\s*([A-Za-z\s\/\-+#.]{4,40})/i,
      /role\s*[:\-]?\s*([A-Za-z\s\/\-+#.]{4,40})/i,
      /job title\s*[:\-]?\s*([A-Za-z\s\/\-+#.]{4,40})/i,
    ];
    for (const re of patterns) {
      const m = jd.match(re);
      if (m && m[1]) return m[1].trim().replace(/\s+/g, ' ');
    }
    // fallback: first capitalised noun phrase
    const words = jd.match(/\b[A-Z][a-z]+ (?:[A-Z][a-z]+ )?(?:Developer|Engineer|Designer|Manager|Analyst|Architect|Lead|Intern|Consultant)\b/);
    return words ? words[0] : null;
  }

  // ─── Extract tech/skill terms straight from JD text ───
  function extractJDSkills(jd) {
    const lower = jd.toLowerCase();
    const ALL_KW = [
      'javascript', 'typescript', 'python', 'java', 'kotlin', 'swift', 'dart', 'go', 'rust', 'c++', 'c#', 'ruby', 'php', 'scala',
      'react', 'vue', 'angular', 'svelte', 'next.js', 'nuxt', 'redux', 'html', 'css', 'sass', 'tailwind', 'bootstrap', 'webpack', 'vite',
      'node.js', 'express', 'django', 'flask', 'spring', 'fastapi', 'rails', 'laravel', 'graphql', 'rest', 'grpc', 'websockets',
      'flutter', 'react native', 'android', 'ios',
      'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'ci/cd', 'jenkins', 'github actions', 'linux',
      'mysql', 'postgresql', 'mongodb', 'redis', 'elasticsearch', 'firebase', 'sqlite', 'dynamodb',
      'machine learning', 'deep learning', 'tensorflow', 'pytorch', 'nlp', 'scikit-learn', 'pandas', 'numpy', 'ai',
      'agile', 'scrum', 'kanban', 'tdd', 'jest', 'cypress', 'selenium', 'git', 'jira', 'figma',
      'communication', 'leadership', 'teamwork', 'problem solving', 'mentoring', 'collaboration', 'critical thinking',
    ];
    const found = new Set();
    ALL_KW.forEach(kw => { if (lower.includes(kw)) found.add(kw); });
    // also grab capitalised token sequences like ServiceNow, MongoDB, etc.
    (jd.match(/\b[A-Z][a-zA-Z0-9#+.]{2,25}\b/g) || []).forEach(w => found.add(w.toLowerCase()));
    return [...found];
  }

  // ─── Generate a genuinely JD-driven summary ───
  function buildTailoredSummary(role, jdSkills, profile, skills, exp, jdRawText) {
    const jdL = (jdRawText || '').toLowerCase();

    // ── A. Seniority detection ──
    const isSenior = /\bsenior\b|\blead\b|\bprincipal\b|\bstaff\b/i.test(jdRawText);
    const isManager = /\bmanager\b|\bhead of\b|\bdirector\b/i.test(jdRawText);
    const isJunior = /\bjunior\b|\bentry[- ]level\b|\bfresher\b|\bintern\b/i.test(jdRawText);
    const seniorityAdj = isManager ? 'result-oriented' : isSenior ? 'accomplished' : isJunior ? 'motivated' : 'skilled';

    // ── B. Domain / Industry ──
    const domainMap = {
      'fintech': /\bfintech\b|\bbanking\b|\bpayments?\b|\bfinancial services?\b/,
      'healthcare': /\bhealthcare\b|\bmedical\b|\bhospital\b|\bhealth[- ]tech\b/,
      'e-commerce': /\be-?commerce\b|\bretail\b|\bshopping\b|\bmarketplace\b/,
      'SaaS': /\bsaas\b|\bsoftware as a service\b|\bcloud[- ]based\b/,
      'product': /\bproduct[- ]based\b|\bproduct company\b|\bproduct engineering\b/,
      'data': /\bdata engineer\b|\bdata science\b|\bbig data\b|\banalytics\b/,
    };
    let domain = '';
    for (const [key, re] of Object.entries(domainMap)) {
      if (re.test(jdL)) { domain = key; break; }
    }

    // ── C. Key responsibility verbs from JD ──
    const verbMap = {
      'build and scale': /\bbuild\b.*\bscal|\bscal.*\bbuild\b/,
      'design and develop': /\bdesign\b.*\bdevelop|\bdevelop\b.*\bdesign\b/,
      'architect and deliver': /\barchitect\b|\bdesign systems\b/,
      'develop and maintain': /\bmaintain\b.*\bdevelop|\bdevelop\b.*\bmaintain\b/,
      'lead and mentor': /\blead\b.*\bteam|\bmentor\b/,
      'build and deploy': /\bdeploy\b|\bci\/cd\b|\bdevops\b/,
    };
    let verbPhrase = 'design and develop';
    for (const [phrase, re] of Object.entries(verbMap)) {
      if (re.test(jdL)) { verbPhrase = phrase; break; }
    }

    // ── D. Skills relevant to this JD ──
    const vaultSkillNames = skills.map(s => s.name.toLowerCase());
    const relevant = jdSkills.filter(k => vaultSkillNames.some(v => v.includes(k) || k.includes(v))).slice(0, 5);
    const skillStr = relevant.length
      ? relevant.map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(', ')
      : skills.slice(0, 4).map(s => s.name).join(', ');

    // ── E. Role & experience ──
    const roleStr = role || (exp[0] && (exp[0].jobTitle || exp[0].role)) || 'Software Professional';
    const expYrs = exp.length;
    const expStr = expYrs >= 3 ? `${expYrs}+ years of hands-on experience` : expYrs === 2 ? 'over 2 years of experience' : expYrs === 1 ? 'a year of professional experience' : 'strong foundational experience';

    // ── F. Soft skill phrase from JD ──
    const wantsLeadership = /\blead\b|\bmentor\b|\bmanage a team\b/.test(jdL);
    const wantsCollaboration = /\bcollabor\b|\bcross[- ]functional\b|\bteam[- ]player\b/.test(jdL);
    const wantsOwnership = /\bownership\b|\bdriving\b|\bimpact\b|\bself[- ]starter\b/.test(jdL);
    const softPhrase = wantsLeadership ? 'thrive in leading and mentoring teams'
      : wantsOwnership ? 'take full ownership of product delivery from ideation to deployment'
        : wantsCollaboration ? 'excel in cross-functional collaboration to ship high-impact features'
          : 'consistently deliver clean, maintainable, and production-grade code';

    // ── G. Domain closing line ──
    const domainLine = domain
      ? ` with a strong interest in ${domain} products`
      : '';

    // ── H. Assemble summary ──
    const line1 = `${seniorityAdj.charAt(0).toUpperCase() + seniorityAdj.slice(1)} ${roleStr} with ${expStr}${domainLine}.`;
    const line2 = skillStr ? `Proficient in ${skillStr}, with a track record of ${verbPhrase} robust, scalable applications.` : '';
    const line3 = `Known to ${softPhrase}${isManager ? ' while aligning technical direction with business goals' : ''}.`;

    return [line1, line2, line3].filter(Boolean).join(' ');
  }

  // ─── Contextual tips (short, 2 max) ───
  function buildTips(jdText, skills, exp) {
    const jdL = jdText.toLowerCase();
    const tips = [];
    if ((jdL.includes('senior') || jdL.includes('lead')) && exp.length)
      tips.push('Emphasised leadership experience to match senior/lead requirement.');
    if (jdL.includes('agile') || jdL.includes('scrum'))
      tips.push('Agile/Scrum mentioned — add it to Skills if you have experience.');
    if (!exp.some(e => e.description))
      tips.push('Add descriptions to Experience entries for a stronger resume.');
    return tips.slice(0, 2);
  }

  // ─── Main: Analyse & build tailoring data from JD ───
  function analyseJD() {
    const jdText = ($('#jd-input') || {}).value || '';
    if (!jdText.trim()) { showToast('Paste a job description first.', 'error'); return; }

    const profile = store.get(KEYS.profile) || {};
    const skills = store.get(KEYS.skills) || [];
    const exp = store.get(KEYS.experience) || [];

    const role = extractRoleFromJD(jdText);
    const jdSkills = extractJDSkills(jdText);

    // Reorder skills: JD-matching ones float to top within same level group
    const vaultSkillNames = new Set(skills.map(s => s.name.toLowerCase()));
    const jdMatchingSkills = jdSkills.filter(k => vaultSkillNames.has(k));

    // Build tailored summary — pass raw JD text for content-driven generation
    const summary = buildTailoredSummary(role, jdSkills, profile, skills, exp, jdText);

    // Skill reorder: matching skills first, same level preserved
    const reorderedSkills = [
      ...skills.filter(s => jdSkills.includes(s.name.toLowerCase())),
      ...skills.filter(s => !jdSkills.includes(s.name.toLowerCase())),
    ];

    // Tips
    const tips = buildTips(jdText, skills, exp);

    _tailoringData = { role, summary, skills: reorderedSkills, jdMatchingSkills, tips };

    // Show results card
    const results = $('#jd-results');
    if (results) results.style.display = 'block';

    const roleEl = $('#jd-result-role');
    const bodyEl = $('#jd-result-body');
    if (roleEl) roleEl.innerHTML = role
      ? `<span class="jd-role-badge"><span class="material-icons-round" style="font-size:14px">work</span>${escHTML(role)}</span>`
      : `<span class="jd-role-badge" style="background:rgba(100,116,139,.1);color:#64748b"><span class="material-icons-round" style="font-size:14px">help_outline</span>Role not detected</span>`;
    if (bodyEl) bodyEl.innerHTML = `
      <p class="jd-summary-preview">"${escHTML(summary)}"</p>
      ${jdMatchingSkills.length ? `<p class="jd-stat">✅ ${jdMatchingSkills.length} of your skills match this JD</p>` : ''}
      ${tips.map(t => `<p class="jd-tip">💡 ${escHTML(t)}</p>`).join('')}
    `;
    showToast('Resume tailored to the job description ✨', 'success');
  }

  function applyTailoringToResume() {
    if (!_tailoringData) { showToast('Analyse a JD first.', 'error'); return; }
    renderResumePreview(_tailoringData);
    showToast('Tailored resume applied to preview!', 'success');
  }

  function resetResumeToOriginal() {
    _tailoringData = null;
    renderResumePreview();
    const results = $('#jd-results');
    if (results) results.style.display = 'none';
    const inp = $('#jd-input');
    if (inp) inp.value = '';
    showToast('Resume reset to your vault data.', 'info');
  }

  const analyseBtn = $('#btn-analyse-jd');
  const applyBtn = $('#btn-apply-jd');
  const resetBtn = $('#btn-reset-jd');
  if (analyseBtn) analyseBtn.addEventListener('click', analyseJD);
  if (applyBtn) applyBtn.addEventListener('click', applyTailoringToResume);
  if (resetBtn) resetBtn.addEventListener('click', resetResumeToOriginal);

  initResumeControls();



  // ═══════════════════════════════════════════
  // FEATURE: KEYBOARD SHORTCUTS
  // ═══════════════════════════════════════════
  const SECTIONS = ['dashboard', 'profile', 'skills', 'education', 'experience', 'documents'];

  document.addEventListener('keydown', (e) => {
    // Only fire on Ctrl+1..6 (ignore if focus is in an input / textarea)
    if (!e.ctrlKey && !e.metaKey) return;
    const num = parseInt(e.key);
    if (num >= 1 && num <= SECTIONS.length) {
      const activeEl = document.activeElement;
      if (activeEl && ['INPUT', 'TEXTAREA', 'SELECT'].includes(activeEl.tagName)) return;
      e.preventDefault();
      navigateTo(SECTIONS[num - 1]);
    }
  });

  // ─── Utility ───
  function escHTML(str) { if (!str) return ''; const d = document.createElement('div'); d.textContent = str; return d.innerHTML; }
  function escAttr(str) { return escHTML(str || ''); }

  // ─── Public API (for inline onclick handlers) ───
  window.CV = {
    editEducation: openEducationModal,
    deleteEducation: (i) => confirmSingleDelete('Delete this education record?', getEducation, saveEducation, () => { renderEducation(); renderDashboard(); }, i),
    editExperience: openExperienceModal,
    deleteExperience: (i) => confirmSingleDelete('Delete this experience record?', getExperience, saveExperience, () => { renderExperience(); renderDashboard(); }, i),
    viewDocument: viewDocument,
    deleteDocument: (i) => confirmSingleDelete('Delete this document?', getDocuments, saveDocuments, () => { renderDocuments(); renderDashboard(); }, i),
    deleteSkill: (i) => confirmSingleDelete('Delete this skill?', getSkills, saveSkills, () => { renderSkills(); renderDashboard(); }, i),
    copyField: copyField,
    editProject: openProjectModal,
    saveProject: saveProject,
    deleteProject: (i) => confirmSingleDelete('Delete this project?', getProjects, saveProjects, () => { renderProjects(); renderDashboard(); }, i),
    closeModal: closeModal,
  };

  function refreshApp() {
    loadProfile();
    loadProfilePhoto();
    renderDashboard();
    renderEducation();
    renderExperience();
    renderDocuments();
    renderSkills();
    if (typeof renderProjects === 'function') renderProjects();
    renderProfileProgress();
    renderQuickCopy();
    updateUserBadge();
    updateAvatarWithPhoto();
    if (typeof renderResumePreview === 'function') renderResumePreview();
  }

  // ─── Init ───
  // Re-render automatically when auth event fires
  window.addEventListener('cv_user_activated', refreshApp);
  window.addEventListener('cv_user_signed_out', refreshApp);

  // Initial load
  refreshApp();

})();
