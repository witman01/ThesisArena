import { runInvestigation } from '../src/lib/research/run';
async function main() {
  const r = await runInvestigation('$BTC is being accumulated quietly before a move.', {
    symbol: 'BTC', chain: 'near', address: 'btc.omft.near', isNative: false,
  });
  const c = r.thesis.consensus;
  console.log(`OK  score ${c.score}/100 · coverage ${c.coverage}% · ${r.thesis.tripwires.length} conditions`);
  for (const a of r.thesis.agents) console.log(`  ${a.name.padEnd(22)} ${String(a.confidence).padStart(3)}% ${a.stance}`);
}
main().catch((e) => {
  const m = e as Error & { cause?: { code?: string } };
  console.error('FAILED:', m.message.slice(0, 140), '| cause:', m.cause?.code ?? 'n/a');
  process.exit(1);
});
export {};
