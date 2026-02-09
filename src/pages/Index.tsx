import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";

import HowItWorks from "@/components/landing/HowItWorks";
import Services from "@/components/landing/Services";
import CRMShowcase from "@/components/landing/CRMShowcase";
import ProductDemo from "@/components/landing/ProductDemo";
import UseCases from "@/components/landing/UseCases";

import ComparisonTable from "@/components/landing/ComparisonTable";
import Pricing from "@/components/landing/Pricing";
import FAQ from "@/components/landing/FAQ";
import ROICalculator from "@/components/landing/ROICalculator";
import About from "@/components/landing/About";
import CTASection from "@/components/landing/CTASection";
import Footer from "@/components/landing/Footer";
import ChatWidget from "@/components/landing/ChatWidget";
import ExitIntentPopup from "@/components/landing/ExitIntentPopup";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      
      {/* Core value prop: what you get & how it works */}
      <HowItWorks />
      <Services />
      <CRMShowcase />
      <ProductDemo />
      <UseCases />
      
      {/* Decision-making: compare, price, FAQ */}
      <ComparisonTable />
      <Pricing />
      <FAQ />
      
      {/* Supporting: ROI, about, final CTA */}
      <ROICalculator />
      <About />
      <CTASection />
      <Footer />
      <ChatWidget />
      <ExitIntentPopup />
    </div>
  );
};

export default Index;
