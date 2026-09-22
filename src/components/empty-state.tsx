import Link from 'next/link';

/**
 * Honest empty state.
 *
 * Used wherever there is no real data yet. The product never invents an
 * investigation, a score or a usage figure to fill space.
 */
export function EmptyState({
  title,
  body,
  cta = true,
}: {
  title: string;
  body: string;
  cta?: boolean;
}) {
  return (
    <div
      className="rounded-[14px] px-6 py-12 text-center"
      style={{
        background: 'var(--surface-1)',
        border: '1px dashed var(--border-neutral)',
      }}
    >
      <h3 className="text-[16px] font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-[48ch] text-[13.5px] leading-relaxed text-ink-secondary">
        {body}
      </p>
      {cta && (
        <Link
          href="/new"
          className="mt-6 inline-block rounded-lg px-4 py-2.5 text-[13px] font-semibold"
          style={{ background: 'var(--accent)', color: '#04120c' }}
        >
          Put a thesis on trial
        </Link>
      )}
    </div>
  );
}
