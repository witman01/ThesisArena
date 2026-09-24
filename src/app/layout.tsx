import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import { TopBar } from "@/components/shell";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ThesisArena · put your thesis on trial",
  description:
    "State a crypto thesis and four deterministic research modules interrogate it against live Nansen data, then commit to exactly what would prove it wrong.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/* suppressHydrationWarning: browser extensions (password managers,
          Bitdefender's bis_* attributes) mutate <body> before React hydrates. */}
      <body className="flex min-h-full flex-col" suppressHydrationWarning>
        <TopBar />
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </body>
    </html>
  );
}

const FOOTER_LINKS = [
  { label: "Arena", href: "/" },
  { label: "History", href: "/history" },
  { label: "Analytics", href: "/analytics" },
  { label: "Whitepaper", href: "/whitepaper" },
  { label: "Settings", href: "/settings" },
];

/** The current X mark, not the old bird. */
function XLogo() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function SiteFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-8">
          <div className="max-w-[38ch]">
            <span className="text-[16px] font-semibold tracking-tight">
              Thesis<span style={{ color: "var(--accent)" }}>Arena</span>
            </span>
            <p className="mt-2 text-[13px] leading-relaxed text-ink-secondary">
              Put your thesis on trial. Four research modules, live on-chain evidence, and
              an explicit list of what would prove you wrong.
            </p>
            {/* Attribution is mandatory, but it reads better as a line of
                text than as a badge. Wording is fixed by Nansen's terms. */}
            <a
              href="https://nansen.ai"
              target="_blank"
              rel="noreferrer noopener"
              className="tap-target group mt-5 inline-flex items-baseline gap-1.5 text-[13px] text-ink-secondary transition-colors hover:text-ink"
            >
              Powered by
              <span
                className="border-b border-transparent pb-px font-medium transition-colors group-hover:border-current"
                style={{ color: "var(--accent)" }}
              >
                Nansen API
              </span>
            </a>

            <a
              href="https://x.com/_thesisarena"
              target="_blank"
              rel="noreferrer noopener"
              aria-label="ThesisArena on X"
              className="mt-5 flex w-fit items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] text-ink-secondary transition-colors hover:text-ink"
              style={{ border: "1px solid var(--border-neutral)" }}
            >
              <XLogo />
              @_thesisarena
            </a>
          </div>

          <nav className="flex flex-col gap-2">
            <span className="font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
              Product
            </span>
            {FOOTER_LINKS.map((l) => (
              <Link
                key={l.label}
                href={l.href}
                className="tap-target text-[13px] text-ink-secondary transition-colors hover:text-ink"
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>

        <p className="mt-10 border-t pt-6 font-mono text-[10px] leading-relaxed text-ink-muted">
          Derived signals only. Scores blend Nansen data with independent
          sources; restricted data never renders as raw values. Research tool, not
          investment advice.
        </p>
      </div>
    </footer>
  );
}
