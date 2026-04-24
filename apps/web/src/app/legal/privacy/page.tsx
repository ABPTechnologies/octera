import type { Metadata } from 'next';
import { AttorneyReview } from '@/components/AttorneyReview';

export const metadata: Metadata = {
  title: 'Privacy Policy — Octera',
  description: 'How Octera handles your personal information.',
};

export default function PrivacyPage() {
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold">Privacy Policy</h1>
      <p className="mb-8 text-sm text-octera-muted">
        Effective date: [DATE]. Version: draft-0.
      </p>

      <AttorneyReview>
        Placeholder copy. Because Octera operates from Belgium, a GDPR-focused
        privacy review by a qualified data protection specialist is required
        before public launch. Key items needing attorney input: lawful bases
        per Article 6 GDPR, international-transfer mechanisms (SCCs for any
        non-EU processing), and the DPO contact under Article 37.
      </AttorneyReview>

      <h2>1. Who we are</h2>
      <p>
        Octera is operated by <strong>ABP Technologies BVBA</strong>
        (Kleinhoefstraat 5/18, Belgium). For data-protection matters, contact{' '}
        <a href="mailto:privacy@octera.net">privacy@octera.net</a>.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li>
          <strong>Account data:</strong> email, name, password hash,
          authentication tokens.
        </li>
        <li>
          <strong>Service data:</strong> domain names, DNS records, hosting
          configuration, SSL certificates, email account configuration, support
          ticket content.
        </li>
        <li>
          <strong>Billing data:</strong> payment method metadata (handled by
          Stripe — we don&apos;t store card numbers), invoices, billing address.
        </li>
        <li>
          <strong>Usage data:</strong> request logs, error reports, product
          analytics (via PostHog, when enabled).
        </li>
      </ul>

      <h2>3. How we use it</h2>
      <p>
        To provide and secure the Services, bill you, send transactional
        emails (account verification, invoices, security alerts), respond to
        support requests, and comply with legal obligations.
      </p>

      <h2>4. Sharing</h2>
      <p>We share data only with:</p>
      <ul>
        <li>
          <strong>Infrastructure providers</strong> — gig.tech (cloud
          compute), our registrar partners (domain registration), the datacenter
          operator (physical hosting).
        </li>
        <li>
          <strong>Payment processors</strong> — Stripe.
        </li>
        <li>
          <strong>Operational tools</strong> — Resend (email delivery),
          Sentry (error tracking), PostHog (analytics).
        </li>
        <li>
          <strong>Authorities</strong> — only when required by law.
        </li>
      </ul>

      <h2>5. Your rights (GDPR)</h2>
      <p>
        You have the right to access, rectify, erase, restrict, and port your
        data, and to object to processing. To exercise any of these rights,
        contact us at{' '}
        <a href="mailto:privacy@octera.net">privacy@octera.net</a>. You also
        have the right to lodge a complaint with the Belgian Data Protection
        Authority.
      </p>

      <h2>6. International transfers</h2>
      <AttorneyReview>
        List of processors and their host countries, plus the applicable
        transfer mechanism (SCCs, adequacy decision, etc.), must be populated
        by counsel based on the final integration list at launch.
      </AttorneyReview>

      <h2>7. Retention</h2>
      <p>
        Account data is kept while your account is active and for a reasonable
        period afterwards to handle refunds and legal claims. Billing records
        are kept for the duration required by Belgian tax law.
      </p>

      <h2>8. Security</h2>
      <p>
        Passwords are hashed with argon2id. Access tokens are short-lived and
        rotated. All web traffic is HTTPS. Internal systems are protected by
        access controls and audit logging.
      </p>

      <h2>9. Changes</h2>
      <p>
        Material changes to this policy will be announced at least 30 days
        before they take effect.
      </p>
    </>
  );
}
