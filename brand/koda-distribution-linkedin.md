# KODA — LinkedIn posts (EN + FR)

**How to use:** LinkedIn suppresses reach on posts with an external link in the body.
Best practice: post the text, then **drop the link as the FIRST comment** right after
publishing (e.g. `https://kodajnn.com/blog/verify-mobile-money-payments-ai-agents`
or `https://kodajnn.com`). Post from your personal profile first, then reshare from
the KODA company page. Post 2–3× a week, not all at once.

Links to rotate:
- Pillar (AI agents): https://kodajnn.com/blog/verify-mobile-money-payments-ai-agents
- Fraud guide: https://kodajnn.com/blog/stop-mobile-money-screenshot-fraud
- Home / sign up: https://kodajnn.com  ·  https://kodajnn.com/get-started

---

## EN — Post 1 · The pain (widest audience)

A customer sends you a screenshot: "I've paid — here's the proof."

You hand over the goods.

The payment never happened.

Every merchant taking mobile money knows this feeling. A screenshot is just a picture — it's edited, reused or invented in seconds, and it looks exactly like a real one. By the time you find out, the money's gone.

We built KODA to end it.

KODA verifies any mobile-money payment against the operator's *own* confirmation SMS — the one that lands on **your** phone, that no customer can edit. You read the code, KODA checks it, and you get a verdict in about 3 seconds. Orange Money, M-Pesa, Airtel, and 200+ more.

No telco contract. Nothing to install. Free to start.

A screenshot can be faked. The SMS can't.

Link in the comments 👇

#MobileMoney #Fintech #DRC #Africa #Payments #FraudPrevention

---

## EN — Post 2 · The AI-agent angle (dev / fintech audience)

Can an AI agent know whether a mobile-money payment is actually real?

Yes — and not by "looking at" a screenshot (LLMs can't reliably tell a forged image from a real one).

The reliable way is the boring way: match the transaction reference against the operator's own confirmation message. Deterministic. Loggable. Impossible to fake by editing a picture.

That's what KODA does, exposed as a single API call + signed webhooks:
→ ~3-second verdict
→ 235 operators across 95 countries
→ no telco API, no integration to license first
→ every code single-use, so one verified event = one fulfilled order

If you're building checkout bots, WhatsApp commerce, or marketplace automation in African mobile-money markets, this is the "paid / not paid" primitive you've been missing.

Full developer write-up in the comments 👇

#AI #Fintech #API #MobileMoney #DevTools #BuildInPublic

---

## EN — Post 3 · The insight (shareable one-liner)

The mobile-money operator already sends a confirmation SMS the moment you're paid.

That SMS is the API.

The entire payments industry spends 6–18 months negotiating telco API access, per operator, per country — and small merchants get turned away at the door.

KODA skips all of it. It reads the confirmation message the merchant *already receives*, matches the customer's code against it, and returns a verdict in seconds. No contract. No integration. 235 operators, 95 countries.

And it never touches your money — funds go straight from customer to merchant. KODA just tells you, honestly and fast, whether the payment was real.

Free to verify your first payment 👇

#MobileMoney #Fintech #Africa #Payments #Startups

---
---

## FR — Post 1 · La douleur (audience la plus large)

Un client vous envoie une capture d'écran : « J'ai payé, voici la preuve. »

Vous remettez la marchandise.

Le paiement n'a jamais eu lieu.

Tout commerçant qui accepte le mobile money connaît ce sentiment. Une capture n'est qu'une image — modifiée, réutilisée ou inventée en quelques secondes, et impossible à distinguer d'une vraie. Quand vous vous en rendez compte, l'argent est parti.

Nous avons créé KODA pour y mettre fin.

KODA vérifie n'importe quel paiement mobile money grâce au SMS de confirmation de l'opérateur — celui qui arrive sur **votre** téléphone, qu'aucun client ne peut modifier. Vous lisez le code, KODA le vérifie, verdict en 3 secondes environ. Orange Money, M-Pesa, Airtel et plus de 200 autres.

Sans contrat télécom. Rien à installer. Gratuit pour commencer.

Une capture peut être truquée. Le SMS, non.

Lien en commentaire 👇

#MobileMoney #Fintech #RDC #Afrique #Paiements

---

## FR — Post 2 · L'angle agents IA (audience dev / fintech)

Un agent IA peut-il savoir si un paiement mobile money est réellement authentique ?

Oui — mais pas en « regardant » une capture d'écran (un modèle d'IA ne distingue pas de façon fiable une image truquée d'une vraie).

La bonne méthode est la méthode ennuyeuse : comparer la référence de la transaction au message de confirmation de l'opérateur. Déterministe. Traçable. Impossible à truquer en modifiant une image.

C'est ce que fait KODA, via un simple appel d'API + des webhooks signés :
→ verdict en ~3 secondes
→ 235 opérateurs dans 95 pays
→ aucune API télécom, aucune intégration à licencier
→ chaque code à usage unique : un événement vérifié = une commande honorée

Si vous construisez des bots de paiement, du commerce sur WhatsApp ou des places de marché sur les marchés mobile money africains, voici la brique « payé / non payé » qui vous manquait.

Guide développeur complet en commentaire 👇

#IA #Fintech #API #MobileMoney #Afrique

---

## FR — Post 3 · L'idée clé (phrase à partager)

L'opérateur mobile money envoie déjà un SMS de confirmation dès que vous êtes payé.

Ce SMS, c'est l'API.

Toute l'industrie des paiements passe 6 à 18 mois à négocier un accès API télécom, par opérateur et par pays — et les petits commerçants se voient refuser l'accès.

KODA saute tout ça. Il lit le message de confirmation que le commerçant *reçoit déjà*, compare le code du client, et renvoie un verdict en quelques secondes. Sans contrat. Sans intégration. 235 opérateurs, 95 pays.

Et il ne touche jamais à votre argent — les fonds vont directement du client au commerçant. KODA vous dit seulement, honnêtement et vite, si le paiement était réel.

Vérifiez votre premier paiement gratuitement 👇

#MobileMoney #Fintech #Afrique #RDC #Paiements
