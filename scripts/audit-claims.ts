/**
 * Reads every stored thesis through the claim parser.
 *
 * The parser decides which conditions a thesis gets, so a mislabelled
 * direction or mechanism produces conditions that test the wrong thing. This
 * prints its reading for each stored statement so the mistakes are visible
 * rather than buried inside an investigation.
 *
 *   npx tsx scripts/audit-claims.ts
 */

import { getDb } from '../src/lib/db/schema';
import { readClaim } from '../src/lib/research/claim';

const rows = getDb()
  .prepare(`SELECT DISTINCT statement, symbol FROM thesis ORDER BY symbol`)
  .all() as { statement: string; symbol: string }[];

const tally: Record<string, number> = {};

for (const r of rows) {
  const c = readClaim(r.statement);
  const key = `${c.direction}/${c.mechanism}`;
  tally[key] = (tally[key] ?? 0) + 1;
  const flag = c.mechanismStated ? ' ' : '?';
  console.log(
    `${flag} ${c.direction.padEnd(4)} ${c.mechanism.padEnd(14)} ${r.statement}`,
  );
}

console.log('\n--- tally ---');
for (const [k, n] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(26)} ${n}`);
}
console.log(`\n${rows.length} theses · "?" means no mechanism was stated`);

export {};
