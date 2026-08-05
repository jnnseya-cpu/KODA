# KODA Global Coverage Atlas — The World Mobile Money Registry v1.0

**Groupe Nseya Digital / BitriPay Ecosystem — Confidential**
**Companion to:** KODA Unified Master Specification v2.0 (expands §4, Worldwide Operator Coverage)
**Purpose:** the master target list of every material mobile-money deployment on Earth — name, owner, country coverage — classified by KODA-readiness. The template-pack production backlog and the market-sizing bible in one document.

> This Atlas is now **encoded in the live registry** — `app/shared/operators.js` carries every operator's `tier` (A/B/C) and grammar `family`, and `GET /v1/operators` returns the coverage + the pack-production backlog. Current live numbers: **235 operators · 95 countries · Tier A 112 / B 64 / C 59.**

> **Context that frames everything:** the GSMA tracks ~270–310 live telco-led mobile-money deployments; the industry crossed **$2 trillion in annual transaction value in 2025**, Africa driving the growth. MTN MoMo alone processed >$0.5T; Vodacom's M-Pesa/VodaCash moved ~$450B across eight markets; Orange Money exceeded $178B. Sub-Saharan Africa passed **one billion registered accounts**. Every one of those transactions fires a merchant-side confirmation — and almost none of it is verifiable by software today. That is KODA's total addressable market.

---

## How to read this Atlas — the KODA-fit classification

| Tier | Meaning | KODA status |
|---|---|---|
| **A — SMS/USSD-native** | Operator-led mobile money where the merchant confirmation SMS is standard (GSMA model). | **KODA-ready** — template pack only |
| **B — Hybrid** | App-first wallet that still emits SMS confirmations for merchant/till receipts, or where SMS behaviour varies by product. | KODA-ready where the SMS leg exists; **calibrate in-market before claiming** |
| **C — App-push / bank-rail** | Push-only wallets, or account-to-account rails (UPI, Pix, PromptPay, InstaPay, Bakong, Multicaixa). Different mechanism. | Roadmap adapters (notification-listener where OS-permitted); **never claimed in v2** |

