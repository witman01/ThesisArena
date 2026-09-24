import { describe, expect, it } from 'vitest';
import { deriveStatus } from '@/lib/db/store';
import { compositeScore, evaluate, METRIC, WEIGHTS } from '@/lib/research/falsify';
import { readClaim } from '@/lib/research/claim';
import { explainVerdict } from '@/lib/research/explain';
import { capByCoverage, clamp, dayWindow, stanceFrom } from '@/lib/research/types';
import { composeObservation, SENTIMENT, VERDICT, verdictLabel } from '@/lib/research/observe';
import { isSpotContract } from '@/app/api/search/route';
import { priceLabel, compactUsd, detectSymbol } from '@/lib/assets';
import { signed, signedPct } from '@/lib/format';
import type { Agent, Tripwire } from '@/lib/types';
import type { ResearchResult } from '@/lib/research/types';

/**
 * The claims this product makes about itself, asserted.
 *
 * Three of these encode bugs that reached the UI and were fixed: the score
 * clamp that pinned every broken thesis to 35, the status precedence that
 * called a thesis with zero support "merely strained", and the perp rows whose
 * ticker masqueraded as a contract address.
 */

function wire(over: Partial<Tripwire> = {}): Tripwire {
  return {
    id: 'tw-test',
    claim: 'Smart-money accumulation stays positive',
    metric: { endpoint: 'tgm/flow-intelligence', field: 'smart_trader_net_flow_usd', unit: 'usd' },
    comparator: '<',
    threshold: 0,
    sustain: 'single read',
    severity: 'major',
    status: 'holding',
    currentValue: 1000,
    proximity: 0.2,
    history: [1000],
    provenance: {
      requestId: 'r', endpoint: 'tgm/flow-intelligence', field: 'f',
      creditsUsed: 1, fetchedAt: '2026-01-01T00:00:00Z', redistribution: 'attribution',
    },
    ...over,
  };
}

function module_(over: Partial<ResearchResult> = {}): ResearchResult {
  return {
    id: 'smart-money', name: 'Smart Money', subtitle: '',
    stance: 'bullish', confidence: 70, summary: '', evidence: [],
    metrics: {}, coverage: 1, ...over,
  };
}

describe('tripwire evaluation', () => {
  it('is deterministic — the same reading always yields the same state', () => {
    const w = wire();
    const a = evaluate(w, -500);
    const b = evaluate(w, -500);
    expect(a.status).toBe(b.status);
    expect(a.proximity).toBe(b.proximity);
  });

  it('trips a "<" condition only once the value crosses below', () => {
    expect(evaluate(wire(), 1).status).not.toBe('tripped');
    expect(evaluate(wire(), -1).status).toBe('tripped');
  });

  it('trips a ">" condition only once the value crosses above', () => {
    const w = wire({ comparator: '>', threshold: 55, currentValue: 10 });
    expect(evaluate(w, 54).status).not.toBe('tripped');
    expect(evaluate(w, 56).status).toBe('tripped');
  });

  it('keeps history bounded so a long-running monitor cannot grow without limit', () => {
    let w = wire();
    for (let i = 0; i < 80; i++) w = evaluate(w, i);
    expect(w.history.length).toBeLessThanOrEqual(24);
  });
});

describe('status precedence', () => {
  it('invalidates when a fatal condition is met, whatever the modules say', () => {
    const t = [wire({ severity: 'fatal', status: 'tripped' })];
    expect(deriveStatus(t, 4, 0)).toBe('INVALIDATED');
  });

  // Regression: this reported UNDER_STRESS, so a thesis every module rejected
  // read as "intact but losing force".
  it('reports CHALLENGED when nothing supports the claim, even with a tripped wire', () => {
    const t = [wire({ severity: 'major', status: 'tripped' })];
    expect(deriveStatus(t, 0, 4)).toBe('CHALLENGED');
  });

  it('reports UNDER_STRESS when a condition is stressed but support exists', () => {
    expect(deriveStatus([wire({ status: 'stressed' })], 3, 1)).toBe('UNDER_STRESS');
  });

  it('reports SUPPORTED only when everything holds and support leads', () => {
    expect(deriveStatus([wire()], 3, 1)).toBe('SUPPORTED');
  });
});

