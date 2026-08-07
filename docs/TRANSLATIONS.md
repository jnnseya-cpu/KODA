# KODA — Language coverage

KODA auto-detects the device language and never forces the user to pick. A `?lang=`
query override (checkout) or an explicit choice in **Settings → Language** (merchant
app) always wins. Unknown locales fall back to **French** (KODA's primary
francophone-Africa market); a partly-covered language falls back to its regional
lingua franca (francophone → French, anglophone → English) before English.

## Target set (6 languages)

| Code | Language | Region |
|------|----------|--------|
| `fr` | Français | DRC, Congo, Senegal, francophone Africa (primary) |
| `en` | English | pan-African, international |
| `sw` | Kiswahili | East/Central Africa (DRC east, KE, TZ) |
| `ln` | Lingála | DR Congo, Congo-Brazzaville |
| `wo` | Wolof | Senegal, Gambia |
| `ak` | Twi (Akan) | Ghana |

## Surface-by-surface status

### 1. Checkout widget (customer-facing, highest volume) — `app/frontend/checkout/pay.html`
**9 languages, full parity (38 keys each): fr, en, es, pt, ar (RTL), sw, ln, wo, ak.**
Device auto-detect via `navigator.languages`; `?lang=` override; English ultimate
fallback. This is the surface a paying customer sees, so it is translated in full.

### 2. Merchant app (all views) — `app/frontend/app.js` (`I18N`)
- **Full (71 keys):** fr, en, sw.
- **Core UI (67 keys):** ln, wo, ak — navigation, verify console actions, dashboard,
  auth, settings. The four longer risk-bearing strings (`vmeans_*` = the "what
  verified means / doesn't mean" legal copy, and the paste-SMS helper) intentionally
  **fall back to French** (ln, wo) or **English** (sw, ak) via `LANG_FALLBACK`, so a
  merchant reads a correct, reviewed sentence rather than an uncertain machine one on
  the exact copy where a mistranslation could cause a financial decision error.
- Auto-detect: `detectLang()` maps `navigator.languages` → supported code (incl.
  `tw`→`ak`), default `fr`.

### 3. Comms & receipts — `app/backend/comms/subjects-i18n.js`
The money-path events a merchant actually reads (17 keys: payment verified/late/
review/rejected/reversed/unmatched, intent expired, receipt issued, replay blocked,
fraud high-risk/chain-break, billing top-up/low-balance/grace/suspended, network
ownership) are localised into **fr, sw, ln, wo, ak** and selected by
`merchant.language`, with English catalogue fallback for every other event and
language. WhatsApp template routing (fr/en_US) was already in place.

### 4. Marketing site — `koda-landing.html`
Primary content is French/English (the buyer-facing languages for GTM). Localising
the marketing narrative into ln/wo/ak is deferred: marketing copy is persuasion-
critical and warrants native copywriters, not machine translation.

## Honesty note on translation quality

- **fr, en** — authored/reviewed, production quality.
- **sw** — strong machine-quality; recommend one native review pass before heavy
  East-Africa marketing.
- **ln, wo, ak** — best-effort for the short, high-frequency UI/notification strings;
  **flagged for native-speaker review before a market push in those regions.** The
  fallback design guarantees that any string not yet confidently translated renders in
  the regional lingua franca (fr/en) rather than as broken text — so the app is always
  usable, and each language can be upgraded to full coverage incrementally without any
  code change beyond adding keys.

## How to extend a language to full coverage

1. Merchant app: add the missing keys to the language object in `I18N` (`app.js`).
   Missing keys auto-fall back until added — no other change needed.
2. Checkout: add/adjust keys in the `I18N` object in `pay.html` (keep 38-key parity).
3. Comms: add the event key under the language in `subjects-i18n.js`.
