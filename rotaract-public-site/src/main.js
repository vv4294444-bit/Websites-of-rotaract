/* -------------------------------------------------------------
   ROTARACT MOTION SITE ENGINE (main.js)
   Features:
   - WebGL 3D Holographic Celestial Sphere with interactive mouse-drag
   - Cursor glow & interactive 3D card tilt
   - Admin authentication & demo fallback mode
   - Event & Project management (CRUD) with Supabase + LocalStorage fallback
   - Real-time DOM synchronization & instant toasts
------------------------------------------------------------- */

const CONFIG = window.ROTARACT_CONFIG || {};

// DOM Selectors Helper
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const escapeHtml = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));

const ui = {
  modal: $('#modal'),
  title: $('#modalTitle'),
  kicker: $('#modalKicker'),
  text: $('#modalText'),
  login: $('#loginForm'),
  content: $('#contentForm'),
  tools: $('#adminTools'),
  foot: $('#modalFoot'),
  toast: $('#toast'),
  ownerButton: $('#ownerButton'),
  ownerButtonText: $('#ownerButtonText'),
  projectList: $('#projectList'),
  upcomingList: $('#upcomingList'),
  pastList: $('#pastList'),
  projectCount: $('#projectCountBadge'),
  addProjectTrigger: $('#addProjectTrigger'),
  addEventTrigger: $('#addEventTrigger')
};

// Application State
let db = null;
let user = null;
let isAdmin = false;
let items = [];
let toastTimer;

// Default initial starter items to look full and active right out of the box
const DEFAULT_ITEMS = [
  {
    id: 'sample-project-1',
    kind: 'project',
    title: 'Project Vruksha: Campus Tree Drive',
    category: 'Environment & Green',
    description: 'Planted over 250 native saplings across campus grounds in collaboration with local nature conservation authorities.',
    event_date: '2026-09-15',
    created_at: new Date('2026-09-15').toISOString()
  },
  {
    id: 'sample-project-2',
    kind: 'project',
    title: 'Literacy Kit Distribution',
    category: 'Community Service',
    description: 'Equipped 120 underserved school children with essential study materials, books, and hygiene kits.',
    event_date: '2026-08-20',
    created_at: new Date('2026-08-20').toISOString()
  },
  {
    id: 'sample-project-3',
    kind: 'project',
    title: 'Youth Leadership Summit 2026',
    category: 'Professional Development',
    description: 'An interactive leadership summit featuring industry mentors, debate rounds, and career strategy workshops.',
    event_date: '2026-10-02',
    created_at: new Date('2026-10-02').toISOString()
  },
  {
    id: 'sample-event-1',
    kind: 'event',
    title: 'District Youth Conclave & Fellowship Night',
    category: 'Club Service',
    description: 'Join us for an inspiring evening of keynote talks, music, fellowship dinner, and club bonding.',
    event_date: '2026-11-20',
    created_at: new Date('2026-10-01').toISOString()
  },
  {
    id: 'sample-event-2',
    kind: 'event',
    title: 'Blood Donation & Free Health Screening Camp',
    category: 'Community Service',
    description: 'Annual mega blood donation drive in partnership with the City Red Cross & General Hospital.',
    event_date: '2026-12-05',
    created_at: new Date('2026-10-05').toISOString()
  },
  {
    id: 'sample-event-3',
    kind: 'event',
    title: 'Rotaract Installation & Charter Day',
    category: 'Club Service',
    description: 'Formal induction of the new board of directors and celebrating club milestones with Rotary mentors.',
    event_date: '2026-07-15',
    created_at: new Date('2026-07-15').toISOString()
  }
];

// Show Toast Alert
function showToast(message) {
  if (!ui.toast) return;
  ui.toast.textContent = message;
  ui.toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => ui.toast.classList.remove('show'), 3500);
}

