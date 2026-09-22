import { NansenClient } from '../src/lib/nansen/client';

const CHAIN = 'solana';
const SOL = 'So11111111111111111111111111111111111111112';
const to = new Date().toISOString();
const from = new Date(Date.now() - 7 * 864e5).toISOString();

async function main() {
  const c = new NansenClient({
    budget: 14,
    maxTier: 'cheap',
    fixtureDir: 'fixtures/nansen',
    fixtureMode: 'record',
  });

  const probes: [string, Parameters<NansenClient['call']>[0], Record<string, unknown>][] = [
    ['flow-intelligence 1d', 'flowIntelligence', { chain: CHAIN, token_address: SOL, timeframe: '1d' }],
    ['token-information', 'tokenInfo', { chain: CHAIN, token_address: SOL, timeframe: '1d' }],
    ['flows', 'flows', { chain: CHAIN, token_address: SOL, date: { from, to }, pagination: { page: 1, per_page: 10 } }],
    ['who-bought-sold', 'whoBoughtSold', { chain: CHAIN, token_address: SOL, date: { from, to }, pagination: { page: 1, per_page: 10 } }],
    ['ohlcv', 'ohlcv', { chain: CHAIN, token_address: SOL, timeframe: '1d', date: { start: from, end: to } }],
  ];

  for (const [label, key, body] of probes) {
    try {
      const res = await c.call<Record<string, unknown>>(key, body);
      const data = (res as { data?: unknown }).data;
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      const keys = rows[0] && typeof rows[0] === 'object' ? Object.keys(rows[0] as object) : [];
      console.log(`\n✓ ${label}  rows=${rows.length}`);
      console.log('  fields:', keys.slice(0, 22).join(', ') || '(scalar/empty)');
    } catch (e) {
      console.log(`\n✗ ${label}: ${(e as Error).message.slice(0, 220)}`);
    }
  }

  console.log('\n--- spent', c.creditsSpent, '| remaining', c.creditsRemaining, '---');
}

main().catch((e) => { console.error(e); process.exit(1); });
