'use client';

import { LifeBuoy } from 'lucide-react';
import { PlaceholderPanel } from '@/components/PlaceholderPanel';

export default function TicketsPage() {
  return (
    <>
      <header className="mb-6 flex items-center gap-3">
        <LifeBuoy className="h-6 w-6 text-octera-cyan" />
        <h1 className="text-3xl font-semibold">Support tickets</h1>
      </header>
      <p className="mb-8 text-octera-muted">
        Open a ticket with our support team. Track the status of existing
        requests and read replies. For urgent incidents, contact us by phone or
        email — see Account &rarr; Support settings.
      </p>

      <PlaceholderPanel
        title="Your tickets"
        description="Open, in-progress, and resolved tickets. Filter by status, priority, or resource."
        status="v1 — wiring"
      />

      <PlaceholderPanel
        title="Open a new ticket"
        description="Describe the issue, optionally attach screenshots, and choose which resource (domain, VM, cloudspace) the ticket relates to."
        status="v1 — wiring"
      />

      <PlaceholderPanel
        title="Knowledge base"
        description="Searchable documentation for common tasks — often faster than opening a ticket."
        status="later"
      />
    </>
  );
}
