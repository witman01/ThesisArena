/**
 * The monitoring scheduler.
 *
 * Polls for due jobs and runs them. Every check is a real Nansen read against
 * conditions that were committed to in advance, across distinct theses — this
 * is ordinary monitoring, not a loop manufactured to inflate a counter.
 *
 *   npx tsx scripts/scheduler.ts [tickSeconds]
 */

const BASE = process.env.THESISARENA_URL ?? 'http://localhost:3001';
const TICK_S = Number(process.argv[2] ?? 60);
const TARGET = 1000;

interface Usage {
  liveCalls: number;
  creditsConsumed: number;
  creditsRemaining: number | null;
  byContext: { context: string; calls: number }[];
}

const stamp = () => new Date().toLocaleTimeString('en-GB');

async function usage(): Promise<Usage | null> {
  try {
    const r = await fetch(`${BASE}/api/usage`);
    return (await r.json()).usage as Usage;
  } catch {
    return null;
  }
}

async function tick(): Promise<void> {
  try {
    const res = await fetch(`${BASE}/api/monitor?run=due`);
    if (!res.ok) {
      console.log(`${stamp()}  scheduler: HTTP ${res.status}`);
      return;
    }

    const body = (await res.json()) as {
      ran: number;
      results: { investigationId: string; status: string; liveCalls: number; paused?: boolean; error?: string }[];
    };

    if (body.ran === 0) return; // nothing due; stay quiet

    const calls = body.results.reduce((n, r) => n + (r.liveCalls ?? 0), 0);
    const paused = body.results.filter((r) => r.paused).length;
    const errors = body.results.filter((r) => r.error && !r.paused).length;

    const u = await usage();
    const pct = u ? ((u.liveCalls / TARGET) * 100).toFixed(1) : '?';

    console.log(
      `${stamp()}  ran ${body.ran} check(s) · +${calls} calls` +
        (u ? ` · total ${u.liveCalls}/${TARGET} (${pct}%) · ${u.creditsRemaining ?? '?'} credits left` : '') +
        (paused ? ` · ${paused} paused` : '') +
        (errors ? ` · ${errors} error(s)` : ''),
    );

    for (const r of body.results) {
      if (r.error) console.log(`          ${r.investigationId}: ${r.error.slice(0, 120)}`);
    }
  } catch (e) {
    console.log(`${stamp()}  scheduler: ${(e as Error).message}`);
  }
}

async function main() {
  const u = await usage();
  console.log(
    `scheduler up · tick ${TICK_S}s · target ${TARGET} live calls` +
      (u ? ` · currently ${u.liveCalls}, ${u.creditsRemaining ?? '?'} credits` : ''),
  );

  for (;;) {
    await tick();
    await new Promise((r) => setTimeout(r, TICK_S * 1000));
  }
}

main();

export {};
