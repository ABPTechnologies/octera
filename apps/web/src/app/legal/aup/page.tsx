import type { Metadata } from 'next';
import { AttorneyReview } from '@/components/AttorneyReview';

export const metadata: Metadata = {
  title: 'Acceptable Use Policy — Octera',
  description: 'What you may and may not do on Octera infrastructure.',
};

export default function AupPage() {
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold">Acceptable Use Policy</h1>
      <p className="mb-8 text-sm text-octera-muted">
        Effective date: [DATE]. Version: draft-0.
      </p>

      <AttorneyReview>
        Placeholder copy. Review with counsel before public launch to ensure
        alignment with (a) Belgian telecom and cybercrime law, (b) gig.tech
        and underlying provider AUPs we pass through, and (c) ICANN
        obligations for domain services.
      </AttorneyReview>

      <h2>1. Scope</h2>
      <p>
        This Acceptable Use Policy (&ldquo;AUP&rdquo;) governs your use of
        Octera infrastructure and services. It applies to you directly and to
        anyone using the Services on your account.
      </p>

      <h2>2. Prohibited content and activity</h2>
      <p>
        You may not use Octera to host, distribute, or facilitate:
      </p>
      <ul>
        <li>Child sexual abuse material or any content sexualizing minors.</li>
        <li>
          Content inciting violence, terrorism, or unlawful discrimination.
        </li>
        <li>
          Malware, ransomware, phishing kits, credential stuffers, or tooling
          designed to compromise third-party systems.
        </li>
        <li>
          Unsolicited bulk email (spam), unlawful marketing, or email
          infrastructure that defeats authentication controls.
        </li>
        <li>
          Content that infringes copyright, trademark, or other intellectual
          property rights.
        </li>
        <li>Illegal online gambling or unlicensed financial services.</li>
        <li>
          Distributed denial-of-service attacks, network probing, or attempts
          to circumvent our security controls.
        </li>
      </ul>

      <h2>3. Resource abuse</h2>
      <p>
        Shared resources must be used in a way that doesn&apos;t meaningfully
        degrade service for other customers. We may throttle or suspend
        workloads that consume far more than your plan implies without
        coordination with us.
      </p>

      <h2>4. Copyright (DMCA / EUCD)</h2>
      <p>
        If you believe content hosted on Octera infringes your copyright, email{' '}
        <a href="mailto:abuse@octera.net">abuse@octera.net</a> with a compliant
        notice identifying the work, the infringing location, and your contact
        details under penalty of perjury.
      </p>

      <h2>5. Reporting abuse</h2>
      <p>
        For all other abuse reports (phishing, malware, spam, illegal
        content), email <a href="mailto:abuse@octera.net">abuse@octera.net</a>.
        We investigate all reports received and act within a reasonable time.
      </p>

      <h2>6. Consequences</h2>
      <p>
        We may remove content, suspend access, or terminate accounts for AUP
        violations. Severity determines the response; we try to give notice
        when it&apos;s safe to do so, but urgent risks to third parties
        (active phishing campaigns, for example) may require immediate action.
      </p>

      <h2>7. Changes</h2>
      <p>
        We may update this AUP to address emerging threats. Material changes
        will be announced; we won&apos;t punish conduct retroactively.
      </p>
    </>
  );
}
