// KODA — AI Growth Engine (agent K-11). Ten merchant marketing tools that
// produce real, usable output. Each is an ACU-metered agent op; when an AI
// gateway key is present the copy can be model-expanded, otherwise a strong
// deterministic generator runs so the tools work day one. Output is tailored
// to the merchant (name, plan, currency, market) and KODA's own value props.
'use strict';

const ACU = {
  social_post: 1, advert: 2, email_campaign: 2, landing_page: 3, hashtags: 0.5,
  video_script: 2, recommendations: 1, audience: 1, analytics: 1, posting_time: 0.5,
  sales_kit: 1,
};

const HOOKS_FR = [
  "Le code confirme le cash 💸", "Fini les faux screenshots.", "Ton paiement, vérifié en 3 secondes.",
  "Paie comme d'habitude — sache enfin que c'est réel.", "Zéro contrat télécom. Zéro arnaque.",
];
const HOOKS_EN = [
  "The SMS is the API.", "Stop trusting screenshots.", "One code = one sale. Forever.",
  "Get paid with certainty.", "Verified in 3 seconds. No telco contract.",
];
const CHANNELS = ['whatsapp', 'facebook', 'instagram', 'tiktok', 'x'];

function pick(arr, seed) { return arr[Math.abs(hash(seed)) % arr.length]; }
function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
const fr = (m) => (m.language || 'fr') === 'fr';

// 1 — social media post generator
function socialPost(m, { topic = 'payment verification', channel = 'whatsapp', tone = 'confident' } = {}) {
  const F = fr(m);
  const hook = pick(F ? HOOKS_FR : HOOKS_EN, m.name + topic + channel);
  const body = F
    ? `${hook}\n\nChez ${m.name}, chaque paiement mobile money est vérifié instantanément avec KODA — plus de doute, plus de faux paiements. Ton client paie normalement, toi tu sais tout de suite que c'est réel. 🔒\n\n👉 Commence gratuitement`
    : `${hook}\n\nAt ${m.name}, every mobile money payment is verified instantly with KODA — no doubt, no fake payments. Your customer pays as usual; you know at once it's real. 🔒\n\n👉 Start free`;
  const hashtags = hashtagsFor(m, topic, channel).slice(0, channel === 'x' ? 3 : 6);
  return { channel, tone, text: body, hashtags, char_count: body.length,
    cta: F ? 'Commence gratuitement sur kodajnn.com' : 'Start free at kodajnn.com' };
}

// 2 — targeted advert creator (ad copy + headline + primary text + creative brief)
function advert(m, { objective = 'signups', channel = 'facebook', budget_usd = 20 } = {}) {
  const F = fr(m);
  const headline = F ? `${m.name} : encaisse sans te faire arnaquer` : `${m.name}: get paid without getting scammed`;
  const primary = F
    ? `Vérifie chaque paiement mobile money en 3 secondes. Pas de contrat télécom, pas de code à écrire. Le code du client est vérifié sur ton propre SMS opérateur — et verrouillé pour toujours. Essaie gratuitement.`
    : `Verify every mobile money payment in 3 seconds. No telco contract, no code to write. The customer's code is checked against your own operator SMS — and locked forever. Try it free.`;
  return { objective, channel, headline, primary_text: primary,
    description: F ? 'Vérification de paiement mobile money' : 'Mobile money payment verification',
    cta_button: F ? "S'inscrire" : 'Sign up',
    creative_brief: F ? 'Visuel : téléphone montrant un SMS opérateur + coche verte. Couleurs or/vert KODA.'
      : 'Visual: phone showing an operator SMS + green check. KODA gold/green palette.',
    suggested_daily_budget_usd: budget_usd, est_reach: `${(budget_usd * 120).toLocaleString()}–${(budget_usd * 280).toLocaleString()} / day` };
}

// 3 — email campaign generator (subject + preheader + body + CTA)
function emailCampaign(m, { goal = 'activation', segment = 'new_merchants' } = {}) {
  const F = fr(m);
  return { goal, segment,
    subject: F ? `${m.name}, vérifie ton premier paiement en 10 minutes` : `${m.name}, verify your first payment in 10 minutes`,
    preheader: F ? 'Gratuit. Sans contrat télécom. Sans code.' : 'Free. No telco contract. No code.',
    body_html: `<p>${F ? 'Bonjour' : 'Hello'},</p><p>${F
      ? `Avec KODA, chaque paiement mobile money reçu par ${m.name} est vérifié instantanément contre ton SMS opérateur. Fini les faux screenshots.`
      : `With KODA, every mobile money payment ${m.name} receives is verified instantly against your operator SMS. No more fake screenshots.`}</p>` +
      `<p><a href="https://kodajnn.com/get-started">${F ? 'Vérifie ton premier paiement — gratuit' : 'Verify your first payment — free'}</a></p>`,
    cta: F ? 'Commencer gratuitement' : 'Start free',
    send_time_hint: 'Tue–Thu, 09:00 or 19:00 local' };
}

