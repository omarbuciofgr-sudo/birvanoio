import productDemoVideo from "@/assets/product-demo.mp4";

const ProductDemo = () => {
  return (
    <section className="py-24 bg-muted/30">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <p className="text-xs font-medium text-primary uppercase tracking-widest mb-3">Demo</p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-4">
            See it in action
          </h2>
          <p className="text-muted-foreground max-w-lg mx-auto">
            A CRM built for closing deals — not managing spreadsheets.
          </p>
        </div>

        <div className="relative">
          <div className="rounded-2xl overflow-hidden border border-border shadow-sm">
            <video 
              src={productDemoVideo}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-auto"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 mt-12">
          <div className="text-center">
            <p className="text-sm font-medium text-foreground mb-1">All Your Leads</p>
            <p className="text-xs text-muted-foreground">Organized, searchable, ready to work</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground mb-1">One-Click Contact</p>
            <p className="text-xs text-muted-foreground">Call, text, or email without leaving</p>
          </div>
          <div className="text-center">
            <p className="text-sm font-medium text-foreground mb-1">Track Everything</p>
            <p className="text-xs text-muted-foreground">Notes, statuses, full history</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ProductDemo;
