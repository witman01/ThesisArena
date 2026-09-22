import { NansenClient } from '../src/lib/nansen/client';

const CHAIN = 'solana';
const JUP = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN';
const SOL = 'So11111111111111111111111111111111111111112';
const to = new Date().toISOString();
const from = new Date(Date.now() - 7 * 864e5).toISOString();

async function main() {
  const c = new NansenClient({
    budget: 6, maxTier: 'cheap',
    fixtureDir: 'fixtures/nansen', fixtureMode: 'record',
  });

  const probes: [string, Parameters<NansenClient['call']>[0], Record<string, unknown>][] = [
    // flows rejects native tokens — probe with a non-native SPL token instead.
    ['flows (JUP)', 'flows', { chain: CHAIN, token_address: JUP, date: { from, to }, pagination: { page: 1, per_page: 10 } }],
    // ohlcv wants date.from / date.to, not start / end.
    ['ohlcv (SOL)', 'ohlcv', { chain: CHAIN, token_address: SOL, timeframe: '1d', date: { from, to } }],
  ];

  for (const [label, key, body] of probes) {
    try {
      const res = await c.call<Record<string, unknown>>(key, body);
      const data = (res as { data?: unknown }).data;
      const rows = Array.isArray(data) ? data : data ? [data] : [];
      const keys = rows[0] && typeof rows[0] === 'object' ? Object.keys(rows[0] as object) : [];
      console.log(`\n✓ ${label}  rows=${rows.length}`);
      console.log('  fields:', keys.slice(0, 22).join(', ') || '(empty)');
      if (rows[0]) console.log('  sample:', JSON.stringify(rows[0]).slice(0, 300));
    } catch (e) {
      console.log(`\n✗ ${label}: ${(e as Error).message.slice(0, 200)}`);
    }
  }
  console.log('\n--- spent', c.creditsSpent, '| remaining', c.creditsRemaining, '---');
}
main().catch((e) => { console.error(e); process.exit(1); });
