'use client';

import { useState } from 'react';
import type { Agent, DebateMessage } from '@/lib/types';
import { AgentGrid } from './arena';
import { AgentDrawer } from './agent-drawer';
import { DebateTimeline } from './debate';

/**
 * The agent board and the transcript, sharing one drawer.
 *
 * Drawer state lives at this level deliberately: clicking a card in the grid
 * and clicking a speaker's name in the debate should open the same panel, so
 * inspecting an agent works from wherever its claim is being read.
 */
export function ArenaBoard({
  agents,
  debate,
}: {
  agents: Agent[];
  debate: DebateMessage[];
}) {
  const [selected, setSelected] = useState<Agent | null>(null);

  return (
    <>
      <AgentGrid agents={agents} onInspect={setSelected} />

      {debate.length > 0 && (
        <section className="mt-12">
          <div className="mb-5 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div>
              <div className="flex items-center gap-2">
                <span
                  className="live-dot h-[7px] w-[7px] rounded-full"
                  style={{ background: 'var(--accent)' }}
                  aria-hidden="true"
                />
                <span
                  className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: 'var(--accent)' }}
                >
                  Live debate
                </span>
              </div>
              <h3 className="mt-2 text-[20px] font-semibold tracking-tight">
                Where they disagree
              </h3>
            </div>
            <p className="max-w-[46ch] text-[12.5px] text-ink-muted">
              Open any statement to see the measurement behind it.
            </p>
          </div>

          <DebateTimeline
            messages={debate}
            agents={agents}
            onInspect={setSelected}
          />
        </section>
      )}

      <AgentDrawer agent={selected} onClose={() => setSelected(null)} />
    </>
  );
}
