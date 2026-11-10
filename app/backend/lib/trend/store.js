// Trend Intelligence AI — merchant-scoped persistence on KODA's database.
// Every function binds merchant_id (KODA's tenant = the spec's installation), so a
// query for merchant A can never return B's rows. Uses KODA's shared q helper.
'use strict';
const crypto = require('node:crypto');
const { q } = require('../db');

// canonical content hash of an observation's semantic payload (dedup/conflict).
function evidenceHash(rec) {
  const canon = JSON.stringify([
    rec.observed_at, rec.window_start ?? null, rec.window_end ?? null,
    rec.geography ?? null, rec.locale ?? null, rec.segment ?? null,
    rec.metric ?? null, rec.value ?? null, rec.unit ?? null,
    rec.scaling_scope ?? null, rec.coverage ?? null,
  ]);
  return crypto.createHash('sha256').update(canon).digest('hex');
}

// ── sources ──────────────────────────────────────────────────────────────────
function registerSource(mid, src) {
  q.run(`INSERT INTO trend_sources (merchant_id,source_id,access_path,source_family,quality,stale_after_sec,terms_version,status)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(merchant_id,source_id) DO UPDATE SET
           access_path=excluded.access_path, source_family=excluded.source_family, quality=excluded.quality,
           stale_after_sec=excluded.stale_after_sec, terms_version=excluded.terms_version, status=excluded.status`,
    mid, src.source_id, src.access_path, src.source_family, src.quality ?? 50,
    src.stale_after_sec ?? null, src.terms_version ?? null, src.status ?? 'active');
  return getSource(mid, src.source_id);
}
function getSource(mid, sourceId) {
  return q.get('SELECT * FROM trend_sources WHERE merchant_id=? AND source_id=?', mid, sourceId);
}

