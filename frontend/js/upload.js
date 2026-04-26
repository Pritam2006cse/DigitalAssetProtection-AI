/* ============================================================
   upload.js — File handling, API calls, endpoint buttons
   ============================================================ */

let selectedFile = null;
let lastUploadedFilename = null;

document.addEventListener('DOMContentLoaded', () => {
  renderHistory();
  updateStats();
  const inp = document.getElementById('api-url');
  if (inp) inp.value = getApiUrl();

  const saved = sessionStorage.getItem('dap_last_filename');
  if (saved) {
    lastUploadedFilename = saved;
    document.getElementById('btn-check-status').style.display = 'flex';
    showToast(`Last upload: ${saved}`);
  }

  // ✅ ADD HERE — before the closing });
  const binCanvas = document.getElementById('bin-canvas');
  if (binCanvas) {
    const binCtx    = binCanvas.getContext('2d');
    const dashRight = document.body;
    const FONT_SIZE = 18;
    let cols = [];

    function resizeBin() {
      binCanvas.width  = window.innerWidth;
      binCanvas.height = window.innerHeight;
      initCols();
    }

    function initCols() {
      const count = Math.floor(binCanvas.width / (FONT_SIZE * 0.8));
      cols = Array.from({ length: count }, (_, i) => ({
        x:       i * FONT_SIZE  * 0.8,
        y:       Math.random() * -binCanvas.height,
        speed:   0.3 + Math.random() * 0.6,
        opacity: 0.25 + Math.random() * 0.08,
        chars:   Array.from({ length: Math.ceil(binCanvas.height / FONT_SIZE) + 4 },
                 () => Math.random() > 0.5 ? '1' : '0'),
        timer: 0,
      }));
    }

    function drawBin() {
      binCtx.clearRect(0, 0, binCanvas.width, binCanvas.height);
      binCtx.font = `400 ${FONT_SIZE}px monospace`;
      binCtx.textAlign = 'center';
      cols.forEach(col => {
        col.y += col.speed;
        if (col.y > binCanvas.height + FONT_SIZE * 4) {
          col.y = -FONT_SIZE * (4 + Math.random() * 8);
          col.speed = 0.3 + Math.random() * 0.6;
        }
        col.timer++;
        if (col.timer > 20) {
          col.chars[Math.floor(Math.random() * col.chars.length)] = Math.random() > 0.5 ? '1' : '0';
          col.timer = 0;
        }
        col.chars.forEach((ch, i) => {
          const cy = col.y + i * FONT_SIZE;
          if (cy < -FONT_SIZE || cy > binCanvas.height + FONT_SIZE) return;
          const fade = 1 - Math.abs(cy - binCanvas.height * 0.5) / (binCanvas.height * 0.55);
          binCtx.globalAlpha = Math.max(0, col.opacity * fade * 1.8);
          binCtx.fillStyle = '#4f8ef7';
          binCtx.fillText(ch, col.x, cy);
        });
      });
      binCtx.globalAlpha = 1;
      requestAnimationFrame(drawBin);
    }

    resizeBin();
    window.addEventListener('resize', resizeBin);
    drawBin();
  }
}); 

/* ── File select / drop ── */
function handleFileSelect(e) { const f = e.target.files[0]; if(f) applyFile(f); }

function handleDrop(e) {
  e.preventDefault();
  document.getElementById('drop-zone').classList.remove('active');
  const f = e.dataTransfer.files[0]; if(!f) return;
  const ext = f.name.split('.').pop().toLowerCase();
  if(!['jpg','jpeg','webp','heic','mp3','zip','pdf','ppt','pptx'].includes(ext)) { showUploadError('Please drop a JPG, JPEG, WEBP, HEIC, MP3, ZIP, PDF, or PPT file.'); return; }
  applyFile(f);
}

