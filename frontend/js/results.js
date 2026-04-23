/* ============================================================
   results.js — Reads stored API response, renders match cards
   ============================================================ */

document.addEventListener('DOMContentLoaded', function () {
  const raw = sessionStorage.getItem('dap_result');
  if (!raw) {
    // No result in session — redirect back to upload
    window.location.href = 'upload.html';
    return;
  }

  let data;
  try { data = JSON.parse(raw); }
  catch { window.location.href = 'upload.html'; return; }

  renderOrigin(data);
  renderMatches(data.matches || []);
  renderSummary(data.matches || []);
});

/* ── Origin asset card ── */
function renderOrigin(data) {
  const thumb = document.getElementById('origin-thumb');
  const fname = document.getElementById('origin-filename');
  const urlEl = document.getElementById('origin-url');
  const dnaEl = document.getElementById('origin-dna');

  if (thumb) thumb.src = data._localPreview || data.url || '';
  if (fname) fname.textContent = data._filename || 'Uploaded asset';
  if (urlEl) {
    urlEl.textContent = data.url || 'Not available';
    urlEl.href = data.url || '#';
  }
  if (dnaEl) dnaEl.textContent = data.dna_length ? `${data.dna_length} dimensions` : '—';

  const statusEl = document.getElementById('origin-status');
  if (statusEl) {
    statusEl.textContent = data.status || 'Asset Protected';
  }
}

/* ── Summary stats ── */
function renderSummary(matches) {
  const total = matches.length;
  const scores = matches.map(m => extractScore(m)).filter(s => s !== null);
  const highCount = scores.filter(s => s >= 80).length;
  const topScore  = scores.length > 0 ? Math.max(...scores) : null;

  const statTotal = document.querySelector('#stat-total .stat-num');
  const statHigh  = document.querySelector('#stat-high .stat-num');
  const statTop   = document.querySelector('#stat-top .stat-num');

  if (statTotal) statTotal.textContent = total;
  if (statHigh)  statHigh.textContent  = highCount;
  if (statTop)   statTop.textContent   = topScore !== null ? `${topScore}%` : '—';

  // Page title
  const titleEl = document.getElementById('results-title');
  const descEl  = document.getElementById('results-desc');
  if (titleEl) titleEl.textContent = total > 0 ? 'Matches Detected' : 'No Matches Found';
  if (descEl)  descEl.textContent  = total > 0
    ? `Found ${total} match${total > 1 ? 'es' : ''} in the protected database`
    : 'Your asset appears to be original';
}

/* ── Match list ── */
function renderMatches(matches) {
  const listEl = document.getElementById('match-list');
  const noMatchEl = document.getElementById('no-matches-card');

  if (!matches || matches.length === 0) {
    if (listEl)    listEl.style.display    = 'none';
    if (noMatchEl) noMatchEl.style.display = 'block';
    return;
  }

  if (noMatchEl) noMatchEl.style.display = 'none';
  if (!listEl) return;

  listEl.innerHTML = '';

  matches.forEach((match, index) => {
    const score    = extractScore(match);
    const pctValue = score !== null ? score : null;
    const pctText  = pctValue !== null ? `${pctValue}%` : '—';
    const pctClass = pctValue === null ? 'low' : pctValue >= 80 ? 'high' : pctValue >= 50 ? 'mid' : 'low';
    const barWidth = pctValue !== null ? pctValue : 0;

    const filename = match.file_id || match.filename || match.name || `Match ${index + 1}`;
    const url      = match.url || '';
    const rankClass = index === 0 ? 'rank-1' : index === 1 ? 'rank-2' : '';

    // Placeholder thumbnail SVG
    const placeholderSrc = `data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' width='60' height='60'><rect width='60' height='60' fill='%231b1f2c'/><text x='50%25' y='50%25' font-size='20' text-anchor='middle' dominant-baseline='middle' fill='%235c637d'>?</text></svg>`;

    const card = document.createElement('div');
    card.className = 'match-card';
    card.style.animationDelay = `${index * 60}ms`;
    card.innerHTML = `
      <div class="match-rank ${rankClass}">#${index + 1}</div>
      <div class="match-thumb">
        <img
          src="${url || placeholderSrc}"
          onerror="this.src='${placeholderSrc}'"
          alt="${filename}"
        />
      </div>
      <div class="match-body">
        <div class="match-filename">${escapeHtml(filename)}</div>
        ${url ? `<div class="match-url">${escapeHtml(url)}</div>` : ''}
        <div class="match-bar-track">
          <div class="match-bar-fill" style="width: 0%" data-target="${barWidth}"></div>
        </div>
      </div>
      <div class="match-score-wrap">
        <div class="match-pct ${pctClass}">${pctText}</div>
        <div class="score-label">similarity</div>
      </div>`;

    listEl.appendChild(card);
  });

  // Animate bars after a frame
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.querySelectorAll('.match-bar-fill').forEach(el => {
        el.style.width = `${el.dataset.target}%`;
      });
    });
  });
}

/* ── Helpers ── */

/**
 * Extract a 0–100 score from a match object.
 * The FastAPI find_matches() may return score as 0–1 float or 0–100.
 */
function extractScore(match) {
  let raw = match.score ?? match.similarity ?? match.match_score ?? null;
  if (raw === null) return null;
  // Normalise: if ≤ 1.0 treat as fraction, else already percentage
  const pct = raw <= 1.0 ? Math.round(raw * 100) : Math.round(raw);
  return Math.min(100, Math.max(0, pct));
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
