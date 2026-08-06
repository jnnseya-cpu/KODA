/* KODA merchant OS — SPA. Vanilla JS, hash-routed, i18n auto-detected. */
'use strict';

/* ---------------- i18n — device language auto-detection ---------------- */
const I18N = {
  fr: {
    dashboard: 'Tableau de bord', verify: 'Vérifier', feed: 'Flux des paiements', receipts: 'Reçus',
    disputes: 'Litiges', devices: 'Appareils Sentinel', billing: 'Facturation & ACU', team: 'Équipe',
    developers: 'Développeurs', comms: 'Communications', submerchants: 'Sous-marchands', settings: 'Paramètres',
    admin: 'Centre de contrôle', logout: 'Déconnexion', signin: 'Connexion', signup: 'Créer un compte',
    verify_title: 'Console de vérification', verify_hint: 'Collez le code de transaction du client — verdict ancré sur le SMS opérateur en ~3 secondes.',
    vmeans_t: 'Ce que « vérifié » veut dire (et ne veut pas dire)',
    vmeans_y: 'Vérifié = le SMS de confirmation de l’opérateur est bien arrivé sur votre téléphone, le code correspond (montant, référence, fenêtre), il n’a jamais servi, et il a passé les contrôles anti-fraude.',
    vmeans_n: 'Cela ne garantit pas que l’opérateur ne puisse pas annuler le paiement plus tard. KODA ne détient jamais votre argent — il arrive directement sur votre compte mobile money. Pour un gros montant ou un cas inhabituel, utilisez « à contrôler » avant de livrer.',
    verify_btn: 'Vérifier le paiement', verified: 'PAIEMENT VÉRIFIÉ', rejected: 'REJETÉ', pending: 'À CONTRÔLER',
    not_found: 'Pas encore trouvé — on surveille la fenêtre', amount: 'Montant', reference: 'Code de transaction',
    today: "aujourd'hui", month: 'ce mois', unmatched: 'paiements non rattachés', open_disputes: 'litiges ouverts',
    acu_balance: 'solde ACU', topup: 'Recharger', welcome: 'Bonjour', expected_amount: 'Montant attendu (optionnel)',
    live: 'EN DIRECT', quarantined: 'QUARANTAINE', enroll_device: 'Enrôler un appareil', revoke: 'Révoquer',
    invite: 'Inviter', create_key: 'Créer une clé', add_webhook: 'Ajouter un webhook', test: 'Tester',
    preview: 'Aperçu', send_test: "M'envoyer un test", mark_read: 'Tout marquer lu', save: 'Enregistrer',
    plan: 'Formule', change_plan: 'Changer de formule', language: 'Langue', auto: 'Auto (appareil)',
    growth: 'Moteur de croissance', generate: 'Générer', growth_sub: 'Outils marketing IA — développe ta portée et tes partenaires',
    forgot_pw: 'Mot de passe oublié ?', forgot_sub: 'Entrez votre e-mail — nous vous enverrons un lien de réinitialisation.',
    send_reset: 'Envoyer le lien', reset_pw: 'Réinitialiser le mot de passe',
    reset_sub: 'Choisissez un nouveau mot de passe pour votre compte KODA.',
    reset_done: 'Mot de passe mis à jour. Redirection vers la connexion…',
    accounts: 'Comptes de paiement', redeem_voucher: 'Utiliser un bon', kd_console: 'Console distributeur',
  },
  en: {
    dashboard: 'Dashboard', verify: 'Verify', feed: 'Live payments feed', receipts: 'Receipts',
    disputes: 'Disputes', devices: 'Sentinel devices', billing: 'Billing & ACU', team: 'Team',
    developers: 'Developers', comms: 'Communications', submerchants: 'Sub-merchants', settings: 'Settings',
    admin: 'Control centre', logout: 'Sign out', signin: 'Sign in', signup: 'Create account',
    verify_title: 'Verify Console', verify_hint: "Paste the customer's transaction code — operator-SMS-anchored verdict in ~3 seconds.",
    vmeans_t: 'What "verified" means (and doesn\'t)',
    vmeans_y: "Verified = the operator's own confirmation SMS reached your phone, the code matches (amount, reference, window), it has never been used, and it passed the fraud checks.",
    vmeans_n: 'It does not guarantee the operator can\'t reverse the payment later. KODA never holds your money — it goes straight to your mobile-money account. For a large or unusual payment, use "needs review" before releasing goods.',
    verify_btn: 'Verify payment', verified: 'PAYMENT VERIFIED', rejected: 'REJECTED', pending: 'NEEDS REVIEW',
    not_found: 'Not found yet — watching the window', amount: 'Amount', reference: 'Transaction code',
    today: 'today', month: 'this month', unmatched: 'unmatched payments', open_disputes: 'open disputes',
    acu_balance: 'ACU balance', topup: 'Top up', welcome: 'Hello', expected_amount: 'Expected amount (optional)',
    live: 'LIVE', quarantined: 'QUARANTINED', enroll_device: 'Enroll a device', revoke: 'Revoke',
    invite: 'Invite', create_key: 'Create key', add_webhook: 'Add webhook', test: 'Test',
    preview: 'Preview', send_test: 'Send test to me', mark_read: 'Mark all read', save: 'Save',
    plan: 'Plan', change_plan: 'Change plan', language: 'Language', auto: 'Auto (device)',
    growth: 'AI Growth Engine', generate: 'Generate', growth_sub: 'AI marketing tools — maximise your reach and partners',
    forgot_pw: 'Forgot password?', forgot_sub: 'Enter your email — we\'ll send you a reset link.',
    send_reset: 'Send reset link', reset_pw: 'Reset password',
    reset_sub: 'Choose a new password for your KODA account.',
    reset_done: 'Password updated. Redirecting to sign in…',
    accounts: 'Payment methods', redeem_voucher: 'Redeem voucher', kd_console: 'Distributor console',
  },
};
let LANG = localStorage.getItem('koda_lang') || '';
function lang() { return LANG || ((navigator.language || 'fr').slice(0, 2) === 'en' ? 'en' : 'fr'); }
const t = (k) => (I18N[lang()] && I18N[lang()][k]) || I18N.en[k] || k;

