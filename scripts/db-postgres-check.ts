/**
 * Verifies a Neon connection string and creates the schema.
 *
 * Run this before switching the app over. It answers three questions in one
 * go: does the credential work, does the schema apply cleanly, and does the
 * one constraint the ledger depends on actually hold.
 *
 *   npx tsx --env-file=.env.local scripts/db-postgres-check.ts
 */

import { getSql, isPostgres, migratePg, query } from '../src/lib/db/pg';

async function main() {
  if (!isPostgres()) {
    console.error(
      'DATABASE_URL is not set.\n' +
        '  Add the Neon pooled connection string to .env.local:\n' +
        '  DATABASE_URL=postgresql://user:pass@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require',
    );
    process.exit(1);
  }

  console.log('connecting…');
  const started = Date.now();
  const [{ version }] = await query<{ version: string }>('SELECT version()');
  console.log(`connected in ${Date.now() - started}ms`);
  console.log(`  ${version.split(',')[0]}`);

  console.log('\napplying schema…');
  await migratePg();

  const tables = await query<{ table_name: string }>(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public' ORDER BY table_name`,
  );
  console.log(`  ${tables.length} tables: ${tables.map((t) => t.table_name).join(', ')}`);

  // The ledger's honesty rests on this constraint, so prove it is live rather
  // than assuming the CREATE TABLE carried it over.
  console.log('\nchecking the ledger constraint…');
  const db = getSql();
  try {
    await db.query(
      `INSERT INTO nansen_requests
         (id, endpoint, source, ok, status, context, at)
       VALUES ($1, $2, $3, $4, $5, $6, now())`,
      ['constraint-probe', 'probe', 'not-a-real-source', true, 200, 'probe'],
    );
    await db.query(`DELETE FROM nansen_requests WHERE id = 'constraint-probe'`);
    console.error('  FAILED — an invalid source was accepted. The CHECK is missing.');
    process.exit(1);
  } catch {
    console.log("  ok — a source outside 'live'/'cache'/'fixture' is rejected");
  }

  const counts = await query<{ n: string }>(`SELECT COUNT(*) AS n FROM investigation`);
  console.log(`\ninvestigations in this database: ${counts[0].n}`);
  console.log('\nready. Leave DATABASE_URL set to use Postgres, unset it for local SQLite.');
}

main().catch((e) => {
  console.error('\nfailed:', (e as Error).message);
  process.exit(1);
});

export {};
