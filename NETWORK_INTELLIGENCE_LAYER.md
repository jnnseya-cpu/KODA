# KODA — Global Payment Network Intelligence Layer

> The product principle in one sentence: **a customer sees a payment network only
> when KODA can actually verify a payment on it for that specific merchant.**
> No dead options. No "operator not available" *after* the customer paid.

This document is the authoritative spec for the resolver that decides which
payment methods are shown, and it maps 1:1 to the code in
`app/backend/lib/networks.js`, `app/shared/operators.js`, and
`app/backend/routes.js`. It is the §28 visibility formula, made executable.

---

## 1. Why this layer exists

Every other approach shows the customer a menu of networks and *hopes* the
merchant can receive on them. KODA inverts it. A network is a customer-visible
option **only** when every one of these is simultaneously true:

1. **KODA supports the network** — it is in the Atlas and is SMS-verifiable
   (Tier A or B, never Tier C).
2. **The merchant has connected a receiving account** on that network.
3. **Ownership of that account is proven** (`ownership_status = VERIFIED`).
4. **The account is activated** (`activation_status = ACTIVE`, not DRAFT /
   PAUSED / SUSPENDED).
5. **The door is enabled** for that account (Manual / WhatsApp / API).
6. **The receiving edge is healthy** — for automatic doors, a live KODA Sentinel
   is attached and has sent a heartbeat within the freshness window.
7. **Context matches** — the requested country and currency are ones this
   account actually receives.

Miss any one, and the method is not offered. When it is excluded, the resolver
says *why* with a typed reason — never a silent drop.

---

## 2. The visibility formula (§28)

```
visible(account, ctx) =
      koda_supports(account.network)                 // Tier A|B, in Atlas
  AND account.country   == ctx.country
  AND ctx.currency      ∈ account.receive_currencies
  AND account.ownership_status == VERIFIED
  AND account.activation_status == ACTIVE
  AND door_enabled(account, ctx.door)
  AND ( ctx.door == MANUAL  OR  device_healthy(account.device) )
```

`resolve(merchant, ctx)` returns `{ available, excluded }`. Every account the
merchant holds lands in exactly one bucket; excluded entries carry a machine
reason so the UI and the API can explain themselves.

### Exclusion reasons (stable enum)

| Reason | Meaning |
|---|---|
| `KODA_NOT_SUPPORTED` | Network not in the Atlas, or Tier C (bank-rail / app-push) |
| `COUNTRY_MISMATCH` | Paying context country ≠ account country |
| `CURRENCY_UNSUPPORTED` | Requested currency not in the account's receive list |
| `MERCHANT_NOT_ACTIVATED` | Account exists but is still DRAFT |
| `ACCOUNT_NOT_VERIFIED` | Ownership never proven |
| `MERCHANT_TEMPORARILY_PAUSED` | Merchant paused this account |
| `OPERATOR_SUSPENDED` | KODA/ops suspended the account |
| `DOOR_DISABLED` | Method not enabled for the requested door |
| `DEVICE_OFFLINE` | Auto door, but no healthy Sentinel behind the account |

---

## 3. Tiers — what KODA will and won't pretend to verify

Classification lives in `operators.js` (`tierOf`) and is enforced, not
decorative.

- **Tier A — SMS-native.** Operator sends a merchant confirmation SMS carrying
  reference, amount, sender and **running balance**. Full balance-chain fraud
  defence applies. Verifiable.
- **Tier B — hybrid.** SMS plus app/push. Usually verifiable from the SMS the
  merchant SIM still receives, sometimes at a lower trust band.
- **Tier C — bank-rail / app-push.** No merchant SMS at all (e.g. UPI, pure
  bank rails, pure in-app ledgers). **Nothing for KODA to read.**

`connect()` **refuses** a Tier-C network with `422 network_not_supported`
rather than accept an account it can never verify. Honesty is enforced in code.

---

## 4. Template families — how coverage compounds

One brand ≈ one SMS grammar. M-Pesa's confirmation is structurally the same
across all its markets, so one template pack lights up every country it runs in.
This is why a small number of families cover the whole registry:

- `familyOf(op)` groups operators by brand grammar (`FAMILY_RULES`).
- `families()` returns the pack backlog ranked by how many deployments each
  family unlocks — the build order for maximum coverage per unit of work.
