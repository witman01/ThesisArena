import type { IndependentSource, Severity, Tripwire, TripwireStatus } from '@/lib/types';
import { ENDPOINTS } from '@/lib/nansen/endpoints';
import type { ResearchResult } from './types';
import { readClaim, type ClaimShape } from './claim';
import { clamp } from './types';

/**
 * Stress-test engine.
 *
 * Thresholds are derived from what was actually measured, and evaluation is
 * pure arithmetic — no model call anywhere in this file. That is the whole
 * point: a thesis is only testable if the test is mechanical.
 */

/**
 * What each condition actually compares.
 *
 * Three of these are derived quantities rather than raw API fields, and they
 * used to be labelled with the raw field anyway. That made them impossible to
 * check: a reader verifying `fresh_wallets_net_flow_usd > 55` against Nansen
 * sees a USD figure in the hundreds of thousands, concludes the condition is
 * nonsense, and is right to. The compared value is a percentage share.
 *
 * Keyed by wire id, which is also what monitoring re-reads by, so renaming a
 * field here cannot desynchronise the checker.
 */
export const METRIC: Record<
  string,
  { field: string; unit: Tripwire['metric']['unit']; derivedFrom?: string[] }
> = {
  'tw-smart-netflow': { field: 'smart_trader_net_flow_usd', unit: 'usd' },
  'tw-deceleration': {
    field: 'smart_trader_flow_acceleration',
    unit: 'ratio',
    derivedFrom: ['smart_trader_net_flow_usd (6h rate vs 7d rate)'],
  },
  'tw-fresh-share': {
    field: 'fresh_wallet_share_of_cohort_flow',
    unit: 'pct',
    derivedFrom: [
      'fresh_wallets_net_flow_usd',
      'smart_trader_net_flow_usd',
      'exchange_net_flow_usd',
    ],
  },
  'tw-exchange-inflow': { field: 'exchange_net_flow_usd', unit: 'usd' },
  'tw-concentration': {
    field: 'top3_share_of_trade_volume',
    unit: 'ratio',
    derivedFrom: ['trade_volume_usd'],
  },
  'tw-price': { field: 'close', unit: 'usd' },
};

interface Ctx {
  smart: ResearchResult & { metrics: Record<string, number | null> };
  flow: ResearchResult;
  holder: ResearchResult;
  pattern: ResearchResult;
  /** The claim itself. Conditions are oriented to it, not to a template. */
  statement: string;
}

function wire(
  id: string,
  claim: string,
  endpointKey: keyof typeof ENDPOINTS,
  comparator: '<' | '>',
  threshold: number,
  current: number,
  sustain: string,
  severity: Severity,
  /**
   * False when the endpoint returned nothing for this cohort. An absent
   * reading is not a reading of zero, and must not be scored as pressure.
   */
  observed = true,
  history: number[] = [],
): Tripwire {
  const spec = ENDPOINTS[endpointKey];
  const { field, unit, derivedFrom } = METRIC[id];

  // Proximity: how far the metric has travelled from a safe anchor toward the
  // threshold. 1 means the condition is met right now.
  const span = Math.abs(threshold) || 1;
  const distance =
    comparator === '<'
      ? (current - threshold) / span
      : (threshold - current) / span;
  const proximity = observed ? clamp(1 - distance, 0, 1) : 0;

  const tripped =
    observed && (comparator === '<' ? current < threshold : current > threshold);

  // A condition with no data behind it reads as holding at zero proximity.
  // Treating an empty cohort as a reading of zero manufactured "stressed" out
  // of absence — a token nobody tracked looked like a thesis under pressure.
  const status: TripwireStatus = !observed
    ? 'holding'
    : tripped
      ? 'tripped'
      : proximity > 0.7
        ? 'stressed'
        : 'holding';

  return {
    id,
    claim,
    metric: { endpoint: spec.path, field, unit, derivedFrom },
    comparator,
    threshold,
    sustain,
    severity,
    status,
    currentValue: current,
    proximity,
    history: history.length ? history : [current],
    provenance: {
      requestId: 'live',
      endpoint: spec.path,
      field,
      creditsUsed: spec.credits,
      fetchedAt: new Date().toISOString(),
      redistribution: spec.redistribution,
    },
  };
}

