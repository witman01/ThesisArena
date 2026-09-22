/**
 * Exports the API-usage evidence for submission.
 *
 * Writes a CSV of every live Nansen request and a JSON summary. Only rows
 * recorded as real network calls are included; cache hits and fixture replays
 * are reported separately as excluded so the count can be audited.
 *
 *   npx tsx scripts/export-ledger.ts
 */
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { getDb } from '../src/lib/db/schema';
import { getUsage } from '../src/lib/db/store';

interface Row {
  at: string; endpoint: string; request_id: string | null;
  status: number; credits: number; ms: number; context: string; ok: number;
}

async function main() {
  const db = getDb();
  const u = await getUsage();

  const rows = db.prepare(
    `SELECT at, endpoint, request_id, status, credits, ms, context, ok
     FROM nansen_requests WHERE source='live' ORDER BY at ASC`,
  ).all() as Row[];

  if (!existsSync('export')) mkdirSync('export');

  const csv = [
    'timestamp,endpoint,nansen_request_id,http_status,credits,latency_ms,context,ok',
    ...rows.map((r) =>
      [r.at, r.endpoint, r.request_id ?? '', r.status, r.credits, r.ms, r.context, r.ok].join(','),
    ),
  ].join('\n');
  writeFileSync('export/nansen-requests.csv', csv);

  const summary = {
    generatedAt: new Date().toISOString(),
    liveApiCalls: u.liveCalls,
    successful: u.successfulCalls,
    failed: u.failedCalls,
    creditsConsumed: u.creditsConsumed,
    creditsRemaining: u.creditsRemaining,
    excludedFromCount: { cacheHits: u.cacheHits, fixtureReplays: u.fixtureReplays },
    firstCallAt: u.firstCallAt,
    lastCallAt: u.lastCallAt,
    byContext: u.byContext,
    byEndpoint: u.byEndpoint,
  };
  writeFileSync('export/usage-summary.json', JSON.stringify(summary, null, 2));

  console.log(`export/nansen-requests.csv   ${rows.length} live calls`);
  console.log(`export/usage-summary.json    ${u.creditsConsumed} credits, ${u.creditsRemaining} remaining`);
  console.log(`excluded: ${u.cacheHits} cache hits, ${u.fixtureReplays} fixture replays`);
}

main();
export {};
