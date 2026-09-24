import Link from 'next/link';
import { Reveal } from './motion';

/* -------------------------------------------------------------------------
 * How it works — the old sidebar stepper, laid out horizontally
 * ---------------------------------------------------------------------- */

const STEPS = [
  {
    n: '01',
    title: 'State your thesis',
    body: 'Write what you believe in plain language. The parser separates the claim from the mechanism you think drives it.',
  },
  {
    n: '02',
    title: 'Four modules investigate',
    body: 'Smart money, capital flow, holder structure and historical precedent each run an independent evidence sweep, and disagree out loud.',
  },
  {
    n: '03',
    title: 'Commit to what breaks it',
    body: 'The thesis is rewritten as machine-checkable conditions, then monitored continuously so you learn the moment it stops being true.',
  },
];

export function HowItWorks() {
  return (
    <Section
      eyebrow="How the arena works"
      title="A thesis is only worth as much as its exit condition"
    >
      <div className="grid gap-px overflow-hidden rounded-2xl border md:grid-cols-3">
        {STEPS.map((s, i) => (
          <Reveal key={s.n} delay={i * 90}>
            <article className="group relative h-full bg-surface-1 p-6 transition-colors hover:bg-surface-2">
              <span
                className="font-mono text-[11px] font-bold tracking-[0.1em]"
                style={{ color: 'var(--accent)' }}
              >
                {s.n}
              </span>
              <h3 className="mt-3 text-[16px] font-semibold">{s.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-ink-secondary">
                {s.body}
              </p>
              <span
                className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 transition-transform duration-500 group-hover:scale-x-100"
                style={{ background: 'var(--accent)' }}
                aria-hidden="true"
              />
            </article>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}

/* -------------------------------------------------------------------------
 * Shared section shell
 * ---------------------------------------------------------------------- */

export function Section({
  eyebrow,
  title,
  sub,
  action,
  children,
}: {
  eyebrow?: string;
  title?: string;
  sub?: string;
  action?: { label: string; href: string };
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-[1440px] px-5 py-12 sm:px-8 sm:py-16">
      {(eyebrow || title) && (
        <Reveal>
          <div className="mb-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
            <div className="min-w-0">
              {eyebrow && (
                <span
                  className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
                  style={{ color: 'var(--accent)' }}
                >
                  {eyebrow}
                </span>
              )}
              {title && (
                <h2 className="mt-2 text-balance text-[24px] font-semibold tracking-tight sm:text-[30px]">
                  {title}
                </h2>
              )}
              {sub && (
                <p className="mt-2 max-w-[70ch] text-[14px] leading-relaxed text-ink-secondary">
                  {sub}
                </p>
              )}
            </div>

            {action && (
              <Link
                href={action.href}
                className="shrink-0 rounded-lg px-3.5 py-2 text-[13px] transition-colors"
                style={{
                  color: 'var(--accent)',
                  border: '1px solid var(--border-strong)',
                }}
              >
                {action.label} →
              </Link>
            )}
          </div>
        </Reveal>
      )}
      {children}
    </section>
  );
}
