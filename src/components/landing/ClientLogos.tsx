const logos = [
  { name: "Austin Real Estate Group", industry: "Real Estate" },
  { name: "SecureLife Insurance", industry: "Insurance" },
  { name: "CloudScale SaaS", industry: "SaaS" },
  { name: "GrowthFirst Agency", industry: "Agency" },
  { name: "MedConnect Health", industry: "Healthcare" },
  { name: "LegalPro Partners", industry: "Legal" },
  { name: "BuildRight Construction", industry: "Construction" },
  { name: "TechFlow Solutions", industry: "Technology" },
];

const ClientLogos = () => {
  return (
    <section className="py-16 relative overflow-hidden border-y border-border/50">
      <div className="absolute inset-0 bg-gradient-to-r from-background via-secondary/10 to-background" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <p className="text-center text-muted-foreground text-sm font-medium mb-8 uppercase tracking-wider">
          Trusted by 500+ sales teams across industries
        </p>
        
        {/* Logo Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-6 items-center justify-items-center">
          {logos.map((logo) => (
            <div
              key={logo.name}
              className="group flex flex-col items-center gap-2 p-4 rounded-xl hover:bg-card/50 transition-all duration-300"
            >
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <span className="text-primary font-bold text-lg">
                  {logo.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                </span>
              </div>
              <span className="text-xs text-muted-foreground text-center whitespace-nowrap">
                {logo.industry}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default ClientLogos;
