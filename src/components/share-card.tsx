'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { Thesis } from '@/lib/types';
import type { InvestigationStatus } from '@/lib/db/store';
import { SENTIMENT, verdictLabel } from '@/lib/research/observe';
import { CoinIcon } from './coin';

/**
 * The shareable result card.
 *
 * Glassmorphic, edge-padded, with the mark at the corner and the Nansen
 * attribution centred at the foot — built to be screenshotted or unfurled as
 * a link preview. Every figure on it comes from the stored investigation.
 */

const TONE: Record<InvestigationStatus, string> = {
  SUPPORTED: '#00e08a',
  CHALLENGED: '#ff5f5f',
  MIXED: '#7d8d88',
  UNDER_STRESS: '#3fcbc4',
  INVALIDATED: '#ff5f5f',
};

export function ShareCard({
  thesis,
  status,
  chain,
  address,
  url,
  investigationId,
  observation,
}: {
  thesis: Thesis;
  status: InvestigationStatus;
  chain: string;
  address: string;
  url: string;
  investigationId: string;
  /** The written finding, as composed for the result page. */
  observation: string;
}) {
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState(false);
  // Which route the share actually took, so the confirmation describes what
  // happened rather than always describing the fallback.
  const [shared, setShared] = useState<null | 'attached' | 'manual'>(null);
  const tone = TONE[status];

  const tripped = thesis.tripwires.filter((t) => t.status === 'tripped').length;

  // The caption is the thesis, and nothing else.
  //
  // It used to restate the score, the coverage, the support split and the
  // breached count, all of which are already printed on the image being
  // attached. Repeating them made the post long, made the reader parse the
  // same figures twice, and buried the one line that is actually the point.
  const caption = `My thesis on $${thesis.asset.symbol}:\n\n"${thesis.statement}"`;

  const tweetHref = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    caption,
  )}&url=${encodeURIComponent(url)}`;

  /**
   * Posts the card with the caption attached to it.
   *
   * Two routes, because only one of them can carry an image. The Web Share API
   * hands the browser the PNG and the text together, so X opens with the card
   * already attached and nothing to paste; that is the path whenever
   * `canShare` accepts the file, which covers mobile and current desktop
   * Chrome and Edge.
   *
   * Everywhere else, X's web intent takes text and a URL but cannot attach
   * media at all, which needs the API and an OAuth token. Rather than pretend,
   * the fallback does the three things a person would otherwise do by hand:
   * save the card, put it on the clipboard, and open the composer.
   */
  async function shareOnX() {
    setSharing(true);
    try {
      // Fetched as a blob so the download is a real file rather than a
      // navigation that could replace the page.
      const res = await fetch(`/api/og/${investigationId}`);
      if (!res.ok) throw new Error(`card ${res.status}`);

      const blob = await res.blob();
      const file = new File(
        [blob],
        `thesisarena-${thesis.asset.symbol}-${investigationId}.png`,
        { type: 'image/png' },
      );

      if (navigator.canShare?.({ files: [file] })) {
        // The image goes with the post. No download, no composer, no paste.
        await navigator.share({ files: [file], text: caption });
        setShared('attached');
        return;
      }

      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(href);

      // The image itself on the clipboard where the browser allows it, which
      // turns the composer step into a single paste.
      try {
        const ClipboardItemCtor = (
          window as unknown as { ClipboardItem?: typeof ClipboardItem }
        ).ClipboardItem;
        if (ClipboardItemCtor && navigator.clipboard?.write) {
          await navigator.clipboard.write([
            new ClipboardItemCtor({ 'image/png': blob }),
          ]);
        } else {
          await navigator.clipboard.writeText(`${caption}\n${url}`);
        }
      } catch {
        // Clipboard permission varies by browser; the download still landed.
      }

      setShared('manual');
      window.open(tweetHref, '_blank', 'noopener,noreferrer');
    } catch (e) {
      // A cancelled share sheet is the user changing their mind, not a fault.
      if ((e as Error)?.name === 'AbortError') return;
      // Anything else: still get them to the composer.
      setShared('manual');
      window.open(tweetHref, '_blank', 'noopener,noreferrer');
    } finally {
      setSharing(false);
    }
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(`${caption}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked; the tweet button still works.
    }
  }

  return (
    <div>
      {/* The card itself */}
      <div
        className="relative overflow-hidden rounded-[20px] p-[1.5px]"
        style={{
          background: `linear-gradient(140deg, ${tone}55, transparent 42%, ${tone}22)`,
        }}
      >
        <div
          className="relative overflow-hidden rounded-[19px] px-7 py-7 sm:px-9 sm:py-8"
          style={{
            background:
              'linear-gradient(160deg, rgba(14,22,20,0.92), rgba(5,9,8,0.96))',
            backdropFilter: 'blur(18px)',
          }}
        >
          {/* glass bloom */}
          <div
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full blur-3xl"
            style={{ background: `${tone}22` }}
            aria-hidden="true"
          />

          {/* mark at the corner */}
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <Image src="/logo.png" alt="" width={26} height={26} className="h-[26px] w-[26px]" />
              <span className="text-[14px] font-semibold tracking-tight">
                Thesis<span style={{ color: '#00e08a' }}>Arena</span>
              </span>
            </div>

            <span
              className="rounded-md px-2.5 py-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.14em]"
              style={{
                color: tone,
                background: `color-mix(in srgb, ${tone} 14%, transparent)`,
                border: `1px solid color-mix(in srgb, ${tone} 34%, transparent)`,
              }}
            >
              {SENTIMENT[status]}
            </span>
          </div>

          {/* asset + claim */}
          <div className="relative mt-6 flex items-center gap-2.5">
            <CoinIcon symbol={thesis.asset.symbol} size={22} chain={chain} address={address} />
            <span className="font-mono text-[11.5px] text-ink-muted">
              {thesis.asset.symbol} · {chain}
            </span>
          </div>

          <p className="relative mt-3 text-balance text-[19px] font-semibold leading-snug sm:text-[22px]">
            “{thesis.statement}”
          </p>

          {/* the numbers */}
          <div className="relative mt-7 flex flex-wrap items-end gap-x-9 gap-y-5">
            <div>
              <div className="flex items-baseline gap-1">
                <span
                  className="tabular text-[46px] font-bold leading-none"
                  style={{ color: tone }}
                >
                  {thesis.consensus.score}
                </span>
                <span className="text-[15px] text-ink-muted">/100</span>
              </div>
              <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
                Evidence score
              </p>
            </div>

            <Metric label="Data coverage" value={`${thesis.consensus.coverage}%`} />
            <Metric
              label="Support / challenge"
              value={`${thesis.consensus.leanPositive} / ${thesis.consensus.total - thesis.consensus.leanPositive}`}
            />
            <Metric
              label="Invalidation progress"
              value={`${tripped} of ${thesis.tripwires.length}`}
              tone={tripped > 0 ? tone : undefined}
            />
          </div>

          <div className="relative mt-6 border-t pt-4">
            <p className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-ink-muted">
              What we found
            </p>
            <p className="mt-1.5 text-[10.5px] leading-[1.6] text-ink-secondary">
              {observation}
            </p>
          </div>

          <p
            className="relative mt-4 text-[13px] font-semibold"
            style={{ color: tone }}
          >
            {verdictLabel(status)}
          </p>

          {/* attribution, centred at the foot */}
          <p className="relative mt-6 text-center font-mono text-[9.5px] uppercase tracking-[0.18em] text-ink-muted">
            Powered by <span style={{ color: '#00e08a' }}>Nansen API</span>
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={shareOnX}
          disabled={sharing}
          className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] font-medium disabled:opacity-60"
          style={{ background: 'var(--accent)', color: '#04120c' }}
        >
          <XMark />
          {sharing ? 'Preparing…' : 'Share on X'}
        </button>
        <a
          href={`/api/og/${investigationId}`}
          download={`thesisarena-${thesis.asset.symbol}-${investigationId}.png`}
          className="flex items-center gap-2 rounded-lg px-3.5 py-2 text-[13px] transition-colors hover:text-ink"
          style={{ border: '1px solid var(--border-neutral)', color: 'var(--text-secondary)' }}
        >
          <DownloadMark />
          Download image
        </a>
        <button
          type="button"
          onClick={copy}
          className="rounded-lg px-3.5 py-2 text-[13px] transition-colors hover:text-ink"
          style={{ border: '1px solid var(--border-neutral)', color: 'var(--text-secondary)' }}
        >
          {copied ? 'Copied' : 'Copy caption + link'}
        </button>
      </div>

      {shared ? (
        <div
          className="mt-3 rounded-lg px-3.5 py-3 text-[12px] leading-relaxed"
          style={{ background: 'var(--accent-wash)', color: 'var(--text-secondary)' }}
        >
          {shared === 'attached' ? (
            <>
              <strong className="text-ink">Card attached.</strong> It went to the
              share sheet together with the caption, so the image posts with the
              text and there is nothing to paste.
            </>
          ) : (
            <>
              <strong className="text-ink">Image saved and caption copied.</strong> The
              X composer is open in a new tab with the text already in it. Drag the
              downloaded image in, or paste it with{' '}
              <kbd className="font-mono">Ctrl/Cmd&nbsp;+&nbsp;V</kbd>.
            </>
          )}
        </div>
      ) : (
        <p className="mt-3 text-[11.5px] leading-relaxed text-ink-muted">
          Posts the card with the caption attached. Where the browser will not
          carry a file, it downloads the card, copies it, and opens the composer
          for you to drop it in. Posting the link alone still unfurls this card.
        </p>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div>
      <div
        className="tabular text-[19px] font-semibold leading-none"
        style={{ color: tone }}
      >
        {value}
      </div>
      <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.16em] text-ink-muted">
        {label}
      </p>
    </div>
  );
}

function DownloadMark() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12 3v12M7 11l5 5 5-5M5 21h14" />
    </svg>
  );
}

function XMark() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.9 2H22l-7 8 8.2 12h-6.4l-5-7.3L5.9 22H2.8l7.5-8.6L2.4 2h6.6l4.5 6.7zm-1.1 18h1.7L7.3 3.8H5.5z" />
    </svg>
  );
}
