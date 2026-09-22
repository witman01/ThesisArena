import type { Agent, IndependentSource, Tripwire } from '@/lib/types';
import type { InvestigationStatus } from '@/lib/db/store';
import { metricValue } from '@/lib/format';
import { WEIGHTS } from './falsify';

/**
 * Why the verdict is what it is.
 *
 * The score answers "how strong"; this answers "on the strength of what". Both
 * are derived from the same stored measurements — nothing here is generated,
 * inferred or written by a model, and every line carries the figure it rests
 * on so a reader can check it against Nansen directly.
 *
 * What this deliberately does not do is invent context. There is no news feed,
 * no launch calendar and no social signal in this system, so a reason is never
 * "the token launched a product" or "sentiment turned". The available context
 * is market-wide: chain TVL and stablecoin supply from DeFiLlama, which is
 * fetched independently of Nansen and reported as its own reason.
 */

export type ReasonKind =
  | 'driver'
  | 'contradiction'
  | 'condition'
  | 'market'
  | 'coverage';

export interface Reason {
  kind: ReasonKind;
  /** Short headline, e.g. "Smart Money carried the read". */
  headline: string;
  /** The measurement this rests on, e.g. "+$8.41M". Empty when qualitative. */
  figure: string;
  /** One sentence explaining what the figure means for the thesis. */
  detail: string;
  /** Where the number came from, for the provenance line. */
  source: string;
  tone: 'positive' | 'negative' | 'neutral';
}

/** A module's share of the composite, as a percentage of the total weight. */
function contribution(a: Agent): number {
  return a.confidence * (WEIGHTS[a.id as keyof typeof WEIGHTS] ?? 0);
}

function pct(n: number): string {
  return `${Math.round(n)}%`;
}

/**
 * Builds the ordered list of reasons behind a verdict.
 *
 * Ordered by what actually moved the outcome: the module that contributed most
 * weight, then whatever pulled against it, then any condition that changed
 * state, then the independent market read, then gaps in coverage.
 */
