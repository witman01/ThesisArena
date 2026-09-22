import { randomUUID } from 'node:crypto';
import { CreditBudgetExceeded, NansenClient } from '@/lib/nansen/client';
import { TIMEFRAME_HOURS } from '@/lib/research/types';
import { dayWindow } from '@/lib/research/types';
import { all, one, run } from '@/lib/db/sql';
import {
  deriveStatus,
  getConditions,
  getInvestigation,
  recordRequests,
  type InvestigationStatus,
} from '@/lib/db/store';
import type { Tripwire } from '@/lib/types';
import { METRIC } from '@/lib/research/falsify';

/**
 * Monitoring.
 *
 * Re-checks the falsification conditions that were committed to at
 * investigation time. It does not invent new signals, and it does not
 * re-run the full investigation — it re-reads only the metrics the existing
 * conditions are bound to.
 *
 * Every check is a real Nansen request: fixtures and cache are deliberately
 * bypassed, because a replayed response would prove nothing and must never
 * count toward the buildathon requirement.
 */

const jid = () => `job_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
const eid = () => `evt_${randomUUID().replace(/-/g, '').slice(0, 12)}`;
const now = () => new Date().toISOString();

/** Core check costs 2 credits; the deep check adds 3 more. */
const DEEP_EVERY = 6;

export interface MonitoringJob {
  id: string;
  investigation_id: string;
  state: 'ACTIVE' | 'PAUSED' | 'STOPPED';
  interval_minutes: number;
  checks_run: number;
  last_checked_at: string | null;
  next_check_at: string | null;
  created_at: string;
}

export async function getJob(investigationId: string): Promise<MonitoringJob | null> {
  return one<MonitoringJob>(
    `SELECT * FROM monitoring_jobs WHERE investigation_id = ?`,
    [investigationId],
  );
}

export async function startJob(
  investigationId: string,
  intervalMinutes = 15,
): Promise<MonitoringJob> {
  const existing = await getJob(investigationId);

  if (existing) {
    await run(
      `UPDATE monitoring_jobs SET state='ACTIVE', interval_minutes=?, next_check_at=? WHERE id=?`,
      [intervalMinutes, now(), existing.id],
    );
    return (await getJob(investigationId))!;
  }

  const job: MonitoringJob = {
    id: jid(),
    investigation_id: investigationId,
    state: 'ACTIVE',
    interval_minutes: intervalMinutes,
    checks_run: 0,
    last_checked_at: null,
    next_check_at: now(), // first check is due immediately
    created_at: now(),
  };

  await run(
    `INSERT INTO monitoring_jobs
      (id, investigation_id, state, interval_minutes, checks_run, last_checked_at, next_check_at, created_at)
     VALUES (?,?,?,?,?,?,?,?)`,
    [
      job.id,
      job.investigation_id,
      job.state,
      job.interval_minutes,
      0,
      null,
      job.next_check_at,
      job.created_at,
    ],
  );

  await logEvent(job.id, investigationId, {
    kind: 'check',
    detail: `Monitoring started. Re-checking ${(await getConditions(investigationId)).length} conditions every ${intervalMinutes} minutes.`,
  });

  return job;
}

export async function setJobState(
  jobId: string,
  state: MonitoringJob['state'],
): Promise<void> {
  await run(`UPDATE monitoring_jobs SET state=? WHERE id=?`, [state, jobId]);
}

export async function dueJobs(): Promise<MonitoringJob[]> {
  return all<MonitoringJob>(
    `SELECT * FROM monitoring_jobs
     WHERE state='ACTIVE' AND (next_check_at IS NULL OR next_check_at <= ?)
     ORDER BY next_check_at ASC`,
    [now()],
  );
}

export async function getEvents(investigationId: string, limit = 50) {
  return all<{
    id: string;
    kind: string;
    from_status: string | null;
    to_status: string | null;
    wire_key: string | null;
    detail: string;
    credits: number;
    live_calls: number;
    at: string;
  }>(
    `SELECT * FROM monitoring_events WHERE investigation_id = ? ORDER BY at DESC LIMIT ?`,
    [investigationId, limit],
  );
}

async function logEvent(
  jobId: string,
  investigationId: string,
  e: {
    kind: 'check' | 'transition' | 'condition_change' | 'error';
    from?: string | null;
    to?: string | null;
    wireKey?: string | null;
    detail: string;
    credits?: number;
    liveCalls?: number;
  },
): Promise<void> {
  await run(
    `INSERT INTO monitoring_events
      (id, job_id, investigation_id, kind, from_status, to_status, wire_key, detail, credits, live_calls, at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      eid(),
      jobId,
      investigationId,
      e.kind,
      e.from ?? null,
      e.to ?? null,
      e.wireKey ?? null,
      e.detail,
      e.credits ?? 0,
      e.liveCalls ?? 0,
      now(),
    ],
  );
}

// ---------------------------------------------------------------------------
// The check itself
// ---------------------------------------------------------------------------

