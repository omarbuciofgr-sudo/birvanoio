import { Link } from "react-router-dom";
import { Shield, Lock, Database, Mail, FileText, Users } from "lucide-react";

export default function Trust() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border">
        <div className="container mx-auto px-6 py-6 flex items-center justify-between">
          <Link to="/" className="font-semibold tracking-tight">Brivano</Link>
          <nav className="flex gap-6 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-foreground">Home</Link>
            <Link to="/auth" className="hover:text-foreground">Sign in</Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-6 py-16 max-w-4xl">
        <div className="space-y-3 mb-10">
          <span className="inline-flex items-center gap-2 text-xs uppercase tracking-wider text-muted-foreground">
            <Shield className="h-3.5 w-3.5" /> Trust Center
          </span>
          <h1 className="text-4xl font-semibold tracking-tight">Security &amp; Privacy at Brivano</h1>
          <p className="text-muted-foreground max-w-2xl">
            This page is maintained by Brivano to answer common security and privacy questions about
            the Brivano platform. It describes controls we have enabled today; it is not an independent
            certification or third-party audit.
          </p>
        </div>

        <Section icon={<Lock className="h-4 w-4" />} title="Authentication & access control">
          <ul className="list-disc pl-6 space-y-1.5">
            <li>Email + password and Google sign-in are available for end users.</li>
            <li>Customer data is isolated per workspace; access is enforced by row-level security in the database.</li>
            <li>Workspace roles (owner, admin, member, viewer) gate what each user can see and change.</li>
            <li>Administrative actions are restricted to users with an explicit admin role.</li>
          </ul>
        </Section>

        <Section icon={<Database className="h-4 w-4" />} title="Platform & hosting">
          <p>
            Brivano runs on the Lovable Cloud platform, which provides managed Postgres, authentication,
            edge functions, and storage. Lovable Cloud handles encryption in transit (TLS) and
            encryption at rest for the managed database. References to Lovable platform features
            describe enabled capabilities — they are not Lovable-issued certifications.
          </p>
        </Section>

        <Section icon={<FileText className="h-4 w-4" />} title="Data collection & use">
          <ul className="list-disc pl-6 space-y-1.5">
            <li>We collect the account information you provide (name, email, company, role, industry).</li>
            <li>We process the prospect, lead, and enrichment data you create or import to operate the product for you.</li>
            <li>We do not sell your data. We use it to provide and improve the service you signed up for.</li>
          </ul>
        </Section>

        <Section icon={<Users className="h-4 w-4" />} title="Subprocessors & integrations">
          <p>
            Brivano uses third-party providers to deliver core functionality, including data enrichment,
            messaging, payments, and AI features. Integrations you configure (CRMs, webhooks, email
            providers) send data only where you direct it. Credentials and API keys you provide are
            stored encrypted and are not readable from the client application.
          </p>
        </Section>

        <Section icon={<Shield className="h-4 w-4" />} title="Retention & deletion">
          <p>
            Workspace data is retained for as long as your account is active. You can delete leads,
            campaigns, and other records you create from within the app. To request full account
            deletion, contact us at the address below.
          </p>
        </Section>

        <Section icon={<Mail className="h-4 w-4" />} title="Security contact & vulnerability reporting">
          <p>
            To report a suspected vulnerability or ask a security question, email{" "}
            <a href="mailto:info@brivano.io" className="underline">info@brivano.io</a>. Please include
            steps to reproduce and avoid accessing data that is not your own while testing.
          </p>
        </Section>

        <Section icon={<FileText className="h-4 w-4" />} title="Compliance">
          <p>
            Brivano does not currently claim SOC 2, ISO 27001, HIPAA, PCI, or GDPR certification on
            this page. If you need specific contractual or compliance commitments for your
            organization, contact us and we will share what we can provide.
          </p>
        </Section>

        <p className="text-xs text-muted-foreground mt-12">
          Shared responsibility: Brivano operates the application and configures platform controls.
          Lovable Cloud operates the underlying infrastructure. You are responsible for managing user
          access in your workspace and the integrations and data you connect.
        </p>
      </main>
    </div>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="border-t border-border py-8">
      <h2 className="flex items-center gap-2 text-lg font-medium mb-3">
        <span className="text-muted-foreground">{icon}</span>
        {title}
      </h2>
      <div className="text-sm text-muted-foreground leading-relaxed space-y-2">{children}</div>
    </section>
  );
}
