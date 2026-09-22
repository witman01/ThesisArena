/**
 * Renders the whitepaper to a PDF file.
 *
 * The browser's print-to-PDF produces the document, but it needs a human to
 * press the button. This drives the same path headlessly and writes the file
 * to public/, so the site can offer a real one-click download and the file can
 * be handed to anything that takes an upload.
 *
 * Playwright is not a project dependency — it is only needed to regenerate
 * this artefact, so it is imported lazily and the script explains itself if it
 * is missing.
 *
 *   npx playwright install chromium     # once
 *   npx tsx scripts/export-whitepaper.ts
 */

import { join } from 'node:path';

/** The slice of Playwright's surface this script uses. */
interface PwPage {
  goto(url: string, opts?: { waitUntil?: string }): Promise<unknown>;
  waitForSelector(sel: string): Promise<unknown>;
  waitForTimeout(ms: number): Promise<void>;
  emulateMedia(opts: { media: string }): Promise<void>;
  pdf(opts: Record<string, unknown>): Promise<unknown>;
}
interface PwBrowser {
  newPage(opts?: Record<string, unknown>): Promise<PwPage>;
  close(): Promise<void>;
}

const BASE = process.env.THESISARENA_URL ?? 'http://localhost:3001';
const OUT = join(process.cwd(), 'public', 'thesisarena-whitepaper.pdf');

const FOOTER =
  '<div style="width:100%;font-size:8px;color:#666;padding:0 16mm;' +
  'display:flex;justify-content:space-between;font-family:sans-serif;">' +
  '<span>ThesisArena Whitepaper v1.0 — Powered by Nansen API</span>' +
  '<span class="pageNumber"></span>/<span class="totalPages"></span></div>';

async function main() {
  // Resolved at runtime: playwright is optional, so a static import would
  // fail typechecking for everyone who never regenerates the PDF.
  let chromium: { launch: () => Promise<PwBrowser> };
  try {
    ({ chromium } = (await import('playwright' as string)) as {
      chromium: { launch: () => Promise<PwBrowser> };
    });
  } catch {
    console.error(
      'playwright is not installed.\n' +
        '  npm i -D playwright && npx playwright install chromium',
    );
    process.exit(1);
  }

  const res = await fetch(`${BASE}/whitepaper/full`).catch(() => null);
  if (!res?.ok) {
    console.error(`cannot reach ${BASE} — start the dev server first`);
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1100, height: 1400 } });

  await page.goto(`${BASE}/whitepaper/full`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('main');
  // The live figures are server-rendered, but fonts and icons are not.
  await page.waitForTimeout(2500);
  await page.emulateMedia({ media: 'print' });

  await page.pdf({
    path: OUT,
    format: 'A4',
    printBackground: true,
    margin: { top: '16mm', bottom: '18mm', left: '16mm', right: '16mm' },
    displayHeaderFooter: true,
    headerTemplate: '<div></div>',
    footerTemplate: FOOTER,
  });

  await browser.close();
  console.log(`wrote ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

export {};