describe('composite score', () => {
  const mods = [
    module_({ id: 'smart-money', confidence: 80 }),
    module_({ id: 'flow-intelligence', confidence: 70 }),
    module_({ id: 'holder-concentration', confidence: 60 }),
    module_({ id: 'pattern-memory', confidence: 50 }),
  ];

  it('weights the modules as documented', () => {
    expect(Object.values(WEIGHTS).reduce((a, b) => a + b, 0)).toBeCloseTo(1);
  });

  // Regression: a fatal trip used to clamp to exactly 35, so every broken
  // thesis scored identically regardless of the evidence behind it.
  it('penalises a fatal trip without collapsing every result to one number', () => {
    const strong = compositeScore(mods, [], [wire({ severity: 'fatal', status: 'tripped' })]);
    const weak = compositeScore(
      mods.map((m) => ({ ...m, confidence: 30 })),
      [],
      [wire({ severity: 'fatal', status: 'tripped' })],
    );
    expect(strong.score).not.toBe(weak.score);
    expect(strong.score).toBeGreaterThan(weak.score);
  });

  it('counts only bullish modules as support', () => {
    const r = compositeScore(
      [module_({ stance: 'bearish', confidence: 95 }), module_({ id: 'flow-intelligence', stance: 'bullish' })],
      [], [],
    );
    expect(r.leanPositive).toBe(1);
  });

  it('reports coverage separately from the score', () => {
    const thin = compositeScore(mods.map((m) => ({ ...m, coverage: 0.2 })), [], []);
    const full = compositeScore(mods, [], []);
    expect(thin.coverage).toBeLessThan(full.coverage);
  });
});

describe('coverage ceiling', () => {
  it('caps confidence when little data backed the read', () => {
    expect(capByCoverage(95, 0.1)).toBeLessThan(capByCoverage(95, 1));
  });

  it('never lets a module claim certainty', () => {
    expect(capByCoverage(100, 1)).toBeLessThanOrEqual(92);
  });
});

describe('spot contract filter', () => {
  // Regression: Hyperliquid perp rows carry the bare ticker as "address",
  // which the spot endpoints reject with invalid_field_value.
  it('rejects a ticker masquerading as an address', () => {
    expect(isSpotContract('SOL', 'SOL')).toBe(false);
    expect(isSpotContract('BTC', 'BTC')).toBe(false);
  });

  it('accepts real contracts across chains', () => {
    expect(isSpotContract('0x912ce59144191c1204e64559fe8253a0e49e6548', 'ARB')).toBe(true);
    expect(isSpotContract('So11111111111111111111111111111111111111112', 'SOL')).toBe(true);
    expect(isSpotContract('sol.omft.near', 'SOL')).toBe(true);
  });
});

describe('formatting', () => {
  it('does not round sub-cent prices to zero', () => {
    expect(priceLabel(0.00000382)).toBe('$0.00000382');
    expect(priceLabel(0.2245)).toBe('$0.2245');
    expect(priceLabel(113.44)).toBe('$113.44');
  });

  it('returns a dash rather than a fake zero for missing values', () => {
    expect(priceLabel(0)).toBe('n/a');
    expect(compactUsd(0)).toBe('n/a');
  });

  it('pulls a ticker out of free text', () => {
    expect(detectSymbol('Smart money is accumulating $SOL right now')).toBe('SOL');
    expect(detectSymbol('nothing to see here')).toBeNull();
  });

  // Regression: the sign was chosen before rounding, so a stablecoin's median
  // follow-through of -0.00004 printed as "-0.0%" — a negative that isn't one.
  it('never prints a negative zero', () => {
    expect(signedPct(-0.00004)).toBe('+0.0%');
    expect(signed(-0.04)).toBe('0');
    expect(signedPct(0.134)).toBe('+13.4%');
    expect(signedPct(-0.072)).toBe('-7.2%');
  });
});

describe('date windows', () => {
  // Regression: raw timestamps made every request body unique, which expired
  // the fixture cache nightly and multiplied credit spend.
  it('floors to whole days so repeat requests are identical', () => {
    const a = dayWindow(7);
    const b = dayWindow(7);
    expect(a).toEqual(b);
    expect(a.from.endsWith('T00:00:00.000Z')).toBe(true);
  });
});

