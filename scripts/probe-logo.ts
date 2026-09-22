import { NansenClient } from '../src/lib/nansen/client';
async function main() {
  const c = new NansenClient({ budget: 2, maxTier: 'cheap' });
  const r = await c.call<{ tokens?: Record<string, unknown>[] }>('search', {
    search_query: 'BEAT', result_type: 'token', limit: 3,
  });
  const t = r.tokens ?? [];
  console.log('fields on a search token:', t[0] ? Object.keys(t[0]).join(', ') : '(none)');
  for (const x of t) console.log(' ', x.symbol, '| logo:', JSON.stringify(x.logo ?? x.logo_url ?? x.image ?? null));
  console.log('credits:', c.creditsSpent);
}
main().catch(e => { console.error('FAILED:', e.message); process.exit(1); });
