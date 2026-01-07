import Navbar from "@/components/landing/Navbar";
import Hero from "@/components/landing/Hero";
import Services from "@/components/landing/Services";
import Pricing from "@/components/landing/Pricing";
import Testimonials from "@/components/landing/Testimonials";
import About from "@/components/landing/About";
import Contact from "@/components/landing/Contact";
import Footer from "@/components/landing/Footer";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Hero />
      <Services />
      <Pricing />
      <Testimonials />
      <About />
      <Contact />
      <Footer />
    </div>
  );
};

export default Index;