export function buildTripwires(ctx: Ctx): Tripwire[] {
  const out: Tripwire[] = [];

  // What the thesis actually claims. Conditions are oriented to this, because
  // a condition that contradicts a template is not a condition that
  // contradicts the user.
  const claim: ClaimShape = readClaim(ctx.statement);
  const bearish = claim.direction === 'down';

  // Only the mechanism the thesis names can be fatal to it. A claim about
  // retail adoption does not die because smart money went flat that day.
  const fatalIf = (m: ClaimShape['mechanism']): Severity =>
    claim.mechanism === m || !claim.mechanismStated ? 'fatal' : 'minor';

  // 1. The mechanism the thesis actually rests on.
  const net7d = ctx.smart.metrics.netFlow7d ?? 0;
  const net1d = ctx.smart.metrics.netFlow1d ?? 0;

  // Whether the smart-trader cohort reported anything for this token.
  //
  // Tested per cohort, not across all of them: a token can have busy exchange
  // flow and no tracked smart traders at all, and reading that cohort's zero
  // as "flow is exactly flat" put the condition at maximum proximity and
  // labelled a thesis stressed on the strength of data that did not exist.
  const smartObserved =
    (ctx.smart.metrics.horizonsCovered ?? 0) > 0 &&
    Math.abs(net7d) + Math.abs(net1d) > 0;
  out.push(
    wire(
      'tw-smart-netflow',
      bearish
        ? 'Smart money keeps stepping away rather than bidding'
        : 'Smart-money accumulation stays positive on the day',
      'flowIntelligence',
      bearish ? '>' : '<',
      0,
      net1d,
      '6h consecutive',
      fatalIf('smart-money'),
      smartObserved,
    ),
  );

  // 2. Deceleration: still positive, but losing force.
  const accel = ctx.smart.metrics.acceleration ?? 0;
  out.push(
    wire(
      'tw-deceleration',
      bearish
        ? 'Selling pressure is not already exhausting itself'
        : 'Accumulation is not decelerating toward a stall',
      'flowIntelligence',
      bearish ? '>' : '<',
      bearish ? 0.75 : -0.75,
      accel,
      '3 consecutive reads',
      claim.mechanism === 'smart-money' ? 'major' : 'minor',
      smartObserved,
    ),
  );

  // 3. Fresh-wallet demand.
  //
  // Measured against total cohort activity, not against smart-money flow: a
  // near-zero denominator made the ratio explode to meaningless values.
  //
  // The orientation is the important part. For most theses, heavy fresh-wallet
  // demand is the late-retail distribution tell and trips the condition. But
  // when the thesis *is* that retail is arriving, that same reading is the
  // thesis working — so the condition inverts and asks whether retail demand
  // has fallen away instead. Testing it the other way invalidated a retail
  // thesis using the evidence that supported it.
  // Measured on the day when the day has data, and on the week when it does
  // not. A thinly traded token reports no fresh-wallet flow in 24h while the
  // week is plainly non-zero, and reading the quiet day as "retail has left"
  // killed a retail thesis on the strength of an empty window.
  const fresh1d = Math.abs(ctx.smart.metrics.freshWallets1d ?? 0);
  const fresh7d = Math.abs(ctx.smart.metrics.freshWallets7d ?? 0);
  const onDay = fresh1d > 0;
  const fresh = onDay ? fresh1d : fresh7d;
  const cohortTotal = onDay
    ? fresh1d + Math.abs(net1d) + Math.abs(ctx.smart.metrics.exchange1d ?? 0)
    : fresh7d + Math.abs(net7d) + Math.abs(ctx.smart.metrics.exchange7d ?? 0);

  const freshObserved = fresh > 0 && cohortTotal > 1_000;
  const freshShare = freshObserved ? (fresh / cohortTotal) * 100 : 0;
  const retailThesis = claim.mechanism === 'retail' && !bearish;

  // The floor sits below what was actually measured, so the condition asks for
  // a real deterioration. A fixed floor above the opening reading would be met
  // the moment it was written, which is a fact about the past rather than a
  // test of the future.
  const freshFloor = Math.max(5, Math.round(freshShare * 0.5));

  out.push(
    wire(
      'tw-fresh-share',
      retailThesis
        ? 'Retail stays the dominant source of new demand'
        : 'Fresh wallets are not the dominant source of new demand',
      'flowIntelligence',
      retailThesis ? '<' : '>',
      retailThesis ? freshFloor : 55,
      freshShare,
      onDay ? 'single read' : 'single read (7d basis)',
      retailThesis ? 'fatal' : 'major',
      freshObserved,
    ),
  );

  // 4. Supply returning to exchanges — read from the cohort feed, since the
  // token-level cex split is null for many assets.
  const cex = ctx.smart.metrics.exchange1d ?? 0;
  const cexLimit = Math.max(Math.abs(net7d) * 0.3, 250_000);
  out.push(
    wire(
      'tw-exchange-inflow',
      bearish
        ? 'Supply keeps rotating back onto exchanges'
        : 'Supply is not rotating back onto exchanges',
      'flowIntelligence',
      bearish ? '<' : '>',
      bearish ? -cexLimit : cexLimit,
      cex,
      '2 consecutive reads',
      claim.mechanism === 'exchange' ? 'fatal' : 'major',
    ),
  );

  // 5. Concentration — dump risk from a handful of addresses.
  const conc = (ctx.holder.metrics.concentration as number) ?? 0;
  out.push(
    wire(
      'tw-concentration',
      'Activity does not bunch into a handful of addresses',
      'whoBoughtSold',
      '>',
      0.55,
      conc,
      '2 consecutive reads',
      'minor',
    ),
  );

  // 6. Price invalidation, anchored to the base the move built from.
  //
  // Deliberately NOT derived from the current return: that made the level a
  // function of price itself, so the wire tripped the instant price was down
  // over the window regardless of what the flows said.
  const lastClose = (ctx.pattern.metrics.lastClose as number) ?? 0;
  const swingLow = (ctx.pattern.metrics.swingLow as number) ?? 0;
  const swingHigh = (ctx.pattern.metrics.recentHigh as number) ?? 0;

  // A bearish call is invalidated by strength, not by weakness. Anchoring it
  // to the swing low would have made the condition trip when the thesis was
  // being proved right.
  const anchor = bearish ? swingHigh : swingLow;
  if (lastClose > 0 && anchor > 0) {
    // A little past the level, to allow noise either side.
    const level = bearish ? anchor * 1.02 : anchor * 0.98;
    out.push(
      wire(
        'tw-price',
        bearish
          ? 'Price fails to reclaim the high this move broke down from'
          : 'Price holds the base this move built from',
        'ohlcv',
        bearish ? '>' : '<',
        Number(level.toPrecision(4)),
        lastClose,
        '3 consecutive closes',
        'fatal',
      ),
    );
  }

  return out;
}

