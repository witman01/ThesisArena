/**
 * Re-runs stored theses against the current engine.
 *
 * Conditions used to be a fixed template, identical whatever the thesis said,
 * so everything investigated before the engine became claim-aware carries
 * conditions that may test the opposite of what was claimed. Those rows are
 * the demo: they need rebuilding, not patching.
 *
 * Each thesis is re-investigated from its original statement and asset, and
 * monitoring is restarted on the new investigation.
 *
 *   npx tsx --env-file=.env.local scripts/reseed.ts [intervalMinutes] [limit]
 */

import { getDb } from '../src/lib/db/schema';
import { readClaim } from '../src/lib/research/claim';

const BASE = process.env.THESISARENA_URL ?? 'http://localhost:3001';
const INTERVAL = Number(process.argv[2] ?? 12);
const LIMIT = Number(process.argv[3] ?? 100);

interface Row {
  statement: string;
  symbol: string;
  chain: string;
  address: string;
  is_native: number;
}

async function investigate(r: Row): Promise<string | null> {
  const res = await fetch(`${BASE}/api/investigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      statement: r.statement,
      mode: 'live',
      asset: {
        symbol: r.symbol,
        chain: r.chain,
        address: r.address,
        isNative: r.is_native === 1,
      },
    }),
  });
  if (!res.body) return null;

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
  return id;
}

async function main() {
  // One row per distinct statement — duplicates in the table are earlier runs
  // of the same thesis, and re-running each of them would just spend credits.
  const rows = getDb()
    .prepare(
      `SELECT statement, symbol, chain, address, is_native
       FROM thesis GROUP BY statement ORDER BY created_at DESC LIMIT ?`,
    )
    .all(LIMIT) as Row[];

  console.log(`re-seeding ${rows.length} theses · monitoring every ${INTERVAL} min\n`);
  let ok = 0;

  // Everything monitored right now was built by the previous engine. Left
  // running alongside the rebuilds it doubles the credit burn and keeps
  // re-checking conditions that may test the opposite of what was claimed.
  // The investigations stay in history; only their monitoring stops.
  const startedAt = new Date().toISOString();

  for (const r of rows) {
    const c = readClaim(r.statement);
    process.stdout.write(
      `  ${r.symbol.padEnd(7)} ${`${c.direction}/${c.mechanism}`.padEnd(19)} `,
    );
    try {
      const id = await investigate(r);
      if (!id) throw new Error('no investigation id');
      await fetch(`${BASE}/api/monitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          investigationId: id,
          action: 'start',
          intervalMinutes: INTERVAL,
        }),
      });
      console.log(`→ ${id}`);
      ok++;
    } catch (e) {
      console.log(`→ skipped: ${(e as Error).message.slice(0, 64)}`);
    }
  }

  // Done after the rebuilds, not before: a run that dies halfway then leaves
  // nothing monitored at all is worse than one that briefly monitors both.
  const stale = getDb()
    .prepare(
      `SELECT j.id FROM monitoring_jobs j
       JOIN investigation i ON i.id = j.investigation_id
       WHERE j.state = 'ACTIVE' AND i.created_at < ?`,
    )
    .all(startedAt) as { id: string }[];

  if (stale.length > 0) {
    const db = getDb();
    const stop = db.prepare(`UPDATE monitoring_jobs SET state = 'STOPPED' WHERE id = ?`);
    db.transaction((ids: { id: string }[]) => {
      for (const s of ids) stop.run(s.id);
    })(stale);
    console.log(`\nstopped ${stale.length} job(s) built by the previous engine`);
  }

  const u = (await (await fetch(`${BASE}/api/usage`)).json()).usage;
  console.log(
    `\n${ok}/${rows.length} rebuilt · ${u.liveCalls} live calls · ${u.creditsRemaining} credits left`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
