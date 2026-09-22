import { runInvestigation } from '../src/lib/research/run';
import {
  getAgents, getConditions, getDebate, getEvidence,
  getInvestigation, getUsage, listInvestigations, saveInvestigation,
} from '../src/lib/db/store';

async function main() {
  const res = await runInvestigation(
    'Smart Money is accumulating $JUP while retail is dumping.',
    { symbol: 'JUP', chain: 'solana', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
    { budget: 14, fixtureDir: 'fixtures/nansen', fixtureMode: 'replay' },
  );

  const invId = await saveInvestigation({
    statement: 'Smart Money is accumulating $JUP while retail is dumping.',
    asset: { symbol: 'JUP', name: 'Jupiter', chain: 'solana', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
    thesis: res.thesis,
    independent: res.thesis.independent,
    ledger: res.ledger,
    creditsSpent: res.creditsSpent,
  });

  const inv = (await getInvestigation(invId))!;
  console.log('investigation id :', invId);
  console.log('status           :', inv.status, '| score', inv.evidence_score, '| coverage', inv.coverage + '%');
  console.log('agents           :', (await getAgents(invId)).length);
  console.log('nansen evidence  :', (await getEvidence(invId, 'nansen')).length);
  console.log('independent      :', (await getEvidence(invId, 'independent')).length);
  console.log('conditions       :', (await getConditions(invId)).length);
  console.log('debate messages  :', (await getDebate(invId)).length);
  console.log('total in history :', (await listInvestigations()).length);

  const u = await getUsage();
  console.log('\nledger — live:', u.liveCalls, '| fixture:', u.fixtureReplays, '| cache:', u.cacheHits,
              '| credits:', u.creditsConsumed);
  console.log('(fixture replays correctly excluded from live count)');
}
main().catch((e) => { console.error('FAILED:', e.message); process.exit(1); });