/* ---------------- api client ---------------- */
const TOKEN = () => localStorage.getItem('koda_token');
async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { 'content-type': 'application/json', ...(TOKEN() ? { authorization: `Bearer ${TOKEN()}` } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error?.code || data.error || res.status), { data, status: res.status });
  return data;
}
function toast(msg, ms = 3200) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), ms);
}
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString(lang() === 'fr' ? 'fr-FR' : 'en-US');
// ACU balance display: admin-owned accounts are unlimited → show ∞
const acuFmt = (n) => (ME && ME.acu_unlimited) ? '∞' : fmt(n);
const when = (s) => s ? new Date(s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z')).toLocaleString(lang() === 'fr' ? 'fr-FR' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

/* ---------------- state + router ---------------- */
let ME = null;
const root = document.getElementById('root');

async function boot() {
  if (TOKEN()) { try { ME = await api('/app/me'); } catch { localStorage.removeItem('koda_token'); } }
  route();
}
window.addEventListener('hashchange', route);

const ROLE_VIEWS = {
  cashier: ['dashboard', 'verify', 'feed', 'receipts', 'receipt', 'comms', 'settings'],
  manager: ['dashboard', 'verify', 'feed', 'receipts', 'receipt', 'disputes', 'accounts', 'devices', 'comms', 'settings'],
};
const GROWTH_TOOLS = [
  ['social_post', '📱', 'Social media post'], ['advert', '📢', 'Advert creator'],
  ['email_campaign', '✉️', 'Email campaign'], ['landing_page', '🖥️', 'Landing page builder'],
  ['hashtags', '#️⃣', 'Hashtag generator'], ['video_script', '🎬', 'Video script'],
  ['recommendations', '💡', 'Performance recommendations'], ['audience', '🎯', 'Audience optimisation'],
  ['analytics', '📊', 'Campaign analytics'], ['posting_time', '⏰', 'Best posting time'],
];
function route() {
  const hash = location.hash.replace(/^#\/?/, '') || (ME ? 'dashboard' : 'login');
  if (!ME && !['login', 'signup', 'forgot', 'reset'].includes(hash.split('?')[0])) { location.hash = '#login'; return; }
  const [view, qs] = hash.split('?');
  // staff-admin with no merchant of their own: oversight only — keep them on the control centre
  if (ME && ME.user.is_admin && !ME.merchant && view !== 'admin') {
    location.hash = '#admin'; return;
  }
  if (ME && !ME.user.is_admin && ROLE_VIEWS[ME.user.role] && !ROLE_VIEWS[ME.user.role].includes(view)) {
    location.hash = '#dashboard'; return;
  }
  const params = new URLSearchParams(qs || '');
  const fn = VIEWS[view] || VIEWS.dashboard;
  if (!ME) { (VIEWS[view] || VIEWS.login)(params); return; }
  fn(params);
}

/* ---------------- shell ---------------- */
function shell(active, title, sub, content) {
  const m = ME.merchant, u = ME.user;
  const isPlatform = m && (m.plan === 'plateforme' || m.plan === 'enterprise');
  // role-based navigation: cashier = till work only · manager = + operations · owner = everything
  const role = u.is_admin ? 'admin' : (u.role || 'owner');
  const till = [
    ['dashboard', '◫', t('dashboard')],
    ['verify', '✓', t('verify')],
    ['feed', '≋', t('feed')],
    ['receipts', '🧾', t('receipts')],
  ];
  const ops = [
    ['disputes', '⚖', t('disputes')],
    ['sec', '', 'Operations'],
    ['accounts', '🏦', t('accounts')],
    ['devices', '▣', t('devices')],
  ];
  const ownerOnly = [
    ['growth', '🚀', t('growth')],
    ['billing', '◈', t('billing')],
    ['team', '👥', t('team')],
    ['sec2', '', 'Platform'],
    ['developers', '</>', t('developers')],
    ...(isPlatform ? [['submerchants', '⌂', t('submerchants')]] : []),
  ];
  const tail = [
    ['comms', '✉', t('comms')],
    ['settings', '⚙', t('settings')],
  ];
  // a KODA staff-admin with no merchant of their own is oversight-only: show ONLY
  // the control centre, not the empty merchant tabs (Verify/Feed/Billing need a merchant).
  const nav = (u.is_admin && !m)
    ? [['sec3', '', 'KODA staff'], ['admin', '★', t('admin')]]
    : [
      ...till,
      ...(role !== 'cashier' ? ops : []),
      ...(role === 'owner' || role === 'admin' ? ownerOnly : []),
      ...tail,
      ...(u.is_admin ? [['sec3', '', 'KODA staff'], ['admin', '★', t('admin')]] : []),
    ];
  root.innerHTML = `
  <div class="shell">
    <aside class="side" id="side">
      <div class="logo"><span class="tick">✓</span>KODA</div>
      ${nav.map(([id, ic, label]) => id.startsWith('sec')
        ? `<div class="nav-sec">${label}</div>`
        : `<button class="nav-item ${active === id ? 'on' : ''}" onclick="location.hash='#${id}'">
             <span class="ic">${ic}</span>${label}
             ${id === 'comms' && ME.unread ? `<span class="nav-badge">${ME.unread}</span>` : ''}</button>`).join('')}
      <div style="margin-top:auto;padding:14px 12px;border-top:1px solid var(--line)">
        <div style="font-size:12.5px;font-weight:700">${esc(u.name)}</div>
        <div class="mono" style="font-size:10.5px;color:var(--dim)">${esc(m ? m.name : 'KODA staff')} · ${esc(u.role)}</div>
        <button class="nav-item" style="padding:8px 0" onclick="logout()">→ ${t('logout')}</button>
      </div>
    </aside>
    <main class="main">
      <div class="topbar">
        <div style="display:flex;gap:12px;align-items:center">
          <button class="burger" onclick="document.getElementById('side').classList.toggle('open')">☰</button>
          <div><h1>${title}</h1>${sub ? `<div class="sub">${sub}</div>` : ''}</div>
        </div>
        <div style="display:flex;gap:10px;align-items:center">
          ${m ? `<span class="badge b-warn mono">${acuFmt(m.acu_balance)} ACU</span>` : ''}
          <select class="lang-sel" onchange="setLang(this.value)">
            <option value="" ${!LANG ? 'selected' : ''}>${t('auto')}</option>
            <option value="fr" ${LANG === 'fr' ? 'selected' : ''}>Français</option>
            <option value="en" ${LANG === 'en' ? 'selected' : ''}>English</option>
          </select>
        </div>
      </div>
      <div id="view">${content}</div>
    </main>
  </div>`;
}
window.setLang = (v) => { LANG = v; if (v) localStorage.setItem('koda_lang', v); else localStorage.removeItem('koda_lang'); route(); };
window.logout = () => { localStorage.removeItem('koda_token'); ME = null; location.hash = '#login'; };

/* ---------------- views ---------------- */
const VIEWS = {};

VIEWS.login = () => {
  root.innerHTML = authCard(`
    <h1>${t('signin')}</h1><p>KODA — le code confirme le cash.</p>
    <div class="field"><label>Email</label><input id="em" type="email" placeholder="you@business.com" autocomplete="username"></div>
    ${pwField('pw', '••••••••', 'current-password')}
    <div style="text-align:right;margin:-6px 0 12px"><a href="#forgot" style="color:var(--gold);font-size:12.5px">${t('forgot_pw')}</a></div>
    <button class="btn btn-gold" style="width:100%" onclick="doLogin()">${t('signin')} →</button>
    <p style="margin-top:16px">No account? <a href="#signup" style="color:var(--gold)">${t('signup')}</a></p>`);
};
VIEWS.signup = (params) => {
  root.innerHTML = authCard(`
    <h1>${t('signup')}</h1><p>Three doors, one engine. Start free on Marché.</p>
    <div class="field"><label>Business name</label><input id="biz" placeholder="Maison Kivu"></div>
    <div class="field"><label>Your name</label><input id="nm"></div>
    <div class="field"><label>Email</label><input id="em" type="email"></div>
    <div class="field"><label>Mobile money number</label><input id="ph" placeholder="+243 ..."></div>
    ${pwField('pw', 'Choose a password', 'new-password')}
    <button class="btn btn-gold" style="width:100%" onclick="doSignup('${esc(params.get('plan') || '')}')">${t('signup')} →</button>
    <p style="margin-top:16px"><a href="#login" style="color:var(--gold)">${t('signin')}</a></p>`);
};
// password input with a show/hide (eye) toggle
function pwField(id, ph = '••••••••', ac = 'current-password') {
  return `<div class="field"><label>Password</label>
    <div style="position:relative">
      <input id="${id}" type="password" placeholder="${ph}" autocomplete="${ac}" style="width:100%;padding-right:44px">
      <button type="button" onclick="togglePw('${id}',this)" aria-label="Show password"
        style="position:absolute;right:6px;top:50%;transform:translateY(-50%);background:none;border:0;cursor:pointer;font-size:17px;line-height:1;color:var(--dim);padding:4px">👁</button>
    </div></div>`;
}
window.togglePw = (id, btn) => {
  const el = document.getElementById(id);
  const show = el.type === 'password';
  el.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
};
// forgot-password: request a reset link
VIEWS.forgot = () => {
  root.innerHTML = authCard(`
    <h1>${t('forgot_pw')}</h1><p>${t('forgot_sub')}</p>
    <div class="field"><label>Email</label><input id="fem" type="email" placeholder="you@business.com" autocomplete="username"></div>
    <button class="btn btn-gold" style="width:100%" onclick="doForgot()">${t('send_reset')}</button>
    <div id="fg-out" style="margin-top:14px"></div>
    <p style="margin-top:16px"><a href="#login" style="color:var(--gold)">← ${t('signin')}</a></p>`);
};
window.doForgot = async () => {
  const out = document.getElementById('fg-out');
  try {
    const r = await api('/app/auth/forgot', { body: { email: v('fem') } });
    out.innerHTML = `<div class="badge b-ok" style="line-height:1.5">✓ ${esc(r.message || 'If that email is registered, a reset link is on its way.')}</div>`;
  } catch (e) { out.innerHTML = `<div class="badge b-bad">✗ ${esc(e.message)}</div>`; }
};
// reset-password: consume the token from the email link (#reset?token=…)
VIEWS.reset = (params) => {
  const token = (params && params.get && params.get('token')) || '';
  root.innerHTML = authCard(`
    <h1>${t('reset_pw')}</h1><p>${t('reset_sub')}</p>
    ${token ? '' : `<div class="badge b-bad" style="margin-bottom:12px">No reset token — open the link from your email.</div>`}
    ${pwField('rpw', 'New password', 'new-password')}
    <button class="btn btn-gold" style="width:100%" onclick="doReset('${esc(token)}')" ${token ? '' : 'disabled'}>${t('reset_pw')}</button>
    <div id="rs-out" style="margin-top:14px"></div>
    <p style="margin-top:16px"><a href="#login" style="color:var(--gold)">← ${t('signin')}</a></p>`);
};
window.doReset = async (token) => {
  const out = document.getElementById('rs-out');
  try {
    await api('/app/auth/reset', { body: { token, password: v('rpw') } });
    out.innerHTML = `<div class="badge b-ok">✓ ${esc(t('reset_done'))}</div>`;
    setTimeout(() => { location.hash = '#login'; }, 1800);
  } catch (e) { out.innerHTML = `<div class="badge b-bad">✗ ${esc(e.message)}</div>`; }
};
function authCard(inner) {
  // Public-site menu so the app entry point is never a dead-end: from login you
  // can reach everything on the marketing site (coverage, docs, blog…).
  const site = [
    ['/', 'Home'], ['/how-it-works', 'How it works'], ['/coverage', 'Coverage'],
    ['/developers', 'Developers'], ['/industries', 'Industries'], ['/blog', 'Blog'],
  ];
  return `<div class="auth-wrap"><div class="auth-card">
    <div class="logo"><span class="tick">✓</span>KODA</div>${inner}
    <div class="auth-site">
      ${site.map(([h, l]) => `<a href="${h}">${l}</a>`).join('<span>·</span>')}
    </div></div></div>`;
}
window.doLogin = async () => {
  try {
    const r = await api('/app/auth/login', { body: { email: v('em'), password: v('pw') } });
    localStorage.setItem('koda_token', r.token); ME = await api('/app/me'); location.hash = '#dashboard';
  } catch (e) { toast('✗ ' + (e.message || 'login failed')); }
};
window.doSignup = async (plan) => {
  try {
    const r = await api('/app/auth/signup', { body: { business: v('biz'), name: v('nm'), email: v('em'), phone: v('ph'), password: v('pw') } });
    localStorage.setItem('koda_token', r.token); ME = await api('/app/me');
    // Paid plan chosen on the pricing page → take them to Billing and open the
    // payment picker (KODA mobile money / card). Free plan → straight to the app.
    if (plan && plan !== 'marche' && plan !== 'enterprise') {
      sessionStorage.setItem('koda_pending_plan', plan);
      location.hash = '#billing'; toast('✓ Account created — now choose how to pay for ' + plan);
    } else {
      location.hash = '#dashboard'; toast('✓ Welcome to KODA');
    }
  } catch (e) { toast('✗ ' + (e.message || 'signup failed')); }
};
const v = (id) => document.getElementById(id).value.trim();

VIEWS.dashboard = async () => {
  if (ME.user.is_admin && !ME.merchant) { location.hash = '#admin'; return; } // KODA staff go straight to the control centre
  const d = await api('/app/dashboard');
  const max = Math.max(1, ...d.daily.map(x => x.c));
  shell('dashboard', `${t('welcome')}, ${esc(ME.user.name.split(' ')[0])}`, esc(ME.merchant.name) + ' · ' + d.plan.label, `
  <div class="grid g4">
    <div class="card stat"><b>${fmt(d.today.c)}</b><span>${t('verify')} ${t('today')} · ${fmt(d.today.s)} ${ME.merchant.currency}</span></div>
    <div class="card stat"><b>${fmt(d.month.c)}</b><span>${t('month')} · ${fmt(d.month.s)} ${ME.merchant.currency}</span></div>
    <div class="card stat"><b class="${d.unmatched.c ? '' : 'up'}">${fmt(d.unmatched.c)}</b><span>${t('unmatched')} · ${fmt(d.unmatched.s)} ${ME.merchant.currency}</span></div>
    <div class="card stat"><b>${acuFmt(d.acu)}</b><span>${t('acu_balance')} · <a href="#billing" style="color:var(--gold)">${t('topup')}</a></span></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>14-day verifications</h3>
      <div class="bars">${d.daily.map(x => `<i style="height:${Math.round(100 * x.c / max)}%" title="${x.d}: ${x.c}"></i>`).join('') || '<div class="empty">No data yet — verify your first payment.</div>'}</div>
    </div>
    <div class="card"><h3>Doors in use</h3>
      ${['manual', 'chat', 'api'].map(mode => {
        const c = (d.byMode.find(x => x.mode === mode) || {}).c || 0;
        const tot = d.byMode.reduce((a, x) => a + x.c, 0) || 1;
        return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
          <span class="mono">${mode.toUpperCase()}</span><span class="mono" style="color:var(--dim)">${c}</span></div>
          <div class="progress"><i style="width:${Math.round(100 * c / tot)}%"></i></div></div>`;
      }).join('')}
      <div style="margin-top:14px;font-size:12.5px;color:var(--dim)">Devices: ${d.devices.map(x =>
        `<span class="badge ${x.status === 'active' ? 'b-ok' : 'b-bad'}">${esc(x.label.split('—')[0])}</span>`).join(' ') || 'none'}
        · ${t('open_disputes')}: ${d.disputes}</div>
    </div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Quick verify</h3>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <input id="qref" placeholder="${t('reference')} — e.g. OM.260717.1402.G34410" style="flex:1;min-width:240px;background:var(--ink);border:1px solid var(--line-strong);border-radius:9px;color:var(--text);padding:11px 13px;font-family:var(--mono)">
      <button class="btn btn-gold" onclick="quickVerify()">${t('verify_btn')}</button>
      <a class="btn btn-ghost" href="#verify">${t('verify_title')} →</a>
    </div>
  </div>`);
};
window.quickVerify = async () => {
  try { const r = await api('/app/verify', { body: { reference: v('qref') } }); toast(verdictMsg(r)); route(); }
  catch (e) { toast('✗ ' + e.message); }
};
function verdictMsg(r) {
  return r.status === 'verified' ? `✓ ${t('verified')} — ${fmt(r.amount_confirmed)} · risk ${r.risk ? r.risk.score : 0}`
    : r.status === 'pending_review' ? `⚠ ${t('pending')}`
    : r.status === 'not_found_yet' ? `◔ ${t('not_found')}` : `✗ ${t('rejected')} (${r.code || ''})`;
}

VIEWS.verify = async () => {
  shell('verify', t('verify_title'), 'Door 1 — Manual mode · same engine as the API', `
  <div class="console">
    <h2>${t('verify_title')}</h2>
    <div class="hint">${t('verify_hint')}</div>
    <div style="display:grid;gap:12px">
      <input id="ref" placeholder="OM.260717.1432.A88213" autocomplete="off">
      <input id="amt" placeholder="${t('expected_amount')}" inputmode="numeric">
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-gold" onclick="consoleVerify(false)">✓ ${t('verify_btn')}</button>
        <button class="btn btn-ghost" style="color:var(--paper-ink);border-color:rgba(36,31,20,.25)" onclick="consoleVerify(true)">📷 Screenshot (Vision ×3 ACU)</button>
      </div>
    </div>
    <div class="verdict" id="verdict"></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Sandbox magic references</h3>
    <div class="mono" style="font-size:12px;color:var(--dim);line-height:2">
      TEST-OK-25000 → instant verified · TEST-REPLAY → code_already_used · TEST-SUFFIX → challenge flow
    </div></div>
  <details class="card" style="margin-top:14px">
    <summary style="cursor:pointer;font-weight:600">${t('vmeans_t')}</summary>
    <div style="display:grid;gap:10px;margin-top:12px">
      <div style="border-left:3px solid #1E9E6A;padding-left:12px"><strong style="color:#1E9E6A">✓</strong> ${esc(t('vmeans_y'))}</div>
      <div style="border-left:3px solid #C99A2E;padding-left:12px"><strong style="color:#C99A2E">⚠</strong> ${esc(t('vmeans_n'))}</div>
    </div>
  </details>`);
};
window.consoleVerify = async (screenshot) => {
  const el = document.getElementById('verdict');
  el.className = 'verdict'; el.textContent = '…';
  try {
    const body = { reference: v('ref'), amount: v('amt') || undefined };
    if (screenshot) { body.screenshot = true; body.screenshot_ref = v('ref'); }
    const r = await api('/app/verify', { body });
    const cls = r.status === 'verified' ? 'ok' : r.status === 'pending_review' || r.status === 'not_found_yet' ? 'warn' : 'bad';
    const icon = cls === 'ok' ? '✓' : cls === 'warn' ? '◔' : '✗';
    el.className = `verdict show ${cls}`;
    el.innerHTML = `<div class="big">${icon} ${cls === 'ok' ? t('verified') : r.status === 'pending_review' ? t('pending') : r.status === 'not_found_yet' ? t('not_found') : t('rejected')}</div>
      <div class="mono">${r.amount_confirmed ? `${t('amount')}: ${fmt(r.amount_confirmed)} · ` : ''}${r.receipt_id ? `receipt ${r.receipt_id} · ` : ''}${r.risk ? `risk ${r.risk.score}` : ''}${r.code ? ` · ${r.code}` : ''}</div>
      ${(r.trace?.steps || []).map(s => `<div class="mono" style="margin-top:4px">→ ${esc(s)}</div>`).join('')}`;
    ME = await api('/app/me');
  } catch (e) {
    el.className = 'verdict show bad';
    el.innerHTML = `<div class="big">✗ ${esc(e.message)}</div>`;
  }
};

VIEWS.feed = async () => {
  const rows = await api('/app/feed');
  shell('feed', t('feed'), `${t('live')} — every payment SMS on your SIMs, structured`, `
  <div class="card" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    <span class="mono" style="font-size:11px;color:var(--dim)">SANDBOX — inject an operator SMS:</span>
    <input id="raw" placeholder='Vous avez recu 25 000 FC de ALICE K (+243897721). Ref: OM.260717.1500.H12345. Solde: 400 500'
      style="flex:1;min-width:260px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:9px 12px;font-family:var(--mono);font-size:12px">
    <button class="btn btn-gold btn-sm" onclick="injectSms()">Inject</button>
  </div>
  <div class="card" style="margin-top:14px">
    ${rows.map(s => `
      <div class="feed-row">
        <div class="feed-ic ${s.quarantined ? 'f-bad' : s.matched_intent_id ? 'f-ok' : 'f-dim'}">${s.quarantined ? '✗' : s.matched_intent_id ? '✓' : '·'}</div>
        <div><div class="t">${esc(s.counterparty_name || 'Unparsed SMS')} <span class="mono" style="color:var(--dim)">${s.counterparty_suffix ? '···' + s.counterparty_suffix : ''}</span>
          ${s.quarantined ? `<span class="badge b-bad">${t('quarantined')}</span>` : s.matched_intent_id ? '<span class="badge b-ok">matched</span>' : '<span class="badge b-dim">unmatched</span>'}</div>
        <div class="m">${esc(s.ref_code || '—')} · ${esc(s.operator)} · ${when(s.received_at)}${s.balance_after ? ` · bal ${fmt(s.balance_after)}` : ''}</div></div>
        <div class="amt">${s.amount ? '+' + fmt(s.amount) : ''}</div>
      </div>`).join('') || '<div class="empty">No SMS yet — enroll a Sentinel device or inject a sandbox SMS.</div>'}
  </div>`);
};
window.injectSms = async () => {
  try { const r = await api('/app/sandbox/sms', { body: { raw: v('raw'), operator: 'orange_cd' } });
    toast(r.quarantined ? '⚠ SMS quarantined — balance-chain break' : r.parsed ? '✓ SMS parsed into the ledger' : '◔ stored raw (unparseable)'); route(); }
  catch (e) { toast('✗ ' + e.message); }
};

VIEWS.receipts = async () => {
  const rows = await api('/app/receipts');
  shell('receipts', t('receipts'), `${rows.length} verified`, `
  <div class="card tbl-wrap"><table class="tbl">
    <tr><th>${t('reference')}</th><th>Payer</th><th class="num">${t('amount')}</th><th>Mode</th><th>Risk</th><th>When</th></tr>
    ${rows.map(r => `<tr>
      <td class="mono" style="font-size:12px"><a href="#receipt?id=${r.id}" style="color:var(--gold)">${esc(r.reference)}</a></td>
      <td>${esc(r.payer_name_masked || '—')}</td>
      <td class="num">${fmt(r.amount)} ${esc(r.currency || '')}</td>
      <td><span class="badge b-info">${esc(r.mode)}</span></td>
      <td class="mono" style="font-size:12px">${r.risk_score}</td>
      <td class="mono" style="font-size:11.5px;color:var(--dim)">${when(r.verified_at)}</td></tr>`).join('')}
  </table>${rows.length ? '' : '<div class="empty">No receipts yet.</div>'}</div>`);
};
VIEWS.receipt = async (params) => {
  const r = await api('/app/receipts/' + params.get('id'));
  shell('receipts', 'Receipt', r.id, `
  <div class="card"><dl class="kv">
    <dt>reference</dt><dd class="mono">${esc(r.reference)}</dd>
    <dt>amount</dt><dd>${fmt(r.amount)} ${esc(r.currency)}</dd>
    <dt>operator</dt><dd class="mono">${esc(r.operator || '—')}</dd>
    <dt>payer</dt><dd>${esc(r.payer_name_masked || '—')} ${r.payer_suffix ? '···' + r.payer_suffix : ''}</dd>
    <dt>mode</dt><dd>${esc(r.mode)}</dd><dt>risk score</dt><dd>${r.risk_score}</dd>
    <dt>ACU</dt><dd>${r.acu_cost}</dd><dt>verified</dt><dd>${when(r.verified_at)}</dd>
  </dl>
  <h3 style="margin:18px 0 8px">Decision trace (audit-grade)</h3>
  <div class="codebox">${(r.decision_trace.steps || []).map(esc).join('\n') || 'sandbox'}</div></div>`);
};

VIEWS.disputes = async () => {
  const rows = await api('/app/disputes');
  shell('disputes', t('disputes'), 'DisputeAgent K-06 assembles the evidence — you decide', `
  <div class="card" style="display:flex;gap:10px;flex-wrap:wrap">
    <input id="dref" placeholder="${t('reference')}" style="flex:1;min-width:200px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px;font-family:var(--mono);font-size:12.5px">
    <input id="dwhy" placeholder="Customer claim / reason" style="flex:2;min-width:220px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px;font-size:13px">
    <button class="btn btn-gold btn-sm" onclick="openDispute()">Open dispute (3 ACU)</button>
  </div>
  ${rows.map(d => `<div class="card" style="margin-top:12px">
    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
      <span class="badge ${d.status === 'open' ? 'b-warn' : d.status === 'accepted' ? 'b-ok' : 'b-bad'}">${esc(d.status)}</span>
      <b class="mono" style="font-size:13px">${esc(d.reference || d.id)}</b>
      <span style="color:var(--dim);font-size:13px">${esc(d.reason)}</span>
      <span class="mono" style="margin-left:auto;font-size:11px;color:var(--dim)">${when(d.created_at)}</span>
    </div>
    <div class="codebox" style="margin-top:10px">${esc(JSON.stringify(JSON.parse(d.evidence || '{}'), null, 2))}</div>
    ${d.status === 'open' ? `<div style="display:flex;gap:8px;margin-top:12px">
      <button class="btn btn-gold btn-sm" onclick="resolveDispute('${d.id}','accepted')">Accept</button>
      <button class="btn btn-danger btn-sm" onclick="resolveDispute('${d.id}','rejected')">Reject</button>
      <button class="btn btn-ghost btn-sm" onclick="resolveDispute('${d.id}','escalated')">Escalate to KODA</button></div>` : ''}
  </div>`).join('') || '<div class="empty">No disputes — that is the goal.</div>'}`);
};
window.openDispute = async () => {
  try { await api('/app/disputes', { body: { reference: v('dref'), reason: v('dwhy') } }); toast('✓ Dispute opened — evidence assembled'); route(); }
  catch (e) { toast('✗ ' + e.message); }
};
window.resolveDispute = async (id, outcome) => {
  await api(`/app/disputes/${id}/resolve`, { body: { outcome } }); toast('✓ ' + outcome); route();
};

// ---- Payment methods (Network Intelligence: connect → verify → activate) ----
VIEWS.accounts = async () => {
  const accts = await api('/app/network-accounts');
  const resolved = await api('/app/payment-methods').catch(() => ({ available: [], excluded: [] }));
  const devices = await api('/app/devices').catch(() => []);
  shell('accounts', t('accounts'), 'Connect the mobile-money accounts customers pay you on — verify ownership, then activate', `
  <div class="card"><h3>Add a receiving account</h3>
    <p style="font-size:13px;color:var(--dim)">Enter the operator + the number/till customers pay to. We give you a one-time reference; make a tiny test payment carrying it, and once your Sentinel captures it the account is verified.</p>
    <div style="display:grid;gap:8px;grid-template-columns:1fr 1fr;max-width:680px">
      <input id="na-code" placeholder="Operator code (e.g. orange_cd)" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <input id="na-ident" placeholder="Your pay-to number / till" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <input id="na-name" placeholder="Account holder name" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <button class="btn btn-gold" onclick="connectAccount()">Connect account</button>
    </div><div id="na-out" style="margin-top:10px"></div>
    <p style="font-size:12px;color:var(--dim);margin-top:8px">Operator codes: see <a href="#admin?tab=coverage" style="color:var(--gold)">Coverage</a> or the public <a href="/coverage" target="_blank">coverage page</a>. Tier-C (bank/app-rail) networks aren't SMS-verifiable.</p></div>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>Your accounts (${fmt(accts.length)})</h3>
    ${accts.length ? `<table class="tbl"><tr><th>Operator</th><th>Number</th><th>Ownership</th><th>Status</th><th>Doors</th><th></th></tr>
    ${accts.map(a => `<tr><td class="mono">${esc(a.network_code)}</td><td class="mono">${esc(a.masked || '—')}</td>
      <td><span class="badge ${a.ownership_status === 'VERIFIED' ? 'b-ok' : 'b-info'}">${esc(a.ownership_status)}</span>${a.ownership_status !== 'VERIFIED' && a.verify_ref ? `<div class="mono" style="font-size:10px;color:var(--dim)">ref ${esc(a.verify_ref)}</div>` : ''}</td>
      <td><span class="badge ${a.activation_status === 'ACTIVE' ? 'b-ok' : a.activation_status === 'PAUSED' ? 'b-bad' : 'b-info'}">${esc(a.activation_status)}</span></td>
      <td style="font-size:11px" class="mono">${a.enabled_manual ? 'M' : '·'}${a.enabled_whatsapp ? 'W' : '·'}${a.enabled_api ? 'A' : '·'}</td>
      <td style="white-space:nowrap">${a.activation_status === 'DRAFT' || a.ownership_status === 'VERIFIED' && a.activation_status !== 'ACTIVE' ? `<button class="btn btn-gold btn-sm" onclick="activateAccount('${a.id}')">activate</button>` : ''}
        ${a.activation_status === 'ACTIVE' ? `<button class="btn btn-ghost btn-sm" onclick="pauseAccount('${a.id}')">pause</button>` : a.activation_status === 'PAUSED' ? `<button class="btn btn-gold btn-sm" onclick="resumeAccount('${a.id}')">resume</button>` : ''}</td></tr>`).join('')}
    </table>` : '<p style="color:var(--dim);font-size:13px">No accounts yet. Connect one above.</p>'}</div>
  <div class="card" style="margin-top:14px"><h3>What customers would see now</h3>
    ${(resolved.available || []).length ? (resolved.available || []).map(mth => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0"><span class="mono">${esc(mth.network_code || mth.network || '')}</span><span class="badge b-ok">${esc(mth.health || 'live')}</span></div>`).join('') : '<p style="color:var(--dim);font-size:13px">No live payment methods yet — connect &amp; activate an account (and keep a Sentinel online for auto doors).</p>'}
    ${(resolved.excluded || []).length ? `<details style="margin-top:8px"><summary style="cursor:pointer;font-size:12px;color:var(--dim)">Why some are hidden (${resolved.excluded.length})</summary>${resolved.excluded.map(e => `<div class="mono" style="font-size:11px;color:var(--dim);padding:2px 0">${esc(e.network_code || e.network || '')} — ${esc(e.reason || '')}</div>`).join('')}</details>` : ''}</div>`);
};
window.connectAccount = async () => {
  const out = document.getElementById('na-out');
  try {
    const r = await api('/app/network-accounts', { body: { network_code: v('na-code'), account_identifier: v('na-ident'), account_holder_name: v('na-name') } });
    out.innerHTML = `<div class="badge b-ok" style="line-height:1.6">✓ Connected. Send a tiny test payment with reference <b class="mono">${esc(r.verify_ref)}</b> to this number; once your Sentinel captures it, come back and click <b>activate</b>.</div>`;
    setTimeout(route, 3500);
  } catch (e) { out.innerHTML = `<div class="badge b-bad">✗ ${esc(e.message)}</div>`; }
};
window.activateAccount = async (id) => { try { await api(`/app/network-accounts/${id}/activate`, { body: {} }); toast('✓ activated'); route(); } catch (e) { toast('✗ ' + e.message); } };
window.pauseAccount = async (id) => { try { await api(`/app/network-accounts/${id}/pause`, { body: {} }); toast('✓ paused'); route(); } catch (e) { toast('✗ ' + e.message); } };
window.resumeAccount = async (id) => { try { await api(`/app/network-accounts/${id}/resume`, { body: {} }); toast('✓ resumed'); route(); } catch (e) { toast('✗ ' + e.message); } };

// ---- Distributor (KD) console — only meaningful if this merchant is a distributor ----
VIEWS.kd = async () => {
  let float;
  try { float = await api('/app/kd/float'); }
  catch { return shell('kd', t('kd_console'), 'Distributor console', `<div class="card"><h3>Not a distributor</h3><p style="font-size:14px;color:var(--dim)">This account isn't set up as a KODA distributor. Distributors hold prepaid ACU float and sell it to nearby merchants. Ask KODA staff to enable it.</p></div>`); }
  const sales = await api('/app/kd/sales').catch(() => ({ sales: [] }));
  shell('kd', t('kd_console'), `${esc(float.name)} · ${esc(float.country)}`, `
  <div class="grid g4">
    <div class="card stat"><b>${fmt(float.float_acu)}</b><span>ACU float (inventory)</span></div>
    <div class="card stat"><b>${fmt((sales.sales || []).filter(s => s.status === 'settled').length)}</b><span>settled sales</span></div>
    <div class="card stat"><b><span class="badge ${float.status === 'active' ? 'b-ok' : 'b-bad'}">${esc(float.status)}</span></b><span>status</span></div>
    <div class="card stat"><b>${fmt((sales.sales || []).reduce((a, s) => a + (s.status === 'settled' ? s.acu_amount : 0), 0))}</b><span>ACU sold</span></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Buy ACU float (wholesale)</h3>
    <p style="font-size:13px;color:var(--dim)">Prepay a block of ACU at your wholesale rate; you resell it to merchants near you.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><input id="kd-block" type="number" placeholder="ACU block (e.g. 5000)" style="flex:1;min-width:160px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <button class="btn btn-gold" onclick="kdBuy()">Buy float</button></div><div id="kd-out" style="margin-top:10px"></div></div>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>Recent sales</h3>
    ${(sales.sales || []).length ? `<table class="tbl"><tr><th>When</th><th class="num">ACU</th><th class="num">$</th><th>Status</th></tr>
    ${sales.sales.map(s => `<tr><td>${when(s.created_at)}</td><td class="num">${fmt(s.acu_amount)}</td><td class="num">$${fmt(s.total_usd)}</td><td><span class="badge ${s.status === 'settled' ? 'b-ok' : 'b-info'}">${esc(s.status)}</span></td></tr>`).join('')}
    </table>` : '<p style="color:var(--dim);font-size:13px">No sales yet.</p>'}</div>`);
};
window.kdBuy = async () => {
  const out = document.getElementById('kd-out');
  const block = Number(v('kd-block'));
  if (!block) return void (out.innerHTML = '<div class="badge b-bad">Enter an ACU amount.</div>');
  try { const r = await api('/app/kd/wholesale', { body: { acu_block: block } }); out.innerHTML = `<div class="badge b-ok">✓ float purchased</div>`; setTimeout(route, 1500); }
  catch (e) { out.innerHTML = `<div class="badge b-bad">✗ ${esc(e.message)}</div>`; }
};

VIEWS.devices = async () => {
  const rows = await api('/app/devices');
  shell('devices', t('devices'), 'The edge fleet — each SIM is a verification endpoint', `
  <div class="card" style="display:flex;gap:10px;flex-wrap:wrap">
    <input id="dlabel" placeholder="Label — e.g. Caisse 2" style="flex:1;min-width:180px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px;font-size:13px">
    <select id="dop" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px">
      <option value="orange_cd">Orange Money</option><option value="mpesa_cd">M-Pesa</option>
      <option value="airtel_cd">Airtel Money</option><option value="africell_cd">Africell Money</option>
      <option value="mtn_momo">MTN MoMo</option><option value="wave">Wave</option></select>
    <button class="btn btn-gold btn-sm" onclick="enrollDevice()">${t('enroll_device')}</button>
    <a class="btn btn-ghost btn-sm" href="/sentinel" target="_blank" rel="noopener">Get the Sentinel app ↗</a>
  </div>
  <div id="device-out"></div>
  <div class="grid g2" style="margin-top:14px">
    ${rows.map(d => `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <b>${esc(d.label)}</b>
        <span class="badge ${d.status === 'active' ? 'b-ok' : d.status === 'pending' ? 'b-warn' : 'b-bad'}">${esc(d.status)}</span></div>
      <dl class="kv" style="margin-top:10px">
        <dt>operator</dt><dd class="mono">${esc(d.operator)}</dd>
        <dt>SIM</dt><dd class="mono">${esc(d.sim_msisdn || '—')}</dd>
        <dt>attested</dt><dd>${d.attested ? '✓ Play Integrity' : '✗'}</dd>
        <dt>last seen</dt><dd>${when(d.last_seen)}</dd>
        <dt>parse health</dt><dd>${Math.round((d.parse_health || 1) * 100)}% · battery ${d.battery}%</dd>
        ${d.enrol_code ? `<dt>enrol code</dt><dd class="mono" style="color:var(--gold)">${esc(d.enrol_code)}</dd>` : ''}
      </dl>
      ${d.status !== 'revoked' ? `<button class="btn btn-danger btn-sm" style="margin-top:12px" onclick="revokeDevice('${d.id}')">${t('revoke')}</button>` : ''}
    </div>`).join('') || '<div class="empty">No devices yet.</div>'}
  </div>`);
};
window.enrollDevice = async () => {
  const r = await api('/app/devices/enroll', { body: { label: v('dlabel') || 'Merchant phone', operator: v('dop') } });
  const box = document.getElementById('device-out');
  box.innerHTML = `<div class="card" style="margin-top:14px;border-color:var(--gold)">
    <h3 class="ok">✓ Device enrolled — pair the phone now (shown once)</h3>
    <p style="font-size:13px;color:var(--dim);margin:6px 0">In the KODA Sentinel app on that phone, paste this pairing token into "…or paste the pairing token", then tap <b>PAIR THIS PHONE</b>.</p>
    <div style="font-size:12px;color:var(--dim);margin-top:8px">Pairing token</div>
    <div class="codebox" style="border-color:var(--gold);word-break:break-all">${esc(r.device_token)}</div>
    <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(r.device_token)}');toast('✓ token copied')">Copy token</button>
    <div style="font-size:12px;color:var(--dim);margin-top:12px">Or scan/paste this QR link</div>
    <div class="codebox" style="word-break:break-all">${esc(r.qr)}</div>
    <p style="font-size:12px;color:var(--dim);margin-top:8px">Enrol code: <span class="mono" style="color:var(--gold)">${esc(r.enrol_code)}</span> · after pairing, grant the SMS permission when Android asks.</p></div>`;
  box.scrollIntoView({ behavior: 'smooth' });
};
window.revokeDevice = async (id) => { await api(`/app/devices/${id}/revoke`, { body: {} }); toast('✓ Revoked'); route(); };

VIEWS.billing = async () => {
  const b = await api('/app/billing');
  const plans = ['marche', 'boutique', 'commerce', 'plateforme'];
  shell('billing', t('billing'), '"We only earn when the merchant gets paid."', `
  <div class="grid g3">
    <div class="card stat"><b>${acuFmt(b.balance)}</b><span>${t('acu_balance')}</span></div>
    <div class="card stat"><b>${esc(b.plan.label)}</b><span>${t('plan')} · ${b.plan.usd === null ? 'custom' : '$' + b.plan.usd + '/mo'} · ${b.plan.verifs || '∞'} verifs</span></div>
    <div class="card stat"><b>${fmt(b.usage.reduce((a, x) => a + (x.burned || 0), 0))}</b><span>ACU burned · 30 days</span></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>${t('topup')} — prepaid via mobile money, verified by KODA itself</h3>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${b.packs.map(p => `<button class="btn btn-ghost" onclick="topupPay(${p.acu})">$${p.usd} → ${fmt(p.acu)} ACU</button>`).join('')}
    </div>
    <div id="topup-out" style="margin-top:14px"></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>${t('redeem_voucher')}</h3>
    <p style="font-size:13px;color:var(--dim)">Bought a KODA voucher from a reseller? Enter the PIN to credit ACU instantly.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><input id="vpin" placeholder="KODA-CD-XXXX-XXXX-XXXX" style="flex:1;min-width:220px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px" class="mono">
      <button class="btn btn-gold" onclick="redeemVoucher()">${t('redeem_voucher')}</button></div>
    <div id="voucher-out" style="margin-top:10px"></div></div>
  <div class="card" style="margin-top:14px"><h3>Distributor?</h3>
    <p style="font-size:13px;color:var(--dim)">If KODA has set you up as a distributor (ACU reseller), manage your float and sales here.</p>
    <a class="btn btn-ghost" href="#kd">${t('kd_console')} →</a></div>
  <div class="card" style="margin-top:14px"><h3>${t('change_plan')}</h3>
    <div class="pill-row">${plans.map(p => `<button class="pill ${b.plan.label.toLowerCase() === p ? 'on' : ''}" onclick="setPlan('${p}')">${p}</button>`).join('')}</div>
    <div class="mono" style="font-size:11.5px;color:var(--dim)">Marché $0 · Boutique $19 · Commerce $79 · Plateforme $399 · Enterprise custom — one ladder, all three doors.</div>
    <div id="plan-pay" style="margin-top:12px"></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card tbl-wrap"><h3>ACU transactions</h3><table class="tbl">
      ${b.transactions.slice(0, 12).map(x => `<tr><td class="mono" style="font-size:11.5px">${esc(x.kind)}</td>
        <td class="num" style="color:${x.delta > 0 ? 'var(--verify)' : 'var(--dim)'}">${x.delta > 0 ? '+' : ''}${fmt(x.delta)}</td>
        <td class="num" style="color:var(--dim)">${fmt(x.balance_after)}</td>
        <td class="mono" style="font-size:11px;color:var(--dim)">${when(x.created_at)}</td></tr>`).join('')}
    </table></div>
    <div class="card tbl-wrap"><h3>Invoices</h3><table class="tbl">
      ${b.invoices.map(i => `<tr><td class="mono">${esc(i.number)}</td><td class="num">$${i.amount_usd}</td>
        <td><span class="badge ${i.status === 'paid' ? 'b-ok' : 'b-warn'}">${i.status}</span></td>
        <td class="mono" style="font-size:11px;color:var(--dim)">${esc(i.period || '')}</td></tr>`).join('') || '<tr><td class="empty">None yet</td></tr>'}
    </table></div>
  </div>`);
  // arriving from a paid-plan signup → auto-open the payment picker for that plan
  const pending = sessionStorage.getItem('koda_pending_plan');
  if (pending) { sessionStorage.removeItem('koda_pending_plan'); setTimeout(() => setPlan(pending), 200); }
};
// mesh top-up: pick an amount → choose how to pay (KODA mobile money / card)
window.topupPay = async (acu) => {
  const out = document.getElementById('topup-out');
  out.innerHTML = '…';
  try {
    const m = await api('/app/billing/methods?amount_acu=' + acu);
    out.innerHTML = `<div class="card" style="border-color:var(--gold)"><h3>Buy ${fmt(acu)} ACU — choose how to pay</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        ${m.methods.map(mth => `<button class="btn ${mth.available === false ? 'btn-ghost' : 'btn-gold'}" ${mth.available === false ? 'disabled' : ''} onclick="collectTopup(${acu},'${mth.rail}')">
          ${esc(mth.label || mth.rail)}${mth.quote ? ` — $${fmt(mth.quote.total_usd)}` : ''}${mth.available === false ? ' (not set up)' : ''}</button>`).join('')}
      </div><div id="collect-out" style="margin-top:10px"></div></div>`;
  } catch (e) { out.innerHTML = `<div class="badge b-bad">✗ ${esc(e.message)}</div>`; }
};
window.collectTopup = async (acu, rail) => {
  const out = document.getElementById('collect-out');
  out.innerHTML = '…';
  try {
    const r = await api('/app/billing/collect', { body: { amount_acu: acu, rail } });
    const s = r.session || {};
    if (s.flow === 'MOBILE_MONEY_TO_KODA_SIM') {
      out.innerHTML = `<div class="card"><h3 class="ok">Pay by mobile money</h3>
        <p style="font-size:14px">Send <b>$${fmt(s.amount_usd)}</b> (local equivalent) to <b class="mono">${esc(s.pay_to)}</b>, reference <span class="mono">${esc(s.reference || r.topup_id || '')}</span>.</p>
        <p style="font-size:13px;color:var(--dim)">Your ${fmt(acu)} ACU are credited once KODA verifies the payment.</p></div>`;
    } else if (s.checkout_url || s.url) {
      out.innerHTML = `<a class="btn btn-gold" href="${esc(s.checkout_url || s.url)}" target="_blank" rel="noopener">Continue to secure checkout →</a>`;
    } else {
      out.innerHTML = `<div class="badge b-ok">✓ Top-up started (${esc(r.topup_id || '')}). Follow your provider's steps; ACU credit on confirmation.</div>`;
    }
  } catch (e) { out.innerHTML = `<div class="badge b-bad">✗ ${esc(e.message)}</div>`; }
};
window.topup = async (usd) => {
  const r = await api('/app/billing/topup', { body: { usd } });
  document.getElementById('topup-out').innerHTML = `
    <div class="codebox">intent ${r.intent_id}
pay ${r.pack.usd ? '$' + r.pack.usd : ''} → ${r.pay_to.map(p => `${p.operator}: ${p.number} (${p.ussd_hint})`).join(' · ')}
then submit the confirmation code:</div>
    <div style="display:flex;gap:10px;margin-top:10px;flex-wrap:wrap">
      <input id="tref" placeholder="Confirmation code — try TEST-OK-${r.pack.usd * 2800}" style="flex:1;min-width:220px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px;font-family:var(--mono);font-size:12.5px">
      <button class="btn btn-gold btn-sm" onclick="confirmTopup('${r.intent_id}')">Confirm top-up</button>
    </div>`;
};
window.confirmTopup = async (iid) => {
  try {
    // top-up verification goes through the same public verify path
    const key = await ensureTestKey();
    const res = await fetch(`/v1/intents/${iid}/verify`, { method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({ reference: v('tref') }) });
    const r = await res.json();
    toast(r.status === 'verified' ? '✓ Top-up verified — ACU credited by the engine itself' : '✗ ' + (r.error?.code || r.status));
    ME = await api('/app/me'); route();
  } catch (e) { toast('✗ ' + e.message); }
};
let _testKey = null;
async function ensureTestKey() {
  if (_testKey) return _testKey;
  const r = await api('/app/keys', { body: { prefix: 'sk_test', label: 'console-internal' } });
  _testKey = r.secret; return _testKey;
}
window.redeemVoucher = async () => {
  const out = document.getElementById('voucher-out');
  try { const r = await api('/app/billing/voucher/redeem', { body: { pin: v('vpin') } });
    out.innerHTML = `<div class="badge b-ok">✓ ${fmt(r.acu_credited || r.acu || 0)} ACU credited</div>`;
    ME = await api('/app/me'); setTimeout(route, 1800); }
  catch (e) { out.innerHTML = `<div class="badge b-bad">✗ ${esc(e.message)}</div>`; }
};
window.setPlan = async (p) => {
  const r = await api('/app/billing/plan', { body: { plan: p } });
  if (r.ok) { ME = await api('/app/me'); toast('✓ Plan: ' + p); route(); return; }
  if (r.payment_required) {
    const box = document.getElementById('plan-pay');
    box.innerHTML = `<div class="card" style="border-color:var(--gold)">
      <h3>Pay for ${esc(r.plan_label)} — $${fmt(r.monthly_usd)}/mo</h3>
      <p style="font-size:13px;color:var(--dim)">Choose how to pay. Your plan activates once payment is confirmed.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        ${r.methods.map(mth => `<button class="btn ${mth.available ? 'btn-gold' : 'btn-ghost'}" ${mth.available ? '' : 'disabled'} onclick="subscribePlan('${p}','${mth.rail}')">
          ${esc(mth.label)}${mth.quote ? ` — $${fmt(mth.quote.total_usd)}` : ''}${mth.available ? '' : ' (coming soon)'}</button>`).join('')}
      </div><div id="sub-out" style="margin-top:10px"></div></div>`;
  }
};
window.subscribePlan = async (plan, rail) => {
  const out = document.getElementById('sub-out');
  out.innerHTML = '…';
  try {
    const r = await api('/app/billing/subscribe', { body: { plan, rail } });
    const s = r.session || {};
    if (s.flow === 'MOBILE_MONEY_TO_KODA_SIM') {
      out.innerHTML = `<div class="card"><h3 class="ok">Pay by mobile money</h3>
        <p style="font-size:14px">Send <b>$${fmt(s.amount_usd)}</b> (local equivalent) to <b class="mono">${esc(s.pay_to)}</b> by mobile money.</p>
        <p style="font-size:13px;color:var(--dim)">Reference: <span class="mono">${esc(s.reference || r.topup_id)}</span>. Keep your confirmation SMS. Your plan activates as soon as KODA verifies the payment.</p></div>`;
    } else if (s.checkout_url || s.url) {
      out.innerHTML = `<a class="btn btn-gold" href="${esc(s.checkout_url || s.url)}" target="_blank" rel="noopener">Continue to secure checkout →</a>`;
    } else {
      out.innerHTML = `<div class="badge b-ok">✓ Payment started (${esc(r.topup_id)}). Follow your provider's instructions; the plan activates on confirmation.</div>`;
    }
  } catch (e) { out.innerHTML = `<div class="badge b-bad">✗ ${esc(e.message)}</div>`; }
};

VIEWS.team = async () => {
  const d = await api('/app/team');
  shell('team', t('team'), 'Seats with per-cashier audit', `
  <div class="card" style="display:flex;gap:10px;flex-wrap:wrap">
    <input id="tname" placeholder="Name" style="flex:1;min-width:140px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px;font-size:13px">
    <input id="temail" placeholder="Email" style="flex:1;min-width:180px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px;font-size:13px">
    <select id="trole" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px">
      <option value="cashier">cashier</option><option value="manager">manager</option></select>
    <button class="btn btn-gold btn-sm" onclick="inviteMember()">${t('invite')}</button>
  </div>
  <div class="card tbl-wrap" style="margin-top:14px"><table class="tbl">
    <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th></tr>
    ${d.members.map(u => `<tr><td>${esc(u.name)}</td><td class="mono" style="font-size:12px">${esc(u.email)}</td>
      <td>${(ME.user.role === 'owner' || ME.user.is_admin) && u.id !== ME.user.id ? `<select onchange="setMemberRole('${u.id}',this.value)" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:6px;color:var(--text);padding:5px">${['cashier', 'manager', 'owner'].map(r => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select>` : `<span class="badge b-info">${esc(u.role)}</span>`}</td>
      <td><span class="badge ${u.status === 'active' ? 'b-ok' : 'b-bad'}">${esc(u.status)}</span></td></tr>`).join('')}
  </table></div>
  <div class="card" style="margin-top:14px"><h3>Audit trail</h3>
    ${d.audit.slice(0, 15).map(a => `<div class="feed-row"><div class="feed-ic f-dim">·</div>
      <div><div class="t">${esc(a.action)} <span style="color:var(--dim)">· ${esc(a.name || 'system')}</span></div>
      <div class="m">${esc(a.detail || '')} · ${when(a.created_at)}</div></div></div>`).join('') || '<div class="empty">Empty</div>'}
  </div>`);
};
window.setMemberRole = async (id, role) => { try { await api(`/app/team/${id}/role`, { body: { role } }); toast('✓ role → ' + role); } catch (e) { toast('✗ ' + e.message); route(); } };
window.inviteMember = async () => {
  try { await api('/app/team/invite', { body: { name: v('tname'), email: v('temail'), role: v('trole'), password: 'koda-invite' } });
    toast('✓ Invited (temp password: koda-invite)'); route(); } catch (e) { toast('✗ ' + e.message); }
};

VIEWS.developers = async () => {
  const keys = await api('/app/keys');
  const wh = await api('/app/webhooks');
  shell('developers', t('developers'), 'Three endpoints. One coffee. — kodajnn.com/v1', `
  <div class="grid g2">
    <div class="card"><h3>API keys</h3>
      <p style="font-size:12.5px;color:var(--dim);margin-bottom:8px">Tap a button below to create a key (shown once). For testing use <b>Create sk_test</b>.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${[['sk_test', 'Create sk_test (sandbox)'], ['sk_live', 'Create sk_live'], ['pk_live', 'Create pk_live'], ['rk_live', 'Create rk_live (read-only)']].map(([p, label]) => `<button class="btn ${p === 'sk_test' ? 'btn-gold' : 'btn-ghost'} btn-sm" onclick="createKey('${p}')">${esc(label)}</button>`).join('')}
      </div>
      <table class="tbl">${keys.map(k => `<tr>
        <td class="mono" style="font-size:12px">${esc(k.prefix)}_···${esc(k.last4)}</td>
        <td>${esc(k.label || '')}</td>
        <td>${k.revoked ? '<span class="badge b-bad">revoked</span>' : '<span class="badge b-ok">live</span>'}</td>
        <td>${k.revoked ? '' : `<button class="btn btn-danger btn-sm" onclick="revokeKey('${k.id}')">revoke</button>`}</td></tr>`).join('')}
      </table>
      <div id="key-out" style="margin-top:10px"></div>
    </div>
    <div class="card"><h3>Webhooks — HMAC-SHA256 signed</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        <input id="whurl" placeholder="https://yourapp.com/webhooks/koda" style="flex:1;min-width:220px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:9px 12px;font-family:var(--mono);font-size:12px">
        <button class="btn btn-gold btn-sm" onclick="addWebhook()">${t('add_webhook')}</button>
      </div>
      ${wh.endpoints.map(e => `<div class="feed-row"><div class="feed-ic ${e.active ? 'f-ok' : 'f-dim'}">⇄</div>
        <div><div class="t mono" style="font-size:12.5px">${esc(e.url)}</div>
        <div class="m">secret whsec_···${esc(e.secret.slice(-4))}</div></div>
        <button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="testWebhook('${e.id}')">${t('test')}</button></div>`).join('') || '<div class="empty">No endpoints yet.</div>'}
      <h3 style="margin-top:16px">Recent deliveries</h3>
      ${wh.deliveries.slice(0, 8).map(d => `<div class="feed-row"><div class="feed-ic ${d.status === 'sent' ? 'f-ok' : d.status === 'pending' ? 'f-dim' : 'f-bad'}">${d.status === 'sent' ? '✓' : '·'}</div>
        <div><div class="t mono" style="font-size:12px">${esc(d.event)}</div><div class="m">${esc(d.status)} · ${d.attempts} attempts · ${when(d.created_at)}</div></div></div>`).join('') || '<div class="empty">None yet.</div>'}
    </div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Quickstart</h3>
    <div class="codebox"># 1 · verify your key
curl -H "Authorization: Bearer sk_test_..." ${location.origin}/v1/ping

# 2 · create an intent
curl ${location.origin}/v1/intents -H "Authorization: Bearer sk_test_..." \\
  -d '{"amount":25000,"currency":"CDF","operators":["orange_cd"]}'

# 3 · customer pays → submit their code
curl ${location.origin}/v1/intents/{id}/verify -H "Authorization: Bearer sk_test_..." \\
  -d '{"reference":"TEST-OK-25000"}'

# machine-readable contract
${location.origin}/v1/openapi.json</div></div>`);
};
window.createKey = async (prefix) => {
  const r = await api('/app/keys', { body: { prefix } });
  document.getElementById('key-out').innerHTML = `<div class="codebox" style="border-color:var(--gold)">${esc(r.secret)}
# shown once — store it now</div>`;
  route.pending = true; toast('✓ Key created — shown once');
};
window.revokeKey = async (id) => { await api(`/app/keys/${id}/revoke`, { body: {} }); toast('✓ Revoked'); route(); };
window.addWebhook = async () => {
  try { const r = await api('/app/webhooks', { body: { url: v('whurl') } }); toast(`✓ Added — secret ${r.secret.slice(0, 12)}…`); route(); }
  catch (e) { toast('✗ ' + e.message); }
};
window.testWebhook = async (id) => { await api(`/app/webhooks/${id}/test`, { body: {} }); toast('✓ Signed test event dispatched'); route(); };

VIEWS.comms = async () => {
  const cat = await api('/app/comms/catalogue');
  const del = await api('/app/comms/deliveries');
  const notifs = await api('/app/notifications');
  const prefs = await api('/app/comms/prefs');
  const s = cat.stats;
  shell('comms', 'Communication Event Architecture', `One event engine — ${s.total} events fan out across email · in-app · WhatsApp · push · SMS`, `
  <div class="grid g4">
    <div class="card stat"><b>${s.total}</b><span>catalogue events · ${s.categories} categories</span></div>
    <div class="card stat"><b>${s.mandatory}</b><span>mandatory notices — bypass opt-outs</span></div>
    <div class="card stat"><b>${del.sent}</b><span>messages delivered of ${del.attempted} attempted</span></div>
    <div class="card stat"><b>${cat.channels.length}</b><span>channels wired</span></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Channel coverage — events firing on each channel by default</h3>
    ${cat.channels.map(ch => `<div style="margin-bottom:9px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span class="chan ${ch}">${ch}</span><span class="mono" style="color:var(--dim)">${s.byChannel[ch]} events</span></div>
      <div class="progress"><i style="width:${Math.round(100 * s.byChannel[ch] / s.total)}%"></i></div></div>`).join('')}
  </div>
  <div class="card" style="margin-top:14px"><h3>Template QA — branded email preview & live test</h3>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px">
      <select id="evsel" style="flex:1;min-width:250px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px;font-family:var(--mono);font-size:12px">
        ${cat.categories.map(c => `<optgroup label="${esc(c.label)}">${c.events.map(e =>
          `<option value="${e.key}">${esc(e.label)} — ${e.key}</option>`).join('')}</optgroup>`).join('')}
      </select>
      <button class="btn btn-gold btn-sm" onclick="previewMail()">${t('preview')}</button>
      <button class="btn btn-ghost btn-sm" onclick="sendTest()">${t('send_test')}</button>
    </div>
    <div id="mailprev"></div>
    <div class="mono" style="font-size:11px;color:var(--dim);margin-top:8px">Preview renders exactly what a recipient receives — your logo, brand colour and details on every outbound email. Send test fires it live when a provider key is set; otherwise it's recorded in sandbox so the flow is always testable.</div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>Recent deliveries — event × channel × recipient</h3>
      ${del.deliveries.slice(0, 12).map(d => `<div class="feed-row">
        <div class="feed-ic ${d.status === 'sent' ? 'f-ok' : 'f-dim'}"><span class="chan ${d.channel}" style="margin:0">${d.channel[0]}</span></div>
        <div><div class="t mono" style="font-size:12px">${esc(d.event_key)}</div>
        <div class="m">${esc(d.status)} · ${esc(d.provider)} · ${when(d.created_at)}</div></div></div>`).join('') || '<div class="empty">None yet.</div>'}
    </div>
    <div class="card"><h3>Inbox <button class="btn btn-ghost btn-sm" style="float:right" onclick="markRead()">${t('mark_read')}</button></h3>
      ${notifs.slice(0, 12).map(n => `<div class="feed-row">
        <div class="feed-ic ${n.severity === 'success' ? 'f-ok' : n.severity === 'critical' ? 'f-bad' : 'f-dim'}">${n.read ? '·' : '●'}</div>
        <div><div class="t">${esc(n.title)}</div><div class="m">${esc(n.event_key)} · ${when(n.created_at)}</div></div></div>`).join('') || '<div class="empty">Empty inbox.</div>'}
    </div>
  </div>
  <div class="card" style="margin-top:14px"><h3>My channel preferences (mandatory notices always deliver)</h3>
    <div class="pill-row">${['email', 'whatsapp', 'push', 'sms'].map(ch =>
      `<button class="pill ${prefs[ch] ? 'on' : ''}" onclick="togglePref('${ch}',${prefs[ch] ? 0 : 1})">${ch} ${prefs[ch] ? '✓' : '✗'}</button>`).join('')}</div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Full catalogue</h3>
    ${cat.categories.map(c => `<div style="margin-bottom:16px">
      <div class="nav-sec" style="padding-left:0">${esc(c.label)} · ${c.events.length} events</div>
      <div class="tbl-wrap"><table class="tbl">${c.events.map(e => `<tr>
        <td style="min-width:160px">${esc(e.label)} ${e.mandatory ? '<span class="chan mand">mandatory</span>' : ''}</td>
        <td class="mono" style="font-size:11px;color:var(--dim)">${e.key}</td>
        <td style="font-size:12.5px;color:var(--dim)">${esc(e.subject)}</td>
        <td><span class="badge ${e.severity === 'critical' ? 'b-bad' : e.severity === 'warning' ? 'b-warn' : e.severity === 'success' ? 'b-ok' : 'b-info'}">${e.severity}</span></td>
        <td style="white-space:nowrap">${e.channels.map(ch => `<span class="chan ${ch}">${ch}</span>`).join('')}</td>
      </tr>`).join('')}</table></div></div>`).join('')}
  </div>`);
};
window.previewMail = async () => {
  const r = await api('/app/comms/preview/' + document.getElementById('evsel').value);
  document.getElementById('mailprev').innerHTML = `<iframe class="mailframe" srcdoc="${r.html.replace(/"/g, '&quot;')}"></iframe>`;
};
window.sendTest = async () => {
  const r = await api('/app/comms/test/' + document.getElementById('evsel').value, { body: {} });
  toast(`✓ Fired — ${r.deliveries.map(d => d.channel + ':' + d.status).join(' · ')}`);
};
window.markRead = async () => { await api('/app/notifications/read', { body: {} }); ME = await api('/app/me'); route(); };
window.togglePref = async (ch, on) => { await api('/app/comms/prefs', { body: { [ch]: !!on } }); route(); };

VIEWS.submerchants = async () => {
  const rows = await api('/app/submerchants');
  shell('submerchants', t('submerchants'), 'Plateforme — onboard your merchant base under one master key', `
  <div class="card" style="display:flex;gap:10px;flex-wrap:wrap">
    <input id="sname" placeholder="Sub-merchant name" style="flex:1;min-width:180px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px;font-size:13px">
    <input id="smsisdn" placeholder="+243 ..." style="min-width:150px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px;font-family:var(--mono);font-size:12.5px">
    <button class="btn btn-gold btn-sm" onclick="addSub()">Onboard (5 ACU)</button>
  </div>
  <div id="sub-out" style="margin-top:10px"></div>
  <div class="card tbl-wrap" style="margin-top:14px"><table class="tbl">
    <tr><th>Name</th><th>MSISDN</th><th class="num">Verifications</th><th>Status</th><th></th></tr>
    ${rows.map(s => `<tr><td>${esc(s.name)}</td><td class="mono" style="font-size:12px">${esc(s.msisdn || '—')}</td>
      <td class="num">${fmt(s.verifs)}</td>
      <td><span class="badge ${s.status === 'active' ? 'b-ok' : 'b-bad'}">${s.status}</span></td>
      <td><button class="btn btn-danger btn-sm" onclick="suspendSub('${s.id}')">${s.status === 'active' ? 'suspend' : 'restore'}</button></td></tr>`).join('')}
  </table>${rows.length ? '' : '<div class="empty">No sub-merchants yet — one platform deal onboards thousands.</div>'}</div>`);
};
window.addSub = async () => {
  try { const r = await api('/app/submerchants', { body: { name: v('sname'), msisdn: v('smsisdn') } });
    document.getElementById('sub-out').innerHTML = `<div class="codebox" style="border-color:var(--gold)">scoped key (shown once): ${esc(r.key)}</div>`;
    toast('✓ Onboarded'); } catch (e) { toast('✗ ' + e.message); }
};
window.suspendSub = async (id) => { await api(`/app/submerchants/${id}/suspend`, { body: {} }); route(); };

VIEWS.growth = async () => {
  const d = await api('/app/growth/tools');
  const acuBy = Object.fromEntries(d.tools.map(x => [x.id, x.acu]));
  shell('growth', t('growth'), t('growth_sub') + ' · K-11', `
  <div class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px">
    <div style="font-size:13.5px;color:var(--dim)">Each tool runs the KODA Growth agent and produces ready-to-use output.
      Metered in ACU — <span class="mono" style="color:var(--gold)">${fmt(d.balance)} ACU</span> available.</div>
    <a class="btn btn-ghost btn-sm" href="#billing">${t('topup')}</a>
  </div>
  <div class="grid g3" style="margin-top:14px">
    ${GROWTH_TOOLS.map(([id, ic, label]) => `<button class="card" style="text-align:left;border:1px solid var(--line);cursor:pointer" onclick="runGrowth('${id}')">
      <div style="font-size:22px;margin-bottom:8px">${ic}</div>
      <div style="font-weight:800;font-size:14.5px">${label}</div>
      <div class="mono" style="font-size:11px;color:var(--dim);margin-top:4px">${acuBy[id] === 0 ? 'free' : acuBy[id] + ' ACU'}</div>
    </button>`).join('')}
  </div>
  <div id="growth-out" style="margin-top:16px"></div>`);
};
window.runGrowth = async (tool) => {
  const out = document.getElementById('growth-out');
  out.innerHTML = `<div class="card"><div class="mono" style="color:var(--dim)">Running ${tool}…</div></div>`;
  try {
    const r = await api('/app/growth/' + tool, { body: growthOpts(tool) });
    ME = await api('/app/me');
    out.innerHTML = `<div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0">${esc(GROWTH_TOOLS.find(x => x[0] === tool)[2])}</h3>
        <span class="badge b-info mono">${r.acu_consumed === 0 ? 'free' : r.acu_consumed + ' ACU'}</span></div>
      ${renderGrowth(tool, r.result)}
      <div style="margin-top:12px;display:flex;gap:8px">
        <button class="btn btn-ghost btn-sm" onclick="copyGrowth(this)" data-t="${esc(JSON.stringify(r.result))}">Copy output</button>
        <button class="btn btn-gold btn-sm" onclick="runGrowth('${tool}')">Regenerate</button>
      </div></div>`;
  } catch (e) {
    out.innerHTML = `<div class="card" style="border-color:var(--danger)"><div class="mono" style="color:var(--danger)">✗ ${esc(e.message)}${e.status === 402 ? ' — top up ACU to use this tool' : ''}</div></div>`;
  }
};
function growthOpts(tool) {
  // sensible defaults; a fuller UI could expose these as fields
  return { social_post: { channel: 'whatsapp' }, advert: { channel: 'facebook', budget_usd: 20 },
    hashtags: { topic: 'mobile money', channel: 'instagram' }, video_script: { seconds: 30, platform: 'tiktok' } }[tool] || {};
}
function renderGrowth(tool, r) {
  const pre = (o) => `<div class="codebox" style="white-space:pre-wrap">${esc(typeof o === 'string' ? o : JSON.stringify(o, null, 2))}</div>`;
  if (tool === 'social_post') return `<div class="codebox" style="white-space:pre-wrap">${esc(r.text)}</div>
    <div style="margin-top:8px">${(r.hashtags || []).map(h => `<span class="chan inapp">${esc(h)}</span>`).join(' ')}</div>`;
  if (tool === 'advert') return `<dl class="kv"><dt>headline</dt><dd>${esc(r.headline)}</dd><dt>primary</dt><dd>${esc(r.primary_text)}</dd>
    <dt>CTA</dt><dd>${esc(r.cta_button)}</dd><dt>reach/day</dt><dd>${esc(r.est_reach)}</dd><dt>creative</dt><dd>${esc(r.creative_brief)}</dd></dl>`;
  if (tool === 'email_campaign') return `<dl class="kv"><dt>subject</dt><dd>${esc(r.subject)}</dd><dt>preheader</dt><dd>${esc(r.preheader)}</dd>
    <dt>send</dt><dd>${esc(r.send_time_hint)}</dd></dl><div class="codebox" style="margin-top:8px">${esc(r.body_html)}</div>`;
  if (tool === 'hashtags') return `<div>${r.hashtags.map(h => `<span class="chan inapp" style="margin:2px">${esc(h)}</span>`).join(' ')}</div>`;
  if (tool === 'video_script') return `<dl class="kv">${r.scenes.map(s => `<dt>${esc(s.t)}</dt><dd><b>${esc(s.shot)}</b><br><span style="color:var(--dim)">${esc(s.vo)}</span></dd>`).join('')}</dl>
    <div style="margin-top:8px" class="mono">${esc(r.caption)} · ${(r.hashtags || []).join(' ')}</div>`;
  if (tool === 'recommendations') return r.recommendations.map(x => `<div class="feed-row"><div class="feed-ic ${x.priority === 'high' ? 'f-bad' : x.priority === 'medium' ? 'f-dim' : 'f-ok'}">${x.priority[0].toUpperCase()}</div>
    <div><div class="t">${esc(x.text)}</div><div class="m">${esc(x.area)} · ${esc(x.priority)}</div></div></div>`).join('');
  if (tool === 'landing_page') return `<dl class="kv"><dt>hero</dt><dd><b>${esc(r.hero.headline)}</b><br>${esc(r.hero.sub)}</dd></dl>
    ${r.sections.map(s => `<div style="margin-top:6px"><b>${esc(s.title)}</b> — <span style="color:var(--dim)">${esc(s.text)}</span></div>`).join('')}`;
  if (tool === 'audience') return `<dl class="kv"><dt>primary</dt><dd>${esc(r.primary)}</dd></dl>
    ${r.segments.map(s => `<div style="margin-top:6px"><b>${esc(s.name)}</b> — <span style="color:var(--dim)">${esc(s.angle)}</span></div>`).join('')}
    <div class="mono" style="margin-top:8px;color:var(--dim)">Channels: ${r.channels.join(' · ')}</div>`;
  if (tool === 'analytics') return `<dl class="kv">${Object.entries(r.metrics).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v ?? '—')}</dd>`).join('')}
    <dt>verdict</dt><dd><span class="badge ${r.verdict === 'strong' ? 'b-ok' : r.verdict === 'healthy' ? 'b-info' : 'b-warn'}">${esc(r.verdict)}</span></dd>
    <dt>next</dt><dd>${esc(r.next_step)}</dd></dl>`;
  if (tool === 'posting_time') return `<dl class="kv">${r.best_windows.map(w => `<dt>${esc(w.channel)}</dt><dd>${esc(w.days)} · ${esc(w.time)}</dd>`).join('')}</dl>
    <div class="mono" style="color:var(--dim);margin-top:6px">${esc(r.note)}</div>`;
  return pre(r);
}
window.copyGrowth = (btn) => {
  try { const o = JSON.parse(btn.dataset.t); const s = typeof o.text === 'string' ? o.text : JSON.stringify(o, null, 2);
    navigator.clipboard?.writeText(s); toast('✓ Copied'); } catch { toast('copied'); }
};

VIEWS.settings = async () => {
  const m = ME.merchant;
  shell('settings', t('settings'), esc(m.name), `
  <div class="card"><h3>Business profile</h3>
    <dl class="kv">
      <dt>name</dt><dd>${esc(m.name)}</dd><dt>country</dt><dd>${esc(m.country)}</dd>
      <dt>currency</dt><dd>${esc(m.currency)}</dd><dt>msisdn</dt><dd class="mono">${esc(m.msisdn || '—')}</dd>
      <dt>plan</dt><dd>${esc(m.plan)}</dd><dt>brand colour</dt><dd><span style="display:inline-block;width:14px;height:14px;background:${esc(m.brand_color)};border-radius:4px;vertical-align:-2px"></span> ${esc(m.brand_color)} (used on customer receipts & emails)</dd>
    </dl></div>
  <div class="card" style="margin-top:14px"><h3>${t('language')}</h3>
    <p style="font-size:13px;color:var(--dim);margin-bottom:10px">The OS auto-detects your device language (LinguaAgent K-07). Override:</p>
    <div class="pill-row">
      <button class="pill ${!LANG ? 'on' : ''}" onclick="setLang('')">${t('auto')} — ${(navigator.language || 'fr')}</button>
      <button class="pill ${LANG === 'fr' ? 'on' : ''}" onclick="setLang('fr')">Français</button>
      <button class="pill ${LANG === 'en' ? 'on' : ''}" onclick="setLang('en')">English</button>
      <button class="pill" disabled>Lingala · Swahili · Wolof — per wave</button>
    </div></div>
  <div class="card" style="margin-top:14px"><h3>PWA</h3>
    <p style="font-size:13px;color:var(--dim)">Install KODA on your phone: browser menu → "Add to Home screen". Works offline for the console shell; verifications sync when back online.</p></div>
  <div class="card" style="margin-top:14px"><h3>Your data &amp; privacy</h3>
    <p style="font-size:13px;color:var(--dim)">Download everything KODA holds for your business, or delete your account. ${ME.user.role === 'owner' || ME.user.is_admin ? '' : '(Deletion is owner-only.)'}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost" onclick="exportMyData()">Download my data (JSON)</button>
      ${ME.user.role === 'owner' || ME.user.is_admin ? `<button class="btn btn-danger" onclick="deleteMyAccount()">Delete account</button>` : ''}
    </div></div>`);
};
window.exportMyData = async () => {
  try {
    const res = await fetch('/app/me/export', { headers: TOKEN() ? { authorization: `Bearer ${TOKEN()}` } : {} });
    if (!res.ok) throw new Error('export failed');
    const blob = await res.blob();
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'koda-my-data.json';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (e) { toast('✗ ' + e.message); }
};
window.deleteMyAccount = async () => {
  if (!confirm('Delete your KODA account and all its data? This cannot be undone.')) return;
  if (!confirm('Are you absolutely sure? Type OK on the next prompt.')) return;
  try { await api('/app/me/delete', { body: { confirm: true } }); localStorage.removeItem('koda_token'); ME = null; toast('Account deleted.'); location.hash = '#login'; }
  catch (e) { toast('✗ ' + e.message); }
};

const PLAN_KEYS = ['marche', 'boutique', 'commerce', 'plateforme', 'enterprise'];
const ROLE_KEYS = ['cashier', 'manager', 'owner'];
const ADMIN_TABS = [
  ['overview', 'Overview'], ['revenue', 'Revenue'], ['collections', 'Collections'],
  ['distributors', 'Distributors'], ['vouchers', 'Resellers & vouchers'], ['rails', 'Rails'],
  ['coverage', 'Coverage'], ['doors', 'Doors'], ['agents', 'AI agents'],
  ['fraud', 'Fraud & disputes'], ['verifications', 'Verifications'], ['devices', 'Devices'],
  ['health', 'System health'], ['audit', 'Audit log'],
];
const adminTabBar = (active) => `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:0 0 16px">
  ${ADMIN_TABS.map(([id, label]) => `<a href="#admin${id === 'overview' ? '' : '?tab=' + id}"
    style="font-family:var(--mono);font-size:12px;padding:7px 13px;border-radius:8px;text-decoration:none;
    ${active === id ? 'background:var(--gold);color:#0A1F17;font-weight:700' : 'background:var(--ink);color:var(--dim);border:1px solid var(--line)'}">${label}</a>`).join('')}
</div>`;

VIEWS.admin = async (params) => {
  if (!ME.user.is_admin) { location.hash = '#dashboard'; return; }
  const mid = params && params.get && params.get('m');
  if (mid) return adminMerchantDetail(mid);
  const tab = (params && params.get && params.get('tab')) || 'overview';
  if (tab === 'revenue') return adminRevenue();
  if (tab === 'collections') return adminCollections();
  if (tab === 'distributors') return adminDistributors();
  if (tab === 'vouchers') return adminResellers();
  if (tab === 'rails') return adminRails();
  if (tab === 'coverage') return adminCoverage();
  if (tab === 'doors') return adminDoors();
  if (tab === 'agents') return adminAgents();
  if (tab === 'fraud') return adminFraud();
  if (tab === 'verifications') return adminVerifications();
  if (tab === 'devices') return adminDevices();
  if (tab === 'health') return adminHealth();
  if (tab === 'audit') return adminAudit();
  const o = await api('/app/admin/overview');
  const merchants = await api('/app/admin/merchants');
  shell('admin', t('admin'), 'KODA staff — the whole fleet at a glance', adminTabBar('overview') + `
  <div class="grid g4">
    <div class="card stat"><b>${fmt(o.merchants)}</b><span>merchants · ${fmt(o.submerchants)} sub</span></div>
    <div class="card stat"><b>${fmt(o.receipts)}</b><span>verifications · ${fmt(o.volume)} volume</span></div>
    <div class="card stat"><b>${fmt(o.devices)}</b><span>active sentinels · ${fmt(o.quarantined)} quarantined SMS</span></div>
    <div class="card stat"><b>${fmt(o.openDisputes)}</b><span>open disputes · ${fmt(o.deliveries)} comms sent</span></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Operator coverage — <a href="#admin?tab=coverage" style="color:var(--gold)">see all ${fmt(o.coverage.total)} →</a></h3>
    <div class="grid g4" style="margin-top:6px">
      <div class="card stat"><b>${fmt(o.coverage.total)}</b><span>operators · ${fmt(o.coverage.countries)} countries</span></div>
      <div class="card stat"><b>${fmt(o.coverage.packed)}</b><span>precise packs · ${fmt(o.coverage.generic)} generic</span></div>
      <div class="card stat"><b>${fmt(o.coverage.byTier.A)}</b><span>Tier A (SMS-native)</span></div>
      <div class="card stat"><b>${fmt(o.coverage.addressable_families)}</b><span>addressable families</span></div>
    </div>
    <p style="font-size:12px;color:var(--dim);margin-top:10px">Precise (packed) operators: ${o.packedOperators.map(p => `<span class="mono">${esc(p.id)}</span>`).join(' · ')}</p>
  </div>
  <details class="card" style="margin-top:14px">
    <summary style="cursor:pointer;font-weight:700;color:var(--gold)">＋ Create a merchant account</summary>
    <p style="font-size:13px;color:var(--dim);margin:10px 0">Provision a business and its owner login directly — you get a temp password to hand over. Use this to onboard your first merchant (e.g. the Kinshasa till) or a platform (e.g. the event-ticket site).</p>
    <div style="display:grid;gap:8px;grid-template-columns:1fr 1fr;max-width:720px">
      <input id="cm-biz" placeholder="Business name" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <input id="cm-name" placeholder="Owner full name" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <input id="cm-email" placeholder="owner@business.cd" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <input id="cm-phone" placeholder="+243 … (mobile money)" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <select id="cm-plan" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
        ${PLAN_KEYS.map(p => `<option value="${p}">${p}</option>`).join('')}</select>
      <input id="cm-currency" placeholder="CDF" value="CDF" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <button class="btn btn-gold" onclick="adminCreateMerchant()">Create account</button>
    </div>
    <div id="cm-out" style="margin-top:10px"></div>
  </details>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>Merchants — click Manage to change plan, grant ACU, manage the team</h3>
    ${merchants.length ? `<table class="tbl">
    <tr><th>Name</th><th>Plan</th><th class="num">Verifs</th><th class="num">ACU</th><th>Seats</th><th>Status</th><th></th></tr>
    ${merchants.map(m => `<tr><td>${esc(m.name)}</td><td><span class="badge b-info">${m.plan}</span></td>
      <td class="num">${fmt(m.verifs)}</td><td class="num">${fmt(m.acu_balance)}</td><td class="num">${m.seats}</td>
      <td><span class="badge ${m.status === 'active' ? 'b-ok' : 'b-bad'}">${m.status}</span></td>
      <td style="white-space:nowrap"><button class="btn btn-gold btn-sm" onclick="location.hash='#admin?m=${m.id}'">Manage</button>
        <button class="btn btn-danger btn-sm" onclick="adminToggle('${m.id}')">${m.status === 'active' ? 'suspend' : 'restore'}</button></td></tr>`).join('')}
  </table>` : '<p style="color:var(--dim);font-size:13px">No merchants yet. They appear here as businesses sign up at /app.</p>'}</div>
  <div class="card" style="margin-top:14px"><h3>Latest verifications (all merchants)</h3>
    ${o.latest.length ? o.latest.map(r => `<div class="feed-row"><div class="feed-ic f-ok">✓</div>
      <div><div class="t">${esc(r.merchant)} · <span class="mono" style="font-size:12px">${esc(r.reference)}</span></div>
      <div class="m">${esc(r.mode)} · risk ${r.risk_score} · ${when(r.verified_at)}</div></div>
      <div class="amt">+${fmt(r.amount)}</div></div>`).join('') : '<p style="color:var(--dim);font-size:13px">No verifications yet.</p>'}
  </div>`);
};

async function adminMerchantDetail(mid) {
  const d = await api('/app/admin/merchants/' + mid);
  const m = d.merchant;
  shell('admin', esc(m.name), 'Admin — manage this merchant', `
  <a class="btn btn-ghost btn-sm" href="#admin">← All merchants</a>
  <div class="grid g4" style="margin-top:12px">
    <div class="card stat"><b>${acuFmt(m.acu_balance)}</b><span>ACU balance</span></div>
    <div class="card stat"><b>${esc(m.plan)}</b><span>plan · ${esc(m.country)}/${esc(m.currency)}</span></div>
    <div class="card stat"><b>${fmt(d.users.length)}</b><span>team members</span></div>
    <div class="card stat"><b><span class="badge ${m.status === 'active' ? 'b-ok' : 'b-bad'}">${m.status}</span></b><span>status</span></div>
  </div>
  <div class="grid" style="grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
    <div class="card"><h3>Change plan</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <select id="adm-plan" style="flex:1;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
          ${PLAN_KEYS.map(p => `<option value="${p}" ${p === m.plan ? 'selected' : ''}>${p}</option>`).join('')}
        </select>
        <button class="btn btn-gold" onclick="adminSetPlan('${m.id}')">Apply</button>
      </div></div>
    <div class="card"><h3>Grant / deduct ACU</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input id="adm-acu" type="number" placeholder="e.g. 500 (or -100)" style="flex:1;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
        <button class="btn btn-gold" onclick="adminGrantAcu('${m.id}')">Adjust</button>
      </div>
      <p style="font-size:12px;color:var(--dim);margin-top:8px">Positive credits, negative deducts. Admin-owned merchants are unlimited (∞).</p></div>
  </div>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>Team members</h3>
    <table class="tbl"><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr>
    ${d.users.map(u => `<tr>
      <td>${esc(u.name)}${u.is_admin ? ' <span class="badge b-info">admin</span>' : ''}</td>
      <td class="mono" style="font-size:12px">${esc(u.email)}</td>
      <td><select onchange="adminSetRole('${u.id}',this.value)" ${u.is_admin ? 'disabled' : ''} style="background:var(--ink);border:1px solid var(--line-strong);border-radius:6px;color:var(--text);padding:5px">
        ${ROLE_KEYS.map(r => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select></td>
      <td><span class="badge ${u.status === 'active' ? 'b-ok' : 'b-bad'}">${u.status}</span></td>
      <td style="white-space:nowrap">
        <button class="btn btn-ghost btn-sm" onclick="adminResetPw('${u.id}')">reset pw</button>
        ${u.is_admin ? '' : `<button class="btn btn-danger btn-sm" onclick="adminToggleUser('${u.id}','${m.id}')">${u.status === 'active' ? 'suspend' : 'restore'}</button>`}
      </td></tr>`).join('')}
    </table>
    <h3 style="margin-top:16px">Add a team member</h3>
    <div style="display:grid;gap:8px;grid-template-columns:1fr 1fr;max-width:640px">
      <input id="nu-name" placeholder="Full name" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <input id="nu-email" placeholder="email@example.com" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <select id="nu-role" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
        ${ROLE_KEYS.map(r => `<option value="${r}" ${r === 'cashier' ? 'selected' : ''}>${r}</option>`).join('')}</select>
      <button class="btn btn-gold" onclick="adminAddUser('${m.id}')">Add member</button>
    </div>
    <div id="nu-out" style="margin-top:10px"></div>
  </div>
  ${d.keys.length ? `<div class="card tbl-wrap" style="margin-top:14px"><h3>API keys</h3>
    <table class="tbl"><tr><th>Label</th><th>Prefix</th><th>Last4</th><th>Created</th></tr>
    ${d.keys.map(k => `<tr><td>${esc(k.label || '—')}</td><td class="mono">${esc(k.prefix)}</td><td class="mono">…${esc(k.last4)}</td><td>${when(k.created_at)}</td></tr>`).join('')}
    </table></div>` : ''}`);
}

// ---- 5 · Revenue & billing ----
async function adminRevenue() {
  const d = await api('/app/admin/revenue');
  shell('admin', 'Revenue', 'KODA staff — money in, ACU sold, top merchants', adminTabBar('revenue') + `
  <div class="grid g4">
    <div class="card stat"><b>$${fmt(d.mrr_usd)}</b><span>MRR · $${fmt(d.arr_usd)} ARR</span></div>
    <div class="card stat"><b>$${fmt(d.acu_revenue_usd)}</b><span>ACU sold · ${fmt(d.acu_sold)} ACU @ $${d.acu_price_usd}</span></div>
    <div class="card stat"><b>$${fmt(d.total_revenue_usd)}</b><span>total revenue (subs + ACU)</span></div>
    <div class="card stat"><b>${fmt(d.acu_burned)}</b><span>ACU consumed</span></div>
  </div>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>Revenue by plan</h3>
    <table class="tbl"><tr><th>Plan</th><th class="num">Merchants</th><th class="num">Unit $/mo</th><th class="num">Subtotal $/mo</th></tr>
    ${d.by_plan.map(p => `<tr><td><span class="badge b-info">${esc(p.plan)}</span></td><td class="num">${fmt(p.merchants)}</td><td class="num">$${fmt(p.unit_usd)}</td><td class="num">$${fmt(p.subtotal_usd)}</td></tr>`).join('') || '<tr><td colspan="4" style="color:var(--dim)">No merchants yet.</td></tr>'}
    </table></div>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>Top merchants by volume</h3>
    <table class="tbl"><tr><th>Merchant</th><th>Plan</th><th class="num">Verifs</th><th class="num">Volume</th><th class="num">ACU</th><th></th></tr>
    ${d.top_merchants.map(m => `<tr><td>${esc(m.name)}</td><td>${esc(m.plan)}</td><td class="num">${fmt(m.verifs)}</td><td class="num">${fmt(m.volume)}</td><td class="num">${fmt(m.acu_balance)}</td><td><button class="btn btn-gold btn-sm" onclick="location.hash='#admin?m=${m.id}'">Manage</button></td></tr>`).join('') || '<tr><td colspan="6" style="color:var(--dim)">No merchants yet.</td></tr>'}
    </table></div>
  ${d.outstanding.length ? `<div class="card tbl-wrap" style="margin-top:14px"><h3 class="bad">Negative balances (in grace / overdue)</h3>
    <table class="tbl"><tr><th>Merchant</th><th class="num">Balance</th></tr>
    ${d.outstanding.map(m => `<tr><td>${esc(m.name)}</td><td class="num bad">${fmt(m.acu_balance)}</td></tr>`).join('')}</table></div>` : ''}`);
}

// ---- Coverage: the real 235-operator registry ----
async function adminCoverage() {
  const d = await api('/app/admin/coverage');
  const c = d.coverage;
  const regions = Object.entries(c.byRegion || {}).sort((a, b) => b[1] - a[1]);
  shell('admin', 'Coverage', `KODA staff — ${fmt(c.total)} operators · ${fmt(c.countries)} countries`, adminTabBar('coverage') + `
  <div class="grid g4">
    <div class="card stat"><b>${fmt(c.total)}</b><span>operators · ${fmt(c.countries)} countries</span></div>
    <div class="card stat"><b>${fmt(c.packed)}</b><span>precise packs · ${fmt(c.generic)} generic</span></div>
    <div class="card stat"><b>${fmt(c.byTier.A)}/${fmt(c.byTier.B)}/${fmt(c.byTier.C)}</b><span>tier A / B / C</span></div>
    <div class="card stat"><b>${fmt(c.addressable_families)}</b><span>addressable families</span></div>
  </div>
  <div class="grid" style="grid-template-columns:1fr 1fr;gap:14px;margin-top:14px">
    <div class="card"><h3>By region</h3>${regions.map(([r, n]) => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0"><span class="mono">${esc(r)}</span><b>${fmt(n)}</b></div>`).join('')}</div>
    <div class="card"><h3>Top families (one grammar → many markets)</h3>${(d.families || []).slice(0, 12).map(f => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:3px 0"><span class="mono">${esc(f.family)} <span class="badge b-info">${esc(f.tier)}</span></span><b>${fmt(f.deployments)} dep · ${fmt(f.countries)} co</b></div>`).join('')}</div>
  </div>
  <div class="card" style="margin-top:14px">
    <h3>What "verifiable" honestly means — and why generic is safe</h3>
    <div style="font-size:13px;color:#C9C4B2;line-height:1.7">
      <div><span class="badge b-ok">precise</span> <b>Instant / auto-verify.</b> Hand-tuned parser anchored to the operator's exact SMS format; can auto-confirm with no human (fraud score &lt;0.15). Reliable today — the ${fmt(c.packed)} launch operators.</div>
      <div style="margin-top:6px"><span class="badge b-info">generic · SMS</span> <b>Assisted / you confirm.</b> The operator sends a confirmation SMS; the multilingual fallback pre-fills the amount &amp; reference and fraud-checks it, but it is <b>always routed to human review — never silently auto-approved</b> (generic adds +0.2 → the 0.15–0.6 "confirm-by-hand" band). Worst case the merchant just reads their own SMS (Door 1). Becomes "precise/instant" once we ship its pack (one pack upgrades a whole family — e.g. one <span class="mono">mtn_momo</span> pack lifts ~14 countries).</div>
      <div style="margin-top:6px"><span class="badge b-bad">not SMS-verifiable</span> Tier-C app/QR/bank-rail wallet (UPI, GCash, GoPay, Kaspi, Mercado Pago, Nequi, Yape…). No operator SMS to the SIM — <b>KODA can't verify these</b>, and the system blocks connecting them.</div>
      <div style="margin-top:8px;color:var(--dim)">Bottom line: a generic operator can never produce a false "verified" — the risk is contained to the ${fmt(c.packed)} precise packs, which are hand-verified. Generic is a safety net + a head-start for the merchant, not a blind approval.</div>
    </div></div>
  <div class="card" style="margin-top:14px"><h3>All operators (${fmt(d.operators.length)}) — ${fmt(d.operators.filter(o => o.tier !== 'C').length)} SMS-verifiable · ${fmt(d.operators.filter(o => o.tier === 'C').length)} app-rail (not verifiable)</h3>
    <input id="opq" placeholder="Filter by name / country / family…" oninput="adminFilterOps()" style="width:100%;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px;margin-bottom:10px">
    <div class="tbl-wrap"><table class="tbl" id="optbl"><tr><th>Operator</th><th>Country</th><th>Region</th><th>Currency</th><th>Family</th><th>Tier</th><th>Verification</th></tr>
    ${d.operators.map(o => { const method = o.parser === 'precise' ? ['precise', 'b-ok'] : o.tier === 'C' ? ['not SMS-verifiable', 'b-bad'] : ['generic · SMS', 'b-info']; return `<tr class="oprow" data-s="${esc((o.name + ' ' + o.country + ' ' + o.family + ' ' + o.id).toLowerCase())}">
      <td>${esc(o.name)} <span class="mono" style="font-size:11px;color:var(--dim)">${esc(o.id)}</span></td><td class="mono">${esc(o.country)}</td><td class="mono" style="font-size:11px">${esc(o.region)}</td>
      <td class="mono">${esc(o.currency)}</td><td class="mono" style="font-size:11px">${esc(o.family)}</td><td><span class="badge ${o.tier === 'A' ? 'b-ok' : o.tier === 'B' ? 'b-info' : 'b-bad'}">${esc(o.tier)}</span></td>
      <td><span class="badge ${method[1]}">${method[0]}</span></td></tr>`; }).join('')}
    </table></div></div>`);
}
window.adminFilterOps = () => {
  const q = (document.getElementById('opq').value || '').toLowerCase();
  document.querySelectorAll('#optbl .oprow').forEach(r => { r.style.display = r.dataset.s.includes(q) ? '' : 'none'; });
};

// ---- Collections dashboard (Billing Mesh) ----
async function adminCollections() {
  const d = await api('/app/admin/collections');
  const planPays = await api('/app/admin/plan-payments');
  const pendingPlans = planPays.filter(p => p.status !== 'settled');
  const treasury = (d.accounts.find(a => a.account_key === 'koda:treasury') || {}).balance_acu || 0;
  shell('admin', 'Collections', 'KODA staff — money in by rail · double-entry ledger', adminTabBar('collections') + `
  ${pendingPlans.length ? `<div class="card" style="border-color:var(--gold)"><h3>Plan payments awaiting confirmation (${fmt(pendingPlans.length)})</h3>
    <p style="font-size:13px;color:var(--dim)">A merchant paid for a plan via KODA mobile money. Confirm once you see the payment on the KODA SIM to activate their plan.</p>
    <table class="tbl"><tr><th>When</th><th>Merchant</th><th>Plan</th><th>Rail</th><th class="num">Amount</th><th></th></tr>
    ${pendingPlans.map(p => `<tr><td>${when(p.created_at)}</td><td>${esc(p.merchant)}</td><td><span class="badge b-info">${esc(p.plan_key)}</span></td><td class="mono">${esc(p.rail)}</td><td class="num">$${fmt(p.total_usd)}</td>
      <td><button class="btn btn-gold btn-sm" onclick="adminSettleTopup('${p.id}')">confirm & activate</button></td></tr>`).join('')}
    </table></div>` : ''}
  <div class="grid g4">
    <div class="card stat"><b>$${fmt(d.settled_totals.gross)}</b><span>settled gross · ${fmt(d.settled_totals.n)} topups</span></div>
    <div class="card stat"><b>$${fmt(d.settled_totals.net)}</b><span>KODA net (4× cost)</span></div>
    <div class="card stat"><b>${fmt(treasury)}</b><span>koda:treasury ACU</span></div>
    <div class="card stat"><b>${d.reconcile.balanced ? '<span class="ok">● balanced</span>' : '<span class="bad">● IMBALANCE</span>'}</b><span>ledger Σ=${d.reconcile.sum}</span></div>
  </div>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>Topups by rail &amp; status</h3>
    ${d.by_rail.length ? `<table class="tbl"><tr><th>Rail</th><th>Status</th><th class="num">Count</th><th class="num">Gross $</th><th class="num">Net $</th><th class="num">ACU</th></tr>
    ${d.by_rail.map(r => `<tr><td class="mono">${esc(r.rail)}</td><td><span class="badge ${r.status === 'settled' ? 'b-ok' : r.status === 'failed' ? 'b-bad' : 'b-info'}">${esc(r.status)}</span></td><td class="num">${fmt(r.n)}</td><td class="num">$${fmt(r.gross)}</td><td class="num">$${fmt(r.net)}</td><td class="num">${fmt(r.acu)}</td></tr>`).join('')}
    </table>` : '<p style="color:var(--dim);font-size:13px">No collections yet. Topups appear here as merchants pay via a rail, distributor, or voucher.</p>'}</div>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>Billing accounts</h3>
    <table class="tbl"><tr><th>Account</th><th class="num">Balance (ACU)</th></tr>
    ${d.accounts.length ? d.accounts.map(a => `<tr><td class="mono">${esc(a.account_key)}</td><td class="num">${fmt(a.balance_acu)}</td></tr>`).join('') : '<tr><td colspan="2" style="color:var(--dim)">No ledger accounts yet.</td></tr>'}
    </table></div>
  ${d.ledger.length ? `<div class="card tbl-wrap" style="margin-top:14px"><h3>Recent ledger entries</h3>
    <table class="tbl"><tr><th>When</th><th>Account</th><th>Type</th><th class="num">Δ ACU</th><th class="num">Balance after</th></tr>
    ${d.ledger.map(l => `<tr><td>${when(l.created_at)}</td><td class="mono" style="font-size:11px">${esc(l.account_key)}</td><td class="mono" style="font-size:11px">${esc(l.entry_type)}</td><td class="num ${l.acu_delta < 0 ? 'bad' : 'ok'}">${l.acu_delta > 0 ? '+' : ''}${fmt(l.acu_delta)}</td><td class="num">${fmt(l.balance_after)}</td></tr>`).join('')}
    </table></div>` : ''}`);
}

window.adminSettleTopup = async (id) => { try { const r = await api(`/app/admin/topups/${id}/settle`, { body: {} }); toast(r.plan_activated ? '✓ plan activated: ' + r.plan_activated : '✓ settled'); route(); } catch (e) { toast('✗ ' + e.message); } };

// ---- Distributors (field agents) ----
async function adminDistributors() {
  const rows = await api('/app/admin/distributors');
  shell('admin', 'Distributors', 'KODA staff — field agents who sell prepaid ACU near merchants', adminTabBar('distributors') + `
  <details class="card"><summary style="cursor:pointer;font-weight:700;color:var(--gold)">＋ Create a distributor (KD)</summary>
    <p style="font-size:13px;color:var(--dim);margin:10px 0">A distributor holds prepaid ACU float and sells it to merchants near them (pay-an-agent rail). Fund their float, then merchants can top up through them.</p>
    <div style="display:grid;gap:8px;grid-template-columns:1fr 1fr;max-width:640px">
      <input id="kd-name" placeholder="Distributor name" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <input id="kd-country" placeholder="Country (CD)" value="CD" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <input id="kd-msisdn" placeholder="+243 … (their mobile-money pay-to)" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <button class="btn btn-gold" onclick="adminCreateKd()">Create distributor</button>
    </div><div id="kd-out" style="margin-top:10px"></div></details>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>Distributors (${fmt(rows.length)})</h3>
    ${rows.length ? `<table class="tbl"><tr><th>Name</th><th>Country</th><th>Pay-to</th><th class="num">Float ACU</th><th class="num">Sold</th><th>Status</th><th></th></tr>
    ${rows.map(k => `<tr><td>${esc(k.name)}</td><td class="mono">${esc(k.country)}</td><td class="mono" style="font-size:11px">${esc(k.msisdn || '—')}</td>
      <td class="num">${fmt(k.float_acu)}</td><td class="num">${fmt(k.sold_acu)} (${fmt(k.sales)})</td>
      <td><span class="badge ${k.status === 'active' ? 'b-ok' : 'b-bad'}">${esc(k.status)}</span></td>
      <td style="white-space:nowrap"><button class="btn btn-gold btn-sm" onclick="adminFundKd('${k.id}','${esc(k.name)}')">fund</button>
        <button class="btn btn-danger btn-sm" onclick="adminFreezeKd('${k.id}')">${k.status === 'frozen' ? 'activate' : 'freeze'}</button></td></tr>`).join('')}
    </table>` : '<p style="color:var(--dim);font-size:13px">No distributors yet. Create one above, then fund their float.</p>'}</div>`);
}
window.adminCreateKd = async () => {
  const out = document.getElementById('kd-out');
  try { const r = await api('/app/admin/distributors', { body: { name: v('kd-name'), country: v('kd-country') || 'CD', msisdn: v('kd-msisdn') } });
    out.innerHTML = `<div class="badge b-ok">✓ created ${esc(r.id)}</div>`; setTimeout(route, 1500); }
  catch (e) { out.innerHTML = `<div class="badge b-bad">✗ ${esc(e.message)}</div>`; }
};
window.adminFundKd = async (id, name) => {
  const acu = prompt('Fund ' + name + ' — how many ACU of float to add?', '1000');
  if (!acu) return;
  try { const r = await api(`/app/admin/distributors/${id}/fund`, { body: { acu: Number(acu) } }); toast('✓ float now ' + fmt(r.float)); route(); }
  catch (e) { toast('✗ ' + e.message); }
};
window.adminFreezeKd = async (id) => { try { await api(`/app/admin/distributors/${id}/freeze`, { body: {} }); toast('✓ updated'); route(); } catch (e) { toast('✗ ' + e.message); } };

// ---- Resellers & vouchers ----
async function adminResellers() {
  const resellers = await api('/app/admin/resellers');
  const batches = await api('/app/admin/vouchers');
  shell('admin', 'Resellers & vouchers', 'KODA staff — Ed25519-signed prepaid ACU vouchers', adminTabBar('vouchers') + `
  <details class="card"><summary style="cursor:pointer;font-weight:700;color:var(--gold)">＋ Add a reseller</summary>
    <div style="display:grid;gap:8px;grid-template-columns:1fr 1fr;max-width:640px;margin-top:10px">
      <input id="rs-name" placeholder="Legal name" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <input id="rs-country" placeholder="Country (CD)" value="CD" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <button class="btn btn-gold" onclick="adminCreateReseller()">Add reseller</button>
    </div><div id="rs-out" style="margin-top:10px"></div></details>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>Resellers (${fmt(resellers.length)})</h3>
    ${resellers.length ? `<table class="tbl"><tr><th>Legal name</th><th>Country</th><th>Status</th><th class="num">Vouchers</th><th></th></tr>
    ${resellers.map(r => `<tr><td>${esc(r.legal_name)}</td><td class="mono">${esc(r.country)}</td><td><span class="badge ${r.status === 'ACTIVE' ? 'b-ok' : 'b-info'}">${esc(r.status)}</span></td><td class="num">${fmt(r.vouchers)}</td>
      <td><button class="btn btn-gold btn-sm" onclick="adminIssueVouchers('${r.id}','${esc(r.legal_name)}')">issue batch</button></td></tr>`).join('')}
    </table>` : '<p style="color:var(--dim);font-size:13px">No resellers yet. Add one, then issue voucher batches.</p>'}</div>
  <div id="vb-out"></div>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>Voucher batches (${fmt(batches.length)})</h3>
    ${batches.length ? `<table class="tbl"><tr><th>Batch</th><th>Product</th><th class="num">ACU</th><th>Lock</th><th class="num">Total</th><th>Dormant/Active/Redeemed</th><th></th></tr>
    ${batches.map(b => `<tr><td class="mono" style="font-size:11px">${esc(b.batch_id)}</td><td class="mono">${esc(b.product_code)}</td><td class="num">${fmt(b.acu_amount)}</td><td class="mono">${esc(b.country_lock || '—')}</td><td class="num">${fmt(b.n)}</td>
      <td class="mono" style="font-size:12px">${fmt(b.dormant)}/${fmt(b.active)}/${fmt(b.redeemed)}</td>
      <td>${b.dormant > 0 ? `<button class="btn btn-gold btn-sm" onclick="adminActivateBatch('${esc(b.batch_id)}')">activate</button>` : ''}</td></tr>`).join('')}
    </table>` : '<p style="color:var(--dim);font-size:13px">No voucher batches yet.</p>'}</div>`);
}
window.adminCreateReseller = async () => {
  const out = document.getElementById('rs-out');
  try { const r = await api('/app/admin/resellers', { body: { legal_name: v('rs-name'), country: v('rs-country') || 'CD' } });
    out.innerHTML = `<div class="badge b-ok">✓ created ${esc(r.id)}</div>`; setTimeout(route, 1500); }
  catch (e) { out.innerHTML = `<div class="badge b-bad">✗ ${esc(e.message)}</div>`; }
};
window.adminIssueVouchers = async (id, name) => {
  const qty = prompt('Issue vouchers for ' + name + ' — how many?', '10');
  if (!qty) return;
  const acu = prompt('ACU value per voucher?', '100');
  if (!acu) return;
  try {
    const r = await api(`/app/admin/resellers/${id}/vouchers`, { body: { quantity: Number(qty), acu_amount: Number(acu), activate: true } });
    const pins = (r.pins || r.vouchers || []).map(p => typeof p === 'string' ? p : (p.pin || p)).join('<br>');
    document.getElementById('vb-out').innerHTML = `<div class="card" style="margin-top:14px;border-color:var(--gold)"><h3 class="ok">✓ ${fmt(r.count || (r.pins || []).length)} vouchers issued — PINs shown once</h3><div class="mono" style="font-size:12px;line-height:1.9;word-break:break-all">${pins || '(see batch — PINs delivered to reseller)'}</div></div>`;
    setTimeout(route, 6000);
  } catch (e) { toast('✗ ' + e.message); }
};
window.adminActivateBatch = async (batch) => { try { const r = await api(`/app/admin/vouchers/${batch}/activate`, { body: {} }); toast('✓ activated ' + fmt(r.activated)); route(); } catch (e) { toast('✗ ' + e.message); } };

// ---- Rails config ----
async function adminRails() {
  const d = await api('/app/admin/rails');
  shell('admin', 'Rails', 'KODA staff — collection rails & pricing law', adminTabBar('rails') + `
  <div class="grid g4">
    <div class="card stat"><b>${d.acu_markup}×</b><span>ACU markup (over cost)</span></div>
    <div class="card stat"><b>$${d.acu_price_usd}</b><span>ACU retail price</span></div>
    <div class="card stat"><b>$${d.unit_cost_usd}</b><span>provider unit cost</span></div>
    <div class="card stat"><b>${d.rails.filter(r => r.live).length}/${d.rails.length}</b><span>rails live</span></div>
  </div>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>Collection rails</h3>
    <table class="tbl"><tr><th>Rail</th><th class="num">Fee %</th><th>Flow</th><th>Live</th><th>Provider key</th><th>Webhook secret</th></tr>
    ${d.rails.map(r => `<tr><td>${esc(r.label)} <span class="mono" style="font-size:11px;color:var(--dim)">${esc(r.code)}</span></td>
      <td class="num">${(r.fee_pct * 100).toFixed(1)}%</td><td class="mono" style="font-size:11px">${esc(r.flow)}</td>
      <td><span class="badge ${r.live ? 'b-ok' : 'b-bad'}">${r.live ? 'live' : 'off'}</span></td>
      <td>${r.provider_key ? (r.provider_configured ? '<span class="ok">● set</span>' : '<span class="warn">● missing</span>') + ' <span class="mono" style="font-size:10px">' + esc(r.provider_key) + '</span>' : '<span class="mono" style="font-size:11px;color:var(--dim)">n/a</span>'}</td>
      <td>${r.webhook_secret_set ? '<span class="ok">● set</span>' : '<span class="warn">● not set</span>'}</td></tr>`).join('')}
    </table>
    <p style="font-size:12px;color:var(--dim);margin-top:10px">Rails are configured in code + env (provider keys, webhook secrets). A rail with <code>live:false</code> (e.g. BitriPay) never appears to merchants. Fees are passed through to the merchant — KODA's margin is always ≥100%.</p></div>`);
}

// ---- Doors status ----
async function adminDoors() {
  const d = await api('/app/admin/doors');
  shell('admin', 'Doors', 'KODA staff — the 5 doors into the engine & how each goes live', adminTabBar('doors') + `
  <div class="card"><h3>Sentinel ingestion (feeds every door)</h3>
    <p style="font-size:14px">${fmt(d.sentinel.active_devices)} active / ${fmt(d.sentinel.total_devices)} devices · <span style="color:var(--dim)">${esc(d.sentinel.requires)}</span></p></div>
  ${d.doors.map(door => `<div class="card" style="margin-top:12px">
    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <h3 style="margin:0">Door ${door.id} · ${esc(door.name)}</h3>
      <span class="badge ${door.live ? 'b-ok' : 'b-info'}">${esc(door.status)}</span></div>
    <p style="font-size:13px;color:var(--dim);margin:6px 0 0"><span class="mono">${esc(door.endpoint)}</span></p>
    <p style="font-size:13px;margin:6px 0 0"><b>To go live:</b> ${esc(door.requires)}</p>
    <p style="font-size:12px;color:var(--dim);margin:4px 0 0">${esc(door.note)}</p></div>`).join('')}
  <div class="card" style="margin-top:12px"><h3>Config flags</h3>
    <dl class="kv">
      <dt>META_WA_TOKEN</dt><dd>${d.config.meta_wa_token ? '<span class="ok">● set</span>' : '<span class="warn">● not set</span>'}</dd>
      <dt>META_WA_PHONE_ID</dt><dd>${d.config.meta_wa_phone_id ? '<span class="ok">● set</span>' : '<span class="warn">● not set</span>'}</dd>
      <dt>META_WA_APP_SECRET</dt><dd>${d.config.meta_wa_app_secret ? '<span class="ok">● set</span>' : '<span class="warn">● not set</span>'}</dd>
      <dt>SMS_GATEWAY_KEY</dt><dd>${d.config.sms_gateway_key ? '<span class="ok">● set</span>' : '<span class="warn">● not set</span>'}</dd>
    </dl></div>`);
}

// ---- AI agents ----
async function adminAgents() {
  const d = await api('/app/admin/agents');
  shell('admin', 'AI agents', 'KODA staff — the runnable agent mesh & ACU costs', adminTabBar('agents') + `
  <div class="card tbl-wrap"><h3>Runnable agents (API: /v1/agents)</h3>
    <table class="tbl"><tr><th>ID</th><th>Agent</th><th>Type</th><th class="num">ACU</th></tr>
    ${d.runnable.map(a => `<tr><td class="mono">${esc(a.id)}</td><td>${esc(a.label)}</td><td class="mono">${esc(a.type)}</td><td class="num">${a.acu}</td></tr>`).join('')}
    </table></div>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>Growth engine (K-11) tools</h3>
    <table class="tbl"><tr><th>Tool</th><th class="num">ACU</th></tr>
    ${d.growth.map(g => `<tr><td>${esc(g.label)} <span class="mono" style="font-size:11px;color:var(--dim)">${esc(g.id)}</span></td><td class="num">${g.acu}</td></tr>`).join('')}
    </table></div>
  <div class="card" style="margin-top:14px"><h3>SEO Autopilot (${esc(d.seo.id)})</h3>
    <p style="font-size:13px">AI gateway: ${d.seo.ai_gateway ? '<span class="ok">● configured</span>' : '<span class="warn">● not configured (set ANTHROPIC_API_KEY / GEMINI_API_KEY / OPENAI_API_KEY)</span>'}</p></div>`);
}

// ---- 6 · Fraud & disputes ----
async function adminFraud() {
  const f = await api('/app/admin/fraud');
  const disputes = await api('/app/admin/disputes');
  shell('admin', 'Fraud & disputes', 'KODA staff — quarantine, high-risk payments, open disputes', adminTabBar('fraud') + `
  <div class="card tbl-wrap"><h3>Quarantined SMS (${f.quarantined.length})</h3>
    ${f.quarantined.length ? `<table class="tbl"><tr><th>When</th><th>Merchant</th><th>Operator</th><th>Ref</th><th class="num">Amount</th><th>Chain</th><th></th></tr>
    ${f.quarantined.map(s => `<tr><td>${when(s.received_at)}</td><td>${esc(s.merchant)}</td><td class="mono">${esc(s.operator)}</td><td class="mono">${esc(s.ref_code || '—')}</td><td class="num">${fmt(s.amount)} ${esc(s.currency || '')}</td><td>${s.chain_ok ? '✓' : '<span class="bad">broken</span>'}</td><td><button class="btn btn-ghost btn-sm" onclick="adminToggleSms('${s.id}')">release</button></td></tr>`).join('')}
    </table>` : '<p style="color:var(--dim);font-size:13px">No quarantined SMS. ✓</p>'}</div>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>High-risk verified payments (${f.high_risk.length})</h3>
    ${f.high_risk.length ? `<table class="tbl"><tr><th>When</th><th>Merchant</th><th>Ref</th><th class="num">Amount</th><th class="num">Risk</th><th>Mode</th></tr>
    ${f.high_risk.map(r => `<tr><td>${when(r.verified_at)}</td><td>${esc(r.merchant)}</td><td class="mono">${esc(r.reference)}</td><td class="num">${fmt(r.amount)} ${esc(r.currency)}</td><td class="num warn">${(r.risk_score * 100).toFixed(0)}%</td><td>${esc(r.mode)}</td></tr>`).join('')}
    </table>` : '<p style="color:var(--dim);font-size:13px">No high-risk payments. ✓</p>'}</div>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>Open disputes (${disputes.length})</h3>
    ${disputes.length ? `<table class="tbl"><tr><th>When</th><th>Merchant</th><th>Ref</th><th>Reason</th><th></th></tr>
    ${disputes.map(x => `<tr><td>${when(x.created_at)}</td><td>${esc(x.merchant)}</td><td class="mono">${esc(x.reference || '—')}</td><td>${esc(x.reason)}</td>
      <td style="white-space:nowrap"><button class="btn btn-gold btn-sm" onclick="adminResolveDispute('${x.id}','accepted')">accept</button>
      <button class="btn btn-danger btn-sm" onclick="adminResolveDispute('${x.id}','rejected')">reject</button></td></tr>`).join('')}
    </table>` : '<p style="color:var(--dim);font-size:13px">No open disputes. ✓</p>'}</div>`);
}
window.adminToggleSms = async (id) => { try { await api(`/app/admin/sms/${id}/quarantine`, { body: {} }); toast('✓ updated'); route(); } catch (e) { toast('✗ ' + e.message); } };
window.adminResolveDispute = async (id, decision) => { try { await api(`/app/admin/disputes/${id}/resolve`, { body: { decision } }); toast('✓ ' + decision); route(); } catch (e) { toast('✗ ' + e.message); } };

// ---- 7 · Verifications explorer ----
async function adminVerifications(qstr) {
  const term = qstr != null ? qstr : '';
  const d = await api('/app/admin/receipts' + (term ? '?q=' + encodeURIComponent(term) : ''));
  shell('admin', 'Verifications', 'KODA staff — search & export every verified payment', adminTabBar('verifications') + `
  <div class="card"><div style="display:flex;gap:8px;flex-wrap:wrap">
    <input id="rq" placeholder="Search reference or operator…" value="${esc(term)}" style="flex:1;min-width:200px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
    <button class="btn btn-gold" onclick="adminSearchReceipts()">Search</button>
    <button class="btn btn-ghost" onclick="adminExportReceipts('${esc(term)}')">Export CSV</button>
  </div></div>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>${fmt(d.count)} results</h3>
    ${d.receipts.length ? `<table class="tbl"><tr><th>When</th><th>Merchant</th><th>Ref</th><th class="num">Amount</th><th>Operator</th><th class="num">Risk</th><th>Mode</th></tr>
    ${d.receipts.map(r => `<tr><td>${when(r.verified_at)}</td><td>${esc(r.merchant)}</td><td class="mono">${esc(r.reference)}</td><td class="num">${fmt(r.amount)} ${esc(r.currency)}</td><td class="mono">${esc(r.operator || '—')}</td><td class="num">${(r.risk_score * 100).toFixed(0)}%</td><td>${esc(r.mode)}</td></tr>`).join('')}
    </table>` : '<p style="color:var(--dim);font-size:13px">No verifications match.</p>'}</div>`);
}
window.adminSearchReceipts = () => adminVerifications(v('rq'));
window.adminExportReceipts = async (term) => {
  try {
    const res = await fetch('/app/admin/receipts?format=csv' + (term ? '&q=' + encodeURIComponent(term) : ''),
      { headers: TOKEN() ? { authorization: `Bearer ${TOKEN()}` } : {} });
    if (!res.ok) throw new Error('export failed');
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'koda-receipts.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  } catch (e) { toast('✗ ' + e.message); }
};

// ---- 7b · Sentinel devices ----
async function adminDevices() {
  const rows = await api('/app/admin/devices');
  shell('admin', 'Sentinel devices', 'KODA staff — every SIM-reader device across the fleet', adminTabBar('devices') + `
  <div class="card tbl-wrap"><h3>${fmt(rows.length)} devices</h3>
    ${rows.length ? `<table class="tbl"><tr><th>Label</th><th>Merchant</th><th>Operator</th><th>SIM</th><th>Status</th><th class="num">Health</th><th>Last seen</th><th></th></tr>
    ${rows.map(d => `<tr><td>${esc(d.label)}</td><td>${esc(d.merchant)}</td><td class="mono">${esc(d.operator)}</td><td class="mono">${esc(d.sim_msisdn || '—')}</td>
      <td><span class="badge ${d.status === 'active' ? 'b-ok' : d.status === 'revoked' ? 'b-bad' : 'b-info'}">${esc(d.status)}</span></td>
      <td class="num">${((d.parse_health ?? 1) * 100).toFixed(0)}%</td><td>${d.last_seen ? when(d.last_seen) : '—'}</td>
      <td><button class="btn btn-danger btn-sm" onclick="adminRevokeDevice('${d.id}')">${d.status === 'revoked' ? 'restore' : 'revoke'}</button></td></tr>`).join('')}
    </table>` : '<p style="color:var(--dim);font-size:13px">No devices enrolled yet. They appear when a merchant installs Sentinel.</p>'}</div>`);
}
window.adminRevokeDevice = async (id) => { try { await api(`/app/admin/devices/${id}/revoke`, { body: {} }); toast('✓ updated'); route(); } catch (e) { toast('✗ ' + e.message); } };

// ---- 8 · System health ----
async function adminHealth() {
  const h = await api('/app/admin/health');
  const ok = (b) => b ? '<span class="ok">●</span>' : '<span class="bad">●</span>';
  const days = Math.floor(h.uptime_s / 86400), hrs = Math.floor((h.uptime_s % 86400) / 3600), mins = Math.floor((h.uptime_s % 3600) / 60);
  shell('admin', 'System health', 'KODA staff — operations & integrity', adminTabBar('health') + `
  <div class="grid g4">
    <div class="card stat"><b>${ok(h.db === 'up')} ${esc(h.db)}</b><span>database</span></div>
    <div class="card stat"><b>${ok(h.reconcile.balanced)} ${h.reconcile.balanced ? 'balanced' : 'IMBALANCE'}</b><span>billing ledger (Σ=${h.reconcile.sum})</span></div>
    <div class="card stat"><b>${days}d ${hrs}h ${mins}m</b><span>uptime · ${esc(h.node)}</span></div>
    <div class="card stat"><b>${ok(h.smtp_configured)} ${h.comms_live ? 'live' : 'sandbox'}</b><span>email ${h.smtp_configured ? '(SMTP)' : '(not set)'}</span></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Build & config</h3>
    <dl class="kv"><dt>build</dt><dd class="mono">${esc(h.build.sha)} · ${esc(h.build.date)}</dd>
    <dt>backups</dt><dd>${h.backup.dir_configured ? (h.backup.last_backup ? '✓ last ' + when(h.backup.last_backup) : '⚠ configured, none yet') : '⚠ not configured (set KODA_BACKUP_DIR)'}</dd>
    <dt>dead webhooks</dt><dd>${fmt(h.counts.webhooks_dead)}</dd></dl></div>
  <div class="card" style="margin-top:14px"><h3>Live counts</h3>
    <div class="grid g4">
      <div class="card stat"><b>${fmt(h.counts.merchants)}</b><span>merchants</span></div>
      <div class="card stat"><b>${fmt(h.counts.receipts)}</b><span>verifications</span></div>
      <div class="card stat"><b class="${h.counts.quarantined ? 'warn' : ''}">${fmt(h.counts.quarantined)}</b><span>quarantined SMS</span></div>
      <div class="card stat"><b class="${h.counts.open_disputes ? 'warn' : ''}">${fmt(h.counts.open_disputes)}</b><span>open disputes</span></div>
    </div></div>`);
}

// ---- 8b · Audit log ----
async function adminAudit() {
  const rows = await api('/app/admin/audit');
  shell('admin', 'Audit log', 'KODA staff — who did what, when', adminTabBar('audit') + `
  <div class="card tbl-wrap"><h3>${fmt(rows.length)} recent actions</h3>
    ${rows.length ? `<table class="tbl"><tr><th>When</th><th>Actor</th><th>Action</th><th>Detail</th></tr>
    ${rows.map(a => `<tr><td>${when(a.created_at)}</td><td class="mono" style="font-size:12px">${esc(a.actor_email || a.user_id || 'system')}</td><td class="mono">${esc(a.action)}</td><td class="mono" style="font-size:11px;color:var(--dim)">${esc((a.detail || '').slice(0, 120))}</td></tr>`).join('')}
    </table>` : '<p style="color:var(--dim);font-size:13px">No audited actions yet.</p>'}</div>`);
}

window.adminCreateMerchant = async () => {
  const out = document.getElementById('cm-out');
  const body = { business: v('cm-biz'), name: v('cm-name'), email: v('cm-email'),
    phone: v('cm-phone'), plan: v('cm-plan'), currency: v('cm-currency') || 'CDF' };
  if (!body.business || !body.name || !body.email) { out.innerHTML = '<div class="badge b-bad">Business, owner name and email are required.</div>'; return; }
  try {
    const r = await api('/app/admin/merchants', { body });
    out.innerHTML = `<div class="badge b-ok" style="line-height:1.6">✓ Created <b>${esc(r.merchant.name)}</b> · owner <span class="mono">${esc(r.owner_email)}</span>${r.temp_password ? ` · temp password: <span class="mono">${esc(r.temp_password)}</span> — share it securely` : ''}</div>`;
    setTimeout(route, 2500);
  } catch (e) { out.innerHTML = `<div class="badge b-bad">✗ ${esc(e.message)}</div>`; }
};
window.adminSetPlan = async (id) => {
  try { const r = await api(`/app/admin/merchants/${id}/plan`, { body: { plan: v('adm-plan') } }); toast('✓ plan → ' + r.plan); route(); }
  catch (e) { toast('✗ ' + e.message); }
};
window.adminGrantAcu = async (id) => {
  const amount = Number(v('adm-acu'));
  if (!amount) return toast('enter an amount');
  try { const r = await api(`/app/admin/merchants/${id}/acu`, { body: { amount } }); toast('✓ balance ' + fmt(r.balance)); route(); }
  catch (e) { toast('✗ ' + e.message); }
};
window.adminSetRole = async (uid, role) => {
  try { await api(`/app/admin/users/${uid}/role`, { body: { role } }); toast('✓ role → ' + role); }
  catch (e) { toast('✗ ' + e.message); }
};
window.adminResetPw = async (uid) => {
  try { const r = await api(`/app/admin/users/${uid}/reset`, { body: {} });
    toast('✓ temp password: ' + r.temp_password, 8000); }
  catch (e) { toast('✗ ' + e.message); }
};
window.adminToggleUser = async (uid, mid) => {
  try { await api(`/app/admin/users/${uid}/suspend`, { body: {} }); route(); }
  catch (e) { toast('✗ ' + e.message); }
};
window.adminAddUser = async (mid) => {
  const out = document.getElementById('nu-out');
  try {
    const r = await api(`/app/admin/merchants/${mid}/users`, { body: { name: v('nu-name'), email: v('nu-email'), role: v('nu-role') } });
    out.innerHTML = `<div class="badge b-ok">✓ added · temp password: <span class="mono">${esc(r.temp_password)}</span> — share it securely</div>`;
    setTimeout(route, 2500);
  } catch (e) { out.innerHTML = `<div class="badge b-bad">✗ ${esc(e.message)}</div>`; }
};
window.adminToggle = async (id) => { await api(`/app/admin/merchants/${id}/suspend`, { body: {} }); route(); };

boot();
