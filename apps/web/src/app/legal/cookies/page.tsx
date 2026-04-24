import type { Metadata } from 'next';
import { AttorneyReview } from '@/components/AttorneyReview';

export const metadata: Metadata = {
  title: 'Cookie Policy — Octera',
  description: 'How Octera uses cookies and similar technologies.',
};

export default function CookiesPage() {
  return (
    <>
      <h1 className="mb-2 text-3xl font-semibold">Cookie Policy</h1>
      <p className="mb-8 text-sm text-octera-muted">
        Effective date: [DATE]. Version: draft-0.
      </p>

      <AttorneyReview>
        Placeholder copy. Because Octera serves EU users, counsel must confirm
        (a) we surface a consent UI that meets ePrivacy Directive requirements
        for non-essential cookies, and (b) the list below accurately reflects
        cookies set at launch.
      </AttorneyReview>

      <h2>What are cookies?</h2>
      <p>
        Cookies are small files stored on your device when you visit a
        website. They remember who you are across pages, keep you signed in,
        and help us understand how the site is used.
      </p>

      <h2>Cookies we use</h2>
      <h3>Strictly necessary</h3>
      <ul>
        <li>
          <code>octera_rt</code> — httpOnly refresh token cookie issued after
          sign-in. Lets you stay logged in. Cannot be disabled without signing
          out.
        </li>
      </ul>
      <h3>Analytics (only when enabled with your consent)</h3>
      <ul>
        <li>
          <code>ph_*</code> — PostHog analytics cookies. Help us understand
          anonymized product usage. Set only after explicit consent via the
          cookie banner.
        </li>
      </ul>

      <h2>Third-party cookies</h2>
      <p>
        When you go through Stripe checkout, Stripe sets its own cookies to
        manage the payment session. Those are governed by Stripe&apos;s
        cookie policy.
      </p>

      <h2>How to control cookies</h2>
      <p>
        You can decline non-essential cookies in our cookie banner on first
        visit, and change that choice any time by clicking &ldquo;Cookie
        settings&rdquo; at the bottom of any page. Most browsers also let you
        block or delete cookies directly — check your browser&apos;s help pages.
      </p>

      <h2>Contact</h2>
      <p>
        Questions? Email{' '}
        <a href="mailto:privacy@octera.net">privacy@octera.net</a>.
      </p>
    </>
  );
}
