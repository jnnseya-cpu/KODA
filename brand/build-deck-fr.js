// KODA — deck commercial conversion commerçant (français). Vert foncé + or, honnête.
const pptxgen = require('pptxgenjs');
const React = require('react');
const ReactDOMServer = require('react-dom/server');
const sharp = require('sharp');
const Fi = require('react-icons/fi');

const INK = '081813', INK2 = '0C231C', CARD = '123027', CARD2 = '17392E';
const GOLD = 'E8A11F', GOLDBR = 'F2B944', CREAM = 'F5EFDF', TEXT = 'E9E4D5', DIM = '9BA79B', LINE = '2A4034';
const DISP = 'Arial', BODY = 'Calibri', MONO = 'Courier New';

async function icon(Comp, colorHex, size = 256) {
  try {
    const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(Comp, { color: '#' + colorHex, size, strokeWidth: 1.75 }));
    const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
    return 'image/png;base64,' + buf.toString('base64');
  } catch (e) { return null; }
}

(async () => {
  const NAMES = { edit: Fi.FiEdit3, chat: Fi.FiMessageCircle, code: Fi.FiCode, hash: Fi.FiHash, inbox: Fi.FiInbox,
    lock: Fi.FiLock, shield: Fi.FiShield, check: Fi.FiCheckCircle, zap: Fi.FiZap, x: Fi.FiXCircle };
  const ICON = {}; for (const [k, C] of Object.entries(NAMES)) ICON[k] = C ? await icon(C, GOLD) : null;
  const CHECKD = Fi.FiCheckCircle ? await icon(Fi.FiCheckCircle, GOLD) : null;
  const XD = Fi.FiXCircle ? await icon(Fi.FiXCircle, DIM) : null;

  const p = new pptxgen();
  p.defineLayout({ name: 'W', width: 13.333, height: 7.5 }); p.layout = 'W';
  const W = 13.333, H = 7.5, M = 0.62;

  const bg = (s, c) => { s.background = { color: c }; };
  const kicker = (s, t, x, y, col = GOLD, w = 11) => s.addText(t, { isTextBox: true, x, y, w, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11.5, color: col, charSpacing: 2.5, bold: true, align: 'left' });
  const shadow = () => ({ type: 'outer', color: '000000', opacity: 0.35, blur: 10, offset: 4, angle: 90 });
  const card = (s, x, y, w, h, fill = CARD) => s.addShape(p.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.11, fill: { color: fill }, line: { color: LINE, width: 1 }, shadow: shadow() });
  const iconChip = (s, key, x, y, d = 0.62, ring = CARD2) => {
    s.addShape(p.ShapeType.roundRect, { x, y, w: d, h: d, rectRadius: 0.1, fill: { color: ring }, line: { color: GOLD, width: 1 } });
    if (ICON[key]) s.addImage({ data: ICON[key], x: x + d * 0.2, y: y + d * 0.2, w: d * 0.6, h: d * 0.6 });
  };
  const foot = (s) => s.addText([{ text: 'kodajnn.com', options: { color: GOLD, bold: true } }, { text: '   ·   Groupe Nseya Digital  ·  Kinshasa, RD Congo', options: { color: DIM } }],
    { isTextBox: true, x: M, y: H - 0.5, w: W - 2 * M, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9.5, align: 'left' });

  // 1 · TITRE
  let s = p.addSlide(); bg(s, INK);
  kicker(s, 'VÉRIFICATION DES PAIEMENTS MOBILE MONEY', M, 0.95);
  s.addText('KODA', { isTextBox: true, x: M, y: 1.35, w: 8, h: 1.5, margin: 0, fontFace: DISP, fontSize: 96, bold: true, color: GOLD, charSpacing: 6 });
  s.addText([{ text: 'Une capture peut être truquée.', options: { color: TEXT, breakLine: true } }, { text: 'Le SMS, non.', options: { color: GOLDBR } }],
    { isTextBox: true, x: M, y: 2.95, w: 12.1, h: 1.8, margin: 0, fontFace: DISP, fontSize: 50, bold: true, lineSpacingMultiple: 1.0 });
  s.addText('Ne perdez plus d’argent à cause de fausses captures. Vérifiez chaque paiement mobile money grâce au SMS de confirmation de l’opérateur — en quelques secondes. Gratuit pour commencer.',
    { isTextBox: true, x: M, y: 5.15, w: 10.4, h: 1.1, margin: 0, fontFace: BODY, fontSize: 16.5, color: DIM, lineSpacingMultiple: 1.15 });
  foot(s);

  // 2 · PROBLÈME
  s = p.addSlide(); bg(s, INK2);
  kicker(s, 'LE PROBLÈME', M, 0.7);
  s.addText('Chaque fausse capture, c’est de l’argent\nen moins dans votre poche.', { isTextBox: true, x: M, y: 1.0, w: 8.6, h: 1.7, margin: 0, fontFace: DISP, fontSize: 33, bold: true, color: TEXT, lineSpacingMultiple: 1.0 });
  const probs = [
    ['Impossible de savoir si c’est vrai', 'Une capture est modifiée, réutilisée ou inventée en quelques secondes — et ressemble à s’y méprendre à une vraie.'],
    ['La marchandise part, pas l’argent', 'Livrez contre une fausse confirmation et la perte est pour vous — immédiate et totale.'],
    ['Vérifier à la main gâche vos journées', 'Faire défiler les SMS et rapprocher les paiements un par un ne tient pas au-delà de quelques ventes.'],
  ];
  probs.forEach((r, i) => {
    const y = 2.95 + i * 1.32; card(s, M, y, 7.4, 1.15);
    iconChip(s, 'x', M + 0.28, y + 0.28, 0.58);
    s.addText(r[0], { isTextBox: true, x: M + 1.12, y: y + 0.14, w: 6.05, h: 0.4, margin: 0, fontFace: DISP, fontSize: 15, bold: true, color: TEXT });
    s.addText(r[1], { isTextBox: true, x: M + 1.12, y: y + 0.52, w: 6.1, h: 0.58, margin: 0, fontFace: BODY, fontSize: 11.5, color: DIM, lineSpacingMultiple: 1.03 });
  });
  card(s, 8.5, 2.95, 4.2, 3.7, INK);
  s.addText('VOTRE CLIENT', { isTextBox: true, x: 8.8, y: 3.2, w: 3.6, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9, color: DIM, charSpacing: 2 });
  s.addShape(p.ShapeType.roundRect, { x: 8.8, y: 3.55, w: 3.2, h: 0.75, rectRadius: 0.1, fill: { color: CARD }, line: { color: LINE, width: 1 } });
  s.addText('« J’ai payé ! Voici la capture 📸 »', { isTextBox: true, x: 8.95, y: 3.6, w: 3.0, h: 0.65, margin: 0, fontFace: BODY, fontSize: 12, color: TEXT, valign: 'middle' });
  s.addShape(p.ShapeType.roundRect, { x: 9.5, y: 4.55, w: 2.9, h: 0.75, rectRadius: 0.1, fill: { color: CARD2 }, line: { color: GOLD, width: 1 } });
  s.addText('« …est-ce vrai ? »', { isTextBox: true, x: 9.65, y: 4.6, w: 2.6, h: 0.65, margin: 0, fontFace: BODY, fontSize: 12, italic: true, color: GOLDBR, valign: 'middle', align: 'right' });
  s.addText('Vous, chaque jour — sans aucun moyen de savoir.', { isTextBox: true, x: 8.8, y: 5.6, w: 3.6, h: 0.8, margin: 0, fontFace: BODY, fontSize: 12.5, color: DIM });
  foot(s);

  // 3 · POURQUOI ENCORE LA CAPTURE
  s = p.addSlide(); bg(s, INK);
  kicker(s, 'POURQUOI VOUS EN ÊTES ENCORE À LA CAPTURE', M, 0.7);
  s.addText('La « vraie » solution : un contrat télécom\nque vous n’aurez jamais.', { isTextBox: true, x: M, y: 1.05, w: 11.9, h: 1.5, margin: 0, fontFace: DISP, fontSize: 32, bold: true, color: TEXT, lineSpacingMultiple: 1.0 });
  s.addText([
    { text: 'Un accès direct à l’API opérateur, c’est 6 à 18 mois de négociation B2B — par opérateur, par pays.', options: { breakLine: true, color: TEXT, bold: true, paraSpaceAfter: 8 } },
    { text: 'Et les PME se voient régulièrement refuser l’accès.', options: { breakLine: true, color: DIM, paraSpaceAfter: 8 } },
    { text: 'Alors des millions de vendeurs en restent à la capture. Jusqu’à maintenant.', options: { color: GOLDBR, bold: true } },
  ], { isTextBox: true, x: M, y: 2.95, w: 7.1, h: 2.4, margin: 0, fontFace: BODY, fontSize: 15, lineSpacingMultiple: 1.12 });
  const barX = 8.15, barW = 4.55;
  card(s, barX, 2.9, barW, 3.4, INK2);
  s.addText('DÉLAI DE MISE EN SERVICE', { isTextBox: true, x: barX + 0.3, y: 3.15, w: barW - 0.6, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9, color: DIM, charSpacing: 1.5 });
  s.addText('Accord API télécom', { isTextBox: true, x: barX + 0.3, y: 3.55, w: 3, h: 0.3, margin: 0, fontFace: BODY, fontSize: 12.5, color: TEXT });
  s.addShape(p.ShapeType.roundRect, { x: barX + 0.3, y: 3.9, w: barW - 0.6, h: 0.42, rectRadius: 0.06, fill: { color: '5A4A2A' } });
  s.addText('6 à 18 mois', { isTextBox: true, x: barX + 0.4, y: 3.9, w: 3, h: 0.42, margin: 0, fontFace: DISP, fontSize: 13, bold: true, color: GOLDBR, valign: 'middle' });
  s.addText('KODA', { isTextBox: true, x: barX + 0.3, y: 4.6, w: 3, h: 0.3, margin: 0, fontFace: BODY, fontSize: 12.5, color: TEXT });
  s.addShape(p.ShapeType.roundRect, { x: barX + 0.3, y: 4.95, w: 1.15, h: 0.42, rectRadius: 0.06, fill: { color: GOLD } });
  s.addText('minutes', { isTextBox: true, x: barX + 0.3, y: 4.95, w: 1.15, h: 0.42, margin: 0, fontFace: DISP, fontSize: 12, bold: true, color: INK, valign: 'middle', align: 'center' });
  s.addText('Aucune intégration. Aucun contrat. Rien à installer côté télécom.', { isTextBox: true, x: barX + 0.3, y: 5.55, w: barW - 0.6, h: 0.6, margin: 0, fontFace: BODY, fontSize: 12, italic: true, color: DIM });
  foot(s);

  // 4 · L'IDÉE (OR)
  s = p.addSlide(); bg(s, GOLD);
  kicker(s, 'L’IDÉE CLÉ', M, 1.15, INK);
  s.addText([
    { text: 'L’opérateur envoie déjà un', options: { color: '5A4410', breakLine: true, fontSize: 30, bold: true } },
    { text: 'SMS de confirmation.', options: { color: INK, breakLine: true, fontSize: 30, bold: true } },
    { text: 'Ce SMS, c’est l’API.', options: { color: INK, fontSize: 58, bold: true } },
  ], { isTextBox: true, x: M, y: 1.9, w: 12.1, h: 3.0, margin: 0, fontFace: DISP, lineSpacingMultiple: 1.05 });
  s.addText('KODA lit le SMS que vous recevez déjà — référence, montant, expéditeur, solde — et le transforme en une vérité vérifiable, verrouillée contre le rejeu. Aucune intégration opérateur. Jamais.',
    { isTextBox: true, x: M, y: 5.35, w: 11.6, h: 1.15, margin: 0, fontFace: BODY, fontSize: 17.5, color: '3D2E08', lineSpacingMultiple: 1.12 });

  // 5 · COMMENT ÇA MARCHE
  s = p.addSlide(); bg(s, INK2);
  kicker(s, 'COMMENT ÇA MARCHE', M, 0.7);
  s.addText('Votre client paie exactement comme hier.', { isTextBox: true, x: M, y: 1.05, w: 12, h: 0.7, margin: 0, fontFace: DISP, fontSize: 30, bold: true, color: TEXT });
  const steps = [
    ['Le client paie', 'En mobile money vers votre numéro marchand habituel — rien de nouveau à apprendre.'],
    ['Le SMS opérateur arrive', 'Le SMS de confirmation arrive sur votre téléphone, exactement comme toujours.'],
    ['KODA lit et rapproche', 'Il analyse le SMS, rapproche le code du client et passe les contrôles anti-fraude.'],
    ['Verdict en ~3 s', 'Livré là où vous travaillez : un webhook, un ✅ dans le chat, ou une carte verte dans la console.'],
  ];
  const cw = (W - 2 * M - 3 * 0.3) / 4;
  steps.forEach((st, i) => {
    const x = M + i * (cw + 0.3), y = 2.3; card(s, x, y, cw, 3.5);
    s.addShape(p.ShapeType.ellipse, { x: x + 0.28, y: y + 0.3, w: 0.72, h: 0.72, fill: { color: GOLD } });
    s.addText(String(i + 1), { isTextBox: true, x: x + 0.28, y: y + 0.3, w: 0.72, h: 0.72, margin: 0, fontFace: DISP, fontSize: 26, bold: true, color: INK, align: 'center', valign: 'middle' });
    s.addText(st[0], { isTextBox: true, x: x + 0.26, y: y + 1.2, w: cw - 0.52, h: 0.75, margin: 0, fontFace: DISP, fontSize: 16, bold: true, color: GOLDBR });
    s.addText(st[1], { isTextBox: true, x: x + 0.26, y: y + 1.95, w: cw - 0.52, h: 1.45, margin: 0, fontFace: BODY, fontSize: 12.5, color: DIM, lineSpacingMultiple: 1.1 });
  });
  foot(s);

  // 6 · LA SEULE CONDITION
  s = p.addSlide(); bg(s, INK);
  kicker(s, 'LA SEULE CONDITION', M, 0.7);
  s.addText('Si votre opérateur VOUS écrit quand vous êtes payé, KODA fonctionne.', { isTextBox: true, x: M, y: 1.05, w: 12.2, h: 0.8, margin: 0, fontFace: DISP, fontSize: 28, bold: true, color: TEXT });
  s.addText('KODA vérifie grâce au SMS de confirmation que votre opérateur mobile money envoie déjà à votre numéro marchand. Toute la liste :', { isTextBox: true, x: M, y: 1.9, w: 12.0, h: 0.5, margin: 0, fontFace: BODY, fontSize: 14, color: DIM });
  const reqs = [
    ['Vous acceptez le mobile money', 'Orange Money, M-Pesa, Airtel, Afrimoney, MTN, Wave — et plus de 200 opérateurs.'],
    ['Le SMS de confirmation arrive sur votre téléphone', 'Celui que votre opérateur envoie à votre numéro marchand à chaque paiement.'],
    ['C’est tout — vous êtes prêt', 'Aucune nouvelle SIM. Aucun nouveau numéro. Rien à installer pour votre client.'],
  ];
  const rw = (W - 2 * M - 2 * 0.3) / 3;
  reqs.forEach((r, i) => {
    const x = M + i * (rw + 0.3), y = 2.65; card(s, x, y, rw, 3.15);
    iconChip(s, 'check', x + 0.3, y + 0.3, 0.72);
    s.addText(r[0], { isTextBox: true, x: x + 0.3, y: y + 1.22, w: rw - 0.6, h: 0.85, margin: 0, fontFace: DISP, fontSize: 15, bold: true, color: GOLDBR });
    s.addText(r[1], { isTextBox: true, x: x + 0.3, y: y + 2.05, w: rw - 0.6, h: 1.0, margin: 0, fontFace: BODY, fontSize: 12, color: DIM, lineSpacingMultiple: 1.1 });
  });
  foot(s);

  // 7 · CINQ PORTES
  s = p.addSlide(); bg(s, INK2);
  kicker(s, 'S’ADAPTE À CHAQUE COMMERÇANT', M, 0.7);
  s.addText('Un moteur. Cinq portes.', { isTextBox: true, x: M, y: 1.05, w: 8, h: 0.7, margin: 0, fontFace: DISP, fontSize: 34, bold: true, color: TEXT });
  s.addText('Du paiement sur smartphone au téléphone simple sans internet — votre client confirme comme il peut.', { isTextBox: true, x: M, y: 1.72, w: 11.9, h: 0.5, margin: 0, fontFace: BODY, fontSize: 14.5, color: DIM });
  const doors = [
    ['edit', 'Manuel', 'Collez le code dans la Console — aucun code à écrire.'],
    ['chat', 'WhatsApp', 'Le code déposé dans le chat est vérifié dans la conversation.'],
    ['code', 'API / intégré', 'Trois endpoints, un widget et des webhooks signés.'],
    ['hash', 'USSD', 'Composez un code court — tout téléphone, sans internet.'],
    ['inbox', 'SMS entrant', 'Envoyez le code (ou transférez le SMS) pour vérifier.'],
  ];
  const dw = (W - 2 * M - 4 * 0.28) / 5;
  doors.forEach((d, i) => {
    const x = M + i * (dw + 0.28), y = 2.55; card(s, x, y, dw, 3.3);
    iconChip(s, d[0], x + 0.28, y + 0.32, 0.66);
    s.addText(d[1], { isTextBox: true, x: x + 0.24, y: y + 1.15, w: dw - 0.48, h: 0.45, margin: 0, fontFace: DISP, fontSize: 15, bold: true, color: GOLDBR });
    s.addText(d[2], { isTextBox: true, x: x + 0.24, y: y + 1.62, w: dw - 0.48, h: 1.55, margin: 0, fontFace: BODY, fontSize: 11.5, color: DIM, lineSpacingMultiple: 1.08 });
  });
  foot(s);

  // 8 · ANTI-FRAUDE
  s = p.addSlide(); bg(s, INK);
  kicker(s, 'ANTI-FRAUDE, PAR CONCEPTION', M, 0.7);
  s.addText('Conçu pour qu’on lui mente.', { isTextBox: true, x: M, y: 1.05, w: 10, h: 0.8, margin: 0, fontFace: DISP, fontSize: 38, bold: true, color: TEXT });
  s.addText('La vérité vient du côté commerçant, émise par l’opérateur — jamais de ce que l’acheteur peut taper ou modifier.', { isTextBox: true, x: M, y: 1.85, w: 11.9, h: 0.5, margin: 0, fontFace: BODY, fontSize: 14.5, color: DIM });
  const guards = [
    ['lock', 'À usage unique, pour toujours', 'Une référence confirme un seul paiement et est verrouillée à vie — les rejeux sont refusés.'],
    ['shield', 'Test anti-falsification (chaîne de solde)', 'Sur les flux appareils, les soldes doivent s’enchaîner — un SMS falsifié brise la chaîne.'],
    ['check', 'Contrôles montant & devise', 'Un code ne passe que si le montant, la devise et la fenêtre correspondent à la commande.'],
    ['zap', 'Trois niveaux de confiance honnêtes', 'Chaque reçu indique la force de la preuve : auto-déclaré, ancré à l’appareil ou confirmé par l’opérateur.'],
  ];
  guards.forEach((g, i) => {
    const col = i % 2, row = Math.floor(i / 2); const x = M + col * 6.1, y = 2.5 + row * 1.78; card(s, x, y, 5.85, 1.6);
    iconChip(s, g[0], x + 0.28, y + 0.3, 0.6);
    s.addText(g[1], { isTextBox: true, x: x + 1.1, y: y + 0.18, w: 4.6, h: 0.4, margin: 0, fontFace: DISP, fontSize: 15, bold: true, color: GOLDBR });
    s.addText(g[2], { isTextBox: true, x: x + 1.1, y: y + 0.6, w: 4.62, h: 0.9, margin: 0, fontFace: BODY, fontSize: 11.8, color: DIM, lineSpacingMultiple: 1.06 });
  });
  foot(s);

  // 9 · CE QUE KODA EST — ET N'EST PAS (CRÈME · clause)
  s = p.addSlide(); bg(s, CREAM);
  kicker(s, 'CE QUE KODA EST — ET N’EST PAS', M, 0.7, GOLD);
  s.addText('Nous vérifions vos paiements. Nous ne touchons jamais à votre argent.', { isTextBox: true, x: M, y: 1.05, w: 12.2, h: 0.9, margin: 0, fontFace: DISP, fontSize: 28, bold: true, color: INK });
  s.addShape(p.ShapeType.roundRect, { x: M, y: 2.3, w: 5.85, h: 2.25, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'E4DCC6', width: 1 } });
  s.addShape(p.ShapeType.roundRect, { x: M + 0.3, y: 2.57, w: 0.6, h: 0.6, rectRadius: 0.1, fill: { color: INK } });
  if (CHECKD) s.addImage({ data: CHECKD, x: M + 0.42, y: 2.69, w: 0.36, h: 0.36 });
  s.addText('KODA EST', { isTextBox: true, x: M + 1.1, y: 2.63, w: 4.5, h: 0.4, margin: 0, fontFace: DISP, fontSize: 17, bold: true, color: INK });
  s.addText('Un service de VÉRIFICATION des paiements. Il lit la confirmation de l’opérateur, la note contre la fraude, la verrouille contre le rejeu, et vous dit en quelques secondes ce qui est réel.',
    { isTextBox: true, x: M + 0.32, y: 3.3, w: 5.25, h: 1.1, margin: 0, fontFace: BODY, fontSize: 12.5, color: '46534A', lineSpacingMultiple: 1.1 });
  const nx = M + 6.25;
  s.addShape(p.ShapeType.roundRect, { x: nx, y: 2.3, w: 5.85, h: 2.25, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'E4DCC6', width: 1 } });
  s.addShape(p.ShapeType.roundRect, { x: nx + 0.3, y: 2.57, w: 0.6, h: 0.6, rectRadius: 0.1, fill: { color: 'EAE1CB' } });
  if (XD) s.addImage({ data: XD, x: nx + 0.42, y: 2.69, w: 0.36, h: 0.36 });
  s.addText('KODA N’EST PAS', { isTextBox: true, x: nx + 1.1, y: 2.63, w: 4.5, h: 0.4, margin: 0, fontFace: DISP, fontSize: 17, bold: true, color: '6B7A6E' });
  s.addText('Une banque, un portefeuille, un processeur de paiement, un agrégateur, un séquestre ou un émetteur de monnaie. Il ne détient, ne déplace ni ne règle jamais de fonds.',
    { isTextBox: true, x: nx + 0.32, y: 3.3, w: 5.25, h: 1.1, margin: 0, fontFace: BODY, fontSize: 12.5, color: '46534A', lineSpacingMultiple: 1.1 });
  s.addText([
    { text: 'Votre argent va directement du client à vous, sur le réseau propre de l’opérateur. ', options: { color: INK, bold: true } },
    { text: 'La vérification repose sur les confirmations opérateur côté commerçant — notée contre la fraude et protégée contre le rejeu — mais ne garantit pas contre les annulations côté opérateur ni ne constitue une preuve de règlement. KODA vous informe en premier.', options: { color: '5A6A5E' } },
  ], { isTextBox: true, x: M, y: 4.78, w: W - 2 * M, h: 1.4, margin: 0, fontFace: BODY, fontSize: 12.5, lineSpacingMultiple: 1.16 });
  s.addText('kodajnn.com   ·   Groupe Nseya Digital  ·  Kinshasa, RD Congo', { isTextBox: true, x: M, y: H - 0.5, w: W - 2 * M, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9.5, color: '8A968C' });

  // 10 · COUVERTURE
  s = p.addSlide(); bg(s, INK);
  kicker(s, 'MONDIAL PAR CONCEPTION', M, 0.7);
  s.addText('La couverture est une carte d’analyse — pas une pile de contrats.', { isTextBox: true, x: M, y: 1.05, w: 12.1, h: 0.7, margin: 0, fontFace: DISP, fontSize: 29, bold: true, color: TEXT });
  const stats = [['235', 'opérateurs au registre'], ['95', 'pays'], ['12', 'régions du monde'], ['111', 'familles de modèles']];
  const sw = (W - 2 * M - 3 * 0.3) / 4;
  stats.forEach((st, i) => {
    const x = M + i * (sw + 0.3), y = 2.35; card(s, x, y, sw, 1.9);
    s.addText(st[0], { isTextBox: true, x: x + 0.1, y: y + 0.25, w: sw - 0.2, h: 0.95, margin: 0, fontFace: DISP, fontSize: 60, bold: true, color: GOLD, align: 'center' });
    s.addText(st[1], { isTextBox: true, x: x + 0.08, y: y + 1.28, w: sw - 0.16, h: 0.5, margin: 0, fontFace: BODY, fontSize: 12, color: DIM, align: 'center' });
  });
  card(s, M, 4.55, W - 2 * M, 1.75, INK2);
  s.addText([
    { text: '6 packs LIVE ajustés à la main aujourd’hui', options: { color: GOLDBR, bold: true } },
    { text: ' et en croissance — vérification automatique, sans intervention. Tout autre opérateur est ', options: { color: TEXT } },
    { text: 'prêt à l’emploi', options: { color: GOLDBR, bold: true } },
    { text: ' : un analyseur générique multilingue structure déjà son SMS à un niveau de confiance moindre jusqu’à la publication d’un pack précis. Rien n’est présenté comme pleinement pris en charge tant que ça ne l’est pas — et aucune API opérateur n’est jamais requise.', options: { color: TEXT } },
  ], { isTextBox: true, x: M + 0.35, y: 4.78, w: W - 2 * M - 0.7, h: 1.3, margin: 0, fontFace: BODY, fontSize: 13.5, lineSpacingMultiple: 1.12 });
  foot(s);

  // 11 · LE MODÈLE
  s = p.addSlide(); bg(s, INK2);
  kicker(s, 'LE MODÈLE', M, 0.7);
  s.addText('Gratuit jusqu’à ce que votre commerçant soit vraiment payé.', { isTextBox: true, x: M, y: 1.05, w: 12.1, h: 0.7, margin: 0, fontFace: DISP, fontSize: 29, bold: true, color: TEXT });
  const plans = [['Marché', '$0', '10 / mois · à vie'], ['Boutique', '$5', '190 vérifs / mois'], ['Commerce', '$20', '760 vérifs / mois'], ['Plateforme', '$100', '3 800 / mois'], ['Scale', '$399', '15 200 / mois'], ['Entreprise', 'Sur mesure', 'volume engagé']];
  const pw = (W - 2 * M - 5 * 0.24) / 6;
  plans.forEach((pl, i) => {
    const x = M + i * (pw + 0.24), y = 2.35, hot = i === 2; card(s, x, y, pw, 2.35, hot ? CARD2 : CARD);
    if (hot) s.addShape(p.ShapeType.roundRect, { x, y, w: pw, h: 2.35, rectRadius: 0.11, fill: { type: 'none' }, line: { color: GOLD, width: 2 } });
    s.addText(pl[0], { isTextBox: true, x: x + 0.05, y: y + 0.24, w: pw - 0.1, h: 0.4, margin: 0, fontFace: DISP, fontSize: 13.5, bold: true, color: TEXT, align: 'center' });
    s.addText(pl[1], { isTextBox: true, x: x + 0.04, y: y + 0.75, w: pw - 0.08, h: 0.7, margin: 0, fontFace: DISP, fontSize: pl[1].length > 4 ? 15 : 27, bold: true, color: GOLD, align: 'center', valign: 'middle' });
    s.addText(pl[2], { isTextBox: true, x: x + 0.06, y: y + 1.55, w: pw - 0.12, h: 0.65, margin: 0, fontFace: BODY, fontSize: 10, color: DIM, align: 'center', lineSpacingMultiple: 1.05 });
  });
  card(s, M, 5.1, W - 2 * M, 1.2, INK);
  s.addText([
    { text: '« Payez seulement quand votre commerçant est payé. »  ', options: { color: GOLDBR, bold: true, italic: true } },
    { text: 'Commencez gratuitement à vie — 10 vérifications par mois, sans carte. Au-delà, les ACU prépayés (rechargés via mobile money, vérifiés par le moteur de KODA) couvrent le dépassement. Le tarif inclus d’un forfait bat toujours le paiement à l’usage.', options: { color: TEXT } },
  ], { isTextBox: true, x: M + 0.35, y: 5.28, w: W - 2 * M - 0.7, h: 0.9, margin: 0, fontFace: BODY, fontSize: 12, lineSpacingMultiple: 1.08 });
  foot(s);

  // 12 · COMMENCEZ EN 3 ÉTAPES
  s = p.addSlide(); bg(s, INK);
  kicker(s, 'COMMENCEZ DANS LES 10 PROCHAINES MINUTES', M, 0.7);
  s.addText('Gratuit à vie. Sans carte. Sans contrat.', { isTextBox: true, x: M, y: 1.05, w: 12, h: 0.7, margin: 0, fontFace: DISP, fontSize: 32, bold: true, color: TEXT });
  const start = [
    ['Créez un compte gratuit', 'En une minute — 10 vérifications par mois, gratuites à vie.'],
    ['Ajoutez votre numéro mobile money', 'Le numéro marchand sur lequel arrive déjà le SMS de confirmation.'],
    ['Vérifiez votre premier paiement', 'Collez le code du client — un verdict anti-fraude en trois secondes environ.'],
  ];
  const sw3 = (W - 2 * M - 2 * 0.3) / 3;
  start.forEach((st, i) => {
    const x = M + i * (sw3 + 0.3), y = 2.5; card(s, x, y, sw3, 2.9);
    s.addShape(p.ShapeType.ellipse, { x: x + 0.3, y: y + 0.32, w: 0.72, h: 0.72, fill: { color: GOLD } });
    s.addText(String(i + 1), { isTextBox: true, x: x + 0.3, y: y + 0.32, w: 0.72, h: 0.72, margin: 0, fontFace: DISP, fontSize: 26, bold: true, color: INK, align: 'center', valign: 'middle' });
    s.addText(st[0], { isTextBox: true, x: x + 0.3, y: y + 1.18, w: sw3 - 0.6, h: 0.75, margin: 0, fontFace: DISP, fontSize: 16, bold: true, color: GOLDBR });
    s.addText(st[1], { isTextBox: true, x: x + 0.3, y: y + 1.92, w: sw3 - 0.6, h: 0.9, margin: 0, fontFace: BODY, fontSize: 12.5, color: DIM, lineSpacingMultiple: 1.1 });
  });
  s.addShape(p.ShapeType.roundRect, { x: M, y: 5.75, w: 5.5, h: 0.62, rectRadius: 0.31, fill: { color: GOLD } });
  s.addText('Commencer gratuitement  →  kodajnn.com/app', { isTextBox: true, x: M, y: 5.75, w: 5.5, h: 0.62, margin: 0, fontFace: DISP, fontSize: 14.5, bold: true, color: INK, align: 'center', valign: 'middle' });
  foot(s);

  // 13 · CLÔTURE
  s = p.addSlide(); bg(s, INK);
  s.addText('KODA', { isTextBox: true, x: M, y: 1.35, w: 8, h: 1.1, margin: 0, fontFace: DISP, fontSize: 58, bold: true, color: GOLD, charSpacing: 5 });
  s.addText('Vérifiez votre premier paiement\ngratuitement — maintenant.', { isTextBox: true, x: M, y: 2.55, w: 12.1, h: 1.5, margin: 0, fontFace: DISP, fontSize: 38, bold: true, color: TEXT, lineSpacingMultiple: 0.98 });
  s.addText('Une capture peut être truquée. Le SMS, non.  ·  Gratuit à vie, sans carte.', { isTextBox: true, x: M, y: 4.15, w: 12.1, h: 0.5, margin: 0, fontFace: BODY, fontSize: 16.5, italic: true, color: GOLDBR });
  const chips = [['Site', 'kodajnn.com'], ['WhatsApp', '+243 828 139 153'], ['E-mail', 'koda@kodajnn.com']];
  chips.forEach((c, i) => {
    const x = M + i * 4.0, y = 5.05; card(s, x, y, 3.7, 1.0, INK2);
    s.addText(c[0].toUpperCase(), { isTextBox: true, x: x + 0.3, y: y + 0.18, w: 3.1, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9.5, color: DIM, charSpacing: 2 });
    s.addText(c[1], { isTextBox: true, x: x + 0.3, y: y + 0.46, w: 3.2, h: 0.4, margin: 0, fontFace: DISP, fontSize: 16, bold: true, color: GOLDBR });
  });
  s.addText('KODA — un service de vérification des paiements ; il ne détient, ne déplace ni ne règle jamais de fonds. Groupe Nseya Digital / JNN Global Ltd · Kinshasa, RD Congo.',
    { isTextBox: true, x: M, y: H - 0.48, w: W - 2 * M, h: 0.3, margin: 0, fontFace: MONO, fontSize: 8.5, color: DIM });

  await p.writeFile({ fileName: '/home/user/KODA/brand/KODA-deck-FR.pptx' });
  console.log('deck FR écrit; icônes:', Object.values(ICON).filter(Boolean).length, '/', Object.keys(ICON).length);
})();
