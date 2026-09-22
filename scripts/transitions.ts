import { getDb } from '../src/lib/db/schema';
type R = Record<string, string | number | null>;
const d = getDb();

const t = d.prepare(`
  SELECT e.at, e.kind, e.from_status, e.to_status, e.wire_key, e.detail, th.symbol
  FROM monitoring_events e
  JOIN investigation i ON i.id = e.investigation_id
  JOIN thesis th ON th.id = i.thesis_id
  WHERE e.kind IN ('transition','condition_change')
  ORDER BY e.at DESC LIMIT 12`).all() as R[];

console.log(`state changes recorded: ${t.length}`);
for (const r of t) {
  const head = r.kind === 'transition'
    ? `${r.from_status} → ${r.to_status}`
    : `${r.wire_key}`;
  console.log(`  [${String(r.symbol).padEnd(6)}] ${String(r.kind).padEnd(17)} ${head}`);
  console.log(`            ${String(r.detail).slice(0, 130)}`);
}

const checks = d.prepare(`SELECT COUNT(*) n FROM monitoring_events WHERE kind='check'`).get() as R;
const jobs = d.prepare(`SELECT COUNT(*) n FROM monitoring_jobs WHERE state='ACTIVE'`).get() as R;
console.log(`\nactive jobs: ${jobs.n} · checks logged: ${checks.n}`);
