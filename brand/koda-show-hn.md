# KODA — Show HN post

HN rewards honesty and technical substance over marketing. Post as text, put the
link in the URL field. Launch Tue–Thu morning US-Eastern. Reply to every comment.

---

**Title (URL field: https://kodajnn.com):**
Show HN: KODA – Verify mobile-money payments from the operator's SMS

**Text:**

I'm building KODA, a payment-verification service for African mobile money — Orange Money, M-Pesa, Airtel, MTN MoMo, Wave and 200+ more.

The problem: most merchants still confirm payments by screenshot, which is trivially faked (edit the amount, reuse an old receipt, invent one). The "proper" fix — a direct telco API — takes 6–18 months of negotiation per operator, per country, and small merchants get turned away.

KODA's approach avoids the telco entirely. The operator already sends the merchant a confirmation SMS on every payment; that message, on the merchant's own phone, is the source of truth. KODA matches the customer's reference code against it and returns a fraud-checked verdict in about 3 seconds. You can verify by console, API, WhatsApp, USSD, or inbound SMS — so it works on a feature phone with no internet too.

For the HN crowd, the stack is deliberately boring: a zero-dependency Node app (node:http + node:sqlite, no framework), a vanilla-JS SPA, one Docker container behind Caddy. No npm dependency tree at all.

Two honest boundaries: KODA never touches funds — it's not a bank, wallet or escrow, money goes straight from customer to merchant on the operator's network. And verification is replay-locked and fraud-scored but doesn't guarantee against an operator-side reversal or prove final settlement; it makes you *first to know*.

Free to try: https://kodajnn.com — I'd love feedback on the approach, the fraud model, and the zero-dependency architecture.

---

**First comment (post right after, adds technical depth):**

A few implementation details HN might find interesting:

- **Anti-replay:** every verified reference code is locked single-use forever, across all channels. A recycled receipt is dead on arrival.
- **Anti-forgery:** for the always-on capture path (a small Android app that reads the operator SMS on the merchant SIM), KODA runs a balance-chain check — the running balances across a device's messages have to add up, so a spoofed SMS breaks the chain. Device-less pastes are labelled a lower confidence tier honestly, rather than pretending they're the same.
- **Coverage as parsing, not contracts:** one operator brand usually shares one SMS grammar across every country it runs in, so "template families" unlock the map — 235 operators / 95 countries in the registry today, 6 hand-tuned parsers live and the rest on a multilingual generic parser at a lower trust band.
- **Why node:sqlite:** it's a single-box product for now; the whole OS (frontend + API + ledger) is one process, which keeps ops trivial. Postgres is the scale path when it's needed, not before.

Happy to go deeper on any of it — and genuinely interested in how you'd attack the fraud model.