describe('verdict language', () => {
  const agents: Agent[] = [
    {
      id: 'smart-money', name: 'Smart Money', subtitle: '', stance: 'bullish',
      confidence: 80, summary: 'x',
      bullets: [{
        label: 'Smart-trader net flow, 7d', display: '+$8.41M', tone: 'positive',
        provenance: { requestId: 'r', endpoint: 'e', field: 'f', creditsUsed: 1, fetchedAt: 'x', redistribution: 'attribution' },
      }],
    },
  ];

  it('calls a thesis right, wrong, or neither — never guessing the undecided', () => {
    expect(VERDICT.SUPPORTED).toBe('right');
    expect(VERDICT.INVALIDATED).toBe('wrong');
    expect(VERDICT.CHALLENGED).toBe('wrong');
    // A thesis that has neither held nor broken must stay open rather than
    // being forced into a verdict the evidence does not support.
    expect(VERDICT.MIXED).toBe('open');
    expect(VERDICT.UNDER_STRESS).toBe('open');
  });

  it('labels every state', () => {
    for (const k of ['SUPPORTED', 'CHALLENGED', 'MIXED', 'UNDER_STRESS', 'INVALIDATED'] as const) {
      expect(verdictLabel(k)).toBeTruthy();
    }
  });

  it('writes an observation that names the evidence', () => {
    const text = composeObservation(agents, [wire({ status: 'tripped' })], 'UNDER_STRESS');
    expect(text).toContain('Smart Money');
    expect(text).toContain('+$8.41M');
    expect(text.length).toBeGreaterThan(40);
  });

  it('has a verdict word for every state', () => {
    for (const k of ['SUPPORTED', 'CHALLENGED', 'MIXED', 'UNDER_STRESS', 'INVALIDATED'] as const) {
      expect(SENTIMENT[k]).toBeTruthy();
    }
  });
});

describe('verdict reasoning', () => {
  const agents: Agent[] = [
    {
      id: 'smart-money', name: 'Smart Money', subtitle: '', stance: 'bullish',
      confidence: 80, summary: 'x',
      bullets: [{
        label: 'Smart-trader net flow, 7d', display: '+$8.41M', tone: 'positive',
        provenance: { requestId: 'r', endpoint: 'tgm/flow-intelligence', field: 'f', creditsUsed: 1, fetchedAt: 'x', redistribution: 'attribution' },
      }],
    },
    {
      id: 'pattern-memory', name: 'Pattern Memory', subtitle: '', stance: 'bearish',
      confidence: 60, summary: 'y',
      bullets: [{
        label: 'Median follow-through', display: '-2.4%', tone: 'negative',
        provenance: { requestId: 'r', endpoint: 'tgm/token-ohlcv', field: 'f', creditsUsed: 1, fetchedAt: 'x', redistribution: 'attribution' },
      }],
    },
  ];

  it('names the module that actually carried the weight', () => {
    const r = explainVerdict(agents, [], [], 'SUPPORTED', 90);
    expect(r[0].kind).toBe('driver');
    expect(r[0].headline).toContain('Smart Money');
    expect(r[0].figure).toBe('+$8.41M');
    expect(r[0].source).toBe('tgm/flow-intelligence');
  });

  it('only calls an opposing stance a contradiction', () => {
    const r = explainVerdict(agents, [], [], 'MIXED', 90);
    const against = r.find((x) => x.kind === 'contradiction');
    expect(against?.headline).toContain('Pattern Memory');

    // Same stance, lower confidence: agreement, not contradiction.
    const agreeing = [agents[0], { ...agents[1], stance: 'bullish' as const }];
    expect(
      explainVerdict(agreeing, [], [], 'SUPPORTED', 90).some((x) => x.kind === 'contradiction'),
    ).toBe(false);
  });

  // Regression: a USD threshold rendered as seven bare digits.
  it('formats a condition figure by its unit', () => {
    const r = explainVerdict(agents, [wire({ status: 'tripped' })], [], 'INVALIDATED', 90);
    const cond = r.find((x) => x.kind === 'condition');
    expect(cond).toBeTruthy();
    expect(cond!.figure).not.toMatch(/\d{6,}/);
  });

  it('flags thin coverage as its own reason', () => {
    const thin = explainVerdict(agents, [], [], 'MIXED', 40);
    expect(thin.some((x) => x.kind === 'coverage')).toBe(true);
    const full = explainVerdict(agents, [], [], 'MIXED', 95);
    expect(full.some((x) => x.kind === 'coverage')).toBe(false);
  });
});

