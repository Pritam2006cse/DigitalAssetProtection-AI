/* ============================================================
   alerts.js — Fetch + render infringement alerts
   ============================================================ */

let allAlerts = [];
let currentFilter = 'ALL';

document.addEventListener('DOMContentLoaded', () => {
  loadAlerts();
});

/* ── Fetch from API ── */
async function loadAlerts() {
  const grid    = document.getElementById('alerts-grid');
  const loading = document.getElementById('alerts-loading');
  const empty   = document.getElementById('alerts-empty');

  if (grid)    { grid.innerHTML = ''; grid.style.display = 'none'; }
  if (empty)   empty.style.display   = 'none';
  if (loading) loading.style.display = 'flex';

  // Rotate refresh icon
  const refreshIcon = document.querySelector('.btn-refresh svg');
  if (refreshIcon) refreshIcon.style.transform = 'rotate(360deg)';

  try {
    const session = getSession();
    const headers = {};
    if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

    const res  = await fetch(`${getApiUrl()}/alerts`, { headers });
    const data = await res.json();
    allAlerts  = Array.isArray(data) ? data : (data.alerts || []);

  } catch (err) {
    // Fallback to sample data if API unreachable
    allAlerts = getSampleAlerts();
  } finally {
    if (loading) loading.style.display = 'none';
    if (grid)    grid.style.display    = 'flex';
    renderAlerts();
    updateHeroStats();
    setTimeout(() => { if (refreshIcon) refreshIcon.style.transform = ''; }, 100);
  }
}

/* ── Render ── */
function renderAlerts() {
  const grid  = document.getElementById('alerts-grid');
  const empty = document.getElementById('alerts-empty');
  if (!grid) return;

  const filtered = currentFilter === 'ALL'
    ? allAlerts
    : allAlerts.filter(a => a.risk === currentFilter);

  grid.innerHTML = '';

  if (filtered.length === 0) {
    if (empty) empty.style.display = 'flex';
    return;
  }
  if (empty) empty.style.display = 'none';

  filtered.forEach((alert, i) => {
    const card = buildCard(alert, i);
    grid.appendChild(card);
  });

  // Animate bars after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll('.bar-fill').forEach(el => {
        el.style.width = el.dataset.width;
      });
    });
  });
}

/* ── Build a single card ── */
function buildCard(alert, index) {
  const risk       = alert.risk || 'LOW';
  const simRaw     = typeof alert.similarity === 'number' ? alert.similarity : 0;
  const simPct     = Math.round(simRaw * 100);
  const simDisplay = simPct + '%';
  const timestamp  = alert.timestamp ? formatDate(alert.timestamp) : '—';

  const riskLabel  = risk === 'HIGH' ? '🔴 HIGH RISK' : risk === 'MEDIUM' ? '🟡 MEDIUM' : '🟢 LOW';

  const card = document.createElement('div');
  card.className = `alert-card risk-${risk}`;
  card.style.animationDelay = `${index * 60}ms`;

  card.innerHTML = `
    <!-- Header -->
    <div class="alert-header">
      <div class="alert-risk-badge ${risk}">
        <div class="risk-pulse"></div>
        ${riskLabel}
      </div>
      <div class="alert-title-wrap">
        <div class="alert-title-text">Infringement Detected</div>
        <div class="alert-timestamp">${timestamp}</div>
      </div>
      <div class="alert-similarity-wrap">
        <div class="alert-similarity-pct ${risk}">${simDisplay}</div>
        <div class="alert-similarity-label">similarity</div>
      </div>
    </div>

    <!-- Detail grid -->
    <div class="alert-body">
      <div class="alert-detail">
        <span class="alert-detail-label">Alert ID</span>
        <span class="alert-detail-value">
          <code title="${alert.id}">${truncate(alert.id, 12)}</code>
          <button class="copy-btn" onclick="copyText('${alert.id}', this)" title="Copy Alert ID">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
        </span>
      </div>
      <div class="alert-detail">
        <span class="alert-detail-label">Violator</span>
        <span class="alert-detail-value">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;stroke:var(--danger)"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          ${escHtml(alert.violator_id || '—')}
          <button class="copy-btn" onclick="copyText('${alert.violator_id}', this)" title="Copy email">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
        </span>
      </div>
      <div class="alert-detail">
        <span class="alert-detail-label">Owner</span>
        <span class="alert-detail-value">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;stroke:var(--success)"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          ${escHtml(alert.owner_id || '—')}
        </span>
      </div>
      <div class="alert-detail">
        <span class="alert-detail-label">Content ID</span>
        <span class="alert-detail-value">
          <code title="${alert.content_id}">${truncate(alert.content_id, 12)}</code>
          <button class="copy-btn" onclick="copyText('${alert.content_id}', this)" title="Copy Content ID">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>
          </button>
        </span>
      </div>
      <div class="alert-detail" style="border-right:none;grid-column:span 2">
        <span class="alert-detail-label">Raw Similarity Score</span>
        <span class="alert-detail-value" style="font-family:monospace;font-size:12px;color:var(--text)">
          ${typeof alert.similarity === 'number' ? alert.similarity.toFixed(6) : '—'}
        </span>
      </div>
    </div>

    <!-- Similarity bar -->
    <div class="alert-bar-row ${risk}">
      <span class="bar-label">Match strength</span>
      <div class="bar-track">
        <div class="bar-fill" data-width="${simPct}%" style="width:0%"></div>
      </div>
      <span class="bar-pct">${simDisplay}</span>
    </div>`;

  return card;
}

