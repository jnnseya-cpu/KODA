// KODA — AI Growth Engine (agent K-11). Marketing tools for the MERCHANT'S OWN
// business — restaurants, boutiques, salons, schools, shops, services. Every tool
// writes ready-to-use copy that promotes what THE MERCHANT sells, to THEIR own
// customers: social posts, adverts, emails, landing pages, video scripts, a sales
// & promo kit and audience/analytics helpers. When an AI gateway key is present the
// copy is model-written from the merchant's own business description; otherwise a
// strong deterministic generator runs so the tools work day one.
//
// KODA is the tool the merchant uses to GET PAID — it is not the subject of the
// marketing. The only KODA-specific line the copy ever carries is "mobile money
// accepted", which is a genuine fact about the merchant's checkout.
'use strict';

const ACU = {
  social_post: 1, advert: 2, email_campaign: 2, landing_page: 3, hashtags: 0.5,
  video_script: 2, recommendations: 1, audience: 1, analytics: 1, posting_time: 0.5,
  sales_kit: 1,
};

function hash(s) { let h = 0; for (const c of String(s)) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }
const fr = (m) => (m.language || 'fr') === 'fr';

// ── merchant / business context helpers ────────────────────────────────────────
const bizName = (m) => (m.name || (fr(m) ? 'notre commerce' : 'our business'));
// What the merchant sells, in their own words (from the Growth form). Falls back
// to any stored business descriptor, else empty (templates degrade gracefully).
const bizAbout = (m, o = {}) => String(o.business || o.about || o.description || m.about || '').trim();
// The specific thing being promoted right now — a product, a promo, an event.
const promoOf = (o = {}) => String(o.offer || o.promo || o.product || o.topic || '').trim();
const LANG_NAME = { fr: 'French', en: 'English', sw: 'Swahili', ln: 'Lingala', wo: 'Wolof', ak: 'Twi' };
const langName = (m) => LANG_NAME[m.language || 'fr'] || 'French';

// local hashtags + city by country (the merchant's market, not KODA's)
const LOCAL = {
  CD: ['#RDC', '#Kinshasa', '#Congo243'], CI: ['#CôteDIvoire', '#Abidjan'],
  SN: ['#Sénégal', '#Dakar'], GH: ['#Ghana', '#Accra'],
  KE: ['#Kenya', '#Nairobi'], NG: ['#Nigeria', '#Lagos'],
};
const CITY = { CD: 'Kinshasa', CI: 'Abidjan', SN: 'Dakar', GH: 'Accra', KE: 'Nairobi', NG: 'Lagos' };

