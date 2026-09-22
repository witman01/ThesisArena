import { getDb } from '../src/lib/db/schema';
type R = Record<string, string | number | null>;
const rows = getDb().prepare(`
  SELECT i.id, t.symbol, t.statement, i.status, i.evidence_score, i.coverage,
         (SELECT COUNT(*) FROM monitoring_events e WHERE e.investigation_id=i.id AND e.kind='transition') AS moves
  FROM investigation i JOIN thesis t ON t.id=i.thesis_id
  WHERE i.status='INVALIDATED' ORDER BY i.updated_at DESC`).all() as R[];
for (const r of rows) {
  console.log(`${r.id}  ${String(r.symbol).padEnd(6)} score=${r.evidence_score} coverage=${r.coverage}% transitions=${r.moves}`);
  console.log(`   "${r.statement}"`);
}
