/**
 * Copies the local SQLite database into Neon.
 *
 * The two schemas are deliberately not identical. SQLite had no date, boolean
 * or JSON type, so timestamps were ISO strings, booleans were 0/1 and JSON was
 * text. Postgres has all three, and the new schema also adds CHECK constraints
 * that SQLite never enforced. Every value is converted on the way across, and
 * a row carrying a value outside an allowed set is reported rather than
 * silently dropped, because a ledger that quietly loses rows is worse than one
 * that fails loudly.
 *
 * Tables are copied parents first so foreign keys resolve. Re-running is safe:
 * each table is cleared before it is filled.
 *
 *   npx tsx --env-file=.env.local scripts/db-migrate-to-postgres.ts [--dry]
 */

import { getDb } from '../src/lib/db/schema';
import { getSql, isPostgres, migratePg, query } from '../src/lib/db/pg';

const DRY = process.argv.includes('--dry');

/** Neon's HTTP driver sends one request per statement, so rows go in batches. */
const BATCH = 250;

type Row = Record<string, unknown>;

interface TableSpec {
  name: string;
  /** Columns, in the order the INSERT lists them. */
  columns: string[];
  bools?: string[];
  dates?: string[];
  json?: string[];
}

// Parents first: a child row inserted before its parent violates the key.
const TABLES: TableSpec[] = [
  {
    name: 'thesis',
    columns: ['id', 'statement', 'symbol', 'name', 'chain', 'address', 'is_native', 'horizon', 'created_at'],
    bools: ['is_native'],
    dates: ['created_at'],
  },
  {
    name: 'investigation',
    columns: ['id', 'thesis_id', 'status', 'evidence_score', 'coverage', 'support_count', 'challenge_count', 'strongest_signal', 'biggest_contradiction', 'credits_spent', 'live_calls', 'term_structure', 'created_at', 'updated_at'],
    dates: ['created_at', 'updated_at'],
    json: ['term_structure'],
  },
  {
    name: 'agent_reports',
    columns: ['id', 'investigation_id', 'agent_id', 'name', 'subtitle', 'stance', 'confidence', 'coverage', 'summary', 'weight'],
  },
  {
    name: 'evidence',
    columns: ['id', 'investigation_id', 'agent_report_id', 'label', 'display', 'value', 'tone', 'endpoint', 'field', 'request_id', 'credits_used', 'redistribution', 'source', 'source_name', 'source_url', 'agrees', 'fetched_at'],
    bools: ['agrees'],
    dates: ['fetched_at'],
  },
  {
    name: 'falsification_conditions',
    columns: ['id', 'investigation_id', 'wire_key', 'claim', 'endpoint', 'field', 'unit', 'comparator', 'threshold', 'sustain', 'severity', 'status', 'current_value', 'proximity', 'history', 'breach_streak', 'updated_at'],
    dates: ['updated_at'],
    json: ['history'],
  },
  {
    name: 'debate_messages',
    columns: ['id', 'investigation_id', 'agent_id', 'challenges', 'body', 'evidence', 'seq', 'at'],
    dates: ['at'],
    json: ['evidence'],
  },
  {
    name: 'nansen_requests',
    columns: ['id', 'investigation_id', 'monitoring_job_id', 'endpoint', 'source', 'ok', 'status', 'credits', 'request_id', 'remaining', 'ms', 'context', 'error', 'at'],
    bools: ['ok'],
    dates: ['at'],
  },
  {
    name: 'monitoring_jobs',
    columns: ['id', 'investigation_id', 'state', 'interval_minutes', 'checks_run', 'last_checked_at', 'next_check_at', 'created_at'],
    dates: ['last_checked_at', 'next_check_at', 'created_at'],
  },
  {
    name: 'monitoring_events',
    columns: ['id', 'job_id', 'investigation_id', 'kind', 'from_status', 'to_status', 'wire_key', 'detail', 'credits', 'live_calls', 'at'],
    dates: ['at'],
  },
];

function convert(row: Row, spec: TableSpec): unknown[] {
  return spec.columns.map((col) => {
    const v = row[col];
    if (v === null || v === undefined) return null;

    if (spec.bools?.includes(col)) return Boolean(v);

    if (spec.dates?.includes(col)) {
      const d = new Date(String(v));
      // A timestamp SQLite accepted as text may not be a real date. Passing
      // null keeps the row rather than failing the whole batch on one value.
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    }

    if (spec.json?.includes(col)) {
      const text = String(v);
      try {
        JSON.parse(text);
        return text; // valid JSON; Postgres casts it into jsonb
      } catch {
        return null;
      }
    }

    return v;
  });
}

async function copyTable(spec: TableSpec): Promise<{ read: number; written: number }> {
  const rows = getDb().prepare(`SELECT * FROM ${spec.name}`).all() as Row[];
  if (rows.length === 0) return { read: 0, written: 0 };
  if (DRY) return { read: rows.length, written: 0 };

  const db = getSql();
  await db.query(`DELETE FROM ${spec.name}`);

  const cols = spec.columns.join(', ');
  let written = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const params: unknown[] = [];
    const tuples: string[] = [];

    for (const row of chunk) {
      const values = convert(row, spec);
      const placeholders = values.map((_, j) => {
        const n = params.length + j + 1;
        // jsonb columns need the cast; everything else infers fine.
        return spec.json?.includes(spec.columns[j]) ? `$${n}::jsonb` : `$${n}`;
      });
      tuples.push(`(${placeholders.join(', ')})`);
      params.push(...values);
    }

    await db.query(
      `INSERT INTO ${spec.name} (${cols}) VALUES ${tuples.join(', ')}`,
      params,
    );
    written += chunk.length;
    process.stdout.write(`\r  ${spec.name.padEnd(26)} ${written}/${rows.length}`);
  }

  process.stdout.write('\r');
  return { read: rows.length, written };
}

async function main() {
  if (!isPostgres()) {
    console.error('DATABASE_URL is not set — nothing to migrate into.');
    process.exit(1);
  }

  console.log(DRY ? 'dry run — nothing will be written\n' : 'migrating SQLite → Neon\n');
  await migratePg();

  let totalRead = 0;
  let totalWritten = 0;

  for (const spec of TABLES) {
    try {
      const { read, written } = await copyTable(spec);
      totalRead += read;
      totalWritten += written;
      const status = DRY ? `${read} row(s) to copy` : `${written}/${read}`;
      console.log(`  ${spec.name.padEnd(26)} ${status}`);
    } catch (e) {
      console.log(`  ${spec.name.padEnd(26)} FAILED`);
      console.error(`    ${(e as Error).message}`);
      process.exit(1);
    }
  }

  console.log(`\n${totalWritten}/${totalRead} rows copied`);

  if (!DRY) {
    // The ledger is the buildathon's evidence, so verify it landed intact
    // rather than trusting the insert count.
    const live = await query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM nansen_requests WHERE source = 'live'`,
    );
    const localLive = (
      getDb()
        .prepare(`SELECT COUNT(*) AS n FROM nansen_requests WHERE source = 'live'`)
        .get() as { n: number }
    ).n;
    console.log(`live calls — sqlite ${localLive}, neon ${live[0].n}`);
    if (Number(live[0].n) !== localLive) {
      console.error('MISMATCH: the ledger did not copy completely.');
      process.exit(1);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
