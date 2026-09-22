'use client';

import { useEffect, useRef } from 'react';
import type { Agent } from '@/lib/types';
import { STANCE_COLOR } from './arena';
import { ProvenanceDot } from './evidence';

/**
 * Agent detail, as a side drawer rather than a page.
 *
 * A page navigation loses the debate context; a drawer keeps the board behind
 * it so the reader can compare agents without re-orienting.
 */
export function AgentDrawer({
  agent,
  onClose,
}: {
  agent: Agent | null;
  onClose: () => void;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const open = agent !== null;

  // Escape to close, and lock the page behind the drawer.
  useEffect(() => {
    if (!open) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);

    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!agent) return null;

  const tone = STANCE_COLOR[agent.stance];
  const meter =
    agent.confidence >= 70
      ? 'var(--bullish)'
      : agent.confidence >= 45
        ? 'var(--cautious)'
        : 'var(--bearish)';

  return (
    <div className="fixed inset-0 z-50">
      <button
        type="button"
        aria-label="Close agent detail"
        onClick={onClose}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={`${agent.name} detail`}
        tabIndex={-1}
        className="absolute right-0 top-0 flex h-full w-full max-w-[460px] flex-col outline-none"
        style={{
          background: 'var(--bg)',
          borderLeft: '1px solid var(--border-strong)',
          animation: 'ta-drawer-in 320ms cubic-bezier(0.16, 1, 0.3, 1) both',
        }}
      >
        <header className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-[17px] font-semibold">{agent.name}</h2>
            <p className="mt-0.5 text-[12px] text-ink-muted">{agent.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-ink-muted transition-colors hover:text-ink"
            style={{ border: '1px solid var(--border-neutral)' }}
            aria-label="Close"
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <div className="grid grid-cols-2 gap-3">
            <Panel label="Stance">
              <span
                className="text-[19px] font-semibold capitalize"
                style={{ color: tone }}
              >
                {agent.stance}
              </span>
            </Panel>
            <Panel label="Confidence">
              <span
                className="tabular text-[19px] font-semibold"
                style={{ color: meter }}
              >
                {agent.confidence}%
              </span>
              <div
                className="mt-2 h-1 w-full overflow-hidden rounded-full"
                style={{ background: 'var(--surface-3)' }}
              >
                <div
                  className="h-full rounded-full"
                  style={{ width: `${agent.confidence}%`, background: meter }}
                />
              </div>
            </Panel>
          </div>

          <section className="mt-6">
            <SectionLabel>Read</SectionLabel>
            <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">
              {agent.summary}
            </p>
          </section>

          <section className="mt-6">
            <SectionLabel>Key findings</SectionLabel>
            <ul className="mt-3 space-y-2">
              {agent.bullets.map((b, i) => (
                <li
                  key={i}
                  className="rounded-xl px-4 py-3.5"
                  style={{
                    background: 'var(--surface-1)',
                    border: '1px solid var(--border-neutral)',
                  }}
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[12px] text-ink-muted">{b.label}</span>
                    <span
                      className="tabular shrink-0 text-[17px] font-semibold"
                      style={{
                        color:
                          b.tone === 'positive'
                            ? 'var(--bullish)'
                            : b.tone === 'negative'
                              ? 'var(--cautious)'
                              : 'var(--text-primary)',
                      }}
                    >
                      {b.display || '—'}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2 font-mono text-[10px] text-ink-muted">
                    <span>{b.provenance.endpoint}</span>
                    <span aria-hidden="true">·</span>
                    <span>{b.provenance.field}</span>
                    <ProvenanceDot provenance={b.provenance} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="mt-6">
            <SectionLabel>Provenance</SectionLabel>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
              Every figure above is bound to the request that produced it.
              Findings marked <span style={{ color: 'var(--cautious)' }}>derived</span>{' '}
              come from restricted endpoints and contribute only to a composite
              score — their raw values are never displayed.
            </p>
          </section>
        </div>

        <footer className="border-t px-5 py-4">
          <a
            href="https://app.nansen.ai"
            target="_blank"
            rel="noreferrer noopener"
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-[13.5px] font-semibold"
            style={{ background: 'var(--accent)', color: '#04120c' }}
          >
            View full Nansen data
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M7 17L17 7M9 7h8v8" />
            </svg>
          </a>
        </footer>
      </div>
    </div>
  );
}

function Panel({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-xl px-4 py-3.5"
      style={{
        background: 'var(--surface-1)',
        border: '1px solid var(--border-neutral)',
      }}
    >
      <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">
        {label}
      </div>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-ink-muted">
      {children}
    </h3>
  );
}
