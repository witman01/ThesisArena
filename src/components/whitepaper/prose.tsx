import Link from 'next/link';

/**
 * Prose primitives for the whitepaper.
 *
 * Deliberately a small, fixed vocabulary rather than free-form markup: every
 * page is built from the same dozen pieces, so the document reads as one
 * document instead of a dozen pages that happen to share a sidebar.
 */

/* -------------------------------------------------------------------------
 * Headings — each carries the id the right-hand rail anchors to
 * ---------------------------------------------------------------------- */

export function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2
      id={id}
      className="group mt-14 scroll-mt-28 text-[22px] font-semibold tracking-tight first:mt-0 sm:text-[26px]"
    >
      {children}
      <a
        href={`#${id}`}
        aria-label="Link to this section"
        // A hover affordance, so it is hidden where there is no hover
        // rather than left as an 11px target a thumb cannot hit.
        className="ml-2 hidden align-middle font-mono text-[15px] opacity-0 transition-opacity group-hover:opacity-100 [@media(pointer:fine)]:inline"
        style={{ color: 'var(--accent)' }}
      >
        #
      </a>
    </h2>
  );
}

export function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-9 text-[16.5px] font-semibold tracking-tight">{children}</h3>
  );
}

export function P({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-[14.5px] leading-[1.75] text-ink-secondary">{children}</p>
  );
}

/** A leading paragraph — slightly larger, sets up the page. */
export function Lead({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-4 text-balance text-[16.5px] leading-[1.7] text-ink">{children}</p>
  );
}

export function UL({ children }: { children: React.ReactNode }) {
  return (
    <ul className="mt-4 space-y-2.5 text-[14.5px] leading-[1.7] text-ink-secondary">
      {children}
    </ul>
  );
}

export function LI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span
        className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full"
        style={{ background: 'var(--accent-dim)' }}
        aria-hidden="true"
      />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** An ordered list that keeps the numerals in the accent, GitBook-style. */
export function OL({ children }: { children: React.ReactNode }) {
  return (
    <ol className="mt-4 space-y-3 text-[14.5px] leading-[1.7] text-ink-secondary [counter-reset:step]">
      {children}
    </ol>
  );
}

export function OLI({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex gap-3.5 [counter-increment:step]">
      <span
        className="mt-[2px] grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md font-mono text-[11px] font-bold tabular-nums before:content-[counter(step)]"
        style={{ background: 'var(--accent-wash)', color: 'var(--accent)' }}
        aria-hidden="true"
      />
      <span className="min-w-0">{children}</span>
    </li>
  );
}

export function Strong({ children }: { children: React.ReactNode }) {
  return <strong className="font-semibold text-ink">{children}</strong>;
}

export function Code({ children }: { children: React.ReactNode }) {
  return (
    <code
      className="rounded-[5px] px-[5px] py-[2px] font-mono text-[12.5px]"
      style={{ background: 'var(--surface-3)', color: 'var(--accent)' }}
    >
      {children}
    </code>
  );
}

export function A({ href, children }: { href: string; children: React.ReactNode }) {
  const external = href.startsWith('http');
  const cls =
    'tap-target underline decoration-dotted underline-offset-[3px] transition-colors';
  const style = { color: 'var(--accent)' };

  return external ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={cls} style={style}>
      {children} ↗
    </a>
  ) : (
    <Link href={href} className={cls} style={style}>
      {children}
    </Link>
  );
}

/* -------------------------------------------------------------------------
 * Callout — the GitBook hint block
 * ---------------------------------------------------------------------- */

const CALLOUT: Record<string, { tone: string; wash: string; glyph: string }> = {
  note: { tone: 'var(--accent)', wash: 'rgba(0,224,138,0.07)', glyph: '◆' },
  warn: { tone: 'var(--cautious)', wash: 'rgba(63,203,196,0.08)', glyph: '▲' },
  stop: { tone: 'var(--bearish)', wash: 'rgba(255,95,95,0.07)', glyph: '■' },
};

export function Callout({
  kind = 'note',
  title,
  children,
}: {
  kind?: 'note' | 'warn' | 'stop';
  title?: string;
  children: React.ReactNode;
}) {
  const c = CALLOUT[kind];
  return (
    <aside
      className="mt-6 flex gap-3.5 rounded-xl border-l-[3px] p-4 pr-5"
      style={{ background: c.wash, borderLeftColor: c.tone }}
    >
      <span
        className="mt-[3px] shrink-0 font-mono text-[11px]"
        style={{ color: c.tone }}
        aria-hidden="true"
      >
        {c.glyph}
      </span>
      <div className="min-w-0">
        {title && (
          <p className="text-[13.5px] font-semibold" style={{ color: c.tone }}>
            {title}
          </p>
        )}
        <div className="text-[13.5px] leading-[1.7] text-ink-secondary [&>p]:mt-1.5 [&>p:first-child]:mt-0">
          {children}
        </div>
      </div>
    </aside>
  );
}

/* -------------------------------------------------------------------------
 * Table
 * ---------------------------------------------------------------------- */

