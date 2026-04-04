/* ═══════════════════════════════════════════
   CareerVault — Application Logic
   ═══════════════════════════════════════════ */

(function () {
  'use strict';

  // ─── Storage Keys ───
  const KEYS = {
    profile:    'cv_profile',
    education:  'cv_education',
    experience: 'cv_experience',
    documents:  'cv_documents',
    skills:     'cv_skills',
    photo:      'cv_photo',
  };

  // ─── Storage Helpers ───
  const store = {
    get(key)       { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
    set(key, data) { localStorage.setItem(key, JSON.stringify(data)); },
    remove(key)    { localStorage.removeItem(key); },
  };

  // ─── DOM Refs ───
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const sidebar        = $('#sidebar');
  const sidebarOverlay = $('#sidebar-overlay');
  const btnMenu        = $('#btn-menu');

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
  const themeIcon   = $('#theme-icon');

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

  // ─── Modal ───
  const modalOverlay = $('#modal-overlay');
  const modalTitle   = $('#modal-title');
  const modalBody    = $('#modal-body');
  const modalClose   = $('#modal-close');

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
    const profile = store.get(KEYS.profile);
    const avatarEl = $('#user-avatar');
    const nameEl = $('#user-name');
    const emailEl = $('#user-email');
    const greetingEl = $('#greeting-text');

    // Greeting based on time of day
    const hour = new Date().getHours();
    let greet = 'Good evening';
    if (hour < 12) greet = 'Good morning';
    else if (hour < 17) greet = 'Good afternoon';

    if (profile && profile.firstName) {
      const first = profile.firstName.trim();
      const last = (profile.lastName || '').trim();
      const initials = (first[0] + (last[0] || '')).toUpperCase();

      nameEl.textContent = first + (last ? ' ' + last : '');
      emailEl.textContent = profile.email || 'No email set';
      greetingEl.textContent = `${greet}, ${first} 👋`;

      // Show initials avatar
      avatarEl.innerHTML = `<span class="avatar-initials">${initials}</span>`;
    } else {
      nameEl.textContent = 'Guest User';
      emailEl.textContent = 'Set up your profile';
      greetingEl.textContent = `${greet} 👋`;
      avatarEl.innerHTML = '<span class="material-icons-round">person</span>';
    }
  }

  // Clicking the badge navigates to profile
  $('#user-profile-badge').addEventListener('click', () => navigateTo('profile'));

  // ═══════════════════════════════════════════
  // DASHBOARD
  // ═══════════════════════════════════════════
  function renderDashboard() {
    const profile     = store.get(KEYS.profile);
    const education   = store.get(KEYS.education) || [];
    const experience  = store.get(KEYS.experience) || [];
    const documents   = store.get(KEYS.documents) || [];

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
    const data = store.get(KEYS.profile);
    if (!data) return;
    profileFields.forEach((f) => {
      const el = $(`#profile-${f}`);
      if (el && data[f] !== undefined) el.value = data[f];
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

    if (!list.length) {
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    container.innerHTML = list.map((item, i) => `
      <div class="record-card edu">
        <div class="record-info">
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
          <button class="btn btn-danger-outline btn-sm" onclick="CV.deleteEducation(${i})"><span class="material-icons-round">delete</span></button>
        </div>
      </div>
    `).join('');
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
        degree:      $('#edu-degree').value.trim(),
        institution: $('#edu-institution').value.trim(),
        field:       $('#edu-field').value.trim(),
        grade:       $('#edu-grade').value.trim(),
        yearFrom:    $('#edu-yearFrom').value.trim(),
        yearTo:      $('#edu-yearTo').value.trim(),
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

  function deleteEducation(index) {
    showConfirm('Delete this education record?', () => {
      const list = getEducation();
      list.splice(index, 1);
      saveEducation(list);
      renderEducation();
      renderDashboard();
      showToast('Education deleted.', 'info');
    });
  }

  $('#btn-add-education').addEventListener('click', () => openEducationModal());

  // ═══════════════════════════════════════════
  // EXPERIENCE
  // ═══════════════════════════════════════════
  function getExperience() { return store.get(KEYS.experience) || []; }
  function saveExperience(list) { store.set(KEYS.experience, list); }

  function renderExperience() {
    const list = getExperience();
    const container = $('#experience-list');
    const empty = $('#experience-empty');

    if (!list.length) {
      container.innerHTML = '';
      empty.style.display = 'block';
      return;
    }

    empty.style.display = 'none';
    container.innerHTML = list.map((item, i) => `
      <div class="record-card exp">
        <div class="record-info">
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
          <button class="btn btn-danger-outline btn-sm" onclick="CV.deleteExperience(${i})"><span class="material-icons-round">delete</span></button>
        </div>
      </div>
    `).join('');
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
        role:        $('#exp-role').value.trim(),
        company:     $('#exp-company').value.trim(),
        location:    $('#exp-location').value.trim(),
        salary:      $('#exp-salary').value.trim(),
        dateFrom:    $('#exp-dateFrom').value.trim(),
        dateTo:      $('#exp-dateTo').value.trim(),
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

  function deleteExperience(index) {
    showConfirm('Delete this experience record?', () => {
      const list = getExperience();
      list.splice(index, 1);
      saveExperience(list);
      renderExperience();
      renderDashboard();
      showToast('Experience deleted.', 'info');
    });
  }

  $('#btn-add-experience').addEventListener('click', () => openExperienceModal());

  // ═══════════════════════════════════════════
  // DOCUMENTS
  // ═══════════════════════════════════════════
  function getDocuments() { return store.get(KEYS.documents) || []; }
  function saveDocuments(list) { store.set(KEYS.documents, list); }

  function renderDocuments() {
    const list = getDocuments();
    const container = $('#documents-list');
    const empty = $('#documents-empty');

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

    container.innerHTML = list.map((doc, i) => {
      const icon = iconMap[doc.type] || 'description';
      const sizeKB = doc.size ? (doc.size / 1024).toFixed(1) : '—';
      return `
        <div class="doc-card">
          <span class="material-icons-round doc-icon">${icon}</span>
          <h4>${escHTML(doc.label || doc.name)}</h4>
          <p class="doc-meta">${escHTML(doc.name)} · ${sizeKB} KB</p>
          <div class="doc-actions">
            <button class="btn btn-outline btn-sm" onclick="CV.viewDocument(${i})"><span class="material-icons-round">visibility</span> View</button>
            <button class="btn btn-danger-outline btn-sm" onclick="CV.deleteDocument(${i})"><span class="material-icons-round">delete</span></button>
          </div>
        </div>
      `;
    }).join('');
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

  function deleteDocument(index) {
    showConfirm('Delete this document?', () => {
      const list = getDocuments();
      list.splice(index, 1);
      saveDocuments(list);
      renderDocuments();
      renderDashboard();
      showToast('Document deleted.', 'info');
    });
  }

  $('#btn-add-document').addEventListener('click', () => openDocumentModal());

  // ═══════════════════════════════════════════
  // FEATURE: PROFILE PHOTO
  // ═══════════════════════════════════════════
  function loadProfilePhoto() {
    const photo = store.get(KEYS.photo);
    const preview = $('#photo-preview');
    const removeBtn = $('#btn-remove-photo');
    if (photo) {
      preview.innerHTML = `<img src="${photo}" alt="Profile photo" />`;
      if (removeBtn) removeBtn.style.display = 'inline-flex';
    } else {
      preview.innerHTML = '<span class="material-icons-round">person</span>';
      if (removeBtn) removeBtn.style.display = 'none';
    }
  }

  function updateAvatarWithPhoto() {
    const photo = store.get(KEYS.photo);
    const avatar = $('#user-avatar');
    if (!avatar) return;
    if (photo) {
      avatar.innerHTML = `<img src="${photo}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />`;
    }
    // if no photo, updateUserBadge() handles initials
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
    { field: 'lastName',  label: 'Last Name'  },
    { field: 'email',     label: 'Email'      },
    { field: 'phone',     label: 'Phone'      },
    { field: 'dob',       label: 'Date of Birth' },
    { field: 'gender',    label: 'Gender'     },
    { field: 'address',   label: 'Address'    },
    { field: 'linkedin',  label: 'LinkedIn'   },
    { field: 'github',    label: 'GitHub'     },
  ];

  function renderProfileProgress() {
    const profile = store.get(KEYS.profile) || {};
    const filled  = PROFILE_FIELDS_LABELS.filter(f => profile[f.field] && String(profile[f.field]).trim());
    const pct     = Math.round((filled.length / PROFILE_FIELDS_LABELS.length) * 100);
    const missing = PROFILE_FIELDS_LABELS.filter(f => !profile[f.field] || !String(profile[f.field]).trim()).map(f => f.label);

    const card  = $('#profile-progress-card');
    const fill  = $('#progress-bar-fill');
    const pctEl = $('#progress-pct-label');
    const missEl= $('#progress-missing');
    if (!card) return;

    card.style.display = 'block';
    pctEl.textContent  = pct + '%';
    fill.style.width   = pct + '%';
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
    const grid  = $('#copy-grid');
    const card  = $('#profile-quickcopy');
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
  function getSkills()    { return store.get(KEYS.skills) || []; }
  function saveSkills(d)  { store.set(KEYS.skills, d); }

  function renderSkills() {
    const skills  = getSkills();
    const board   = $('#skills-board');
    if (!board) return;

    board.innerHTML = '';
    if (!skills.length) { board.style.display = 'none'; return; }
    board.style.display = 'flex';

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
            return `<span class="skill-chip ${level}">${escHTML(s.name)}<button class="skill-chip-del" onclick="CV.deleteSkill(${realIdx})" title="Remove">✕</button></span>`;
          }).join('')}
        </div>`;
      board.appendChild(div);
    });
  }

  function addSkill() {
    const nameInput  = $('#skill-name-input');
    const levelInput = $('#skill-level-input');
    const name  = nameInput.value.trim();
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

  function deleteSkill(index) {
    const skills = getSkills();
    skills.splice(index, 1);
    saveSkills(skills);
    renderSkills();
    showToast('Skill removed.', 'info');
  }

  $('#btn-add-skill').addEventListener('click', addSkill);
  $('#skill-name-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } });

  // ═══════════════════════════════════════════
  // FEATURE: EXPORT / IMPORT
  // ═══════════════════════════════════════════
  function exportData() {
    const data = {};
    Object.entries(KEYS).forEach(([k, storageKey]) => {
      const val = store.get(storageKey);
      if (val !== null) data[storageKey] = val;
    });
    data['cv_theme'] = localStorage.getItem('cv_theme') || 'light';
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const date = new Date().toISOString().slice(0, 10);
    a.download = `careervault-backup-${date}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 60000);
    showToast('Data exported successfully!', 'success');
  }

  function importData(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target.result);
        Object.entries(data).forEach(([key, value]) => {
          localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value));
        });
        // Re-render everything
        loadProfile();
        renderDashboard();
        renderEducation();
        renderExperience();
        renderDocuments();
        renderSkills();
        renderProfileProgress();
        renderQuickCopy();
        loadProfilePhoto();
        updateUserBadge();
        updateAvatarWithPhoto();
        if (data['cv_theme']) applyTheme(data['cv_theme']);
        showToast('Data imported successfully! 🎉', 'success');
      } catch {
        showToast('Invalid file. Please use a CareerVault backup JSON.', 'error');
      }
    };
    reader.readAsText(file);
  }

  $('#btn-export').addEventListener('click', exportData);
  const importFileInput = $('#import-file-input');
  if (importFileInput) {
    importFileInput.addEventListener('change', (e) => {
      importData(e.target.files[0]);
      e.target.value = ''; // allow re-importing same file
    });
  }

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
    editEducation:   openEducationModal,
    deleteEducation: deleteEducation,
    editExperience:  openExperienceModal,
    deleteExperience: deleteExperience,
    viewDocument:    viewDocument,
    deleteDocument:  deleteDocument,
    deleteSkill:     deleteSkill,
    copyField:       copyField,
    closeModal:      closeModal,
  };

  // ─── Init ───
  loadProfile();
  loadProfilePhoto();
  renderDashboard();
  renderEducation();
  renderExperience();
  renderDocuments();
  renderSkills();
  renderProfileProgress();
  renderQuickCopy();
  updateUserBadge();
  updateAvatarWithPhoto();

})();
