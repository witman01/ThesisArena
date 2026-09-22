'use client';

import { useEffect, useRef, useState } from 'react';

/** Respects the OS setting; treated as static when motion is reduced. */
function prefersReduced(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

/**
 * Releases its children when they scroll into view.
 *
 * Renders visible-by-default and only hides once the observer is attached, so
 * the content is never trapped invisible if JS fails or never runs.
 */
export function Reveal({
  children,
  delay = 0,
  className = '',
}: {
  children: React.ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [armed, setArmed] = useState(false);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    if (prefersReduced()) return;
    const el = ref.current;
    if (!el) return;

    setArmed(true);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.05 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`${armed ? 'reveal' : ''} ${className}`}
      data-shown={shown ? 'true' : 'false'}
      style={armed ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </div>
  );
}

/**
 * Animates a number up to `value` once it enters view.
 *
 * The final value is rendered on the server and on the first client paint, so
 * the markup matches during hydration and the number is correct without JS.
 */
export function CountUp({
  value,
  duration = 1100,
  decimals = 0,
  className = '',
}: {
  value: number;
  duration?: number;
  decimals?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (prefersReduced()) return;
    const el = ref.current;
    if (!el) return;

    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        io.disconnect();

        const start = performance.now();
        let raf = 0;
        const tick = (now: number) => {
          const t = Math.min(1, (now - start) / duration);
          // easeOutCubic
          setDisplay(value * (1 - Math.pow(1 - t, 3)));
          if (t < 1) raf = requestAnimationFrame(tick);
        };
        setDisplay(0);
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
      },
      { threshold: 0.3 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [value, duration]);

  return (
    <span ref={ref} className={className}>
      {display.toFixed(decimals)}
    </span>
  );
}

/** Fills from 0 to `pct` when scrolled into view. */
export function GrowBar({
  pct,
  color,
  height = 6,
  label,
}: {
  pct: number;
  color: string;
  height?: number;
  label: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(pct);

  useEffect(() => {
    if (prefersReduced()) return;
    const el = ref.current;
    if (!el) return;

    setW(0);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          requestAnimationFrame(() => setW(pct));
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [pct]);

  return (
    <div
      ref={ref}
      className="w-full overflow-hidden rounded-full"
      style={{ height, background: 'var(--surface-3)' }}
      role="meter"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${w}%`,
          background: color,
          transition: 'width 1100ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      />
    </div>
  );
}
