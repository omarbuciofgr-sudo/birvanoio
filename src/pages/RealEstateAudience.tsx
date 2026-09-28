import { Link, Navigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, Building2, Home, KeyRound } from "lucide-react";
import { BrivanoLogo } from "@/components/BrivanoLogo";
import { Button } from "@/components/ui/button";

const audiences = {
  agents: {
    name: "Real Estate Agents",
    icon: Home,
    headline: "Find more owner-listed opportunities in your market.",
    copy: "Search a city for FSBO and FRBO listings, prioritize strong matches, find owner contact information, and manage every follow-up in Brivano.",
  },
  "property-managers": {
    name: "Property Managers",
    icon: KeyRound,
    headline: "Connect with independent rental owners who may need help.",
    copy: "Find owner-listed rentals by city, get available contact information, and organize outreach and follow-ups from one workspace.",
  },
  investors: {
    name: "Investors",
    icon: Building2,
    headline: "Discover owner-listed properties before they disappear.",
    copy: "Search local FSBO and FRBO inventory, rank promising matches, uncover available owner contact information, and track each opportunity.",
  },
} as const;

export default function RealEstateAudience() {
  const { audience } = useParams();
  const content = audience && audience in audiences ? audiences[audience as keyof typeof audiences] : null;
  if (!content) return <Navigate to="/" replace />;
  const Icon = content.icon;

  return (
    <main className="min-h-screen bg-background">
      <Helmet>
        <title>{content.name} | Brivano</title>
        <meta name="description" content={content.copy} />
        <link rel="canonical" href={`https://www.brivano.io/who-we-help/${audience}`} />
      </Helmet>
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link to="/"><BrivanoLogo className="h-28" /></Link>
          <Button asChild size="sm"><Link to="/auth">Start Free</Link></Button>
        </div>
      </header>
      <section className="mx-auto max-w-4xl px-4 py-24 text-center sm:px-6 lg:px-8">
        <Icon className="mx-auto mb-6 h-10 w-10 text-primary" />
        <p className="mb-3 text-xs font-medium uppercase text-primary">{content.name}</p>
        <h1 className="font-display text-4xl font-bold text-foreground sm:text-5xl">{content.headline}</h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">{content.copy}</p>
        <Button asChild size="lg" className="mt-10 gap-2">
          <Link to="/auth">Start Free <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </section>
    </main>
  );
}