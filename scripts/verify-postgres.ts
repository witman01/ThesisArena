/**
 * Production verification against the live Neon database.
 *
 * Runs a genuinely fresh investigation through the deployed configuration and
 * checks that every persisted surface reads back correctly. This spends real
 * Nansen credits, because a verification that used fixtures would prove
 * nothing about production.
 *
 *   npx tsx --env-file=.env.local scripts/verify-postgres.ts
 */

import { isPostgres, query } from '../src/lib/db/pg';
import {
  getAgents,
  getConditions,
  getDebate,
  getEvidence,
  getInvestigation,
  getRecentRequests,
  getUsage,
  listInvestigations,
} from '../src/lib/db/store';
import { getEvents, getJob, runCheck, startJob } from '../src/lib/monitor/runner';

const BASE = process.env.THESISARENA_URL ?? 'http://localhost:3001';

const THESIS = 'Smart money is quietly accumulating $LINK before the next leg.';
const ASSET = {
  symbol: 'LINK',
  chain: 'ethereum',
  address: '0x514910771af9ca656af840dff83e8264ecf986ca',
  isNative: false,
};

let failures = 0;

function check(n: number, label: string, ok: boolean, detail: string): void {
  if (!ok) failures++;
  console.log(`${ok ? ' ok ' : 'FAIL'}  ${String(n).padStart(2)}. ${label.padEnd(44)} ${detail}`);
}