- **LIVE** = a hand-tuned precise pack exists (`packed: true`).
- **Template-ready** = the multilingual generic parser (FR · EN · PT · ES · ID ·
  MS) structures the SMS at a **lower trust band**; those verifications route
  through the challenge path (`+0.2` risk in `fraud.js`) until a precise pack
  ships. Never silently claimed as fully supported.

The public `/coverage` page and `/v1/operators` expose these numbers straight
from the registry, so marketing can never drift from the resolver.

---

## 5. Account lifecycle

```
        connect()                 prove ownership            activate()
DRAFT ─────────────▶ UNVERIFIED ──────────────▶ VERIFIED ─────────────▶ ACTIVE
 (verify_ref issued)   (Sentinel captures         (ready)      │
                        an SMS containing                      ├─ pause()  ▶ PAUSED
                        the verify_ref)                        └─ suspend()▶ SUSPENDED
```

1. **Connect** (`POST /v1/merchant-network-accounts`): merchant registers a
   receiving identifier. KODA mints a `verify_ref` like `KODA-1VHR` and the
   account starts `UNVERIFIED / DRAFT`. Masked identifier is stored; the raw is
   never echoed back in resolver output.
2. **Prove ownership**: the merchant makes/receives a tiny transfer carrying the
   `verify_ref`. Sentinel forwards the confirmation SMS; `engine.ingestSms` sees
   the ref (`checkOwnershipProof`) and flips the account to `VERIFIED`.
3. **Activate** (`.../activate`): gated — returns `409 ownership_unverified` if
   ownership isn't proven yet. On success → `ACTIVE`.
4. **Pause / resume / suspend**: reversible states that hide/show the method
   without losing the ownership proof.

---

## 6. Device health — the automatic-door gate

`deviceHealthy(deviceId)` (in `networks.js`):

```
healthy = device.status == 'active'
      AND minutes_since(device.last_seen) <= 10   // heartbeat freshness
      AND device.parse_health >= 0.5              // it's actually parsing SMS
```

- **Automatic doors (API, WhatsApp)** require a healthy Sentinel — no live edge,
  no auto verification, so the method is hidden with `DEVICE_OFFLINE`.
- **Manual door** runs device-less: a human pastes the code into the Verify
  Console, so `resolve(..., {door:'MANUAL'})` skips the health gate.

Heartbeats arrive at `POST /v1/device/heartbeat` (battery, attestation,
`parse_health`); revoking or losing a device immediately removes its accounts
from the automatic doors.

---

## 7. Masking

`mask(id)` keeps only the country hint and the last three digits:
`+243812345678 → +243XXXXXX678`. The resolver only ever returns
`masked_receiving_identifier`; the raw identifier stays server-side. Tests
assert no run of 6+ digits ever leaks.

---

## 8. Public & merchant surface

| Endpoint | Purpose |
|---|---|
| `GET /v1/catalog/countries/:code/networks` | Public catalogue for a country (Tier-C excluded) |
| `GET /v1/operators` | Full registry with family + tier + coverage |
| `POST /v1/merchant-network-accounts` | Connect an account (mints `verify_ref`) |
| `POST /v1/merchant-network-accounts/:id/activate` | Activate (ownership-gated) |
| `POST /v1/merchant-network-accounts/:id/pause` | Pause |
| `GET /v1/merchants/me/payment-methods?currency=&country=&door=` | The resolver for the authenticated merchant |
| `GET /checkout/:id/payment-methods` | Customer-facing resolved methods for an intent |
| `POST /v1/device/heartbeat` | Sentinel health |
| App mirrors under `/app/network-accounts`, `/app/payment-methods` | Console UI |

`createIntent` embeds `available_networks` + `network_selection` so the hosted
checkout only ever renders methods that will actually resolve.

---

## 9. What is guaranteed by tests

`app/backend/tools/test-networks.js` (self-hosting, 16 checks) proves the whole
chain end-to-end: catalogue LIVE/Tier-C filtering, Tier-C connect rejection,
DRAFT→verify_ref, hidden-until-activated, ownership-gated activation, SMS
ownership proof, heartbeat, customer-visibility, masking, currency/country
exclusions, pause/resume, offline-device hiding, and cross-merchant isolation.
It runs inside `npm run test:all`.

---

*The confirmation SMS was always the API. This layer makes sure the customer is
only ever offered a network whose SMS KODA can actually read — for that
merchant, on that account, right now.*
