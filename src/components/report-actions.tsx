'use client';

/**
 * Report actions.
 *
 * Export uses the browser's own print-to-PDF rather than a bundled PDF
 * library: it produces a real, selectable-text document, needs no dependency,
 * and honours the print stylesheet below.
 */
export function ReportActions({ shareUrl }: { shareUrl: string }) {
  async function share() {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      // Clipboard can be blocked; the URL is in the address bar regardless.
    }
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="rounded-lg px-3.5 py-2 text-[13px] font-medium"
        style={{ background: 'var(--accent)', color: '#04120c' }}
      >
        Export PDF
      </button>
      <button
        type="button"
        onClick={share}
        className="rounded-lg px-3.5 py-2 text-[13px] transition-colors hover:text-ink"
        style={{ border: '1px solid var(--border-neutral)', color: 'var(--text-secondary)' }}
      >
        Copy report link
      </button>
    </div>
  );
}
