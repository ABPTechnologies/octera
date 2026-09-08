'use client';

/**
 * Invoices — the signed-in customer's own gig.tech invoices
 * (GET /v1/account/invoices, scoped by their gigtechCustomerId).
 */

import { useEffect, useState } from 'react';
import { FileText } from 'lucide-react';
import { api, ApiError } from '@/lib/api';

interface InvoiceRow {
  invoice_id?: string;
  id?: string;
  number?: string;
  currency?: string;
  total_incl?: number;
  total?: number;
  status?: string;
  payment_status?: string;
  creation_timestamp?: number;
}

type State = 'loading' | 'ok' | 'unlinked' | 'error';

export default function InvoicesPage() {
  const [rows, setRows] = useState<InvoiceRow[]>([]);
  const [state, setState] = useState<State>('loading');
  const [msg, setMsg] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { invoices } = await api<{ invoices: InvoiceRow[] }>('/v1/account/invoices');
        setRows(invoices ?? []);
        setState('ok');
      } catch (e) {
        if (e instanceof ApiError && e.status === 409) {
          setState('unlinked');
          setMsg(e.message);
        } else {
          setState('error');
          setMsg(e instanceof ApiError ? e.message : 'Failed to load invoices');
        }
      }
    })();
  }, []);

  return (
    <>
      <header className="mb-6 flex items-center gap-3">
        <FileText className="h-6 w-6 text-octera-cyan" />
        <h1 className="text-3xl font-semibold">Invoices</h1>
      </header>

      {state === 'loading' && <p className="text-sm text-octera-muted">Loading…</p>}
      {state === 'unlinked' && (
        <p className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-300">
          {msg}
        </p>
      )}
      {state === 'error' && <p className="text-sm text-red-400">{msg}</p>}

      {state === 'ok' && rows.length === 0 && (
        <p className="text-sm text-octera-muted">No invoices yet.</p>
      )}
      {state === 'ok' && rows.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-white/10">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.03] text-left text-octera-muted">
              <tr>
                <th className="px-4 py-3 font-medium">Number</th>
                <th className="px-4 py-3 font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => {
                const amount = r.total_incl ?? r.total;
                return (
                  <tr key={r.invoice_id ?? r.id ?? r.number ?? i} className="border-t border-white/5">
                    <td className="px-4 py-3 font-medium text-white">{r.number ?? '—'}</td>
                    <td className="px-4 py-3 text-octera-muted">
                      {amount != null ? `${amount.toFixed(2)} ${r.currency ?? ''}`.trim() : '—'}
                    </td>
                    <td className="px-4 py-3 text-octera-muted">{r.payment_status ?? r.status ?? '—'}</td>
                    <td className="px-4 py-3 text-octera-muted">
                      {r.creation_timestamp
                        ? new Date(r.creation_timestamp * 1000).toLocaleDateString('en-GB')
                        : '—'}
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
