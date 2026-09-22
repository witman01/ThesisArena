import { randomUUID } from 'node:crypto';
import type { LedgerRecord } from '@/lib/nansen/client';
import type { Agent, DebateMessage, IndependentSource, Thesis, Tripwire } from '@/lib/types';
import { WEIGHTS } from '@/lib/research/falsify';
import { all, one, runTx, countCast, type Stmt } from './sql';
import { isPostgres } from './pg';

/**
 * Reads and writes for the persisted investigation.
 *
 * Everything the UI renders comes through here. Nothing is generated at read
 * time — if a value was not measured and stored, the page shows an empty
 * state rather than inventing one.
 */

export type InvestigationStatus =
  | 'SUPPORTED'
  | 'CHALLENGED'
  | 'MIXED'
  | 'UNDER_STRESS'
  | 'INVALIDATED';

export interface AssetInput {
  symbol: string;
  name?: string;
  chain: string;
  address: string;
  isNative?: boolean;
}

const now = () => new Date().toISOString();
const id = (p: string) => `${p}_${randomUUID().replace(/-/g, '').slice(0, 12)}`;

/**
 * A boolean for whichever backend is active.
 *
 * Postgres columns are BOOLEAN; SQLite stored 0/1 and its readers still expect
 * 0/1, so each value is written in the form the active store wants.
 */
const bool = (v: boolean): boolean | number => (isPostgres() ? v : v ? 1 : 0);

/**
 * Derives the headline status from the conditions, not from the score.
 *
 * A fatal condition being met invalidates a thesis however strong the rest of
 * the evidence looks — that is the whole point of committing to the condition
 * in advance.
 */
export function deriveStatus(
  tripwires: Tripwire[],
  support: number,
  challenge: number,
): InvestigationStatus {
  const fatalTripped = tripwires.some(
    (t) => t.severity === 'fatal' && t.status === 'tripped',
  );
  if (fatalTripped) return 'INVALIDATED';

  // No module supports the claim: the modules themselves contradict it, and
  // that outranks "a condition is under pressure". A previous version checked
  // the conditions first, so a thesis every module rejected still reported as
  // merely strained.
  if (support === 0 && challenge > 0) return 'CHALLENGED';

  const anyTripped = tripwires.some((t) => t.status === 'tripped');
  const anyStressed = tripwires.some((t) => t.status === 'stressed');
  if (anyTripped || anyStressed) return 'UNDER_STRESS';

  if (support > challenge) return 'SUPPORTED';
  if (challenge > support) return 'CHALLENGED';
  return 'MIXED';
}

// ---------------------------------------------------------------------------
// Write
// ---------------------------------------------------------------------------

export interface SaveInput {
  statement: string;
  asset: AssetInput;
  thesis: Thesis;
  independent: IndependentSource[];
  ledger: LedgerRecord[];
  creditsSpent: number;
}