interface FlowRow {
  smart_trader_net_flow_usd: number | null;
  exchange_net_flow_usd: number | null;
  fresh_wallets_net_flow_usd: number | null;
}

export interface CheckResult {
  jobId: string;
  investigationId: string;
  status: InvestigationStatus;
  previousStatus: InvestigationStatus;
  changed: string[];
  tripped: string[];
  liveCalls: number;
  credits: number;
  deep: boolean;
  error?: string;
  /** Set when the job stopped itself because the key ran dry. */
  paused?: boolean;
}

export async function runCheck(job: MonitoringJob): Promise<CheckResult> {
  const inv = await getInvestigation(job.investigation_id);
  if (!inv) throw new Error(`Investigation ${job.investigation_id} not found`);

  const conditions = await getConditions(job.investigation_id);
  const deep = job.checks_run % DEEP_EVERY === 0;

  // No fixtures, no cache carry-over: a monitoring check must be a real read.
  const client = new NansenClient({ budget: deep ? 6 : 3, maxTier: 'cheap', cacheTtlMs: 0 });

  const result: CheckResult = {
    jobId: job.id,
    investigationId: job.investigation_id,
    status: inv.status,
    previousStatus: inv.status,
    changed: [],
    tripped: [],
    liveCalls: 0,
    credits: 0,
    deep,
  };

  try {
    const asset = { chain: inv.chain, token_address: inv.address };

    // Core: one flow read and one price read covers four of the six conditions.
    const flow1d = (
      await client.call<{ data?: FlowRow[] }>('flowIntelligence', {
        ...asset,
        timeframe: '1d',
      })
    ).data?.[0];

    const candles = (
      await client.call<{ data?: { close: number }[] }>('ohlcv', {
        ...asset,
        timeframe: '1d',
        date: dayWindow(30),
      })
    ).data;
    const lastClose = candles?.length ? candles[candles.length - 1].close : null;

    let accel: number | null = null;
    let concentration: number | null = null;

    if (deep) {
      const f6 = (
        await client.call<{ data?: FlowRow[] }>('flowIntelligence', { ...asset, timeframe: '6h' })
      ).data?.[0];
      const f7 = (
        await client.call<{ data?: FlowRow[] }>('flowIntelligence', { ...asset, timeframe: '7d' })
      ).data?.[0];

      const short = (f6?.smart_trader_net_flow_usd ?? 0) / TIMEFRAME_HOURS['6h'];
      const long = (f7?.smart_trader_net_flow_usd ?? 0) / TIMEFRAME_HOURS['7d'];
      accel = long === 0 ? 0 : (short - long) / Math.abs(long);

      if (!inv.is_native) {
        const rows =
          (
            await client.call<{ data?: { trade_volume_usd: number }[] }>('whoBoughtSold', {
              ...asset,
              date: dayWindow(7),
              pagination: { page: 1, per_page: 100 },
            })
          ).data ?? [];
        const total = rows.reduce((n, r) => n + (r.trade_volume_usd || 0), 0);
        const top3 = rows
          .map((r) => r.trade_volume_usd || 0)
          .sort((a, b) => b - a)
          .slice(0, 3)
          .reduce((n, v) => n + v, 0);
        concentration = total > 0 ? top3 / total : null;
      }
    }

    // Re-evaluate each stored condition against the fresh reading.
    const net1d = flow1d?.smart_trader_net_flow_usd ?? 0;
    const fresh = Math.abs(flow1d?.fresh_wallets_net_flow_usd ?? 0);
    const exch = flow1d?.exchange_net_flow_usd ?? 0;
    const cohortTotal = fresh + Math.abs(net1d) + Math.abs(exch);

    const nextValue: Record<string, number | null> = {
      'tw-smart-netflow': net1d,
      'tw-exchange-inflow': exch,
      'tw-fresh-share': cohortTotal > 1000 ? (fresh / cohortTotal) * 100 : 0,
      'tw-price': lastClose,
      'tw-deceleration': accel,
      'tw-concentration': concentration,
    };

    const UPDATE_CONDITION = `UPDATE falsification_conditions
       SET current_value=?, proximity=?, status=?, history=?, breach_streak=?, updated_at=?
       WHERE id=?`;

    const evaluated: Tripwire[] = [];

    for (const c of conditions) {
      const v = nextValue[c.wire_key];

      // Not re-read this cycle — carry the stored state forward untouched.
      if (v === null || v === undefined) {
        evaluated.push(asTripwire(c, c.current_value, c.status, c.proximity));
        continue;
      }

      const span = Math.abs(c.threshold) || 1;
      const distance =
        c.comparator === '<' ? (v - c.threshold) / span : (c.threshold - v) / span;
      const proximity = Math.max(0, Math.min(1, 1 - distance));
      const breached = c.comparator === '<' ? v < c.threshold : v > c.threshold;

      // Sustain: a condition must stay breached for the required number of
      // consecutive reads before it counts as tripped.
      const streak = breached ? c.breach_streak + 1 : 0;
      const required = requiredStreak(c.sustain);
      const status: Tripwire['status'] =
        breached && streak >= required ? 'tripped' : proximity > 0.7 ? 'stressed' : 'holding';

      const history = [...(JSON.parse(c.history) as number[]), v].slice(-48);

      await run(UPDATE_CONDITION, [
        v,
        proximity,
        status,
        JSON.stringify(history),
        streak,
        now(),
        c.id,
      ]);

      if (status !== c.status) {
        result.changed.push(c.wire_key);
        await logEvent(job.id, job.investigation_id, {
          kind: 'condition_change',
          wireKey: c.wire_key,
          from: c.status,
          to: status,
          detail: `${c.claim}: ${c.status} → ${status} (${c.field} now ${Number(v.toPrecision(5))}, threshold ${c.threshold})`,
        });
      }
      if (status === 'tripped') result.tripped.push(c.wire_key);

      evaluated.push(asTripwire(c, v, status, proximity));
    }

    const status = deriveStatus(evaluated, inv.support_count, inv.challenge_count);
    result.status = status;
    result.liveCalls = client.liveCalls;
    result.credits = client.creditsSpent;

    await recordRequests(client.ledger, {
      investigationId: job.investigation_id,
      jobId: job.id,
      context: 'monitoring',
    });

    if (status !== inv.status) {
      await run(`UPDATE investigation SET status=?, updated_at=? WHERE id=?`, [
        status,
        now(),
        inv.id,
      ]);
      await logEvent(job.id, job.investigation_id, {
        kind: 'transition',
        from: inv.status,
        to: status,
        detail: `Thesis moved from ${inv.status} to ${status}.`,
        credits: client.creditsSpent,
        liveCalls: client.liveCalls,
      });
    }

    await logEvent(job.id, job.investigation_id, {
      kind: 'check',
      detail:
        result.changed.length > 0
          ? `${deep ? 'Deep' : 'Core'} check. ${result.changed.length} condition(s) changed.`
          : `${deep ? 'Deep' : 'Core'} check. No change.`,
      credits: client.creditsSpent,
      liveCalls: client.liveCalls,
    });
  } catch (e) {
    const message = (e as Error).message;
    result.error = message;

    // Out of credits is not a transient fault — retrying on a schedule would
    // burn nothing but noise. Pause the job and say so plainly.
    const outOfCredits =
      /insufficient_credits|403/.test(message) ||
      e instanceof CreditBudgetExceeded;

    if (outOfCredits) {
      result.paused = true;
      setJobState(job.id, 'PAUSED');
    }
    await recordRequests(client.ledger, {
      investigationId: job.investigation_id,
      jobId: job.id,
      context: 'monitoring',
    });
    await logEvent(job.id, job.investigation_id, {
      kind: 'error',
      detail: outOfCredits
        ? 'Monitoring paused — the Nansen key is out of credits. Top up, then press Resume; the conditions and their history are untouched.'
        : message,
      liveCalls: client.liveCalls,
      credits: client.creditsSpent,
    });
  }

  const next = result.paused
    ? null
    : new Date(Date.now() + job.interval_minutes * 60_000).toISOString();
  await run(
    `UPDATE monitoring_jobs SET checks_run=checks_run+1, last_checked_at=?, next_check_at=? WHERE id=?`,
    [now(), next, job.id],
  );

  return result;
}

