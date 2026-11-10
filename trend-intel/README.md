# Trend Intelligence AI — reference service (KODA stack)

A keyless, **industry-neutral** growth-intelligence control layer, built per
`Trend_Intelligence_AI_Build_Spec` v2.3. It reads demand signals, scores each
opportunity's **opportunity** and **confidence**, emits a versioned **Growth
Brief**, lets existing SEO/marketing agents adapt at run time, applies approved
reversible changes to an owned surface, measures the result, and continues,
revises or rolls back.

## Why it lives here, and what it does NOT touch

This is a **separate, self-contained module** implemented in the same stack KODA
uses — **zero-dependency Node (`node:http` + `node:sqlite` + `node:crypto`)** —
reusing KODA's proven primitives (durable outbox, idempotency keys, approval
bound to a canonical payload hash, per-tenant row scoping, deterministic/AI-mock
fallback, append-only audit).

It is deliberately **outside KODA's `app/` build context**: nothing here is
copied into the KODA Docker image or served by the KODA app, so it **cannot
change or break the locked KODA platform**. The core carries **no** default
brand, country, language, industry or channel — all of that is per-installation
profile/adapter data (spec portability rule, §14).

## Design pillars (from the spec)

- **Keyless core (§2).** The full workflow — read → score → brief → draft →
  approve → apply (owned surface) → measure → rollback — runs with **no new
  third-party API key**. Inference is host-AI reuse, bundled local inference, or
  deterministic templates. Signals are first-party events, imports, or permitted
  key-free public feeds.
- **Deterministic-first.** Detection, scoring, templates, review and export work
  with no model at all; AI only ever returns schema-validated proposals.
- **Safety by contract (§6, §18).** Closed schemas, server-resolved IDs,
  approval bound to payload hash + target revision, compare-and-set writes,
  outbox + at-least-once delivery, reversible owned-surface writes only in v1.

## Status

| Increment | Scope | State |
|---|---|---|
| **1. Scoring core** | §5/§17 deterministic detection, lift/z, opportunity + confidence, thresholds | ✅ **done** — 37 tests incl. TI-03 (86.25 / 83.5) |
| 2. Persistence | `node:sqlite` schema + tenant isolation, idempotent ingest (`observations:batch`) | next |
| 3. Contracts | Growth Brief v1 schema validation, effective-brief resolution | next |
| 4. Actions | propose → approve (hash-bound) → execute (outbox) → rollback; fake CMS adapter | next |
| 5. Native surface | owned-page renderer + first-party outcome capture; deterministic drafts | next |
| 6. Conformance | TI-01…TI-22 harness; G1 clean-install gate (§20) | next |

Mapped to the spec's build gates **G1–G5** (§20) and the §22 first-ticket (two
synthetic installations: subscription `en-CA` / storefront `fr-FR`).

## Run

```bash
cd trend-intel
npm test          # deterministic scoring conformance (no deps, no network)
```

Requires Node ≥ 22.5 (for `node:sqlite` in later increments). Zero npm
dependencies, by design.