function applyFile(file) {
  selectedFile = file; hideUploadError();
  const imageTypes = ['jpg','jpeg','webp','heic','png'];
  const ext = file.name.split('.').pop().toLowerCase();
  const isImage = imageTypes.includes(ext);
  const previewImg = document.getElementById('preview-img');

  if (isImage) {
    const reader = new FileReader();
    reader.onload = e => { previewImg.src = e.target.result; previewImg.style.display = 'block'; };
    reader.readAsDataURL(file);
  } else {
    previewImg.style.display = 'none';
  }
  document.getElementById('preview-name').textContent = file.name;
  document.getElementById('preview-size').textContent = formatBytes(file.size);
  document.getElementById('drop-idle').style.display    = 'none';
  document.getElementById('drop-preview').style.display = 'flex';
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
  sessionStorage.removeItem('dap_last_filename');
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

    const ext = selectedFile.name.split('.').pop().toLowerCase();
    const imageExts = ['jpg','jpeg','webp','heic','png','gif'];
    const baseName = selectedFile.name.substring(0, selectedFile.name.lastIndexOf('.'));
    const safeUser = (session?.email || '').replace(/@/g, '_').replace(/\./g, '_');
    const savedFilename = imageExts.includes(ext)
      ? `${safeUser}_${baseName}_wm.png`
      : selectedFile.name;

    lastUploadedFilename = savedFilename;
    sessionStorage.setItem('dap_last_filename', savedFilename);
    // Show status button + chip
    document.getElementById('btn-check-status').style.display = 'flex';
    const chip = document.getElementById('status-chip');
    if (chip) { chip.textContent = '✓ Protected'; chip.className = 'status-chip badge badge-success'; chip.style.display = 'inline-flex'; }

    // History
    addHistoryItem({ filename:selectedFile.name, preview: data.url || "", matchCount:(data.matches||[]).length, url:data.url||'' });
    renderHistory(); updateStats();

    // Store for results page
    //sessionStorage.setItem('dap_result', JSON.stringify({ ...data, _localPreview:document.getElementById('preview-img').src, _filename:selectedFile.name }));

    /*txt.textContent = 'Done! Loading results...';
    sp.style.display = 'none'; btn.disabled = false;
    await delay(400);
    window.location.href = 'results.html';*/
    sp.style.display = 'none'; btn.disabled = false;
    txt.textContent = 'Upload & Scan for Matches';
    showToast('✅ Asset uploaded and protected!');

  } catch(err) {
    sp.style.display = 'none'; btn.disabled = false;
    txt.textContent = 'Retry Upload'; hideStatusBar();
    showUploadError(err.message || 'Upload failed. Make sure FastAPI is running.');
  }
}

/* ── GET /status/{filename} ── */
async function checkStatus() {
  if (!lastUploadedFilename) { showToast('Upload a file first'); return; }
  showToast('Checking status…');
  try {
    const res  = await authFetch(`${getApiUrl()}/status/${encodeURIComponent(lastUploadedFilename)}`);
    const data = await res.json();

    const complete = data.status === 'Complete';
    const panel = document.getElementById('response-panel');
    const ttl   = document.getElementById('response-title');
    const body  = document.getElementById('response-body');

    if (ttl) ttl.textContent = 'GET /status';
    if (body) body.innerHTML = `
      <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;
        background:${complete ? 'rgba(46,204,138,0.08)' : 'rgba(247,161,79,0.08)'};
        border:0.5px solid ${complete ? 'rgba(46,204,138,0.3)' : 'rgba(247,161,79,0.3)'};
        border-radius:8px;font-family:'DM Sans',sans-serif;white-space:normal;">
        <span style="font-size:13px;">${complete ? '✅' : '⏳'}</span>
        <div style="display:flex;flex-direction:column;gap:1px;">
          <span style="font-size:12px;font-weight:700;color:${complete ? '#2ecc8a' : '#f7a14f'};">
            ${complete ? 'Processing Complete' : 'Still Processing'}
          </span>
          <span style="font-size:10px;color:#9ca3be;">
            ${complete ? 'Your asset is protected and watermarked' : 'Please wait and check again shortly'}
          </span>
        </div>
      </div>`;
    if (panel) { panel.style.display='block'; panel.scrollIntoView({behavior:'smooth',block:'nearest'}); }
  } catch(e) { showUploadError('Status check failed: ' + e.message); }
}

