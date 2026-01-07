const stats = [
  {
    value: "50,000+",
    label: "Leads Delivered",
  },
  {
    value: "500+",
    label: "Happy Teams",
  },
  {
    value: "25+",
    label: "Industries Served",
  },
  {
    value: "98%",
    label: "Accuracy Rate",
  },
];

const Stats = () => {
  return (
    <section className="py-16 relative border-y border-border/50">
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-primary/5" />
      
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-display text-4xl sm:text-5xl font-bold gradient-text mb-2">
                {stat.value}
              </div>
              <div className="text-muted-foreground text-sm sm:text-base">
                {stat.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Stats;
