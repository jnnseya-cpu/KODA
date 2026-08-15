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
    verify_btn: 'Vérifier le paiement', confirm_pay: 'Confirmer', confirming: 'Confirmation…', verified: 'PAIEMENT VÉRIFIÉ', rejected: 'REJETÉ', pending: 'À CONTRÔLER',
    paste_sms_t: 'Coller le SMS de l’opérateur', paste_sms_h: 'iPhone ou téléphone sans Sentinel ? Copiez TOUT le SMS de paiement de l’opérateur ici. KODA le vérifie — mieux qu’un code, car KODA voit le vrai SMS.', paste_sms_btn: 'Vérifier ce SMS',
    auto_stream: 'Chaque paiement est vérifié automatiquement — vous n’avez rien à faire.', manual_verify: 'Vérification manuelle (secours)',
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
    sub_verify: 'Porte 1 — Mode manuel · même moteur que l’API', sub_disputes: 'DisputeAgent K-06 assemble les preuves — vous décidez',
    sub_accounts: 'Connectez les comptes mobile money où vos clients paient — vérifiez la propriété, puis activez',
    sub_devices: 'La flotte de terrain — chaque SIM est un point de vérification', sub_billing: '« On ne gagne que lorsque le marchand est payé. »',
    sub_team: 'Sièges avec audit par caissier', sub_pricing: 'Une seule échelle, les cinq portes — changez de formule à tout moment, sans engagement',
    title_pricing: 'Formules & tarifs', title_receipt: 'Reçu', sub_developers: 'Trois requêtes. Un café. — kodajnn.com/v1', sub_growth: 'Outils marketing IA · K-11',
    dsp_claim: 'Réclamation / motif du client', dsp_open: 'Ouvrir un litige (3 ACU)', dsp_accept: 'Accepter', dsp_reject: 'Refuser', dsp_escalate: 'Escalader à KODA', dsp_none: 'Aucun litige — c\'est l\'objectif.', acc_add: 'Ajouter un compte de réception', acc_add_p: 'Saisissez l\'opérateur + le numéro/caisse où paient les clients. Nous vous donnons une référence unique ; faites un petit paiement test qui la porte, et dès que votre Sentinel le capte, le compte est vérifié.', acc_connect: 'Connecter le compte', acc_op_ph: 'Code opérateur (ex. orange_cd)', acc_num_ph: 'Votre numéro/caisse de paiement', acc_holder_ph: 'Nom du titulaire du compte', acc_yours: 'Vos comptes', acc_none: 'Aucun compte pour l\'instant. Connectez-en un ci-dessus.', acc_would_see: 'Ce que verraient les clients maintenant', acc_no_live: 'Aucun moyen de paiement actif — connectez et activez un compte (et gardez un Sentinel en ligne pour les portes auto).', th_operator: 'Opérateur', th_number: 'Numéro', th_ownership: 'Propriété', th_status: 'Statut', th_doors: 'Portes', dev_label_ph: 'Étiquette — ex. Caisse 2', dev_get_app: 'Obtenir l\'app Sentinel ↗', dev_none: 'Aucun appareil pour l\'instant.', tm_name_ph: 'Nom', tm_email_ph: 'E-mail', th_name: 'Nom', th_email: 'E-mail', th_role: 'Rôle', tm_audit: 'Piste d\'audit', tm_empty: 'Vide', bl_burned: 'ACU consommés · 30 jours', bl_topup_suffix: 'prépayé via mobile money, vérifié par KODA elle-même', bl_voucher_p: 'Vous avez acheté un bon KODA chez un revendeur ? Entrez le PIN pour créditer les ACU instantanément.', bl_distributor: 'Distributeur ?', bl_distributor_p: 'Si KODA vous a configuré comme distributeur (revendeur d\'ACU), gérez votre float et vos ventes ici.', bl_see_all: 'Voir toutes les formules et fonctions →', bl_acu_tx: 'Transactions ACU', bl_invoices: 'Factures', bl_none_yet: 'Aucune pour l\'instant', pr_custom: 'Sur mesure', pr_free: 'Gratuit', pr_forever: '/à vie', pr_permo: '/mois', pr_current: '✓ Formule actuelle', pr_talk: 'Parlez-nous →', pr_upgrade: 'Passer à', pr_switch: 'Basculer vers', pr_current_badge: 'actuelle', pr_unlimited: 'Illimité', pr_verifications: 'vérifications', pr_prices_note: 'Prix en USD. Les formules payantes sont facturées mensuellement et s\'activent dès que KODA confirme votre paiement mobile money. Les recharges ACU (à l\'usage) se gèrent dans', st_profile: 'Profil de l\'entreprise', st_lang_note: 'L\'OS détecte automatiquement la langue de votre appareil (LinguaAgent K-07). Remplacer :', st_data: 'Vos données et confidentialité', st_data_p: 'Téléchargez tout ce que KODA détient pour votre entreprise, ou supprimez votre compte.', st_deletion_owner: '(La suppression est réservée au propriétaire.)', st_download: 'Télécharger mes données (JSON)', st_delete: 'Supprimer le compte',
    d_14day: 'Vérifications sur 14 jours', d_nodata: 'Aucune donnée — vérifiez votre premier paiement.', d_doors: 'Portes utilisées', d_devices: 'Appareils', d_none: 'aucun', d_quick: 'Vérification rapide', v_screenshot: 'Capture d’écran (Vision ×3 ACU)', v_sandbox: 'Références magiques (bac à sable)', f_inject_label: 'SANDBOX — injecter un SMS opérateur :', f_inject: 'Injecter', f_unparsed: 'SMS non analysé', f_matched: 'rattaché', f_unmatched: 'non rattaché', f_empty: 'Aucun SMS — enrôlez un appareil Sentinel ou injectez un SMS de test.', r_payer: 'Payeur', r_mode: 'Mode', r_risk: 'Risque', r_when: 'Quand', r_verified_count: 'vérifiés', r_empty: 'Aucun reçu pour l’instant.', rc_trace: 'Trace de décision (qualité audit)',
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
    verify_btn: 'Verify payment', confirm_pay: 'Confirm', confirming: 'Confirming…', verified: 'PAYMENT VERIFIED', rejected: 'REJECTED', pending: 'NEEDS REVIEW',
    paste_sms_t: 'Paste the operator SMS', paste_sms_h: 'iPhone or a phone without Sentinel? Copy the WHOLE operator payment SMS here. KODA verifies it — better than a code, because KODA sees the real SMS.', paste_sms_btn: 'Verify this SMS',
    auto_stream: 'Every payment is verified automatically — you do nothing.', manual_verify: 'Manual verification (fallback)',
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
    sub_verify: 'Door 1 — Manual mode · same engine as the API', sub_disputes: 'DisputeAgent K-06 assembles the evidence — you decide',
    sub_accounts: 'Connect the mobile-money accounts customers pay you on — verify ownership, then activate',
    sub_devices: 'The edge fleet — each SIM is a verification endpoint', sub_billing: '"We only earn when the merchant gets paid."',
    sub_team: 'Seats with per-cashier audit', sub_pricing: 'One ladder, all five doors — upgrade or downgrade anytime, no lock-in',
    title_pricing: 'Plans & pricing', title_receipt: 'Receipt', sub_developers: 'Three requests. One coffee. — kodajnn.com/v1', sub_growth: 'AI marketing tools · K-11',
    dsp_claim: 'Customer claim / reason', dsp_open: 'Open dispute (3 ACU)', dsp_accept: 'Accept', dsp_reject: 'Reject', dsp_escalate: 'Escalate to KODA', dsp_none: 'No disputes — that is the goal.', acc_add: 'Add a receiving account', acc_add_p: 'Enter the operator + the number/till customers pay to. We give you a one-time reference; make a tiny test payment carrying it, and once your Sentinel captures it the account is verified.', acc_connect: 'Connect account', acc_op_ph: 'Operator code (e.g. orange_cd)', acc_num_ph: 'Your pay-to number / till', acc_holder_ph: 'Account holder name', acc_yours: 'Your accounts', acc_none: 'No accounts yet. Connect one above.', acc_would_see: 'What customers would see now', acc_no_live: 'No live payment methods yet — connect & activate an account (and keep a Sentinel online for auto doors).', th_operator: 'Operator', th_number: 'Number', th_ownership: 'Ownership', th_status: 'Status', th_doors: 'Doors', dev_label_ph: 'Label — e.g. Caisse 2', dev_get_app: 'Get the Sentinel app ↗', dev_none: 'No devices yet.', tm_name_ph: 'Name', tm_email_ph: 'Email', th_name: 'Name', th_email: 'Email', th_role: 'Role', tm_audit: 'Audit trail', tm_empty: 'Empty', bl_burned: 'ACU burned · 30 days', bl_topup_suffix: 'prepaid via mobile money, verified by KODA itself', bl_voucher_p: 'Bought a KODA voucher from a reseller? Enter the PIN to credit ACU instantly.', bl_distributor: 'Distributor?', bl_distributor_p: 'If KODA has set you up as a distributor (ACU reseller), manage your float and sales here.', bl_see_all: 'See all plans & features →', bl_acu_tx: 'ACU transactions', bl_invoices: 'Invoices', bl_none_yet: 'None yet', pr_custom: 'Custom', pr_free: 'Free', pr_forever: '/forever', pr_permo: '/mo', pr_current: '✓ Current plan', pr_talk: 'Talk to us →', pr_upgrade: 'Upgrade to', pr_switch: 'Switch to', pr_current_badge: 'current', pr_unlimited: 'Unlimited', pr_verifications: 'verifications', pr_prices_note: 'Prices in USD. Paid plans are billed monthly and activate the moment KODA confirms your mobile-money payment. ACU top-ups (pay-as-you-go) are managed in', st_profile: 'Business profile', st_lang_note: 'The OS auto-detects your device language (LinguaAgent K-07). Override:', st_data: 'Your data & privacy', st_data_p: 'Download everything KODA holds for your business, or delete your account.', st_deletion_owner: '(Deletion is owner-only.)', st_download: 'Download my data (JSON)', st_delete: 'Delete account',
    d_14day: '14-day verifications', d_nodata: 'No data yet — verify your first payment.', d_doors: 'Doors in use', d_devices: 'Devices', d_none: 'none', d_quick: 'Quick verify', v_screenshot: 'Screenshot (Vision ×3 ACU)', v_sandbox: 'Sandbox magic references', f_inject_label: 'SANDBOX — inject an operator SMS:', f_inject: 'Inject', f_unparsed: 'Unparsed SMS', f_matched: 'matched', f_unmatched: 'unmatched', f_empty: 'No SMS yet — enroll a Sentinel device or inject a sandbox SMS.', r_payer: 'Payer', r_mode: 'Mode', r_risk: 'Risk', r_when: 'When', r_verified_count: 'verified', r_empty: 'No receipts yet.', rc_trace: 'Decision trace (audit-grade)',
  },
  // Swahili (sw) — East/Central Africa. Full UI translation (machine-quality; pending native review).
  sw: {
    dashboard: 'Dashibodi', verify: 'Thibitisha', feed: 'Malipo ya moja kwa moja', receipts: 'Risiti',
    disputes: 'Migogoro', devices: 'Vifaa vya Sentinel', billing: 'Bili na ACU', team: 'Timu',
    developers: 'Wasanidi', comms: 'Mawasiliano', submerchants: 'Wafanyabiashara wadogo', settings: 'Mipangilio',
    admin: 'Kituo cha udhibiti', logout: 'Toka', signin: 'Ingia', signup: 'Fungua akaunti',
    verify_title: 'Konsoli ya Uthibitisho', verify_hint: 'Bandika msimbo wa muamala wa mteja — uamuzi unaotegemea SMS ya opereta kwa sekunde ~3.',
    vmeans_t: 'Maana ya "imethibitishwa" (na isiyo)',
    vmeans_y: 'Imethibitishwa = SMS ya uthibitisho ya opereta imefika kwenye simu yako, msimbo unalingana (kiasi, rejea, dirisha), haujawahi kutumika, na umepita ukaguzi wa udanganyifu.',
    vmeans_n: 'Haihakikishi kwamba opereta hawezi kubatilisha malipo baadaye. KODA haishiki pesa yako kamwe — huenda moja kwa moja kwenye akaunti yako ya pesa za simu. Kwa malipo makubwa au yasiyo ya kawaida, tumia "yanahitaji ukaguzi" kabla ya kutoa bidhaa.',
    verify_btn: 'Thibitisha malipo', confirm_pay: 'Thibitisha', confirming: 'Inathibitisha…', verified: 'MALIPO YAMETHIBITISHWA', rejected: 'YAMEKATALIWA', pending: 'YANAHITAJI UKAGUZI',
    paste_sms_t: 'Bandika SMS ya opereta', paste_sms_h: 'iPhone au simu isiyo na Sentinel? Nakili SMS NZIMA ya malipo ya opereta hapa. KODA inaithibitisha — bora kuliko msimbo, kwa sababu KODA inaona SMS halisi.', paste_sms_btn: 'Thibitisha SMS hii',
    auto_stream: 'Kila malipo yanathibitishwa kiotomatiki — hufanyi chochote.', manual_verify: 'Uthibitisho wa mikono (mbadala)',
    not_found: 'Bado hayajapatikana — tunaangalia dirisha', amount: 'Kiasi', reference: 'Msimbo wa muamala',
    today: 'leo', month: 'mwezi huu', unmatched: 'malipo yasiyolingana', open_disputes: 'migogoro iliyo wazi',
    acu_balance: 'salio la ACU', topup: 'Ongeza', welcome: 'Habari', expected_amount: 'Kiasi kinachotarajiwa (hiari)',
    live: 'MOJA KWA MOJA', quarantined: 'IMETENGWA', enroll_device: 'Sajili kifaa', revoke: 'Batilisha',
    invite: 'Alika', create_key: 'Tengeneza ufunguo', add_webhook: 'Ongeza webhook', test: 'Jaribu',
    preview: 'Onyesho', send_test: 'Nitumie jaribio', mark_read: 'Weka zote zimesomwa', save: 'Hifadhi',
    plan: 'Mpango', change_plan: 'Badilisha mpango', language: 'Lugha', auto: 'Otomatiki (kifaa)',
    growth: 'Injini ya Ukuaji ya AI', generate: 'Tengeneza', growth_sub: 'Zana za masoko za AI — ongeza ufikiaji na washirika wako',
    forgot_pw: 'Umesahau nywila?', forgot_sub: 'Weka barua pepe yako — tutakutumia kiungo cha kuweka upya.',
    send_reset: 'Tuma kiungo cha kuweka upya', reset_pw: 'Weka upya nywila',
    reset_sub: 'Chagua nywila mpya kwa akaunti yako ya KODA.',
    reset_done: 'Nywila imesasishwa. Inaelekeza kwenye kuingia…',
    accounts: 'Njia za malipo', redeem_voucher: 'Tumia vocha', kd_console: 'Konsoli ya msambazaji',
    sub_verify: 'Mlango 1 — Hali ya mikono · injini ile ile kama API', sub_disputes: 'DisputeAgent K-06 hukusanya ushahidi — wewe unaamua',
    sub_accounts: 'Unganisha akaunti za pesa za simu ambapo wateja hukulipa — thibitisha umiliki, kisha washa',
    sub_devices: 'Kundi la mbele — kila SIM ni kituo cha uthibitisho', sub_billing: '"Tunapata tu wakati mfanyabiashara analipwa."',
    sub_team: 'Viti vyenye ukaguzi kwa kila keshia', sub_pricing: 'Ngazi moja, milango yote mitano — panda au shuka wakati wowote, bila mkataba',
    title_pricing: 'Mipango na bei', title_receipt: 'Risiti', sub_developers: 'Maombi matatu. Kahawa moja. — kodajnn.com/v1', sub_growth: 'Zana za masoko za AI · K-11',
    dsp_claim: 'Dai / sababu ya mteja', dsp_open: 'Fungua mzozo (3 ACU)', dsp_accept: 'Kubali', dsp_reject: 'Kataa', dsp_escalate: 'Panda kwa KODA', dsp_none: 'Hakuna mizozo — hilo ndilo lengo.', acc_add: 'Ongeza akaunti ya kupokea', acc_add_p: 'Weka opereta + nambari/till ambapo wateja hulipa. Tunakupa marejeleo ya mara moja; fanya malipo madogo ya jaribio yenye marejeleo hayo, na mara Sentinel yako inapoyanasa, akaunti inathibitishwa.', acc_connect: 'Unganisha akaunti', acc_op_ph: 'Msimbo wa opereta (mf. orange_cd)', acc_num_ph: 'Nambari/till yako ya kulipwa', acc_holder_ph: 'Jina la mmiliki wa akaunti', acc_yours: 'Akaunti zako', acc_none: 'Hakuna akaunti bado. Unganisha moja hapo juu.', acc_would_see: 'Kile wateja wangeona sasa', acc_no_live: 'Hakuna njia za malipo hai bado — unganisha na washa akaunti (na weka Sentinel mtandaoni kwa milango otomatiki).', th_operator: 'Opereta', th_number: 'Nambari', th_ownership: 'Umiliki', th_status: 'Hali', th_doors: 'Milango', dev_label_ph: 'Lebo — mf. Kaunta 2', dev_get_app: 'Pata programu ya Sentinel ↗', dev_none: 'Hakuna vifaa bado.', tm_name_ph: 'Jina', tm_email_ph: 'Barua pepe', th_name: 'Jina', th_email: 'Barua pepe', th_role: 'Jukumu', tm_audit: 'Njia ya ukaguzi', tm_empty: 'Tupu', bl_burned: 'ACU zilizotumika · siku 30', bl_topup_suffix: 'kulipwa mapema kupitia mobile money, imethibitishwa na KODA yenyewe', bl_voucher_p: 'Umenunua vocha ya KODA kutoka kwa muuzaji? Weka PIN ili kuongeza ACU papo hapo.', bl_distributor: 'Msambazaji?', bl_distributor_p: 'Ikiwa KODA imekuweka kama msambazaji (muuzaji wa ACU), simamia float na mauzo yako hapa.', bl_see_all: 'Ona mipango na vipengele vyote →', bl_acu_tx: 'Miamala ya ACU', bl_invoices: 'Ankara', bl_none_yet: 'Hakuna bado', pr_custom: 'Maalum', pr_free: 'Bure', pr_forever: '/milele', pr_permo: '/mwezi', pr_current: '✓ Mpango wa sasa', pr_talk: 'Ongea nasi →', pr_upgrade: 'Panda hadi', pr_switch: 'Badilisha hadi', pr_current_badge: 'sasa', pr_unlimited: 'Bila kikomo', pr_verifications: 'uthibitisho', pr_prices_note: 'Bei kwa USD. Mipango ya kulipia hutozwa kila mwezi na huwashwa mara KODA inapothibitisha malipo yako ya mobile money. Kuongeza ACU (lipa unavyotumia) hudhibitiwa katika', st_profile: 'Wasifu wa biashara', st_lang_note: 'OS hutambua lugha ya kifaa chako kiotomatiki (LinguaAgent K-07). Badilisha:', st_data: 'Data yako na faragha', st_data_p: 'Pakua kila kitu KODA inashikilia kwa biashara yako, au futa akaunti yako.', st_deletion_owner: '(Ufutaji ni wa mmiliki pekee.)', st_download: 'Pakua data yangu (JSON)', st_delete: 'Futa akaunti',
    d_14day: 'Uthibitisho wa siku 14', d_nodata: 'Hakuna data bado — thibitisha malipo yako ya kwanza.', d_doors: 'Milango inayotumika', d_devices: 'Vifaa', d_none: 'hakuna', d_quick: 'Uthibitisho wa haraka', v_screenshot: 'Picha ya skrini (Vision ×3 ACU)', v_sandbox: 'Marejeleo ya majaribio (sandbox)', f_inject_label: 'SANDBOX — ingiza SMS ya opereta:', f_inject: 'Ingiza', f_unparsed: 'SMS isiyochambuliwa', f_matched: 'imelingana', f_unmatched: 'haijalingana', f_empty: 'Hakuna SMS bado — sajili kifaa cha Sentinel au ingiza SMS ya majaribio.', r_payer: 'Mlipaji', r_mode: 'Hali', r_risk: 'Hatari', r_when: 'Lini', r_verified_count: 'zimethibitishwa', r_empty: 'Hakuna risiti bado.', rc_trace: 'Ufuatiliaji wa uamuzi (kiwango cha ukaguzi)',
  },
  // Lingala (ln) — DR Congo / Congo-Brazzaville. Core UI translated; longer legal/verification
  // strings fall back to French (a language Lingala speakers read) — see LANG_FALLBACK.
  ln: {
    dashboard: 'Etando ya mosala', verify: 'Kotala', feed: 'Mafuteli ya mbongo na direct', receipts: 'Bareçu',
    disputes: 'Matata', devices: 'Bisaleli Sentinel', billing: 'Fakture na ACU', team: 'Ekipe',
    developers: 'Baye basalaka', comms: 'Basango', submerchants: 'Bato ya mombongo mike', settings: 'Bibongiseli',
    admin: 'Esika ya bokambi', logout: 'Kobima', signin: 'Kokota', signup: 'Kofungola konti',
    verify_title: 'Console ya kotala', verify_hint: 'Kotia code ya transaction ya kiliya — eyano euti na SMS ya opérateur na segonde ~3.',
    verify_btn: 'Kotala mbongo', confirm_pay: 'Kondima', confirming: 'Ezali kondima…', verified: 'MBONGO ETALAMI', rejected: 'EPESAMI TE', pending: 'ESENGELI KOTALA',
    paste_sms_t: 'Tia SMS ya opérateur', paste_sms_btn: 'Kotala SMS oyo',
    auto_stream: 'Mbongo nyonso etalami yango moko — osala eloko te.', manual_verify: 'Kotala na maboko (lisungi)',
    not_found: 'Emonani naino te — tozali kotala', amount: 'Motuya', reference: 'Code ya transaction',
    today: 'lelo', month: 'sanza oyo', unmatched: 'mbongo esangani te', open_disputes: 'matata efungwami',
    acu_balance: 'reste ya ACU', topup: 'Kobakisa', welcome: 'Mbote', expected_amount: 'Motuya ezelami (soki olingi)',
    live: 'DIRECT', quarantined: 'EKANGAMI', enroll_device: 'Kokoma esaleli', revoke: 'Kolongola',
    invite: 'Kobenga', create_key: 'Kosala fungola', add_webhook: 'Kobakisa webhook', test: 'Komeka',
    preview: 'Kotala liboso', send_test: 'Tindela ngai test', mark_read: 'Tia nyonso etangami', save: 'Kobomba',
    plan: 'Formule', change_plan: 'Kobongola formule', language: 'Monoko', auto: 'Yango moko (esaleli)',
    growth: 'Motele ya bokoli AI', generate: 'Kosala', growth_sub: 'Bisaleli AI ya marketing — kokolisa bato oyo bayebi yo',
    forgot_pw: 'Obosani mot de passe?', forgot_sub: 'Tia email na yo — tokotindela yo lien ya kobongisa.',
    send_reset: 'Tinda lien', reset_pw: 'Bongisa mot de passe',
    reset_sub: 'Pona mot de passe ya sika mpo na konti KODA na yo.',
    reset_done: 'Mot de passe ebongisami. Ezali kozonga na kokota…',
    accounts: 'Banzela ya kofuta', redeem_voucher: 'Salela bon', kd_console: 'Console ya mokaboli',
    sub_verify: 'Porte 1 — Mode manuel · moteur moko na API', sub_disputes: 'DisputeAgent K-06 asangisi bilembo — yo nde okokata',
    sub_accounts: 'Kangisa bakonti ya mobile money oyo baclients bafutaka yo — talela bonkolo, sima fungola',
    sub_devices: 'Basaleli ya libanda — SIM nyonso ezali esika ya botali', sub_billing: '« Tozwaka mbongo kaka soki moto ya mombongo afutami. »',
    sub_team: 'Bakiti na audit ya caissier moko na moko', sub_pricing: 'Etape moko, baporte nyonso mitano — bongola formule ntango nyonso, engagement te',
    title_pricing: 'Baformule & ntalo', title_receipt: 'Reçu', sub_developers: 'Ba requêtes misato. Kafe moko. — kodajnn.com/v1', sub_growth: 'Bisaleli AI ya marketing · K-11',
    dsp_claim: 'Molongi ya kliyã / ntína', dsp_open: 'Fungola litígo (3 ACU)', dsp_accept: 'Ndima', dsp_reject: 'Boya', dsp_escalate: 'Tómbola epái ya KODA', dsp_none: 'Litígo tɛ́ — yango nde tína.', acc_add: 'Bakísa kɔ́ntɛ ya koyamba', acc_add_p: 'Kótisá opérateur + nimero/kɛ́sɛ epái baklíya bafutaka. Topesí yo référence ya mbala moko; salá litindo moke ya komeka na yango, mpe soki Sentinel na yo ekangi yango, kɔ́ntɛ endimámí.', acc_connect: 'Kangisa kɔ́ntɛ', acc_op_ph: 'Kódɛ ya opérateur (ndakisa orange_cd)', acc_num_ph: 'Nimero/kɛ́sɛ na yo ya kofuta', acc_holder_ph: 'Nkómbó ya nkolo kɔ́ntɛ', acc_yours: 'Bakɔ́ntɛ na yo', acc_none: 'Kɔ́ntɛ tɛ́ naíno. Kangisa moko awa likoló.', acc_would_see: 'Óyo baklíya bakomóna sikóyo', acc_no_live: 'Nzelá ya kofuta ya bomoi tɛ́ naíno — kangisa mpe pelisa kɔ́ntɛ (mpe tíká Sentinel na ligne mpo na baporte ya auto).', th_operator: 'Opérateur', th_number: 'Nimero', th_ownership: 'Bonkoló', th_status: 'Ezalela', th_doors: 'Baporte', dev_label_ph: 'Etiké — ndakisa Kɛ́sɛ 2', dev_get_app: 'Zwá app Sentinel ↗', dev_none: 'Masíni tɛ́ naíno.', tm_name_ph: 'Nkómbó', tm_email_ph: 'E-mail', th_name: 'Nkómbó', th_email: 'E-mail', th_role: 'Mokumba', tm_audit: 'Nzelá ya botáli', tm_empty: 'Mpámba', bl_burned: 'ACU esílí · mikolo 30', bl_topup_suffix: 'kofuta libosó na mobile money, KODA yango moko endimí yango', bl_voucher_p: 'Osombí bon ya KODA epái ya moteki? Kótisá PIN mpo ACU ekóta mbala moko.', bl_distributor: 'Moddistribiteur?', bl_distributor_p: 'Soki KODA atíí yo mo distribiteur (moteki ACU), yángela float mpe boteki na yo awa.', bl_see_all: 'Talá baformule mpe basaleli nyɔnsɔ →', bl_acu_tx: 'Ba transaction ACU', bl_invoices: 'Bafaktir', bl_none_yet: 'Naíno tɛ́', pr_custom: 'Ya bomɛ́ní', pr_free: 'Ofele', pr_forever: '/libélá', pr_permo: '/sánzá', pr_current: '✓ Formule ya sikóyo', pr_talk: 'Solola na bísó →', pr_upgrade: 'Leká na', pr_switch: 'Balola na', pr_current_badge: 'ya sikóyo', pr_unlimited: 'Ndelo tɛ́', pr_verifications: 'ba vérification', pr_prices_note: 'Ntálo na USD. Baformule ya kofuta bafutisamaka sánzá na sánzá mpe efungwamaka ntángo KODA endimí paiement na yo ya mobile money. Ba recharge ACU (futa lokóla osáleli) eyángelamaka na', st_profile: 'Profil ya mombóngo', st_lang_note: 'OS eyébaka monɔ́kɔ ya masíni na yo yɔ́kɔmɛ́ (LinguaAgent K-07). Bóngola :', st_data: 'Ba données na yo mpe bonkútú', st_data_p: 'Kitisá nyɔnsɔ oyo KODA ebómbí mpo na mombóngo na yo, tǒ longola kɔ́ntɛ na yo.', st_deletion_owner: '(Kolongola ezali kaka mpo na nkolo.)', st_download: 'Kitisá ba données na ngáí (JSON)', st_delete: 'Longola kɔ́ntɛ',
    d_14day: 'Botali ya mikolo 14', d_nodata: 'Ata data te — talela lifuti na yo ya liboso.', d_doors: 'Baporte oyo ezali kosalema', d_devices: 'Bisaleli', d_none: 'ata moko te', d_quick: 'Botali ya mbangu', v_screenshot: 'Screenshot (Vision ×3 ACU)', v_sandbox: 'Ba références ya komeka (sandbox)', f_inject_label: 'SANDBOX — kotisa SMS ya opérateur:', f_inject: 'Kotisa', f_unparsed: 'SMS eanalisami te', f_matched: 'ekangami', f_unmatched: 'ekangami te', f_empty: 'Ata SMS te — kokoma esaleli Sentinel to kotisa SMS ya komeka.', r_payer: 'Mofuti', r_mode: 'Mode', r_risk: 'Likama', r_when: 'Tango', r_verified_count: 'etalami', r_empty: 'Ata reçu te.', rc_trace: 'Trace ya mokano (audit)',
  },
  // Wolof (wo) — Senegal / Gambia. Core UI translated; longer strings fall back to French.
  wo: {
    dashboard: 'Tablo bu mag', verify: 'Seetlu', feed: 'Peyeman yu direct', receipts: 'Reçu',
    disputes: 'Ñeexal', devices: 'Jumtukaay Sentinel', billing: 'Faktir ak ACU', team: 'Ekib',
    developers: 'Développeurs', comms: 'Jokkoo', submerchants: 'Njaaykat yu ndaw', settings: 'Paramaetar',
    admin: 'Barab bu konteroolal', logout: 'Génn', signin: 'Dugg', signup: 'Ubbi kont',
    verify_title: 'Console bu seetlu', verify_hint: 'Bindal kode transaction bu kiliyaŋ bi — tontu bu jóge ci SMS opérateur ci ~3 segond.',
    verify_btn: 'Seetlul peyeman', confirm_pay: 'Dëggal', confirming: 'Mu ngi dëggal…', verified: 'PEYEMAN BI DËGGAL NA', rejected: 'BAÑ NAÑU KO', pending: 'DAFA WARA SEETLU',
    paste_sms_t: 'Bindal SMS opérateur', paste_sms_btn: 'Seetlul SMS bii',
    auto_stream: 'Peyeman bu nekk seetlu nañu ko ci boppam — doo def dara.', manual_verify: 'Seetlu ci loxo (ndimbal)',
    not_found: 'Gisagul — nu ngi xool', amount: 'Njëg', reference: 'Kode transaction',
    today: 'tey', month: 'weer wii', unmatched: 'peyeman yu ñuul boole', open_disputes: 'ñeexal yu ubbeeku',
    acu_balance: 'des bu ACU', topup: 'Yokk', welcome: 'Salaam', expected_amount: 'Njëg bi ñu xaar (soo bëggee)',
    live: 'DIRECT', quarantined: 'TÉÉÑ', enroll_device: 'Bindal jumtukaay', revoke: 'Dindi',
    invite: 'Woo', create_key: 'Sos caabi', add_webhook: 'Yokk webhook', test: 'Seet',
    preview: 'Xoolal', send_test: 'Yónnee ma test', mark_read: 'Màrke lépp jàng', save: 'Denc',
    plan: 'Plan', change_plan: 'Soppi plan', language: 'Làkk', auto: 'Ci boppam (jumtukaay)',
    growth: 'Motër ngóob AI', generate: 'Sos', growth_sub: 'Jumtukaay marketing AI — yokk sa ëmb ak sa partenaires',
    forgot_pw: 'Fàtte nga baatujàll?', forgot_sub: 'Bindal sa email — dinañu la yónnee lien ngir soppi.',
    send_reset: 'Yónnee lien', reset_pw: 'Soppi baatujàll',
    reset_sub: 'Tannal baatujàll bu bees ngir sa kont KODA.',
    reset_done: 'Baatujàll soppiku na. Mu ngi dellu ci dugg…',
    accounts: 'Anam yu peye', redeem_voucher: 'Jëfandikoo bon', kd_console: 'Console distributeur',
    sub_verify: 'Buntu 1 — Mode manuel · moteur bu API bi', sub_disputes: 'DisputeAgent K-06 dafay dajale firnde yi — yaw ngay dogal',
    sub_accounts: 'Boole komptu mobile money yi kiliyaan yi di feye — seetlul moom, ba noppi taxawal',
    sub_devices: 'Mbooloo mi — SIM bu nekk benn barab bu seetlu', sub_billing: '« Danuy am xaalis rekk bu njëkkkat bi feyee. »',
    sub_team: 'Toogu ak audit bu kees bu nekk', sub_pricing: 'Benn escalier, juróom buntu yépp — soppi plan saa yu nekk, amul engagement',
    title_pricing: 'Plan & njëg', title_receipt: 'Reçu', sub_developers: 'Ñetti requête. Benn kafe. — kodajnn.com/v1', sub_growth: 'Jumtukaay marketing AI · K-11',
    dsp_claim: 'Njàng client / lu ko tax', dsp_open: 'Ubbi werante (3 ACU)', dsp_accept: 'Nangu', dsp_reject: 'Bañ', dsp_escalate: 'Yóbbu ci KODA', dsp_none: 'Amul werante — loolu mooy jubluwaay bi.', acc_add: 'Yokku ab kont bu ñuy jot', acc_add_p: 'Bindal operator bi + nimero/kes bi client yiy fey. Dañu la jox benn référence; defal ab payement bu ndaw bu ko ëmb, te su fi sa Sentinel jàppee ko, kont bi dañu koy dëggal.', acc_connect: 'Boole kont bi', acc_op_ph: 'Kódu operator (misaal orange_cd)', acc_num_ph: 'Sa nimero/kes bu payement', acc_holder_ph: 'Turandoo boroom kont bi', acc_yours: 'Sa i kont', acc_none: 'Amul kont ba léegi. Boole benn ci kaw.', acc_would_see: 'Li client yi war gis léegi', acc_no_live: 'Amul yoonu payement bu doxaan — boole te taxaw ab kont (te bàyyi Sentinel ci ligne ngir bunt yu auto).', th_operator: 'Operator', th_number: 'Nimero', th_ownership: 'Moomeel', th_status: 'Anam', th_doors: 'Bunt', dev_label_ph: 'Tag — misaal Kes 2', dev_get_app: 'Jël app Sentinel bi ↗', dev_none: 'Amul appareil ba léegi.', tm_name_ph: 'Turandoo', tm_email_ph: 'E-mail', th_name: 'Tur', th_email: 'E-mail', th_role: 'Warteef', tm_audit: 'Yoonu njël', tm_empty: 'Neen', bl_burned: 'ACU yu jëfandiku · 30 fan', bl_topup_suffix: 'fey ci kanam ci mobile money, KODA moom ci boppam dëggal ko', bl_voucher_p: 'Jëndoon nga vocha KODA ci jaaykat? Bindal PIN bi ngir yokk ACU ci saa si.', bl_distributor: 'Distributeur?', bl_distributor_p: 'Su KODA la defee distributeur (jaaykatu ACU), toppatoo sa float ak sa njaay fii.', bl_see_all: 'Gis plan yi ak feature yi yépp →', bl_acu_tx: 'Transaction ACU yi', bl_invoices: 'Faktiir', bl_none_yet: 'Amul ba léegi', pr_custom: 'Ci sa bopp', pr_free: 'Free', pr_forever: '/ba fàww', pr_permo: '/weer', pr_current: '✓ Plan bi fi mu', pr_talk: 'Waxal ak nun →', pr_upgrade: 'Yeeg ci', pr_switch: 'Soppi ci', pr_current_badge: 'fi mu', pr_unlimited: 'Amul dig', pr_verifications: 'vérification', pr_prices_note: 'Njëg ci USD. Plan yu ñuy fey ñuy leen fey weer wu nekk te ñuy tàmbali bu KODA dëggalee sa payement mobile money. Yokkute ACU (fey ni nga jëfandikoo) ñu koy toppatoo ci', st_profile: 'Profil bu liggéey bi', st_lang_note: 'OS bi day xàmm bopam làkku sa appareil (LinguaAgent K-07). Soppi :', st_data: 'Sa data ak sutura', st_data_p: 'Yebbi lépp lu KODA yor ci sa liggéey, walla far sa kont.', st_deletion_owner: '(Far bi boroom rekk moo ko man.)', st_download: 'Yebbi sama data (JSON)', st_delete: 'Far kont bi',
    d_14day: 'Seetlu ci 14 fan', d_nodata: 'Amul data — seetlul sa peyeman bu njëkk.', d_doors: 'Buntu yiy jëfandikoo', d_devices: 'Jumtukaay', d_none: 'benn amul', d_quick: 'Seetlu bu gaaw', v_screenshot: 'Screenshot (Vision ×3 ACU)', v_sandbox: 'Référence yu sandbox', f_inject_label: 'SANDBOX — dugal SMS opérateur:', f_inject: 'Dugal', f_unparsed: 'SMS bu ñu seetlu', f_matched: 'boole', f_unmatched: 'booleul', f_empty: 'Amul SMS — bindal jumtukaay Sentinel walla dugal SMS sandbox.', r_payer: 'Feykat', r_mode: 'Mode', r_risk: 'Risk', r_when: 'Kañ', r_verified_count: 'dëggal', r_empty: 'Amul reçu.', rc_trace: 'Trace bu décision (audit)',
  },
  // Twi / Akan (ak) — Ghana. Core UI translated; longer strings fall back to English.
  ak: {
    dashboard: 'Dashboard', verify: 'Hwɛ ho', feed: 'Sika tua a ɛrekɔ so', receipts: 'Nkrataa',
    disputes: 'Akasakasa', devices: 'Sentinel mfidie', billing: 'Ka ne ACU', team: 'Kuo',
    developers: 'Adwumayɛfoɔ', comms: 'Nkitahodie', submerchants: 'Adwadifoɔ nketewa', settings: 'Nhyehyɛeɛ',
    admin: 'Ɔhwɛ dwumadibea', logout: 'Firi mu', signin: 'Bra mu', signup: 'Bue akawnt',
    verify_title: 'Hwɛ ho Console', verify_hint: 'Fa client no transaction code no to mu — mmuaeɛ a ɛgyina operator SMS so wɔ sekɛne ~3 mu.',
    verify_btn: 'Hwɛ sika tua no ho', confirm_pay: 'Si so dua', confirming: 'Ɛresi so dua…', verified: 'SIKA TUA NO YƐ NOKORƐ', rejected: 'WƆAPO', pending: 'ƐHIA NHWEHWƐMU',
    paste_sms_t: 'Fa operator SMS no to mu', paste_sms_btn: 'Hwɛ SMS yi ho',
    auto_stream: 'Wɔhwɛ sika tua biara ho ankasa — wonyɛ hwee.', manual_verify: 'Nsa so nhwehwɛmu (mmoa)',
    not_found: 'Wonhunuu bi ɛ — yɛrehwɛ', amount: 'Dodoɔ', reference: 'Transaction code',
    today: 'ɛnnɛ', month: 'saa bosome yi', unmatched: 'sika tua a ɛmfata', open_disputes: 'akasakasa a ɛda hɔ',
    acu_balance: 'ACU sika a aka', topup: 'Fa ka ho', welcome: 'Akwaaba', expected_amount: 'Dodoɔ a wɔhwɛ kwan (sɛ wopɛ a)',
    live: 'ƐREKƆ SO', quarantined: 'WƆAYI ASI NKYƐN', enroll_device: 'Kyerɛw mfidie', revoke: 'Yi firi hɔ',
    invite: 'To nsa frɛ', create_key: 'Yɛ safoa', add_webhook: 'Fa webhook ka ho', test: 'Sɔ hwɛ',
    preview: 'Hwɛ kane', send_test: 'Fa test kɔma me', mark_read: 'Hyɛ ne nyinaa sɛ wɔakenkan', save: 'Kora so',
    plan: 'Nhyehyɛeɛ', change_plan: 'Sesa nhyehyɛeɛ', language: 'Kasa', auto: 'Ankasa (mfidie)',
    growth: 'AI Nkɔsoɔ Afidie', generate: 'Yɛ', growth_sub: 'AI marketing nnwuma — trɛ wo so ne wo ahokafoɔ mu',
    forgot_pw: 'Wo werɛ afiri password?', forgot_sub: 'Fa wo email to mu — yɛbɛfa reset link akɔma wo.',
    send_reset: 'Fa reset link kɔ', reset_pw: 'Sesa password',
    reset_sub: 'Yi password foforɔ ma wo KODA akawnt.',
    reset_done: 'Wɔasesa password. Ɛresan akɔ sign in…',
    accounts: 'Sika tua akwan', redeem_voucher: 'Gye voucher', kd_console: 'Distributor console',
    sub_verify: 'Ɔpon 1 — Nsa so kwan · engine korɔ no ara sɛ API', sub_disputes: 'DisputeAgent K-06 boaboa adanseɛ ano — wo na wobɛsi gyinae',
    sub_accounts: 'Fa mobile money akawnt a wo customers tua wɔ so ka ho — hwɛ sɛ wo dea, na yi no adwuma',
    sub_devices: 'Mfidie a ɛwɔ ano — SIM biara yɛ nhwehwɛmu beaeɛ', sub_billing: '"Yɛnya sika bere a wɔatua odwadini no nko ara."',
    sub_team: 'Nkonnwa a cashier biara wɔ audit', sub_pricing: 'Atwedeɛ baako, apon nnum no nyinaa — sesa plan bere biara, nhyehyɛeɛ biara nni ho',
    title_pricing: 'Nhyehyɛeɛ & bo', title_receipt: 'Nkrataa', sub_developers: 'Abisadeɛ mmiɛnsa. Kɔfe baako. — kodajnn.com/v1', sub_growth: 'AI marketing nnwuma · K-11',
    dsp_claim: 'Adetɔfoɔ n\'asɛm / ntease', dsp_open: 'Bue akyinnyeɛ (3 ACU)', dsp_accept: 'Gye', dsp_reject: 'Po', dsp_escalate: 'Fa kɔ KODA', dsp_none: 'Akyinnyeɛ biara nni hɔ — ɛno ne botaeɛ.', acc_add: 'Fa akawnt a wɔde gye sika ka ho', acc_add_p: 'Fa opereta no + nɔma/till a adetɔfoɔ tua ka ho. Yɛma wo reference baako pɛ; tua sika kakraa a ɛkura reference no, na sɛ wo Sentinel kyere a, wobɛgye akawnt no atom.', acc_connect: 'Bata akawnt no', acc_op_ph: 'Opereta kɔɔd (bɛ. orange_cd)', acc_num_ph: 'Wo tua-so nɔma / till', acc_holder_ph: 'Akawnt wura din', acc_yours: 'Wo akawnt ahodoɔ', acc_none: 'Akawnt biara nni hɔ. Bata baako wɔ soro hɔ.', acc_would_see: 'Deɛ adetɔfoɔ bɛhunu seesei', acc_no_live: 'Tua-kwan biara nnyɛ adwuma — bata na hyɛ akawnt no den (na ma Sentinel ntena intanɛt so mma auto apono).', th_operator: 'Opereta', th_number: 'Nɔma', th_ownership: 'Ahodeɛ', th_status: 'Tebea', th_doors: 'Apono', dev_label_ph: 'Din — bɛ. Kaunta 2', dev_get_app: 'Nya Sentinel app no ↗', dev_none: 'Mfidie biara nni hɔ.', tm_name_ph: 'Din', tm_email_ph: 'Email', th_name: 'Din', th_email: 'Email', th_role: 'Dwuma', tm_audit: 'Nhwehwɛmu kwan', tm_empty: 'Hunu', bl_burned: 'ACU a wɔasɛe · nna 30', bl_topup_suffix: 'tua kan wɔ mobile money so, KODA ankasa asi so dua', bl_voucher_p: 'Wotɔɔ KODA voucher firii dwadifoɔ hɔ? Fa PIN no hyɛ mu na ACU aba ntɛm.', bl_distributor: 'Nkyekyɛfoɔ?', bl_distributor_p: 'Sɛ KODA de wo asi hɔ sɛ nkyekyɛfoɔ (ACU dwadifoɔ) a, hwɛ wo float ne wo adetɔn wɔ ha.', bl_see_all: 'Hwɛ nhyehyɛeɛ ne nneɛma nyinaa →', bl_acu_tx: 'ACU nsakraeɛ', bl_invoices: 'Sika nkrataa', bl_none_yet: 'Ebiara nni hɔ', pr_custom: 'Wo deɛ', pr_free: 'Fee', pr_forever: '/daa', pr_permo: '/bosome', pr_current: '✓ Nhyehyɛeɛ a ɛwɔ hɔ seesei', pr_talk: 'Ka kyerɛ yɛn →', pr_upgrade: 'Kɔ soro kɔ', pr_switch: 'Sesa kɔ', pr_current_badge: 'seesei', pr_unlimited: 'Ɛnni ano', pr_verifications: 'nhwehwɛmu', pr_prices_note: 'Boɔ wɔ USD mu. Nhyehyɛeɛ a wɔtua ka no, wɔtua no bosome biara na ɛhyɛ ase bere a KODA si wo mobile money tuo so dua. ACU top-up (tua sɛdeɛ wode di dwuma) no, wɔhwɛ so wɔ', st_profile: 'Adwuma ho nsɛm', st_lang_note: 'OS no ankasa hunu wo mfidie kasa (LinguaAgent K-07). Sesa:', st_data: 'Wo data ne kokoamsɛm', st_data_p: 'Twe biribiara a KODA kura ma wo adwuma, anaa yi wo akawnt no.', st_deletion_owner: '(Wura nko na ɔtumi yi.)', st_download: 'Twe me data (JSON)', st_delete: 'Yi akawnt no',
    d_14day: 'Nhwɛmu nnansa 14', d_nodata: 'Data biara nni hɔ — hwɛ wo sika tua a edi kan no ho.', d_doors: 'Apon a wɔde di dwuma', d_devices: 'Mfidie', d_none: 'ebiara nni hɔ', d_quick: 'Nhwɛ ntɛm', v_screenshot: 'Screenshot (Vision ×3 ACU)', v_sandbox: 'Sandbox magic references', f_inject_label: 'SANDBOX — fa operator SMS hyɛ mu:', f_inject: 'Fa hyɛ mu', f_unparsed: 'SMS a wɔnyaa mu', f_matched: 'ahyia', f_unmatched: 'anhyia', f_empty: 'SMS biara nni hɔ — kyerɛw Sentinel mfidie anaa fa sandbox SMS hyɛ mu.', r_payer: 'Otuafoɔ', r_mode: 'Ɛkwan', r_risk: 'Asiane', r_when: 'Bere', r_verified_count: 'wɔahwɛ ho', r_empty: 'Nkrataa biara nni hɔ.', rc_trace: 'Gyinaesie akwan (audit)',
  },
};
// A language that only partly covers the UI falls back to its regional lingua franca
// (francophone → fr, anglophone → en) before the ultimate English fallback, so a
// merchant always reads a correct sentence rather than a raw key.
const LANG_FALLBACK = { ln: 'fr', wo: 'fr', sw: 'en', ak: 'en' };
const SUPPORTED_LANGS = ['fr', 'en', 'sw', 'ln', 'wo', 'ak'];
// [code, native label] for the language pickers (Auto is rendered separately).
const LANG_OPTIONS = [['fr', 'Français'], ['en', 'English'], ['sw', 'Kiswahili'], ['ln', 'Lingála'], ['wo', 'Wolof'], ['ak', 'Twi']];
let LANG = localStorage.getItem('koda_lang') || '';
// Auto-detect from the device: map the browser locale to a supported language,
// otherwise French (KODA's primary francophone-Africa market).
function detectLang() {
  const codes = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'fr']);
  for (const c of codes) {
    const p = String(c).toLowerCase().slice(0, 2);
    if (SUPPORTED_LANGS.includes(p)) return p;
    if (p === 'ak' || p === 'tw') return 'ak'; // Akan/Twi
  }
  return 'fr';
}
function lang() { return LANG || detectLang(); }
const t = (k) => {
  const L = lang();
  if (I18N[L] && I18N[L][k] != null) return I18N[L][k];
  const fb = LANG_FALLBACK[L];
  if (fb && I18N[fb] && I18N[fb][k] != null) return I18N[fb][k];
  return I18N.en[k] || k;
};

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
// Number/date locale per language (francophone langs group by fr, anglophone by en/sw).
const NUM_LOCALE = { fr: 'fr-FR', en: 'en-US', sw: 'sw-KE', ln: 'fr-FR', wo: 'fr-FR', ak: 'en-GH' };
const DATE_LOCALE = { fr: 'fr-FR', en: 'en-GB', sw: 'sw-KE', ln: 'fr-FR', wo: 'fr-FR', ak: 'en-GH' };
const fmt = (n) => Number(n || 0).toLocaleString(NUM_LOCALE[lang()] || 'fr-FR');
// ACU balance display: admin-owned accounts are unlimited → show ∞
const acuFmt = (n) => (ME && ME.acu_unlimited) ? '∞' : fmt(n);
const when = (s) => s ? new Date(s.replace(' ', 'T') + (s.includes('Z') ? '' : 'Z')).toLocaleString(DATE_LOCALE[lang()] || 'fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—';

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
// Sandbox/dev test tooling (magic references, inject-SMS) is OFF for merchants by
// default — it's testing/operator tooling, not part of the live product. A merchant
// opts in from Developers → "Sandbox test tools"; the flag lives in localStorage.
const isSandbox = () => { try { return localStorage.getItem('koda_sandbox') === '1'; } catch { return false; } };
const GROWTH_TOOLS = [
  ['sales_kit', '🧰', 'Field-sales kit (pitch · script · flyer)'],
  ['social_post', '📱', 'Social media post'], ['advert', '📢', 'Advert creator'],
  ['email_campaign', '✉️', 'Email campaign'], ['landing_page', '🖥️', 'Landing page builder'],
  ['hashtags', '#️⃣', 'Hashtag generator'], ['video_script', '🎬', 'Video script'],
  ['recommendations', '💡', 'Performance recommendations'], ['audience', '🎯', 'Audience optimisation'],
  ['analytics', '📊', 'Campaign analytics'], ['posting_time', '⏰', 'Best posting time'],
];
function route() {
  const hash = location.hash.replace(/^#\/?/, '') || (ME ? 'dashboard' : 'login');
  if (!ME && !['login', 'signup', 'forgot', 'reset', 'authorize'].includes(hash.split('?')[0])) { location.hash = '#login'; return; }
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
  // KODA verifies automatically — the merchant does nothing. The manual Verify
  // console stays available as an option, just not the primary tab (it sits after
  // the auto-verified feed and receipts).
  const till = [
    ['dashboard', '◫', t('dashboard')],
    ['feed', '≋', t('feed')],
    ['receipts', '🧾', t('receipts')],
    ['verify', '✓', t('verify')],
  ];
  const ops = [
    ['disputes', '⚖', t('disputes')],
    ['sec', '', 'Operations'],
    ['accounts', '🏦', t('accounts')],
    ['devices', '▣', t('devices')],
  ];
  const ownerOnly = [
    ['growth', '🚀', t('growth')],
    ['pricing', '💳', 'Plans & pricing'],
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
      <div class="logo" style="cursor:pointer" title="Dashboard" onclick="location.hash='#dashboard'"><span class="tick">✓</span>KODA</div>
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
            ${LANG_OPTIONS.map(([v, n]) => `<option value="${v}" ${LANG === v ? 'selected' : ''}>${n}</option>`).join('')}
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
    <input id="hp" name="hp_field" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
    <div class="field"><label>Email</label><input id="em" type="email" placeholder="you@business.com" autocomplete="username"></div>
    ${pwField('pw', '••••••••', 'current-password')}
    <div style="text-align:right;margin:-6px 0 12px"><a href="#forgot" style="color:var(--gold);font-size:12.5px">${t('forgot_pw')}</a></div>
    <button class="btn btn-gold" style="width:100%" onclick="doLogin()">${t('signin')} →</button>
    <p style="margin-top:16px">No account? <a href="#signup" style="color:var(--gold)">${t('signup')}</a></p>`);
};
// OAuth-style connect landing: a plugin redirected the merchant here to APPROVE a
// connection. On approve we mint a scoped install + a one-time code and bounce back.
VIEWS.authorize = (params) => {
  const platform = params.get('platform') || 'woocommerce';
  const storeUrl = params.get('store_url') || '';
  const redirect = params.get('redirect_uri') || '';
  if (!ME) {
    // remember the full approval request so we can resume it after sign-in
    try { sessionStorage.setItem('koda_return', location.hash); } catch {}
    root.innerHTML = authCard(`<h1>Connect to KODA</h1>
      <p>Sign in to approve this connection from <b>${esc(storeUrl || 'a store')}</b>.</p>
      <button class="btn btn-gold" style="width:100%" onclick="location.hash='#login'">${t('signin')} →</button>`);
    return;
  }
  root.innerHTML = authCard(`<h1>Connect ${esc(platform)}</h1>
    <p><b>${esc(storeUrl || 'A store')}</b> wants to connect to your KODA account${ME.merchant ? ' — <b>' + esc(ME.merchant.name) + '</b>' : ''}.</p>
    <div class="mono" style="font-size:12px;color:var(--dim);margin:12px 0;line-height:1.6">It will be able to <b>create payment intents</b> and <b>read receipts &amp; usage</b>. A scoped, revocable key is issued — <b>no master secret is shared</b>. Revoke anytime in Settings → Integrations.</div>
    <button class="btn btn-gold" style="width:100%" onclick="doAuthorize()">Approve &amp; connect →</button>
    ${redirect ? `<p style="margin-top:12px;text-align:center"><a href="${esc(redirect)}" style="color:var(--dim);font-size:12px">Cancel</a></p>` : ''}`);
};
window.doAuthorize = async () => {
  const p = new URLSearchParams((location.hash.split('?')[1]) || '');
  try {
    const r = await api('/app/oauth/authorize', { body: {
      redirect_uri: p.get('redirect_uri'), store_url: p.get('store_url'),
      webhook_url: p.get('webhook_url'), state: p.get('state'), platform: p.get('platform') || 'woocommerce',
    } });
    if (r.redirect) window.location.href = r.redirect;
  } catch (e) { toast('✗ ' + e.message); }
};

VIEWS.signup = (params) => {
  const ref = (params.get('ref') || '').toUpperCase().trim();
  root.innerHTML = authCard(`
    <h1>${t('signup')}</h1><p>Three doors, one engine. Start free on Marché.</p>
    ${ref ? `<div class="badge b-ok" style="display:block;margin-bottom:12px;line-height:1.5">🎁 You were invited (code <b>${esc(ref)}</b>) — you and your inviter each earn free ACU when you verify your first payment.</div>` : ''}
    <input id="refcode" type="hidden" value="${esc(ref)}">
    <input id="hp" name="hp_field" tabindex="-1" autocomplete="off" aria-hidden="true" style="position:absolute;left:-9999px;width:1px;height:1px;opacity:0">
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
    <a class="logo" href="/" style="text-decoration:none;color:inherit" title="Home"><span class="tick">✓</span>KODA</a>${inner}
    <div class="auth-site">
      ${site.map(([h, l]) => `<a href="${h}">${l}</a>`).join('<span>·</span>')}
    </div></div></div>`;
}
// resume a pending OAuth-connect approval after sign-in (set by VIEWS.authorize)
function returnHash() {
  try {
    const h = sessionStorage.getItem('koda_return');
    if (h && h.replace(/^#\/?/, '').split('?')[0] === 'authorize') { sessionStorage.removeItem('koda_return'); return h; }
  } catch {}
  return null;
}
// SecurityAgent human check: fetch a signed challenge and solve its proof-of-work
// (a few thousand hashes — instant for a person, costly for a bot at scale), and
// read the honeypot field. Returned fields ride along with signup/login.
async function humanToken() {
  try {
    const ch = await api('/app/auth/challenge');
    const enc = new TextEncoder(), target = '0'.repeat(ch.difficulty || 3);
    let pow = '0';
    for (let n = 0; n < 8e6; n++) {
      const buf = await crypto.subtle.digest('SHA-256', enc.encode(ch.challenge + ':' + n));
      const hex = Array.from(new Uint8Array(buf), b => b.toString(16).padStart(2, '0')).join('');
      if (hex.startsWith(target)) { pow = String(n); break; }
    }
    const hpEl = document.getElementById('hp');
    return { challenge: ch, pow, hp_field: hpEl ? hpEl.value : '' };
  } catch { return {}; }
}
window.doLogin = async () => {
  try {
    const h = await humanToken();
    const r = await api('/app/auth/login', { body: { email: v('em'), password: v('pw'), ...h } });
    localStorage.setItem('koda_token', r.token); ME = await api('/app/me');
    location.hash = returnHash() || '#dashboard';
  } catch (e) { toast('✗ ' + (e.message || 'login failed')); }
};
window.doSignup = async (plan) => {
  try {
    const h = await humanToken();
    const refEl = document.getElementById('refcode');
    const r = await api('/app/auth/signup', { body: { business: v('biz'), name: v('nm'), email: v('em'), phone: v('ph'), password: v('pw'), ref: refEl ? refEl.value : '', ...h } });
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

// A subtle, dismissible upgrade nudge — only for free-plan OWNERS (the people who
// can actually change billing), and it firms up as they approach their monthly quota.
function upgradeNudge(d) {
  const isOwner = ME.user.role === 'owner' || ME.user.is_admin;
  const free = d.plan && d.plan.usd === 0;
  if (!isOwner || !free) return '';
  if (sessionStorage.getItem('koda_upsell_dismissed') === '1') return '';
  const quota = d.plan.verifs || 20, used = d.month?.c || 0;
  const pct = quota ? Math.min(100, Math.round(100 * used / quota)) : 0;
  const near = quota && used >= quota * 0.7;
  const msg = near
    ? `You've used <b>${fmt(used)}</b> of your <b>${fmt(quota)}</b> free verifications this month. Upgrade to keep verifying without interruption.`
    : `You're on <b>Marché (free)</b>. Upgrade for higher volume, more devices and team seats — pay only when you get paid.`;
  return `<div style="margin-bottom:14px;border:1px solid var(--gold);border-radius:11px;padding:11px 14px;
      background:rgba(232,161,31,.06);display:flex;align-items:center;gap:12px;flex-wrap:wrap">
    <span style="font-size:18px">⬆</span>
    <div style="flex:1;min-width:200px;font-size:13px;line-height:1.45">${msg}${near ? ` <span class="mono" style="color:var(--dim)">· ${pct}% used</span>` : ''}</div>
    <a class="btn btn-gold" href="#pricing" style="width:auto;padding:8px 15px;font-size:13px">See plans →</a>
    <button onclick="dismissUpsell(this)" aria-label="Dismiss" style="background:none;border:0;color:var(--dim);font-size:18px;line-height:1;cursor:pointer;padding:2px 4px">×</button>
  </div>`;
}
window.dismissUpsell = (btn) => { try { sessionStorage.setItem('koda_upsell_dismissed', '1'); } catch {} const c = btn.closest('div'); if (c) c.remove(); };

VIEWS.dashboard = async () => {
  if (ME.user.is_admin && !ME.merchant) { location.hash = '#admin'; return; } // KODA staff go straight to the control centre
  const d = await api('/app/dashboard');
  const max = Math.max(1, ...d.daily.map(x => x.c));
  shell('dashboard', `${t('welcome')}, ${esc(ME.user.name.split(' ')[0])}`, esc(ME.merchant.name) + ' · ' + d.plan.label, `
  ${upgradeNudge(d)}
  <div class="grid g4">
    <div class="card stat"><b>${fmt(d.today.c)}</b><span>${t('verify')} ${t('today')} · ${fmt(d.today.s)} ${ME.merchant.currency}</span></div>
    <div class="card stat"><b>${fmt(d.month.c)}</b><span>${t('month')} · ${fmt(d.month.s)} ${ME.merchant.currency}</span></div>
    <div class="card stat"><b class="${d.unmatched.c ? '' : 'up'}">${fmt(d.unmatched.c)}</b><span>${t('unmatched')} · ${fmt(d.unmatched.s)} ${ME.merchant.currency}</span></div>
    <div class="card stat"><b>${acuFmt(d.acu)}</b><span>${t('acu_balance')} · <a href="#billing" style="color:var(--gold)">${t('topup')}</a></span></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card"><h3>${t('d_14day')}</h3>
      <div class="bars">${d.daily.map(x => `<i style="height:${Math.round(100 * x.c / max)}%" title="${x.d}: ${x.c}"></i>`).join('') || '<div class="empty">'+t('d_nodata')+'</div>'}</div>
    </div>
    <div class="card"><h3>${t('d_doors')}</h3>
      ${['manual', 'chat', 'api'].map(mode => {
        const c = (d.byMode.find(x => x.mode === mode) || {}).c || 0;
        const tot = d.byMode.reduce((a, x) => a + x.c, 0) || 1;
        return `<div style="margin-bottom:10px"><div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px">
          <span class="mono">${mode.toUpperCase()}</span><span class="mono" style="color:var(--dim)">${c}</span></div>
          <div class="progress"><i style="width:${Math.round(100 * c / tot)}%"></i></div></div>`;
      }).join('')}
      <div style="margin-top:14px;font-size:12.5px;color:var(--dim)">${t('d_devices')}: ${d.devices.map(x =>
        `<span class="badge ${x.status === 'active' ? 'b-ok' : 'b-bad'}">${esc(x.label.split('—')[0])}</span>`).join(' ') || t('d_none')}
        · ${t('open_disputes')}: ${d.disputes}</div>
    </div>
  </div>
  <div class="card" style="margin-top:14px"><h3>${t('d_quick')}</h3>
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
  shell('verify', t('verify_title'), t('sub_verify'), `
  <div class="console">
    <h2>${t('verify_title')}</h2>
    <div class="hint">${t('verify_hint')}</div>
    <div style="display:grid;gap:12px">
      <input id="ref" placeholder="OM.260717.1432.A88213" autocomplete="off">
      <input id="amt" placeholder="${t('expected_amount')}" inputmode="numeric">
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <button class="btn btn-gold" onclick="consoleVerify(false)">✓ ${t('verify_btn')}</button>
        <button class="btn btn-ghost" style="color:var(--paper-ink);border-color:rgba(36,31,20,.25)" onclick="consoleVerify(true)">📷 ${t('v_screenshot')}</button>
      </div>
    </div>
    <div class="verdict" id="verdict"></div>
  </div>
  <div class="card" style="margin-top:14px">
    <h3>📩 ${t('paste_sms_t')}</h3>
    <div class="mono" style="font-size:12px;color:var(--dim);margin:6px 0 10px;line-height:1.5">${t('paste_sms_h')}</div>
    <textarea id="smsraw" rows="3" placeholder="Vous avez recu 25 000 FC de Marie Kalala (0812345678). Ref: OM4F2K9. Solde: 312 500"
      style="width:100%;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px;font-family:var(--mono);font-size:12px;resize:vertical"></textarea>
    <div style="margin-top:10px"><button class="btn btn-gold" onclick="verifySms(this)">📩 ${t('paste_sms_btn')}</button></div>
    <div class="verdict" id="smsverdict"></div>
  </div>
  ${isSandbox() ? `<div class="card" style="margin-top:14px"><h3>${t('v_sandbox')} <span class="badge b-warn" style="float:right">sandbox</span></h3>
    <div class="mono" style="font-size:12px;color:var(--dim);line-height:2">
      TEST-OK-25000 → instant verified · TEST-REPLAY → code_already_used · TEST-SUFFIX → challenge flow
    </div></div>` : ''}
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
// Paste-the-SMS verify — the universal iPhone / no-Sentinel path. Sends the WHOLE
// operator SMS; KODA ingests it (real proof) and verifies in one step.
window.verifySms = async (btn) => {
  const el = document.getElementById('smsverdict');
  if (btn) btn.disabled = true;
  el.className = 'verdict'; el.textContent = '…';
  try {
    const r = await api('/app/verify-sms', { body: { raw: v('smsraw') } });
    const cls = r.status === 'verified' ? 'ok' : r.status === 'pending_review' ? 'warn' : 'bad';
    const icon = cls === 'ok' ? '✓' : cls === 'warn' ? '◔' : '✗';
    const label = r.status === 'verified' ? t('verified') : r.status === 'pending_review' ? t('pending')
      : r.status === 'unparseable' ? (lang() === 'fr' ? 'SMS non reconnu' : 'SMS not recognised') : t('rejected');
    el.className = `verdict show ${cls}`;
    el.innerHTML = `<div class="big">${icon} ${label}</div>
      <div class="mono">${r.amount_confirmed ? `${t('amount')}: ${fmt(r.amount_confirmed)} · ` : ''}${r.auto ? '(auto-matched) · ' : ''}${r.receipt_id ? `receipt ${r.receipt_id} · ` : ''}${r.code ? r.code : ''}</div>`;
    ME = await api('/app/me');
  } catch (e) {
    el.className = 'verdict show bad';
    el.innerHTML = `<div class="big">✗ ${esc(e.message)}</div>`;
  } finally { if (btn) btn.disabled = false; }
};

VIEWS.feed = async () => {
  const rows = await api('/app/feed');
  shell('feed', t('feed'), t('auto_stream'), `
  ${isSandbox() ? `<div class="card" style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    <span class="mono" style="font-size:11px;color:var(--dim)">${t('f_inject_label')}</span>
    <input id="raw" placeholder='Vous avez recu 25 000 FC de ALICE K (+243897721). Ref: OM.260717.1500.H12345. Solde: 400 500'
      style="flex:1;min-width:260px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:9px 12px;font-family:var(--mono);font-size:12px">
    <button class="btn btn-gold btn-sm" onclick="injectSms()">${t('f_inject')}</button>
  </div>` : ''}
  <div class="card" style="margin-top:14px">
    ${rows.map(s => `
      <div class="feed-row">
        <div class="feed-ic ${s.quarantined ? 'f-bad' : s.matched_intent_id ? 'f-ok' : 'f-dim'}">${s.quarantined ? '✗' : s.matched_intent_id ? '✓' : '·'}</div>
        <div><div class="t">${esc(s.counterparty_name || t('f_unparsed'))} <span class="mono" style="color:var(--dim)">${s.counterparty_suffix ? '···' + s.counterparty_suffix : ''}</span>
          ${s.quarantined ? `<span class="badge b-bad">${t('quarantined')}</span>` : s.matched_intent_id ? ('<span class="badge b-ok">'+t('f_matched')+'</span>') : ('<span class="badge b-dim">'+t('f_unmatched')+'</span>')}</div>
        <div class="m">${esc(s.ref_code || '—')} · ${esc(s.operator)} · ${when(s.received_at)}${s.balance_after ? ` · bal ${fmt(s.balance_after)}` : ''}</div></div>
        <div class="amt">${s.amount ? '+' + fmt(s.amount) : ''}</div>
        ${(!s.quarantined && !s.matched_intent_id && s.ref_code && s.amount != null)
          ? `<button class="btn btn-gold btn-sm" style="margin-left:10px" onclick="confirmFeed('${s.id}', this)">${t('confirm_pay')}</button>` : ''}
      </div>`).join('') || '<div class="empty">'+t('f_empty')+'</div>'}
  </div>
  <div style="text-align:center;margin-top:14px">
    <a href="#verify" class="mono" style="font-size:12px;color:var(--dim)">${t('manual_verify')} →</a>
  </div>`);
};
window.injectSms = async () => {
  try { const r = await api('/app/sandbox/sms', { body: { raw: v('raw'), operator: 'orange_cd' } });
    toast(r.quarantined ? '⚠ SMS quarantined — balance-chain break'
      : r.auto && r.auto.status === 'verified' ? '✓ ' + t('verified') + ' (auto)'
      : r.auto && r.auto.status === 'pending_review' ? '◔ ' + t('pending')
      : r.parsed ? '✓ SMS parsed into the ledger' : '◔ stored raw (unparseable)'); route(); }
  catch (e) { toast('✗ ' + e.message); }
};
// One-tap confirm: issue a receipt for a Sentinel-captured payment — no code typing.
window.confirmFeed = async (id, btn) => {
  if (btn) { btn.disabled = true; btn.textContent = t('confirming'); }
  try {
    const r = await api('/app/feed/' + id + '/confirm', { body: {} });
    if (r.status === 'verified') toast('✓ ' + t('verified'));
    else if (r.status === 'pending_review') toast('⏳ ' + t('pending') + ' — ' + t('disputes'));
    else if (r.status === 'rejected') toast('⛔ ' + t('rejected') + (r.code ? ' — ' + r.code : ''));
    else toast('· ' + (r.code || r.status));
    route();
  } catch (e) { toast('✗ ' + (e.message || 'error')); if (btn) { btn.disabled = false; btn.textContent = t('confirm_pay'); } }
};

VIEWS.receipts = async () => {
  const rows = await api('/app/receipts');
  shell('receipts', t('receipts'), `${rows.length} ${t('r_verified_count')}`, `
  <div class="card tbl-wrap"><table class="tbl">
    <tr><th>${t('reference')}</th><th>${t('r_payer')}</th><th class="num">${t('amount')}</th><th>${t('r_mode')}</th><th>${t('r_risk')}</th><th>${t('r_when')}</th></tr>
    ${rows.map(r => `<tr>
      <td class="mono" style="font-size:12px"><a href="#receipt?id=${r.id}" style="color:var(--gold)">${esc(r.reference)}</a></td>
      <td>${esc(r.payer_name_masked || '—')}</td>
      <td class="num">${fmt(r.amount)} ${esc(r.currency || '')}</td>
      <td><span class="badge b-info">${esc(r.mode)}</span></td>
      <td class="mono" style="font-size:12px">${r.risk_score}</td>
      <td class="mono" style="font-size:11.5px;color:var(--dim)">${when(r.verified_at)}</td></tr>`).join('')}
  </table>${rows.length ? '' : '<div class="empty">'+t('r_empty')+'</div>'}</div>`);
};
VIEWS.receipt = async (params) => {
  const r = await api('/app/receipts/' + params.get('id'));
  shell('receipts', t('title_receipt'), r.id, `
  <div class="card"><dl class="kv">
    <dt>reference</dt><dd class="mono">${esc(r.reference)}</dd>
    <dt>amount</dt><dd>${fmt(r.amount)} ${esc(r.currency)}</dd>
    <dt>operator</dt><dd class="mono">${esc(r.operator || '—')}</dd>
    <dt>payer</dt><dd>${esc(r.payer_name_masked || '—')} ${r.payer_suffix ? '···' + r.payer_suffix : ''}</dd>
    <dt>mode</dt><dd>${esc(r.mode)}</dd><dt>risk score</dt><dd>${r.risk_score}</dd>
    <dt>ACU</dt><dd>${r.acu_cost}</dd><dt>verified</dt><dd>${when(r.verified_at)}</dd>
  </dl>
  <h3 style="margin:18px 0 8px">${t('rc_trace')}</h3>
  <div class="codebox">${(r.decision_trace.steps || []).map(esc).join('\n') || 'sandbox'}</div></div>`);
};

VIEWS.disputes = async () => {
  const rows = await api('/app/disputes');
  shell('disputes', t('disputes'), t('sub_disputes'), `
  <div class="card" style="display:flex;gap:10px;flex-wrap:wrap">
    <input id="dref" placeholder="${t('reference')}" style="flex:1;min-width:200px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px;font-family:var(--mono);font-size:12.5px">
    <input id="dwhy" placeholder="${t('dsp_claim')}" style="flex:2;min-width:220px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px;font-size:13px">
    <button class="btn btn-gold btn-sm" onclick="openDispute()">${t('dsp_open')}</button>
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
      <button class="btn btn-gold btn-sm" onclick="resolveDispute('${d.id}','accepted')">${t('dsp_accept')}</button>
      <button class="btn btn-danger btn-sm" onclick="resolveDispute('${d.id}','rejected')">${t('dsp_reject')}</button>
      <button class="btn btn-ghost btn-sm" onclick="resolveDispute('${d.id}','escalated')">${t('dsp_escalate')}</button></div>` : ''}
  </div>`).join('') || '<div class="empty">'+t('dsp_none')+'</div>'}`);
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
  shell('accounts', t('accounts'), t('sub_accounts'), `
  <div class="card"><h3>${t('acc_add')}</h3>
    <p style="font-size:13px;color:var(--dim)">${t('acc_add_p')}</p>
    <div style="display:grid;gap:8px;grid-template-columns:1fr 1fr;max-width:680px">
      <input id="na-code" placeholder="${t('acc_op_ph')}" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <input id="na-ident" placeholder="${t('acc_num_ph')}" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <input id="na-name" placeholder="${t('acc_holder_ph')}" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <button class="btn btn-gold" onclick="connectAccount()">${t('acc_connect')}</button>
    </div><div id="na-out" style="margin-top:10px"></div>
    <p style="font-size:12px;color:var(--dim);margin-top:8px">Operator codes: see the <a href="/coverage" target="_blank" style="color:var(--gold)">coverage page</a>. Tier-C (bank/app-rail) networks aren't SMS-verifiable.</p></div>
  <div class="card tbl-wrap" style="margin-top:14px"><h3>${t('acc_yours')} (${fmt(accts.length)})</h3>
    ${accts.length ? `<table class="tbl"><tr><th>${t('th_operator')}</th><th>${t('th_number')}</th><th>${t('th_ownership')}</th><th>${t('th_status')}</th><th>${t('th_doors')}</th><th></th></tr>
    ${accts.map(a => `<tr><td class="mono">${esc(a.network_code)}</td><td class="mono">${esc(a.masked || '—')}</td>
      <td><span class="badge ${a.ownership_status === 'VERIFIED' ? 'b-ok' : 'b-info'}">${esc(a.ownership_status)}</span>${a.ownership_status !== 'VERIFIED' && a.verify_ref ? `<div class="mono" style="font-size:10px;color:var(--dim)">ref ${esc(a.verify_ref)}</div>` : ''}</td>
      <td><span class="badge ${a.activation_status === 'ACTIVE' ? 'b-ok' : a.activation_status === 'PAUSED' ? 'b-bad' : 'b-info'}">${esc(a.activation_status)}</span></td>
      <td style="font-size:11px" class="mono">${a.enabled_manual ? 'M' : '·'}${a.enabled_whatsapp ? 'W' : '·'}${a.enabled_api ? 'A' : '·'}</td>
      <td style="white-space:nowrap">${a.activation_status === 'DRAFT' || a.ownership_status === 'VERIFIED' && a.activation_status !== 'ACTIVE' ? `<button class="btn btn-gold btn-sm" onclick="activateAccount('${a.id}')">activate</button>` : ''}
        ${a.activation_status === 'ACTIVE' ? `<button class="btn btn-ghost btn-sm" onclick="pauseAccount('${a.id}')">pause</button>` : a.activation_status === 'PAUSED' ? `<button class="btn btn-gold btn-sm" onclick="resumeAccount('${a.id}')">resume</button>` : ''}</td></tr>`).join('')}
    </table>` : '<p style="color:var(--dim);font-size:13px">'+t('acc_none')+'</p>'}</div>
  <div class="card" style="margin-top:14px"><h3>${t('acc_would_see')}</h3>
    ${(resolved.available || []).length ? (resolved.available || []).map(mth => `<div style="display:flex;justify-content:space-between;font-size:13px;padding:4px 0"><span class="mono">${esc(mth.network_code || mth.network || '')}</span><span class="badge b-ok">${esc(mth.health || 'live')}</span></div>`).join('') : '<p style="color:var(--dim);font-size:13px">'+t('acc_no_live')+'</p>'}
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
  shell('devices', t('devices'), t('sub_devices'), `
  <div class="card" style="display:flex;gap:10px;flex-wrap:wrap">
    <input id="dlabel" placeholder="${t('dev_label_ph')}" style="flex:1;min-width:180px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px;font-size:13px">
    <select id="dop" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px">
      <option value="orange_cd">Orange Money</option><option value="mpesa_cd">M-Pesa</option>
      <option value="airtel_cd">Airtel Money</option><option value="africell_cd">Africell Money</option>
      <option value="mtn_momo">MTN MoMo</option><option value="wave">Wave</option></select>
    <button class="btn btn-gold btn-sm" onclick="enrollDevice()">${t('enroll_device')}</button>
    <a class="btn btn-ghost btn-sm" href="/sentinel" target="_blank" rel="noopener">${t('dev_get_app')}</a>
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
    </div>`).join('') || '<div class="empty">'+t('dev_none')+'</div>'}
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

// what each plan gives you — display copy keyed to the shared plan ladder
const PLAN_FEATURES = {
  marche:     ['All five doors (Manual, WhatsApp, API, USSD, SMS)', 'Automatic SMS-anchored verification', 'Live payments feed & receipts', '1 Sentinel device'],
  boutique:   ['Everything in Marché', 'Higher throughput (10 req/s)', 'WhatsApp + API doors at scale', 'Disputes & multi-device', 'Overage $0.035 / extra verification'],
  commerce:   ['Everything in Boutique', '25 req/s', 'Sub-merchant accounts', 'Priority support', 'Overage $0.028 / extra verification'],
  plateforme: ['Everything in Commerce', '100 req/s', 'White-label & sub-merchant API', 'SLA-backed response times', 'Overage $0.020 / extra verification'],
  enterprise: ['Everything in Plateforme', '1000 req/s', 'Custom volume & contracts', 'Dedicated onboarding', 'Talk to us for pricing'],
};
// Plans & Pricing — see the whole ladder and choose/upgrade from inside the app.
VIEWS.pricing = async () => {
  const b = await api('/app/billing');
  const current = b.plan.id;
  const order = ['marche', 'boutique', 'commerce', 'plateforme', 'enterprise'];
  const rank = (id) => order.indexOf(id);
  const card = (p) => {
    const isCur = p.id === current;
    const price = p.usd === null ? t('pr_custom') : (p.usd === 0 ? t('pr_free') : '$' + p.usd);
    const per = p.usd === null ? '' : (p.usd === 0 ? t('pr_forever') : t('pr_permo'));
    const up = rank(p.id) > rank(current);
    const cta = isCur ? `<button class="btn btn-ghost" style="width:100%" disabled>${t('pr_current')}</button>`
      : p.id === 'enterprise' ? `<a class="btn btn-gold" style="width:100%" href="/contact" target="_blank" rel="noopener">${t('pr_talk')}</a>`
      : `<button class="btn ${up ? 'btn-gold' : 'btn-ghost'}" style="width:100%" onclick="choosePlan('${p.id}')">${up ? t('pr_upgrade') : t('pr_switch')} ${esc(p.label)} →</button>`;
    return `<div class="card" style="${isCur ? 'border-color:var(--gold)' : ''};display:flex;flex-direction:column;gap:10px">
      <div style="display:flex;align-items:baseline;justify-content:space-between">
        <h3 style="margin:0">${esc(p.label)}</h3>${isCur ? '<span class="badge b-ok">'+t('pr_current_badge')+'</span>' : ''}</div>
      <div><span style="font-size:30px;font-weight:900">${price}</span><span style="color:var(--dim);font-size:13px">${per}</span></div>
      <div class="mono" style="font-size:12px;color:var(--dim)">${p.verifs === null ? t('pr_unlimited') : fmt(p.verifs) + ' ' + t('pr_verifications')} / mo · ${p.rps} req/s</div>
      <ul style="list-style:none;padding:0;margin:4px 0;display:flex;flex-direction:column;gap:6px">
        ${(PLAN_FEATURES[p.id] || []).map(f => `<li style="font-size:13px;display:flex;gap:8px"><span style="color:var(--verify)">✓</span><span>${esc(f)}</span></li>`).join('')}
      </ul>
      <div style="margin-top:auto">${cta}</div>
    </div>`;
  };
  shell('pricing', t('title_pricing'), t('sub_pricing'), `
    <div id="plan-pay"></div>
    <div class="grid g3" style="align-items:stretch">${b.all_plans.map(card).join('')}</div>
    <p style="margin-top:16px;font-size:13px;color:var(--dim)">${t('pr_prices_note')} <a href="#billing" style="color:var(--gold)">${t('billing')}</a>.</p>`);
  // arriving here to complete a chosen plan → open its payment picker
  const pending = sessionStorage.getItem('koda_pending_plan');
  if (pending) { sessionStorage.removeItem('koda_pending_plan'); setTimeout(() => setPlan(pending), 200); }
};
// choose a plan from the Plans page: free/downgrade switches immediately; a paid
// upgrade opens the payment picker inline (reuses setPlan's #plan-pay box).
window.choosePlan = (p) => { setPlan(p); };

VIEWS.billing = async () => {
  const b = await api('/app/billing');
  const plans = ['marche', 'boutique', 'commerce', 'plateforme'];
  shell('billing', t('billing'), t('sub_billing'), `
  <div class="grid g3">
    <div class="card stat"><b>${acuFmt(b.balance)}</b><span>${t('acu_balance')}</span></div>
    <div class="card stat"><b>${esc(b.plan.label)}</b><span>${t('plan')} · ${b.plan.usd === null ? 'custom' : '$' + b.plan.usd + '/mo'} · ${b.plan.verifs || '∞'} verifs</span></div>
    <div class="card stat"><b>${fmt(b.usage.reduce((a, x) => a + (x.burned || 0), 0))}</b><span>${t('bl_burned')}</span></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>${t('topup')} — ${t('bl_topup_suffix')}</h3>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      ${b.packs.map(p => `<button class="btn btn-ghost" onclick="topupPay(${p.acu},${p.usd})">$${p.usd} → ${fmt(p.acu)} ACU</button>`).join('')}
    </div>
    <div id="topup-out" style="margin-top:14px"></div>
  </div>
  <div class="card" style="margin-top:14px"><h3>${t('redeem_voucher')}</h3>
    <p style="font-size:13px;color:var(--dim)">${t('bl_voucher_p')}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap"><input id="vpin" placeholder="KODA-CD-XXXX-XXXX-XXXX" style="flex:1;min-width:220px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px" class="mono">
      <button class="btn btn-gold" onclick="redeemVoucher()">${t('redeem_voucher')}</button></div>
    <div id="voucher-out" style="margin-top:10px"></div></div>
  <div class="card" style="margin-top:14px"><h3>${t('bl_distributor')}</h3>
    <p style="font-size:13px;color:var(--dim)">${t('bl_distributor_p')}</p>
    <a class="btn btn-ghost" href="#kd">${t('kd_console')} →</a></div>
  <div class="card" style="margin-top:14px"><h3>${t('change_plan')}</h3>
    <div class="pill-row">${plans.map(p => `<button class="pill ${b.plan.label.toLowerCase() === p ? 'on' : ''}" onclick="setPlan('${p}')">${p}</button>`).join('')}</div>
    <div class="mono" style="font-size:11.5px;color:var(--dim)">Marché $0 · Boutique $19 · Commerce $79 · Plateforme $399 · Enterprise custom — one ladder, all five doors.</div>
    <p style="margin-top:8px"><a href="#pricing" style="color:var(--gold);font-size:13px">${t('bl_see_all')}</a></p>
    <div id="plan-pay" style="margin-top:12px"></div>
  </div>
  <div class="grid g2" style="margin-top:14px">
    <div class="card tbl-wrap"><h3>${t('bl_acu_tx')}</h3><table class="tbl">
      ${b.transactions.slice(0, 12).map(x => `<tr><td class="mono" style="font-size:11.5px">${esc(x.kind)}</td>
        <td class="num" style="color:${x.delta > 0 ? 'var(--verify)' : 'var(--dim)'}">${x.delta > 0 ? '+' : ''}${fmt(x.delta)}</td>
        <td class="num" style="color:var(--dim)">${fmt(x.balance_after)}</td>
        <td class="mono" style="font-size:11px;color:var(--dim)">${when(x.created_at)}</td></tr>`).join('')}
    </table></div>
    <div class="card tbl-wrap"><h3>${t('bl_invoices')}</h3><table class="tbl">
      ${b.invoices.map(i => `<tr><td class="mono">${esc(i.number)}</td><td class="num">$${i.amount_usd}</td>
        <td><span class="badge ${i.status === 'paid' ? 'b-ok' : 'b-warn'}">${i.status}</span></td>
        <td class="mono" style="font-size:11px;color:var(--dim)">${esc(i.period || '')}</td></tr>`).join('') || '<tr><td class="empty">'+t('bl_none_yet')+'</td></tr>'}
    </table></div>
  </div>`);
  // arriving from a paid-plan signup → auto-open the payment picker for that plan
  const pending = sessionStorage.getItem('koda_pending_plan');
  if (pending) { sessionStorage.removeItem('koda_pending_plan'); setTimeout(() => setPlan(pending), 200); }
};
// mesh top-up: pick an amount → choose how to pay (KODA mobile money / card)
window.topupPay = async (acu, usd) => {
  const out = document.getElementById('topup-out');
  out.innerHTML = '…';
  try {
    const m = await api(`/app/billing/methods?amount_acu=${acu}${usd ? '&usd=' + usd : ''}`);
    out.innerHTML = `<div class="card" style="border-color:var(--gold)"><h3>Buy ${fmt(acu)} ACU${usd ? ` for $${fmt(usd)}` : ''} — choose how to pay</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        ${m.methods.map(mth => `<button class="btn ${mth.available === false ? 'btn-ghost' : 'btn-gold'}" ${mth.available === false ? 'disabled' : ''} onclick="collectTopup(${acu},${usd || 0},'${mth.rail}')">
          ${esc(mth.label || mth.rail)}${mth.quote ? ` — $${fmt(mth.quote.total_usd)}` : ''}${mth.available === false ? ' (not set up)' : ''}</button>`).join('')}
      </div>
      <p style="font-size:12px;color:var(--dim);margin-top:8px">For the pilot, use <b>KODA Mobile Money</b>. Card/other rails activate when you add their provider keys.</p>
      <div id="collect-out" style="margin-top:10px"></div></div>`;
  } catch (e) { out.innerHTML = `<div class="badge b-bad">✗ ${esc(e.message)}</div>`; }
};
// friendly operator names for the pay-to list
const OP_NAMES = { orange_cd: 'Orange Money', mpesa_cd: 'M-Pesa', airtel_cd: 'Airtel Money', africell_cd: 'Africell Money', mtn_momo: 'MTN MoMo', wave: 'Wave' };
const opName = (c) => OP_NAMES[c] || (c || 'Mobile money');
// Render the mobile-money pay panel: ALL active KODA numbers (buyer picks the one
// matching their wallet) + a live status line that flips to ✓ when KODA auto-verifies.
function mmPanel(s, label, statusHtml) {
  const amt = s.amount_local != null ? `<b>${fmt(s.amount_local)} ${esc(s.currency || '')}</b> (≈ $${fmt(s.amount_usd)})` : `<b>$${fmt(s.amount_usd)}</b>`;
  const nums = (s.pay_to_numbers && s.pay_to_numbers.length) ? s.pay_to_numbers : [{ operator: '', msisdn: s.pay_to, label: '' }];
  const rows = nums.map(n => `<div style="display:flex;justify-content:space-between;align-items:center;gap:10px;padding:9px 11px;border:1px solid var(--line-strong);border-radius:8px;margin-top:6px">
    <div style="min-width:0"><div style="font-size:12px;color:var(--dim)">${esc(opName(n.operator))}${n.label ? ' · ' + esc(n.label) : ''}</div>
      <div class="mono" style="font-size:15px;word-break:break-all">${esc(n.msisdn)}</div></div>
    <button class="btn btn-ghost btn-sm" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(n.msisdn)}');toast('✓ number copied')">Copy</button>
  </div>`).join('');
  return `<div class="card"><h3 class="ok">Pay by mobile money</h3>
    <p style="font-size:14px">Send exactly ${amt} to <b>any one</b> of your KODA numbers below — use the operator that matches your wallet.</p>
    ${rows}
    <p style="font-size:13px;color:var(--dim);margin-top:10px">Your ${esc(label)} activates <b>automatically</b> once KODA sees the payment (usually seconds). Keep your confirmation SMS.</p>
    <div id="mm-status" style="margin-top:10px">${statusHtml}</div></div>`;
}
// Show the panel, then poll the order until KODA settles it — no dead-end screen.
function mmWaitAndPoll(boxId, s, label) {
  const box = document.getElementById(boxId);
  if (!box) return;
  const id = s.reference || s.topup_id;
  let tries = 0, done = false;
  const btn = `<button class="btn btn-ghost btn-sm" onclick="window.__mmCheck&&window.__mmCheck()">I've paid — check now</button>`;
  const setStatus = (html) => { const el = document.getElementById('mm-status'); if (el) el.innerHTML = html; };
  box.innerHTML = mmPanel(s, label, `<span class="badge b-warn">⏳ Waiting for your payment…</span> ${btn}`);
  const check = async (manual) => {
    if (done || !document.getElementById(boxId)) return;   // settled or navigated away → stop
    tries++;
    if (manual) setStatus(`<span class="badge b-info">Checking…</span>`);
    try {
      const st = await api(`/app/billing/collect/${id}`);
      if (st && st.status === 'settled') {
        done = true;
        setStatus(`<span class="badge b-ok">✓ Payment received — ${esc(label)} is now active.</span>`);
        try { ME = await api('/app/me'); } catch {}
        toast('✓ Payment confirmed');
        setTimeout(route, 1800);
        return;
      }
      // not yet seen — tell the buyer WHY nothing happened, don't leave a dead button
      if (manual) setStatus(`<span class="badge b-warn">⏳ Not seen yet</span> ${btn}
        <div style="font-size:12px;color:var(--dim);margin-top:6px">Send <b>exactly</b> the amount shown to one of the numbers above, from the matching wallet. It confirms on its own within seconds of arriving — no need to keep clicking.</div>`);
      else setStatus(`<span class="badge b-warn">⏳ Waiting for your payment…</span> ${btn}`);
    } catch (e) {
      if (manual) setStatus(`<span class="badge b-bad">Couldn't check — ${esc(e.message || 'network')}</span> ${btn}`);
    }
    if (!done && tries < 75 && document.getElementById(boxId)) setTimeout(() => check(false), 4000);   // ~5 min
  };
  window.__mmCheck = () => check(true);
  setTimeout(() => check(false), 4000);
}
window.collectTopup = async (acu, usd, rail) => {
  const out = document.getElementById('collect-out');
  out.innerHTML = '…';
  try {
    const r = await api('/app/billing/collect', { body: { amount_acu: acu, usd: usd || undefined, rail } });
    const s = r.session || {};
    if (s.flow === 'MOBILE_MONEY_TO_KODA_SIM') {
      mmWaitAndPoll('collect-out', s, `${fmt(acu)} ACU`);
    } else if ((s.checkout_url || s.url) && /^https?:\/\//.test(s.checkout_url || s.url)) {
      out.innerHTML = `<a class="btn btn-gold" href="${esc(s.checkout_url || s.url)}" target="_blank" rel="noopener">Continue to secure checkout →</a>`;
    } else {
      out.innerHTML = `<div class="badge b-info">This rail isn't configured yet (sandbox). Use <b>KODA Mobile Money</b> for the pilot, or add the provider's keys to enable it.</div>`;
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
  const r = await api('/app/keys', { body: { prefix: 'koda_test', label: 'console-internal' } });
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
      const label = (r.plan_label || (plan.charAt(0).toUpperCase() + plan.slice(1))) + ' plan';
      mmWaitAndPoll('sub-out', s, label);
    } else if ((s.checkout_url || s.url) && /^https?:\/\//.test(s.checkout_url || s.url)) {
      out.innerHTML = `<a class="btn btn-gold" href="${esc(s.checkout_url || s.url)}" target="_blank" rel="noopener">Continue to secure checkout →</a>`;
    } else {
      out.innerHTML = `<div class="badge b-info">This rail isn't configured yet (sandbox). Use <b>KODA Mobile Money</b> for the pilot, or add the provider's keys to enable it.</div>`;
    }
  } catch (e) { out.innerHTML = `<div class="badge b-bad">✗ ${esc(e.message)}</div>`; }
};

VIEWS.team = async () => {
  const d = await api('/app/team');
  shell('team', t('team'), t('sub_team'), `
  <div class="card" style="display:flex;gap:10px;flex-wrap:wrap">
    <input id="tname" placeholder="${t('tm_name_ph')}" style="flex:1;min-width:140px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px;font-size:13px">
    <input id="temail" placeholder="${t('tm_email_ph')}" style="flex:1;min-width:180px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px;font-size:13px">
    <select id="trole" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px 12px">
      <option value="cashier">cashier</option><option value="manager">manager</option></select>
    <button class="btn btn-gold btn-sm" onclick="inviteMember()">${t('invite')}</button>
  </div>
  <div class="card tbl-wrap" style="margin-top:14px"><table class="tbl">
    <tr><th>${t('th_name')}</th><th>${t('th_email')}</th><th>${t('th_role')}</th><th>${t('th_status')}</th></tr>
    ${d.members.map(u => `<tr><td>${esc(u.name)}</td><td class="mono" style="font-size:12px">${esc(u.email)}</td>
      <td>${(ME.user.role === 'owner' || ME.user.is_admin) && u.id !== ME.user.id ? `<select onchange="setMemberRole('${u.id}',this.value)" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:6px;color:var(--text);padding:5px">${['cashier', 'manager', 'owner'].map(r => `<option value="${r}" ${r === u.role ? 'selected' : ''}>${r}</option>`).join('')}</select>` : `<span class="badge b-info">${esc(u.role)}</span>`}</td>
      <td><span class="badge ${u.status === 'active' ? 'b-ok' : 'b-bad'}">${esc(u.status)}</span></td></tr>`).join('')}
  </table></div>
  <div class="card" style="margin-top:14px"><h3>${t('tm_audit')}</h3>
    ${d.audit.slice(0, 15).map(a => `<div class="feed-row"><div class="feed-ic f-dim">·</div>
      <div><div class="t">${esc(a.action)} <span style="color:var(--dim)">· ${esc(a.name || 'system')}</span></div>
      <div class="m">${esc(a.detail || '')} · ${when(a.created_at)}</div></div></div>`).join('') || '<div class="empty">'+t('tm_empty')+'</div>'}
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
  shell('developers', t('developers'), t('sub_developers'), `
  <div class="grid g2">
    <div class="card"><h3>API keys</h3>
      <p style="font-size:12.5px;color:var(--dim);margin-bottom:8px">Tap a button below to create a key (shown once). For testing use <b>Create koda_test</b>.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
        ${[['koda_test', 'Create koda_test (sandbox)'], ['koda_live', 'Create koda_live'], ['koda_pub_live', 'Create koda_pub_live'], ['koda_rk_live', 'Create koda_rk_live (read-only)']].map(([p, label]) => `<button class="btn ${p === 'koda_test' ? 'btn-gold' : 'btn-ghost'} btn-sm" onclick="createKey('${p}')">${esc(label)}</button>`).join('')}
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
        <div style="min-width:0"><div class="t mono" style="font-size:12.5px;word-break:break-all">${esc(e.url)}</div>
        <div class="m">secret whsec_···${esc(e.secret.slice(-4))} · <span class="badge ${e.active ? 'b-ok' : 'b-warn'}">${e.active ? 'active' : 'disabled'}</span></div></div>
        <div style="margin-left:auto;display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="testWebhook('${e.id}')">${t('test')}</button>
          <button class="btn btn-ghost btn-sm" onclick="toggleWebhook('${e.id}')">${e.active ? 'Disable' : 'Enable'}</button>
          <button class="btn btn-danger btn-sm" onclick="deleteWebhook('${e.id}')">Delete</button>
        </div></div>`).join('') || '<div class="empty">No endpoints yet.</div>'}
      <h3 style="margin-top:16px">Recent deliveries</h3>
      ${(wh.deliveries || []).slice(0, 12).map(d => {
        const ep = (wh.endpoints || []).find(e => e.id === d.endpoint_id);
        const urlTail = ep ? '…' + esc(ep.url.replace(/^https?:\/\//, '').slice(-24)) : '(deleted endpoint)';
        const failed = d.status === 'failed' || d.status === 'dead';
        return `<div class="feed-row"><div class="feed-ic ${d.status === 'sent' ? 'f-ok' : d.status === 'pending' ? 'f-dim' : 'f-bad'}">${d.status === 'sent' ? '✓' : failed ? '✗' : '·'}</div>
        <div style="min-width:0"><div class="t mono" style="font-size:12px">${esc(d.event)} <span style="color:var(--dim)">→ ${urlTail}</span></div>
        <div class="m">${esc(d.status)} · ${d.attempts} attempt${d.attempts === 1 ? '' : 's'} · ${when(d.created_at)}${d.last_error ? ' · <span style="color:var(--danger)">' + esc(String(d.last_error).slice(0, 40)) + '</span>' : ''}</div></div>
        ${failed ? `<button class="btn btn-ghost btn-sm" style="margin-left:auto" onclick="retryDelivery('${d.id}')">Retry</button>` : ''}</div>`;
      }).join('') || '<div class="empty">None yet.</div>'}
    </div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Sandbox test tools</h3>
    <p style="font-size:12.5px;color:var(--dim);margin-bottom:8px">Turn on developer test helpers — magic references (<span class="mono">TEST-OK-…</span>) on the Verify console and inject-an-SMS on the Live Feed — to try KODA before going live. Off by default; these never affect real payments.</p>
    <button class="btn ${isSandbox() ? 'btn-gold' : 'btn-ghost'} btn-sm" onclick="toggleSandbox()">${isSandbox() ? '✓ Sandbox test tools ON — click to turn off' : 'Enable sandbox test tools'}</button>
  </div>
  <div class="card" style="margin-top:14px"><h3>Quickstart</h3>
    <div class="codebox"># 1 · verify your key
curl -H "Authorization: Bearer koda_test_..." ${location.origin}/v1/ping

# 2 · create an intent
curl ${location.origin}/v1/intents -H "Authorization: Bearer koda_test_..." \\
  -d '{"amount":25000,"currency":"CDF","operators":["orange_cd"]}'

# 3 · customer pays → submit their code
curl ${location.origin}/v1/intents/{id}/verify -H "Authorization: Bearer koda_test_..." \\
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
window.toggleWebhook = async (id) => {
  try { const r = await api(`/app/webhooks/${id}/toggle`, { body: {} }); toast(r.active ? '✓ Endpoint enabled' : '✓ Endpoint disabled'); route(); }
  catch (e) { toast('✗ ' + e.message); }
};
window.deleteWebhook = async (id) => {
  if (!confirm('Delete this webhook endpoint and its delivery history? This cannot be undone.')) return;
  try { await api(`/app/webhooks/${id}`, { method: 'DELETE' }); toast('✓ Endpoint deleted'); route(); }
  catch (e) { toast('✗ ' + e.message); }
};
window.retryDelivery = async (id) => {
  try { await api(`/app/webhooks/deliveries/${id}/retry`, { body: {} }); toast('✓ Delivery re-queued'); route(); }
  catch (e) { toast('✗ ' + e.message); }
};

// MERCHANT-facing: only your own inbox + how you're reached. The full event
// architecture / catalogue / QA is operator tooling and lives in Admin → Comms engine.
VIEWS.comms = async () => {
  const notifs = await api('/app/notifications');
  const prefs = await api('/app/comms/prefs');
  shell('comms', t('comms'), 'Your messages and how you receive them', `
  <div class="card"><h3>Inbox <button class="btn btn-ghost btn-sm" style="float:right" onclick="markRead()">${t('mark_read')}</button></h3>
    ${notifs.slice(0, 30).map(n => `<div class="feed-row" id="nf-${n.id}" style="cursor:pointer" onclick="openNotif('${n.id}','${esc(n.event_key)}')" title="Open">
      <div class="feed-ic ${n.severity === 'success' ? 'f-ok' : n.severity === 'critical' ? 'f-bad' : 'f-dim'}" id="nfdot-${n.id}">${n.read ? '·' : '●'}</div>
      <div style="min-width:0;flex:1"><div class="t">${esc(n.title)}</div><div class="m">${esc(n.event_key)} · ${when(n.created_at)}</div>
        ${n.body ? `<div class="nf-body" id="nfbody-${n.id}" style="display:none;font-size:12.5px;color:var(--dim);margin-top:6px;white-space:pre-wrap">${esc(n.body)}</div>` : ''}</div>
      <div style="margin-left:auto;color:var(--dim);font-size:12px">${notifTarget(n.event_key) ? 'open →' : ''}</div></div>`).join('') || '<div class="empty">Empty inbox.</div>'}
  </div>
  <div class="card" style="margin-top:14px"><h3>How KODA reaches you</h3>
    <p style="font-size:13px;color:var(--dim);margin-bottom:10px">Choose the extra channels for your alerts. In-app is always on, and <b>mandatory notices</b> (security, fraud, legal) always deliver on every channel regardless of these toggles.</p>
    <div class="pill-row">${['email', 'whatsapp', 'push', 'sms'].map(ch =>
      `<button class="pill ${prefs[ch] ? 'on' : ''}" onclick="togglePref('${ch}',${prefs[ch] ? 0 : 1})">${ch} ${prefs[ch] ? '✓' : '✗'}</button>`).join('')}</div>
  </div>`);
};
// ADMIN-only: the whole event engine — catalogue, channel coverage, template QA,
// and the system-wide delivery log. Not merchant-facing.
async function adminComms() {
  const cat = await api('/app/comms/catalogue');
  const del = await api('/app/comms/deliveries');
  const s = cat.stats;
  shell('admin', 'Communication Event Architecture', `One event engine — ${s.total} events fan out across email · in-app · WhatsApp · push · SMS`, adminTabBar('comms') + `
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
    <div class="mono" style="font-size:11px;color:var(--dim);margin-top:8px">Preview renders exactly what a recipient receives — logo, brand colour and details on every outbound email. Send test fires it live when a provider key is set; otherwise it's recorded in sandbox so the flow is always testable.</div>
  </div>
  <div class="card" style="margin-top:14px"><h3>Recent deliveries — event × channel × recipient</h3>
    ${del.deliveries.slice(0, 20).map(d => `<div class="feed-row">
      <div class="feed-ic ${d.status === 'sent' ? 'f-ok' : 'f-dim'}"><span class="chan ${d.channel}" style="margin:0">${d.channel[0]}</span></div>
      <div><div class="t mono" style="font-size:12px">${esc(d.event_key)}</div>
      <div class="m">${esc(d.status)} · ${esc(d.provider)} · ${when(d.created_at)}</div></div></div>`).join('') || '<div class="empty">None yet.</div>'}
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
}
window.previewMail = async () => {
  const r = await api('/app/comms/preview/' + document.getElementById('evsel').value);
  document.getElementById('mailprev').innerHTML = `<iframe class="mailframe" srcdoc="${r.html.replace(/"/g, '&quot;')}"></iframe>`;
};
window.sendTest = async () => {
  const r = await api('/app/comms/test/' + document.getElementById('evsel').value, { body: {} });
  toast(`✓ Fired — ${r.deliveries.map(d => d.channel + ':' + d.status).join(' · ')}`);
};
// Map an event key to the merchant screen it's about, so opening a notification deep-links there.
function notifTarget(eventKey) {
  const k = String(eventKey || '');
  const pre = k.split('.')[0];
  const MAP = {
    billing: 'billing', plan: 'billing', invoice: 'billing', payout: 'growth', referral: 'growth', influencer: 'growth',
    apikey: 'developers', webhook: 'developers', api: 'developers', sandbox: 'developers',
    payment: 'receipts', receipt: 'receipts', replay: 'feed', checkout: 'feed', door: 'feed', fraud: 'feed',
    dispute: 'disputes', sentinel: 'devices', parser: 'devices', networks: 'accounts',
    reconciliation: 'dashboard', digest: 'dashboard', ai: 'dashboard', cs: 'dashboard', support: 'dashboard',
    submerchant: 'submerchants', platform: 'submerchants',
    account: 'settings', auth: 'settings', security: 'settings', mfa: 'settings', password: 'settings',
    session: 'settings', privacy: 'settings', user: 'settings', role: 'settings', kyb: 'settings', invitation: 'settings',
  };
  return MAP[pre] || null;
}
window.openNotif = async (id, eventKey) => {
  // mark this one read (clears its dot + the nav badge), reveal any body, then deep-link
  try { await api(`/app/notifications/${id}/read`, { body: {} }); } catch { /* non-fatal */ }
  const dot = document.getElementById('nfdot-' + id); if (dot) dot.textContent = '·';
  const body = document.getElementById('nfbody-' + id); if (body && body.style.display === 'none') { body.style.display = 'block'; }
  try { ME = await api('/app/me'); const b = document.querySelector('.nav-badge'); if (b && (!ME.unread)) b.remove(); } catch {}
  const target = notifTarget(eventKey);
  if (target) location.hash = '#' + target;
};
window.toggleSandbox = () => { try { localStorage.setItem('koda_sandbox', isSandbox() ? '0' : '1'); } catch {} toast(isSandbox() ? '✓ Sandbox test tools ON' : 'Sandbox test tools off'); route(); };
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
  const ref = await api('/app/referrals').catch(() => null);
  const acuBy = Object.fromEntries(d.tools.map(x => [x.id, x.acu]));
  const shareMsg = encodeURIComponent(`I verify my mobile-money payments instantly with KODA — no more fake screenshots. Join free and we both earn credit: `);
  shell('growth', t('growth'), t('growth_sub') + ' · K-11', `
  ${ref ? `<div class="card" style="border-color:var(--gold)">
    <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;gap:8px">
      <h3 style="margin:0">🎁 Refer & earn — grow KODA, get free ACU</h3>
      <span class="mono" style="font-size:12px;color:var(--dim)">${fmt(ref.qualified)} joined · ${fmt(ref.acu_earned)} ACU earned</span></div>
    <p style="font-size:13px;color:var(--dim);margin:8px 0">Share your link. When a merchant you invite verifies their <b>first payment</b>, <b>you both get ${fmt(ref.reward_per)} ACU</b>. No limit.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <input id="reflink" readonly value="${esc(ref.link)}" onclick="this.select()" style="flex:1;min-width:240px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px;font-family:var(--mono);font-size:12px">
      <button class="btn btn-gold btn-sm" onclick="navigator.clipboard&&navigator.clipboard.writeText('${esc(ref.link)}');toast('✓ link copied')">Copy link</button>
      <a class="btn btn-ghost btn-sm" href="https://wa.me/?text=${shareMsg}${encodeURIComponent(ref.link)}" target="_blank" rel="noopener">Share on WhatsApp</a>
    </div>
    ${ref.list && ref.list.length ? `<div class="mono" style="font-size:11px;color:var(--dim);margin-top:10px">Recent: ${ref.list.slice(0, 5).map(x => `${esc(x.name)} <span class="badge ${x.status === 'qualified' ? 'b-ok' : 'b-info'}">${x.status === 'qualified' ? 'earned' : 'joined'}</span>`).join(' · ')}</div>` : ''}
  </div>` : ''}
  <div class="card" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-top:14px">
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
  if (tool === 'sales_kit') return `
    <h3 style="margin:0 0 6px">WhatsApp pitch (${esc(r.language)})</h3>
    <div class="codebox" style="white-space:pre-wrap">${esc(r.whatsapp_pitch)}</div>
    <h3 style="margin:16px 0 6px">Door-to-door script (30 sec)</h3>
    <div class="codebox" style="white-space:pre-wrap">${(r.door_to_door_30s || []).map(esc).join('\n\n')}</div>
    <h3 style="margin:16px 0 6px">Printable flyer</h3>
    <div class="card"><b style="font-size:16px">${esc(r.flyer.headline)}</b>
      <div style="margin:8px 0">${(r.flyer.bullets || []).map(b => `<div>${esc(b)}</div>`).join('')}</div>
      <div style="color:var(--gold);font-weight:700">${esc(r.flyer.cta)}</div>
      <div style="font-size:12px;color:var(--dim);margin-top:4px">${esc(r.flyer.footer)}</div></div>
    <h3 style="margin:16px 0 6px">Objection handling</h3>
    ${(r.objections || []).map(o => `<div style="margin-bottom:8px"><b>${esc(o.q)}</b><br><span style="color:var(--dim)">${esc(o.a)}</span></div>`).join('')}
    <div class="badge b-info" style="margin-top:8px;display:block;line-height:1.5">💡 ${esc(r.tip)}</div>
    <details style="margin-top:10px"><summary style="cursor:pointer;color:var(--gold)">Pitch in all 6 languages</summary>
      ${Object.entries(r.whatsapp_pitch_all_languages || {}).map(([l, p]) => `<div style="margin-top:8px"><b class="mono">${esc(l)}</b><div class="codebox" style="white-space:pre-wrap">${esc(p)}</div></div>`).join('')}</details>`;
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
  <div class="card"><h3>${t('st_profile')}</h3>
    <dl class="kv">
      <dt>name</dt><dd>${esc(m.name)}</dd><dt>country</dt><dd>${esc(m.country)}</dd>
      <dt>currency</dt><dd>${esc(m.currency)}</dd><dt>msisdn</dt><dd class="mono">${esc(m.msisdn || '—')}</dd>
      <dt>plan</dt><dd>${esc(m.plan)}</dd><dt>brand colour</dt><dd><span style="display:inline-block;width:14px;height:14px;background:${esc(m.brand_color)};border-radius:4px;vertical-align:-2px"></span> ${esc(m.brand_color)} (used on customer receipts & emails)</dd>
    </dl></div>
  <div class="card" style="margin-top:14px"><h3>Change password</h3>
    <p style="font-size:13px;color:var(--dim);margin-bottom:10px">If you signed in with a temporary password, set your own here.</p>
    <div class="field"><label>Current password</label><input id="cur_pw" type="password" autocomplete="current-password"></div>
    <div class="field"><label>New password (min 8 characters)</label><input id="new_pw" type="password" autocomplete="new-password"></div>
    <button class="btn btn-gold" style="width:auto;padding:10px 18px" onclick="changePassword()">Update password</button>
  </div>
  <div class="card" style="margin-top:14px"><h3>${t('language')}</h3>
    <p style="font-size:13px;color:var(--dim);margin-bottom:10px">${t('st_lang_note')}</p>
    <div class="pill-row">
      <button class="pill ${!LANG ? 'on' : ''}" onclick="setLang('')">${t('auto')} — ${(navigator.language || 'fr')}</button>
      ${LANG_OPTIONS.map(([v, n]) => `<button class="pill ${LANG === v ? 'on' : ''}" onclick="setLang('${v}')">${n}</button>`).join('')}
    </div></div>
  <div class="card" style="margin-top:14px"><h3>PWA</h3>
    ${window.matchMedia && window.matchMedia('(display-mode: standalone)').matches
      ? '<p style="font-size:13px;color:var(--verify)">✓ Installed — you\'re running KODA as an app.</p>'
      : (window.kodaCanInstall && window.kodaCanInstall()
        ? `<p style="font-size:13px;color:var(--dim);margin-bottom:10px">Install KODA as an app — works offline for the console shell; verifications sync when back online.</p>
           <button class="btn btn-gold" style="width:auto;padding:10px 18px" onclick="window.kodaInstall()">Install KODA app</button>`
        : '<p style="font-size:13px;color:var(--dim)">Install KODA on your phone: if no install button appears, use the browser menu → "Add to Home screen" / "Install app". Works offline for the console shell; verifications sync when back online.</p>')}</div>
  <div class="card" style="margin-top:14px"><h3>${t('st_data')}</h3>
    <p style="font-size:13px;color:var(--dim)">${t('st_data_p')} ${ME.user.role === 'owner' || ME.user.is_admin ? '' : t('st_deletion_owner')}</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <button class="btn btn-ghost" onclick="exportMyData()">${t('st_download')}</button>
      ${ME.user.role === 'owner' || ME.user.is_admin ? `<button class="btn btn-danger" onclick="deleteMyAccount()">${t('st_delete')}</button>` : ''}
    </div></div>`);
};
window.changePassword = async () => {
  const current_password = v('cur_pw'), new_password = v('new_pw');
  if (!new_password || new_password.length < 8) return toast('New password must be at least 8 characters');
  try {
    await api('/app/account/password', { body: { current_password, new_password } });
    toast('✓ Password updated');
    const a = document.getElementById('cur_pw'), b = document.getElementById('new_pw');
    if (a) a.value = ''; if (b) b.value = '';
  } catch (e) { toast(e.message || 'Could not update password'); }
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
  ['collection', 'Collection setup'],
  ['distributors', 'Distributors'], ['vouchers', 'Resellers & vouchers'], ['rails', 'Rails'],
  ['coverage', 'Coverage'], ['doors', 'Doors'], ['agents', 'AI agents'],
  ['fraud', 'Fraud & disputes'], ['verifications', 'Verifications'], ['devices', 'Devices'],
  ['health', 'System health'], ['comms', 'Comms engine'], ['audit', 'Audit log'],
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
  if (tab === 'collection') return adminCollection();
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
  if (tab === 'comms') return adminComms();
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
  <button class="btn btn-gold btn-sm" style="margin-left:8px" onclick="adminResendWelcome('${m.id}')">📧 Email login to owner</button>
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
  const pendingPlans = planPays.filter(p => p.status === 'pending' || p.status === 'initiated');
  const treasury = (d.accounts.find(a => a.account_key === 'koda:treasury') || {}).balance_acu || 0;
  shell('admin', 'Collections', 'KODA staff — money in by rail · double-entry ledger', adminTabBar('collections') + `
  ${pendingPlans.length ? `<div class="card" style="border-color:var(--gold)"><h3>Plan checkouts started — NOT yet paid (${fmt(pendingPlans.length)})</h3>
    <p style="font-size:13px;color:var(--dim)">These merchants opened a mobile-money plan checkout. <b>They activate on their own</b> the moment KODA's Sentinel sees the payment on the SIM — you do nothing. Only use <b>force-activate</b> if you personally saw the money arrive but the Sentinel missed it, and <b>dismiss</b> test clicks / abandoned checkouts.</p>
    <table class="tbl"><tr><th>When</th><th>Merchant</th><th>Plan</th><th>Rail</th><th class="num">Amount</th><th></th></tr>
    ${pendingPlans.map(p => `<tr><td>${when(p.created_at)}</td><td>${esc(p.merchant)}</td><td><span class="badge b-info">${esc(p.plan_key)}</span></td><td class="mono">${esc(p.rail)}</td><td class="num">$${fmt(p.total_usd)}</td>
      <td style="white-space:nowrap">${p.rail === 'koda' ? `<button class="btn btn-ghost btn-sm" onclick="adminSimulatePay('${p.id}')">simulate (test)</button> ` : ''}<button class="btn btn-ghost btn-sm" onclick="adminDismissTopup('${p.id}')">dismiss</button>
        <button class="btn btn-danger btn-sm" onclick="adminSettleTopup('${p.id}')">force-activate</button></td></tr>`).join('')}
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

window.adminSettleTopup = async (id) => {
  if (!confirm('MANUAL OVERRIDE — activate WITHOUT automated verification.\n\nOnly do this if you have personally seen this exact payment arrive on the KODA SIM. Normally KODA\'s Sentinel confirms mobile-money payments automatically. Force-activate anyway?')) return;
  try { const r = await api(`/app/admin/topups/${id}/settle`, { body: {} }); toast(r.plan_activated ? '✓ plan activated: ' + r.plan_activated : '✓ settled'); route(); } catch (e) { toast('✗ ' + e.message); }
};
window.adminSimulatePay = async (id) => {
  if (!confirm('TEST ONLY — simulate the payment SMS landing on the KODA SIM.\n\nRuns the real auto-verify path so this order settles and the buyer\'s checkout flips to active. Use for testing/demo without a physical Sentinel SIM.')) return;
  try { const r = await api(`/app/admin/topups/${id}/simulate-payment`, { body: {} }); toast(r.simulated || r.already ? '✓ simulated — order settled' : '✗ ' + (r.note || 'no match')); route(); } catch (e) { toast('✗ ' + e.message); }
};
window.adminDismissTopup = async (id) => {
  if (!confirm('Dismiss this unpaid pending order? (Use for test clicks / abandoned checkouts — a real settled payment cannot be dismissed.)')) return;
  try { await api(`/app/admin/topups/${id}/cancel`, { body: {} }); toast('✓ dismissed'); route(); } catch (e) { toast('✗ ' + e.message); }
};

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

// ---- KODA self-collection setup (zero-fee mobile-money rail; no env editing) ----
let _collectNums = [];
let _fxDefaults = {}, _countryCur = {}, _merchMap = {};
async function adminCollection() {
  const d = await api('/app/admin/collection');
  _collectNums = (d.numbers || []).map(n => ({ operator: n.operator || '', msisdn: n.msisdn || '', label: n.label || '', active: n.active === false ? false : true }));
  _fxDefaults = d.fx_defaults || {};
  _countryCur = d.country_currency || {};
  _merchMap = {}; (d.merchants || []).forEach(m => { _merchMap[m.id] = { country: m.country, currency: m.currency }; });
  const opList = ['', 'orange_cd', 'mpesa_cd', 'airtel_cd', 'africell_cd', 'mtn_momo', 'wave'];
  const opSel = (val) => `<select data-k="operator" class="cn-in" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:8px">
    ${opList.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o || 'any operator'}</option>`).join('')}</select>`;
  const numRows = () => _collectNums.map((n, i) => `<div class="cn-row" data-i="${i}" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
    ${opSel(n.operator)}
    <input data-k="msisdn" class="cn-in" value="${esc(n.msisdn)}" placeholder="+243 8XX XXX XXX (KODA receiving number)" style="flex:2;min-width:200px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:8px;font-family:var(--mono);font-size:12.5px">
    <input data-k="label" class="cn-in" value="${esc(n.label)}" placeholder="label (e.g. Kinshasa till)" style="flex:1;min-width:120px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:8px">
    <label style="font-size:12px;color:var(--dim);display:flex;align-items:center;gap:4px"><input data-k="active" type="checkbox" ${n.active ? 'checked' : ''}> active</label>
    <button class="btn btn-danger btn-sm" onclick="removeCollectNumber(${i})">✕</button>
  </div>`).join('') || '<p style="color:var(--dim);font-size:13px">No receiving numbers yet — add the KODA mobile-money number(s) customers pay to.</p>';
  const dev = (d.devices || []);
  const online = dev.filter(x => x.status === 'active').length;
  shell('admin', 'Collection setup', 'KODA staff — the zero-fee mobile-money rail KODA gets paid on', adminTabBar('collection') + `
  <div class="card ${d.configured ? '' : ''}" style="border-color:${d.configured ? 'var(--verify)' : 'var(--danger)'}">
    <h3>${d.configured ? '✓ Self-collection is configured' : '⚠ Not configured yet'}</h3>
    <p style="font-size:13px;color:var(--dim)">When a merchant buys a plan or ACU with <b>KODA Mobile Money</b>, they pay one of the numbers below. KODA's own Sentinel phone (on that SIM) sees the operator SMS and <b>auto-verifies</b> the payment — the plan/credit activates by itself in seconds. No code to paste, no per-transaction fee.</p>
    <div class="grid g4" style="margin-top:10px">
      <div class="card stat"><b>${d.numbers.filter(n => n.active).length}</b><span>active numbers</span></div>
      <div class="card stat"><b>${online}/${dev.length}</b><span>collector Sentinels online</span></div>
      <div class="card stat"><b>${fmt(d.pending_collections)}</b><span>pending collections</span></div>
      <div class="card stat"><b>${esc(d.collect_currency)}</b><span>settlement currency</span></div>
    </div>
  </div>

  <div class="card" style="margin-top:14px"><h3>Collector account (holds the receiving SIM + Sentinel)</h3>
    <p style="font-size:13px;color:var(--dim)">Pick the KODA-owned merchant whose Sentinel phone receives the payments. Incoming SMS on this account auto-settle collections; its own counter sales are disabled to keep the treasury clean.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <select id="cn-merchant" onchange="onCollectorPick()" style="flex:1;min-width:240px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
        <option value="">— select collector merchant —</option>
        ${(d.merchants || []).map(m => `<option value="${m.id}" ${m.id === d.collect_merchant_id ? 'selected' : ''}>${esc(m.name)} · ${esc(m.country)} · ${esc(m.id)}</option>`).join('')}
      </select>
    </div>
    ${d.collector ? `<p style="font-size:12px;color:var(--dim);margin-top:8px">Sentinels on this account: ${dev.length ? dev.map(x => `<span class="badge ${x.status === 'active' ? 'b-ok' : 'b-warn'}">${esc(x.label)} · ${esc(x.status)}</span>`).join(' ') : '<span class="warn">none — enrol one in </span>'}${dev.length ? '' : '<a href="#devices" style="color:var(--gold)">Devices</a> on that account.'}</p>` : ''}
  </div>

  <div class="card" style="margin-top:14px"><h3>Receiving numbers</h3>
    <div id="cn-list">${numRows()}</div>
    <button class="btn btn-ghost btn-sm" onclick="addCollectNumber()">＋ Add a number</button>
  </div>

  <div class="card" style="margin-top:14px"><h3>Settlement rate</h3>
    <p style="font-size:13px;color:var(--dim)">KODA works across 90+ countries. Pick a collector account (or type a currency) and the rate <b>auto-fills</b> with a sensible default for that currency — KODA is not an FX provider, so confirm/override it with the rate you actually receive at.</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <label style="font-size:13px">1 USD =</label>
      <input id="cn-rate" type="number" value="${esc(String(d.usd_to_local))}" oninput="onRateEdited()" style="width:140px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px">
      <input id="cn-cur" value="${esc(d.collect_currency)}" onchange="onCollectCurrency()" onblur="onCollectCurrency()" style="width:100px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:10px" placeholder="CDF">
    </div>
    <p id="cn-rate-hint" style="font-size:12px;color:var(--dim);margin-top:8px"></p>
  </div>

  <div style="margin-top:16px;display:flex;gap:10px;align-items:center">
    <button class="btn btn-gold" onclick="saveCollection()">Save collection setup</button>
    <span id="cn-out" style="font-size:13px"></span>
  </div>`);
}
window.addCollectNumber = () => { syncCollectFromDom(); _collectNums.push({ operator: '', msisdn: '', label: '', active: true }); document.getElementById('cn-list').innerHTML = renderCollectRows(); };
window.removeCollectNumber = (i) => { syncCollectFromDom(); _collectNums.splice(i, 1); document.getElementById('cn-list').innerHTML = renderCollectRows(); };
function renderCollectRows() {
  const opList = ['', 'orange_cd', 'mpesa_cd', 'airtel_cd', 'africell_cd', 'mtn_momo', 'wave'];
  const opSel = (val) => `<select data-k="operator" class="cn-in" style="background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:8px">
    ${opList.map(o => `<option value="${o}" ${o === val ? 'selected' : ''}>${o || 'any operator'}</option>`).join('')}</select>`;
  return _collectNums.map((n, i) => `<div class="cn-row" data-i="${i}" style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
    ${opSel(n.operator)}
    <input data-k="msisdn" class="cn-in" value="${esc(n.msisdn)}" placeholder="+243 8XX XXX XXX (KODA receiving number)" style="flex:2;min-width:200px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:8px;font-family:var(--mono);font-size:12.5px">
    <input data-k="label" class="cn-in" value="${esc(n.label)}" placeholder="label (e.g. Kinshasa till)" style="flex:1;min-width:120px;background:var(--ink);border:1px solid var(--line-strong);border-radius:8px;color:var(--text);padding:8px">
    <label style="font-size:12px;color:var(--dim);display:flex;align-items:center;gap:4px"><input data-k="active" type="checkbox" ${n.active ? 'checked' : ''}> active</label>
    <button class="btn btn-danger btn-sm" onclick="removeCollectNumber(${i})">✕</button>
  </div>`).join('') || '<p style="color:var(--dim);font-size:13px">No receiving numbers yet — add the KODA mobile-money number(s) customers pay to.</p>';
}
function syncCollectFromDom() {
  const rows = Array.from(document.querySelectorAll('#cn-list .cn-row'));
  if (!rows.length) return;
  _collectNums = rows.map(row => ({
    operator: (row.querySelector('[data-k="operator"]') || {}).value || '',
    msisdn: (row.querySelector('[data-k="msisdn"]') || {}).value || '',
    label: (row.querySelector('[data-k="label"]') || {}).value || '',
    active: !!(row.querySelector('[data-k="active"]') || {}).checked,
  }));
}
// Auto-fill the settlement rate from the chosen currency/country (90+ markets).
function fxRateHint() {
  const el = document.getElementById('cn-rate-hint'); if (!el) return;
  const cur = (v('cn-cur') || '').toUpperCase();
  const def = _fxDefaults[cur];
  if (!cur) { el.textContent = ''; return; }
  el.innerHTML = def != null
    ? `Auto-filled default for <b>${esc(cur)}</b> (≈ ${fmt(def)} ${esc(cur)} per $1). Confirm or edit to your received rate.`
    : `No built-in default for <b>${esc(cur)}</b> — enter the local amount you actually receive for $1.`;
}
window.onCollectCurrency = () => {
  const cur = (v('cn-cur') || '').toUpperCase();
  const def = _fxDefaults[cur];
  const r = document.getElementById('cn-rate');
  if (def != null && r) r.value = def;   // rate is currency-specific → refill on currency change
  fxRateHint();
};
window.onCollectorPick = () => {
  const m = _merchMap[v('cn-merchant')];
  if (!m) return;
  const cur = (m.currency || _countryCur[(m.country || '').toUpperCase()] || '').toUpperCase();
  const c = document.getElementById('cn-cur');
  if (cur && c) { c.value = cur; onCollectCurrency(); }   // country → currency → default rate
};
window.onRateEdited = () => {
  const el = document.getElementById('cn-rate-hint');
  if (el) el.textContent = 'Using your custom rate — payments auto-match on the exact local amount computed from it.';
};
window.saveCollection = async () => {
  syncCollectFromDom();
  const out = document.getElementById('cn-out');
  out.innerHTML = '…';
  try {
    const r = await api('/app/admin/collection', { body: {
      collect_merchant_id: v('cn-merchant'),
      collect_currency: v('cn-cur'),
      usd_to_local: Number(v('cn-rate')),
      numbers: _collectNums.filter(n => n.msisdn.trim()),
    } });
    out.innerHTML = r.configured ? '<span class="ok">✓ Saved — collection is live</span>' : '<span class="warn">Saved, but no active number yet</span>';
    setTimeout(route, 1200);
  } catch (e) { out.innerHTML = `<span class="badge b-bad">✗ ${esc(e.message)}</span>`; }
};

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
// Regenerate a temp password and EMAIL it to the owner — admin never sees it.
window.adminResendWelcome = async (mid) => {
  if (!confirm('Generate a NEW temporary password and email it to the owner? (You will not see the password.)')) return;
  try { const r = await api(`/app/admin/merchants/${mid}/resend-welcome`, { body: {} });
    toast('✓ Login details emailed to ' + r.sent_to, 6000); }
  catch (e) { toast('✗ ' + (e.message || 'could not send')); }
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