/* ── GET /alerts ── */
async function callAlerts() {
  pulseBtn(event.currentTarget);
  try {
    const res  = await authFetch(`${getApiUrl()}/alerts`);
    const data = await res.json();

    const panel = document.getElementById('response-panel');
    const ttl   = document.getElementById('response-title');
    const body  = document.getElementById('response-body');

    if (ttl) ttl.textContent = 'GET /alerts';

    if (!data || data.length === 0) {
      if (body) body.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;
          background:rgba(46,204,138,0.08);border:0.5px solid rgba(46,204,138,0.3);
          border-radius:8px;font-family:'DM Sans',sans-serif;white-space:normal;">
          <span style="font-size:13px;">✅</span>
          <div style="display:flex;flex-direction:column;gap:1px;">
            <span style="font-size:12px;font-weight:700;color:#2ecc8a;">No Alerts</span>
            <span style="font-size:10px;color:#9ca3be;">No infringements detected for your assets</span>
          </div>
        </div>`;
    } else {
      const riskColor = r => r === 'HIGH' ? '#f75f5f' : r === 'MEDIUM' ? '#f7a14f' : '#4f8ef7';
      const riskBg    = r => r === 'HIGH' ? 'rgba(247,95,95,0.08)' : r === 'MEDIUM' ? 'rgba(247,161,79,0.08)' : 'rgba(79,142,247,0.08)';
      const riskBorder= r => r === 'HIGH' ? 'rgba(247,95,95,0.3)' : r === 'MEDIUM' ? 'rgba(247,161,79,0.3)' : 'rgba(79,142,247,0.3)';
      const riskIcon  = r => r === 'HIGH' ? '🔴' : r === 'MEDIUM' ? '🟡' : '🔵';

      if (body) body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;font-family:'DM Sans',sans-serif;white-space:normal;line-height:1.4;">
          ${data.map(alert => `
            <div style="border:0.5px solid ${riskBorder(alert.risk)};border-radius:8px;overflow:hidden;">
              <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;
                background:${riskBg(alert.risk)};">
                <span style="font-size:12px;">${riskIcon(alert.risk)}</span>
                <div style="flex:1;display:flex;flex-direction:column;gap:1px;">
                  <span style="font-size:11px;font-weight:700;color:${riskColor(alert.risk)};">${alert.risk} RISK — ${(alert.similarity * 100).toFixed(1)}% match</span>
                  <span style="font-size:10px;color:#9ca3be;">${new Date(alert.timestamp).toLocaleString()}</span>
                </div>
              </div>
              <div style="display:flex;flex-direction:column;gap:3px;padding:7px 10px;background:#1b1f2c;">
                <div style="display:flex;justify-content:space-between;">
                  <span style="font-size:10px;color:#5c637d;text-transform:uppercase;letter-spacing:0.05em;">Owner</span>
                  <span style="font-size:11px;color:#eef0f8;">${alert.owner_id}</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="font-size:10px;color:#5c637d;text-transform:uppercase;letter-spacing:0.05em;">Violator</span>
                  <span style="font-size:11px;color:#f75f5f;">${alert.violator_id}</span>
                </div>
                <div style="display:flex;justify-content:space-between;">
                  <span style="font-size:10px;color:#5c637d;text-transform:uppercase;letter-spacing:0.05em;">Alert ID</span>
                  <span style="font-size:10px;color:#5c637d;font-family:monospace;">${alert.id}</span>
                </div>
              </div>
            </div>`).join('')}
        </div>`;
    }
    if (panel) { panel.style.display='block'; panel.scrollIntoView({behavior:'smooth',block:'nearest'}); }
  } catch(e) { showToast('Could not reach /alerts — is the server running?'); }
}

