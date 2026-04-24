import type { ReactNode } from 'react';

/**
 * Highlights a paragraph of legal-page copy that needs a qualified attorney
 * to write the real thing before launch. Visually obvious (amber banner) so
 * the flag isn't missed by anyone skimming the docs.
 */
export function AttorneyReview({ children }: { children: ReactNode }) {
  return (
    <aside className="my-6 rounded-md border border-amber-500/40 bg-amber-500/5 p-4 text-sm text-amber-200">
      <p className="mb-1 font-mono text-xs uppercase tracking-wider text-amber-400">
        ⚠ Attorney review required
      </p>
      <div className="text-amber-100/90">{children}</div>
    </aside>
  );
}
