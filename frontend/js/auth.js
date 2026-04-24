/* ============================================================
   auth.js — Login, Register, Session, History helpers
   ============================================================ */

const SESSION_KEY = 'dap_session';
const HISTORY_KEY = 'dap_history';
const API_KEY     = 'dap_api_url';

/* ── Session ── */
function saveSession(user) { sessionStorage.setItem(SESSION_KEY, JSON.stringify(user)); }
function getSession()      { try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch { return null; } }
function clearSession()    { sessionStorage.removeItem(SESSION_KEY); sessionStorage.removeItem('dap_result'); }

/* ── History (persists in localStorage) ── */
function getHistory()       { try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { return []; } }
function saveHistory(arr)   { localStorage.setItem(HISTORY_KEY, JSON.stringify(arr)); }
function addHistoryItem(it) { const a = getHistory(); a.unshift({...it, time:new Date().toISOString()}); saveHistory(a.slice(0,50)); }
function clearHistory()     { localStorage.removeItem(HISTORY_KEY); }

/* ── API URL helper ── */
function getApiUrl()       { return (localStorage.getItem(API_KEY) || 'http://localhost:8000').replace(/\/$/,''); }
function saveApiUrl(url)   { localStorage.setItem(API_KEY, url); }

/* ── Auth guard ── */
function requireAuth() {
  const user = getSession();
  if (!user) { window.location.href = isOnSubPage() ? '../index.html' : 'index.html'; return null; }
  return user;
}
function isOnSubPage() { return window.location.pathname.includes('/pages/'); }

/* ── Populate UI ── */
function populateUserUI(user) {
  if (!user) return;
  const initials = user.name.split(' ').map(w=>w[0]).join('').toUpperCase().slice(0,2);
  ['user-avatar','profile-avatar'].forEach(id => { const e=document.getElementById(id); if(e) e.textContent=initials; });
  ['user-name','profile-name'].forEach(id   => { const e=document.getElementById(id); if(e) e.textContent=user.name; });
  ['user-email','profile-email'].forEach(id => { const e=document.getElementById(id); if(e) e.textContent=user.email; });
}

function logout() { clearSession(); window.location.href = isOnSubPage() ? '../index.html' : 'index.html'; }

/* Auto-guard on protected pages */
(function initPage() {
  if (window.location.pathname.endsWith('index.html') ||
      window.location.pathname === '/' ||
      window.location.pathname.endsWith('/')) return;
  const user = requireAuth();
  if (user) {
    populateUserUI(user);
    /* restore saved API URL */
    const apiInput = document.getElementById('api-url');
    if (apiInput) apiInput.value = getApiUrl();
  }
})();


/* ================================================================
   TAB SWITCHING
   ================================================================ */
function switchTab(tab) {
  const loginForm = document.getElementById('form-login');
  const regForm   = document.getElementById('form-register');
  const tabLogin  = document.getElementById('tab-login');
  const tabReg    = document.getElementById('tab-register');
  const indicator = document.getElementById('tab-indicator');

  clearErrors();
  if (tab === 'login') {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    tabLogin.classList.add('active');
    tabReg.classList.remove('active');
    indicator.classList.remove('right');
  } else {
    regForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
    tabReg.classList.add('active');
    tabLogin.classList.remove('active');
    indicator.classList.add('right');
  }
}

function clearErrors() {
  ['login-error','reg-error','reg-success'].forEach(id => {
    const e = document.getElementById(id); if(e) { e.textContent=''; e.style.display='none'; }
  });
}

