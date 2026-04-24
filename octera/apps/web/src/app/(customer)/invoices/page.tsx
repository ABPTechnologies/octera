'use client';

import { Receipt } from 'lucide-react';
import { PlaceholderPanel } from '@/components/PlaceholderPanel';

export default function InvoicesPage() {
  return (
    <>
      <header className="mb-6 flex items-center gap-3">
        <Receipt className="h-6 w-6 text-octera-cyan" />
        <h1 className="text-3xl font-semibold">Invoices & billing</h1>
      </header>
      <p className="mb-8 text-octera-muted">
        Monthly invoices, usage summaries, and payment history for your Octera
        subscription. Download PDFs for bookkeeping.
      </p>

      <PlaceholderPanel
        title="Invoice history"
        description="Monthly invoices with line items per resource. Downloadable as PDF."
        status="v1 — wiring"
      />

      <PlaceholderPanel
        title="Usage this month"
        description="Compute, storage, transfer, and public IPs consumed — with per-resource drill-down."
        status="v1 — wiring"
      />

      <PlaceholderPanel
        title="Payment methods"
        description="Credit card on file via Stripe. Change card, view receipts, set defaults."
        status="v1 — wiring"
      />
    </>
  );
}
