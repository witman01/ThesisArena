import type { Agent, Tripwire } from '@/lib/types';
import type { InvestigationStatus } from '@/lib/db/store';

/**
 * Turns the measured findings into an observation a person would write.
 *
 * A machine status like INVALIDATED says what happened to a flag; it does not
 * say what was *found*. This composes the actual observation from the module
 * outputs and the breached conditions, deterministically — same inputs, same
 * sentence, no model call.
 */

/**
 * The verdict.
 *
 * Deliberately thesis-relative rather than market-directional. A thesis can
 * itself be bearish, so calling the *result* "bearish" would read as a price
 * forecast the system does not make. These say only one thing: is the claim
 * surviving its own conditions?
 *
 * Earlier wording borrowed from a trading desk ("Faded", "Offside"). It was
 * evocative and it made every reader stop to decode it, which is the wrong
 * cost for the one word that carries the answer.
 */
export const SENTIMENT: Record<InvestigationStatus, string> = {
  SUPPORTED: 'Supported',
  CHALLENGED: 'Challenged',
  MIXED: 'Mixed',
  UNDER_STRESS: 'Under pressure',
  INVALIDATED: 'Invalidated',
};

/** One line explaining what that verdict means, in plain terms. */
export const SENTIMENT_NOTE: Record<InvestigationStatus, string> = {
  SUPPORTED:
    'Evidence currently supports the thesis and no decisive contradiction is present.',
  CHALLENGED: 'The available evidence is materially contradicting the thesis.',
  MIXED: 'Evidence is split across the research modules.',
  UNDER_STRESS:
    'One or more conditions are showing stress, but the thesis has not failed.',
  INVALIDATED: 'A fatal condition has been met.',
};

/**
 * Right or wrong — the answer a reader actually came for.
 *
 * Three outcomes rather than two, because a thesis that has neither held nor
 * broken is genuinely undecided, and forcing it into one or the other would be
 * the invention this product exists to avoid. Every verdict is framed "so far",
 * since the conditions are still being checked.
 */
export type Verdict = 'right' | 'wrong' | 'open';

export const VERDICT: Record<InvestigationStatus, Verdict> = {
  SUPPORTED: 'right',
  CHALLENGED: 'wrong',
  MIXED: 'open',
  UNDER_STRESS: 'open',
  INVALIDATED: 'wrong',
};

export function verdictLabel(status: InvestigationStatus): string {
  switch (VERDICT[status]) {
    case 'right':
      return 'So far: right';
    case 'wrong':
      return 'So far: wrong';
    case 'open':
      return 'Still open';
  }
}

export function verdictNote(status: InvestigationStatus): string {
  switch (status) {
    case 'SUPPORTED':
      return 'The evidence backs the thesis and every condition you set in advance is holding.';
    case 'CHALLENGED':
      return 'The modules read against the thesis as written. The evidence contradicts it.';
    case 'MIXED':
      return 'The evidence is genuinely split. Nothing here settles it either way.';
    case 'UNDER_STRESS':
      return 'The thesis remains open, but multiple pieces of evidence are moving against it.';
    case 'INVALIDATED':
      return 'A condition you set before any evidence was gathered has been met. On your own terms, the thesis is wrong.';
  }
}

function firstName(agents: Agent[], id: string): string {
  return agents.find((a) => a.id === id)?.name ?? id;
}

/**
 * Builds the observation.
 *
 * Reads as: what was found → what cuts against it → what has actually broken.
 */
export function composeObservation(
  agents: Agent[],
  tripwires: Tripwire[],
  status: InvestigationStatus,
): string {
  const parts: string[] = [];

  const ranked = [...agents].sort((a, b) => b.confidence - a.confidence);
  const lead = ranked[0];
  const dissent = ranked.find(
    (a) => a.stance === 'bearish' || a.stance === 'cautious',
  );

  // 1. The strongest reading, quoted from its own headline finding.
  if (lead) {
    const strongest = lead.bullets.find((b) => b.tone === 'positive') ?? lead.bullets[0];
    if (strongest?.display) {
      parts.push(
        `${lead.name} is the strongest read at ${lead.confidence}%, on ${lowerFirst(strongest.label)}: ${strongest.display}.`,
      );
    } else {
      parts.push(`${lead.name} is the strongest read at ${lead.confidence}%.`);
    }
  }

  // 2. What argues the other way.
  if (dissent && dissent.id !== lead?.id) {
    const against = dissent.bullets.find((b) => b.tone === 'negative');
    if (against?.display) {
      parts.push(
        `${dissent.name} cuts against it, on ${lowerFirst(against.label)}: ${against.display}.`,
      );
    } else {
      parts.push(`${dissent.name} disagrees at ${dissent.confidence}%.`);
    }
  }

  // 3. What has actually broken, which matters more than either opinion.
  const tripped = tripwires.filter((t) => t.status === 'tripped');
  const stressed = tripwires.filter((t) => t.status === 'stressed');
  const fatal = tripped.filter((t) => t.severity === 'fatal');

  if (fatal.length > 0) {
    parts.push(
      `A condition the thesis depended on has failed. ${lowerFirst(fatal[0].claim)} is no longer true.`,
    );
  } else if (tripped.length > 0) {
    parts.push(
      tripped.length === 1
        ? `One of ${tripwires.length} conditions has breached: ${lowerFirst(tripped[0].claim)}.`
        : `${tripped.length} of ${tripwires.length} conditions have breached, starting with ${lowerFirst(tripped[0].claim)}.`,
    );
  } else if (stressed.length > 0) {
    parts.push(
      stressed.length === 1
        ? 'No condition has broken yet, though one is close.'
        : `No condition has broken yet, though ${stressed.length} are close.`,
    );
  } else if (tripwires.length > 0) {
    parts.push(`All ${tripwires.length} conditions are still holding.`);
  }

  // 4. The net observation.
  parts.push(closing(status));

  return parts.join(' ');
}

function closing(status: InvestigationStatus): string {
  switch (status) {
    case 'SUPPORTED':
      return 'On the conditions set before any evidence was gathered, the thesis stands.';
    case 'CHALLENGED':
      return 'Taken together, the evidence reads against the thesis as written.';
    case 'MIXED':
      return 'The evidence is genuinely split, and nothing here settles it.';
    case 'UNDER_STRESS':
      return 'The thesis remains open, but multiple pieces of evidence are moving against it.';
    case 'INVALIDATED':
      return 'A condition set in advance has been met. The thesis is invalidated.';
  }
}

function lowerFirst(s: string): string {
  // Leave acronyms and tickers alone.
  if (/^[A-Z]{2,}/.test(s)) return s;
  return s.charAt(0).toLowerCase() + s.slice(1);
}

export { firstName };
