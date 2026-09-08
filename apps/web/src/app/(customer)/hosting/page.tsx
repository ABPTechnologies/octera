'use client';

/**
 * Hosting — the signed-in customer's own gig.tech cloudspaces
 * (GET /v1/account/hosting, scoped by their gigtechCustomerId).
 */

import { useEffect, useState } from 'react';
import { Server } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

interface CloudspaceRow {
  cloudspace_id?: string;
  id?: string;
  name?: string;
  status?: string;
  location?: string;
}

type State = 'loading' | 'ok' | 'unlinked' | 'error';

export default function HostingPage() {
  const [rows, setRows] = useState<CloudspaceRow[]>([]);
  const [state, setState] = useState<State>('loading');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { cloudspaces } = await api<{ cloudspaces: CloudspaceRow[] }>('/v1/account/hosting');
        setRows(cloudspaces ?? []);
        setState('ok');
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setState('unlinked');
          setMsg(e.message);
        } else {
          setState('error');
          setMsg(e instanceof ApiError ? e.message : 'Failed to load hosting');
        }
      }
    })();
  }, []);

  return (
    <>
      <header className="mb-6 flex items-center gap-3">
        <Server className="h-6 w-6 text-octera-cyan" />
        <h1 className="text-3xl font-semibold">Hosting</h1>
      </header>
      <p className="mb-8 text-octera-muted">
        Your cloudspaces on Octera Cloud. Self-service provisioning + scaling arrive next; for now
        your existing spaces are listed here.
      </p>

      {state === 'loading' && <p className="text-sm text-octera-muted">Loading…</p>}
      {state === 'unlinked' && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
          {msg}
        </p>
      )}
      {state === 'error' && <p className="text-sm text-red-400">{msg}</p>}

      {state === 'ok' && rows.length === 0 && (
        <p className="text-sm text-octera-muted">No cloudspaces yet.</p>
      )}
      {state === 'ok' && rows.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {rows.map((r, i) => (
            <div
              key={r.cloudspace_id ?? r.id ?? r.name ?? i}
              className="rounded-xl border border-white/10 bg-white/[0.02] p-5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-white">{r.name ?? 'Cloudspace'}</h3>
                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-octera-muted">
                  {r.status ?? '—'}
                </span>
              </div>
              <p className="mt-2 text-sm text-octera-muted">{r.location ?? ''}</p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
