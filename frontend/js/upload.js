/* ============================================================
   upload.js — File handling, API calls, endpoint buttons
   ============================================================ */

let selectedFile = null;
let lastUploadedFilename = null;

document.addEventListener('DOMContentLoaded', () => {
  renderHistory();
  updateStats();
  // Sync API url input from storage
  const inp = document.getElementById('api-url');
  if (inp) inp.value = getApiUrl();
});

/* ── File select / drop ── */
function handleFileSelect(e) { const f = e.target.files[0]; if(f) applyFile(f); }

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('active');
  const f = e.dataTransfer.files[0]; if(!f) return;
  const ext = f.name.split('.').pop().toLowerCase();
  if(!['jpg','jpeg','png','webp','heic','mp4','mov','avi','pdf','docx','txt'].includes(ext)) { showUploadError('Please drop a JPG, JPEG, WEBP, HEIC, PNG, MP4, PDF, DOCS, TXT file.'); return; }
  applyFile(f);
}

function applyFile(file) {
  selectedFile = file; hideUploadError();
  const reader = new FileReader();
  reader.onload = e => {
    document.getElementById('preview-img').src = e.target.result;
    document.getElementById('preview-name').textContent = file.name;
    document.getElementById('preview-size').textContent = formatBytes(file.size);
    document.getElementById('drop-idle').style.display    = 'none';
    document.getElementById('drop-preview').style.display = 'flex';
  };
  reader.readAsDataURL(file);
  document.getElementById('upload-btn').disabled = false;
  document.getElementById('upload-btn-text').textContent = 'Upload & Scan for Matches';
  document.getElementById('btn-clear-upload').style.display = 'flex';
  document.getElementById('btn-check-status').style.display = 'none';
  document.getElementById('response-panel').style.display   = 'none';
  const chip = document.getElementById('status-chip');
  if(chip) chip.style.display = 'none';
}

function clearFile() {
  selectedFile = null; lastUploadedFilename = null;
  document.getElementById('file-input').value = '';
  document.getElementById('drop-idle').style.display    = 'flex';
  document.getElementById('drop-preview').style.display = 'none';
  document.getElementById('upload-btn').disabled = true;
  document.getElementById('upload-btn-text').textContent = 'Select an image first';
  document.getElementById('btn-clear-upload').style.display  = 'none';
  document.getElementById('btn-check-status').style.display  = 'none';
  document.getElementById('upload-spinner').style.display    = 'none';
  document.getElementById('response-panel').style.display    = 'none';
  hideStatusBar(); hideUploadError();
}

/* ── Upload ── */
async function doUpload() {
  if (!selectedFile) return;
  const btn = document.getElementById('upload-btn');
  const sp  = document.getElementById('upload-spinner');
  const txt = document.getElementById('upload-btn-text');

  btn.disabled = true; sp.style.display = 'block'; txt.textContent = 'Uploading...';
  hideUploadError(); showStatusBar(); setStep(1,'active');

  const fd = new FormData();
  fd.append('file', selectedFile);

  // Attach JWT if available
  const session = getSession();
  const headers = {};
  if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;

  try {
    const res = await fetch(`${getApiUrl()}/upload`, { method:'POST', headers, body:fd });
    if (!res.ok) { const t = await res.text(); throw new Error(`Server ${res.status}: ${t}`); }

    setStep(1,'done'); setStep(2,'active');
    await delay(300); setStep(2,'done'); setStep(3,'active');
    const data = await res.json();
    setStep(3,'done');

    lastUploadedFilename = selectedFile.name;

    // Show status button + chip
    document.getElementById('btn-check-status').style.display = 'flex';
    const chip = document.getElementById('status-chip');
    if (chip) { chip.textContent = '✓ Protected'; chip.className = 'status-chip badge badge-success'; chip.style.display = 'inline-flex'; }

    // History
    addHistoryItem({ filename:selectedFile.name, preview:document.getElementById('preview-img').src, matchCount:(data.matches||[]).length, url:data.url||'' });
    renderHistory(); updateStats();

    // Store for results page
    sessionStorage.setItem('dap_result', JSON.stringify({ ...data, _localPreview:document.getElementById('preview-img').src, _filename:selectedFile.name }));

    txt.textContent = 'Done! Loading results...';
    sp.style.display = 'none'; btn.disabled = false;
    await delay(400);
    window.location.href = 'results.html';

  } catch(err) {
    sp.style.display = 'none'; btn.disabled = false;
    txt.textContent = 'Retry Upload'; hideStatusBar();
    showUploadError(err.message || 'Upload failed. Make sure FastAPI is running.');
  }
}

/* ── GET /status/{filename} ── */
async function checkStatus() {
  if (!lastUploadedFilename) { showToast('Upload an image first'); return; }
  showToast('Checking status…');
  try {
    const res  = await authFetch(`${getApiUrl()}/status/${encodeURIComponent(lastUploadedFilename)}`);
    const data = await res.json();
    showResponse('GET /status/' + lastUploadedFilename, data);
  } catch(e) { showUploadError('Status check failed: ' + e.message); }
}

/* ── GET /alerts ── */
async function callAlerts() {
  pulseBtn(event.currentTarget);
  try {
    const res  = await authFetch(`${getApiUrl()}/alerts`);
    const data = await res.json();
    showResponse('GET /alerts', data);
  } catch(e) { showToast('Could not reach /alerts — is the server running?'); }
}

/* ── GET /graph ── */
async function callGraph() {
  pulseBtn(event.currentTarget);
  try {
    const res  = await authFetch(`${getApiUrl()}/graph`);
    const data = await res.json();
    showResponse('GET /graph', data);
  } catch(e) { showToast('Could not reach /graph — is the server running?'); }
}

