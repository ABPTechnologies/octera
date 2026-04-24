/**
 * Shared placeholder panel used throughout the customer self-care scaffold.
 * Makes intent visible: what this feature will do, and where it sits in the
 * build roadmap (v1 wiring / v2 / later).
 *
 * Remove / replace with real UI as each surface gets fleshed out.
 */

interface PlaceholderPanelProps {
  title: string;
  description: string;
  status: 'v1 — wiring' | 'v1 — wiring with auth hardening' | 'v2' | 'later';
}

const STATUS_STYLES: Record<PlaceholderPanelProps['status'], string> = {
  'v1 — wiring': 'bg-octera-cyan/10 text-octera-cyan border-octera-cyan/30',
  'v1 — wiring with auth hardening':
    'bg-octera-cyan/10 text-octera-cyan border-octera-cyan/30',
  v2: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
  later: 'bg-octera-surface text-octera-muted border-octera-border',
};

export function PlaceholderPanel({
  title,
  description,
  status,
}: PlaceholderPanelProps) {
  return (
    <div className="card mb-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold">{title}</h3>
          <p className="mt-1 text-sm text-octera-muted">{description}</p>
        </div>
        <span
          className={`shrink-0 rounded border px-2 py-0.5 font-mono text-xs uppercase tracking-wider ${STATUS_STYLES[status]}`}
        >
          {status}
        </span>
      </div>
    </div>
  );
}