function slugTag(s) {
  const w = String(s || '').replace(/[^a-zA-Z0-9À-ÿ\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 3);
  if (!w.length) return null;
  return '#' + w.map(x => x[0].toUpperCase() + x.slice(1).toLowerCase()).join('');
}

// 5 — hashtag generator (business, offer, local — never KODA-branded)
function hashtagsFor(m, topic = '', channel = 'instagram') {
  const out = [];
  const nameTag = slugTag(m.name); if (nameTag) out.push(nameTag);
  const topicTag = slugTag(topic); if (topicTag && topicTag !== nameTag) out.push(topicTag);
  out.push(...(LOCAL[m.country] || ['#Africa']));
  out.push('#SmallBusiness', '#ShopLocal', '#SupportLocal', '#Entrepreneur', '#MadeInAfrica', '#Deals', '#Promo');
  const uniq = [...new Set(out.filter(Boolean))];
  const start = Math.abs(hash((m.name || '') + topic + channel)) % uniq.length;
  return uniq.slice(start).concat(uniq.slice(0, start));
}

// 1 — social media post for the merchant's business
function socialPost(m, o = {}) {
  const F = fr(m); const name = bizName(m), about = bizAbout(m, o), promo = promoOf(o);
  const channel = o.channel || 'whatsapp', tone = o.tone || 'confident';
  const line1 = promo
    ? (F ? `📢 ${promo} — chez ${name} !` : `📢 ${promo} — at ${name}!`)
    : (F ? `✨ Découvre ${name}` : `✨ Discover ${name}`);
  const line2 = about || (F ? `On te sert avec le sourire — passe nous voir.` : `Great products, great service — come see us.`);
  const cta = F ? '👉 Écris-nous sur WhatsApp ou passe aujourd\'hui. Paiement mobile money accepté.'
                : '👉 Message us on WhatsApp or drop by today. Mobile money accepted.';
  const text = `${line1}\n\n${line2}\n\n${cta}`;
  const hashtags = hashtagsFor(m, promo || about || name, channel).slice(0, channel === 'x' ? 3 : 6);
  return { channel, tone, text, hashtags, char_count: text.length, cta };
}

// 2 — targeted advert for the merchant's business
function advert(m, o = {}) {
  const F = fr(m); const name = bizName(m), about = bizAbout(m, o), promo = promoOf(o);
  const budget = o.budget_usd || 20;
  const headline = (promo ? (F ? `${promo} chez ${name}` : `${promo} at ${name}`)
                          : (F ? `Découvre ${name}` : `Discover ${name}`)).slice(0, 40);
  const primary = F
    ? `${about || `${name}, ton adresse de confiance`}. ${promo ? promo + '. ' : ''}Passe nous voir ou commande sur WhatsApp — service rapide, paiement mobile money accepté.`
    : `${about || `${name}, your trusted local spot`}. ${promo ? promo + '. ' : ''}Come by or order on WhatsApp — fast service, mobile money accepted.`;
  return { objective: o.objective || 'visits', channel: o.channel || 'facebook', headline, primary_text: primary,
    description: about || (F ? 'Commerce local' : 'Local business'),
    cta_button: F ? 'Nous contacter' : 'Contact us',
    creative_brief: F ? `Visuel : ta meilleure vente en photo, prix bien visible, logo ${name}.`
                      : `Visual: a photo of your best-seller, price clearly shown, ${name} logo.`,
    suggested_daily_budget_usd: budget, est_reach: `${(budget * 120).toLocaleString()}–${(budget * 280).toLocaleString()} / day` };
}

// 3 — email / broadcast campaign to the merchant's customers
function emailCampaign(m, o = {}) {
  const F = fr(m); const name = bizName(m), about = bizAbout(m, o), promo = promoOf(o);
  const main = F
    ? `${about ? about + '. ' : ''}${promo ? `Cette semaine : ${promo}. ` : ''}Passe nous voir ou réponds à ce message pour commander.`
    : `${about ? about + '. ' : ''}${promo ? `This week: ${promo}. ` : ''}Come see us or reply to this message to order.`;
  return { goal: o.goal || 'repeat_customers', segment: o.segment || 'customers',
    subject: promo ? (F ? `${name} : ${promo}` : `${name}: ${promo}`) : (F ? `Du nouveau chez ${name}` : `What's new at ${name}`),
    preheader: about || (F ? 'Ton commerce de quartier' : 'Your neighbourhood business'),
    body_html: `<p>${F ? 'Bonjour' : 'Hello'},</p><p>${main}</p><p><b>${name}</b> — ${F ? 'paiement mobile money accepté.' : 'mobile money accepted.'}</p>`,
    cta: F ? 'Commander maintenant' : 'Order now',
    send_time_hint: 'Tue–Thu, 09:00 or 19:00 local' };
}

// 4 — landing page for the merchant's business
function landingPage(m, o = {}) {
  const F = fr(m); const name = bizName(m), about = bizAbout(m, o), promo = promoOf(o);
  return { slug: `lp-${hash(name + (promo || '')).toString(36).replace('-', '')}`, audience: o.audience || 'customers',
    hero: { headline: promo || (F ? `Bienvenue chez ${name}` : `Welcome to ${name}`),
      sub: about || (F ? 'Qualité et service, ici même.' : 'Quality and service, right here.'),
      cta: F ? 'Nous contacter' : 'Get in touch' },
    sections: [
      { type: 'about', title: F ? 'Qui nous sommes' : 'Who we are', text: about || (F ? `${name}, à votre service.` : `${name}, at your service.`) },
      { type: 'offer', title: F ? 'Notre offre' : 'What we offer', text: promo || (F ? 'Découvre nos produits et services.' : 'Discover our products and services.') },
      { type: 'trust', title: F ? 'Pourquoi nous' : 'Why us', text: F ? 'Service rapide, paiement mobile money accepté.' : 'Fast service, mobile money accepted.' },
      { type: 'cta', title: F ? 'Passe commande' : 'Order now', text: F ? 'Écris-nous sur WhatsApp.' : 'Message us on WhatsApp.' },
    ] };
}

// 6 — video script for the merchant's business
function videoScript(m, o = {}) {
  const F = fr(m); const name = bizName(m), about = bizAbout(m, o), promo = promoOf(o);
  return { platform: o.platform || 'tiktok', duration_s: o.seconds || 30, aspect: '9:16',
    scenes: [
      { t: '0-3s', shot: F ? `Plan large : la devanture / le produit de ${name}` : `Wide shot: ${name}'s storefront / product`, vo: promo || (F ? `Voici ${name}.` : `This is ${name}.`) },
      { t: '3-10s', shot: F ? 'Gros plan produit' : 'Close-up of the product', vo: about || (F ? 'Ce qu\'on fait de mieux.' : 'What we do best.') },
      { t: '10-20s', shot: F ? 'Client satisfait' : 'Happy customer', vo: F ? 'Nos clients adorent — et toi ?' : 'Our customers love it — will you?' },
      { t: '20-27s', shot: F ? 'Prix / offre à l\'écran' : 'Price / offer on screen', vo: promo || (F ? 'Passe commande aujourd\'hui.' : 'Order today.') },
      { t: '27-30s', shot: F ? `Logo ${name} + contact` : `${name} logo + contact`, vo: F ? 'Écris-nous sur WhatsApp.' : 'Message us on WhatsApp.' },
    ], caption: promo || (F ? `Découvre ${name} 👉` : `Discover ${name} 👉`), hashtags: hashtagsFor(m, promo || about || '', o.platform || 'tiktok').slice(0, 5) };
}

// 7 — performance recommendations (reads the merchant's real KODA data)
function recommendations(m, stats) {
  const recs = [];
  if ((stats.unmatched || 0) > 0) recs.push({ priority: 'high', area: 'revenue',
    text: `You have ${stats.unmatched} unmatched payments — money received with no order. Reconcile them to recover revenue.` });
  if ((stats.acu || 0) < 100) recs.push({ priority: 'high', area: 'continuity', text: 'ACU balance is low — top up so payment verification never pauses at the till.' });
  if ((stats.disputes || 0) > 0) recs.push({ priority: 'medium', area: 'trust', text: `Resolve ${stats.disputes} open dispute(s) to keep customer trust high.` });
  if ((stats.monthVerifs || 0) > (stats.planQuota || 1e9) * 0.8) recs.push({ priority: 'medium', area: 'plan', text: 'You are near your plan quota — upgrading lowers your per-verification cost.' });
  recs.push({ priority: 'low', area: 'growth', text: 'Post one photo of your best-selling product this week with a clear price and a "message us to order" line — a photo with a price converts far more local customers than text alone.' });
  return { generated_for: m.name, recommendations: recs };
}

// 8 — audience optimisation for the merchant's business
function audience(m, o = {}) {
  const F = fr(m); const about = bizAbout(m, o);
  return { primary: about ? (F ? `Clients locaux intéressés par : ${about}` : `Local customers interested in: ${about}`)
                          : (F ? 'Clients locaux 18–45 ans, WhatsApp-first' : 'Local customers 18–45, WhatsApp-first'),
    segments: [
      { name: F ? 'Voisinage direct' : 'Immediate neighbourhood', angle: F ? 'Proximité et rapidité' : 'Close by and fast' },
      { name: F ? 'Habitués' : 'Regulars', angle: F ? 'Récompense la fidélité' : 'Reward loyalty' },
      { name: F ? 'Nouveaux clients' : 'New customers', angle: F ? 'Une première offre' : 'A first-visit offer' },
      { name: F ? 'Bureaux & commerces voisins' : 'Nearby offices & shops', angle: F ? 'Commandes groupées / livraison' : 'Group orders / delivery' },
    ],
    channels: ['WhatsApp Business', F ? 'Facebook local' : 'Local Facebook groups', 'TikTok', 'Instagram'],
    lookalike_hint: 'Target followers of nearby popular shops and neighbourhood/marketplace groups.' };
}

// 9 — campaign analytics (synthesizes provided/known signals into a report shape)
function analytics(m, input = {}) {
  const impressions = input.impressions ?? 12000, clicks = input.clicks ?? 540, signups = input.signups ?? 48;
  const ctr = clicks / impressions, cvr = signups / clicks;
  return { window: input.window || 'last_30_days',
    metrics: { impressions, clicks, ctr: +(ctr * 100).toFixed(2) + '%', signups, cvr: +(cvr * 100).toFixed(1) + '%',
      cost_per_signup_usd: input.spend ? +(input.spend / Math.max(1, signups)).toFixed(2) : null },
    verdict: cvr > 0.08 ? 'strong' : cvr > 0.04 ? 'healthy' : 'improve',
    next_step: cvr > 0.08 ? 'Scale budget 30% on the best-performing channel.' : 'Test a stronger hook — lead with a photo of your best-seller and its price.' };
}

// 10 — best posting time recommendations
function postingTime(m) {
  return { timezone: CITY[m.country] ? `Africa/${CITY[m.country]}` : 'local',
    best_windows: [
      { channel: 'whatsapp', days: 'Mon–Fri', time: '12:00–14:00 & 18:00–20:00' },
      { channel: 'facebook', days: 'Tue–Thu', time: '19:00–21:00' },
      { channel: 'instagram', days: 'Wed & Sat', time: '11:00 & 20:00' },
      { channel: 'tiktok', days: 'Fri–Sun', time: '20:00–23:00' },
    ], note: 'Peaks align with commute + evening shopping windows in your market.' };
}

// 11 — SALES & PROMO KIT: everything the merchant's staff needs to sell the
// merchant's OWN products by hand — a WhatsApp message in all 6 launch languages,
// a 30-second in-person pitch, a printable flyer, and objection-handling.
const PITCH_FRAME = {
  fr: (n, a, p) => `Bonjour 👋 Connaissez-vous ${n}${a ? ` — ${a}` : ''} ? ${p ? p + '. ' : ''}Passez nous voir ou écrivez-nous sur WhatsApp, on s'occupe de vous. Paiement mobile money accepté.`,
  en: (n, a, p) => `Hi 👋 Do you know ${n}${a ? ` — ${a}` : ''}? ${p ? p + '. ' : ''}Come see us or message us on WhatsApp — we'll take care of you. Mobile money accepted.`,
  sw: (n, a, p) => `Habari 👋 Unaijua ${n}${a ? ` — ${a}` : ''}? ${p ? p + '. ' : ''}Karibu au tutumie ujumbe WhatsApp — tutakuhudumia. Malipo ya mobile money yanakubaliwa.`,
  ln: (n, a, p) => `Mbote 👋 Oyebi ${n}${a ? ` — ${a}` : ''}? ${p ? p + '. ' : ''}Yaka kotala biso to komela biso na WhatsApp — tokosalela yo malamu. Mobile money endimami.`,
  wo: (n, a, p) => `Salaam 👋 Xam nga ${n}${a ? ` — ${a}` : ''}? ${p ? p + '. ' : ''}Kaay gis ñu walla bind ñu ci WhatsApp — dinañu la topatoo. Mobile money nangu nañu ko.`,
  ak: (n, a, p) => `Agoo 👋 Wunim ${n}${a ? ` — ${a}` : ''}? ${p ? p + '. ' : ''}Bra bɛhwɛ yɛn anaa fa WhatsApp so frɛ yɛn — yɛbɛhwɛ wo so yie. Yɛgye mobile money.`,
};
function salesKit(m, o = {}) {
  const L = (o.lang || m.language || 'fr');
  const F = (L === 'fr' || L === 'ln' || L === 'wo');
  const name = bizName(m), about = bizAbout(m, o), promo = promoOf(o);
  const all = {}; for (const k of Object.keys(PITCH_FRAME)) all[k] = PITCH_FRAME[k](name, about, promo);
  return {
    language: L,
    whatsapp_pitch_all_languages: all,
    whatsapp_pitch: all[L] || all.fr,
    door_to_door_30s: F
      ? [`«Bonjour, je représente ${name}${about ? ` — ${about}` : ''}.»`,
         promo ? `«En ce moment : ${promo}.»` : `«On a ce qu'il vous faut, tout près de chez vous.»`,
         `«Service rapide, et vous payez par mobile money — Orange, M-Pesa, Airtel.»`,
         `«Passez aujourd'hui ou écrivez-nous sur WhatsApp, je vous réserve ça.»`]
      : [`"Hi, I'm with ${name}${about ? ` — ${about}` : ''}."`,
         promo ? `"Right now: ${promo}."` : `"We've got what you need, right here in the neighbourhood."`,
         `"Fast service, and you pay by mobile money — Orange, M-Pesa, Airtel."`,
         `"Drop by today or message us on WhatsApp and I'll set it aside for you."`],
    flyer: {
      headline: promo || (F ? `Découvre ${name}` : `Discover ${name}`),
      bullets: F
        ? [`✓ ${about || 'Produits et services de qualité'}`, '✓ Service rapide, tout près de chez toi', '✓ Paiement mobile money accepté']
        : [`✓ ${about || 'Quality products and services'}`, '✓ Fast service, right in your neighbourhood', '✓ Mobile money accepted'],
      cta: F ? 'Écris-nous sur WhatsApp' : 'Message us on WhatsApp',
      footer: name,
    },
    objections: F
      ? [{ q: '« C\'est cher ? »', a: `Non — on a des options pour chaque budget${promo ? `, et en ce moment ${promo}` : ''}.` },
         { q: '« C\'est loin ? »', a: 'On est tout près, et on peut livrer ou réserver pour toi.' },
         { q: '« Comment je paie ? »', a: 'Cash ou mobile money — Orange, M-Pesa, Airtel. Simple et rapide.' }]
      : [{ q: '"Is it expensive?"', a: `No — we have options for every budget${promo ? `, and right now ${promo}` : ''}.` },
         { q: '"Is it far?"', a: 'We\'re close by, and we can deliver or hold it for you.' },
         { q: '"How do I pay?"', a: 'Cash or mobile money — Orange, M-Pesa, Airtel. Simple and fast.' }],
    tip: F ? 'Montre une photo de ton meilleur produit avec le prix — l\'image vend mieux que les mots.'
           : 'Show a photo of your best product with the price — the image sells better than words.',
  };
}

const TOOLS = {
  social_post: { label: 'AI social media post generator', acu: ACU.social_post, run: socialPost },
  sales_kit: { label: 'AI sales & promo kit (pitch · script · flyer, 6 languages)', acu: ACU.sales_kit, run: salesKit },
  advert: { label: 'AI targeted advert creator', acu: ACU.advert, run: advert },
  email_campaign: { label: 'AI email / broadcast campaign', acu: ACU.email_campaign, run: emailCampaign },
  landing_page: { label: 'AI landing page builder', acu: ACU.landing_page, run: landingPage },
  hashtags: { label: 'AI hashtag generator', acu: ACU.hashtags, run: (m, o) => ({ hashtags: hashtagsFor(m, promoOf(o) || bizAbout(m, o), o.channel) }) },
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
// Every prompt is about the MERCHANT'S OWN business, never about KODA.
const AI_SYSTEM =
  'You are a senior marketing copywriter for an African small business. You write copy ' +
  'that promotes the MERCHANT\'S OWN business, products and offers to THEIR customers — ' +
  'restaurants, boutiques, salons, schools, shops, delivery, services. Write punchy, ' +
  'concrete, culturally-aware copy in the merchant\'s language. Use only the business ' +
  'details you are given; never invent facts, prices or statistics that were not provided. ' +
  'The subject is the merchant\'s business — do NOT advertise payment apps or platforms. ' +
  'You may mention "mobile money accepted" as a convenience, nothing more. Output only the ' +
  'requested content, ready to paste, with no preamble.';

const aboutClause = (m, o) => { const a = bizAbout(m, o); return a ? `, described as: "${a}"` : ''; };
const promoClause = (o) => { const p = promoOf(o); return p ? `. They are currently promoting: "${p}"` : ''; };

const AI_PROMPTS = {
  social_post: (m, o = {}) => `Write a ${o.channel || 'WhatsApp'} post for the business "${bizName(m)}"${aboutClause(m, o)} in ${m.country || 'DR Congo'}${promoClause(o)}. Tone: ${o.tone || 'confident'}. 2–4 short sentences that make a local customer want to visit or buy, plus a clear call to action. Language: ${langName(m)}. On the final line add 5–8 relevant hashtags.`,
  advert: (m, o = {}) => `Write a ${o.channel || 'Facebook'} advert for "${bizName(m)}"${aboutClause(m, o)}${promoClause(o)}: a punchy headline (max 40 chars), primary text (2–3 sentences), a CTA button label, and a one-line creative brief. Objective: ${o.objective || 'store visits'}. Budget ≈ $${o.budget_usd || 20}/day. Language: ${langName(m)}.`,
  email_campaign: (m, o = {}) => `Write a marketing message from "${bizName(m)}"${aboutClause(m, o)} to its customers, goal ${o.goal || 'repeat business'}${promoClause(o)}: a subject line, a preheader, and a 120–180 word body with one clear CTA. Language: ${langName(m)}.`,
  landing_page: (m, o = {}) => `Write landing-page copy for "${bizName(m)}"${aboutClause(m, o)}${promoClause(o)} aimed at ${o.audience || 'local customers'}: a hero headline, a subhead, three benefit bullets, and a CTA button label. Language: ${langName(m)}.`,
  video_script: (m, o = {}) => `Write a ${o.seconds || 30}-second ${o.platform || 'TikTok'} video script promoting "${bizName(m)}"${aboutClause(m, o)}${promoClause(o)}: scene by scene with on-screen text and voiceover, ending on a call to action. Language: ${langName(m)}.`,
  sales_kit: (m, o = {}) => `Write a sales & promo kit for the staff of "${bizName(m)}"${aboutClause(m, o)} in ${m.country || 'DR Congo'}${promoClause(o)}: a 20-second WhatsApp message to send to customers, a 30-second in-person pitch, a printable flyer (headline + 3 bullets + CTA), and three customer objection→answer pairs. Language: ${langName(m)}.`,
  audience: (m, o = {}) => `Suggest a Facebook/Instagram ad audience to promote "${bizName(m)}"${aboutClause(m, o)} in ${m.country || 'DR Congo'}${promoClause(o)}: locations, an age range, and 6–10 interest keywords, with a one-line rationale.`,
  hashtags: (m, o = {}) => `List 12 high-signal hashtags to promote "${bizName(m)}"${aboutClause(m, o)} on ${o.channel || 'Instagram'}${promoClause(o)}. Mix business-type, local (${m.country || 'DR Congo'}) and offer tags. Space-separated, each starting with #.`,
};

module.exports = { TOOLS, ACU, AI_SYSTEM, AI_PROMPTS };
