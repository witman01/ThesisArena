'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

const NAV = [
  { label: 'Arena', href: '/' },
  { label: 'History', href: '/history' },
  { label: 'Analytics', href: '/analytics' },
  { label: 'Whitepaper', href: '/whitepaper' },
  { label: 'Settings', href: '/settings' },
];

export function TopBar() {
  const pathname = usePathname();
  const active =
    NAV.find((n) => n.href !== '/' && pathname.startsWith(n.href))?.label ??
    'Arena';

  // The panel remembers which page it was opened on, so navigating away closes
  // it by derivation rather than by an effect that writes state.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  return (
    <header className="sticky top-0 z-40 border-b bg-bg/80 backdrop-blur-xl">
      <div className="mx-auto flex h-[68px] max-w-[1440px] items-center gap-3 px-4 sm:gap-6 sm:px-8">
        <Link href="/" className="group flex shrink-0 items-center gap-2 sm:gap-3">
          <span className="relative grid h-9 w-9 place-items-center sm:h-11 sm:w-11">
            <span
              className="absolute inset-0 rounded-xl opacity-70 blur-md transition-opacity group-hover:opacity-100"
              style={{ background: 'rgba(0,224,138,0.28)' }}
              aria-hidden="true"
            />
            <Image
              src="/logo.png"
              alt="ThesisArena"
              width={44}
              height={44}
              className="relative h-9 w-9 sm:h-11 sm:w-11"
              priority
            />
          </span>
          <span className="text-[17px] font-semibold leading-none tracking-tight sm:text-[19px]">
            Thesis<span style={{ color: 'var(--accent)' }}>Arena</span>
          </span>
        </Link>

        <nav className="ml-4 hidden items-center gap-0.5 md:flex">
          {NAV.map((n) => {
            const on = n.label === active;
            return (
              <Link
                key={n.label}
                href={n.href}
                aria-current={on ? 'page' : undefined}
                className="relative rounded-lg px-3.5 py-2 text-[13.5px] transition-colors"
                style={{ color: on ? 'var(--accent)' : 'var(--text-secondary)' }}
              >
                {n.label}
                {on && (
                  <span
                    className="absolute inset-x-3 -bottom-[13px] h-[2px] rounded-full"
                    style={{ background: 'var(--accent)' }}
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <Link
            href="/new"
            className="shrink-0 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors sm:px-3.5"
            style={{ background: 'var(--accent)', color: '#04120c' }}
          >
            New<span className="hidden xs:inline"> thesis</span>
          </Link>

          {/* Below md the nav collapses, so it needs a way back. Without this
              History, Analytics, Whitepaper and Settings were reachable only
              by scrolling to the footer. */}
          <button
            type="button"
            onClick={() => setOpenAt(open ? null : pathname)}
            aria-expanded={open}
            aria-controls="mobile-nav"
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-lg md:hidden"
            style={{
              border: '1px solid var(--border-neutral)',
              color: 'var(--text-secondary)',
            }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              {open ? (
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : (
                <path
                  d="M4 7h16M4 12h16M4 17h16"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="mobile-nav"
          aria-label="Main"
          className="border-t bg-bg md:hidden"
        >
          <ul className="mx-auto max-w-[1440px] px-3 py-2 sm:px-6">
            {NAV.map((n) => {
              const on = n.label === active;
              return (
                <li key={n.label}>
                  <Link
                    href={n.href}
                    aria-current={on ? 'page' : undefined}
                    className="flex items-center justify-between rounded-lg px-3 py-3 text-[15px]"
                    style={{
                      color: on ? 'var(--accent)' : 'var(--text-secondary)',
                      background: on ? 'var(--accent-wash)' : undefined,
                    }}
                  >
                    {n.label}
                    {on && (
                      <span
                        className="h-[6px] w-[6px] rounded-full"
                        style={{ background: 'var(--accent)' }}
                        aria-hidden="true"
                      />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      )}
    </header>
  );
}

/** Shared page heading for the secondary sections. */
export function PageHead({
  eyebrow,
  title,
  sub,
}: {
  eyebrow: string;
  title: string;
  sub: string;
}) {
  return (
    <div className="border-b">
      <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 sm:py-14">
        <span
          className="font-mono text-[10px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: 'var(--accent)' }}
        >
          {eyebrow}
        </span>
        <h1 className="mt-3 text-[32px] font-semibold leading-tight tracking-tight sm:text-[40px]">
          {title}
        </h1>
        <p className="mt-2 max-w-[68ch] text-[14px] leading-relaxed text-ink-secondary">
          {sub}
        </p>
      </div>
    </div>
  );
}
