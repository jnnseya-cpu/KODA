// Trend Intelligence AI — Growth Brief v1 contract (spec §6 + Appendix A + §507).
// Hand-written, zero-dependency validator for the CLOSED schema the effective-brief
// endpoint returns, plus the runtime rules a schema-valid object must still pass.
'use strict';

const CHANNELS = ['seo', 'organic_social', 'sales_enablement', 'owned_placement', 'lifecycle', 'paid'];
const ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
const MARKET_RE = /^[A-Z]{2}$/;
const UTC_RE = /Z$/;

const REQUIRED = [
  'schema_version', 'brief_id', 'brief_version', 'tenant_id', 'platform_id', 'market', 'locale',
  'topic_id', 'opportunity_score', 'confidence', 'valid_from', 'expires_at', 'evidence_ids',
  'audience', 'intent', 'approved_claim_ids', 'cta_id', 'allowed_channels', 'prohibited_claims',
  'objective', 'experiment_id', 'policy_version',
];
const ALLOWED = new Set(REQUIRED); // closed object: no field outside the required set

const isId = (v) => typeof v === 'string' && ID_RE.test(v);
const isScore = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 100;
const isUtc = (v) => typeof v === 'string' && UTC_RE.test(v) && !Number.isNaN(Date.parse(v));
const isShort = (v) => typeof v === 'string' && v.length >= 1 && v.length <= 500;
const isPosInt = (v) => Number.isInteger(v) && v >= 1;
function isIdList(v, { min = 0, max = 64 } = {}) {
  return Array.isArray(v) && v.length >= min && v.length <= max && v.every(isId) && new Set(v).size === v.length;
}

// Validate the closed schema (Appendix A). Returns { ok, errors: [{field, code}] }.
function validateBrief(obj) {
  const errors = [];
  const bad = (field, code) => errors.push({ field, code });
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) return { ok: false, errors: [{ field: '.', code: 'not_an_object' }] };

  for (const k of Object.keys(obj)) if (!ALLOWED.has(k)) bad(k, 'unknown_field');     // additionalProperties:false
  for (const k of REQUIRED) if (!(k in obj)) bad(k, 'required');

  if ('schema_version' in obj && obj.schema_version !== 1) bad('schema_version', 'must_be_1');
  if ('brief_id' in obj && !isId(obj.brief_id)) bad('brief_id', 'bad_id');
  if ('brief_version' in obj && !isPosInt(obj.brief_version)) bad('brief_version', 'bad_integer');
  if ('tenant_id' in obj && !isId(obj.tenant_id)) bad('tenant_id', 'bad_id');
  if ('platform_id' in obj && !isId(obj.platform_id)) bad('platform_id', 'bad_id');
  if ('market' in obj && !(typeof obj.market === 'string' && MARKET_RE.test(obj.market))) bad('market', 'bad_market');
  if ('locale' in obj && !(typeof obj.locale === 'string' && obj.locale.length >= 2 && obj.locale.length <= 35)) bad('locale', 'bad_locale');
  if ('topic_id' in obj && !isId(obj.topic_id)) bad('topic_id', 'bad_id');
  if ('opportunity_score' in obj && !isScore(obj.opportunity_score)) bad('opportunity_score', 'bad_score');
  if ('confidence' in obj && !isScore(obj.confidence)) bad('confidence', 'bad_score');
  if ('valid_from' in obj && !isUtc(obj.valid_from)) bad('valid_from', 'bad_utc');
  if ('expires_at' in obj && !isUtc(obj.expires_at)) bad('expires_at', 'bad_utc');
  if ('evidence_ids' in obj && !isIdList(obj.evidence_ids, { min: 1 })) bad('evidence_ids', 'bad_id_list');
  if ('audience' in obj && !isShort(obj.audience)) bad('audience', 'bad_short_text');
  if ('intent' in obj && !isShort(obj.intent)) bad('intent', 'bad_short_text');
  if ('approved_claim_ids' in obj && !isIdList(obj.approved_claim_ids)) bad('approved_claim_ids', 'bad_id_list');
  if ('cta_id' in obj && !isId(obj.cta_id)) bad('cta_id', 'bad_id');
  if ('allowed_channels' in obj) {
    const c = obj.allowed_channels;
    if (!Array.isArray(c) || c.length < 1 || c.length > 6 || new Set(c).size !== c.length || !c.every((x) => CHANNELS.includes(x)))
      bad('allowed_channels', 'bad_channel_set');
  }
  if ('prohibited_claims' in obj) {
    const p = obj.prohibited_claims;
    if (!Array.isArray(p) || p.length > 32 || new Set(p).size !== p.length || !p.every(isShort)) bad('prohibited_claims', 'bad_claim_list');
  }
  if ('objective' in obj && !isShort(obj.objective)) bad('objective', 'bad_short_text');
  if ('experiment_id' in obj && !isId(obj.experiment_id)) bad('experiment_id', 'bad_id');
  if ('policy_version' in obj && !isPosInt(obj.policy_version)) bad('policy_version', 'bad_integer');

  return { ok: errors.length === 0, errors };
}

// Runtime rules beyond JSON Schema (spec §507). A schema-valid brief can still fail.
// ctx: { now?: Date|string, installedLocales?: string[], activeMarket?: string, channel?: string }
function checkRuntime(brief, ctx = {}) {
  const errors = [];
  const now = ctx.now ? new Date(ctx.now) : new Date();
  const vf = new Date(brief.valid_from), ex = new Date(brief.expires_at);
  if (!(vf < ex)) errors.push({ field: 'valid_from', code: 'not_before_expiry' });
  if (!(vf <= now && now < ex)) errors.push({ field: 'window', code: 'not_currently_valid' });
  if (ctx.channel && !(brief.allowed_channels || []).includes(ctx.channel)) errors.push({ field: 'channel', code: 'channel_not_allowed' });
  if (Array.isArray(ctx.installedLocales) && ctx.installedLocales.length && !ctx.installedLocales.includes(brief.locale))
    errors.push({ field: 'locale', code: 'locale_not_installed' });
  if (ctx.activeMarket && !marketMatches(brief.market, ctx.activeMarket)) errors.push({ field: 'market', code: 'market_mismatch' });
  return { ok: errors.length === 0, errors };
}

// ISO alpha-2 market match. ZZ is explicitly global and NEVER matches a country-
// targeted lookup by default (spec §301). A country query matches only that country.
function marketMatches(briefMarket, queryMarket) {
  if (briefMarket === queryMarket) return true;
  return false; // ZZ brief does not satisfy a country query; country brief doesn't satisfy ZZ
}

const isFresh = (brief, now = new Date()) => {
  const vf = new Date(brief.valid_from), ex = new Date(brief.expires_at);
  const t = new Date(now);
  return vf <= t && t < ex;
};

// Resolve ONE effective brief from a candidate set for a lookup scope.
// Returns the newest active, schema-valid, fresh, in-scope brief, or null (→ 204/baseline).
function resolveEffective(briefs, q) {
  const now = q.now ? new Date(q.now) : new Date();
  const eligible = (briefs || []).filter((b) =>
    (b.status === undefined || b.status === 'active') &&
    marketMatches(b.market, q.market) &&
    b.locale === q.locale &&
    b.topic_id === q.topic_id &&
    (b.allowed_channels || []).includes(q.channel) &&
    isFresh(b, now) &&
    validateBrief(b).ok);
  if (!eligible.length) return null;
  eligible.sort((a, b) => b.brief_version - a.brief_version);
  return eligible[0];
}

module.exports = { CHANNELS, validateBrief, checkRuntime, isFresh, marketMatches, resolveEffective };