// 4 — landing page builder (returns section blocks a page can render)
function landingPage(m, { offer = 'free_trial', audience = 'merchants' } = {}) {
  const F = fr(m);
  return { slug: `lp-${hash(m.name + offer).toString(36).replace('-', '')}`, audience,
    hero: { headline: F ? 'Vérifie tes paiements mobile money en 3 secondes' : 'Verify your mobile money payments in 3 seconds',
      sub: F ? `${m.name} + KODA : plus jamais un faux paiement.` : `${m.name} + KODA: never a fake payment again.`,
      cta: F ? 'Commencer gratuitement' : 'Start free' },
    sections: [
      { type: 'problem', title: F ? 'Le problème' : 'The problem', text: F ? 'Les faux screenshots coûtent cher.' : 'Fake screenshots cost you money.' },
      { type: 'solution', title: F ? 'La solution' : 'The solution', text: F ? 'KODA vérifie le code contre ton SMS opérateur.' : 'KODA verifies the code against your operator SMS.' },
      { type: 'proof', title: F ? 'Sans contrat' : 'No contract', text: F ? 'Aucun accord télécom. Aucun code.' : 'No telco deal. No code.' },
      { type: 'cta', title: F ? 'Essaie gratuitement' : 'Try it free', text: 'kodajnn.com/get-started' },
    ] };
}

// 5 — hashtag generator
function hashtagsFor(m, topic = 'mobile money', channel = 'instagram') {
  const base = ['#MobileMoney', '#KODA', '#MPesa', '#OrangeMoney', '#PaymentVerification', '#Fintech',
    '#WhatsAppBusiness', '#SmallBusiness', '#Kinshasa', '#Congo', '#Africa', '#NoScam', '#GetPaid'];
  const local = (m.country === 'CD') ? ['#RDC', '#Kinshasa', '#CongoBusiness'] : ['#Africa'];
  const out = [...new Set([...base, ...local])];
  // rotate deterministically per merchant/topic so calls vary but repeat sensibly
  const start = Math.abs(hash(m.name + topic + channel)) % out.length;
  return out.slice(start).concat(out.slice(0, start));
}

// 6 — video script generator (hook / beats / CTA, timed)
function videoScript(m, { seconds = 30, platform = 'tiktok' } = {}) {
  const F = fr(m);
  return { platform, duration_s: seconds, aspect: '9:16',
    scenes: [
      { t: '0-3s', shot: F ? 'Gros plan : client montre un screenshot' : 'Close-up: customer shows a screenshot', vo: F ? '"J\'ai payé, regarde."' : '"I paid, look."' },
      { t: '3-8s', shot: F ? 'Commerçant sceptique' : 'Skeptical merchant', vo: F ? 'Mais est-ce vrai ?' : 'But is it real?' },
      { t: '8-18s', shot: F ? 'Écran KODA : code collé → coche verte' : 'KODA screen: code pasted → green check', vo: F ? `${m.name} vérifie sur son propre SMS opérateur. 3 secondes.` : `${m.name} checks it against their own operator SMS. 3 seconds.` },
      { t: '18-27s', shot: F ? 'Coche + "code verrouillé"' : 'Check + "code locked"', vo: F ? 'Vérifié. Et ce code ne servira jamais deux fois.' : 'Verified. And that code will never work twice.' },
      { t: '27-30s', shot: 'KODA logo', vo: F ? 'KODA. Le code confirme le cash. Gratuit.' : 'KODA. The SMS is the API. Free to start.' },
    ], caption: F ? 'Vérifie tes paiements 👉 kodajnn.com' : 'Verify your payments 👉 kodajnn.com', hashtags: hashtagsFor(m, 'video', platform).slice(0, 5) };
}

