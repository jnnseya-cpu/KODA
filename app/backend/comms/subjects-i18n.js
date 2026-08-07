// KODA — localised comm-event subjects for the money-path events a merchant actually
// reads (payments, billing, fraud, network ownership). The catalogue in shared/events.js
// holds the canonical English subject; this maps the high-value keys to the merchant's
// language. Anything not here falls back to the English catalogue subject, so adding a
// language never breaks an event. Placeholders ({{amount}}, {{reference}}, …) are kept
// verbatim and interpolated by notify.js after selection.
'use strict';

// Regional lingua-franca fallback: a partly-covered language falls back to fr (francophone)
// or en (anglophone) before the ultimate English catalogue subject.
const FALLBACK = { ln: 'fr', wo: 'fr', sw: 'en', ak: 'en' };

const S = {
  'payment.verified': {
    fr: 'Paiement vérifié — {{amount}}', sw: 'Malipo yamethibitishwa — {{amount}}',
    ln: 'Mbongo etalami — {{amount}}', wo: 'Peyeman dëggal na — {{amount}}', ak: 'Wɔahwɛ sika tua no ho — {{amount}}',
  },
  'payment.verified.late': {
    fr: 'SMS tardif rattaché — {{amount}} vérifié', sw: 'SMS ya kuchelewa imelingana — {{amount}} imethibitishwa',
    ln: 'SMS ya nsima ekangami — {{amount}} etalami', wo: 'SMS bu yeex boole na — {{amount}} dëggal na', ak: 'SMS a ɛkaa akyi no ahyia — wɔahwɛ {{amount}} ho',
  },
  'payment.pending_review': {
    fr: 'Une vérification à contrôler — {{reference}}', sw: 'Uthibitisho unahitaji ukaguzi — {{reference}}',
    ln: 'Botali esengeli kotalama — {{reference}}', wo: 'Seetlu bu war a seetlu — {{reference}}', ak: 'Nhwɛmu bi hia nhwehwɛmu — {{reference}}',
  },
  'payment.rejected': {
    fr: 'Vérification rejetée — {{reference}}', sw: 'Uthibitisho umekataliwa — {{reference}}',
    ln: 'Botali epesami te — {{reference}}', wo: 'Seetlu bi bañ nañu ko — {{reference}}', ak: 'Wɔapo nhwɛmu no — {{reference}}',
  },
  'payment.reversed': {
    fr: 'Annulation opérateur détectée — {{amount}}', sw: 'Ubatilishaji wa opereta umegunduliwa — {{amount}}',
    ln: 'Bolongoli ya opérateur emonani — {{amount}}', wo: 'Firi opérateur gis nañu ko — {{amount}}', ak: 'Yɛahunu operator reversal — {{amount}}',
  },
  'payment.unmatched': {
    fr: 'Vous avez été payé sans commande liée — {{amount}}', sw: 'Umelipwa bila oda iliyoambatishwa — {{amount}}',
    ln: 'Bafuti yo kozanga commande — {{amount}}', wo: 'Fey nañu la te amul komaand — {{amount}}', ak: 'Wɔatua wo a order biara nka ho — {{amount}}',
  },
  'intent.expired': {
    fr: 'Intention de paiement expirée sans paiement', sw: 'Nia ya malipo imeisha bila kulipwa',
    ln: 'Mokano ya kofuta esili ntango', wo: 'Xalaat peyeman bi jóg na te feyu ko', ak: 'Payment intent no aberɛ atwam a wontuaeɛ',
  },
  'receipt.issued': {
    fr: 'Reçu {{number}} envoyé à votre client', sw: 'Risiti {{number}} imetumwa kwa mteja wako',
    ln: 'Reçu {{number}} etindami epai ya kiliya na yo', wo: 'Reçu {{number}} yónnee nañu ko sa kiliyaŋ', ak: 'Wɔde receipt {{number}} kɔmaa wo customer',
  },
  'replay.blocked': {
    fr: 'Un code déjà utilisé a été resoumis', sw: 'Msimbo uliotumika umewasilishwa tena',
    ln: 'Code oyo esalelami esalelami lisusu', wo: 'Kode bu jëfandikoo bindaat nañu ko', ak: 'Wɔde code a wɔde adi dwuma dada asan de ama',
  },
  'fraud.high_risk_blocked': {
    fr: 'Une vérification à haut risque a été bloquée', sw: 'Uthibitisho wa hatari kubwa umezuiwa',
    ln: 'Botali ya likama monene ekangami', wo: 'Seetlu bu am risk bu réy téye nañu ko', ak: 'Wɔasi nhwɛmu a asiane wɔ mu kɛse ano',
  },
  'fraud.chain_break': {
    fr: 'SMS suspect mis en quarantaine sur votre ligne', sw: 'SMS ya kutiliwa shaka imetengwa kwenye laini yako',
    ln: 'SMS ya kokanela ekangami na ligne na yo', wo: 'SMS bu ñu sikk téye nañu ko ci sa ligne', ak: 'Wɔayi SMS a wɔn ani nnye ho asi nkyɛn wɔ wo line so',
  },
  'billing.topup.verified': {
    fr: 'Recharge vérifiée — {{acu}} ACU crédités', sw: 'Malipo ya kuongeza yamethibitishwa — {{acu}} ACU zimewekwa',
    ln: 'Bobakisi etalami — {{acu}} ACU ebakisami', wo: 'Yokk bi dëggal na — {{acu}} ACU dugal nañu ko', ak: 'Wɔahwɛ top-up no ho — wɔde {{acu}} ACU aka ho',
  },
  'billing.low_balance': {
    fr: 'Solde ACU sous votre seuil d’alerte', sw: 'Salio la ACU chini ya kiwango chako cha tahadhari',
    ln: 'Reste ya ACU na se ya seuil na yo', wo: 'Des ACU bi ci suuf sa seuil alerte', ak: 'ACU balance no wɔ wo alert threshold no ase',
  },
  'billing.grace_started': {
    fr: 'Solde à zéro — tampon de grâce 72h actif', sw: 'Salio ni sifuri — buffer ya neema ya saa 72 inatumika',
    ln: 'Reste na zéro — tampon ya ngolu ya ngonga 72 ezali kosala', wo: 'Des bi ci tus — buffer ngërëm 72h dafa dox', ak: 'Balance no wɔ zero — grace buffer 72h no reyɛ adwuma',
  },
  'billing.grace_ending': {
    fr: 'Le tampon de grâce se termine dans 12h — rechargez maintenant', sw: 'Buffer ya neema inaisha baada ya saa 12 — ongeza sasa',
    ln: 'Tampon ya ngolu ekosila na ngonga 12 — bakisa sikoyo', wo: 'Buffer ngërëm bi jóg ci 12h — yokkal léegi', ak: 'Grace buffer no bɛba awiei wɔ nnɔnhwerew 12 mu — fa ka ho seesei',
  },
  'billing.suspended': {
    fr: 'Nouvelles intentions en pause — solde épuisé', sw: 'Nia mpya zimesitishwa — salio limeisha',
    ln: 'Mikano ya sika epemi — reste esili', wo: 'Xalaat yu bees taxaw nañu — des bi jeex na', ak: 'Wɔagyae intent foforɔ — balance no asa',
  },
  'networks.ownership_verified': {
    fr: 'Propriété {{network}} confirmée — vous pouvez l’activer', sw: 'Umiliki wa {{network}} umethibitishwa — unaweza kuiwasha',
    ln: 'Bonkolo ya {{network}} endimami — okoki kofungola yango', wo: 'Moom {{network}} dëggal na — man ngaa ko taxawal', ak: 'Wɔasi {{network}} ho dua sɛ wo dea — wubetumi ahyɛ no',
  },
};

// Return the localised subject template for an event key + language, or null to let
// the caller use the catalogue's English subject.
function localizedSubject(eventKey, lang) {
  const row = S[eventKey];
  if (!row) return null;
  const L = (lang || 'fr').slice(0, 2);
  if (row[L]) return row[L];
  const fb = FALLBACK[L];
  if (fb && row[fb]) return row[fb];
  // no translation (incl. English and unsupported langs) → caller uses the
  // canonical English catalogue subject.
  return null;
}

module.exports = { localizedSubject, SUBJECTS_I18N: S };
