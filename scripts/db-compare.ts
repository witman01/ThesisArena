/**
 * Row counts in both stores, side by side.
 *
 * The schema living in Postgres and the data living in Postgres are separate
 * milestones, and it is easy to assume the second happened because the first
 * did. This prints the gap.
 *
 *   npx tsx --env-file=.env.local scripts/db-compare.ts
 */

import { getDb } from '../src/lib/db/schema';
import { isPostgres, query } from '../src/lib/db/pg';

const TABLES = [
  'thesis', 'investigation', 'agent_reports', 'evidence',
  'falsification_conditions', 'debate_messages', 'nansen_requests',
  'monitoring_jobs', 'monitoring_events',
];

async function main() {
  const sqlite = getDb();
  const local: Record<string, number> = {};
  for (const t of TABLES) {
    local[t] = (sqlite.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get() as { n: number }).n;
  }

  const remote: Record<string, number> = {};
  if (isPostgres()) {
    for (const t of TABLES) {
      const rows = await query<{ n: string }>(`SELECT COUNT(*) AS n FROM ${t}`);
      remote[t] = Number(rows[0].n);
    }
  }

  console.log(`${'table'.padEnd(26)} ${'sqlite'.padStart(8)} ${'neon'.padStart(8)}`);
  console.log('-'.repeat(46));
  for (const t of TABLES) {
    const l = local[t].toLocaleString().padStart(8);
    const r = isPostgres() ? remote[t].toLocaleString().padStart(8) : '   (n/a)';
    console.log(`${t.padEnd(26)} ${l} ${r}`);
  }

  const localTotal = Object.values(local).reduce((a, b) => a + b, 0);
  const remoteTotal = Object.values(remote).reduce((a, b) => a + b, 0);
  console.log('-'.repeat(46));
  console.log(`${'total rows'.padEnd(26)} ${localTotal.toLocaleString().padStart(8)} ${remoteTotal.toLocaleString().padStart(8)}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
export {};