/* ── GET /graph ── */
async function callGraph() {
  pulseBtn(event.currentTarget);
  try {
    const res  = await authFetch(`${getApiUrl()}/graph`);
    const data = await res.json();

    const panel = document.getElementById('response-panel');
    const ttl   = document.getElementById('response-title');
    const body  = document.getElementById('response-body');

    if (ttl) ttl.textContent = 'GET /graph';

    const nodes = data.nodes || [];
    const edges = data.edges || [];

    // Build a map of id → label for easy lookup
    const nodeMap = {};
    nodes.forEach(n => nodeMap[n.id] = n.label);

    // Find which nodes are copies (have a parent)
    const copiedIds = new Set(edges.map(e => e.to));
    const parentMap = {};
    edges.forEach(e => parentMap[e.to] = e.from);

    if (nodes.length === 0) {
      if (body) body.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;
          background:rgba(79,142,247,0.08);border:0.5px solid rgba(79,142,247,0.3);
          border-radius:8px;font-family:'DM Sans',sans-serif;white-space:normal;">
          <span style="font-size:13px;">📭</span>
          <div style="display:flex;flex-direction:column;gap:1px;">
            <span style="font-size:12px;font-weight:700;color:#4f8ef7;">No Assets Yet</span>
            <span style="font-size:10px;color:#9ca3be;">Upload files to see the asset graph</span>
          </div>
        </div>`;
    } else {
      if (body) body.innerHTML = `
        <div style="display:flex;flex-direction:column;gap:6px;font-family:'DM Sans',sans-serif;white-space:normal;line-height:1.4;">
          <div style="display:flex;justify-content:space-between;padding:6px 10px;
            background:#1b1f2c;border-radius:7px;margin-bottom:2px;">
            <span style="font-size:10px;color:#5c637d;text-transform:uppercase;letter-spacing:0.05em;">Total Assets</span>
            <span style="font-size:11px;color:#eef0f8;font-weight:600;">${nodes.length}</span>
          </div>
          <div style="display:flex;justify-content:space-between;padding:6px 10px;
            background:#1b1f2c;border-radius:7px;margin-bottom:4px;">
            <span style="font-size:10px;color:#5c637d;text-transform:uppercase;letter-spacing:0.05em;">Copies Detected</span>
            <span style="font-size:11px;color:#f75f5f;font-weight:600;">${copiedIds.size}</span>
          </div>
          ${nodes.map(node => {
            const isCopy = copiedIds.has(node.id);
            const parentLabel = isCopy ? nodeMap[parentMap[node.id]] || 'Unknown' : null;
            const cleanLabel = node.label
              .replace(/_wm\.png$/, '')           // remove _wm.png
              .replace(/^[^_]+_[^_]+_[^_]+_/, '') // remove user prefix like john_gmail_com_
              || node.label;
            return `
            <div style="border:0.5px solid ${isCopy ? 'rgba(247,95,95,0.3)' : 'rgba(46,204,138,0.3)'};
              border-radius:8px;overflow:hidden;">
              <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;
                background:${isCopy ? 'rgba(247,95,95,0.08)' : 'rgba(46,204,138,0.08)'};">
                <span style="font-size:12px;">${isCopy ? '📋' : '📁'}</span>
                <div style="flex:1;display:flex;flex-direction:column;gap:1px;">
                  <span style="font-size:11px;font-weight:700;color:${isCopy ? '#f75f5f' : '#2ecc8a'};">
                    ${isCopy ? 'COPY' : 'ORIGINAL'}
                  </span>
                  <span style="font-size:10px;color:#9ca3be;word-break:break-all;">${cleanLabel}</span>
                </div>
              </div>
              ${isCopy ? `
              <div style="padding:6px 10px;background:#1b1f2c;display:flex;justify-content:space-between;align-items:center;">
                <span style="font-size:10px;color:#5c637d;text-transform:uppercase;letter-spacing:0.05em;">Copied from</span>
                <span style="font-size:10px;color:#f7a14f;">${parentLabel.replace(/_wm\.png$/, '').replace(/^[^_]+_[^_]+_[^_]+_/, '') || parentLabel}</span>
              </div>` : ''}
            </div>`;
          }).join('')}
        </div>`;
    }

    if (panel) { panel.style.display='block'; panel.scrollIntoView({behavior:'smooth',block:'nearest'}); }
  } catch(e) { showToast('Could not reach /graph — is the server running?'); }
}

/* ── POST /verify-ownership ── */
async function callVerifyOwnership() {
  pulseBtn(event.currentTarget);

  // Restore from sessionStorage if variable is null
  if (!lastUploadedFilename) {
    lastUploadedFilename = sessionStorage.getItem('dap_last_filename');
  }

  if (!lastUploadedFilename) {
    showToast('Upload a file first to verify ownership');
    return;
  }

  const session = getSession();

  // ✅ Ask which file to verify — defaults to their own last uploaded file
  const filenameToVerify = prompt(
    'Enter filename to verify (leave blank to use your last uploaded file):',
    lastUploadedFilename  // ← pre-fills with their own file
  );
  if (filenameToVerify === null) return;  // user clicked cancel

  // ✅ Ask which email to claim ownership for — defaults to logged in email
  const claimedEmail = prompt(
    'Enter email to verify ownership for:',
    session?.email || ''  // ← pre-fills with their own email
  );
  if (!claimedEmail) return;

  try {
    showToast('Verifying ownership...');
    const res = await authFetch(
      `${getApiUrl()}/verify-ownership?filename=${encodeURIComponent(filenameToVerify || lastUploadedFilename)}&claimed_owner_id=${encodeURIComponent(claimedEmail)}`,
      { method: 'POST' }
    );
    // ✅ Replace with this entire block
const data = await res.json();
const confirmed = data.ownership_confirmed;
const correlation = (data.correlation * 100).toFixed(4);

const panel = document.getElementById('response-panel');
const ttl   = document.getElementById('response-title');
const body  = document.getElementById('response-body');

if (ttl) ttl.textContent = 'POST /verify-ownership';
if (body) body.innerHTML = `
  <div style="display:flex;flex-direction:column;gap:6px;font-family:'DM Sans',sans-serif;white-space:normal;line-height:1.4;">
    <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;
      background:${confirmed ? 'rgba(46,204,138,0.08)' : 'rgba(247,95,95,0.08)'};
      border:0.5px solid ${confirmed ? 'rgba(46,204,138,0.3)' : 'rgba(247,95,95,0.3)'};
      border-radius:8px;">
      <span style="font-size:13px;line-height:1;">${confirmed ? '✅' : '❌'}</span>
      <div style="display:flex;flex-direction:column;gap:1px;">
        <span style="font-size:12px;font-weight:700;color:${confirmed ? '#2ecc8a' : '#f75f5f'};">${confirmed ? 'Ownership Confirmed' : 'Ownership Not Confirmed'}</span>
        <span style="font-size:10px;color:#9ca3be;">${confirmed ? 'This file belongs to the claimed owner' : 'Does not belong to claimed owner'}</span>
      </div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 12px;background:#1b1f2c;border-radius:7px;">
      <span style="font-size:10px;color:#5c637d;text-transform:uppercase;letter-spacing:0.06em;">Claimed Owner</span>
      <span style="font-size:12px;color:#eef0f8;font-weight:500;">${data.owner_id}</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 12px;background:#1b1f2c;border-radius:7px;">
      <span style="font-size:10px;color:#5c637d;text-transform:uppercase;letter-spacing:0.06em;">Watermark Match</span>
      <span style="font-size:12px;color:#eef0f8;font-weight:500;">${correlation}%</span>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 12px;background:#1b1f2c;border-radius:7px;">
      <span style="font-size:10px;color:#5c637d;text-transform:uppercase;letter-spacing:0.06em;">Verdict</span>
      <span style="font-size:12px;font-weight:700;color:${confirmed ? '#2ecc8a' : '#f75f5f'};">${confirmed ? '✓ VERIFIED' : '✗ REJECTED'}</span>
    </div>
  </div>`;

  if (panel) {
    panel.style.display = 'block';
    panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
  }
  } catch(e) {
    console.error(e);
    showToast('Could not reach /verify-ownership');
  }
}
///*comment*
// Add this function back in upload.js — place it before callSendTakedown
async function callTakedownGenerate() {
  pulseBtn(event.currentTarget);
  const alertId = prompt('Enter Alert ID (copy from View Alerts response):');
  if (!alertId) return;
  try {
    const res  = await authFetch(`${getApiUrl()}/generate-takedown?alert_id=${encodeURIComponent(alertId)}`, { method:'POST' });
    const data = await res.json();

    // ✅ Render as proper card instead of JSON
    const panel = document.getElementById('response-panel');
    const ttl   = document.getElementById('response-title');
    const body  = document.getElementById('response-body');

    if (ttl) ttl.textContent = 'POST /generate-takedown';
    if (body) body.innerHTML = data.error ? `
      <div style="padding:10px 12px;background:rgba(247,95,95,0.08);border:0.5px solid rgba(247,95,95,0.3);border-radius:8px;font-size:12px;color:#f75f5f;">
        ❌ ${data.error}
      </div>` : `
      <div style="display:flex;flex-direction:column;gap:6px;font-family:'DM Sans',sans-serif;white-space:normal;line-height:1.4;">
        <div style="display:flex;align-items:center;gap:8px;padding:8px 10px;
          background:rgba(79,142,247,0.08);border:0.5px solid rgba(79,142,247,0.3);border-radius:8px;">
          <span style="font-size:13px;">📄</span>
          <div style="display:flex;flex-direction:column;gap:1px;">
            <span style="font-size:12px;font-weight:700;color:#4f8ef7;">Takedown Notice Generated</span>
            <span style="font-size:10px;color:#9ca3be;">Ready to send to violator</span>
          </div>
        </div>
        <div style="padding:10px 12px;background:#1b1f2c;border-radius:7px;
          font-size:11px;color:#9ca3be;line-height:1.8;white-space:pre-wrap;font-family:monospace;">
${data.notice.trim()}
        </div>
      </div>`;

    if (panel) {
      panel.style.display = 'block';
      panel.scrollIntoView({ behavior:'smooth', block:'nearest' });
    }

  } catch(e) { showToast('Could not reach /generate-takedown'); }
}

/* ── POST /send-takedown ── */
async function callSendTakedown() {
  pulseBtn(event.currentTarget);
  const alertId = prompt('Enter Alert ID (copy from View Alerts response):');
  if (!alertId) return;
  const toEmail = prompt('Enter the violator email to send takedown to:');
  if (!toEmail) return;
  try {
    const res  = await authFetch(
      `${getApiUrl()}/send-takedown?alert_id=${encodeURIComponent(alertId)}&to_email=${encodeURIComponent(toEmail)}`,
      { method:'POST' }
    );
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
  if (body) {
    body.innerHTML = '';  // clear previous content
    body.textContent = JSON.stringify(data, null, 2);
  }
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
  const p = h.filter(i=>i.matchCount===0).length;
  const t = document.getElementById('stat-total');
  const pr= document.getElementById('stat-protected');
  if(t) t.textContent=h.length; if(pr) pr.textContent=p;
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