// Brand Setup
function setBrand() {
  const club = CONFIG.clubName || 'Rotaract Club';
  const college = CONFIG.collegeName || 'District Chapter';

  if ($('#clubBrand')) $('#clubBrand').textContent = club.toUpperCase();
  if ($('#collegeBrand')) $('#collegeBrand').textContent = college.toUpperCase();
  if ($('#heroCollege')) $('#heroCollege').textContent = college;
  if ($('#footerClub')) $('#footerClub').textContent = club.toUpperCase();
  if ($('#footerCollege')) $('#footerCollege').textContent = college.toUpperCase();
  document.title = `${club} · Fellowship Through Service`;

  if (CONFIG.contactEmail && $('#joinLink')) {
    $('#joinLink').href = `mailto:${encodeURIComponent(CONFIG.contactEmail)}?subject=${encodeURIComponent('I would like to join Rotaract')}`;
  }

  const yr = $('#currentYear');
  if (yr) yr.textContent = new Date().getFullYear();
}

// Open / Close Modal
function openModal(mode) {
  if (!ui.modal) return;
  ui.modal.classList.add('open');
  ui.modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  ui.login.hidden = true;
  ui.content.hidden = true;
  ui.tools.hidden = true;
  ui.foot.hidden = false;

  if (mode === 'admin') {
    if (isAdmin) {
      ui.kicker.textContent = 'ROTARACT / CONTROL CENTER';
      ui.title.textContent = 'Club Administration';
      ui.text.textContent = 'You have full publishing & moderation privileges.';
      ui.tools.hidden = false;
      ui.foot.hidden = true;
      $('#signedEmail').textContent = user?.email || 'Verified Club Admin';
    } else {
      ui.kicker.textContent = 'ROTARACT / SECURITY';
      ui.title.textContent = 'Admin Sign In';
      ui.text.textContent = 'Sign in with your authorized admin account to publish updates.';
      ui.login.hidden = false;
      $('#ownerEmail').focus();
    }
  } else if (mode === 'event' || mode === 'project') {
    ui.kicker.textContent = mode === 'event' ? 'ROTARACT / EVENT SCHEDULER' : 'ROTARACT / PROJECT SHOWCASE';
    ui.title.textContent = mode === 'event' ? 'Schedule New Event' : 'Publish New Project';
    ui.text.textContent = 'Add details below to publish live to the public club page.';
    ui.content.hidden = false;

    $('#itemKind').value = mode;
    $('#itemTitleLabel').textContent = mode === 'event' ? 'Event Name' : 'Project Title';
    $('#itemDate').required = mode === 'event';
    $('#dateWrap').style.display = mode === 'event' ? 'flex' : 'none';
    $('#itemTitle').focus();
  }
}

function closeModal() {
  if (!ui.modal) return;
  ui.modal.classList.remove('open');
  ui.modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
}

// Event Listeners for UI Navigation
function initNavAndModals() {
  ui.ownerButton?.addEventListener('click', () => openModal('admin'));
  $('#mobileOwner')?.addEventListener('click', () => {
    closeMobileMenu();
    openModal('admin');
  });

  $('#closeModal')?.addEventListener('click', closeModal);
  ui.modal?.addEventListener('click', (e) => {
    if (e.target === ui.modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  // Action buttons
  $$('[data-create]').forEach((btn) => {
    btn.addEventListener('click', () => openModal(btn.dataset.create));
  });

  // Mobile menu
  const menu = $('#mobileMenu');
  const menuBtn = $('#menuBtn');
  function closeMobileMenu() {
    menu?.classList.remove('open');
    menuBtn?.setAttribute('aria-expanded', 'false');
  }

  menuBtn?.addEventListener('click', () => {
    const isOpen = menu?.classList.toggle('open');
    menuBtn?.setAttribute('aria-expanded', String(isOpen));
  });

  menu?.querySelectorAll('a').forEach((a) => a.addEventListener('click', closeMobileMenu));

  // Quick Demo Admin Button
  $('#demoAdminBtn')?.addEventListener('click', () => {
    loginDemoAdmin();
  });
}

function loginDemoAdmin() {
  const targetAdmin = (CONFIG.adminEmail || 'rotaractclubvasavisfw@gmail.com').toLowerCase();
  isAdmin = true;
  user = { email: targetAdmin };
  localStorage.setItem('rotaract_admin_email', targetAdmin);
  updateAdminUI();
  openModal('admin');
  showToast(`Signed in as authorized Admin (${targetAdmin}). Content controls active!`);
}

function updateAdminUI() {
  if (isAdmin) {
    ui.ownerButton?.classList.add('logged-in');
    if (ui.ownerButtonText) ui.ownerButtonText.textContent = 'Admin Active';
    if (ui.addProjectTrigger) ui.addProjectTrigger.style.display = 'inline-flex';
    if (ui.addEventTrigger) ui.addEventTrigger.style.display = 'inline-flex';
  } else {
    ui.ownerButton?.classList.remove('logged-in');
    if (ui.ownerButtonText) ui.ownerButtonText.textContent = 'Admin Portal';
    if (ui.addProjectTrigger) ui.addProjectTrigger.style.display = 'none';
    if (ui.addEventTrigger) ui.addEventTrigger.style.display = 'none';
  }
}

// Database / Supabase Initialization
async function initDatabase() {
  const allowedAdmin = (CONFIG.adminEmail || 'rotaractclubvasavisfw@gmail.com').toLowerCase();
  
  // Check if saved admin matches authorized email
  const savedEmail = (localStorage.getItem('rotaract_admin_email') || '').toLowerCase();
  if (savedEmail === allowedAdmin) {
    isAdmin = true;
    user = { email: allowedAdmin };
    updateAdminUI();
  } else {
    isAdmin = false;
    user = null;
    updateAdminUI();
  }

  // Check Supabase Configuration
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) {
    console.info('Supabase credentials not yet provided. Operating with high-performance local storage for:', allowedAdmin);
    loadLocalFallbackItems();
    return;
  }

  try {
    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.55.0?bundle');
    db = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });

    const { data: { session } } = await db.auth.getSession();
    if (session?.user) {
      await verifySupabaseAdmin(session.user);
    }

    db.auth.onAuthStateChange((_event, session) => {
      verifySupabaseAdmin(session?.user || null);
    });

    await fetchRemoteItems();
  } catch (err) {
    console.warn('Supabase connect error, fallback to local items:', err);
    loadLocalFallbackItems();
  }
}

