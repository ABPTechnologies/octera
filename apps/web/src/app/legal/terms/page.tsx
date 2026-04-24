import type { Metadata } from 'next';
import { AttorneyReview } from '@/components/AttorneyReview';

export const metadata: Metadata = {
  title: 'Terms of Service — Octera',
  description: 'Terms governing your use of Octera products and services.',
};

export default function TermsPage() {
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold">Terms of Service</h1>
      <p className="mb-8 text-sm text-octera-muted">
        Effective date: [DATE]. Version: draft-0.
      </p>

      <AttorneyReview>
        This page is placeholder copy. A qualified attorney admitted in the
        operator&apos;s jurisdiction (Belgium / EU) must review and finalize
        every section before public launch. Do not treat the draft below as
        legally binding.
      </AttorneyReview>

      <h2>1. Agreement</h2>
      <p>
        These Terms of Service (&ldquo;Terms&rdquo;) form a binding agreement
        between you and <strong>ABP Technologies BVBA</strong>, operator of
        Octera (&ldquo;Octera&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;). By
        creating an account or using our services you agree to these Terms.
      </p>

      <h2>2. Eligibility</h2>
      <p>
        You must be at least 18 years old and have legal capacity to contract.
        If you&apos;re using Octera on behalf of an organization, you represent
        that you have authority to bind that organization.
      </p>

      <h2>3. Services</h2>
      <p>
        Octera provides domain registration, cloud hosting, SSL certificate
        management, email, and related services (&ldquo;Services&rdquo;). Some
        Services rely on third-party infrastructure including gig.tech and
        registrar partners; those third parties&apos; terms apply to their
        portion of the stack.
      </p>

      <h2>4. Fees and Payment</h2>
      <p>
        Current pricing is published on octera.net. Fees are charged in advance
        for subscription services and at time of purchase for one-off
        registrations. Payments are processed by Stripe under their own terms.
      </p>

      <h2>5. Term and Termination</h2>
      <p>
        These Terms remain in effect while you have an account. Either party
        may terminate for convenience with 30 days&apos; notice; we may
        terminate immediately for breach of the Acceptable Use Policy.
      </p>

      <h2>6. Warranties and Disclaimers</h2>
      <AttorneyReview>
        Warranty scope, disclaimers, and limitation-of-liability caps must be
        drafted by counsel. Jurisdictions differ substantially on enforceability
        of broad disclaimers.
      </AttorneyReview>

      <h2>7. Limitation of Liability</h2>
      <AttorneyReview>
        Placeholder — see above. In particular, any statutory consumer
        protections under Belgian / EU law that cannot be disclaimed must be
        preserved.
      </AttorneyReview>

      <h2>8. Governing Law</h2>
      <p>
        These Terms are governed by the laws of Belgium. Disputes are subject
        to the exclusive jurisdiction of the courts of Brussels, without
        prejudice to mandatory consumer-protection rules.
      </p>

      <h2>9. Changes</h2>
      <p>
        We may update these Terms from time to time. Material changes will be
        announced at least 30 days before they take effect. Continued use after
        the effective date constitutes acceptance.
      </p>

      <h2>10. Contact</h2>
      <p>
        Questions? Email <a href="mailto:legal@octera.net">legal@octera.net</a>.
      </p>
    </>
  );
}