/* ── Filter ── */
function filterAlerts(risk, btn) {
  currentFilter = risk;
  document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAlerts();
}

/* ── Hero stats ── */
function updateHeroStats() {
  const total  = allAlerts.length;
  const high   = allAlerts.filter(a => a.risk === 'HIGH').length;
  const medium = allAlerts.filter(a => a.risk === 'MEDIUM').length;

  animateNumber('stat-total',  total);
  animateNumber('stat-high',   high);
  animateNumber('stat-medium', medium);
}

function animateNumber(id, target) {
  const el = document.getElementById(id);
  if (!el) return;
  let current = 0;
  const step  = Math.ceil(target / 20);
  const timer = setInterval(() => {
    current = Math.min(current + step, target);
    el.textContent = current;
    if (current >= target) clearInterval(timer);
  }, 40);
}

/* ── Copy to clipboard ── */
function copyText(text, btn) {
  navigator.clipboard.writeText(text).then(() => {
    if (btn) {
      btn.classList.add('copied');
      btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20,6 9,17 4,12"/></svg>`;
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg>`;
      }, 1800);
    }
    showToast('✓ Copied to clipboard');
  });
}

/* ── Sample data (fallback when API is offline) ── */
function getSampleAlerts() {
  return [
    { id:'Q3cLWMUQIhqD5RmAWrYW', content_id:'6Fp3jibGltwvGh7hLcqi', violator_id:'priyam@gmail.com', risk:'HIGH', similarity:0.9999999999202327, timestamp:'2026-04-23T22:19:39.415477+00:00', owner_id:'john@gmail.com' },
    { id:'BAlCBqVNWYnLH6otbPhd', content_id:'LY1M6k61E0xXBBaZmx9a', violator_id:'priyam@gmail.com', risk:'HIGH', similarity:1, timestamp:'2026-04-23T22:19:39.415477+00:00', owner_id:'john@gmail.com' },
    { id:'2KLuDr3n94n0dS3W9HFG', content_id:'STykNtqV2MLBx6TIeRVH', violator_id:'priyam@gmail.com', risk:'MEDIUM', similarity:0.9259297857298237, timestamp:'2026-04-23T21:23:48.056174+00:00', owner_id:'john@gmail.com' }
  ];
}

/* ── Utils ── */
function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })
      + ' · ' + d.toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' });
  } catch { return iso; }
}
function truncate(str, n) { return str && str.length > n ? str.slice(0, n) + '…' : (str || '—'); }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2200);
}