function requiredStreak(sustain: string): number {
  const m = sustain.match(/(\d+)/);
  if (sustain.includes('single')) return 1;
  return m ? Math.max(1, Number(m[1])) : 1;
}

function asTripwire(
  c: Awaited<ReturnType<typeof getConditions>>[number],
  value: number,
  status: Tripwire['status'],
  proximity: number,
): Tripwire {
  return {
    id: c.wire_key,
    claim: c.claim,
    metric: metricOf(c.wire_key, c.endpoint, c.field, c.unit),
    comparator: c.comparator,
    threshold: c.threshold,
    sustain: c.sustain,
    severity: c.severity,
    status,
    currentValue: value,
    proximity,
    history: JSON.parse(c.history),
    provenance: {
      requestId: 'monitor',
      endpoint: c.endpoint,
      field: c.field,
      creditsUsed: 1,
      fetchedAt: c.updated_at,
      redistribution: 'attribution',
    },
  };
}

/**
 * The metric a stored condition actually compares.
 *
 * Rows written before the metric registry existed carry a raw API field name
 * for what is really a derived quantity, so the registry wins wherever it has
 * an entry. That keeps old investigations readable instead of leaving them
 * claiming to compare a field they never compared.
 */
function metricOf(
  wireKey: string,
  endpoint: string,
  field: string,
  unit: Tripwire['metric']['unit'],
): Tripwire['metric'] {
  const known = METRIC[wireKey];
  return known
    ? { endpoint, field: known.field, unit: known.unit, derivedFrom: known.derivedFrom }
    : { endpoint, field, unit };
}