async function verifySupabaseAdmin(currentUser) {
  const allowedAdmin = (CONFIG.adminEmail || 'rotaractclubvasavisfw@gmail.com').toLowerCase();
  user = currentUser;

  if (!user || !user.email || user.email.toLowerCase() !== allowedAdmin) {
    // If not the specific admin email, strictly revoke admin privileges
    isAdmin = false;
    updateAdminUI();
    return;
  }

  if (db) {
    try {
      const { data, error } = await db.from('site_admins').select('user_id').eq('user_id', user.id).maybeSingle();
      if (!error && data) {
        isAdmin = true;
      } else {
        // Fallback: match by email allowlist
        isAdmin = true;
      }
    } catch (e) {
      console.warn('Admin verification check:', e);
      isAdmin = true;
    }
  } else {
    isAdmin = true;
  }
  updateAdminUI();
}

// Load items from Supabase or fallback
async function fetchRemoteItems() {
  if (!db) {
    loadLocalFallbackItems();
    return;
  }

  try {
    const { data, error } = await db
      .from('club_content')
      .select('id,kind,title,description,category,event_date,created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;
    if (data && data.length > 0) {
      items = data;
    } else {
      items = DEFAULT_ITEMS;
    }
    renderAllContent();
  } catch (err) {
    console.warn('Could not read from Supabase, using local items:', err);
    loadLocalFallbackItems();
  }
}

function loadLocalFallbackItems() {
  const local = localStorage.getItem('rotaract_club_content');
  if (local) {
    try {
      items = JSON.parse(local);
    } catch {
      items = DEFAULT_ITEMS;
    }
  } else {
    items = DEFAULT_ITEMS;
    localStorage.setItem('rotaract_club_content', JSON.stringify(DEFAULT_ITEMS));
  }
  renderAllContent();
}

function saveLocalItems() {
  localStorage.setItem('rotaract_club_content', JSON.stringify(items));
}

// Render Projects and Events
function renderAllContent() {
  renderProjects();
  renderEvents();
}

function renderProjects() {
  const projects = items.filter((x) => x.kind === 'project');
  if (ui.projectCount) {
    ui.projectCount.textContent = `${projects.length} Project${projects.length === 1 ? '' : 's'}`;
  }

  if (!projects.length) {
    ui.projectList.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon-wrap">✦</div>
        <h3>No Projects Yet</h3>
        <p>Our upcoming community and campus initiatives will appear here soon.</p>
      </div>`;
    return;
  }

  ui.projectList.innerHTML = projects.map((x, i) => `
    <article class="project-card" data-tilt>
      <div>
        <div class="project-card-top">
          <span class="project-category-tag">${escapeHtml(x.category || 'Initiative')}</span>
          <span class="project-index">PROJ / ${String(i + 1).padStart(2, '0')}</span>
        </div>
        <h3>${escapeHtml(x.title)}</h3>
        <p>${escapeHtml(x.description || 'Dedicated Rotaract initiative serving the campus and wider community.')}</p>
      </div>
      <div class="project-card-footer">
        <span class="project-date">${x.event_date ? formatMonthYear(x.event_date) : 'Rotaract Impact'}</span>
        ${isAdmin ? `<button class="card-remove-btn" data-remove="${escapeHtml(x.id)}">Remove ×</button>` : '<span style="color:var(--text-dim);font-size:11px;">ROTARACT</span>'}
      </div>
    </article>
  `).join('');
}

function renderEvents() {
  const events = items.filter((x) => x.kind === 'event');
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const upcoming = events.filter((x) => !x.event_date || new Date(x.event_date + 'T00:00:00') >= now)
    .sort((a, b) => (a.event_date || '9999').localeCompare(b.event_date || '9999'));

  const past = events.filter((x) => x.event_date && new Date(x.event_date + 'T00:00:00') < now)
    .sort((a, b) => b.event_date.localeCompare(a.event_date));

  ui.upcomingList.innerHTML = upcoming.length
    ? upcoming.map((x) => buildEventMarkup(x, false)).join('')
    : '<div class="empty-event-card">No upcoming dates scheduled yet. Stay tuned for our next meet!</div>';

  ui.pastList.innerHTML = past.length
    ? past.map((x) => buildEventMarkup(x, true)).join('')
    : '<div class="empty-event-card">Our historic achievements and past meets will appear here.</div>';
}

function buildEventMarkup(ev, isPast) {
  const d = ev.event_date ? new Date(ev.event_date + 'T12:00:00') : null;
  const day = d ? String(d.getDate()).padStart(2, '0') : 'TBA';
  const mon = d ? d.toLocaleDateString(undefined, { month: 'short' }).toUpperCase() : 'DATE';

  return `
    <article class="event-item">
      <div class="event-calendar-badge">
        <span class="event-day">${day}</span>
        <span class="event-month">${mon}</span>
      </div>
      <div class="event-info">
        <h4>${escapeHtml(ev.title)}</h4>
        <div class="event-meta">${escapeHtml(ev.category || 'Gathering')}</div>
        ${ev.description ? `<p class="event-desc-snippet">${escapeHtml(ev.description)}</p>` : ''}
      </div>
      ${isAdmin ? `<button class="card-remove-btn" data-remove="${escapeHtml(ev.id)}" title="Remove this event">×</button>` : ''}
    </article>
  `;
}

function formatMonthYear(dateString) {
  try {
    const d = new Date(dateString + 'T12:00:00');
    return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
  } catch {
    return dateString;
  }
}

// Form Handlers (Sign In & Add Item)
function initForms() {
  // Login Form
  ui.login?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('#ownerEmail').value.trim().toLowerCase();
    const allowedAdmin = (CONFIG.adminEmail || 'rotaractclubvasavisfw@gmail.com').toLowerCase();

    if (email !== allowedAdmin) {
      showToast('Access denied: Only rotaractclubvasavisfw@gmail.com has admin access.');
      return;
    }

    if (!db) {
      // Local fallback login for the authorized admin email
      isAdmin = true;
      user = { email };
      localStorage.setItem('rotaract_admin_email', email);
      updateAdminUI();
      openModal('admin');
      showToast(`Welcome! Signed in as ${email}. Admin controls enabled.`);
      return;
    }

    const { error } = await db.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin }
    });

    if (error) {
      showToast(error.message);
      return;
    }

    ui.login.hidden = true;
    ui.title.textContent = 'Check Your Email';
    ui.text.textContent = `A private sign-in link was dispatched to ${email}.`;
  });

  // Content Submission Form (Event or Project)
  ui.content?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!isAdmin) {
      showToast('Admin privilege required to publish.');
      return;
    }

    const kind = $('#itemKind').value;
    const title = $('#itemTitle').value.trim();
    const category = $('#itemCategory').value;
    const description = $('#itemDescription').value.trim();
    const event_date = kind === 'event' ? ($('#itemDate').value || null) : null;

    const newItem = {
      id: 'item_' + Date.now(),
      kind,
      title,
      category,
      description,
      event_date,
      created_at: new Date().toISOString()
    };

    if (db) {
      try {
        const { error } = await db.from('club_content').insert({
          kind,
          title,
          category,
          description,
          event_date
        });
        if (error) throw error;
        await fetchRemoteItems();
        showToast(`Published ${kind === 'event' ? 'event' : 'project'} successfully!`);
      } catch (err) {
        showToast('Supabase write error. Saved locally.');
        items.unshift(newItem);
        saveLocalItems();
        renderAllContent();
      }
    } else {
      items.unshift(newItem);
      saveLocalItems();
      renderAllContent();
      showToast(`Published ${kind === 'event' ? 'event' : 'project'} to site!`);
    }

    ui.content.reset();
    closeModal();
  });

  // Global Item Removal Handler
  document.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('[data-remove]');
    if (!removeBtn) return;

    if (!isAdmin) {
      showToast('Only admins can remove items.');
      return;
    }

    if (!confirm('Are you sure you want to remove this item?')) return;

    const targetId = removeBtn.dataset.remove;

    if (db) {
      try {
        const { error } = await db.from('club_content').delete().eq('id', targetId);
        if (error) throw error;
        await fetchRemoteItems();
        showToast('Item deleted successfully.');
        return;
      } catch (err) {
        console.warn('Could not delete from Supabase, removing locally:', err);
      }
    }

    items = items.filter((x) => x.id !== targetId);
    saveLocalItems();
    renderAllContent();
    showToast('Item removed.');
  });

  // Sign out
  $('#signOut')?.addEventListener('click', async () => {
    isAdmin = false;
    user = null;
    localStorage.removeItem('rotaract_admin_email');
    localStorage.removeItem('rotaract_demo_admin');
    if (db) await db.auth.signOut();
    updateAdminUI();
    renderAllContent();
    closeModal();
    showToast('Signed out from Admin Portal.');
  });
}

// Interactive Cursor Ambient Follower
function initCursorGlow() {
  const glow = $('#cursorGlow');
  if (!glow) return;

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let curX = mouseX;
  let curY = mouseY;

  window.addEventListener('pointermove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
  });

  function loop() {
    curX += (mouseX - curX) * 0.1;
    curY += (mouseY - curY) * 0.1;
    glow.style.left = `${curX}px`;
    glow.style.top = `${curY}px`;
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

// 3D Card Tilt Interaction
function initTiltCards() {
  document.addEventListener('pointermove', (e) => {
    const card = e.target.closest('[data-tilt]');
    if (!card) return;

    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    const tiltX = (y / (rect.height / 2)) * -6;
    const tiltY = (x / (rect.width / 2)) * 6;

    card.style.transform = `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg) translateY(-4px)`;
  });

  document.addEventListener('pointerout', (e) => {
    const card = e.target.closest('[data-tilt]');
    if (card && !card.contains(e.relatedTarget)) {
      card.style.transform = '';
    }
  });
}

// WebGL 3D Holographic Celestial Sphere (Shader Engine)
function initCelestialGlobe() {
  const canvas = $('#globe');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', { alpha: true, antialias: true });
  if (!gl) {
    canvas.style.background = 'radial-gradient(circle, #e61d5e 0%, #300c3b 70%, transparent 100%)';
    return;
  }

  const vs = `
    attribute vec3 p;
    attribute vec3 n;
    uniform mat4 mvp;
    uniform mat4 model;
    varying vec3 vN;
    varying vec3 vP;
    void main() {
      vN = normalize(mat3(model) * n);
      vP = p;
      gl_Position = mvp * vec4(p, 1.0);
    }
  `;

  // Hologram Rotaract Palette: Deep Cranberry, Magenta, and Gold highlights
  const fs = `
    precision mediump float;
    varying vec3 vN;
    varying vec3 vP;
    uniform float time;
    void main() {
      vec3 q = normalize(vP);
      float noise = sin(q.x * 9.0 + time * 0.8) * sin(q.y * 11.0 + q.z * 4.0);
      float mask = smoothstep(0.1, 0.6, noise);

      vec3 N = normalize(vN);
      vec3 L = normalize(vec3(0.5, 0.8, 1.0));
      float diff = max(dot(N, L), 0.0);
      
      vec3 V = normalize(vec3(0.0, 0.0, 3.2) - vP);
      float rim = pow(1.0 - max(dot(N, V), 0.0), 2.2);

      vec3 base = vec3(0.12, 0.04, 0.18);
      vec3 cranberry = vec3(0.9, 0.11, 0.37);
      vec3 gold = vec3(1.0, 0.72, 0.28);

      vec3 col = mix(base, cranberry, mask * 0.85);
      col += diff * vec3(0.3, 0.1, 0.25);
      col += rim * mix(gold, cranberry, 0.5) * 1.4;

      gl_FragColor = vec4(col, 0.95);
    }
  `;

  const ringFs = `
    precision mediump float;
    uniform vec3 tint;
    void main() {
      gl_FragColor = vec4(tint, 0.75);
    }
  `;

  function createShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  function createProgram(vSrc, fSrc) {
    const p = gl.createProgram();
    gl.attachShader(p, createShader(gl.VERTEX_SHADER, vSrc));
    gl.attachShader(p, createShader(gl.FRAGMENT_SHADER, fSrc));
    gl.linkProgram(p);
    return p;
  }

  let sp, rp;
  try {
    sp = createProgram(vs, fs);
    rp = createProgram(vs, ringFs);
  } catch (e) {
    console.warn('WebGL init error:', e);
    return;
  }

  // Geometry Generators
  function generateSphere(rows, cols) {
    const v = [], ind = [];
    for (let y = 0; y <= rows; y++) {
      const ph = (y * Math.PI) / rows;
      for (let x = 0; x <= cols; x++) {
        const th = (x * 2 * Math.PI) / cols;
        const X = -Math.cos(th) * Math.sin(ph);
        const Y = Math.cos(ph);
        const Z = Math.sin(th) * Math.sin(ph);
        v.push(X, Y, Z, X, Y, Z);
      }
    }
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const a = y * (cols + 1) + x;
        const b = a + cols + 1;
        ind.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return { v: new Float32Array(v), i: new Uint16Array(ind) };
  }

  function generateTorus(r, minor, segments = 160, sides = 8, tilt = 0) {
    const v = [], idx = [];
    for (let i = 0; i <= segments; i++) {
      const u = (i / segments) * Math.PI * 2;
      for (let j = 0; j <= sides; j++) {
        const w = (j / sides) * Math.PI * 2;
        const rr = r + minor * Math.cos(w);
        const x = rr * Math.cos(u);
        const z = rr * Math.sin(u);
        const y = minor * Math.sin(w);
        const yy = y * Math.cos(tilt) - z * Math.sin(tilt);
        const zz = y * Math.sin(tilt) + z * Math.cos(tilt);
        v.push(x, yy, zz, Math.cos(w) * Math.cos(u), Math.sin(w), Math.cos(w) * Math.sin(u));
      }
    }
    for (let i = 0; i < segments; i++) {
      for (let j = 0; j < sides; j++) {
        const a = i * (sides + 1) + j;
        const b = a + sides + 1;
        idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    return { v: new Float32Array(v), i: new Uint16Array(idx) };
  }

  function createMesh(data) {
    const vb = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, data.v, gl.STATIC_DRAW);
    const ib = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, data.i, gl.STATIC_DRAW);
    return { vb, ib, count: data.i.length };
  }

  const globeMesh = createMesh(generateSphere(50, 64));
  const ring1 = createMesh(generateTorus(1.35, 0.008, 160, 6, 0.5));
  const ring2 = createMesh(generateTorus(1.5, 0.006, 160, 6, -0.65));

  // Matrix math helpers
  function matMul(a, b) {
    const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        o[c * 4 + r] =
          a[r] * b[c * 4] +
          a[4 + r] * b[c * 4 + 1] +
          a[8 + r] * b[c * 4 + 2] +
          a[12 + r] * b[c * 4 + 3];
      }
    }
    return o;
  }

  function perspective(fov, aspect, near, far) {
    const f = 1 / Math.tan(fov / 2);
    const nf = 1 / (near - far);
    return new Float32Array([
      f / aspect, 0, 0, 0,
      0, f, 0, 0,
      0, 0, (far + near) * nf, -1,
      0, 0, 2 * far * near * nf, 0
    ]);
  }

  function rotateY(t) {
    return new Float32Array([
      Math.cos(t), 0, -Math.sin(t), 0,
      0, 1, 0, 0,
      Math.sin(t), 0, Math.cos(t), 0,
      0, 0, 0, 1
    ]);
  }

  function rotateX(t) {
    return new Float32Array([
      1, 0, 0, 0,
      0, Math.cos(t), Math.sin(t), 0,
      0, -Math.sin(t), Math.cos(t), 0,
      0, 0, 0, 1
    ]);
  }

  function translateZ(z) {
    return new Float32Array([
      1, 0, 0, 0,
      0, 1, 0, 0,
      0, 0, 1, 0,
      0, 0, z, 1
    ]);
  }

  function bindMesh(m, prog) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vb);
    const stride = 24;
    const pa = gl.getAttribLocation(prog, 'p');
    const na = gl.getAttribLocation(prog, 'n');
    gl.enableVertexAttribArray(pa);
    gl.vertexAttribPointer(pa, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(na);
    gl.vertexAttribPointer(na, 3, gl.FLOAT, false, stride, 12);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.ib);
  }

  // Interactive Drag Rotation
  let isDragging = false;
  let lastX = 0;
  let pointerAngle = 0;
  const spinSpeed = 0.28;

  canvas.addEventListener('pointerdown', (e) => {
    isDragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (isDragging) {
      pointerAngle += (e.clientX - lastX) * 0.008;
      lastX = e.clientX;
    }
  });

  canvas.addEventListener('pointerup', () => {
    isDragging = false;
  });

  const startTime = performance.now();

  function render(timeNow) {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 1.8);
    const W = Math.max(1, Math.floor(w * dpr));
    const H = Math.max(1, Math.floor(h * dpr));

    if (canvas.width !== W || canvas.height !== H) {
      canvas.width = W;
      canvas.height = H;
      gl.viewport(0, 0, W, H);
    }

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    gl.enable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    const t = (timeNow - startTime) / 1000;
    const rot = rotateY(t * spinSpeed + pointerAngle);
    const tilt = rotateX(-0.18);
    const model = matMul(rot, tilt);
    const view = translateZ(-3.2);
    const proj = perspective(0.75, W / H, 0.1, 30);
    const mvp = matMul(proj, matMul(view, model));

    // Render Sphere
    gl.useProgram(sp);
    bindMesh(globeMesh, sp);
    gl.uniformMatrix4fv(gl.getUniformLocation(sp, 'mvp'), false, mvp);
    gl.uniformMatrix4fv(gl.getUniformLocation(sp, 'model'), false, model);
    gl.uniform1f(gl.getUniformLocation(sp, 'time'), t);
    gl.drawElements(gl.TRIANGLES, globeMesh.count, gl.UNSIGNED_SHORT, 0);

    // Render Rings (Rotaract Gold and Rose Glow)
    gl.useProgram(rp);
    gl.uniformMatrix4fv(gl.getUniformLocation(rp, 'mvp'), false, mvp);
    gl.uniformMatrix4fv(gl.getUniformLocation(rp, 'model'), false, model);

    gl.uniform3f(gl.getUniformLocation(rp, 'tint'), 1.0, 0.75, 0.3); // Warm Gold
    bindMesh(ring1, rp);
    gl.drawElements(gl.TRIANGLES, ring1.count, gl.UNSIGNED_SHORT, 0);

    gl.uniform3f(gl.getUniformLocation(rp, 'tint'), 0.95, 0.25, 0.55); // Cranberry Rose
    bindMesh(ring2, rp);
    gl.drawElements(gl.TRIANGLES, ring2.count, gl.UNSIGNED_SHORT, 0);

    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
}

// Kickstart Everything
function bootstrap() {
  setBrand();
  initNavAndModals();
  initForms();
  initCursorGlow();
  initTiltCards();
  initCelestialGlobe();
  initDatabase();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrap);
} else {
  bootstrap();
}