// ---------------------------------------------------------------------------
// Deterministic re-evaluation — what the monitor calls on every poll.
// ---------------------------------------------------------------------------

export function evaluate(tw: Tripwire, nextValue: number): Tripwire {
  const span = Math.abs(tw.threshold) || 1;
  const distance =
    tw.comparator === '<'
      ? (nextValue - tw.threshold) / span
      : (tw.threshold - nextValue) / span;
  const proximity = clamp(1 - distance, 0, 1);
  const tripped =
    tw.comparator === '<' ? nextValue < tw.threshold : nextValue > tw.threshold;

  return {
    ...tw,
    currentValue: nextValue,
    proximity,
    status: tripped ? 'tripped' : proximity > 0.7 ? 'stressed' : 'holding',
    history: [...tw.history, nextValue].slice(-24),
  };
}

// ---------------------------------------------------------------------------
// Composite score
// ---------------------------------------------------------------------------

export const WEIGHTS = {
  'smart-money': 0.35,
  'flow-intelligence': 0.25,
  'holder-concentration': 0.2,
  'pattern-memory': 0.2,
} as const;

export function compositeScore(
  results: ResearchResult[],
  independent: IndependentSource[],
  tripwires: Tripwire[],
): { score: number; label: string; leanPositive: number; coverage: number } {
  const base = results.reduce((n, r) => {
    const w = WEIGHTS[r.id as keyof typeof WEIGHTS] ?? 0;
    return n + r.confidence * w;
  }, 0);

  // Independent corroboration nudges, it does not dominate — this is the
  // "meaningfully combined" requirement, weighted honestly.
  const votes = independent.filter((s) => s.agrees !== null);
  const agreeing = votes.filter((s) => s.agrees).length;
  const tilt = votes.length ? ((agreeing / votes.length) * 2 - 1) * 6 : 0;

  // A tripped fatal condition caps the score no matter how good the evidence.
  const fatalTripped = tripwires.some(
    (t) => t.severity === 'fatal' && t.status === 'tripped',
  );

  const raw = clamp(base + tilt);

  // A met fatal condition is a heavy penalty, not a fixed number. Clamping to
  // a constant pinned every broken thesis to the same score and threw away
  // the difference between a narrowly-broken case and a badly-broken one.
  const score = Math.round(fatalTripped ? clamp(raw - 30, 5, 45) : raw);

  const label =
    score >= 70
      ? 'Strongly supported'
      : score >= 55
        ? 'Moderately supported'
        : score >= 40
          ? 'Contested'
          : 'Weakly supported';

  // Only a bullish stance counts as positive. Confidence measures how sure a
  // module is, not which way it leans — a 90%-confident bearish read is the
  // strongest possible argument *against* the thesis.
  const leanPositive = results.filter((r) => r.stance === 'bullish').length;

  // Weighted by the same module weights: a thin read from a heavily-weighted
  // module hurts overall coverage more than a thin read from a light one.
  const coverage = Math.round(
    results.reduce((n, r) => {
      const w = WEIGHTS[r.id as keyof typeof WEIGHTS] ?? 0;
      return n + (r.coverage ?? 0) * w;
    }, 0) * 100,
  );

  return { score, label, leanPositive, coverage };
}