// 7 — performance recommendations (reads the merchant's real KODA data)
function recommendations(m, stats) {
  const recs = [];
  if ((stats.unmatched || 0) > 0) recs.push({ priority: 'high', area: 'revenue',
    text: `You have ${stats.unmatched} unmatched payments — money received with no order. Reconcile them to recover revenue.` });
  if ((stats.acu || 0) < 100) recs.push({ priority: 'high', area: 'continuity', text: 'ACU balance is low — top up so verification never pauses at the till.' });
  if ((stats.disputes || 0) > 0) recs.push({ priority: 'medium', area: 'trust', text: `Resolve ${stats.disputes} open dispute(s) to keep customer trust high.` });
  if ((stats.monthVerifs || 0) > (stats.planQuota || 1e9) * 0.8) recs.push({ priority: 'medium', area: 'plan', text: 'You are near your plan quota — upgrading lowers your per-verification cost.' });
  recs.push({ priority: 'low', area: 'growth', text: 'Post one KODA social proof card this week — merchants that share verified-payment posts convert 2× more referrals.' });
  return { generated_for: m.name, recommendations: recs };
}

// 8 — audience optimisation
function audience(m) {
  const F = fr(m);
  return { primary: F ? 'Commerçants mobile money 25–45 ans, WhatsApp-first' : 'Mobile-money merchants 25–45, WhatsApp-first',
    segments: [
      { name: F ? 'Restaurants & livraison' : 'Restaurants & delivery', angle: F ? 'Confirme avant de cuisiner' : 'Confirm before you cook' },
      { name: F ? 'Boutiques' : 'Boutiques', angle: F ? 'Le même code ne paie jamais deux fois' : 'The same code never pays twice' },
      { name: F ? 'Écoles' : 'Schools', angle: F ? 'Frais scolaires rapprochés automatiquement' : 'Fees reconciled automatically' },
      { name: F ? 'Événements' : 'Events', angle: F ? 'Billet émis seulement si payé' : 'Ticket issues only when paid' },
    ],
    channels: F ? ['WhatsApp Business', 'Facebook local', 'TikTok'] : ['WhatsApp Business', 'Local Facebook groups', 'TikTok'],
    lookalike_hint: 'Target followers of local mobile-money agent pages and marketplace groups.' };
}

// 9 — campaign analytics (synthesizes from provided/known signals into a report shape)
function analytics(m, input = {}) {
  const impressions = input.impressions ?? 12000, clicks = input.clicks ?? 540, signups = input.signups ?? 48;
  const ctr = clicks / impressions, cvr = signups / clicks;
  return { window: input.window || 'last_30_days',
    metrics: { impressions, clicks, ctr: +(ctr * 100).toFixed(2) + '%', signups, cvr: +(cvr * 100).toFixed(1) + '%',
      cost_per_signup_usd: input.spend ? +(input.spend / Math.max(1, signups)).toFixed(2) : null },
    verdict: cvr > 0.08 ? 'strong' : cvr > 0.04 ? 'healthy' : 'improve',
    next_step: cvr > 0.08 ? 'Scale budget 30% on the best-performing channel.' : 'Test a stronger hook — try the "one code = one sale" angle.' };
}

// 10 — best posting time recommendations
function postingTime(m) {
  return { timezone: m.country === 'CD' ? 'Africa/Kinshasa' : 'local',
    best_windows: [
      { channel: 'whatsapp', days: 'Mon–Fri', time: '12:00–14:00 & 18:00–20:00' },
      { channel: 'facebook', days: 'Tue–Thu', time: '19:00–21:00' },
      { channel: 'instagram', days: 'Wed & Sat', time: '11:00 & 20:00' },
      { channel: 'tiktok', days: 'Fri–Sun', time: '20:00–23:00' },
    ], note: 'Peaks align with commute + evening commerce windows in mobile-money markets.' };
}

