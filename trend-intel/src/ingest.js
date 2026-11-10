// Trend Intelligence AI — scoped observation ingest (spec §16 observations:batch).
// Idempotent by (installation, source, source_record, revision): an exact replay is
// a duplicate (counted, not re-inserted); the same key with a DIFFERENT content hash
// is a conflict (409). Unregistered sources are rejected. Isolation comes from the
// scoped accessor — ingest never sees another installation's rows.
'use strict';
const { evidenceHash } = require('./db');

// ingest(scopedDb, sourceId, records[]) -> { accepted, duplicate, conflict, rejected, errors[] }
function ingestObservations(sdb, sourceId, records) {
  const out = { accepted: 0, duplicate: 0, conflict: 0, rejected: 0, errors: [] };
  const src = sdb.getSource(sourceId);
  if (!src || src.status !== 'active') {
    // whole batch rejected against an unregistered/inactive source (spec §16)
    return { ...out, rejected: (records || []).length, errors: [{ index: -1, code: 'unregistered_source', source_id: sourceId }] };
  }
  records = Array.isArray(records) ? records : [];
  records.forEach((raw, index) => {
    const rec = { ...raw, source_family: raw.source_family || src.source_family, revision: raw.revision ?? 1 };
    if (!rec.source_record_id || !rec.observed_at) {
      out.rejected++; out.errors.push({ index, code: 'missing_required_fields' }); return;
    }
    const hash = rec.evidence_hash || evidenceHash(rec);
    const existing = sdb.getObservation(sourceId, rec.source_record_id, rec.revision);
    if (existing) {
      if (existing.evidence_hash === hash) { out.duplicate++; }          // exact replay
      else { out.conflict++; out.errors.push({ index, code: 'content_conflict', source_record_id: rec.source_record_id }); }
      return;
    }
    try { sdb.insertObservation(sourceId, { ...rec, evidence_hash: hash }); out.accepted++; }
    catch (e) {
      // a race could turn an insert into a duplicate; re-resolve rather than 500
      const now = sdb.getObservation(sourceId, rec.source_record_id, rec.revision);
      if (now && now.evidence_hash === hash) out.duplicate++;
      else { out.rejected++; out.errors.push({ index, code: 'insert_failed', message: String(e && e.message || e) }); }
    }
  });
  return out;
}

module.exports = { ingestObservations };
