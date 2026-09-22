import { getDb } from '../src/lib/db/schema';

type Row = Record<string, string | number | null>;

const d = getDb();
const rows = d.prepare(`
  SELECT i.id, t.symbol, t.chain, i.evidence_score, i.coverage
  FROM investigation i JOIN thesis t ON t.id=i.thesis_id ORDER BY i.created_at`).all() as Row[];

for (const r of rows as Row[]) {
  console.log(`\n=== ${r.symbol} / ${r.chain}  score=${r.evidence_score} coverage=${r.coverage}%`);
  const ag = d.prepare(`SELECT agent_id, confidence, stance, coverage FROM agent_reports WHERE investigation_id=?`).all(r.id) as Row[];
  for (const a of ag) console.log(`   ${String(a.agent_id).padEnd(22)} conf=${String(a.confidence).padStart(3)}  stance=${a.stance}`);
  const ev = d.prepare(`SELECT label, display FROM evidence WHERE investigation_id=? AND source='nansen'`).all(r.id) as Row[];
  for (const e of ev) console.log(`      · ${e.label}: ${e.display}`);
}

// Are live requests genuinely distinct per asset?
console.log('\n=== live request sample (proof of real calls) ===');
const req = d.prepare(`SELECT endpoint, request_id, status, credits, ms, at FROM nansen_requests WHERE source='live' ORDER BY at DESC LIMIT 6`).all() as Row[];
for (const q of req) console.log(`   ${String(q.endpoint).padEnd(26)} req=${q.request_id} ${q.status} ${q.credits}cr ${q.ms}ms`);

export {};
