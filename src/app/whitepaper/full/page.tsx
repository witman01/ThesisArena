import { SECTIONS, PAGES } from '@/lib/whitepaper/pages';
import { PrintBar } from '@/components/whitepaper/download';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'ThesisArena Whitepaper',
  description: 'The complete design document, as one printable page.',
};

/**
 * The whole whitepaper as a single continuous document.
 *
 * This is what "download" resolves to: every section in reading order with a
 * table of contents, print-styled so the browser's own Save-as-PDF produces a
 * real document with selectable text. Live figures are read at render time, so
 * the exported file is a snapshot of the system at the moment it was saved.
 */
export default function FullWhitepaper() {
  const today = new Date().toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <main className="mx-auto max-w-[860px] px-5 py-10 sm:px-8">
      <PrintBar />

      <header className="border-b pb-8">
        <p
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em]"
          style={{ color: 'var(--accent)' }}
        >
          ThesisArena
        </p>
        <h1 className="mt-3 text-[34px] font-semibold tracking-tight sm:text-[42px]">
          Put your thesis on trial
        </h1>
        <p className="mt-3 max-w-[60ch] text-[15px] leading-relaxed text-ink-secondary">
          Every other tool tells you why you&rsquo;re right. ThesisArena finds out
          if you are.
        </p>
        <p className="mt-5 font-mono text-[11px] text-ink-muted">
          Whitepaper v1.0 · exported {today} · figures read live at export
        </p>
      </header>

      <nav aria-label="Contents" className="print-keep mt-9 break-after-page">
        <h2 className="text-[17px] font-semibold">Contents</h2>
        <ol className="mt-4 space-y-4">
          {SECTIONS.map((s) => (
            <li key={s.name}>
              <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                {s.name}
              </p>
              <ul className="mt-1.5 space-y-1">
                {s.pages.map((p) => (
                  <li key={p.slug} className="text-[13.5px] text-ink-secondary">
                    <a
                      href={`#wp-${p.slug || 'overview'}`}
                      className="tap-target hover:text-ink"
                    >
                      {p.title}
                    </a>
                    <span className="text-ink-muted"> — {p.summary}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </nav>

      {PAGES.map((p, i) => {
        const { Body } = p;
        return (
          <section
            key={p.slug || 'overview'}
            id={`wp-${p.slug || 'overview'}`}
            className={i > 0 ? 'mt-16 break-before-page' : 'mt-16'}
          >
            <header className="border-b pb-5">
              <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
                {SECTIONS.find((s) => s.pages.includes(p))?.name}
              </p>
              <h2 className="mt-2 text-[26px] font-semibold tracking-tight">
                {p.title}
              </h2>
              <p className="mt-2 text-[14px] leading-relaxed text-ink-secondary">
                {p.summary}
              </p>
            </header>
            <div className="mt-2">
              <Body />
            </div>
          </section>
        );
      })}

      <footer className="mt-16 border-t pt-6 text-[12px] leading-relaxed text-ink-muted">
        <p>
          Powered by Nansen API. Derived signals only — restricted data never
          renders as raw values. Research tool, not investment advice.
        </p>
      </footer>
    </main>
  );
}
