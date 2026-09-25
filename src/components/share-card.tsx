'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
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

/**
 * The post text: the ticker, the claim, and the link to the full result.
 *
 * Built to fit rather than capping what someone may type. The thesis box has
 * no length limit, so a long claim would push the post past X's 280 and it
 * would arrive truncated at whatever point X chose, which could be mid-link.
 * The claim is shortened instead, on a word boundary, and the link is never
 * touched: it is the part that leads to the unabridged thesis.
 *
 * X measures any link as 23 characters whatever its real length, so that is
 * what the budget counts.
 */
const TWEET_LIMIT = 280;
const LINK_COST = 23;

export function buildCaption(symbol: string, statement: string, url: string): string {
  const head = `My thesis on $${symbol}:\n\n"`;
  const tail = `"\n\n`;
  const room = TWEET_LIMIT - head.length - tail.length - LINK_COST;

  let claim = statement.trim();
  if (claim.length > room) {
    const cut = claim.slice(0, room - 1);
    const lastSpace = cut.lastIndexOf(' ');
    claim = `${(lastSpace > room * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
  }
  return `${head}${claim}${tail}${url}`;
}

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
  const [shared, setShared] = useState<null | 'attached' | 'manual' | 'blocked'>(
    null,
  );
  const tone = TONE[status];

  /**
   * The card, fetched before anyone clicks.
   *
   * This is the whole reason sharing works. Both share routes have to start
   * inside the user gesture that opened them: iOS rejects `navigator.share`
   * with NotAllowedError once an `await` has consumed the activation, and every
   * popup blocker rejects a `window.open` for the same reason. The previous
   * version fetched the image first and then called them, so on a phone the
   * share sheet refused and the fallback window was blocked, which is to say
   * nothing happened at all.
   *
   * Holding the file in a ref rather than state keeps the click handler
   * synchronous: by the time it runs there is nothing left to await.
   */
  const cardFile = useRef<File | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/og/${investigationId}`);
        if (!res.ok || cancelled) return;
        const blob = await res.blob();
        if (cancelled) return;
        cardFile.current = new File(
          [blob],
          `thesisarena-${thesis.asset.symbol}-${investigationId}.png`,
          { type: 'image/png' },
        );
      } catch {
        // Left null; the click handler fetches on demand instead.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [investigationId, thesis.asset.symbol]);

  const tripped = thesis.tripwires.filter((t) => t.status === 'tripped').length;

  // The caption is the thesis, and nothing else.
  //
  // It used to restate the score, the coverage, the support split and the
  // breached count, all of which are already printed on the image being
  // attached. Repeating them made the post long, made the reader parse the
  // same figures twice, and buried the one line that is actually the point.
  // The link is part of the caption rather than a separate field.
  //
  // Only the web intent has a `url` parameter. The Web Share API has no
  // reliable equivalent once files are attached: `url` is dropped by most
  // targets in that case, so a post shared from a phone went out with the card
  // and the claim but nothing to click. Carrying it in the text is the one
  // form both routes keep, and X linkifies it either way.
  const caption = buildCaption(thesis.asset.symbol, thesis.statement, url);

  // x.com is the registered universal link, so on a phone with the app
  // installed this opens the X app's composer rather than a browser tab. No
  // `url` parameter, because the caption already ends with it and X would
  // otherwise append it a second time.
  const tweetHref = `https://x.com/intent/post?text=${encodeURIComponent(caption)}`;

  /** Saves the card to the device. Synchronous when it is already in hand. */
  function saveCard(file: File) {
    const href = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = href;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoked on the next frame: revoking immediately can cancel the download
    // in Safari before it has read the blob.
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  }

  /** Puts the image on the clipboard, so the composer step is one paste. */
  async function copyCard(file: File) {
    try {
      const ClipboardItemCtor = (
        window as unknown as { ClipboardItem?: typeof ClipboardItem }
      ).ClipboardItem;
      if (ClipboardItemCtor && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItemCtor({ 'image/png': file }),
        ]);
      } else {
        await navigator.clipboard.writeText(caption);
      }
    } catch {
      // Clipboard permission varies by browser; the download still landed.
    }
  }

  /**
   * X's web intent carries text and a link but never an image, which needs the
   * API and an OAuth token. So the composer is opened and the card is put both
   * on disk and on the clipboard for the reader to drop in.
   *
   * The window is opened first and synchronously. Every popup blocker refuses a
   * `window.open` that is not still inside the click that asked for it.
   */
  function openComposer(file: File | null) {
    const win = window.open(tweetHref, '_blank', 'noopener,noreferrer');
    setShared(win ? 'manual' : 'blocked');

    if (file) {
      saveCard(file);
      void copyCard(file);
      return;
    }
    // Not prefetched yet. The composer is already open, so this only has to
    // catch up with the image.
    void (async () => {
      try {
        const res = await fetch(`/api/og/${investigationId}`);
        if (!res.ok) return;
        const late = new File(
          [await res.blob()],
          `thesisarena-${thesis.asset.symbol}-${investigationId}.png`,
          { type: 'image/png' },
        );
        cardFile.current = late;
        saveCard(late);
        void copyCard(late);
      } catch {
        // The composer is open with the caption; the card can still be saved
        // from the Download button.
      }
    })();
  }

  /**
   * Posts the card with the caption attached to it.
   *
   * Deliberately not an async function. The Web Share API is the only route
   * that can hand X an image, and it is only granted inside the user gesture,
   * so the call has to be the first thing that happens on click. With the file
   * already prefetched it is, and on a phone this opens the share sheet
   * straight into X with the card and the caption together.
   */
  function shareOnX() {
    const file = cardFile.current;

    if (file && navigator.canShare?.({ files: [file] })) {
      setSharing(true);
      navigator
        .share({ files: [file], text: caption })
        .then(() => setShared('attached'))
        .catch((e: Error) => {
          // Dismissing the sheet is a decision, not a failure.
          if (e?.name === 'AbortError') return;
          openComposer(file);
        })
        .finally(() => setSharing(false));
      return;
    }

    openComposer(file);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(caption);
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
          {shared === 'attached' && (
            <>
              <strong className="text-ink">Card attached.</strong> It went to the
              share sheet together with the caption, so the image posts with the
              text and there is nothing to paste.
            </>
          )}
          {shared === 'manual' && (
            <>
              <strong className="text-ink">Image saved and caption copied.</strong> The
              X composer is open with the text already in it. Drag the downloaded
              image in, or paste it with{' '}
              <kbd className="font-mono">Ctrl/Cmd&nbsp;+&nbsp;V</kbd>.
            </>
          )}
          {/* A blocked popup used to leave nothing on screen at all, so the
              button simply looked broken. Here is the link it tried to open. */}
          {shared === 'blocked' && (
            <>
              <strong className="text-ink">Your browser blocked the new tab.</strong>{' '}
              The card is saved and copied.{' '}
              <a
                href={tweetHref}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
                style={{ color: 'var(--accent)' }}
              >
                Open the X composer
              </a>
              , then paste the image.
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
