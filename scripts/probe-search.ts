import { NansenClient } from '../src/lib/nansen/client';

async function main() {
  const c = new NansenClient({ budget: 2, maxTier: 'cheap' });
  const r = await c.call<unknown>('search', {
    search_query: 'SOL', result_type: 'token', limit: 5,
  });
  console.log('top-level keys:', Object.keys(r as object));
  console.log(JSON.stringify(r, null, 1).slice(0, 1400));
  console.log('\ncredits spent:', c.creditsSpent, '| remaining:', c.creditsRemaining);
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
