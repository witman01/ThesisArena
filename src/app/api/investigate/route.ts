import { runInvestigation } from '@/lib/research/run';
import type { AssetRef } from '@/lib/research/types';
import { saveInvestigation } from '@/lib/db/store';

/**
 * Runs a real investigation and streams progress as it happens.
 *
 * Server-sent events rather than a single response, because the four modules
 * take real seconds against live endpoints and the UI should reflect actual
 * module completion rather than a timer pretending to be one.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

interface Body {
  statement: string;
  asset: AssetRef;
  /**
   * 'record' (default) replays a recorded response when one exists and
   * captures it otherwise — cheap, and replays are excluded from call counts.
   * 'live' bypasses fixtures entirely. 'replay' never touches the network.
   */
  mode?: 'live' | 'record' | 'replay';
}

export async function POST(req: Request) {
  const { statement, asset, mode = 'record' } = (await req.json()) as Body;

  if (!statement?.trim() || !asset?.address || !asset?.chain) {
    return Response.json(
      { error: 'statement, asset.address and asset.chain are required' },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      };

      try {
        const result = await runInvestigation(statement, asset, {
          budget: 14,
          fixtureDir: mode === 'live' ? undefined : 'fixtures/nansen',
          fixtureMode: mode === 'replay' ? 'replay' : mode === 'live' ? 'off' : 'record',
          onProgress: (e) => send('progress', e),
          onCall: (e) => send('call', e),
        });

        // Persist before responding: a refresh must not destroy the work,
        // and the ledger is the buildathon's audit trail.
        const investigationId = await saveInvestigation({
          statement,
          asset: {
            symbol: asset.symbol,
            name: (asset as AssetRef & { name?: string }).name,
            chain: asset.chain,
            address: asset.address,
            isNative: asset.isNative,
          },
          thesis: result.thesis,
          independent: result.thesis.independent,
          ledger: result.ledger,
          creditsSpent: result.creditsSpent,
        });

        send('done', {
          investigationId,
          thesis: result.thesis,
          creditsSpent: result.creditsSpent,
          creditsRemaining: result.creditsRemaining,
          liveCalls: result.ledger.filter((l) => l.source === 'live').length,
          calls: result.ledger.length,
        });
      } catch (e) {
        send('error', { message: (e as Error).message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
