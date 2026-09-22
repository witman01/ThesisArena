import type { IndependentSource } from '@/lib/types';

/**
 * Independent corroboration.
 *
 * Deliberately its own component with its own visual treatment. Nansen's
 * redistribution terms require a composite built on their signals to be
 * meaningfully combined with a substantial independent source — and a reader
 * must never be able to mistake one for the other. Nothing here is Nansen
 * data, and the panel says so.
 */
export function IndependentPanel({ sources }: { sources: IndependentSource[] }) {
  const agreeing = sources.filter((s) => s.agrees === true).length;
  const differing = sources.filter((s) => s.agrees === false).length;

  return (
    <section
      className="overflow-hidden rounded-[14px]"
      style={{
        background: 'var(--surface-1)',
        // A neutral border rather than the emerald edge used for Nansen
        // panels, so the two never read as the same family.
        border: '1px dashed var(--border-neutral)',
      }}
    >
      <header className="border-b border-dashed px-4 py-3.5">
        <div className="flex items-center gap-2">
          <ExternalMark />
          <h2 className="text-[13.5px] font-semibold">Independent corroboration</h2>
        </div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">
          Not Nansen data. Sourced separately and used only to corroborate or
          contradict the on-chain signal.
        </p>
      </header>

      {sources.length === 0 ? (
        <p className="px-4 py-5 text-[12.5px] text-ink-muted">
          No independent source resolved for this chain.
        </p>
      ) : (
        <>
          <ul className="divide-y divide-dashed">
            {sources.map((s, i) => (
              <li key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] text-ink-secondary">{s.metric}</p>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="tap-target font-mono text-[10px] text-ink-muted underline decoration-dotted underline-offset-2 transition-colors hover:text-ink-secondary"
                  >
                    {s.name} ↗
                  </a>
                </div>
                <span className="tabular shrink-0 font-mono text-[12.5px] font-medium">
                  {s.value}
                </span>
                <Agreement agrees={s.agrees} />
              </li>
            ))}
          </ul>

          <footer className="border-t border-dashed px-4 py-2.5 font-mono text-[10px] text-ink-muted">
            {agreeing} corroborate · {differing} contradict ·{' '}
            {sources.length - agreeing - differing} neutral
          </footer>
        </>
      )}
    </section>
  );
}

function Agreement({ agrees }: { agrees: boolean | null }) {
  const cfg =
    agrees === null
      ? { c: 'var(--neutral)', g: '·', l: 'Neutral' }
      : agrees
        ? { c: 'var(--accent)', g: '▲', l: 'Agrees' }
        : { c: 'var(--bearish)', g: '▼', l: 'Differs' };

  return (
    <span
      className="flex w-[58px] shrink-0 items-center gap-1 font-mono text-[9px] uppercase tracking-wider"
      style={{ color: cfg.c }}
    >
      <span aria-hidden="true">{cfg.g}</span>
      {cfg.l}
    </span>
  );
}

function ExternalMark() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="var(--text-muted)"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M7 17L17 7M9 7h8v8" />
    </svg>
  );
}