**Honesty rules baked in:** ① this landscape mutates monthly — services rebrand (Tigo Pesa → Mixx by Yas), get sold (Orange Niger → Zamani), or die (YUP, Ecuador's dinero electrónico); entries marked **†** need status re-verification at pack-build time. ② Exact SMS grammar is *never* assumed — every pack is calibrated on ≥5 live samples via the Community Template Program. ③ "Coverage" means the market list per brand, not a warranty; the public parse-health page is the live truth.

---

## PART I — The pan-African groups (the eight brands that are half the world's mobile money)

One brand ≈ one SMS grammar family, so a single well-built template family unlocks 10–20 countries at once. **In the live registry these are the top of `GET /v1/operators` → `families`:** Orange 16 · MTN 14 · Airtel 12 · M-Pesa 8 · Moov 8 · Tigo 6 · Digicel 4 · Wave 4 · Afrimoney 2.

1. **M-Pesa** (Vodafone/Vodacom/Safaricom) — Tier A. Kenya (anchor) · Tanzania · DR Congo (W1) · Mozambique · Lesotho · Ethiopia · Egypt (Vodafone Cash) · Ghana (Telecel Cash†).
2. **MTN MoMo** — Tier A. Ghana (dominant) · Uganda · Cameroon · Côte d'Ivoire · Rwanda · Benin · Congo-B · Guinea · Guinea-Bissau · Liberia · South Sudan · Zambia · eSwatini · South Africa · Nigeria (MoMo PSB) · Botswana†.
3. **Orange Money** — Tier A. Senegal · Mali · Côte d'Ivoire · Burkina Faso · Guinea · Guinea-Bissau · Sierra Leone · Liberia · Cameroon · CAR · DR Congo · Madagascar · Botswana · Egypt† · Morocco · Tunisia† · Jordan. (Orange Niger sold → Zamani Cash.)
4. **Airtel Money** — Tier A. Kenya · Tanzania · Uganda · Rwanda · Zambia · Malawi · Madagascar · Niger · Chad · Gabon · Congo-B · DR Congo · Seychelles · Nigeria (SmartCash PSB).
5. **Wave** — Tier B (app-first; SMS legs vary — calibrate). Senegal (anchor) · Côte d'Ivoire · Mali · Burkina Faso · The Gambia · scaling: Niger · Sierra Leone · Cameroon · Uganda · DR Congo†.
6. **Moov Money / Flooz** (Maroc Telecom) — Tier A. Benin · Togo · Côte d'Ivoire · Burkina Faso · Niger · Mali† · Chad · Gabon · CAR†.
7. **Africell — Afrimoney** — Tier A. DR Congo · Sierra Leone · The Gambia · Angola.
8. **Axian/Yas constellation** (ex-Tigo/Millicom + Telma) — Tier A. Mixx by Yas: Tanzania, Senegal, Togo · MVola (Telma): Madagascar + Comoros†.

---

## PART II — Africa, country by country (challengers beyond the groups)

- **East Africa & Horn:** T-Kash, Equitel (KE) · HaloPesa, AzamPesa, T-Pesa (TZ) · **Telebirr** (ET, 50M+ users) · **EVC Plus / Zaad / Sahal / eDahab** (Somali cluster — the most mobile-money-ized economy on Earth, USD, USSD-native, Tier A) · D-Money, Waafi (DJ) · m-Gurush (SS) · Lumicash, EcoCash Burundi (BI).
- **Central Africa:** DR Congo (M-Pesa/Orange/Airtel/Afrimoney — all P0) · MTN/Airtel (CG) · MTN/Orange/Wave (CM) · Airtel/Moov (GA, TD) · Orange/Moov (CF).
- **West Africa:** Nigeria (OPay, PalmPay, Moniepoint — Tier B agency-banking fintechs; MoMo PSB, SmartCash, Paga) · Ghana (MTN ~90%, Telecel Cash, AT Money, Zeepay) · Côte d'Ivoire (Orange/MTN/Moov/Wave) · Senegal (Wave, Orange, Mixx, e-Money†) · Mali (Orange/Moov/Wave/Sama Money) · Burkina (Orange/Moov/Wave/Coris) · Niger (Airtel/**Zamani Cash**/Flooz) · Guinea (Orange/MTN — YUP dead 2022) · Sierra Leone (Orange/Afrimoney) · Liberia (MTN/Orange) · Gambia (Afrimoney/QMoney/Wave) · Togo (Mixx/Flooz) · Benin (MTN/Moov/Celtiis Cash) · Mauritania (Bankily — Tier B).
- **North Africa:** Egypt (Vodafone Cash, e& money, WE Pay; InstaPay = Tier C) · Morocco (inwi money, Orange, Barid) — Tier B · Tunisia (D17) · Algeria/Libya — nascent/volatile.
- **Southern Africa:** **EcoCash** (ZW, currency-hardened parser needed) · OneMoney, InnBucks · Zamtel Kwacha (ZM) · TNM Mpamba (MW) · M-Pesa/e-Mola (MZ) · Unitel Money/Afrimoney (AO) · Orange/MyZaka (BW) · M-Pesa/EcoCash (LS) · MTN/e-Mali (SZ) · Orange/Airtel/MVola (MG) · my.t money (MU).

---

## PART III — Middle East & South Asia

- **Middle East:** Orange Money/**Zain Cash**/Dinarak/UWallet (JO) · Zain Cash/AsiaHawala (IQ) · Jawali (YE) · JawwalPay/PalPay (PS) · whish money (LB) · **M-Paisa** (AF — one of the oldest deployments), HesabPay (Tier C).
- **South Asia — the second continent of mobile money:**
  - **Bangladesh (W3 anchor):** **bKash** (80M+ — largest single-country MFS on Earth) · **Nagad** (90M+) · **Rocket** (2011 pioneer) · Upay. Tier A/B.
  - **Pakistan:** **JazzCash** (~64% share) · **Easypaisa** · UPaisa†. Tier A/B. (Raast = Tier C state rail.)
  - **Nepal:** eSewa · Khalti · IME Pay. Tier B.
  - **Sri Lanka:** **eZ Cash** (Dialog — classic Tier A) · mCash.
  - **India:** **Excluded by mechanism** — UPI is a bank rail = Tier C. Stated plainly; precision is credibility.
  - **Maldives / Bhutan:** m-Faisaa · Dhiraagu Pay · goBoB. Tier B.

---

## PART IV — Southeast Asia & Pacific

- **Myanmar:** **Wave Money** (35M+ customers, 59k agents; *unrelated to Wave Africa*) · KBZPay · AYA Pay. Sanctions/conflict review is a launch gate.
- **Cambodia:** **Wing** · TrueMoney. Tier B. (Bakong = Tier C rail.)
- **Laos:** u-money · M-Money.
- **Philippines (W4 anchor):** **GCash** (6M+ merchants) · **Maya** · Coins.ph. Tier B — SMS-notification-rich, calibrate.
- **Indonesia:** DANA/OVO/GoPay/LinkAja/ShopeePay — Tier B/C app cluster; adapter-first.
- **Thailand/Malaysia/Vietnam:** TrueMoney · Touch'n Go · Boost · MoMo/Viettel/ZaloPay — Tier B/C; PromptPay/DuitNow/VietQR are Tier C rails.
- **Pacific:** **M-PAiSA** (Fiji) · MyCash · **CellMoni** (Digicel PNG) · M-Tala (Samoa) · Digicel Mobile Money (Tonga/Vanuatu). Classic Tier A remittance-driven.

---

## PART V — Latin America & Caribbean

Region innovates differently (Pix processed $4.6T in 2024 — 2× the entire global mobile-money industry) via central-bank rails and neobanks. KODA targets the **telco-wallet islands**:

- **Haiti (W6 anchor + diaspora corridor):** **MonCash** (Digicel — national backbone) · NatCash. Tier A.
- **Paraguay:** **Tigo Money** (Millicom's LatAm stronghold) · Billetera Personal. Tier A/B.
- **Bolivia / El Salvador / Honduras / Guatemala / Nicaragua:** Tigo Money footprint. Tier A/B. (Chivo, n1co, Tengo — mixed.)
- **Peru:** **BIM** (interoperable pioneer) — Tier A/B. (Yape/Plin = Tier C, noted for scale.)
- **Guyana:** **MMG** (GTT). Tier A.
- **Colombia (Nequi/Daviplata/Movii), Mexico/Brazil/Argentina (Mercado Pago, Spin, Pix, SPEI):** Tier C economy — adapter roadmap only, excluded from claims.

---

## PART VI — What this Atlas means operationally

### 1. The arithmetic of leverage
Eight pan-African group grammars ≈ **70+ country-operator deployments** from ~8 template *families*. Add bKash/Nagad/Rocket, JazzCash/Easypaisa, GCash, Wave Money MM, MonCash, Tigo Money and the Somali cluster, and **~25 template families reach ~85% of the world's telco-led mobile-money volume.** The long tail (†-marked, single-country) flows in via the Community Template Program: 5 sample SMS → ParserAgent draft → canary → live. *(This arithmetic is computed live — `GET /v1/operators` → `families`.)*

### 2. Pack-production priority queue (volume × KODA-fit × strategic corridor)
1. **W1 (home):** M-Pesa CD, Orange CD, Airtel CD, Afrimoney CD ✅ *(precise packs live today)*
2. **W2:** MTN MoMo (GH/UG/CI/CM/RW), M-Pesa (KE/TZ), Airtel East Africa, Orange WAEMU, Wave, Moov
3. **W3:** bKash, Nagad, Rocket, JazzCash, Easypaisa, eSewa, eZ Cash
4. **W4:** GCash, Maya, Wave Money MM, Wing, u-money, M-PAiSA, CellMoni
5. **W5:** EVC Plus, Zaad, eDahab, Telebirr, Vodafone Cash EG, Zain Cash (JO/IQ)
6. **W6:** MonCash, Tigo Money (PY/SV/HN/GT/BO), BIM, MMG
7. **W-open:** everything †-marked, community-driven, forever

### 3. Standing intelligence duty
This Atlas is a living document. Rebrands (Tigo→Mixx), sales (Orange Niger→Zamani), launches (Telebirr-class ramps) and deaths (YUP, SureCash) are tracked continuously; every change is a template-pack ticket, not a strategy meeting. **The registry is the roadmap.**

---
*© 2026 Groupe Nseya Digital / JNN Global Ltd. Entries marked † require live-status verification at template-pack build time; SMS grammar is always calibrated in-market, never assumed. The live source of truth is `app/shared/operators.js` + `GET /v1/operators`.*