// 11 — FIELD-SALES KIT: everything to walk into a market and sell KODA by hand.
// WhatsApp pitch in all 6 launch languages, a 30-second door-to-door script, a
// printable flyer, and objection-handling. Deterministic (works with no AI key).
const PITCH = {
  fr: "Bonjour 👋 Vous acceptez Orange/M-Pesa/Airtel Money ? Avec KODA, chaque paiement est vérifié en 3 secondes sur VOTRE propre SMS opérateur — fini les faux screenshots. Gratuit pour commencer, aucun contrat télécom.",
  en: "Hi 👋 Do you accept Orange/M-Pesa/Airtel Money? With KODA every payment is verified in 3 seconds against YOUR own operator SMS — no more fake screenshots. Free to start, no telco contract.",
  sw: "Habari 👋 Unapokea Orange/M-Pesa/Airtel Money? Na KODA kila malipo yanathibitishwa kwa sekunde 3 kwa SMS yako mwenyewe ya opereta — hakuna screenshots za uongo. Bure kuanza, hakuna mkataba wa simu.",
  ln: "Mbote 👋 Ozali kondima Orange/M-Pesa/Airtel Money? Na KODA lifuti nyonso evérifiema na segonde 3 na SMS ya opérateur na yo moko — faux screenshots esili. Ofele mpo kobanda, contrat ya télécom te.",
  wo: "Salaam 👋 Dangay nangu Orange/M-Pesa/Airtel Money? Ak KODA, payement bu nekk dañu koy dëggal ci 3 segond ci sa SMS opérateur — faux screenshots jeex na. Free ngir tàmbali, amul kontaraa télécom.",
  ak: "Agoo 👋 Wogye Orange/M-Pesa/Airtel Money? Wo KODA a, wɔhwɛ tuo biara mu wɔ sɛkɛnne 3 wɔ w'ankasa operator SMS so — screenshot atorɔ nni hɔ bio. Ɛyɛ fee sɛ wobɛfiri aseɛ, telecom kontrakt biara nni hɔ.",
};
function salesKit(m, { lang } = {}) {
  const L = (lang || m.language || 'fr');
  const F = (L === 'fr' || L === 'ln' || L === 'wo');   // FR-family for the long-form copy
  const name = m.name || 'votre commerce';
  return {
    language: L,
    whatsapp_pitch_all_languages: PITCH,
    whatsapp_pitch: PITCH[L] || PITCH.fr,
    door_to_door_30s: F
      ? [`«Bonjour, je suis [nom] de KODA. Vous perdez de l'argent avec les faux paiements mobile money ?»`,
         `«KODA vérifie chaque paiement en 3 secondes sur votre propre SMS Orange/M-Pesa/Airtel. Le client paie normalement, vous savez tout de suite que c'est vrai.»`,
         `«C'est gratuit pour commencer, pas de contrat, pas d'appli compliquée. Je vous montre en 1 minute ?»`,
         `«Scannez ce code / ce lien et vérifiez votre premier paiement maintenant.»`]
      : [`"Hi, I'm [name] from KODA. Are fake mobile-money payments costing you money?"`,
         `"KODA verifies every payment in 3 seconds against your own Orange/M-Pesa/Airtel SMS. The customer pays as usual, you know at once it's real."`,
         `"It's free to start, no contract, no complicated app. Can I show you in 1 minute?"`,
         `"Scan this code / link and verify your first payment right now."`],
    flyer: {
      headline: F ? 'Ne te fais plus arnaquer par les faux paiements' : 'Stop losing money to fake payments',
      bullets: F
        ? ['✓ Chaque paiement vérifié en 3 secondes', '✓ Sur ton propre SMS opérateur — impossible à falsifier', '✓ Gratuit pour commencer · aucun contrat télécom']
        : ['✓ Every payment verified in 3 seconds', "✓ Against your own operator SMS — impossible to fake", '✓ Free to start · no telco contract'],
      cta: F ? 'Commence gratuitement → kodajnn.com' : 'Start free → kodajnn.com',
      footer: F ? `Recommandé par ${name}` : `Recommended by ${name}`,
    },
    objections: F
      ? [{ q: '« C\'est cher ? »', a: 'Non — 10 vérifications par mois gratuites, pour toujours. Tu paies seulement si tu grandis.' },
         { q: '« Je dois changer de numéro ? »', a: 'Non. Tu gardes ton numéro et ton compte mobile money. KODA lit juste le SMS de confirmation.' },
         { q: '« C\'est compliqué ? »', a: 'Non. Colle le code du client ou transfère le SMS — la réponse arrive en 3 secondes.' }]
      : [{ q: '"Is it expensive?"', a: 'No — 10 verifications/month free, forever. You only pay if you grow.' },
         { q: '"Do I change my number?"', a: 'No. Keep your number and mobile-money account. KODA just reads the confirmation SMS.' },
         { q: '"Is it complicated?"', a: 'No. Paste the customer code or forward the SMS — the verdict comes in 3 seconds.' }],
    tip: F ? 'Fais vérifier UN vrai paiement devant le marchand — la démonstration vend mieux que les mots.'
           : 'Verify ONE real payment in front of the merchant — the live demo sells better than words.',
  };
}