/** Streams the investigate endpoint and returns the new investigation id. */
async function investigate(): Promise<string> {
  const res = await fetch(`${BASE}/api/investigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statement: THESIS, mode: 'live', asset: ASSET }),
  });
  if (!res.body) throw new Error('no response body');

  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  let id: string | null = null;
  let err: string | null = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const frames = buf.split('\n\n');
    buf = frames.pop() ?? '';
    for (const f of frames) {
      const ev = f.split('\n').find((l) => l.startsWith('event: '))?.slice(7).trim();
      const dl = f.split('\n').find((l) => l.startsWith('data: '))?.slice(6);
      if (!ev || !dl) continue;
      if (ev === 'done') id = JSON.parse(dl).investigationId;
      if (ev === 'error') err = JSON.parse(dl).message;
    }
  }
  if (err) throw new Error(err);
  if (!id) throw new Error('no investigation id returned');
  return id;
}

async function main() {
  if (!isPostgres()) {
    console.error('DATABASE_URL is not set — this must run against Neon.');
    process.exit(1);
  }

  console.log('verifying against Neon\n');

  // Baselines, so the ledger can be reconciled afterwards.
  const before = await getUsage();
  const rowsBefore = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM nansen_requests`,
  );

  // ---- 1. a fresh investigation ----------------------------------------
  const started = Date.now();
  const invId = await investigate();
  check(1, 'new investigation created', Boolean(invId), `${invId} in ${Date.now() - started}ms`);

  // ---- 2. persisted in Neon --------------------------------------------
  const direct = await query<{ id: string; status: string; evidence_score: number }>(
    `SELECT id, status, evidence_score FROM investigation WHERE id = $1`,
    [invId],
  );
  check(
    2,
    'persisted in Neon',
    direct.length === 1,
    direct.length ? `${direct[0].status} ${direct[0].evidence_score}/100` : 'not found',
  );

  // ---- 3. history reads it ---------------------------------------------
  const list = await listInvestigations(5);
  check(3, 'history lists it', list.some((r) => r.id === invId), `${list.length} rows, newest ${list[0]?.symbol}`);

  // ---- 4. the full report loads ----------------------------------------
  const inv = await getInvestigation(invId);
  const agents = await getAgents(invId);
  const nansen = await getEvidence(invId, 'nansen');
  const independent = await getEvidence(invId, 'independent');
  const conds = await getConditions(invId);
  const debate = await getDebate(invId);
  check(
    4,
    'full report loads',
    Boolean(inv) && agents.length === 4 && conds.length > 0,
    `${agents.length} agents · ${nansen.length} nansen + ${independent.length} independent evidence · ${conds.length} conditions · ${debate.length} debate`,
  );

  // ---- 5. monitoring jobs persist --------------------------------------
  const job = await startJob(invId, 15);
  const reread = await getJob(invId);
  check(5, 'monitoring job persists', reread?.id === job.id, `${job.id} state=${reread?.state}`);

  // ---- 6. a real check, and its transition ------------------------------
  const result = await runCheck(job);
  const events = await getEvents(invId, 20);
  const jobAfter = await getJob(invId);
  check(
    6,
    'check runs and state persists',
    events.length > 0 && (jobAfter?.checks_run ?? 0) > 0,
    `${events.length} events · checks_run=${jobAfter?.checks_run} · status=${result.status}`,
  );

  // ---- 7. the ledger wrote to Neon --------------------------------------
  const ledgerRows = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM nansen_requests WHERE investigation_id = $1`,
    [invId],
  );
  check(7, 'ledger wrote to Neon', ledgerRows[0].n > 0, `${ledgerRows[0].n} rows for this investigation`);

  // ---- 8. the usage endpoint --------------------------------------------
  const api = (await (await fetch(`${BASE}/api/usage`)).json()) as {
    usage: { liveCalls: number; creditsConsumed: number; byEndpoint: { calls: number }[] };
  };
  const store = await getUsage();
  check(
    8,
    '/api/usage matches the store',
    api.usage.liveCalls === store.liveCalls,
    `api ${api.usage.liveCalls} vs store ${store.liveCalls}`,
  );

  // ---- 9. analytics aggregates are numbers, not strings ------------------
  const aggregatesNumeric =
    store.byEndpoint.every((e) => typeof e.calls === 'number' && typeof e.credits === 'number') &&
    store.byContext.every((c) => typeof c.calls === 'number');
  check(
    9,
    'analytics aggregates are numeric',
    aggregatesNumeric,
    `${store.byEndpoint.length} endpoints, ${store.byContext.length} contexts`,
  );

  // ---- 10. JSONB round-trips --------------------------------------------
  const hist = conds[0];
  let parsed: number[] = [];
  let jsonOk = false;
  try {
    parsed = JSON.parse(hist.history) as number[];
    jsonOk = Array.isArray(parsed);
  } catch {
    jsonOk = false;
  }
  const termStructure = inv?.term_structure ? JSON.parse(inv.term_structure) : null;
  check(
    10,
    'JSONB deserialises',
    jsonOk && termStructure !== null,
    `history[${parsed.length}] · term_structure ${termStructure ? 'parsed' : 'missing'}`,
  );

  // ---- 11. timestamps ----------------------------------------------------
  const tsOk =
    typeof inv?.created_at === 'string' && !Number.isNaN(Date.parse(inv.created_at));
  check(11, 'TIMESTAMPTZ reads as an ISO string', tsOk, String(inv?.created_at));

  // ---- 12. booleans ------------------------------------------------------
  const recent = await getRecentRequests(5);
  const boolOk =
    recent.every((r) => r.ok === 0 || r.ok === 1) &&
    (inv?.is_native === 0 || inv?.is_native === 1);
  check(12, 'booleans read as 0/1', boolOk, `ok=${recent[0]?.ok} is_native=${inv?.is_native}`);

  // ---- 13. concurrency ---------------------------------------------------
  const concurrent = await Promise.all([
    getUsage(),
    getUsage(),
    listInvestigations(3),
    getConditions(invId),
    getRecentRequests(5),
    getUsage(),
  ]);
  const [u1, u2, , , , u3] = concurrent as [
    Awaited<ReturnType<typeof getUsage>>,
    Awaited<ReturnType<typeof getUsage>>,
    unknown,
    unknown,
    unknown,
    Awaited<ReturnType<typeof getUsage>>,
  ];
  check(
    13,
    'concurrent reads agree',
    u1.liveCalls === u2.liveCalls && u2.liveCalls === u3.liveCalls,
    `${u1.liveCalls} / ${u2.liveCalls} / ${u3.liveCalls}`,
  );

  // ---- 14. the migrated rows are still there -----------------------------
  const totals = await query<{ table_name: string; n: number }>(
    `SELECT 'thesis' AS table_name, COUNT(*)::int AS n FROM thesis
     UNION ALL SELECT 'investigation', COUNT(*)::int FROM investigation
     UNION ALL SELECT 'evidence', COUNT(*)::int FROM evidence
     UNION ALL SELECT 'monitoring_events', COUNT(*)::int FROM monitoring_events`,
  );
  const byTable = Object.fromEntries(totals.map((t) => [t.table_name, t.n]));
  check(
    14,
    'migrated rows still present',
    byTable.thesis >= 72 && byTable.investigation >= 72 && byTable.evidence >= 906,
    `thesis=${byTable.thesis} inv=${byTable.investigation} evidence=${byTable.evidence} events=${byTable.monitoring_events}`,
  );

  // ---- 15. the ledger reconciles ------------------------------------------
  const rowsAfter = await query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM nansen_requests`,
  );
  const after = await getUsage();
  const added = rowsAfter[0].n - rowsBefore[0].n;
  const liveAdded = after.liveCalls - before.liveCalls;
  check(
    15,
    'ledger totals reconcile',
    added > 0 && liveAdded > 0 && liveAdded <= added,
    `+${added} rows, +${liveAdded} live, +${after.creditsConsumed - before.creditsConsumed} credits`,
  );

  console.log(
    failures === 0
      ? `\nall 15 checks passed · investigation ${invId}`
      : `\n${failures} check(s) FAILED`,
  );
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error('\nverification threw:', e);
  process.exit(1);
});

export {};