/* ── Show/hide password ── */
function togglePwd(inputId, btn) {
  const inp = document.getElementById(inputId);
  if (!inp) return;
  const show = inp.type === 'password';
  inp.type = show ? 'text' : 'password';
  btn.innerHTML = show
    ? `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
}

/* ── Password strength ── */
document.addEventListener('DOMContentLoaded', () => {
  const pwd = document.getElementById('reg-password');
  if (!pwd) return;
  pwd.addEventListener('input', () => {
    const v = pwd.value;
    const fill  = document.getElementById('strength-fill');
    const label = document.getElementById('strength-label');
    if (!fill) return;
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    const pct   = ['0%','25%','50%','75%','100%'][score];
    const color = ['','#f75f5f','#f7a14f','#4f8ef7','#2ecc8a'][score];
    const word  = ['','Weak','Fair','Good','Strong'][score];
    fill.style.width = pct; fill.style.background = color;
    if (label) { label.textContent = v.length ? word : ''; label.style.color = color; }
  });
});

/* ── Show error on an input ── */
function showInputError(inputId, msg, errId) {
  const inp = document.getElementById(inputId);
  const err = document.getElementById(errId);
  if (inp) { inp.classList.add('err'); setTimeout(()=>inp.classList.remove('err'),600); }
  if (err) { err.textContent = msg; err.style.display = 'block'; }
}


/* ================================================================
   LOGIN  — POST /token  (OAuth2 form)
   ================================================================ */
async function handleLogin(event) {
  event.preventDefault();
  clearErrors();

  const name     = document.getElementById('login-name').value.trim();
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const btn      = document.getElementById('login-btn');

  if (!name)     { showInputError('login-name','Please enter your full name.','login-error'); return; }
  if (!email)    { showInputError('login-email','Please enter your email.','login-error'); return; }
  if (!password) { showInputError('login-password','Please enter your password.','login-error'); return; }

  setLoading(btn, true);

  try {
    const body = new URLSearchParams({ username: email, password });
    const res  = await fetch(`${getApiUrl()}/token`, { method:'POST', body });
    const data = await res.json();

    if (!res.ok) {
      const msg = data.detail || 'Incorrect email or password.';
      showInputError('login-password', msg, 'login-error');
      shakeCard();
      return;
    }

    saveSession({ name, email, token: data.access_token });
    window.location.href = 'pages/upload.html';

  } catch (err) {
    showInputError('login-email', 'Could not reach the server. Check your API URL.', 'login-error');
  } finally {
    setLoading(btn, false);
  }
}


/* ================================================================
   REGISTER  — POST /register
   ================================================================ */
async function handleRegister(event) {
  event.preventDefault();
  clearErrors();

  const name     = document.getElementById('reg-name').value.trim();
  const email    = document.getElementById('reg-email').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm  = document.getElementById('reg-confirm').value;
  const btn      = document.getElementById('reg-btn');
  const succ     = document.getElementById('reg-success');

  if (!name)               { showInputError('reg-name','Please enter your name.','reg-error'); return; }
  if (!email)              { showInputError('reg-email','Please enter your email.','reg-error'); return; }
  if (password.length < 6) { showInputError('reg-password','Password must be at least 6 characters.','reg-error'); return; }
  if (password !== confirm){ showInputError('reg-confirm','Passwords do not match.','reg-error'); return; }

  setLoading(btn, true);

  try {
    const res  = await fetch(`${getApiUrl()}/register`, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({ name, email, password })
    });
    const data = await res.json();

    if (!res.ok) {
      const msg = data.detail || 'Registration failed. Try again.';
      showInputError('reg-email', msg, 'reg-error');
      shakeCard(); return;
    }

    if (succ) { succ.textContent = '✓ Account created! You can now sign in.'; succ.style.display='block'; }
    setTimeout(() => switchTab('login'), 1800);

  } catch {
    showInputError('reg-email','Could not reach the server. Check your API URL.','reg-error');
  } finally {
    setLoading(btn, false);
  }
}


/* ── UI helpers ── */
function setLoading(btn, on) {
  if (!btn) return;
  btn.disabled = on;
  const sp = btn.querySelector('.btn-spinner');
  const tx = btn.querySelector('.btn-text');
  const ar = btn.querySelector('.btn-arrow');
  if (sp) sp.style.display = on ? 'block' : 'none';
  if (tx) tx.style.opacity = on ? '0.4' : '1';
  if (ar) ar.style.display = on ? 'none' : 'block';
}

function shakeCard() {
  const card = document.querySelector('.login-card');
  if (!card) return;
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = 'card-shake 0.4s ease';
}

/* Add card-shake to CSS dynamically */
const s = document.createElement('style');
s.textContent = `@keyframes card-shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-8px)}40%{transform:translateX(8px)}60%{transform:translateX(-5px)}80%{transform:translateX(5px)}}`;
document.head.appendChild(s);
