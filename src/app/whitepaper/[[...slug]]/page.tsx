import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { SECTIONS, findPage, href, neighbours } from '@/lib/whitepaper/pages';
import { OnThisPage, Sidebar } from '@/components/whitepaper/nav';
import { DownloadLinks } from '@/components/whitepaper/download';

export const dynamic = 'force-dynamic';

const NAV = SECTIONS.map((s) => ({
  name: s.name,
  pages: s.pages.map((p) => ({ slug: p.slug, title: p.title, href: href(p) })),
}));

function slugOf(parts: string[] | undefined): string {
  return parts?.join('/') ?? '';
}

/** Pages that have been renamed, so an existing link does not dead-end. */
const MOVED: Record<string, string> = {
  economics: 'cost-strategy',
};

export async function generateMetadata({ params }: PageProps<'/whitepaper/[[...slug]]'>) {
  const { slug } = await params;
  const page = findPage(slugOf(slug));
  if (!page) return { title: 'Whitepaper — ThesisArena' };

  return {
    title: `${page.title} — ThesisArena Whitepaper`,
    description: page.summary,
    openGraph: { title: `${page.title} — ThesisArena`, description: page.summary },
  };
}

export default async function Whitepaper({
  params,
}: PageProps<'/whitepaper/[[...slug]]'>) {
  const { slug } = await params;
  const current = slugOf(slug);
  if (MOVED[current]) redirect(`/whitepaper/${MOVED[current]}`);

  const page = findPage(current);
  if (!page) notFound();

  const section = SECTIONS.find((s) => s.pages.some((p) => p.slug === current));
  const { prev, next } = neighbours(current);
  const { Body } = page;

  return (
    <main className="mx-auto max-w-[1440px] px-5 py-8 sm:px-8 sm:py-10">
      <div className="grid gap-x-10 lg:grid-cols-[236px_minmax(0,1fr)] xl:grid-cols-[236px_minmax(0,1fr)_200px]">
        <aside className="print:hidden lg:pt-2">
          <div className="mb-7 hidden lg:block">
            <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.18em]" style={{ color: 'var(--accent)' }}>
              Whitepaper
            </p>
            <p className="mt-1.5 text-[13px] leading-snug text-ink-muted">
              Version 1.0 · September 2026
            </p>
          </div>
          <Sidebar sections={NAV} />
          <DownloadLinks />
        </aside>

        <article className="min-w-0 pb-16">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.12em] text-ink-muted">
            <Link
              href="/whitepaper"
              className="tap-target transition-colors hover:text-ink-secondary"
            >
              Whitepaper
            </Link>
            {section && (
              <>
                <span aria-hidden="true">/</span>
                <span>{section.name}</span>
              </>
            )}
          </nav>

          <header className="mt-4 border-b pb-7">
            <h1 className="text-balance text-[30px] font-semibold tracking-tight sm:text-[38px]">
              {page.title}
            </h1>
            <p className="mt-3 max-w-[64ch] text-[15px] leading-relaxed text-ink-secondary">
              {page.summary}
            </p>
          </header>

          <div className="max-w-[72ch]">
            <Body />
          </div>

          <nav
            aria-label="Page navigation"
            className="mt-16 grid gap-3 border-t pt-7 print:hidden sm:grid-cols-2"
          >
            {prev ? (
              <Link
                href={href(prev)}
                className="card group p-4 transition-colors hover:bg-surface-2"
              >
                <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">
                  ← Previous
                </span>
                <span
                  className="mt-1.5 block text-[14px] font-medium transition-colors group-hover:text-accent"
                >
                  {prev.title}
                </span>
              </Link>
            ) : (
              <span />
            )}

            {next && (
              <Link
                href={href(next)}
                className="card group p-4 text-right transition-colors hover:bg-surface-2"
              >
                <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-muted">
                  Next →
                </span>
                <span className="mt-1.5 block text-[14px] font-medium transition-colors group-hover:text-accent">
                  {next.title}
                </span>
              </Link>
            )}
          </nav>
        </article>

        <aside className="hidden print:hidden xl:block xl:pt-2">
          <OnThisPage items={page.toc} />
        </aside>
      </div>
    </main>
  );
}
