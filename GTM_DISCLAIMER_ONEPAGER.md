# KODA — Note de clarification (disclaimer)

*Ce que KODA est — et n'est pas. Document d'une page à joindre à l'e-mail, destiné aux
opérateurs mobile money et, si besoin, au régulateur (BCC / ARPTC). Version française
(principale) ci-dessous ; version anglaise à la fin.*

---

## KODA n'est pas un concurrent — c'est une couche de confiance

**KODA est un service de *vérification* de paiements mobile money.** Notre seul rôle est de
**confirmer qu'un paiement a bien eu lieu**, à partir du **SMS de confirmation que
l'opérateur envoie déjà** au commerçant. Rien de plus.

### Ce que KODA **N'EST PAS**
- ❌ **Pas une banque** — nous n'ouvrons pas de comptes, ne prêtons pas, ne gardons pas de dépôts.
- ❌ **Pas un portefeuille (wallet)** — nous ne stockons aucun solde d'argent.
- ❌ **Pas un processeur de paiement / PSP** — nous n'initions ni ne traitons aucune transaction.
- ❌ **Pas un agrégateur** — nous ne connectons pas de moyens de paiement pour encaisser.
- ❌ **Pas un service de transfert d'argent / EME** — nous ne transmettons pas de fonds.
- ❌ **Pas un séquestre (escrow)** — nous ne retenons jamais l'argent entre les parties.

### Ce que KODA **EST**
- ✅ Un **outil de vérification** : il lit un SMS de confirmation et dit « oui, ce paiement
  est réel » (ou « attention, suspect »).
- ✅ Une **couche de confiance** au comptoir — comme une **imprimante de reçus**, pas une
  caisse rivale.
- ✅ Un **détecteur de fraude** : faux SMS, captures d'écran truquées, rejeu de messages.

### Le point essentiel : **KODA ne touche jamais l'argent**
> **L'argent circule directement du client vers le commerçant, sur les rails de l'opérateur.**
> KODA ne détient, ne déplace, ne règle et n'encaisse **aucun** fonds — à aucun moment.
> Nous ne voyons que le **texte du SMS de confirmation**, fourni par le commerçant lui-même.

Comme KODA ne manipule aucun fonds, KODA **n'entre pas** dans le champ des services de
paiement réglementés (établissement de paiement, de monnaie électronique, ou transfert de
fonds). KODA est un **prestataire de services technologiques** (logiciel de vérification et
de détection de fraude) au service du commerçant.

### Données & vie privée
- KODA ne traite que le **texte du SMS de confirmation** et les métadonnées de vérification.
- Pas de collecte de PIN, de mot de passe, ni d'accès au compte mobile money du client.
- Données hébergées de façon sécurisée ; export et suppression disponibles sur demande.

### Pourquoi c'est bon pour l'opérateur
En supprimant la peur du faux paiement, KODA fait accepter le mobile money à des commerçants
qui restaient au cash — ce qui **augmente le volume de transactions de l'opérateur**, sans
lui coûter de commission et sans empiéter sur son activité.

**KODA — Groupe Nseya Digital / JNN Global Ltd**
koda@kodajnn.com · **kodajnn.com**

---
---

## KODA — Clarification note (disclaimer) *(English)*

**KODA is a payment *verification* service for mobile money.** Our only role is to **confirm
that a payment actually happened**, using the **confirmation SMS the operator already sends**
the merchant. Nothing more.

### What KODA is **NOT**
- ❌ **Not a bank** — no accounts, no lending, no deposits held.
- ❌ **Not a wallet** — we store no money balance.
- ❌ **Not a payment processor / PSP** — we neither initiate nor process transactions.
- ❌ **Not an aggregator** — we don't connect payment methods to collect funds.
- ❌ **Not a money-transfer service / EMI** — we don't transmit funds.
- ❌ **Not an escrow** — we never hold money between parties.

### What KODA **IS**
- ✅ A **verification tool**: it reads a confirmation SMS and says "yes, this payment is real"
  (or "warning, suspicious").
- ✅ A **trust layer** at the counter — like a **receipt printer**, not a rival till.
- ✅ A **fraud detector**: fake SMS, edited screenshots, message replay.

### The key point: **KODA never touches the money**
> **Money flows directly from customer to merchant, on the operator's own rails.** KODA
> never holds, moves, settles or collects **any** funds — at any point. We only ever see the
> **text of the confirmation SMS**, supplied by the merchant.

Because KODA handles no funds, KODA falls **outside** the scope of regulated payment services
(payment institution, e-money institution, or money remittance). KODA is a **technology
provider** (verification and fraud-detection software) serving the merchant.

### Data & privacy
- KODA processes only the **confirmation SMS text** and verification metadata.
- No PINs, no passwords, no access to the customer's mobile-money account.
- Data hosted securely; export and deletion available on request.

### Why it's good for the operator
By removing the fear of fake payment, KODA gets cash-only merchants to accept mobile money —
which **grows the operator's transaction volume**, at no commission cost and without competing
with the operator's business.

**KODA — Groupe Nseya Digital / JNN Global Ltd**
koda@kodajnn.com · **kodajnn.com**
