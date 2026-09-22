'use client';

import Link from 'next/link';
import { useEffect } from 'react';

/**
 * Download actions for the whitepaper.
 *
 * The download is the browser's own print-to-PDF against the full-document
 * route, which produces selectable text and a real table of contents rather
 * than a bitmap. The document is rendered from the same components the site
 * uses, so the file can never drift from what people read online.
 */
export function DownloadLinks() {
  return (
    <div className="mt-7 space-y-1.5 print:hidden">
      <p className="px-3 font-mono text-[9.5px] font-semibold uppercase tracking-[0.16em] text-ink-muted">
        Download
      </p>
      <a
        href="/thesisarena-whitepaper.pdf"
        download="thesisarena-whitepaper.pdf"
        className="flex items-center gap-2 rounded-lg px-3 py-[7px] text-[13px] transition-colors hover:bg-surface-2"
        style={{ color: 'var(--accent)' }}
      >
        <DocMark />
        Download PDF
      </a>
      <Link
        href="/whitepaper/full"
        className="flex items-center gap-2 rounded-lg px-3 py-[7px] text-[13px] text-ink-secondary transition-colors hover:bg-surface-2 hover:text-ink"
      >
        <DocMark />
        Read in one page
      </Link>
    </div>
  );
}

/**
 * Opens the print dialogue once the full document has rendered, so the link
 * behaves like a download rather than a page the reader must then print.
 */
export function AutoPrint() {
  useEffect(() => {
    const t = setTimeout(() => window.print(), 700);
    return () => clearTimeout(t);
  }, []);

  return null;
}

export function PrintBar() {
  return (
    <div className="mb-8 flex flex-wrap items-center gap-3 print:hidden">
      <a
        href="/thesisarena-whitepaper.pdf"
        download="thesisarena-whitepaper.pdf"
        className="rounded-lg px-3.5 py-2 text-[13px] font-medium"
        style={{ background: 'var(--accent)', color: '#04120c' }}
      >
        Download PDF
      </a>
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg px-3.5 py-2 text-[13px] transition-colors hover:text-ink"
        style={{ border: '1px solid var(--border-neutral)', color: 'var(--text-secondary)' }}
      >
        Print this page
      </button>
      <Link
        href="/whitepaper"
        className="rounded-lg px-3.5 py-2 text-[13px] transition-colors hover:text-ink"
        style={{ border: '1px solid var(--border-neutral)', color: 'var(--text-secondary)' }}
      >
        Back to the whitepaper
      </Link>
      <p className="text-[12px] text-ink-muted">
        The PDF is the whole document, with live figures as of its export.
      </p>
    </div>
  );
}

function DocMark() {
  return (
    <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M9 1.5H4.5A1.5 1.5 0 0 0 3 3v10a1.5 1.5 0 0 0 1.5 1.5h7A1.5 1.5 0 0 0 13 13V5.5L9 1.5Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
      <path d="M9 1.5V5.5H13" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
    </svg>
  );
}

