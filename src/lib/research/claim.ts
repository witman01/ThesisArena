/**
 * Reads the shape of a thesis: which way it points, and what it says drives it.
 *
 * This exists because the conditions were previously identical for every
 * thesis. A claim that retail is buying a token was being invalidated by the
 * condition "fresh wallets are not the dominant source of new demand" — which
 * trips precisely when retail *is* buying. The evidence supporting the thesis
 * was being counted as the evidence against it.
 *
 * Deterministic keyword matching, no model call, consistent with the rest of
 * the research path: the same sentence always yields the same shape.
 */

export type Direction = 'up' | 'down';
export type Mechanism =
  | 'smart-money'
  | 'retail'
  | 'exchange'
  | 'concentration'
  | 'generic';

export interface ClaimShape {
  direction: Direction;
  mechanism: Mechanism;
  /** True when the sentence named a mechanism rather than defaulting. */
  mechanismStated: boolean;
}

const BEARISH = [
  'dump*', 'distribut*', 'sell*', 'fade*', 'top out',
  'topping', 'crash', 'bleed*', 'exit', 'rotate out', 'rotating out', 'unwind*',
  'decline*', 'drop', 'fall', 'falling', 'weaken*', 'weakening',
  'overvalued', 'correction', 'capitulat*', 'offload*', 'exhaust*', 'down',
  'lower', 'bearish', 'short', 'die', 'rug', 'abandon',
];

const BULLISH = [
  'accumulat*', 'breakout', 'break out', 'rally', 'adoption', 'growth',
  'demand', 'consum*', 'buying', 'bid', 'strength', 'strong', 'surge*',
  'climb*', 'recover*', 'bullish', 'long', 'moon', 'pump', 'uptrend', 'higher',
];

const MECHANISMS: { key: Mechanism; terms: string[] }[] = [
  {
    key: 'retail',
    terms: [
      'retail', 'fresh wallet*', 'new wallet*', 'new holder*', 'new buyer*',
      'adoption', 'consumer', 'consum*', 'user growth', 'crowd', 'normie',
      'late money', 'public', 'everyday', 'real user*',
      'late retail', 'small holder*',
    ],
  },
  {
    key: 'smart-money',
    terms: [
      'smart money', 'smart-money', 'smart trader*', 'smart wallet*', 'whale*',
      'insider*', 'sophisticated', 'informed', 'top pnl', 'top trader', 'sharp',
    ],
  },
  {
    key: 'exchange',
    terms: [
      'exchange*', 'cex', 'deposit*', 'withdraw*', 'off exchange*', 'onto exchange*',
      'supply on exchange*', 'binance', 'coinbase', 'leaving exchange*',
    ],
  },
  {
    key: 'concentration',
    terms: [
      'concentrat*', 'few address*', 'handful of', 'top holder*',
      'broad-based', 'broad based', 'distributed across', 'whale-dominated',
      'few wallet*', 'a handful', 'closely held',
    ],
  },
];

interface Match {
  count: number;
  /** Where the earliest term appears; Infinity when none do. */
  first: number;
}

/**
 * Negators that flip the term following them.
 *
 * "$COMP has stopped bleeding supply onto exchanges" is a bullish sentence
 * built from a bearish word, and reading it literally inverted the thesis.
 * "rather than" matters just as much: "late retail demand rather than smart
 * accumulation" is not a claim about accumulation.
 */
const NEGATORS = [
  'not', 'no longer', 'never', 'stopped', 'stops', 'ceased', 'without',
  'rather than', 'instead of', 'far from', 'failed to', 'fails to', "isn't",
  'is not', 'are not', "aren't", 'nothing',
];

/** How many characters back a negator still governs the term. */
const NEGATION_WINDOW = 28;

/**
 * Matches a term at word boundaries.
 *
 * Substring matching quietly broke direction: "long" is a bullish term and
 * matched inside "long-held", which flipped "$SHIB is being distributed into
 * strength by long-held wallets" from bearish to bullish.
 *
 * A term ending in `*` is a stem and may run on — "accumulat*" has to reach
 * "accumulating" — and everything else must end on a boundary too. A hyphen
 * counts as part of the word on both sides, since "long-held" is not "long".
 */
function findTerm(haystack: string, term: string): number[] {
  const stem = term.endsWith('*');
  const body = stem ? term.slice(0, -1) : term;
  const pattern = stem
    ? `(?<![a-z-])${escapeRe(body)}`
    : `(?<![a-z-])${escapeRe(body)}(?![a-z-])`;

  const out: number[] = [];
  const re = new RegExp(pattern, 'g');
  let m: RegExpExecArray | null;
  while ((m = re.exec(haystack)) !== null) out.push(m.index);
  return out;
}

function escapeRe(t: string): string {
  return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when a negator governs the term at this position. */
function negated(haystack: string, at: number): boolean {
  const before = haystack.slice(Math.max(0, at - NEGATION_WINDOW), at);
  return NEGATORS.some((n) => before.includes(n));
}

/**
 * Counts term matches.
 *
 * `honourNegation` is on for direction and off for mechanism, because a
 * negator changes a claim's polarity but not its subject. "Accumulation is
 * broad rather than driven by a few wallets" is still a claim about
 * concentration — discarding the term lost the topic along with the polarity.
 */
function hits(haystack: string, terms: string[], honourNegation: boolean): Match {
  let count = 0;
  let first = Infinity;
  for (const t of terms) {
    for (const at of findTerm(haystack, t)) {
      // A negated term is not evidence for its own side. It is dropped rather
      // than counted for the other, because "not falling" is weaker evidence
      // of rising than "rising" is.
      if (honourNegation && negated(haystack, at)) continue;
      count++;
      if (at < first) first = at;
    }
  }
  return { count, first };
}

/**
 * Ties break on position, because the earlier term is usually the predicate.
 *
 * "Smart money is accumulating $SOL while retail dumps" names both cohorts
 * once; the claim is about smart money, which is what the sentence leads with.
 * Likewise "distributed into strength" is a bearish claim with a bullish word
 * in it, not the other way round.
 */
function wins(a: Match, b: Match): boolean {
  if (a.count !== b.count) return a.count > b.count;
  return a.first < b.first;
}

export function readClaim(statement: string): ClaimShape {
  const s = ` ${statement.toLowerCase()} `;

  const down = hits(s, BEARISH, true);
  const up = hits(s, BULLISH, true);

  // With nothing to go on, assume bullish: it is the more common shape and
  // carries the stricter condition set.
  const direction: Direction = wins(down, up) ? 'down' : 'up';

  let mechanism: Mechanism = 'generic';
  let best: Match = { count: 0, first: Infinity };
  for (const m of MECHANISMS) {
    const n = hits(s, m.terms, false);
    if (n.count > 0 && wins(n, best)) {
      best = n;
      mechanism = m.key;
    }
  }

  return { direction, mechanism, mechanismStated: best.count > 0 };
}
