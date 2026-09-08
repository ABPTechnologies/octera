'use client';

/**
 * SSL — the signed-in customer's own certificates
 * (GET /v1/account/ssl, scoped by their gigtechCustomerId).
 */

import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

interface CertRow {
  id?: string;
  name?: string;
  common_name?: string;
  domain?: string;
  status?: string;
  expires_at?: string;
  valid_until?: string;
}

type State = 'loading' | 'ok' | 'unlinked' | 'error';

export default function SslPage() {
  const [rows, setRows] = useState<CertRow[]>([]);
  const [state, setState] = useState<State>('loading');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { certificates } = await api<{ certificates: CertRow[] }>('/v1/account/ssl');
        setRows(certificates ?? []);
        setState('ok');
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setState('unlinked');
          setMsg(e.message);
        } else {
          setState('error');
          setMsg(e instanceof ApiError ? e.message : 'Failed to load certificates');
        }
      }
    })();
  }, []);

  return (
    <>
      <header className="mb-6 flex items-center gap-3">
        <ShieldCheck className="h-6 w-6 text-octera-cyan" />
        <h1 className="text-3xl font-semibold">SSL certificates</h1>
      </header>

      {state === 'loading' && <p className="text-sm text-octera-muted">Loading…</p>}
      {state === 'unlinked' && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
          {msg}
        </p>
      )}
      {state === 'error' && <p className="text-sm text-red-400">{msg}</p>}

      {state === 'ok' && rows.length === 0 && (
        <p className="text-sm text-octera-muted">No certificates yet. Certificates issued for your hosting appear here.</p>
      )}
      {state === 'ok' && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-left text-octera-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Certificate</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const expiry = r.expires_at ?? r.valid_until;
                return (
                  <tr key={r.id ?? r.common_name ?? i} className="border-t border-white/5">
                    <td className="px-4 py-3 font-medium text-white">
                      {r.common_name ?? r.domain ?? r.name ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-octera-muted">{r.status ?? '—'}</td>
                    <td className="px-4 py-3 text-octera-muted">
                      {expiry ? new Date(expiry).toLocaleDateString('en-GB') : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
