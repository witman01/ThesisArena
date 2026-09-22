import { runInvestigation } from '../src/lib/research/run';

async function main() {
  const mode = (process.argv[2] as 'record' | 'replay') ?? 'record';

  const res = await runInvestigation(
    'Smart Money is accumulating $JUP while retail is dumping.',
    { symbol: 'JUP', chain: 'solana', address: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN' },
    { budget: 14, fixtureDir: 'fixtures/nansen', fixtureMode: mode,
      onProgress: (e) => e.state === 'done'
        ? console.log(`  ✓ ${e.agent.padEnd(22)} ${e.evidencePoints} evidence points`)
        : console.log(`  ◉ ${e.agent} investigating...`) },
  );

  const t = res.thesis;
  console.log(`\n${'='.repeat(58)}`);
  console.log(`VERDICT  ${t.consensus.score}/100  ${t.consensus.label}`);
  console.log(`STATE    ${t.state.toUpperCase()}  ·  ${t.consensus.leanPositive}/${t.consensus.total} agents positive`);
  console.log('='.repeat(58));

  for (const a of t.agents) {
    console.log(`\n${a.name}  [${a.stance}]  ${a.confidence}%`);
    console.log(`  ${a.summary}`);
    for (const b of a.bullets) console.log(`   · ${b.label}: ${b.display}`);
  }

  console.log(`\n${'-'.repeat(58)}\nINVALIDATION CONDITIONS`);
  for (const w of t.tripwires) {
    console.log(`  [${w.status.toUpperCase().padEnd(8)}] ${w.claim}`);
    console.log(`      breaks if ${w.metric.field} ${w.comparator} ${w.threshold} for ${w.sustain}`);
    console.log(`      now ${Number(w.currentValue.toPrecision(5))} · proximity ${(w.proximity * 100).toFixed(0)}%`);
  }

  console.log(`\nINDEPENDENT (${t.independent.length})`);
  for (const s of t.independent) console.log(`  ${s.name}: ${s.metric} = ${s.value} (${s.agrees ? 'agrees' : 'differs'})`);

  console.log(`\ncredits spent ${res.creditsSpent} | remaining ${res.creditsRemaining} | calls ${res.ledger.length}`);
}
main().catch((e) => { console.error("FAILED:", e.message); console.error("cause:", e.cause); process.exit(1); });
