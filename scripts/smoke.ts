import { NansenClient } from '../src/lib/nansen/client';

async function main() {
  const c = new NansenClient({ budget: 3, maxTier: 'cheap' });

  const body = {
    chains: ['ethereum'],
    date: { from: '2026-09-11T00:00:00Z', to: '2026-09-18T00:00:00Z' },
    pagination: { page: 1, per_page: 5 },
    filters: { only_smart_money: true },
  };

  const res = await c.call<{ data?: unknown[] }>('tokenScreener', body);
  const rows = Array.isArray(res?.data) ? res.data : [];

  console.log('OK  rows:', rows.length);
  console.log('credits spent:', c.creditsSpent, '| remaining:', c.creditsRemaining);
  console.log('ledger:', JSON.stringify(c.ledger, null, 2));
  if (rows[0]) {
    console.log('sample keys:', Object.keys(rows[0] as object).slice(0, 16).join(', '));
  }
}

main().catch((e) => {
  console.error('FAILED:', e.message);
  process.exit(1);
});
