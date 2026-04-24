'use client';

import { Mail } from 'lucide-react';
import { PlaceholderPanel } from '@/components/PlaceholderPanel';

export default function EmailPage() {
  return (
    <>
      <header className="mb-6 flex items-center gap-3">
        <Mail className="h-6 w-6 text-octera-cyan" />
        <h1 className="text-3xl font-semibold">Email accounts</h1>
      </header>
      <p className="mb-8 text-octera-muted">
        Professional email addresses at your own domains. Create mailboxes,
        forwarders, and aliases. Webmail and IMAP/SMTP access provided by
        gig.tech&apos;s managed mail service.
      </p>

      <PlaceholderPanel
        title="Mailboxes"
        description="Create accounts like info@yourcompany.com with storage quotas, passwords, and out-of-office replies."
        status="v1 — wiring"
      />

      <PlaceholderPanel
        title="Forwarders & aliases"
        description="Route mail to external addresses or create aliases for an existing mailbox."
        status="v1 — wiring"
      />

      <PlaceholderPanel
        title="DKIM / SPF / DMARC"
        description="Authentication records configured automatically when you add email to a domain. Review and customize here."
        status="v1 — wiring"
      />
    </>
  );
}
