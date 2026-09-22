import { getDb } from './schema';
import { getSql, isPostgres, migratePg, withRetry } from './pg';

/**
 * One query interface over both stores.
 *
 * The point is that every caller above this file keeps working unchanged. The
 * store, the monitor and the pages were written against SQLite, and this makes
 * Postgres answer in the same shapes rather than making thirty call sites
 * learn a second dialect.
 *
 * Two things have to be reconciled.
 *
 * **Placeholders.** SQL is written with `?`, as it always was here. Postgres
 * wants `$1, $2`, so they are rewritten on the way out.
 *
 * **Types.** SQLite has no date, boolean or JSON type, so callers expect ISO
 * strings, 0/1 and JSON text — `JSON.parse(c.history)` and `e.agrees === 1`
 * appear throughout. Postgres correctly returns Date, boolean and parsed
 * JSONB, so results are converted back. Measured, not assumed: a probe against
 * the live database confirmed exactly which columns come back in which form.
 *
 * The one case this cannot fix is `COUNT`/`SUM`, which Postgres returns as
 * int8 and the driver hands over as a string to avoid precision loss. A
 * blanket "numeric-looking strings become numbers" rule would corrupt
 * addresses and ids, so aggregate queries carry an explicit `::int` cast
 * instead. `countCast()` writes it for the active backend.
 */

export type Param = unknown;

export interface Stmt {
  text: string;
  params?: Param[];
}

/** `?` placeholders become `$1, $2, …` for Postgres. */
function toPg(text: string): string {
  let n = 0;
  return text.replace(/\?/g, () => `$${++n}`);
}

/**
 * Converts a Postgres value into the shape SQLite would have returned.
 *
 * Booleans become 0/1, dates become ISO strings, and JSONB comes back as text
 * because callers parse it themselves.
 */
function normalise(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (typeof value === 'object') return JSON.stringify(value);
  return value;
}

function normaliseRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(row)) out[key] = normalise(row[key]);
  return out as T;
}

let ready = false;

/** Applies the Postgres schema once per process. */
async function ensure(): Promise<void> {
  if (!isPostgres() || ready) return;
  await migratePg();
  ready = true;
}

export async function all<T>(text: string, params: Param[] = []): Promise<T[]> {
  if (!isPostgres()) {
    return getDb().prepare(text).all(...(params as never[])) as T[];
  }
  await ensure();
  const rows = (await withRetry(() =>
    getSql().query(toPg(text), params),
  )) as Record<string, unknown>[];
  return rows.map((r) => normaliseRow<T>(r));
}

export async function one<T>(text: string, params: Param[] = []): Promise<T | null> {
  if (!isPostgres()) {
    return (getDb().prepare(text).get(...(params as never[])) as T) ?? null;
  }
  const rows = await all<T>(text, params);
  return rows[0] ?? null;
}

export async function run(text: string, params: Param[] = []): Promise<void> {
  if (!isPostgres()) {
    getDb().prepare(text).run(...(params as never[]));
    return;
  }
  await ensure();
  await withRetry(() => getSql().query(toPg(text), params));
}

/**
 * Runs several statements atomically.
 *
 * Both backends need this, for different reasons: better-sqlite3 transactions
 * must be synchronous, and the Neon HTTP driver has its own transaction call
 * rather than session-level BEGIN/COMMIT. Callers build the list and stay out
 * of both.
 */
export async function runTx(stmts: Stmt[]): Promise<void> {
  if (stmts.length === 0) return;

  if (!isPostgres()) {
    const db = getDb();
    const prepared = stmts.map((s) => ({
      stmt: db.prepare(s.text),
      params: (s.params ?? []) as never[],
    }));
    db.transaction(() => {
      for (const p of prepared) p.stmt.run(...p.params);
    })();
    return;
  }

  await ensure();
  const db = getSql();
  await withRetry(() =>
    db.transaction(stmts.map((s) => db.query(toPg(s.text), s.params ?? []))),
  );
}

/**
 * An aggregate expression that yields a number on both backends.
 *
 * SQLite returns a number already; Postgres returns int8, which arrives as a
 * string. The cast keeps every call site free of backend checks.
 */
export function countCast(expr: string): string {
  return isPostgres() ? `(${expr})::int` : expr;
}

/** Where a query needs genuinely different SQL, this picks the right one. */
export function pick<T>(sqlite: T, postgres: T): T {
  return isPostgres() ? postgres : sqlite;
}
