'use client';

import { useState } from 'react';
import type { Agent, AgentBullet, DebateMessage } from '@/lib/types';
import { STANCE_COLOR } from './arena';
import { ProvenanceDot } from './evidence';

/**
 * The debate transcript.
 *
 * Every turn carries the evidence it rests on, collapsed by default. That is
 * the difference between agents that appear to argue and agents whose claims
 * can be checked: the reader can open any statement and see the measurement.
 */
export function DebateTimeline({
  messages,
  agents,
  onInspect,
}: {
  messages: DebateMessage[];
  agents: Agent[];
  onInspect?: (agent: Agent) => void;
}) {
  const byId = new Map(agents.map((a) => [a.id, a]));

  return (
    <ol className="space-y-2.5">
      {messages.map((m) => (
        <DebateTurn
          key={m.id}
          message={m}
          agent={byId.get(m.agentId)}
          challenged={m.challenges ? byId.get(m.challenges) : undefined}
          onInspect={onInspect}
        />
      ))}
    </ol>
  );
}

function DebateTurn({
  message: m,
  agent,
  challenged,
  onInspect,
}: {
  message: DebateMessage;
  agent?: Agent;
  challenged?: Agent;
  onInspect?: (agent: Agent) => void;
}) {
  const [open, setOpen] = useState(false);
  const tone = agent ? STANCE_COLOR[agent.stance] : 'var(--neutral)';
  const isChallenge = Boolean(m.challenges);

  const time = new Date(m.at).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <li
      className="overflow-hidden rounded-xl"
      style={{
        background: isChallenge ? 'var(--surface-2)' : 'var(--surface-1)',
        border: `1px solid ${isChallenge ? 'color-mix(in srgb, var(--cautious) 34%, transparent)' : 'var(--border-neutral)'}`,
      }}
    >
      {isChallenge && challenged && (
        <div
          className="flex items-center gap-2 px-4 py-2"
          style={{
            background: 'color-mix(in srgb, var(--cautious) 10%, transparent)',
            borderBottom:
              '1px solid color-mix(in srgb, var(--cautious) 24%, transparent)',
          }}
        >
          <Swords />
          <span
            className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em]"
            style={{ color: 'var(--cautious)' }}
          >
            Challenge
          </span>
          <span className="font-mono text-[10.5px] text-ink-muted">
            {agent?.name} → {challenged.name}
          </span>
        </div>
      )}

      <div className="px-4 py-3.5">
        <div className="flex items-center gap-2.5">
          <span
            className="h-[7px] w-[7px] shrink-0 rounded-full"
            style={{ background: tone }}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => agent && onInspect?.(agent)}
            className="tap-target text-[13.5px] font-semibold transition-opacity hover:opacity-75"
            style={{ color: tone }}
          >
            {agent?.name ?? m.agentId}
          </button>
          <span className="tabular ml-auto font-mono text-[10.5px] text-ink-muted">
            {time}
          </span>
        </div>

        <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">
          {m.text}
        </p>

        {m.evidence.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-mono text-[10.5px] transition-colors"
              style={{
                color: 'var(--accent)',
                border: '1px solid var(--border-strong)',
              }}
            >
              {m.evidence.length} evidence point
              {m.evidence.length === 1 ? '' : 's'}
              <svg
                width="11"
                height="11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
                style={{
                  transform: open ? 'rotate(90deg)' : 'none',
                  transition: 'transform 200ms',
                }}
              >
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>

            {open && <EvidenceTable rows={m.evidence} />}
          </>
        )}
      </div>
    </li>
  );
}

function EvidenceTable({ rows }: { rows: AgentBullet[] }) {
  return (
    <div
      className="mt-3 overflow-hidden rounded-lg"
      style={{
        background: 'var(--bg)',
        border: '1px solid var(--border-neutral)',
      }}
    >
      <table className="w-full">
        <caption className="sr-only">Evidence behind this statement</caption>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              style={{
                borderTop: i ? '1px solid var(--border-neutral)' : undefined,
              }}
            >
              <th
                scope="row"
                className="px-3.5 py-2.5 text-left text-[12px] font-normal text-ink-muted"
              >
                {r.label}
              </th>
              <td
                className="tabular px-3.5 py-2.5 text-right text-[13px] font-semibold"
                style={{
                  color:
                    r.tone === 'positive'
                      ? 'var(--bullish)'
                      : r.tone === 'negative'
                        ? 'var(--cautious)'
                        : 'var(--text-primary)',
                }}
              >
                {r.display || 'n/a'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3.5 py-2.5 font-mono text-[10px] text-ink-muted"
        style={{ borderTop: '1px solid var(--border-neutral)' }}
      >
        <span>Source</span>
        {[...new Set(rows.map((r) => r.provenance.endpoint))].map((e) => (
          <span key={e} style={{ color: 'var(--accent)' }}>
            {e}
          </span>
        ))}
        <ProvenanceDot provenance={rows[0].provenance} />
      </div>
    </div>
  );
}

function Swords() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--cautious)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14.5 17.5L3 6V3h3l11.5 11.5M13 19l6-6M16 16l4 4M19 21l2-2" />
      <path d="M9.5 17.5L21 6V3h-3L6.5 14.5M11 19l-6-6M8 16l-4 4M5 21l-2-2" />
    </svg>
  );
}