export async function saveInvestigation(input: SaveInput): Promise<string> {
  const t = input.thesis;

  const thesisId = id('th');
  const invId = id('inv');
  const ts = now();

  const liveCalls = input.ledger.filter((l) => l.source === 'live').length;
  const status = deriveStatus(
    t.tripwires,
    t.consensus.leanPositive,
    t.consensus.total - t.consensus.leanPositive,
  );

  // Built as a list rather than executed inline, so one transaction covers the
  // whole investigation on either backend. An investigation half-written is
  // worse than one not written at all.
  const stmts: Stmt[] = [];

  stmts.push({
    text: `INSERT INTO thesis (id, statement, symbol, name, chain, address, is_native, horizon, created_at)
           VALUES (?,?,?,?,?,?,?,?,?)`,
    params: [
      thesisId,
      input.statement,
      input.asset.symbol,
      input.asset.name ?? null,
      input.asset.chain,
      input.asset.address,
      bool(input.asset.isNative ?? false),
      t.horizon,
      ts,
    ],
  });

  stmts.push({
    text: `INSERT INTO investigation
            (id, thesis_id, status, evidence_score, coverage, support_count, challenge_count,
             strongest_signal, biggest_contradiction, credits_spent, live_calls, term_structure,
             created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    params: [
      invId,
      thesisId,
      status,
      t.consensus.score,
      t.consensus.coverage,
      t.consensus.leanPositive,
      t.consensus.total - t.consensus.leanPositive,
      t.consensus.strongestSignal,
      t.consensus.biggestContradiction,
      input.creditsSpent,
      liveCalls,
      JSON.stringify(t.termStructure),
      ts,
      ts,
    ],
  });

  const AGENT_SQL = `INSERT INTO agent_reports
      (id, investigation_id, agent_id, name, subtitle, stance, confidence, coverage, summary, weight)
     VALUES (?,?,?,?,?,?,?,?,?,?)`;
  const EVIDENCE_SQL = `INSERT INTO evidence
      (id, investigation_id, agent_report_id, label, display, value, tone,
       endpoint, field, request_id, credits_used, redistribution,
       source, source_name, source_url, agrees, fetched_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`;

  for (const a of t.agents) {
    const agentRowId = id('ar');
    stmts.push({
      text: AGENT_SQL,
      params: [
        agentRowId,
        invId,
        a.id,
        a.name,
        a.subtitle,
        a.stance,
        a.confidence,
        0,
        a.summary,
        WEIGHTS[a.id as keyof typeof WEIGHTS] ?? 0,
      ],
    });

    for (const b of a.bullets) {
      stmts.push({
        text: EVIDENCE_SQL,
        params: [
          id('ev'),
          invId,
          agentRowId,
          b.label,
          b.display,
          null,
          b.tone,
          b.provenance.endpoint,
          b.provenance.field,
          b.provenance.requestId,
          b.provenance.creditsUsed,
          b.provenance.redistribution,
          'nansen',
          null,
          null,
          null,
          b.provenance.fetchedAt,
        ],
      });
    }
  }

  // Independent corroboration is stored in the same table but tagged so the
  // UI can never present it as a Nansen signal.
  for (const s of input.independent) {
    stmts.push({
      text: EVIDENCE_SQL,
      params: [
        id('ev'),
        invId,
        null,
        s.metric,
        s.value,
        null,
        s.agrees === null ? 'neutral' : s.agrees ? 'positive' : 'negative',
        s.name.toLowerCase(),
        s.metric,
        null,
        0,
        'allowed',
        'independent',
        s.name,
        s.url,
        s.agrees === null ? null : bool(s.agrees),
        ts,
      ],
    });
  }

  for (const w of t.tripwires) {
    stmts.push({
      text: `INSERT INTO falsification_conditions
              (id, investigation_id, wire_key, claim, endpoint, field, unit, comparator,
               threshold, sustain, severity, status, current_value, proximity, history,
               breach_streak, updated_at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      params: [
        id('fc'),
        invId,
        w.id,
        w.claim,
        w.metric.endpoint,
        w.metric.field,
        w.metric.unit,
        w.comparator,
        w.threshold,
        w.sustain,
        w.severity,
        w.status,
        w.currentValue,
        w.proximity,
        JSON.stringify(w.history),
        w.status === 'tripped' ? 1 : 0,
        ts,
      ],
    });
  }

  t.debate.forEach((m, i) => {
    stmts.push({
      text: `INSERT INTO debate_messages
              (id, investigation_id, agent_id, challenges, body, evidence, seq, at)
             VALUES (?,?,?,?,?,?,?,?)`,
      params: [
        id('dm'),
        invId,
        m.agentId,
        m.challenges ?? null,
        m.text,
        JSON.stringify(m.evidence),
        i,
        m.at,
      ],
    });
  });

  await runTx(stmts);

  // Recorded after the transaction rather than inside it.
  //
  // Those calls were really made and really cost credits, so the audit trail
  // should survive a failure to save the investigation rather than being
  // rolled back with it.
  await recordRequests(input.ledger, {
    investigationId: invId,
    context: 'investigation',
  });

  return invId;
}

/** Appends ledger rows. The only place API usage is recorded. */
export async function recordRequests(
  ledger: LedgerRecord[],
  opts: { investigationId?: string; jobId?: string; context: string },
): Promise<void> {
  if (ledger.length === 0) return;

  await runTx(
    ledger.map((l) => ({
      text: `INSERT INTO nansen_requests
              (id, investigation_id, monitoring_job_id, endpoint, source, ok, status,
               credits, request_id, remaining, ms, context, error, at)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      params: [
        id('rq'),
        opts.investigationId ?? null,
        opts.jobId ?? null,
        l.endpoint,
        l.source,
        bool(l.ok),
        l.status,
        l.credits,
        l.requestId,
        l.remaining,
        Math.round(l.ms),
        opts.context,
        l.error ?? null,
        l.at,
      ],
    })),
  );
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export interface InvestigationRow {
  id: string;
  statement: string;
  symbol: string;
  name: string | null;
  chain: string;
  address: string;
  is_native: number;
  horizon: string;
  status: InvestigationStatus;
  evidence_score: number;
  coverage: number;
  support_count: number;
  challenge_count: number;
  strongest_signal: string | null;
  biggest_contradiction: string | null;
  credits_spent: number;
  live_calls: number;
  term_structure: string | null;
  created_at: string;
  updated_at: string;
}

const INV_SELECT = `
  SELECT i.*, t.statement, t.symbol, t.name, t.chain, t.address, t.is_native, t.horizon
  FROM investigation i JOIN thesis t ON t.id = i.thesis_id`;

export async function listInvestigations(limit = 50): Promise<InvestigationRow[]> {
  return all<InvestigationRow>(`${INV_SELECT} ORDER BY i.created_at DESC LIMIT ?`, [
    limit,
  ]);
}

export async function getInvestigation(invId: string): Promise<InvestigationRow | null> {
  return one<InvestigationRow>(`${INV_SELECT} WHERE i.id = ?`, [invId]);
}

export async function getAgents(invId: string) {
  return all<{
    id: string;
    agent_id: string;
    name: string;
    subtitle: string | null;
    stance: Agent['stance'];
    confidence: number;
    summary: string;
    weight: number;
  }>(`SELECT * FROM agent_reports WHERE investigation_id = ?`, [invId]);
}

export async function getEvidence(invId: string, source?: 'nansen' | 'independent') {
  const sql = source
    ? `SELECT * FROM evidence WHERE investigation_id = ? AND source = ?`
    : `SELECT * FROM evidence WHERE investigation_id = ?`;
  const args = source ? [invId, source] : [invId];
  return all<{
    id: string;
    agent_report_id: string | null;
    label: string;
    display: string;
    tone: 'positive' | 'negative' | 'neutral';
    endpoint: string;
    field: string;
    request_id: string | null;
    credits_used: number;
    redistribution: string;
    source: string;
    source_name: string | null;
    source_url: string | null;
    agrees: number | null;
    fetched_at: string;
  }>(sql, args);
}

export async function getConditions(invId: string) {
  return all<{
    id: string;
    wire_key: string;
    claim: string;
    endpoint: string;
    field: string;
    unit: Tripwire['metric']['unit'];
    comparator: '<' | '>';
    threshold: number;
    sustain: string;
    severity: Tripwire['severity'];
    status: Tripwire['status'];
    current_value: number;
    proximity: number;
    history: string;
    breach_streak: number;
    updated_at: string;
  }>(
    `SELECT * FROM falsification_conditions WHERE investigation_id = ? ORDER BY severity`,
    [invId],
  );
}

export async function getDebate(invId: string): Promise<DebateMessage[]> {
  const rows = await all<{
    id: string;
    agent_id: string;
    challenges: string | null;
    body: string;
    evidence: string;
    at: string;
  }>(`SELECT * FROM debate_messages WHERE investigation_id = ? ORDER BY seq`, [invId]);

  return rows.map((r) => ({
    id: r.id,
    agentId: r.agent_id as DebateMessage['agentId'],
    challenges: (r.challenges ?? undefined) as DebateMessage['challenges'],
    text: r.body,
    evidence: JSON.parse(r.evidence),
    at: r.at,
  }));
}

// ---------------------------------------------------------------------------
// Usage — the auditable ledger
// ---------------------------------------------------------------------------

export interface UsageSummary {
  liveCalls: number;
  successfulCalls: number;
  failedCalls: number;
  creditsConsumed: number;
  cacheHits: number;
  fixtureReplays: number;
  creditsRemaining: number | null;
  byContext: { context: string; calls: number; credits: number }[];
  byEndpoint: { endpoint: string; calls: number; credits: number; failed: number }[];
  firstCallAt: string | null;
  lastCallAt: string | null;
}

export async function getUsage(): Promise<UsageSummary> {
  // `ok` is BOOLEAN on Postgres and 0/1 on SQLite, so the conditions are
  // written as bare truthiness rather than `ok = 1`, which both dialects read
  // the same way. Aggregates carry an explicit cast because Postgres returns
  // COUNT and SUM as int8, which the driver hands back as a string.
  const [totals, remaining, byContext, byEndpoint] = await Promise.all([
    one<Record<string, number | string | null>>(
    `SELECT
       ${countCast("SUM(CASE WHEN source='live' THEN 1 ELSE 0 END)")}            AS live,
       ${countCast("SUM(CASE WHEN source='live' AND ok THEN 1 ELSE 0 END)")}     AS ok,
       ${countCast("SUM(CASE WHEN source='live' AND NOT ok THEN 1 ELSE 0 END)")} AS failed,
       ${countCast("SUM(CASE WHEN source='live' THEN credits ELSE 0 END)")}      AS credits,
       ${countCast("SUM(CASE WHEN source='cache' THEN 1 ELSE 0 END)")}           AS cache,
       ${countCast("SUM(CASE WHEN source='fixture' THEN 1 ELSE 0 END)")}         AS fixture,
       MIN(CASE WHEN source='live' THEN at END)                                 AS first_at,
       MAX(CASE WHEN source='live' THEN at END)                                 AS last_at
     FROM nansen_requests`,
    ),

    one<{ remaining: number }>(
      `SELECT remaining FROM nansen_requests
       WHERE source='live' AND remaining IS NOT NULL
       ORDER BY at DESC LIMIT 1`,
    ),

    all<{ context: string; calls: number; credits: number }>(
    `SELECT context,
            ${countCast('COUNT(*)')}               AS calls,
            ${countCast('COALESCE(SUM(credits),0)')} AS credits
     FROM nansen_requests WHERE source='live'
       GROUP BY context ORDER BY calls DESC`,
    ),

    all<{
      endpoint: string;
      calls: number;
      credits: number;
      failed: number;
    }>(
    `SELECT endpoint,
            ${countCast('COUNT(*)')}                                  AS calls,
            ${countCast('COALESCE(SUM(credits),0)')}                   AS credits,
            ${countCast('SUM(CASE WHEN NOT ok THEN 1 ELSE 0 END)')}    AS failed
     FROM nansen_requests WHERE source='live'
       GROUP BY endpoint ORDER BY calls DESC`,
    ),
  ]);

  return {
    liveCalls: Number(totals?.live ?? 0),
    successfulCalls: Number(totals?.ok ?? 0),
    failedCalls: Number(totals?.failed ?? 0),
    creditsConsumed: Number(totals?.credits ?? 0),
    cacheHits: Number(totals?.cache ?? 0),
    fixtureReplays: Number(totals?.fixture ?? 0),
    creditsRemaining: remaining?.remaining ?? null,
    byContext,
    byEndpoint,
    firstCallAt: (totals?.first_at as string) ?? null,
    lastCallAt: (totals?.last_at as string) ?? null,
  };
}

export async function getRecentRequests(limit = 25) {
  return all<{
    endpoint: string;
    source: 'live' | 'cache' | 'fixture';
    ok: number;
    status: number;
    credits: number;
    request_id: string | null;
    ms: number;
    context: string;
    error: string | null;
    at: string;
  }>(
    `SELECT endpoint, source, ok, status, credits, request_id, ms, context, error, at
     FROM nansen_requests ORDER BY at DESC LIMIT ?`,
    [limit],
  );
}
