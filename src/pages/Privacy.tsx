import { Link } from "react-router-dom";
import { BrivanoLogo } from "@/components/BrivanoLogo";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border"><div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5"><Link to="/"><BrivanoLogo className="h-16 dark:invert" /></Link><Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link></div></header>
      <main className="mx-auto max-w-4xl px-6 py-14">
        <p className="text-sm text-muted-foreground">Last updated September 28, 2026</p>
        <h1 className="mt-2 text-4xl font-semibold">Privacy Policy</h1>
        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <Section title="Information we collect"><p>We collect account and workspace information you provide, including your name, email, phone number, company, role, billing details, mailing address, and communication settings. We also process leads, property records, searches, messages, call records, recordings, transcripts, campaign activity, integrations, and support requests you choose to create or connect.</p></Section>
          <Section title="How we use information"><p>We use information to provide, secure, support, and improve Brivano; process searches and contact lookups; deliver messages and calls you initiate; manage subscriptions; prevent abuse; maintain suppression lists; and meet legal obligations. We do not sell personal information.</p></Section>
          <Section title="Service providers and integrations"><p>We share information only as needed with hosting, payment, communications, analytics, artificial intelligence, and data providers that help operate the service, or with integrations you direct us to use. These providers process information under their own terms and privacy commitments.</p></Section>
          <Section title="Communications and opt-outs"><p>Workspace users are responsible for lawful outreach. We process text opt-out replies and email unsubscribe requests to block future outreach through the relevant channel. Transactional account messages may still be sent when necessary to provide the service.</p></Section>
          <Section title="Retention and security"><p>We retain workspace data while an account is active and as reasonably necessary for operations, dispute resolution, security, and legal compliance. We use access controls, encryption in transit and at rest, and workspace isolation, but no system can guarantee absolute security.</p></Section>
          <Section title="Your choices and rights"><p>You may update account information in Settings, delete records available in the product, disconnect integrations, and request access, correction, or deletion where applicable. Legal rights vary by location and may include appeal or complaint rights.</p></Section>
          <Section title="Contact"><p>For privacy questions or requests, email <a className="underline" href="mailto:info@brivano.io">info@brivano.io</a>. We may update this policy as the service changes and will revise the date above.</p></Section>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-t border-border pt-6"><h2 className="mb-2 text-lg font-semibold text-foreground">{title}</h2>{children}</section>;
}