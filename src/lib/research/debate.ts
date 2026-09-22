import type { Agent, AgentId, DebateMessage } from '@/lib/types';

/**
 * Builds the debate transcript from what the modules actually found.
 *
 * A challenge is not scripted: it is emitted when two modules genuinely
 * disagree — one leaning bullish, another cautious or bearish — and the
 * challenger's own evidence is attached so the disagreement is inspectable
 * rather than rhetorical.
 */

const STANCE_RANK: Record<string, number> = {
  bullish: 2,
  neutral: 1,
  cautious: -1,
  bearish: -2,
};

function at(base: number, offsetSec: number): string {
  return new Date(base + offsetSec * 1000).toISOString();
}

export function buildDebate(agents: Agent[], startedAt = Date.now()): DebateMessage[] {
  const out: DebateMessage[] = [];
  let t = 0;

  // Opening statements, strongest conviction first — the loudest claim is the
  // one worth attacking.
  const ordered = [...agents].sort((a, b) => b.confidence - a.confidence);

  for (const a of ordered) {
    out.push({
      id: `msg-${a.id}-open`,
      agentId: a.id,
      at: at(startedAt, (t += 42)),
      text: a.summary,
      evidence: a.bullets,
    });
  }

  // The sharpest disagreement in the room.
  const supporters = agents.filter((a) => STANCE_RANK[a.stance] > 0);
  const objectors = agents.filter((a) => STANCE_RANK[a.stance] < 0);

  if (supporters.length && objectors.length) {
    const champion = supporters.reduce((x, y) =>
      y.confidence > x.confidence ? y : x,
    );
    const critic = objectors.reduce((x, y) => (y.confidence > x.confidence ? y : x));

    const sharpest =
      critic.bullets.find((b) => b.tone === 'negative') ?? critic.bullets[0];

    out.push({
      id: 'msg-challenge',
      agentId: critic.id,
      challenges: champion.id,
      at: at(startedAt, (t += 55)),
      text: `${champion.name}'s read may be misleading. ${sharpest.label} reads ${sharpest.display}, which cuts against the conclusion being drawn.`,
      evidence: [sharpest],
    });

    const defence =
      champion.bullets.find((b) => b.tone === 'positive') ?? champion.bullets[0];

    out.push({
      id: 'msg-response',
      agentId: champion.id,
      at: at(startedAt, (t += 48)),
      text: `Acknowledged, and it lowers my conviction rather than reversing it. ${defence.label} still reads ${defence.display}, which is the stronger of the two signals on this horizon.`,
      evidence: [defence],
    });
  }

  return out;
}

/** Reverse lookup for rendering — agent id to display name. */
export function agentName(agents: Agent[], id: AgentId): string {
  return agents.find((a) => a.id === id)?.name ?? id;
}