// ── observations ─────────────────────────────────────────────────────────────
function getObservation(mid, sourceId, recordId, revision = 1) {
  return q.get('SELECT * FROM trend_observations WHERE merchant_id=? AND source_id=? AND source_record_id=? AND revision=?',
    mid, sourceId, recordId, revision);
}
function insertObservation(mid, sourceId, rec) {
  const hash = rec.evidence_hash || evidenceHash(rec);
  q.run(`INSERT INTO trend_observations
    (merchant_id,source_id,source_family,source_record_id,revision,observed_at,window_start,window_end,
     geography,locale,segment,metric,value,unit,scaling_scope,coverage,evidence_uri,evidence_hash,terms_version)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    mid, sourceId, rec.source_family, rec.source_record_id, rec.revision ?? 1, rec.observed_at,
    rec.window_start ?? null, rec.window_end ?? null, rec.geography ?? null, rec.locale ?? null,
    rec.segment ?? null, rec.metric ?? null, rec.value ?? null, rec.unit ?? null,
    rec.scaling_scope ?? null, rec.coverage ?? null, rec.evidence_uri ?? null, hash, rec.terms_version ?? null);
  return hash;
}
function listObservations(mid, sourceId) {
  return q.all('SELECT * FROM trend_observations WHERE merchant_id=? AND source_id=? ORDER BY window_end', mid, sourceId);
}
function countObservations(mid) {
  return q.get('SELECT COUNT(*) c FROM trend_observations WHERE merchant_id=?', mid).c;
}

// Idempotent batch ingest (spec §16). Exact replay → duplicate; same key + changed
// content hash → conflict (409); unregistered/inactive source → whole batch rejected.
function ingestObservations(mid, sourceId, records) {
  const out = { accepted: 0, duplicate: 0, conflict: 0, rejected: 0, errors: [] };
  const src = getSource(mid, sourceId);
  if (!src || src.status !== 'active') {
    return { ...out, rejected: (records || []).length, errors: [{ index: -1, code: 'unregistered_source', source_id: sourceId }] };
  }
  (Array.isArray(records) ? records : []).forEach((raw, index) => {
    const rec = { ...raw, source_family: raw.source_family || src.source_family, revision: raw.revision ?? 1 };
    if (!rec.source_record_id || !rec.observed_at) { out.rejected++; out.errors.push({ index, code: 'missing_required_fields' }); return; }
    const hash = rec.evidence_hash || evidenceHash(rec);
    const existing = getObservation(mid, sourceId, rec.source_record_id, rec.revision);
    if (existing) {
      if (existing.evidence_hash === hash) out.duplicate++;
      else { out.conflict++; out.errors.push({ index, code: 'content_conflict', source_record_id: rec.source_record_id }); }
      return;
    }
    try { insertObservation(mid, sourceId, { ...rec, evidence_hash: hash }); out.accepted++; }
    catch (e) {
      const now = getObservation(mid, sourceId, rec.source_record_id, rec.revision);
      if (now && now.evidence_hash === hash) out.duplicate++;
      else { out.rejected++; out.errors.push({ index, code: 'insert_failed', message: String(e && e.message || e) }); }
    }
  });
  return out;
}

// ── opportunities + briefs ───────────────────────────────────────────────────
function saveOpportunity(mid, o) {
  const digest = o.input_digest || crypto.createHash('sha256').update(JSON.stringify(o.breakdown || {})).digest('hex').slice(0, 32);
  q.run(`INSERT INTO trend_opportunities (merchant_id,topic_id,window_end,scoring_version,input_digest,opportunity_score,confidence,status,breakdown)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(merchant_id,topic_id,window_end,scoring_version,input_digest) DO UPDATE SET
           opportunity_score=excluded.opportunity_score, confidence=excluded.confidence, status=excluded.status, breakdown=excluded.breakdown`,
    mid, o.topic_id, o.window_end, o.scoring_version ?? 1, digest,
    o.opportunity_score, o.confidence, o.status, JSON.stringify(o.breakdown || {}));
  return q.get('SELECT * FROM trend_opportunities WHERE merchant_id=? AND topic_id=? AND window_end=? AND scoring_version=? AND input_digest=?',
    mid, o.topic_id, o.window_end, o.scoring_version ?? 1, digest);
}
function listOpportunities(mid, { status } = {}) {
  return status
    ? q.all('SELECT * FROM trend_opportunities WHERE merchant_id=? AND status=? ORDER BY created_at DESC', mid, status)
    : q.all('SELECT * FROM trend_opportunities WHERE merchant_id=? ORDER BY created_at DESC', mid);
}
function saveBrief(mid, brief, status = 'draft') {
  q.run(`INSERT INTO trend_briefs (merchant_id,brief_id,brief_version,payload,status) VALUES (?,?,?,?,?)
         ON CONFLICT(merchant_id,brief_id,brief_version) DO UPDATE SET payload=excluded.payload, status=excluded.status`,
    mid, brief.brief_id, brief.brief_version, JSON.stringify(brief), status);
  return brief;
}
// supersede the prior active brief of the same scope, then activate this one.
function activateBrief(mid, briefId, briefVersion) {
  q.run('UPDATE trend_briefs SET status=? WHERE merchant_id=? AND brief_id=? AND status=? AND brief_version<>?',
    'superseded', mid, briefId, 'active', briefVersion);
  q.run('UPDATE trend_briefs SET status=? WHERE merchant_id=? AND brief_id=? AND brief_version=?',
    'active', mid, briefId, briefVersion);
}
function listActiveBriefs(mid) {
  return q.all("SELECT * FROM trend_briefs WHERE merchant_id=? AND status='active'", mid).map((r) => JSON.parse(r.payload));
}

module.exports = {
  evidenceHash, registerSource, getSource,
  getObservation, insertObservation, listObservations, countObservations, ingestObservations,
  saveOpportunity, listOpportunities, saveBrief, activateBrief, listActiveBriefs,
};
