// KODA — sales deck generator (pptxgenjs). Dark-green + gold brand, honest claims.
const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const Fi = require('react-icons/fi');

// ---- palette ----
const INK   = '081813';   // deepest dark green
const INK2  = '0C231C';   // dark green
const CARD  = '123027';   // lighter green card
const CARD2 = '17392E';
const GOLD  = 'E8A11F';
const GOLDBR= 'F2B944';
const CREAM = 'F5EFDF';
const TEXT  = 'E9E4D5';
const DIM   = '9BA79B';
const LINE  = '2A4034';

const DISP = 'Arial';
const BODY = 'Calibri';
const MONO = 'Courier New';

// ---- icon rasteriser (react-icons -> gold/dark PNG); falls back to null ----
async function icon(Comp, colorHex, size = 256) {
  try {
    const svg = ReactDOMServer.renderToStaticMarkup(
      React.createElement(Comp, { color: '#' + colorHex, size, strokeWidth: 1.75 }));
    const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
    return 'image/png;base64,' + buf.toString('base64');
  } catch (e) { return null; }
}

(async () => {
  const ICON = {};
  const want = {
    edit: Fi.FiEdit3, chat: Fi.FiMessageCircle, code: Fi.FiCode, hash: Fi.FiHash, inbox: Fi.FiInbox,
    bag: Fi.FiShoppingBag, grid: Fi.FiGrid, share: Fi.FiShare2, home: Fi.FiHome,
    shield: Fi.FiShield, lock: Fi.FiLock, zap: Fi.FiZap, check: Fi.FiCheckCircle,
  };
  for (const [k, C] of Object.entries(want)) ICON[k] = C ? await icon(C, GOLD) : null;
  const ICOND = {}; // gold check for the dark chip on the cream slide (dark-on-dark is invisible)
  ICOND.check = Fi.FiCheckCircle ? await icon(Fi.FiCheckCircle, GOLD) : null;

  const p = new pptxgen();
  p.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
  p.layout = 'W';
  const W = 13.333, H = 7.5, M = 0.62;

  // ---- helpers ----
  const bg = (s, c) => { s.background = { color: c }; };
  const kicker = (s, t, x, y, col = GOLD, w = 8) => s.addText(t, {
    isTextBox: true, x, y, w, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11.5,
    color: col, charSpacing: 3, bold: true, align: 'left' });
  const shadow = () => ({ type: 'outer', color: '000000', opacity: 0.35, blur: 10, offset: 4, angle: 90 });
  const card = (s, x, y, w, h, fill = CARD) => s.addShape(p.ShapeType.roundRect, {
    x, y, w, h, rectRadius: 0.11, fill: { color: fill }, line: { color: LINE, width: 1 }, shadow: shadow() });
  const iconChip = (s, key, x, y, d = 0.62, ring = CARD2, set = ICON) => {
    s.addShape(p.ShapeType.roundRect, { x, y, w: d, h: d, rectRadius: 0.1, fill: { color: ring }, line: { color: GOLD, width: 1 } });
    if (set[key]) s.addImage({ data: set[key], x: x + d * 0.2, y: y + d * 0.2, w: d * 0.6, h: d * 0.6 });
  };
  const foot = (s, dark = true) => s.addText(
    [{ text: 'kodajnn.com', options: { color: dark ? GOLD : INK, bold: true } },
     { text: '   ·   Groupe Nseya Digital  ·  Kinshasa, DR Congo', options: { color: dark ? DIM : '6B7A6E' } }],
    { isTextBox: true, x: M, y: H - 0.5, w: W - 2 * M, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9.5, align: 'left' });

  // ============ 1 · TITLE ============
  let s = p.addSlide(); bg(s, INK);
  kicker(s, 'MOBILE-MONEY PAYMENT VERIFICATION', M, 0.95);
  s.addText('KODA', { isTextBox: true, x: M, y: 1.35, w: 8, h: 1.5, margin: 0, fontFace: DISP, fontSize: 96, bold: true, color: GOLD, charSpacing: 6 });
  s.addText([
    { text: 'A screenshot can be faked.', options: { color: TEXT, breakLine: true } },
    { text: 'The SMS can’t.', options: { color: GOLDBR } },
  ], { isTextBox: true, x: M, y: 2.95, w: 11.5, h: 1.8, margin: 0, fontFace: DISP, fontSize: 52, bold: true, lineSpacingMultiple: 1.0 });
  s.addText('Verify any mobile-money payment against the operator’s own confirmation SMS. No telco contract. No code to paste. A verdict in seconds.',
    { isTextBox: true, x: M, y: 5.15, w: 9.6, h: 1.0, margin: 0, fontFace: BODY, fontSize: 17, color: DIM, lineSpacingMultiple: 1.15 });
  foot(s);

  // ============ 2 · PROBLEM ============
  s = p.addSlide(); bg(s, INK2);
  kicker(s, 'THE PROBLEM', M, 0.7);
  s.addText('Commerce still ends with\n“send me a screenshot.”', { isTextBox: true, x: M, y: 1.05, w: 8.6, h: 1.6, margin: 0, fontFace: DISP, fontSize: 40, bold: true, color: TEXT, lineSpacingMultiple: 1.0 });
  const probs = [
    ['A screenshot proves nothing', 'It can be edited, reused, or invented in seconds — and the merchant can’t tell.'],
    ['Goods leave before money lands', 'Release against a fake confirmation and the loss is immediate and total.'],
    ['Reconciliation is manual', 'Matching payments to orders by hand is slow, error-prone, and doesn’t scale.'],
  ];
  probs.forEach((r, i) => {
    const y = 2.95 + i * 1.32;
    card(s, M, y, 7.4, 1.15);
    iconChip(s, 'shield', M + 0.28, y + 0.28, 0.58);
    s.addText(r[0], { isTextBox: true, x: M + 1.12, y: y + 0.16, w: 6.0, h: 0.4, margin: 0, fontFace: DISP, fontSize: 16, bold: true, color: TEXT });
    s.addText(r[1], { isTextBox: true, x: M + 1.12, y: y + 0.55, w: 6.05, h: 0.5, margin: 0, fontFace: BODY, fontSize: 12.5, color: DIM });
  });
  // right: mock chat bubble
  card(s, 8.5, 2.95, 4.2, 3.7, INK);
  s.addText('CUSTOMER', { isTextBox: true, x: 8.8, y: 3.2, w: 3.6, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9, color: DIM, charSpacing: 2 });
  s.addShape(p.ShapeType.roundRect, { x: 8.8, y: 3.55, w: 3.2, h: 0.75, rectRadius: 0.1, fill: { color: CARD }, line: { color: LINE, width: 1 } });
  s.addText('“I’ve paid! Here’s the screenshot 📸”', { isTextBox: true, x: 8.95, y: 3.6, w: 3.0, h: 0.65, margin: 0, fontFace: BODY, fontSize: 12.5, color: TEXT, valign: 'middle' });
  s.addShape(p.ShapeType.roundRect, { x: 9.5, y: 4.55, w: 2.9, h: 0.75, rectRadius: 0.1, fill: { color: CARD2 }, line: { color: GOLD, width: 1 } });
  s.addText('“…is it real?”', { isTextBox: true, x: 9.65, y: 4.6, w: 2.6, h: 0.65, margin: 0, fontFace: BODY, fontSize: 12.5, italic: true, color: GOLDBR, valign: 'middle', align: 'right' });
  s.addText('Every merchant, every day — with no way to know.', { isTextBox: true, x: 8.8, y: 5.6, w: 3.6, h: 0.7, margin: 0, fontFace: BODY, fontSize: 12.5, color: DIM });
  foot(s);

  // ============ 3 · WHY UNSOLVED ============
  s = p.addSlide(); bg(s, INK);
  kicker(s, 'WHY IT STAYS UNSOLVED', M, 0.7);
  s.addText('The “proper” fix takes 6–18 months —\nper telco, per country.', { isTextBox: true, x: M, y: 1.05, w: 11.8, h: 1.5, margin: 0, fontFace: DISP, fontSize: 38, bold: true, color: TEXT, lineSpacingMultiple: 1.0 });
  s.addText([
    { text: 'The conventional route: negotiate B2B API access with every operator.', options: { breakLine: true, color: TEXT, bold: true, paraSpaceAfter: 8 } },
    { text: 'Long contracts. Country-by-country. And frequent flat rejection for the SMEs who need it most.', options: { breakLine: true, color: DIM, paraSpaceAfter: 8 } },
    { text: 'So most mobile-money commerce never gets it — and falls back to the screenshot.', options: { color: DIM } },
  ], { isTextBox: true, x: M, y: 2.9, w: 7.1, h: 2.2, margin: 0, fontFace: BODY, fontSize: 15.5, lineSpacingMultiple: 1.12 });

  // contrast bars
  const barX = 8.15, barW = 4.55;
  card(s, barX, 2.9, barW, 3.4, INK2);
  s.addText('TIME TO GO LIVE', { isTextBox: true, x: barX + 0.3, y: 3.15, w: barW - 0.6, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9.5, color: DIM, charSpacing: 2 });
  s.addText('Telco API deal', { isTextBox: true, x: barX + 0.3, y: 3.55, w: 3, h: 0.3, margin: 0, fontFace: BODY, fontSize: 12.5, color: TEXT });
  s.addShape(p.ShapeType.roundRect, { x: barX + 0.3, y: 3.9, w: barW - 0.6, h: 0.42, rectRadius: 0.06, fill: { color: '5A4A2A' } });
  s.addText('6–18 months', { isTextBox: true, x: barX + 0.4, y: 3.9, w: 3, h: 0.42, margin: 0, fontFace: DISP, fontSize: 13, bold: true, color: GOLDBR, valign: 'middle' });
  s.addText('KODA', { isTextBox: true, x: barX + 0.3, y: 4.6, w: 3, h: 0.3, margin: 0, fontFace: BODY, fontSize: 12.5, color: TEXT });
  s.addShape(p.ShapeType.roundRect, { x: barX + 0.3, y: 4.95, w: 1.15, h: 0.42, rectRadius: 0.06, fill: { color: GOLD } });
  s.addText('minutes', { isTextBox: true, x: barX + 0.3, y: 4.95, w: 1.15, h: 0.42, margin: 0, fontFace: DISP, fontSize: 12, bold: true, color: INK, valign: 'middle', align: 'center' });
  s.addText('No integration. No contract. Nothing to install on the telco side.', { isTextBox: true, x: barX + 0.3, y: 5.55, w: barW - 0.6, h: 0.6, margin: 0, fontFace: BODY, fontSize: 12, italic: true, color: DIM });
  foot(s);

  // ============ 4 · THE INSIGHT (GOLD) ============
  s = p.addSlide(); bg(s, GOLD);
  kicker(s, 'THE INSIGHT', M, 1.15, INK);
  s.addText([
    { text: 'The operator already sends a', options: { color: '5A4410', breakLine: true, fontSize: 30, bold: true } },
    { text: 'confirmation SMS.', options: { color: INK, breakLine: true, fontSize: 30, bold: true } },
    { text: 'That SMS is the API.', options: { color: INK, fontSize: 60, bold: true } },
  ], { isTextBox: true, x: M, y: 1.9, w: 12, h: 3.0, margin: 0, fontFace: DISP, lineSpacingMultiple: 1.05 });
  s.addText('KODA reads the SMS the merchant already receives — reference, amount, sender, running balance — and turns it into verifiable, replay-locked truth. No operator integration. Ever.',
    { isTextBox: true, x: M, y: 5.35, w: 11.2, h: 1.1, margin: 0, fontFace: BODY, fontSize: 18, color: '3D2E08', lineSpacingMultiple: 1.15 });

  // ============ 5 · HOW IT WORKS ============
  s = p.addSlide(); bg(s, INK2);
  kicker(s, 'HOW IT WORKS', M, 0.7);
  s.addText('Your customer pays exactly the way they paid yesterday.', { isTextBox: true, x: M, y: 1.05, w: 12, h: 0.7, margin: 0, fontFace: DISP, fontSize: 30, bold: true, color: TEXT });
  const steps = [
    ['Customer pays', 'Mobile money to your normal merchant number — nothing new to learn.'],
    ['Operator SMS lands', 'The confirmation SMS arrives on the merchant’s own phone, as always.'],
    ['KODA reads & matches', 'It parses the SMS, matches the customer’s code, and runs the fraud checks.'],
    ['Verdict in ~3 s', 'Delivered where you work: a webhook, a ✅ in the chat, or a green card in the console.'],
  ];
  const cw = (W - 2 * M - 3 * 0.3) / 4;
  steps.forEach((st, i) => {
    const x = M + i * (cw + 0.3), y = 2.3;
    card(s, x, y, cw, 3.5);
    s.addShape(p.ShapeType.ellipse, { x: x + 0.28, y: y + 0.3, w: 0.72, h: 0.72, fill: { color: GOLD } });
    s.addText(String(i + 1), { isTextBox: true, x: x + 0.28, y: y + 0.3, w: 0.72, h: 0.72, margin: 0, fontFace: DISP, fontSize: 26, bold: true, color: INK, align: 'center', valign: 'middle' });
    s.addText(st[0], { isTextBox: true, x: x + 0.26, y: y + 1.2, w: cw - 0.52, h: 0.7, margin: 0, fontFace: DISP, fontSize: 16.5, bold: true, color: GOLDBR });
    s.addText(st[1], { isTextBox: true, x: x + 0.26, y: y + 1.85, w: cw - 0.52, h: 1.5, margin: 0, fontFace: BODY, fontSize: 12.5, color: DIM, lineSpacingMultiple: 1.1 });
  });
  foot(s);

  // ============ 6 · FIVE DOORS ============
  s = p.addSlide(); bg(s, INK);
  kicker(s, 'MEETS EVERY MERCHANT', M, 0.7);
  s.addText('One engine. Five doors.', { isTextBox: true, x: M, y: 1.05, w: 8, h: 0.7, margin: 0, fontFace: DISP, fontSize: 34, bold: true, color: TEXT });
  s.addText('From a smartphone checkout to a feature phone with no internet — the customer confirms however they can.', { isTextBox: true, x: M, y: 1.72, w: 11.5, h: 0.5, margin: 0, fontFace: BODY, fontSize: 14.5, color: DIM });
  const doors = [
    ['edit', 'Manual', 'Paste the code in the Verify Console — no code to write.'],
    ['chat', 'WhatsApp', 'The code dropped in the chat is verified in-channel.'],
    ['code', 'API / drop-in', 'Three endpoints, a widget, and signed webhooks.'],
    ['hash', 'USSD', 'Dial a shortcode — any phone, no internet.'],
    ['inbox', 'Inbound SMS', 'Text the code (or forward the SMS) to verify.'],
  ];
  const dw = (W - 2 * M - 4 * 0.28) / 5;
  doors.forEach((d, i) => {
    const x = M + i * (dw + 0.28), y = 2.55;
    card(s, x, y, dw, 3.3);
    iconChip(s, d[0], x + 0.28, y + 0.32, 0.66);
    s.addText(d[1], { isTextBox: true, x: x + 0.24, y: y + 1.15, w: dw - 0.48, h: 0.45, margin: 0, fontFace: DISP, fontSize: 15.5, bold: true, color: GOLDBR });
    s.addText(d[2], { isTextBox: true, x: x + 0.24, y: y + 1.62, w: dw - 0.48, h: 1.5, margin: 0, fontFace: BODY, fontSize: 11.8, color: DIM, lineSpacingMultiple: 1.1 });
  });
  foot(s);

  // ============ 7 · ANTI-FRAUD ============
  s = p.addSlide(); bg(s, INK2);
  kicker(s, 'ANTI-FRAUD, BY DESIGN', M, 0.7);
  s.addText('Built to be lied to.', { isTextBox: true, x: M, y: 1.05, w: 8, h: 0.8, margin: 0, fontFace: DISP, fontSize: 40, bold: true, color: TEXT });
  s.addText('The truth is merchant-side and operator-issued — never anything the buyer can type or edit.', { isTextBox: true, x: M, y: 1.85, w: 11.5, h: 0.5, margin: 0, fontFace: BODY, fontSize: 15, color: DIM });
  const guards = [
    ['lock', 'Single-use, forever', 'One reference confirms one payment and is locked for life — replays are rejected.'],
    ['shield', 'Balance-chain forgery test', 'On device streams, the running balances must add up — a forged SMS breaks the chain.'],
    ['check', 'Amount & currency guards', 'A code only clears if the amount, currency and window all line up with the order.'],
    ['zap', 'Three honest confirmation tiers', 'Every receipt says how strongly it’s proven — self-reported, device-anchored, or operator cross-confirmed.'],
  ];
  guards.forEach((g, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * 6.1, y = 2.5 + row * 1.75;
    card(s, x, y, 5.85, 1.55);
    iconChip(s, g[0], x + 0.28, y + 0.28, 0.6);
    s.addText(g[1], { isTextBox: true, x: x + 1.1, y: y + 0.2, w: 4.6, h: 0.4, margin: 0, fontFace: DISP, fontSize: 16, bold: true, color: GOLDBR });
    s.addText(g[2], { isTextBox: true, x: x + 1.1, y: y + 0.62, w: 4.62, h: 0.8, margin: 0, fontFace: BODY, fontSize: 12.3, color: DIM, lineSpacingMultiple: 1.08 });
  });
  foot(s);

  // ============ 8 · COVERAGE ============
  s = p.addSlide(); bg(s, INK);
  kicker(s, 'GLOBAL BY CONSTRUCTION', M, 0.7);
  s.addText('Coverage is a parsing map — not a pile of telco deals.', { isTextBox: true, x: M, y: 1.05, w: 12, h: 0.7, margin: 0, fontFace: DISP, fontSize: 30, bold: true, color: TEXT });
  const stats = [['235', 'operators in the registry'], ['95', 'countries'], ['12', 'world regions'], ['111', 'template families']];
  const sw = (W - 2 * M - 3 * 0.3) / 4;
  stats.forEach((st, i) => {
    const x = M + i * (sw + 0.3), y = 2.35;
    card(s, x, y, sw, 1.9);
    s.addText(st[0], { isTextBox: true, x: x + 0.1, y: y + 0.25, w: sw - 0.2, h: 0.95, margin: 0, fontFace: DISP, fontSize: 60, bold: true, color: GOLD, align: 'center' });
    s.addText(st[1], { isTextBox: true, x: x + 0.1, y: y + 1.28, w: sw - 0.2, h: 0.5, margin: 0, fontFace: BODY, fontSize: 12.5, color: DIM, align: 'center' });
  });
  card(s, M, 4.55, W - 2 * M, 1.75, INK2);
  s.addText([
    { text: '6 hand-tuned LIVE packs today', options: { color: GOLDBR, bold: true } },
    { text: '  and climbing — auto-verify, hands-free. Every other operator is ', options: { color: TEXT } },
    { text: 'template-ready', options: { color: GOLDBR, bold: true } },
    { text: ': a multilingual generic parser already structures its SMS at a lower trust band until a precise pack ships. Nothing is claimed as fully supported when it isn’t — and no operator API is ever required.', options: { color: TEXT } },
  ], { isTextBox: true, x: M + 0.35, y: 4.8, w: W - 2 * M - 0.7, h: 1.25, margin: 0, fontFace: BODY, fontSize: 14.5, lineSpacingMultiple: 1.15 });
  foot(s);

  // ============ 9 · PRICING ============
  s = p.addSlide(); bg(s, INK2);
  kicker(s, 'THE MODEL', M, 0.7);
  s.addText('Free until your merchant actually gets paid.', { isTextBox: true, x: M, y: 1.05, w: 12, h: 0.7, margin: 0, fontFace: DISP, fontSize: 32, bold: true, color: TEXT });
  const plans = [['Marché', '$0', '10 / mo · forever'], ['Boutique', '$5', '190 verifs / mo'], ['Commerce', '$20', '760 verifs / mo'], ['Plateforme', '$100', '3,800 / mo'], ['Scale', '$399', '15,200 / mo'], ['Enterprise', 'Custom', 'committed volume']];
  const pw = (W - 2 * M - 5 * 0.24) / 6;
  plans.forEach((pl, i) => {
    const x = M + i * (pw + 0.24), y = 2.35;
    const hot = i === 2;
    card(s, x, y, pw, 2.35, hot ? CARD2 : CARD);
    if (hot) s.addShape(p.ShapeType.roundRect, { x, y, w: pw, h: 2.35, rectRadius: 0.11, fill: { type: 'none' }, line: { color: GOLD, width: 2 } });
    s.addText(pl[0], { isTextBox: true, x: x + 0.1, y: y + 0.24, w: pw - 0.2, h: 0.4, margin: 0, fontFace: DISP, fontSize: 14, bold: true, color: TEXT, align: 'center' });
    s.addText(pl[1], { isTextBox: true, x: x + 0.05, y: y + 0.75, w: pw - 0.1, h: 0.7, margin: 0, fontFace: DISP, fontSize: 27, bold: true, color: GOLD, align: 'center' });
    s.addText(pl[2], { isTextBox: true, x: x + 0.08, y: y + 1.55, w: pw - 0.16, h: 0.65, margin: 0, fontFace: BODY, fontSize: 10.5, color: DIM, align: 'center', lineSpacingMultiple: 1.05 });
  });
  card(s, M, 5.1, W - 2 * M, 1.2, INK);
  s.addText([
    { text: '“Pay only when your merchant gets paid.”  ', options: { color: GOLDBR, bold: true, italic: true } },
    { text: 'Beyond your quota, prepaid ACU — topped up via mobile money and verified by KODA’s own engine — covers overage and AI features. A plan’s included rate always beats pay-as-you-go.', options: { color: TEXT } },
  ], { isTextBox: true, x: M + 0.35, y: 5.32, w: W - 2 * M - 0.7, h: 0.8, margin: 0, fontFace: BODY, fontSize: 13.5, lineSpacingMultiple: 1.12 });
  foot(s);

  // ============ 10 · WHO IT'S FOR ============
  s = p.addSlide(); bg(s, INK);
  kicker(s, 'WHO IT’S FOR', M, 0.7);
  s.addText('One truth layer, every kind of seller.', { isTextBox: true, x: M, y: 1.05, w: 12, h: 0.7, margin: 0, fontFace: DISP, fontSize: 32, bold: true, color: TEXT });
  const auds = [
    ['bag', 'Merchants & SMEs', 'Restaurants, retail, transport, lodging — verify before you hand over goods.'],
    ['grid', 'Marketplaces & platforms', 'Sub-merchant API, scoped keys, trust scores — onboard thousands at wholesale.'],
    ['share', 'Distributors & resellers', 'Wholesale ACU, float-escrow rails and PIN vouchers to resell KODA downstream.'],
    ['home', 'Utilities, MFIs & Gov', 'Bulk reconciliation and audit-grade decision traces for every verification.'],
  ];
  const aw = (W - 2 * M - 3 * 0.3) / 4;
  auds.forEach((a, i) => {
    const x = M + i * (aw + 0.3), y = 2.35;
    card(s, x, y, aw, 3.55);
    iconChip(s, a[0], x + 0.28, y + 0.32, 0.7);
    s.addText(a[1], { isTextBox: true, x: x + 0.26, y: y + 1.25, w: aw - 0.5, h: 0.75, margin: 0, fontFace: DISP, fontSize: 15.5, bold: true, color: GOLDBR });
    s.addText(a[2], { isTextBox: true, x: x + 0.26, y: y + 1.95, w: aw - 0.5, h: 1.5, margin: 0, fontFace: BODY, fontSize: 12.3, color: DIM, lineSpacingMultiple: 1.12 });
  });
  foot(s);

  // ============ 11 · WHY NOW (CREAM) ============
  s = p.addSlide(); bg(s, CREAM);
  kicker(s, 'WHY KODA, WHY NOW', M, 0.85, GOLD);
  s.addText('It works today — and it’s honest about what it does.', { isTextBox: true, x: M, y: 1.25, w: 12, h: 0.9, margin: 0, fontFace: DISP, fontSize: 34, bold: true, color: INK });
  const whys = [
    ['Runs now, not someday', 'A zero-dependency engine already verifying across five doors — not a roadmap.'],
    ['Honest by construction', 'No fabricated proof; the coverage numbers come straight from the live registry.'],
    ['You never move money', 'KODA verifies payments and makes you first to know — funds go straight to your wallet.'],
    ['Africa-wide by design', 'DRC-first, and every operator sharing one SMS grammar unlocks its whole map at once.'],
  ];
  whys.forEach((w2, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * 6.1, y = 2.55 + row * 1.75;
    s.addShape(p.ShapeType.roundRect, { x, y, w: 5.85, h: 1.5, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'E4DCC6', width: 1 } });
    s.addShape(p.ShapeType.roundRect, { x: x + 0.26, y: y + 0.3, w: 0.6, h: 0.6, rectRadius: 0.1, fill: { color: INK } });
    if (ICOND.check) s.addImage({ data: ICOND.check, x: x + 0.26 + 0.12, y: y + 0.3 + 0.12, w: 0.36, h: 0.36 });
    s.addText(w2[0], { isTextBox: true, x: x + 1.06, y: y + 0.2, w: 4.6, h: 0.4, margin: 0, fontFace: DISP, fontSize: 15.5, bold: true, color: INK });
    s.addText(w2[1], { isTextBox: true, x: x + 1.06, y: y + 0.62, w: 4.62, h: 0.75, margin: 0, fontFace: BODY, fontSize: 12.3, color: '5A6A5E', lineSpacingMultiple: 1.08 });
  });
  s.addText('kodajnn.com   ·   Groupe Nseya Digital  ·  Kinshasa, DR Congo', { isTextBox: true, x: M, y: H - 0.5, w: W - 2 * M, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9.5, color: '8A968C' });

  // ============ 12 · CLOSE / CTA ============
  s = p.addSlide(); bg(s, INK);
  s.addText('KODA', { isTextBox: true, x: M, y: 1.5, w: 8, h: 1.1, margin: 0, fontFace: DISP, fontSize: 60, bold: true, color: GOLD, charSpacing: 5 });
  s.addText('Verify your first payment free.', { isTextBox: true, x: M, y: 2.75, w: 12, h: 1.0, margin: 0, fontFace: DISP, fontSize: 46, bold: true, color: TEXT });
  s.addText('A screenshot can be faked. The SMS can’t.', { isTextBox: true, x: M, y: 3.85, w: 12, h: 0.6, margin: 0, fontFace: BODY, fontSize: 19, italic: true, color: GOLDBR });
  // contact chips
  const chips = [['Web', 'kodajnn.com'], ['WhatsApp', '+243 828 139 153'], ['Email', 'koda@kodajnn.com']];
  chips.forEach((c, i) => {
    const x = M + i * 4.0, y = 5.1;
    card(s, x, y, 3.7, 1.0, INK2);
    s.addText(c[0].toUpperCase(), { isTextBox: true, x: x + 0.3, y: y + 0.18, w: 3.1, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9.5, color: DIM, charSpacing: 2 });
    s.addText(c[1], { isTextBox: true, x: x + 0.3, y: y + 0.46, w: 3.2, h: 0.4, margin: 0, fontFace: DISP, fontSize: 16, bold: true, color: GOLDBR });
  });
  s.addText('KODA — Groupe Nseya Digital / JNN Global Ltd  ·  Kinshasa, DR Congo  ·  a payment verification service; it never holds, moves or settles funds.',
    { isTextBox: true, x: M, y: H - 0.5, w: W - 2 * M, h: 0.3, margin: 0, fontFace: MONO, fontSize: 8.5, color: DIM });

  await p.writeFile({ fileName: '/home/user/KODA/brand/KODA-sales-deck.pptx' });
  console.log('deck written; icons:', Object.entries(ICON).filter(([, v]) => v).length, '/', Object.keys(ICON).length);
})();
