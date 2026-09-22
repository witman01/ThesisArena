import { NansenClient } from '../src/lib/nansen/client';
async function main() {
  const c = new NansenClient({ budget: 2, maxTier: 'cheap' });
  await c.call('tokenInfo', {
    chain: 'ethereum',
    token_address: '0x2260fac5e5542a773aa44fbcfedf7c193bc2c599',
    timeframe: '1d',
  });
  console.log('credits remaining:', c.creditsRemaining);
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });

export {};
