import { NansenClient } from '../src/lib/nansen/client';
async function main() {
  const c = new NansenClient({ budget: 3, maxTier: 'cheap' });
  try {
    await c.call('flows', {
      chain: 'ethereum',
      token_address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      date: { from: '2026-09-12T00:00:00.000Z', to: '2026-09-19T00:00:00.000Z' },
      pagination: { page: 1, per_page: 10 },
    });
  } catch (e) {
    console.log('FULL ERROR:', (e as Error).message);
  }
  console.log('credits charged:', c.creditsSpent);
}
main();
export {};
