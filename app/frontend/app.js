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
  manager: ['dashboard', 'verify', 'feed', 'receipts', 'receipt', 'disputes', 'devices', 'comms', 'settings'],
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
  if (!ME && !['login', 'signup'].includes(hash.split('?')[0])) { location.hash = '#login'; return; }
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
    <div class="field"><label>Email</label><input id="em" type="email" value="demo@koda.africa"></div>
    <div class="field"><label>Password</label><input id="pw" type="password" value="koda-demo"></div>
    <button class="btn btn-gold" style="width:100%" onclick="doLogin()">${t('signin')} →</button>
    <p style="margin-top:16px">No account? <a href="#signup" style="color:var(--gold)">${t('signup')}</a>
    · <span class="mono" style="font-size:11px">admin@koda.africa / koda-admin</span></p>`);
};
VIEWS.signup = (params) => {
  root.innerHTML = authCard(`
    <h1>${t('signup')}</h1><p>Three doors, one engine. Start free on Marché.</p>
    <div class="field"><label>Business name</label><input id="biz" placeholder="Maison Kivu"></div>
    <div class="field"><label>Your name</label><input id="nm"></div>
    <div class="field"><label>Email</label><input id="em" type="email"></div>
    <div class="field"><label>Mobile money number</label><input id="ph" placeholder="+243 ..."></div>
    <div class="field"><label>Password</label><input id="pw" type="password"></div>
    <button class="btn btn-gold" style="width:100%" onclick="doSignup('${esc(params.get('plan') || '')}')">${t('signup')} →</button>
    <p style="margin-top:16px"><a href="#login" style="color:var(--gold)">${t('signin')}</a></p>`);
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
    if (plan && plan !== 'marche') await api('/app/billing/plan', { body: { plan } }).catch(() => {});
    ME = await api('/app/me'); location.hash = '#dashboard'; toast('✓ Welcome to KODA');
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
  </div>
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
  toast(`✓ Enrolled — code ${r.enrol_code} (scan in Sentinel app)`); route();
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
      ${b.packs.map(p => `<button class="btn btn-ghost" onclick="topup(${p.usd})">$${p.usd} → ${fmt(p.acu)} ACU</button>`).join('')}
    </div>
    <div id="topup-out" style="margin-top:14px"></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>${t('change_plan')}</h3>
    <div class="pill-row">${plans.map(p => `<button class="pill ${b.plan.label.toLowerCase() === p ? 'on' : ''}" onclick="setPlan('${p}')">${p}</button>`).join('')}</div>
    <div class="mono" style="font-size:11.5px;color:var(--dim)">Marché $0 · Boutique $19 · Commerce $79 · Plateforme $399 · Enterprise custom — one ladder, all three doors.</div>
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
window.setPlan = async (p) => { await api('/app/billing/plan', { body: { plan: p } }); ME = await api('/app/me'); toast('✓ Plan: ' + p); route(); };

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
      <td><span class="badge b-info">${esc(u.role)}</span></td>
      <td><span class="badge ${u.status === 'active' ? 'b-ok' : 'b-bad'}">${esc(u.status)}</span></td></tr>`).join('')}
  </table></div>
  <div class="card" style="margin-top:14px"><h3>Audit trail</h3>
    ${d.audit.slice(0, 15).map(a => `<div class="feed-row"><div class="feed-ic f-dim">·</div>
      <div><div class="t">${esc(a.action)} <span style="color:var(--dim)">· ${esc(a.name || 'system')}</span></div>
      <div class="m">${esc(a.detail || '')} · ${when(a.created_at)}</div></div></div>`).join('') || '<div class="empty">Empty</div>'}
  </div>`);
};
window.inviteMember = async () => {
  try { await api('/app/team/invite', { body: { name: v('tname'), email: v('temail'), role: v('trole'), password: 'koda-invite' } });
    toast('✓ Invited (temp password: koda-invite)'); route(); } catch (e) { toast('✗ ' + e.message); }
};

VIEWS.developers = async () => {
  const keys = await api('/app/keys');
  const wh = await api('/app/webhooks');
  shell('developers', t('developers'), 'Three endpoints. One coffee. — api.koda.africa/v1', `
  <div class="grid g2">
    <div class="card"><h3>API keys</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${['sk_live', 'pk_live', 'sk_test', 'rk_live'].map(p => `<button class="btn btn-ghost btn-sm" onclick="createKey('${p}')">+ ${p}</button>`).join('')}
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
    <p style="font-size:13px;color:var(--dim)">Install KODA on your phone: browser menu → "Add to Home screen". Works offline for the console shell; verifications sync when back online.</p></div>`);
};

VIEWS.admin = async () => {
  if (!ME.user.is_admin) { location.hash = '#dashboard'; return; }
  const o = await api('/app/admin/overview');
  const merchants = await api('/app/admin/merchants');
  shell('admin', t('admin'), 'KODA staff — the whole fleet at a glance', `
  <div class="grid g4">
    <div class="card stat"><b>${fmt(o.merchants)}</b><span>merchants · ${fmt(o.submerchants)} sub</span></div>
    <div class="card stat"><b>${fmt(o.receipts)}</b><span>verifications · ${fmt(o.volume)} volume</span></div>
    <div class="card stat"><b>${fmt(o.devices)}</b><span>active sentinels · ${fmt(o.quarantined)} quarantined SMS</span></div>
    <div class="card stat"><b>${fmt(o.openDisputes)}</b><span>open disputes · ${fmt(o.deliveries)} comms sent</span></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Per-operator parse health (public page mirrors this)</h3>
    ${o.parseHealth.map(p => `<div style="margin-bottom:8px">
      <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:3px">
        <span class="mono">${p.operator}</span><span class="mono" style="color:${p.rate > 0.98 ? 'var(--verify)' : 'var(--gold)'}">${(p.rate * 100).toFixed(1)}%</span></div>
      <div class="progress"><i style="width:${p.rate * 100}%"></i></div></div>`).join('')}
  </div>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>Merchants</h3><table class="tbl">
    <tr><th>Name</th><th>Plan</th><th class="num">Verifs</th><th class="num">ACU</th><th>Seats</th><th>Status</th><th></th></tr>
    ${merchants.map(m => `<tr><td>${esc(m.name)}</td><td><span class="badge b-info">${m.plan}</span></td>
      <td class="num">${fmt(m.verifs)}</td><td class="num">${fmt(m.acu_balance)}</td><td class="num">${m.seats}</td>
      <td><span class="badge ${m.status === 'active' ? 'b-ok' : 'b-bad'}">${m.status}</span></td>
      <td><button class="btn btn-danger btn-sm" onclick="adminToggle('${m.id}')">${m.status === 'active' ? 'suspend' : 'restore'}</button></td></tr>`).join('')}
  </table></div>
  <div class="card" style="margin-top:14px"><h3>Latest verifications (all merchants)</h3>
    ${o.latest.map(r => `<div class="feed-row"><div class="feed-ic f-ok">✓</div>
      <div><div class="t">${esc(r.merchant)} · <span class="mono" style="font-size:12px">${esc(r.reference)}</span></div>
      <div class="m">${esc(r.mode)} · risk ${r.risk_score} · ${when(r.verified_at)}</div></div>
      <div class="amt">+${fmt(r.amount)}</div></div>`).join('')}
  </div>`);
};
window.adminToggle = async (id) => { await api(`/app/admin/merchants/${id}/suspend`, { body: {} }); route(); };

boot();
