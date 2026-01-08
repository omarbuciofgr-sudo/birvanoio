import { useState, useEffect } from "react";
import Autoplay from "embla-carousel-autoplay";
import dashboardLeads from "@/assets/dashboard-mockup.png";
import dashboardOverview from "@/assets/dashboard-overview.png";
import dashboardAnalytics from "@/assets/dashboard-analytics.png";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
  type CarouselApi,
} from "@/components/ui/carousel";

const screenshots = [
  { src: dashboardOverview, alt: "Brivano CRM Dashboard Overview", label: "Dashboard Overview" },
  { src: dashboardLeads, alt: "Brivano CRM Leads Management", label: "Lead Management" },
  { src: dashboardAnalytics, alt: "Brivano CRM Analytics Dashboard", label: "Analytics & Insights" },
];

const ProductDemo = () => {
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!api) return;

    setCurrent(api.selectedScrollSnap());
    api.on("select", () => {
      setCurrent(api.selectedScrollSnap());
    });
  }, [api]);

  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-secondary/20 via-background to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-12">
          <h2 className="font-display text-4xl sm:text-5xl font-bold text-foreground mb-4">
            See It In <span className="gradient-text">Action</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            A powerful CRM built for closing deals — not managing spreadsheets.
          </p>
        </div>

        {/* Dashboard Screenshots Carousel */}
        <div className="relative px-12">
          {/* Glow effect behind image */}
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-3xl scale-95" />
          
          <Carousel 
            setApi={setApi} 
            className="relative"
            plugins={[
              Autoplay({
                delay: 4000,
                stopOnInteraction: true,
              }),
            ]}
            opts={{
              loop: true,
            }}
          >
            <CarouselContent>
              {screenshots.map((screenshot, index) => (
                <CarouselItem key={index}>
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 border border-border/50">
                    <img 
                      src={screenshot.src} 
                      alt={screenshot.alt} 
                      className="w-full h-auto"
                    />
                  </div>
                </CarouselItem>
              ))}
            </CarouselContent>
            <CarouselPrevious className="left-0" />
            <CarouselNext className="right-0" />
          </Carousel>

          {/* Dots indicator */}
          <div className="flex justify-center gap-2 mt-6">
            {screenshots.map((screenshot, index) => (
              <button
                key={index}
                onClick={() => api?.scrollTo(index)}
                className={`px-3 py-1.5 rounded-full text-sm transition-all ${
                  current === index
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {screenshot.label}
              </button>
            ))}
          </div>
        </div>

        {/* Feature callouts */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mt-12">
          <div className="text-center">
            <div className="font-semibold text-foreground mb-1">All Your Leads</div>
            <p className="text-sm text-muted-foreground">Organized, searchable, and ready to work</p>
          </div>
          <div className="text-center">
            <div className="font-semibold text-foreground mb-1">One-Click Contact</div>
            <p className="text-sm text-muted-foreground">Call, text, or email without leaving the app</p>
          </div>
          <div className="text-center">
            <div className="font-semibold text-foreground mb-1">Track Everything</div>
            <p className="text-sm text-muted-foreground">Notes, statuses, and full conversation history</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductDemo;
