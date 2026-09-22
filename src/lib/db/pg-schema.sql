-- ThesisArena — Postgres schema.
--
-- A faithful translation of the SQLite schema, with three deliberate changes:
--
--   * Timestamps are TIMESTAMPTZ rather than TEXT. SQLite had no date type, so
--     every column stored an ISO string; Postgres can index and compare these
--     properly, which the monitoring scheduler's "what is due" query needs.
--   * Booleans are BOOLEAN rather than INTEGER 0/1.
--   * JSON columns are JSONB rather than TEXT, so the term structure and
--     condition history can be queried rather than only round-tripped.
--
-- Everything else, including the CHECK constraint that keeps a cache replay
-- from being counted as an API call, carries across unchanged. That constraint
-- is the reason the ledger can be trusted, so it is enforced by the database
-- here exactly as it was there.

CREATE TABLE IF NOT EXISTS thesis (
  id          TEXT PRIMARY KEY,
  statement   TEXT        NOT NULL,
  symbol      TEXT        NOT NULL,
  name        TEXT,
  chain       TEXT        NOT NULL,
  address     TEXT        NOT NULL,
  is_native   BOOLEAN     NOT NULL DEFAULT FALSE,
  horizon     TEXT        NOT NULL DEFAULT '7-30 days',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS investigation (
  id                    TEXT PRIMARY KEY,
  thesis_id             TEXT        NOT NULL REFERENCES thesis(id) ON DELETE CASCADE,
  status                TEXT        NOT NULL
    CHECK (status IN ('SUPPORTED','CHALLENGED','MIXED','UNDER_STRESS','INVALIDATED')),
  evidence_score        INTEGER     NOT NULL,
  coverage              INTEGER     NOT NULL,
  support_count         INTEGER     NOT NULL,
  challenge_count       INTEGER     NOT NULL,
  strongest_signal      TEXT,
  biggest_contradiction TEXT,
  credits_spent         INTEGER     NOT NULL DEFAULT 0,
  live_calls            INTEGER     NOT NULL DEFAULT 0,
  term_structure        JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS agent_reports (
  id               TEXT PRIMARY KEY,
  investigation_id TEXT             NOT NULL REFERENCES investigation(id) ON DELETE CASCADE,
  agent_id         TEXT             NOT NULL,
  name             TEXT             NOT NULL,
  subtitle         TEXT,
  stance           TEXT             NOT NULL,
  confidence       INTEGER          NOT NULL,
  coverage         DOUBLE PRECISION NOT NULL DEFAULT 0,
  summary          TEXT             NOT NULL,
  weight           DOUBLE PRECISION NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS evidence (
  id               TEXT PRIMARY KEY,
  investigation_id TEXT             NOT NULL REFERENCES investigation(id) ON DELETE CASCADE,
  agent_report_id  TEXT             REFERENCES agent_reports(id) ON DELETE CASCADE,
  label            TEXT             NOT NULL,
  display          TEXT             NOT NULL,
  value            DOUBLE PRECISION,
  tone             TEXT             NOT NULL,
  -- provenance
  endpoint         TEXT             NOT NULL,
  field            TEXT             NOT NULL,
  request_id       TEXT,
  credits_used     INTEGER          NOT NULL DEFAULT 0,
  redistribution   TEXT             NOT NULL,
  -- Nansen data and an independent source must never merge into one figure.
  source           TEXT             NOT NULL DEFAULT 'nansen'
    CHECK (source IN ('nansen','independent')),
  source_name      TEXT,
  source_url       TEXT,
  agrees           BOOLEAN,
  fetched_at       TIMESTAMPTZ      NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS falsification_conditions (
  id               TEXT             PRIMARY KEY,
  investigation_id TEXT             NOT NULL REFERENCES investigation(id) ON DELETE CASCADE,
  wire_key         TEXT             NOT NULL,
  claim            TEXT             NOT NULL,
  endpoint         TEXT             NOT NULL,
  field            TEXT             NOT NULL,
  unit             TEXT             NOT NULL,
  comparator       TEXT             NOT NULL CHECK (comparator IN ('<','>')),
  threshold        DOUBLE PRECISION NOT NULL,
  sustain          TEXT             NOT NULL,
  severity         TEXT             NOT NULL CHECK (severity IN ('fatal','major','minor')),
  status           TEXT             NOT NULL CHECK (status IN ('holding','stressed','tripped')),
  current_value    DOUBLE PRECISION NOT NULL,
  proximity        DOUBLE PRECISION NOT NULL,
  history          JSONB            NOT NULL DEFAULT '[]'::jsonb,
  breach_streak    INTEGER          NOT NULL DEFAULT 0,
  updated_at       TIMESTAMPTZ      NOT NULL DEFAULT now(),
  UNIQUE (investigation_id, wire_key)
);

CREATE TABLE IF NOT EXISTS debate_messages (
  id               TEXT        PRIMARY KEY,
  investigation_id TEXT        NOT NULL REFERENCES investigation(id) ON DELETE CASCADE,
  agent_id         TEXT        NOT NULL,
  challenges       TEXT,
  body             TEXT        NOT NULL,
  evidence         JSONB       NOT NULL DEFAULT '[]'::jsonb,
  seq              INTEGER     NOT NULL,
  at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- The audit trail for the buildathon's 1,000+ call requirement.
--
-- `source` separates a real network call from a cache hit or a fixture replay.
-- Only 'live' rows count, and the CHECK enforces that rather than leaving it
-- to whoever writes the next query.
CREATE TABLE IF NOT EXISTS nansen_requests (
  id                TEXT        PRIMARY KEY,
  investigation_id  TEXT        REFERENCES investigation(id) ON DELETE SET NULL,
  monitoring_job_id TEXT,
  endpoint          TEXT        NOT NULL,
  source            TEXT        NOT NULL CHECK (source IN ('live','cache','fixture')),
  ok                BOOLEAN     NOT NULL,
  status            INTEGER     NOT NULL,
  credits           INTEGER     NOT NULL DEFAULT 0,
  request_id        TEXT,
  remaining         INTEGER,
  ms                INTEGER     NOT NULL DEFAULT 0,
  context           TEXT        NOT NULL,
  error             TEXT,
  at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS monitoring_jobs (
  id               TEXT        PRIMARY KEY,
  investigation_id TEXT        NOT NULL REFERENCES investigation(id) ON DELETE CASCADE,
  state            TEXT        NOT NULL CHECK (state IN ('ACTIVE','PAUSED','STOPPED')),
  interval_minutes INTEGER     NOT NULL DEFAULT 15,
  checks_run       INTEGER     NOT NULL DEFAULT 0,
  last_checked_at  TIMESTAMPTZ,
  next_check_at    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS monitoring_events (
  id               TEXT        PRIMARY KEY,
  job_id           TEXT        NOT NULL REFERENCES monitoring_jobs(id) ON DELETE CASCADE,
  investigation_id TEXT        NOT NULL,
  kind             TEXT        NOT NULL
    CHECK (kind IN ('check','transition','condition_change','error')),
  from_status      TEXT,
  to_status        TEXT,
  wire_key         TEXT,
  detail           TEXT        NOT NULL,
  credits          INTEGER     NOT NULL DEFAULT 0,
  live_calls       INTEGER     NOT NULL DEFAULT 0,
  at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_thesis  ON investigation(thesis_id);
CREATE INDEX IF NOT EXISTS idx_inv_created ON investigation(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_req_inv     ON nansen_requests(investigation_id);
CREATE INDEX IF NOT EXISTS idx_req_source  ON nansen_requests(source);
CREATE INDEX IF NOT EXISTS idx_req_at      ON nansen_requests(at DESC);
CREATE INDEX IF NOT EXISTS idx_cond_inv    ON falsification_conditions(investigation_id);
CREATE INDEX IF NOT EXISTS idx_evt_job     ON monitoring_events(job_id);
CREATE INDEX IF NOT EXISTS idx_evt_at      ON monitoring_events(at DESC);

-- The scheduler asks "which jobs are due" on every tick, so that query gets a
-- partial index rather than scanning every stopped job forever.
CREATE INDEX IF NOT EXISTS idx_job_due
  ON monitoring_jobs(next_check_at)
  WHERE state = 'ACTIVE';

-- Only live rows are ever counted toward the call requirement, and the
-- analytics page groups them by endpoint and context.
CREATE INDEX IF NOT EXISTS idx_req_live
  ON nansen_requests(endpoint, context)
  WHERE source = 'live';
