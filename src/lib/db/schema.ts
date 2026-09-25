import Database from 'better-sqlite3';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Persistence for ThesisArena.
 *
 * SQLite on local disk. The demo has to survive a refresh and produce an
 * auditable request ledger; a relational store does both without adding an
 * external service. Note for deployment: a serverless filesystem is ephemeral,
 * so a hosted build needs Turso/Postgres behind this same interface.
 */

const DB_PATH = process.env.THESISARENA_DB ?? 'data/thesisarena.db';

let db: Database.Database | null = null;

/**
 * True on a platform whose filesystem SQLite cannot live on.
 *
 * Vercel and Netlify both set their own marker; `NODE_ENV` alone is not enough,
 * because a production build run on a real server is perfectly able to use
 * SQLite and should keep working.
 */
function isServerless(): boolean {
  return Boolean(process.env.VERCEL || process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

export function getDb(): Database.Database {
  if (db) return db;

  // Reaching SQLite on a serverless host means DATABASE_URL was never set, so
  // the backend selector fell through to the local file. Saying that is worth
  // a few lines: the unguarded failure was "ENOENT: no such file or directory,
  // mkdir 'data'" from inside a bundled chunk, which names neither the missing
  // variable nor the reason the directory cannot be created.
  if (isServerless()) {
    throw new Error(
      'No Postgres connection string found, so persistence fell back to SQLite ' +
        'on local disk, and this platform has no writable filesystem. Add your ' +
        'Neon pooled connection string (the host contains "-pooler") as ' +
        "DATABASE_URL in the project's environment variables, for every " +
        'environment you deploy, then redeploy. GET /api/health reports what ' +
        'this instance can actually see, without printing any value.',
    );
  }

  const dir = dirname(DB_PATH);
  if (dir && dir !== '.' && !existsSync(dir)) mkdirSync(dir, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(d: Database.Database): void {
  d.exec(`
    CREATE TABLE IF NOT EXISTS thesis (
      id            TEXT PRIMARY KEY,
      statement     TEXT NOT NULL,
      symbol        TEXT NOT NULL,
      name          TEXT,
      chain         TEXT NOT NULL,
      address       TEXT NOT NULL,
      is_native     INTEGER NOT NULL DEFAULT 0,
      horizon       TEXT NOT NULL DEFAULT '7-30 days',
      created_at    TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS investigation (
      id             TEXT PRIMARY KEY,
      thesis_id      TEXT NOT NULL REFERENCES thesis(id) ON DELETE CASCADE,
      status         TEXT NOT NULL,          -- SUPPORTED | CHALLENGED | MIXED | UNDER_STRESS | INVALIDATED
      evidence_score INTEGER NOT NULL,
      coverage       INTEGER NOT NULL,
      support_count  INTEGER NOT NULL,
      challenge_count INTEGER NOT NULL,
      strongest_signal TEXT,
      biggest_contradiction TEXT,
      credits_spent  INTEGER NOT NULL DEFAULT 0,
      live_calls     INTEGER NOT NULL DEFAULT 0,
      term_structure TEXT,                   -- JSON
      created_at     TEXT NOT NULL,
      updated_at     TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_reports (
      id               TEXT PRIMARY KEY,
      investigation_id TEXT NOT NULL REFERENCES investigation(id) ON DELETE CASCADE,
      agent_id         TEXT NOT NULL,
      name             TEXT NOT NULL,
      subtitle         TEXT,
      stance           TEXT NOT NULL,
      confidence       INTEGER NOT NULL,
      coverage         REAL NOT NULL DEFAULT 0,
      summary          TEXT NOT NULL,
      weight           REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS evidence (
      id               TEXT PRIMARY KEY,
      investigation_id TEXT NOT NULL REFERENCES investigation(id) ON DELETE CASCADE,
      agent_report_id  TEXT REFERENCES agent_reports(id) ON DELETE CASCADE,
      label            TEXT NOT NULL,
      display          TEXT NOT NULL,
      value            REAL,
      tone             TEXT NOT NULL,
      -- provenance
      endpoint         TEXT NOT NULL,
      field            TEXT NOT NULL,
      request_id       TEXT,
      credits_used     INTEGER NOT NULL DEFAULT 0,
      redistribution   TEXT NOT NULL,
      -- 'nansen' or 'independent': these must never be presented as the same thing
      source           TEXT NOT NULL DEFAULT 'nansen',
      source_name      TEXT,
      source_url       TEXT,
      agrees           INTEGER,
      fetched_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS falsification_conditions (
      id               TEXT PRIMARY KEY,
      investigation_id TEXT NOT NULL REFERENCES investigation(id) ON DELETE CASCADE,
      wire_key         TEXT NOT NULL,        -- stable across re-checks
      claim            TEXT NOT NULL,
      endpoint         TEXT NOT NULL,
      field            TEXT NOT NULL,
      unit             TEXT NOT NULL,
      comparator       TEXT NOT NULL,
      threshold        REAL NOT NULL,
      sustain          TEXT NOT NULL,
      severity         TEXT NOT NULL,
      status           TEXT NOT NULL,        -- holding | stressed | tripped
      current_value    REAL NOT NULL,
      proximity        REAL NOT NULL,
      history          TEXT NOT NULL,        -- JSON number[]
      breach_streak    INTEGER NOT NULL DEFAULT 0,
      updated_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS debate_messages (
      id               TEXT PRIMARY KEY,
      investigation_id TEXT NOT NULL REFERENCES investigation(id) ON DELETE CASCADE,
      agent_id         TEXT NOT NULL,
      challenges       TEXT,
      body             TEXT NOT NULL,
      evidence         TEXT NOT NULL,        -- JSON AgentBullet[]
      seq              INTEGER NOT NULL,
      at               TEXT NOT NULL
    );

    -- The audit trail for the buildathon's 1,000+ call requirement.
    -- The "source" column separates a real network call from a cache hit or a
    -- fixture replay: only 'live' rows count, and the CHECK constraint below
    -- enforces that rather than leaving it to the reader.
    CREATE TABLE IF NOT EXISTS nansen_requests (
      id               TEXT PRIMARY KEY,
      investigation_id TEXT REFERENCES investigation(id) ON DELETE SET NULL,
      monitoring_job_id TEXT,
      endpoint         TEXT NOT NULL,
      source           TEXT NOT NULL CHECK (source IN ('live','cache','fixture')),
      ok               INTEGER NOT NULL,
      status           INTEGER NOT NULL,
      credits          INTEGER NOT NULL DEFAULT 0,
      request_id       TEXT,
      remaining        INTEGER,
      ms               INTEGER NOT NULL DEFAULT 0,
      context          TEXT NOT NULL,        -- investigation | monitoring | search
      error            TEXT,
      at               TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monitoring_jobs (
      id               TEXT PRIMARY KEY,
      investigation_id TEXT NOT NULL REFERENCES investigation(id) ON DELETE CASCADE,
      state            TEXT NOT NULL,        -- ACTIVE | PAUSED | STOPPED
      interval_minutes INTEGER NOT NULL DEFAULT 15,
      checks_run       INTEGER NOT NULL DEFAULT 0,
      last_checked_at  TEXT,
      next_check_at    TEXT,
      created_at       TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS monitoring_events (
      id               TEXT PRIMARY KEY,
      job_id           TEXT NOT NULL REFERENCES monitoring_jobs(id) ON DELETE CASCADE,
      investigation_id TEXT NOT NULL,
      kind             TEXT NOT NULL,        -- check | transition | condition_change | error
      from_status      TEXT,
      to_status        TEXT,
      wire_key         TEXT,
      detail           TEXT NOT NULL,
      credits          INTEGER NOT NULL DEFAULT 0,
      live_calls       INTEGER NOT NULL DEFAULT 0,
      at               TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_inv_thesis   ON investigation(thesis_id);
    CREATE INDEX IF NOT EXISTS idx_req_inv      ON nansen_requests(investigation_id);
    CREATE INDEX IF NOT EXISTS idx_req_source   ON nansen_requests(source);
    CREATE INDEX IF NOT EXISTS idx_req_at       ON nansen_requests(at);
    CREATE INDEX IF NOT EXISTS idx_cond_inv     ON falsification_conditions(investigation_id);
    CREATE INDEX IF NOT EXISTS idx_evt_job      ON monitoring_events(job_id);
    CREATE INDEX IF NOT EXISTS idx_job_next     ON monitoring_jobs(state, next_check_at);
  `);
}
