'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AssetMeta } from '@/lib/assets';
import type { Thesis } from '@/lib/types';
import { Compose } from '@/components/compose';
import {
  AGENTS,
  Investigating,
  Preparing,
  type AgentProgress,
  type CallEvent,
} from '@/components/investigation';
import { VerdictScreen } from '@/components/verdict-screen';

type Stage = 'compose' | 'preparing' | 'investigating' | 'verdict' | 'failed';

interface DoneEvent {
  investigationId: string;
  thesis: Thesis;
  creditsSpent: number;
  creditsRemaining: number | null;
  liveCalls: number;
  calls: number;
}

/**
 * The thesis lifecycle, driven by the real research engine.
 *
 * Progress comes from server-sent events emitted as each module finishes, so
 * the investigation screen reflects genuine module completion rather than a
 * timer. The verdict is computed from live Nansen data.
 */
export default function NewThesis() {
  const [stage, setStage] = useState<Stage>('compose');
  const [statement, setStatement] = useState('');
  const [asset, setAsset] = useState<AssetMeta | null>(null);
  const [progress, setProgress] = useState<Record<string, AgentProgress>>({});
  const [calls, setCalls] = useState<CallEvent[]>([]);
  const [thesis, setThesis] = useState<Thesis | null>(null);
  const [meta, setMeta] = useState<Omit<DoneEvent, 'thesis'> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState('00:00');
  const startedAt = useRef(0);
  const abort = useRef<AbortController | null>(null);

  const launch = useCallback((s: string, a: AssetMeta) => {
    setStatement(s);
    setAsset(a);
    setStage('preparing');
    window.scrollTo({ top: 0 });
  }, []);

  useEffect(() => {
    if (stage !== 'investigating') return;
    startedAt.current = Date.now();
    const t = setInterval(() => {
      const s = Math.floor((Date.now() - startedAt.current) / 1000);
      setElapsed(
        `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`,
      );
    }, 1000);
    return () => clearInterval(t);
  }, [stage]);

  const begin = useCallback(async () => {
    if (!asset) return;

    setStage('investigating');
    setCalls([]);
    setProgress(
      Object.fromEntries(
        AGENTS.map((a) => [a.id, { state: 'waiting', evidencePoints: 0 }]),
      ),
    );

    const ctrl = new AbortController();
    abort.current = ctrl;

    try {
      const res = await fetch('/api/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statement,
          asset: {
            symbol: asset.symbol,
            chain: asset.chain,
            address: asset.address,
            isNative: asset.isNative,
          },
        }),
        signal: ctrl.signal,
      });

      if (!res.body) throw new Error('No response stream');

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      // Parse the SSE frames as they arrive.
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const evLine = frame.split('\n').find((l) => l.startsWith('event: '));
          const dataLine = frame.split('\n').find((l) => l.startsWith('data: '));
          if (!evLine || !dataLine) continue;

          const event = evLine.slice(7).trim();
          const data = JSON.parse(dataLine.slice(6));

          if (event === 'progress') {
            setProgress((p) => ({
              ...p,
              [data.agent]: {
                state: data.state === 'done' ? 'done' : 'running',
                evidencePoints: data.evidencePoints ?? 0,
              },
            }));
          } else if (event === 'call') {
            setCalls((c) => [...c, data as CallEvent]);
          } else if (event === 'done') {
            const d = data as DoneEvent;
            setThesis(d.thesis);
            setMeta({
              investigationId: d.investigationId,
              creditsSpent: d.creditsSpent,
              creditsRemaining: d.creditsRemaining,
              liveCalls: d.liveCalls,
              calls: d.calls,
            });
            setStage('verdict');
            window.scrollTo({ top: 0 });
          } else if (event === 'error') {
            setError(data.message);
            setStage('failed');
          }
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError((e as Error).message);
        setStage('failed');
      }
    }
  }, [asset, statement]);

  useEffect(() => () => abort.current?.abort(), []);

  if (stage === 'compose') {
    return (
      <main className="mx-auto max-w-[680px] px-5 py-16 sm:py-24">
        <p className="font-mono text-[11px] tracking-[0.2em] text-ink-muted">
          NEW INVESTIGATION
        </p>
        <h1 className="mt-4 text-[32px] font-semibold leading-tight tracking-tight sm:text-[38px]">
          Put a thesis on trial
        </h1>
        <p className="mt-3 max-w-[52ch] text-[14.5px] leading-relaxed text-ink-secondary">
          State what you believe. Four agents will interrogate it against live
          on-chain data, then commit to the exact conditions that would prove it
          wrong.
        </p>

        <div className="mt-10">
          <Compose onLaunch={launch} />
        </div>
      </main>
    );
  }

  if (stage === 'preparing' && asset) {
    return (
      <main>
        <Preparing asset={asset} statement={statement} onBegin={begin} />
      </main>
    );
  }

  if (stage === 'investigating' && asset) {
    return (
      <main>
        <Investigating
          asset={asset}
          progress={progress}
          calls={calls}
          elapsed={elapsed}
        />
      </main>
    );
  }

  if (stage === 'verdict' && thesis && asset) {
    return (
      <main>
        <VerdictScreen
          thesis={thesis}
          asset={asset}
          investigationId={meta?.investigationId}
        />
        {meta && (
          <p className="pb-12 text-center font-mono text-[11px] text-ink-muted">
            {meta.liveCalls} live Nansen calls · {meta.creditsSpent} credits
            {meta.creditsRemaining !== null &&
              ` · ${meta.creditsRemaining.toLocaleString()} remaining`}
          </p>
        )}
      </main>
    );
  }

  if (stage === 'failed') {
    return (
      <main className="mx-auto max-w-[560px] px-5 py-24 text-center">
        <h1 className="text-[22px] font-semibold" style={{ color: 'var(--bearish)' }}>
          Investigation failed
        </h1>
        <p className="mt-3 text-[13.5px] leading-relaxed text-ink-secondary">
          {error}
        </p>
        <button
          type="button"
          onClick={() => {
            setError(null);
            setStage('compose');
          }}
          className="mt-8 rounded-xl px-5 py-3 text-[14px] font-semibold"
          style={{ background: 'var(--accent)', color: '#04120c' }}
        >
          Start over
        </button>
      </main>
    );
  }

  return null;
}