export function explainVerdict(
  agents: Agent[],
  tripwires: Tripwire[],
  independent: IndependentSource[],
  status: InvestigationStatus,
  coverage: number,
): Reason[] {
  const reasons: Reason[] = [];
  if (agents.length === 0) return reasons;

  const ranked = [...agents].sort((a, b) => contribution(b) - contribution(a));
  const totalWeight = agents.reduce(
    (n, a) => n + (WEIGHTS[a.id as keyof typeof WEIGHTS] ?? 0),
    0,
  );

  // 1. What carried the read.
  const lead = ranked[0];
  const leadWeight = WEIGHTS[lead.id as keyof typeof WEIGHTS] ?? 0;
  const leadShare = totalWeight > 0 ? (leadWeight / totalWeight) * 100 : 0;
  const leadBullet =
    lead.bullets.find((b) => b.tone !== 'neutral') ?? lead.bullets[0];

  reasons.push({
    kind: 'driver',
    headline: `${lead.name} carried the read`,
    figure: leadBullet?.display ?? `${lead.confidence}%`,
    detail:
      `It read ${lead.confidence}% at ${pct(leadShare)} of the composite weight` +
      (leadBullet ? `, on ${leadBullet.label.toLowerCase()}.` : '.'),
    source: leadBullet?.provenance.endpoint ?? 'nansen',
    tone: lead.stance === 'bullish' ? 'positive' : lead.stance === 'bearish' ? 'negative' : 'neutral',
  });

  // 2. What pulled the other way. Only a genuine opposing stance counts —
  //    a module that merely scored lower is not a contradiction.
  const opposed = ranked.find(
    (a) => a.id !== lead.id && a.stance !== lead.stance && a.stance !== 'neutral',
  );
  if (opposed) {
    const against =
      opposed.bullets.find((b) => b.tone === 'negative') ?? opposed.bullets[0];
    reasons.push({
      kind: 'contradiction',
      headline: `${opposed.name} read the other way`,
      figure: against?.display ?? `${opposed.confidence}%`,
      detail: against
        ? `${against.label} came back at ${against.display}, which does not fit the lead read.`
        : `It reached the opposite stance at ${opposed.confidence}%.`,
      source: against?.provenance.endpoint ?? 'nansen',
      tone: 'negative',
    });
  }

  // 3. Conditions that actually moved, worst first. These are the strongest
  //    reasons available because the level was fixed before any evidence.
  const moved = tripwires
    .filter((t) => t.status !== 'holding')
    .sort((a, b) => {
      const rank = { fatal: 0, major: 1, minor: 2 } as const;
      if (a.status !== b.status) return a.status === 'tripped' ? -1 : 1;
      return rank[a.severity] - rank[b.severity];
    });

  for (const t of moved.slice(0, 2)) {
    reasons.push({
      kind: 'condition',
      headline:
        t.status === 'tripped'
          ? `A ${t.severity} condition was met`
          : 'A condition is under pressure',
      // Formatted by the metric's own unit, so a dollar figure reads as
      // dollars rather than seven bare digits.
      figure: `${metricValue(t.currentValue, t.metric.unit)} vs ${metricValue(t.threshold, t.metric.unit)}`,
      detail:
        `"${t.claim}" was set before any evidence was weighed. ` +
        `${t.metric.field} is now ${metricValue(t.currentValue, t.metric.unit)}, ` +
        `against a ${t.comparator === '<' ? 'floor' : 'ceiling'} of ` +
        `${metricValue(t.threshold, t.metric.unit)}.`,
      source: t.metric.endpoint,
      tone: t.status === 'tripped' ? 'negative' : 'neutral',
    });
  }

  // 4. Market conditions, from the independent source rather than Nansen.
  //    This is the only "what else was going on" the system actually has.
  const decided = independent.filter((s) => s.agrees !== null);
  if (decided.length > 0) {
    const agreeing = decided.filter((s) => s.agrees).length;
    const lead2 = decided[0];
    reasons.push({
      kind: 'market',
      headline:
        agreeing === decided.length
          ? 'Market conditions point the same way'
          : agreeing === 0
            ? 'Market conditions point the other way'
            : 'Market conditions are split',
      figure: lead2.value,
      detail:
        `${lead2.metric} from ${lead2.name}, read independently of Nansen. ` +
        `${agreeing} of ${decided.length} independent measures line up with the thesis.`,
      source: lead2.name,
      tone: agreeing === decided.length ? 'positive' : agreeing === 0 ? 'negative' : 'neutral',
    });
  }

  // 5. What the verdict could not see. A thin read is a reason in itself.
  if (coverage < 70) {
    const thin = agents
      .filter((a) => a.bullets.some((b) => /not covered|unsupported|unavailable/i.test(b.display)))
      .map((a) => a.name);
    reasons.push({
      kind: 'coverage',
      headline: 'The read is thinner than usual',
      figure: `${coverage}%`,
      detail: thin.length
        ? `${thin.join(' and ')} could not be measured for this asset, so the verdict rests on the remaining modules.`
        : 'Some endpoints returned less data than normal, so confidence is capped below what the signal alone would give.',
      source: 'coverage',
      tone: 'neutral',
    });
  }

  return reasons;
}

/** A single sentence tying the reasons to the verdict, for the share card. */
export function explainOneLine(reasons: Reason[], status: InvestigationStatus): string {
  const driver = reasons.find((r) => r.kind === 'driver');
  const condition = reasons.find((r) => r.kind === 'condition');

  if (status === 'INVALIDATED' && condition) {
    return `Invalidated because ${condition.detail.split('. ')[1] ?? condition.detail}`;
  }
  if (driver && condition) {
    return `${driver.headline} at ${driver.figure}, but ${condition.headline.toLowerCase()} (${condition.figure}).`;
  }
  if (driver) return `${driver.headline} at ${driver.figure}.`;
  return '';
}
