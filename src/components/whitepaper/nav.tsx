'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

export interface NavSection {
  name: string;
  pages: { slug: string; title: string; href: string }[];
}

/* -------------------------------------------------------------------------
 * Left sidebar — the document's table of contents
 * ---------------------------------------------------------------------- */

export function Sidebar({ sections }: { sections: NavSection[] }) {
  const pathname = usePathname();

  // The drawer remembers which page it was opened on, so navigating away
  // closes it by derivation rather than by an effect that writes state.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;
  const setOpen = (next: boolean) => setOpenAt(next ? pathname : null);

  const list = (
    <nav aria-label="Whitepaper contents" className="space-y-7">
      {sections.map((s) => (
        <div key={s.name}>
          <p className="px-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
            {s.name}
          </p>
          <ul className="mt-2.5 space-y-px">
            {s.pages.map((p) => {
              const on = pathname === p.href;
              return (
                <li key={p.href}>
                  <Link
                    href={p.href}
                    aria-current={on ? 'page' : undefined}
                    className="relative block rounded-lg py-[7px] pl-3 pr-2.5 text-[13.5px] leading-snug transition-colors hover:bg-surface-2"
                    style={{
                      color: on ? 'var(--accent)' : 'var(--text-secondary)',
                      background: on ? 'var(--accent-wash)' : undefined,
                    }}
                  >
                    {on && (
                      <span
                        className="absolute inset-y-[6px] left-0 w-[2px] rounded-full"
                        style={{ background: 'var(--accent)' }}
                        aria-hidden="true"
                      />
                    )}
                    {p.title}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      {/* Mobile: a button that opens the contents as a drawer. */}
      <button
        onClick={() => setOpen(true)}
        className="mb-5 flex w-full items-center gap-2.5 rounded-xl border px-4 py-2.5 text-[13px] lg:hidden"
        style={{ color: 'var(--text-secondary)' }}
      >
        <span aria-hidden="true" style={{ color: 'var(--accent)' }}>
          ☰
        </span>
        Contents
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            aria-label="Close contents"
            onClick={() => setOpen(false)}
            className="absolute inset-0"
            style={{ background: 'rgba(0,0,0,0.65)' }}
          />
          <div className="absolute inset-y-0 left-0 w-[min(84vw,320px)] overflow-y-auto border-r bg-bg p-5">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink-muted">
                Whitepaper
              </span>
              <button
                onClick={() => setOpen(false)}
                aria-label="Close contents"
                className="rounded-lg px-2 py-1 text-[16px] leading-none text-ink-muted"
              >
                ×
              </button>
            </div>
            {list}
          </div>
        </div>
      )}

      <div className="hidden lg:block">
        <div className="sticky top-[92px] max-h-[calc(100vh-120px)] overflow-y-auto pb-10 pr-2">
          {list}
        </div>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------
 * Right rail — "On this page", with the visible section highlighted
 * ---------------------------------------------------------------------- */

export function OnThisPage({ items }: { items: { id: string; label: string }[] }) {
  const [active, setActive] = useState<string | null>(items[0]?.id ?? null);

  useEffect(() => {
    if (items.length === 0) return;

    const headings = items
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => el !== null);
    if (headings.length === 0) return;

    // Highlight the last heading that has passed the top of the viewport, so
    // the rail tracks what is being read rather than what is merely on screen.
    const onScroll = () => {
      const line = 140;
      let current = headings[0].id;
      for (const h of headings) {
        if (h.getBoundingClientRect().top <= line) current = h.id;
        else break;
      }
      setActive(current);
    };

    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [items]);

  if (items.length === 0) return null;

  return (
    <div className="sticky top-[92px] hidden max-h-[calc(100vh-120px)] overflow-y-auto pb-10 xl:block">
      <p className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
        On this page
      </p>
      <ul className="mt-3 space-y-px border-l">
        {items.map((i) => {
          const on = active === i.id;
          return (
            <li key={i.id}>
              <a
                href={`#${i.id}`}
                className="-ml-px block border-l py-[5px] pl-3.5 text-[12.5px] leading-snug transition-colors"
                style={{
                  color: on ? 'var(--accent)' : 'var(--text-muted)',
                  borderLeftColor: on ? 'var(--accent)' : 'transparent',
                }}
              >
                {i.label}
              </a>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
