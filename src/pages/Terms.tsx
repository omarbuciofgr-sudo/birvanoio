import { Link } from "react-router-dom";
import { BrivanoLogo } from "@/components/BrivanoLogo";

export default function Terms() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border"><div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-5"><Link to="/"><BrivanoLogo className="h-16 dark:invert" /></Link><Link to="/" className="text-sm text-muted-foreground hover:text-foreground">Home</Link></div></header>
      <main className="mx-auto max-w-4xl px-6 py-14">
        <p className="text-sm text-muted-foreground">Last updated September 28, 2026</p>
        <h1 className="mt-2 text-4xl font-semibold">Terms of Service</h1>
        <div className="mt-10 space-y-8 text-sm leading-7 text-muted-foreground">
          <Section title="Agreement and eligibility"><p>By creating an account or using Brivano, you agree to these terms. You must be legally able to enter this agreement and provide accurate account and billing information.</p></Section>
          <Section title="Permitted use"><p>You may use Brivano for lawful business purposes. You may not misuse the service, interfere with its operation, access another customer’s data, circumvent limits, resell access without permission, or use collected information in violation of law or third-party rights.</p></Section>
          <Section title="Outreach compliance"><p>You are solely responsible for the recipients, timing, content, and legal basis of calls, texts, and emails you send. You must comply with the TCPA, Do Not Call rules, CAN-SPAM, consent requirements, calling-hour restrictions, and other applicable laws. You must honor opt-outs promptly and may not bypass Brivano suppression controls.</p></Section>
          <Section title="Customer data and third-party services"><p>You retain ownership of data you submit and authorize us to process it to provide the service. Data sources and integrations may be incomplete, delayed, or inaccurate. You are responsible for reviewing results before acting on them and for complying with third-party terms.</p></Section>
          <Section title="Plans, credits, and payment"><p>Paid plans, usage credits, limits, renewal terms, and prices are shown at purchase. Charges are non-refundable except where required by law. We may suspend paid functionality for failed payments or misuse. Credits have no cash value and are governed by the terms shown when purchased.</p></Section>
          <Section title="Availability and disclaimers"><p>The service is provided “as is” and “as available.” We do not guarantee uninterrupted availability, specific lead results, contact accuracy, delivery, response rates, or business outcomes. AI-generated content may contain errors and requires your review.</p></Section>
          <Section title="Limitation and termination"><p>To the fullest extent permitted by law, Brivano is not liable for indirect, incidental, special, consequential, or lost-profit damages. We may suspend or terminate access for violations, risk, nonpayment, or legal requirements. You may stop using the service at any time.</p></Section>
          <Section title="Changes and contact"><p>We may update these terms as the service evolves. Continued use after an update means you accept the revised terms. Questions may be sent to <a className="underline" href="mailto:info@brivano.io">info@brivano.io</a>.</p></Section>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="border-t border-border pt-6"><h2 className="mb-2 text-lg font-semibold text-foreground">{title}</h2>{children}</section>;
}