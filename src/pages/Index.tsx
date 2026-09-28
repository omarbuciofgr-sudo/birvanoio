import * as React from "react";
import { Helmet } from "react-helmet-async";
import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";

import HowItWorks from "@/components/landing/HowItWorks";
import Services from "@/components/landing/Services";
import ProductDemo from "@/components/landing/ProductDemo";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";
import ChatWidget from "@/components/landing/ChatWidget";
import ExitIntentPopup from "@/components/landing/ExitIntentPopup";

const Index = React.forwardRef<HTMLDivElement>(function Index(_props, ref) {
  return (
    <div ref={ref} className="min-h-screen bg-background">
      <Helmet>
        <title>Brivano | Find FSBO &amp; FRBO Owners</title>
        <meta name="description" content="Search US cities for FSBO and FRBO listings, find owner contact information, and manage real estate outreach from one place." />
        <link rel="canonical" href="https://www.brivano.io/" />
        <meta property="og:title" content="Brivano | Find FSBO &amp; FRBO Owners" />
        <meta property="og:description" content="Find homeowners selling or renting on their own, get contact information, and manage outreach." />
        <meta property="og:url" content="https://www.brivano.io/" />
      </Helmet>
      <Navbar />
      <Hero />
      
      {/* Core value prop: what you get & how it works */}
      <HowItWorks />
      <Services />
      <ProductDemo />
      <CTASection />
      <Footer />
      <ChatWidget />
      <ExitIntentPopup />
    </div>
  );
});

Index.displayName = "Index";

export default Index;
