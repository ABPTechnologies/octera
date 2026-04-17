import Link from 'next/link';
import { Logo } from '@/components/Logo';

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Ambient background glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(600px at 20% 20%, rgba(34,211,238,0.12), transparent 60%), radial-gradient(700px at 80% 70%, rgba(59,130,246,0.12), transparent 60%)',
        }}
      />

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <Logo />
        <nav className="flex items-center gap-3">
          <Link href="/login" className="btn-ghost">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Get started
          </Link>
        </nav>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-24 pt-20 text-center">
        <h1 className="text-5xl font-semibold tracking-tight md:text-6xl">
          Domains, hosting, and cloud &mdash;{' '}
          <span className="bg-octera-gradient bg-clip-text text-transparent">
            reimagined
          </span>
          .
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-octera-muted">
          Octera is your full-stack platform for domain registration, cloud hosting,
          and marketplace services &mdash; built on decentralized infrastructure.
        </p>
        <div className="mt-10 flex items-center justify-center gap-4">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">
            Create your account
          </Link>
          <Link href="/login" className="btn-ghost px-6 py-3 text-base">
            Sign in
          </Link>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl grid-cols-1 gap-4 px-6 pb-24 md:grid-cols-3">
        {[
          {
            title: 'Domains',
            body: 'Search, register, transfer, and manage domains with live pricing and full DNS control.',
          },
          {
            title: 'Cloud hosting',
            body: 'Provision hosting plans backed by decentralized infrastructure, with SSL and email built in.',
          },
          {
            title: 'Marketplace',
            body: 'Buy, sell, and broker premium domains with optional escrow and secure transfer.',
          },
        ].map((f) => (
          <div key={f.title} className="card">
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-octera-muted">{f.body}</p>
          </div>
        ))}
      </section>

      <footer className="border-t border-octera-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6 text-sm text-octera-muted">
          <span>&copy; {new Date().getFullYear()} Octera</span>
          <span>v0.0.1</span>
        </div>
      </footer>
    </main>
  );
}
