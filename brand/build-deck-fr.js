// KODA — deck commercial (français). Charte vert foncé + or, affirmations honnêtes.
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
  const ICON = {};
  const want = { edit: Fi.FiEdit3, chat: Fi.FiMessageCircle, code: Fi.FiCode, hash: Fi.FiHash, inbox: Fi.FiInbox,
    bag: Fi.FiShoppingBag, grid: Fi.FiGrid, share: Fi.FiShare2, home: Fi.FiHome, shield: Fi.FiShield, lock: Fi.FiLock, zap: Fi.FiZap, check: Fi.FiCheckCircle };
  for (const [k, C] of Object.entries(want)) ICON[k] = C ? await icon(C, GOLD) : null;
  const ICOND = {}; ICOND.check = Fi.FiCheckCircle ? await icon(Fi.FiCheckCircle, GOLD) : null;

  const p = new pptxgen();
  p.defineLayout({ name: 'W', width: 13.333, height: 7.5 }); p.layout = 'W';
  const W = 13.333, H = 7.5, M = 0.62;

  const bg = (s, c) => { s.background = { color: c }; };
  const kicker = (s, t, x, y, col = GOLD, w = 9) => s.addText(t, { isTextBox: true, x, y, w, h: 0.3, margin: 0, fontFace: MONO, fontSize: 11.5, color: col, charSpacing: 3, bold: true, align: 'left' });
  const shadow = () => ({ type: 'outer', color: '000000', opacity: 0.35, blur: 10, offset: 4, angle: 90 });
  const card = (s, x, y, w, h, fill = CARD) => s.addShape(p.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.11, fill: { color: fill }, line: { color: LINE, width: 1 }, shadow: shadow() });
  const iconChip = (s, key, x, y, d = 0.62, ring = CARD2) => {
    s.addShape(p.ShapeType.roundRect, { x, y, w: d, h: d, rectRadius: 0.1, fill: { color: ring }, line: { color: GOLD, width: 1 } });
    if (ICON[key]) s.addImage({ data: ICON[key], x: x + d * 0.2, y: y + d * 0.2, w: d * 0.6, h: d * 0.6 });
  };
  const foot = (s, dark = true) => s.addText(
    [{ text: 'kodajnn.com', options: { color: dark ? GOLD : INK, bold: true } },
     { text: '   ·   Groupe Nseya Digital  ·  Kinshasa, RD Congo', options: { color: dark ? DIM : '6B7A6E' } }],
    { isTextBox: true, x: M, y: H - 0.5, w: W - 2 * M, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9.5, align: 'left' });

  // 1 · TITRE
  let s = p.addSlide(); bg(s, INK);
  kicker(s, 'VÉRIFICATION DES PAIEMENTS MOBILE MONEY', M, 0.95);
  s.addText('KODA', { isTextBox: true, x: M, y: 1.35, w: 8, h: 1.5, margin: 0, fontFace: DISP, fontSize: 96, bold: true, color: GOLD, charSpacing: 6 });
  s.addText([{ text: 'Une capture peut être truquée.', options: { color: TEXT, breakLine: true } }, { text: 'Le SMS, non.', options: { color: GOLDBR } }],
    { isTextBox: true, x: M, y: 2.95, w: 12.1, h: 1.8, margin: 0, fontFace: DISP, fontSize: 50, bold: true, lineSpacingMultiple: 1.0 });
  s.addText('Vérifiez n’importe quel paiement mobile money grâce au SMS de confirmation de l’opérateur. Sans contrat télécom. Sans code à coller. Un verdict en quelques secondes.',
    { isTextBox: true, x: M, y: 5.15, w: 10.2, h: 1.1, margin: 0, fontFace: BODY, fontSize: 17, color: DIM, lineSpacingMultiple: 1.15 });
  foot(s);

  // 2 · PROBLÈME
  s = p.addSlide(); bg(s, INK2);
  kicker(s, 'LE PROBLÈME', M, 0.7);
  s.addText('Le commerce finit encore par\n« envoie-moi une capture ».', { isTextBox: true, x: M, y: 1.05, w: 8.6, h: 1.6, margin: 0, fontFace: DISP, fontSize: 36, bold: true, color: TEXT, lineSpacingMultiple: 1.0 });
  const probs = [
    ['Une capture ne prouve rien', 'Elle peut être modifiée, réutilisée ou inventée en quelques secondes — invisible pour le commerçant.'],
    ['La marchandise part avant l’argent', 'Livrer contre une fausse confirmation, et la perte est immédiate et totale.'],
    ['Le rapprochement est manuel', 'Associer paiements et commandes à la main est lent, source d’erreurs, et ne passe pas à l’échelle.'],
  ];
  probs.forEach((r, i) => {
    const y = 2.95 + i * 1.32; card(s, M, y, 7.4, 1.15);
    iconChip(s, 'shield', M + 0.28, y + 0.28, 0.58);
    s.addText(r[0], { isTextBox: true, x: M + 1.12, y: y + 0.15, w: 6.05, h: 0.4, margin: 0, fontFace: DISP, fontSize: 15.5, bold: true, color: TEXT });
    s.addText(r[1], { isTextBox: true, x: M + 1.12, y: y + 0.54, w: 6.1, h: 0.55, margin: 0, fontFace: BODY, fontSize: 12, color: DIM, lineSpacingMultiple: 1.05 });
  });
  card(s, 8.5, 2.95, 4.2, 3.7, INK);
  s.addText('CLIENT', { isTextBox: true, x: 8.8, y: 3.2, w: 3.6, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9, color: DIM, charSpacing: 2 });
  s.addShape(p.ShapeType.roundRect, { x: 8.8, y: 3.55, w: 3.2, h: 0.75, rectRadius: 0.1, fill: { color: CARD }, line: { color: LINE, width: 1 } });
  s.addText('« J’ai payé ! Voici la capture 📸 »', { isTextBox: true, x: 8.95, y: 3.6, w: 3.0, h: 0.65, margin: 0, fontFace: BODY, fontSize: 12, color: TEXT, valign: 'middle' });
  s.addShape(p.ShapeType.roundRect, { x: 9.5, y: 4.55, w: 2.9, h: 0.75, rectRadius: 0.1, fill: { color: CARD2 }, line: { color: GOLD, width: 1 } });
  s.addText('« …est-ce vrai ? »', { isTextBox: true, x: 9.65, y: 4.6, w: 2.6, h: 0.65, margin: 0, fontFace: BODY, fontSize: 12, italic: true, color: GOLDBR, valign: 'middle', align: 'right' });
  s.addText('Chaque commerçant, chaque jour — sans aucun moyen de savoir.', { isTextBox: true, x: 8.8, y: 5.6, w: 3.6, h: 0.8, margin: 0, fontFace: BODY, fontSize: 12.5, color: DIM });
  foot(s);

  // 3 · POURQUOI NON RÉSOLU
  s = p.addSlide(); bg(s, INK);
  kicker(s, 'POURQUOI ÇA RESTE NON RÉSOLU', M, 0.7);
  s.addText('La « vraie » solution prend 6 à 18 mois —\npar opérateur, par pays.', { isTextBox: true, x: M, y: 1.05, w: 11.9, h: 1.5, margin: 0, fontFace: DISP, fontSize: 34, bold: true, color: TEXT, lineSpacingMultiple: 1.0 });
  s.addText([
    { text: 'La voie classique : négocier un accès API B2B avec chaque opérateur.', options: { breakLine: true, color: TEXT, bold: true, paraSpaceAfter: 8 } },
    { text: 'Contrats longs. Pays par pays. Et un refus catégorique fréquent pour les PME qui en ont le plus besoin.', options: { breakLine: true, color: DIM, paraSpaceAfter: 8 } },
    { text: 'Alors la plupart du commerce mobile money n’y accède jamais — et revient à la capture d’écran.', options: { color: DIM } },
  ], { isTextBox: true, x: M, y: 2.9, w: 7.1, h: 2.4, margin: 0, fontFace: BODY, fontSize: 15, lineSpacingMultiple: 1.12 });
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
  s.addText('KODA lit le SMS que le commerçant reçoit déjà — référence, montant, expéditeur, solde — et le transforme en une vérité vérifiable, verrouillée contre le rejeu. Aucune intégration opérateur. Jamais.',
    { isTextBox: true, x: M, y: 5.35, w: 11.6, h: 1.15, margin: 0, fontFace: BODY, fontSize: 17.5, color: '3D2E08', lineSpacingMultiple: 1.12 });

  // 5 · COMMENT ÇA MARCHE
  s = p.addSlide(); bg(s, INK2);
  kicker(s, 'COMMENT ÇA MARCHE', M, 0.7);
  s.addText('Votre client paie exactement comme hier.', { isTextBox: true, x: M, y: 1.05, w: 12, h: 0.7, margin: 0, fontFace: DISP, fontSize: 30, bold: true, color: TEXT });
  const steps = [
    ['Le client paie', 'En mobile money vers votre numéro marchand habituel — rien de nouveau à apprendre.'],
    ['Le SMS opérateur arrive', 'Le SMS de confirmation arrive sur le téléphone du commerçant, comme toujours.'],
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

  // 6 · CINQ PORTES
  s = p.addSlide(); bg(s, INK);
  kicker(s, 'S’ADAPTE À CHAQUE COMMERÇANT', M, 0.7);
  s.addText('Un moteur. Cinq portes.', { isTextBox: true, x: M, y: 1.05, w: 8, h: 0.7, margin: 0, fontFace: DISP, fontSize: 34, bold: true, color: TEXT });
  s.addText('Du paiement sur smartphone au téléphone simple sans internet — le client confirme comme il peut.', { isTextBox: true, x: M, y: 1.72, w: 11.9, h: 0.5, margin: 0, fontFace: BODY, fontSize: 14.5, color: DIM });
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

  // 7 · ANTI-FRAUDE
  s = p.addSlide(); bg(s, INK2);
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
    const col = i % 2, row = Math.floor(i / 2);
    const x = M + col * 6.1, y = 2.5 + row * 1.78; card(s, x, y, 5.85, 1.6);
    iconChip(s, g[0], x + 0.28, y + 0.3, 0.6);
    s.addText(g[1], { isTextBox: true, x: x + 1.1, y: y + 0.18, w: 4.6, h: 0.4, margin: 0, fontFace: DISP, fontSize: 15, bold: true, color: GOLDBR });
    s.addText(g[2], { isTextBox: true, x: x + 1.1, y: y + 0.6, w: 4.62, h: 0.9, margin: 0, fontFace: BODY, fontSize: 11.8, color: DIM, lineSpacingMultiple: 1.06 });
  });
  foot(s);

  // 8 · COUVERTURE
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

  // 9 · LE MODÈLE
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
    { text: 'Au-delà du quota, les ACU prépayés — rechargés via mobile money et vérifiés par le moteur de KODA — couvrent le dépassement et les fonctions IA. Le tarif inclus d’un forfait bat toujours le paiement à l’usage.', options: { color: TEXT } },
  ], { isTextBox: true, x: M + 0.35, y: 5.3, w: W - 2 * M - 0.7, h: 0.85, margin: 0, fontFace: BODY, fontSize: 12.5, lineSpacingMultiple: 1.1 });
  foot(s);

  // 10 · POUR QUI
  s = p.addSlide(); bg(s, INK);
  kicker(s, 'POUR QUI', M, 0.7);
  s.addText('Une couche de vérité, pour tout type de vendeur.', { isTextBox: true, x: M, y: 1.05, w: 12, h: 0.7, margin: 0, fontFace: DISP, fontSize: 30, bold: true, color: TEXT });
  const auds = [
    ['bag', 'Commerçants & PME', 'Restauration, commerce, transport, hôtellerie — vérifiez avant de remettre la marchandise.'],
    ['grid', 'Places de marché & plateformes', 'API sous-marchand, clés limitées, scores de confiance — intégrez des milliers de marchands en gros.'],
    ['share', 'Distributeurs & revendeurs', 'ACU en gros, rails de dépôt-garantie et bons PIN pour revendre KODA en aval.'],
    ['home', 'Services publics, IMF & Gouv.', 'Rapprochement en masse et traces de décision de qualité audit pour chaque vérification.'],
  ];
  const aw = (W - 2 * M - 3 * 0.3) / 4;
  auds.forEach((a, i) => {
    const x = M + i * (aw + 0.3), y = 2.35; card(s, x, y, aw, 3.55);
    iconChip(s, a[0], x + 0.28, y + 0.32, 0.7);
    s.addText(a[1], { isTextBox: true, x: x + 0.26, y: y + 1.25, w: aw - 0.5, h: 0.8, margin: 0, fontFace: DISP, fontSize: 14.5, bold: true, color: GOLDBR });
    s.addText(a[2], { isTextBox: true, x: x + 0.26, y: y + 2.02, w: aw - 0.5, h: 1.45, margin: 0, fontFace: BODY, fontSize: 12, color: DIM, lineSpacingMultiple: 1.1 });
  });
  foot(s);

  // 11 · POURQUOI MAINTENANT (CRÈME)
  s = p.addSlide(); bg(s, CREAM);
  kicker(s, 'POURQUOI KODA, POURQUOI MAINTENANT', M, 0.85, GOLD);
  s.addText('Ça marche aujourd’hui — et c’est honnête sur ce que ça fait.', { isTextBox: true, x: M, y: 1.25, w: 12.2, h: 0.9, margin: 0, fontFace: DISP, fontSize: 31, bold: true, color: INK });
  const whys = [
    ['Opérationnel maintenant, pas un jour', 'Un moteur sans dépendance qui vérifie déjà sur cinq portes — pas une feuille de route.'],
    ['Honnête par conception', 'Aucune preuve fabriquée ; les chiffres de couverture viennent directement du registre en direct.'],
    ['Vous ne déplacez jamais l’argent', 'KODA vérifie les paiements et vous informe en premier — les fonds vont droit à votre portefeuille.'],
    ['Pensé pour toute l’Afrique', 'La RDC d’abord ; chaque opérateur partageant une même grammaire SMS ouvre toute sa carte d’un coup.'],
  ];
  whys.forEach((w2, i) => {
    const col = i % 2, row = Math.floor(i / 2); const x = M + col * 6.1, y = 2.55 + row * 1.75;
    s.addShape(p.ShapeType.roundRect, { x, y, w: 5.85, h: 1.5, rectRadius: 0.1, fill: { color: 'FFFFFF' }, line: { color: 'E4DCC6', width: 1 } });
    s.addShape(p.ShapeType.roundRect, { x: x + 0.26, y: y + 0.3, w: 0.6, h: 0.6, rectRadius: 0.1, fill: { color: INK } });
    if (ICOND.check) s.addImage({ data: ICOND.check, x: x + 0.26 + 0.12, y: y + 0.3 + 0.12, w: 0.36, h: 0.36 });
    s.addText(w2[0], { isTextBox: true, x: x + 1.06, y: y + 0.18, w: 4.62, h: 0.4, margin: 0, fontFace: DISP, fontSize: 14.5, bold: true, color: INK });
    s.addText(w2[1], { isTextBox: true, x: x + 1.06, y: y + 0.6, w: 4.62, h: 0.8, margin: 0, fontFace: BODY, fontSize: 12, color: '5A6A5E', lineSpacingMultiple: 1.06 });
  });
  s.addText('kodajnn.com   ·   Groupe Nseya Digital  ·  Kinshasa, RD Congo', { isTextBox: true, x: M, y: H - 0.5, w: W - 2 * M, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9.5, color: '8A968C' });

  // 12 · CLÔTURE
  s = p.addSlide(); bg(s, INK);
  s.addText('KODA', { isTextBox: true, x: M, y: 1.45, w: 8, h: 1.1, margin: 0, fontFace: DISP, fontSize: 60, bold: true, color: GOLD, charSpacing: 5 });
  s.addText('Vérifiez votre premier paiement gratuitement.', { isTextBox: true, x: M, y: 2.7, w: 12.1, h: 1.1, margin: 0, fontFace: DISP, fontSize: 40, bold: true, color: TEXT });
  s.addText('Une capture peut être truquée. Le SMS, non.', { isTextBox: true, x: M, y: 3.85, w: 12, h: 0.6, margin: 0, fontFace: BODY, fontSize: 19, italic: true, color: GOLDBR });
  const chips = [['Site', 'kodajnn.com'], ['WhatsApp', '+243 828 139 153'], ['E-mail', 'koda@kodajnn.com']];
  chips.forEach((c, i) => {
    const x = M + i * 4.0, y = 5.1; card(s, x, y, 3.7, 1.0, INK2);
    s.addText(c[0].toUpperCase(), { isTextBox: true, x: x + 0.3, y: y + 0.18, w: 3.1, h: 0.3, margin: 0, fontFace: MONO, fontSize: 9.5, color: DIM, charSpacing: 2 });
    s.addText(c[1], { isTextBox: true, x: x + 0.3, y: y + 0.46, w: 3.2, h: 0.4, margin: 0, fontFace: DISP, fontSize: 16, bold: true, color: GOLDBR });
  });
  s.addText('KODA — Groupe Nseya Digital / JNN Global Ltd  ·  Kinshasa, RD Congo  ·  un service de vérification des paiements ; il ne détient, ne déplace ni ne règle jamais de fonds.',
    { isTextBox: true, x: M, y: H - 0.5, w: W - 2 * M, h: 0.3, margin: 0, fontFace: MONO, fontSize: 8.5, color: DIM });

  await p.writeFile({ fileName: '/home/user/KODA/brand/KODA-deck-FR.pptx' });
  console.log('deck FR écrit; icônes:', Object.entries(ICON).filter(([, v]) => v).length, '/', Object.keys(ICON).length);
})();