describe('claim shape', () => {
  // Regression: conditions were identical for every thesis. A claim that
  // retail is buying was invalidated by "fresh wallets are not the dominant
  // source of new demand" — which trips exactly when retail IS buying, so the
  // supporting evidence was counted as the contradicting evidence.
  it('recognises a retail-adoption claim', () => {
    const c = readClaim('$BEAT is being consumed by more retailers lately');
    expect(c.mechanism).toBe('retail');
    expect(c.direction).toBe('up');
    expect(c.mechanismStated).toBe(true);
  });

  it('recognises a smart-money accumulation claim', () => {
    const c = readClaim('Smart money is accumulating $SOL while retail dumps');
    expect(c.mechanism).toBe('smart-money');
    expect(c.direction).toBe('up');
  });

  it('reads direction from the sentence', () => {
    expect(readClaim('$PEPE is being distributed into strength').direction).toBe('down');
    expect(readClaim('$ARB breaks out this week').direction).toBe('up');
  });

  // Regression: "long" matched inside "long-held", flipping this sentence
  // bullish. Its near-twin with "early holders" read correctly, which is how
  // the bug stayed hidden.
  it('does not match a term inside a hyphenated word', () => {
    expect(readClaim('$SHIB is being distributed into strength by long-held wallets').direction).toBe('down');
    expect(readClaim('$PEPE is being distributed into strength by early holders').direction).toBe('down');
  });

  // Regression: "stopped bleeding" was read as bleeding.
  it('honours negation when reading direction', () => {
    expect(readClaim('$COMP has stopped bleeding supply onto exchanges').direction).toBe('up');
    expect(readClaim('$COMP is bleeding supply onto exchanges').direction).toBe('down');
  });

  // Regression: negation erased the topic along with the polarity, so a claim
  // about concentration stopped being about concentration.
  it('keeps the mechanism even when the sentence negates it', () => {
    const c = readClaim('$LINK accumulation is broad rather than driven by a few wallets');
    expect(c.mechanism).toBe('concentration');
    expect(c.direction).toBe('up');
  });

  it('matches plural cohort terms', () => {
    expect(readClaim('$USDT balances are leaving exchanges faster than they arrive').mechanism).toBe('exchange');
    expect(readClaim('fresh wallets are buying $ABC').mechanism).toBe('retail');
  });

  it('falls back to generic without pretending a mechanism was stated', () => {
    const c = readClaim('$XYZ goes up');
    expect(c.mechanism).toBe('generic');
    expect(c.mechanismStated).toBe(false);
  });
});

describe('condition metrics', () => {
  // Regression: three conditions compared a derived quantity but displayed a
  // raw API field name. Checking `fresh_wallets_net_flow_usd > 55` against
  // Nansen shows a six-figure USD number and the condition looks like nonsense
  // — the compared value is a percentage share.
  it('never labels a derived metric with a raw field name', () => {
    for (const [key, m] of Object.entries(METRIC)) {
      if (!m.derivedFrom) continue;
      expect(m.derivedFrom.length, key).toBeGreaterThan(0);
      // The derived name must not be one of the raw fields it is built from.
      expect(m.derivedFrom.map((f) => f.split(' ')[0]), key).not.toContain(m.field);
    }
  });

  it('gives every condition a unit that matches its name', () => {
    expect(METRIC['tw-fresh-share'].unit).toBe('pct');
    expect(METRIC['tw-deceleration'].unit).toBe('ratio');
    expect(METRIC['tw-concentration'].unit).toBe('ratio');
    expect(METRIC['tw-smart-netflow'].unit).toBe('usd');
    for (const m of Object.values(METRIC)) {
      if (m.unit === 'usd') expect(m.field).toMatch(/usd|close/);
    }
  });
});

describe('helpers', () => {
  it('clamps into range', () => {
    expect(clamp(150)).toBe(100);
    expect(clamp(-10)).toBe(0);
  });

  it('will not call a zero-direction read directional', () => {
    expect(stanceFrom(90, 0)).toBe('neutral');
  });
});