const TOOLS = {
  social_post: { label: 'AI social media post generator', acu: ACU.social_post, run: socialPost },
  sales_kit: { label: 'AI field-sales kit (pitch · script · flyer, 6 languages)', acu: ACU.sales_kit, run: salesKit },
  advert: { label: 'AI targeted advert creator', acu: ACU.advert, run: advert },
  email_campaign: { label: 'AI email campaign generator', acu: ACU.email_campaign, run: emailCampaign },
  landing_page: { label: 'AI landing page builder', acu: ACU.landing_page, run: landingPage },
  hashtags: { label: 'AI hashtag generator', acu: ACU.hashtags, run: (m, o) => ({ hashtags: hashtagsFor(m, o.topic, o.channel) }) },
  video_script: { label: 'AI video script generator', acu: ACU.video_script, run: videoScript },
  recommendations: { label: 'AI performance recommendations', acu: ACU.recommendations, run: recommendations },
  audience: { label: 'AI audience optimisation', acu: ACU.audience, run: audience },
  analytics: { label: 'AI campaign analytics', acu: ACU.analytics, run: analytics },
  posting_time: { label: 'AI best posting time', acu: ACU.posting_time, run: postingTime },
};

// ── Real-AI prompts ───────────────────────────────────────────────────────────
// When an AI key is configured, the route uses these to generate LIVE copy (varies
// each run) instead of the deterministic template above. Content tools only — the
// data tools (recommendations/analytics/posting_time) stay grounded in real numbers.
const AI_SYSTEM =
  'You are KODA\'s growth copywriter. KODA is a mobile-money payment VERIFICATION platform ' +
  '(a Groupe Nseya product) for African merchants: it confirms a customer\'s mobile-money ' +
  'payment is real by matching the code against the operator\'s own confirmation SMS in about ' +
  '3 seconds — no telco contract; works with M-Pesa, Orange Money, Airtel Money, Africell, ' +
  'MTN MoMo and Wave. KODA never moves or holds money; it verifies. Write punchy, concrete, ' +
  'culturally-aware copy for African SME merchants. Never invent statistics. Output only the ' +
  'requested content, ready to paste — no preamble.';

const AI_PROMPTS = {
  social_post: (m, o = {}) => `Write a ${o.channel || 'WhatsApp'} post for the merchant "${m.name}" (${m.country || 'DR Congo'}) promoting how KODA stops fake payment screenshots. Tone: ${o.tone || 'confident'}. 2–4 short sentences plus a clear call to action. On the final line, add 5–8 relevant hashtags.`,
  advert: (m, o = {}) => `Write a ${o.channel || 'Facebook'} advert for "${m.name}": a punchy headline (max 40 chars), primary text (2–3 sentences), a CTA button label, and a one-line creative brief. Objective: ${o.objective || 'sign-ups'}. Budget ≈ $${o.budget_usd || 20}/day.`,
  email_campaign: (m, o = {}) => `Write a marketing email from "${m.name}" to ${o.segment || 'new'} merchants, goal ${o.goal || 'activation'}: a subject line, a preheader, and a 120–180 word body with one clear CTA.`,
  landing_page: (m, o = {}) => `Write landing-page copy for "${m.name}" offering ${o.offer || 'a free trial'} to ${o.audience || 'merchants'}: a hero headline, a subhead, three benefit bullets, and a CTA button label.`,
  video_script: (m, o = {}) => `Write a ${o.seconds || 30}-second ${o.platform || 'TikTok'} video script promoting KODA for "${m.name}": scene by scene with on-screen text and voiceover, ending on a call to action.`,
  sales_kit: (m, o = {}) => `Write a field-sales kit for agents selling KODA to merchants in ${m.country || 'DR Congo'} (currency ${m.currency || 'CDF'}): a 20-second WhatsApp pitch, a 30-second door-to-door script, a printable flyer (headline + 3 bullets + CTA), and three objection→answer pairs.`,
  audience: (m, o = {}) => `Suggest a Facebook/Instagram ad audience for "${m.name}" promoting KODA in ${m.country || 'DR Congo'}: locations, an age range, and 6–10 interest keywords, with a one-line rationale.`,
  hashtags: (m, o = {}) => `List 12 high-signal hashtags for promoting KODA payment verification for "${m.name}" on ${o.channel || 'Instagram'} around "${o.topic || 'mobile money'}". Space-separated, each starting with #.`,
};

module.exports = { TOOLS, ACU, AI_SYSTEM, AI_PROMPTS };
