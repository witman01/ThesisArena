/**
 * Seeds real investigations across distinct assets and puts each under
 * monitoring.
 *
 * Each one is a genuine investigation of a different token — the call volume
 * that follows comes from monitoring several real theses, which is what the
 * product does anyway.
 *
 *   npx tsx --env-file=.env.local scripts/seed.ts [intervalMinutes]
 */

const BASE = process.env.THESISARENA_URL ?? 'http://localhost:3001';
const INTERVAL = Number(process.argv[2] ?? 10);

interface Seed {
  statement: string;
  symbol: string;
  chain: string;
  address: string;
  isNative?: boolean;
}

const SEEDS: Seed[] = [
  {
    statement: 'Smart money is accumulating $SOL while retail sells into strength.',
    symbol: 'SOL', chain: 'solana',
    address: 'So11111111111111111111111111111111111111112', isNative: true,
  },
  {
    statement: '$JUP holds its base because accumulation has been building all week.',
    symbol: 'JUP', chain: 'solana',
    address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  },
  {
    statement: '$WBTC supply is tightening ahead of a spot bid.',
    symbol: 'WBTC', chain: 'ethereum',
    address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
  },
  {
    statement: '$PEPE is being distributed into strength by early holders.',
    symbol: 'PEPE', chain: 'ethereum',
    address: '0x6982508145454ce325ddbe47a25d4ec3d2311933',
  },
  {
    statement: '$LINK accumulation is broad rather than driven by a few wallets.',
    symbol: 'LINK', chain: 'ethereum',
    address: '0x514910771af9ca656af840dff83e8264ecf986ca',
  },
  {
    statement: '$UNI flows are rotating out as liquidity moves elsewhere.',
    symbol: 'UNI', chain: 'ethereum',
    address: '0x1f9840a85d5af5bf1d1762f925bdaddc4201f984',
  },
  {
    statement: '$AAVE is quietly accumulated while the market looks away.',
    symbol: 'AAVE', chain: 'ethereum',
    address: '0x7fc66500c84a76ad7e9c93437bfc5ac33e2ddae9',
  },
  {
    statement: '$ARB recovery is driven by real users rather than incentive farming.',
    symbol: 'ARB', chain: 'arbitrum',
    address: '0x912ce59144191c1204e64559fe8253a0e49e6548',
  },
];

async function investigate(s: Seed): Promise<string | null> {
  const res = await fetch(`${BASE}/api/investigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ statement: s.statement, mode: 'live', asset: s }),
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
  console.log(`seeding ${SEEDS.length} investigations · monitoring every ${INTERVAL} min\n`);
  let ok = 0;

  for (const s of SEEDS) {
    process.stdout.write(`  ${s.symbol.padEnd(6)} ${s.chain.padEnd(10)} `);
    try {
      const id = await investigate(s);
      if (!id) throw new Error('no investigation id returned');

      await fetch(`${BASE}/api/monitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ investigationId: id, action: 'start', intervalMinutes: INTERVAL }),
      });

      console.log(`→ ${id}  monitoring on`);
      ok++;
    } catch (e) {
      console.log(`→ failed: ${(e as Error).message.slice(0, 90)}`);
    }
  }

  const u = (await (await fetch(`${BASE}/api/usage`)).json()).usage;
  console.log(
    `\n${ok}/${SEEDS.length} seeded · ${u.liveCalls} live calls · ${u.creditsConsumed} credits used · ${u.creditsRemaining} left`,
  );
}

main().catch((e) => { console.error(e); process.exit(1); });

export {};