/* ── POST /verify-ownership ── */
async function callVerifyOwnership() {
  pulseBtn(event.currentTarget);
  if (!selectedFile) { showToast('Upload an image first to verify ownership'); return; }
  const fd = new FormData();
  fd.append('file', selectedFile);
  fd.append('claimed_owner_id', getSession()?.email || '');
  try {
    const res  = await authFetch(`${getApiUrl()}/verify-ownership`, { method:'POST', body: fd });
    const data = await res.json();
    showResponse('POST /verify-ownership', data);
  } catch(e) { showToast('Could not reach /verify-ownership'); }
}

/* ── POST /generate-takedown ── */
async function callTakedownGenerate() {
  pulseBtn(event.currentTarget);
  const alertId = prompt('Enter Alert ID (get from View Alerts):');
  if (!alertId) return;
  try {
    const res  = await authFetch(`${getApiUrl()}/generate-takedown?alert_id=${alertId}`, { method:'POST' });
    const data = await res.json();
    showResponse('POST /generate-takedown', data);
  } catch(e) { showToast('Could not reach /generate-takedown'); }
}

/* ── POST /send-takedown ── */
async function callSendTakedown() {
  pulseBtn(event.currentTarget);
  const alertId = prompt('Enter Alert ID:');
  const toEmail = prompt('Enter recipient email:');
  if (!alertId || !toEmail) return;
  try {
    const res  = await authFetch(`${getApiUrl()}/send-takedown?alert_id=${alertId}&to_email=${toEmail}`, { method:'POST' });
    const data = await res.json();
    showResponse('POST /send-takedown', data);
    showToast('📧 Takedown email sent!');
  } catch(e) { showToast('Could not reach /send-takedown'); }
}

/* ── Helpers ── */
async function authFetch(url, opts={}) {
  const session = getSession();
  const headers = { ...(opts.headers||{}) };
  if (session?.token) headers['Authorization'] = `Bearer ${session.token}`;
  return fetch(url, { ...opts, headers });
}

function showResponse(title, data) {
  const panel = document.getElementById('response-panel');
  const ttl   = document.getElementById('response-title');
  const body  = document.getElementById('response-body');
  if (ttl)   ttl.textContent  = title;
  if (body)  body.textContent = JSON.stringify(data, null, 2);
  if (panel) { panel.style.display='block'; panel.scrollIntoView({behavior:'smooth',block:'nearest'}); }
}

function pulseBtn(btn) {
  if (!btn) return;
  btn.style.transform = 'scale(0.96)';
  setTimeout(() => btn.style.transform = '', 150);
}

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg; t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2800);
}

/* History */
function renderHistory() {
  const list = document.getElementById('history-list');
  const empty = document.getElementById('history-empty');
  const history = getHistory();
  if (!list) return;
  Array.from(list.querySelectorAll('.history-item')).forEach(e=>e.remove());
  if (history.length === 0) { if(empty) empty.style.display='flex'; return; }
  if (empty) empty.style.display = 'none';
  history.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    const hasMatch = item.matchCount > 0;
    div.innerHTML = `
      <div class="history-thumb"><img src="${item.preview||''}" onerror="this.style.display='none'" alt=""/></div>
      <div class="history-meta">
        <div class="history-fname">${escHtml(item.filename)}</div>
        <div class="history-time">${timeAgo(new Date(item.time))}</div>
      </div>
      <span class="history-badge ${hasMatch?'hb-match':'hb-clean'}">${hasMatch?item.matchCount+' match'+(item.matchCount>1?'es':''):'Clean'}</span>`;
    list.appendChild(div);
  });
}

function updateStats() {
  const h = getHistory();
  const m = h.reduce((s,i)=>s+(i.matchCount||0),0);
  const p = h.filter(i=>i.matchCount===0).length;
  const t = document.getElementById('stat-total');
  const ma= document.getElementById('stat-matches');
  const pr= document.getElementById('stat-protected');
  if(t) t.textContent=h.length; if(ma) ma.textContent=m; if(pr) pr.textContent=p;
}

function resetHistory() {
  if (!confirm('Clear all upload history?')) return;
  clearHistory(); renderHistory(); updateStats();
}

/* Steps */
function showStatusBar() {
  const el = document.getElementById('status-bar'); if(el) el.style.display='flex';
  [1,2,3].forEach(n => { const d=document.querySelector(`#step-${n} .step-dot`); if(d) d.className='step-dot'; });
}
function hideStatusBar() { const el=document.getElementById('status-bar'); if(el) el.style.display='none'; }
function setStep(n,s)    { const d=document.querySelector(`#step-${n} .step-dot`); if(d) d.className=`step-dot ${s}`; }
function showUploadError(msg) { const e=document.getElementById('error-card'),t=document.getElementById('error-text'); if(t)t.textContent=msg; if(e)e.style.display='flex'; }
function hideUploadError()    { const e=document.getElementById('error-card'); if(e)e.style.display='none'; }

/* Utils */
function formatBytes(b) { if(b<1024)return b+' B'; if(b<1048576)return(b/1024).toFixed(1)+' KB'; return(b/1048576).toFixed(1)+' MB'; }
function delay(ms)       { return new Promise(r=>setTimeout(r,ms)); }
function escHtml(s)      { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function timeAgo(d)      { const s=Math.floor((Date.now()-d)/1000); if(s<60)return 'just now'; if(s<3600)return Math.floor(s/60)+'m ago'; if(s<86400)return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'; }
