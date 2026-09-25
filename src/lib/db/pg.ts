import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Postgres connection, for hosted deployments.
 *
 * SQLite on local disk is right for development and produces the same
 * auditable ledger, but a serverless filesystem is ephemeral: the database
 * would vanish between requests. Postgres is what the deployed build talks to.
 *
 * Neon's driver speaks HTTP rather than holding a socket, which matters more
 * than it sounds. A serverless function that opens a real Postgres connection
 * per invocation exhausts the connection limit under any real traffic; an HTTP
 * round trip has nothing to exhaust.
 *
 * Selection is by environment alone. `DATABASE_URL` set means Postgres, absent
 * means SQLite, so local development needs no configuration and deployment
 * needs no code change.
 */

/**
 * The connection string, under whichever name it was provided.
 *
 * DATABASE_URL is the documented name and always wins. The rest are here
 * because the Neon and Vercel Postgres integrations provision their own
 * variables, and a project connected through one of those has a perfectly good
 * connection string sitting in the environment under a name this code was not
 * looking for. Refusing to start in that situation is a configuration puzzle,
 * not a safety measure.
 *
 * Pooled names come first. The non-pooled ones are a last resort and say so
 * when used, because an unpooled endpoint works right up until enough
 * invocations overlap and then exhausts the connection limit.
 */
const URL_VARS = [
  'DATABASE_URL',
  'POSTGRES_URL',
  'POSTGRES_PRISMA_URL',
  'DATABASE_URL_UNPOOLED',
  'POSTGRES_URL_NON_POOLING',
] as const;

export function resolveDatabaseUrl(): { url: string; from: string } | null {
  for (const name of URL_VARS) {
    const value = process.env[name]?.trim();
    if (value && /^postgres(ql)?:\/\//.test(value)) return { url: value, from: name };
  }
  return null;
}

export function isPostgres(): boolean {
  return resolveDatabaseUrl() !== null;
}

let sql: NeonQueryFunction<false, false> | null = null;

export function getSql(): NeonQueryFunction<false, false> {
  if (sql) return sql;

  const found = resolveDatabaseUrl();
  if (!found) {
    const present = URL_VARS.filter((n) => process.env[n]);
    throw new Error(
      present.length > 0
        ? `${present.join(', ')} is set but is not a postgres:// or postgresql:// ` +
          'connection string. Check the value was pasted whole.'
        : 'DATABASE_URL is not set. Add a Neon pooled connection string to .env.local, ' +
          'or leave it unset to use local SQLite.',
    );
  }

  // A non-pooled host works, but exhausts connections once more than a handful
  // of serverless invocations overlap. Worth saying out loud rather than
  // letting it surface later as an intermittent failure under load.
  if (!found.url.includes('-pooler.')) {
    console.warn(
      `[db] ${found.from} is not a pooled Neon endpoint. Use the connection ` +
        'string whose host contains "-pooler" for serverless deployments.',
    );
  }

  sql = neon(found.url);
  return sql;
}

/**
 * Creates the schema if it is not already there.
 *
 * Every statement is `IF NOT EXISTS`, so this is safe to run on every cold
 * start and needs no migration tool for a project this size. The SQL lives in
 * its own file so it can be read, reviewed and run by hand against the
 * database without going through the application.
 */
let migrated = false;

export async function migratePg(): Promise<void> {
  if (migrated) return;

  const file = join(process.cwd(), 'src', 'lib', 'db', 'pg-schema.sql');
  const schema = readFileSync(file, 'utf8');

  // The HTTP driver sends one statement per request, so the file is split
  // rather than sent as a single script. Comment-only fragments are dropped.
  // Comments are stripped before the split, not after. Splitting on ';' while
  // comments are still in the text tears any comment containing a semicolon in
  // half and leaves its tail masquerading as SQL.
  const statements = schema
    .split('\n')
    .filter((line) => !line.trim().startsWith('--'))
    .join('\n')
    .split(';')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  // Retried like every other query. Migration runs on the cold start, which is
  // precisely when a connection is most likely to fail to establish, and an
  // unretried failure here turns a transient network blip into a 500 on the
  // first page a visitor loads. Every statement is IF NOT EXISTS, so re-running
  // the file after a partial failure is safe.
  const db = getSql();
  for (const statement of statements) {
    await withRetry(() => db.query(statement));
  }

  migrated = true;
}

/**
 * Retries a query when the connection itself failed.
 *
 * Deliberately narrow. A connect timeout or DNS failure means the request
 * never reached Postgres, so repeating it cannot duplicate a write. Anything
 * the server actually answered — a constraint violation, a syntax error — is
 * rethrown untouched, because retrying those would only hide a real fault.
 */
const TRANSIENT =
  /UND_ERR_CONNECT_TIMEOUT|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up/i;

function isTransient(e: unknown): boolean {
  const err = e as { message?: string; sourceError?: { message?: string }; cause?: unknown };
  const text = [
    err?.message,
    err?.sourceError?.message,
    (err?.cause as { code?: string } | undefined)?.code,
    String((err?.cause as { message?: string } | undefined)?.message ?? ''),
  ]
    .filter(Boolean)
    .join(' ');
  return TRANSIENT.test(text);
}

/**
 * Five attempts, not three, with exponential backoff and jitter.
 *
 * The failure this has to survive is a pool of stale keep-alive sockets, not a
 * single unlucky connect. Neon's driver speaks HTTP, so a long-lived server
 * keeps sockets to the endpoint pooled; when they age out server-side the next
 * few requests fail with "fetch failed" as undici hands out and then discards
 * each dead socket in turn. Three retries 250ms apart burned through that
 * burst and still surfaced a 500 to the page, which is how a sustained crawl
 * produced errors that a restart made disappear.
 *
 * Each failed attempt evicts one socket, so the fix is enough attempts to
 * outlast a small pool, spaced widely enough that the origin can accept a new
 * connection. Worst case is roughly four seconds before giving up, which is
 * bounded and only reachable when the database is genuinely unreachable.
 *
 * Jitter matters because several requests in flight hit the same dead pool at
 * the same moment; without it they retry in lockstep and collide again.
 */
export async function withRetry<T>(fn: () => Promise<T>, attempts = 5): Promise<T> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      if (!isTransient(e)) throw e;
      last = e;
      if (i < attempts - 1) {
        const backoff = 200 * 2 ** i + Math.random() * 150;
        await new Promise((r) => setTimeout(r, backoff));
      }
    }
  }
  throw last;
}

/**
 * Runs a query and returns the rows.
 *
 * Postgres placeholders are `$1`, `$2`; the SQLite store used `?`. Call sites
 * pass the Postgres form, since this module is only reached when Postgres is
 * the active store.
 */
export async function query<T>(text: string, params: unknown[] = []): Promise<T[]> {
  const db = getSql();
  const rows = await withRetry(() => db.query(text, params));
  return rows as T[];
}

/** Runs a query expected to match at most one row. */
export async function queryOne<T>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}
