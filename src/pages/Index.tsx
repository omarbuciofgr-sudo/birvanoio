import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import ProductDemo from "@/components/landing/ProductDemo";
import CRMShowcase from "@/components/landing/CRMShowcase";
import HowItWorks from "@/components/landing/HowItWorks";
import Services from "@/components/landing/Services";
import Pricing from "@/components/landing/Pricing";
import Testimonials from "@/components/landing/Testimonials";
import FAQ from "@/components/landing/FAQ";
import About from "@/components/landing/About";
import Contact from "@/components/landing/Contact";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <ProductDemo />
      <CRMShowcase />
      <HowItWorks />
      <Services />
      <Pricing />
      <Testimonials />
      <FAQ />
      <About />
      <Contact />
      <Footer />
    </div>
  );
};

export default Index;