export function Table({
  head,
  rows,
  align = [],
}: {
  head: React.ReactNode[];
  rows: React.ReactNode[][];
  /** Per-column alignment; defaults to left. */
  align?: ('left' | 'right')[];
}) {
  return (
    <div className="card mt-6 overflow-x-auto">
      <table className="w-full min-w-[520px] border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b">
            {head.map((h, i) => (
              <th
                key={i}
                scope="col"
                className={`px-4 py-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted ${
                  align[i] === 'right' ? 'text-right' : 'text-left'
                }`}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">
          {rows.map((r, i) => (
            <tr key={i} className="transition-colors hover:bg-surface-2">
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={`px-4 py-3 leading-relaxed ${
                    align[j] === 'right' ? 'tabular text-right' : 'text-left'
                  } ${j === 0 ? 'text-ink' : 'text-ink-secondary'}`}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* -------------------------------------------------------------------------
 * Figure — a chart or diagram with its caption
 * ---------------------------------------------------------------------- */

export function Figure({
  label,
  caption,
  children,
}: {
  label: string;
  caption?: string;
  children: React.ReactNode;
}) {
  return (
    <figure className="card mt-6 overflow-hidden">
      <figcaption className="border-b px-5 py-3.5">
        <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.14em] text-ink-muted">
          {label}
        </p>
        {caption && (
          <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">
            {caption}
          </p>
        )}
      </figcaption>
      <div className="p-5">{children}</div>
    </figure>
  );
}

/** A block of code or a schema, for the places where the shape is the point. */
export function Pre({ children }: { children: string }) {
  return (
    <pre
      className="card mt-6 overflow-x-auto p-4 font-mono text-[12px] leading-[1.7] text-ink-secondary"
      style={{ background: 'var(--surface-2)' }}
    >
      {children}
    </pre>
  );
}

/* -------------------------------------------------------------------------
 * Stat row — for the live figures the document reads out of the system
 * ---------------------------------------------------------------------- */

export function Stats({
  items,
}: {
  items: { label: string; value: string; note?: string }[];
}) {
  return (
    <div className="mt-6 grid gap-px overflow-hidden rounded-xl border sm:grid-cols-2 lg:grid-cols-4"
      style={{ background: 'var(--border-neutral)' }}
    >
      {items.map((s) => (
        <div key={s.label} className="bg-surface-1 px-4 py-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.13em] text-ink-muted">
            {s.label}
          </p>
          <p className="tabular mt-2 text-[22px] font-bold leading-none">{s.value}</p>
          {s.note && <p className="mt-2 text-[11px] text-ink-muted">{s.note}</p>}
        </div>
      ))}
    </div>
  );
}

/**
 * Marks a figure as read from the running system at page load, so a reader
 * can tell it apart from a number written into the document.
 */
export function LiveTag() {
  return (
    <span
      className="ml-2 inline-flex items-center gap-1.5 rounded-full px-2 py-[3px] align-middle font-mono text-[9px] font-semibold uppercase tracking-[0.1em]"
      style={{ background: 'var(--accent-wash)', color: 'var(--accent)' }}
    >
      <span
        className="inline-block h-[5px] w-[5px] rounded-full"
        style={{ background: 'var(--accent)' }}
        aria-hidden="true"
      />
      Live
    </span>
  );
}

/* -------------------------------------------------------------------------
 * Intro panel — the plate that opens the document
 * ---------------------------------------------------------------------- */

/**
 * A glassmorphic opener.
 *
 * Frosted plane over a soft emerald bloom, edge-lit at the top where light
 * would catch a real pane. Purely decorative, so it is hidden from assistive
 * technology and flattens out of the printed PDF.
 */
export function IntroPanel({
  eyebrow = 'Introducing',
  title,
  sub,
}: {
  eyebrow?: string;
  title: string;
  sub: string;
}) {
  return (
    <section
      className="relative isolate mt-2 overflow-hidden rounded-2xl print:hidden"
      style={{ border: '1px solid var(--border-strong)' }}
    >
      {/* bloom */}
      <div
        className="pointer-events-none absolute -left-24 -top-32 h-[320px] w-[320px] rounded-full blur-[70px]"
        style={{ background: 'rgba(0,224,138,0.30)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-28 -right-16 h-[260px] w-[260px] rounded-full blur-[70px]"
        style={{ background: 'rgba(63,203,196,0.18)' }}
        aria-hidden="true"
      />

      {/* the pane itself */}
      <div
        className="relative px-6 py-9 backdrop-blur-xl sm:px-10 sm:py-12"
        style={{
          background:
            'linear-gradient(160deg, rgba(255,255,255,0.055), rgba(255,255,255,0.012) 55%, rgba(0,0,0,0.12))',
        }}
      >
        {/* edge light */}
        <span
          className="pointer-events-none absolute inset-x-0 top-0 h-px"
          style={{
            background:
              'linear-gradient(90deg, transparent, rgba(255,255,255,0.34), transparent)',
          }}
          aria-hidden="true"
        />

        <p
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.22em]"
          style={{ color: 'var(--accent)' }}
        >
          {eyebrow}
        </p>
        <h2 className="mt-3 text-balance text-[30px] font-semibold leading-[1.12] tracking-tight sm:text-[40px]">
          {title}
        </h2>
        <p className="mt-4 max-w-[54ch] text-[14.5px] leading-relaxed text-ink-secondary">
          {sub}
        </p>
      </div>
    </section>
  );
}
