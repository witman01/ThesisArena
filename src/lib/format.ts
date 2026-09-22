import type { Tripwire } from './types';

/** Compact USD, signed. `1_140_000` -> `+$1.14M`. */
export function usd(value: number, opts: { signed?: boolean } = {}): string {
  const { signed = true } = opts;
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : signed ? '+' : '';

  let body: string;
  if (abs >= 1_000_000_000) body = `${(abs / 1_000_000_000).toFixed(2)}B`;
  else if (abs >= 1_000_000) body = `${(abs / 1_000_000).toFixed(2)}M`;
  else if (abs >= 1_000) body = `${(abs / 1_000).toFixed(1)}K`;
  else if (abs >= 1) body = abs.toFixed(2).replace(/\.00$/, '');
  else if (abs > 0) {
    // Sub-dollar prices are common and must not round to "$1".
    body = abs.toFixed(abs < 0.01 ? 6 : 4).replace(/0+$/, '').replace(/\.$/, '');
  } else body = '0';

  return `${sign}$${body}`;
}

/** Formats a tripwire value according to its declared unit. */
export function metricValue(value: number, unit: Tripwire['metric']['unit']): string {
  switch (unit) {
    case 'usd':
      return usd(value, { signed: false });
    case 'pct':
      return `${value.toFixed(1)}%`;
    case 'ratio':
      return value.toFixed(3);
    case 'count':
      return Intl.NumberFormat('en-US').format(Math.round(value));
  }
}

/**
 * `-18` -> `-18`, `0` -> `0`, `18` -> `+18`.
 *
 * Rounds before choosing the sign. Deciding the sign first renders a value a
 * hair below zero as `-0`, which reads as a real negative when it is not.
 */
export function signed(value: number, digits = 0): string {
  const rounded = Number(value.toFixed(digits));
  return `${rounded > 0 ? '+' : ''}${rounded.toFixed(digits)}`;
}

/** A ratio as a signed percentage: `0.134` -> `+13.4%`, `-0.00004` -> `+0.0%`. */
export function signedPct(ratio: number, digits = 1): string {
  const pct = Number((ratio * 100).toFixed(digits));
  return `${pct >= 0 ? '+' : ''}${pct.toFixed(digits)}%`;
}

/** Short relative time: `2m ago`, `7h ago`. */
export function ago(isoString: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - new Date(isoString).getTime()) / 60_000));
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}

/** Builds an SVG polyline `points` string scaled into a w×h box. */
export function sparkPoints(
  values: number[],
  w: number,
  h: number,
  pad = 1,
): string {
  if (values.length === 0) return '';
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const stepX = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;

  return values
    .map((v, i) => {
      const x = pad + i * stepX;
      const y = pad + (h - pad * 2) * (1 - (v - min) / span);
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}
