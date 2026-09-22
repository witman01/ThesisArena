/**
 * Expands the monitored set.
 *
 * More distinct theses, not a shorter interval on the same one — a portfolio
 * of real positions is what a user actually monitors, and it is the honest way
 * to raise call volume. Each entry is a separate investigation of a separate
 * token with its own falsification conditions.
 *
 *   npx tsx --env-file=.env.local scripts/seed-more.ts [intervalMinutes]
 */

const BASE = process.env.THESISARENA_URL ?? 'http://localhost:3001';
const INTERVAL = Number(process.argv[2] ?? 10);

interface Seed {
  statement: string;
  symbol: string;
  chain: string;
  address: string;
}

const SEEDS: Seed[] = [
  { symbol: 'WETH', chain: 'ethereum', address: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
    statement: '$WETH flows show accumulation rather than rotation out of risk.' },
  { symbol: 'USDC', chain: 'ethereum', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
    statement: '$USDC supply growth signals capital waiting to rotate into risk.' },
  { symbol: 'USDT', chain: 'ethereum', address: '0xdac17f958d2ee523a2206206994597c13d831ec7',
    statement: '$USDT balances are leaving exchanges faster than they arrive.' },
  { symbol: 'DAI', chain: 'ethereum', address: '0x6b175474e89094c44da98b954eedeac495271d0f',
    statement: '$DAI demand is holding up as on-chain leverage unwinds.' },
  { symbol: 'SHIB', chain: 'ethereum', address: '0x95ad61b0a150d79219dcf64e1e6cc01f0b64c4ce',
    statement: '$SHIB is being distributed into strength by long-held wallets.' },
  { symbol: 'MKR', chain: 'ethereum', address: '0x9f8f72aa9304c8b593d555f12ef6589cc3a579a2',
    statement: '$MKR accumulation is concentrated rather than broad-based.' },
  { symbol: 'CRV', chain: 'ethereum', address: '0xd533a949740bb3306d119cc777fa900ba034cd52',
    statement: '$CRV flows are stabilising after sustained outflows.' },
  { symbol: 'LDO', chain: 'ethereum', address: '0x5a98fcbea516cf06857215779fd812ca3bef1b32',
    statement: '$LDO is quietly accumulated while attention sits elsewhere.' },
  { symbol: 'COMP', chain: 'ethereum', address: '0xc00e94cb662c3520282e6f5717214004a7f26888',
    statement: '$COMP has stopped bleeding supply onto exchanges.' },
  { symbol: 'SNX', chain: 'ethereum', address: '0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f',
    statement: '$SNX holders are rotating out rather than adding.' },
  { symbol: 'GRT', chain: 'ethereum', address: '0xc944e90c64b2c07662a292be6244bdf05cda44a7',
    statement: '$GRT demand is broad across the active trader set.' },
  { symbol: 'ENS', chain: 'ethereum', address: '0xc18360217d8f7ab5e7c516566761ea12ce7f9d72',
    statement: '$ENS accumulation is building ahead of renewed usage.' },
  { symbol: '1INCH', chain: 'ethereum', address: '0x111111111117dc0aa78b770fa6a738034120c302',
    statement: '$1INCH flows do not support the recent move.' },
  { symbol: 'SAND', chain: 'ethereum', address: '0x3845badade8e6dff049820680d1f14bd3903a5d0',
    statement: '$SAND is seeing late retail demand rather than smart accumulation.' },
  { symbol: 'MANA', chain: 'ethereum', address: '0x0f5d2fb29fb7d3cfee444a200298f468908cc942',
    statement: '$MANA supply on exchanges is contracting.' },
  { symbol: 'APE', chain: 'ethereum', address: '0x4d224452801aced8b2f0aebe155379bb5d594381',
    statement: '$APE distribution is concentrated in very few addresses.' },
  { symbol: 'PENDLE', chain: 'ethereum', address: '0x808507121b80c02388fad14726482e061b8da827',
    statement: '$PENDLE accumulation is sustained rather than a single spike.' },
  { symbol: 'RPL', chain: 'ethereum', address: '0xd33526068d116ce69f19a9ee46f0bd304f21a51f',
    statement: '$RPL flows are turning positive after a long drawdown.' },
  { symbol: 'USDC', chain: 'base', address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    statement: '$USDC on Base is growing faster than the chain it bridges from.' },
  { symbol: 'BONK', chain: 'solana', address: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    statement: '$BONK is being accumulated quietly before a move.' },
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
  console.log(`seeding ${SEEDS.length} more · monitoring every ${INTERVAL} min\n`);
  let ok = 0;

  for (const s of SEEDS) {
    process.stdout.write(`  ${s.symbol.padEnd(7)} ${s.chain.padEnd(9)} `);
    try {
      const id = await investigate(s);
      if (!id) throw new Error('no id');
      await fetch(`${BASE}/api/monitor`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ investigationId: id, action: 'start', intervalMinutes: INTERVAL }),
      });
      console.log('→ monitoring on');
      ok++;
    } catch (e) {
      console.log(`→ skipped: ${(e as Error).message.slice(0, 70)}`);
    }
  }

  const u = (await (await fetch(`${BASE}/api/usage`)).json()).usage;
  console.log(
    `\n${ok}/${SEEDS.length} added · ${u.liveCalls} live calls · ${u.creditsRemaining} credits left`,
  );
}

main().catch((e) => { console.error(e); process.exit(1); });

export {};
