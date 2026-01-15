import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import ClientLogos from "@/components/landing/ClientLogos";
import ProductDemo from "@/components/landing/ProductDemo";
import CRMShowcase from "@/components/landing/CRMShowcase";
import HowItWorks from "@/components/landing/HowItWorks";
import Services from "@/components/landing/Services";
import CaseStudies from "@/components/landing/CaseStudies";
import ComparisonTable from "@/components/landing/ComparisonTable";
import ROICalculator from "@/components/landing/ROICalculator";
import Pricing from "@/components/landing/Pricing";
import TrustBadges from "@/components/landing/TrustBadges";
import Testimonials from "@/components/landing/Testimonials";
import FAQ from "@/components/landing/FAQ";
import About from "@/components/landing/About";
import Contact from "@/components/landing/Contact";
import Footer from "@/components/landing/Footer";
import ChatWidget from "@/components/landing/ChatWidget";
import ExitIntentPopup from "@/components/landing/ExitIntentPopup";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <ClientLogos />
      <ProductDemo />
      <CRMShowcase />
      <HowItWorks />
      <Services />
      <CaseStudies />
      <ComparisonTable />
      <ROICalculator />
      <Pricing />
      <TrustBadges />
      <Testimonials />
      <FAQ />
      <About />
      <Contact />
      <Footer />
      <ChatWidget />
      <ExitIntentPopup />
    </div>
  );
};

export default Index;
