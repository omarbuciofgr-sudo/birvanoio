import dashboardMockup from "@/assets/dashboard-mockup.png";

const ProductDemo = () => {
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

        {/* Dashboard Screenshot - Full Width */}
        <div className="relative">
          {/* Glow effect behind image */}
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-3xl scale-95" />
          
          {/* Screenshot with subtle border */}
          <div className="relative rounded-2xl overflow-hidden shadow-2xl shadow-primary/10 border border-border/50">
            <img 
              src={dashboardMockup} 
              alt="Brivano CRM Dashboard showing lead management interface" 
              className="w-full h-auto"
            />
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
