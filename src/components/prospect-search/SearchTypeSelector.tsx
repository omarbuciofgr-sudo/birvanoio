import { Users, Building2, Briefcase, MapPin, ArrowLeft } from 'lucide-react';

export type SearchType = 'people' | 'companies' | 'jobs' | 'local';

interface SearchTypeSelectorProps {
  onSelect: (type: SearchType) => void;
}

const searchTypes = [
  {
    type: 'people' as SearchType,
    label: 'Find people',
    description: 'Search for decision-makers and contacts matching your criteria.',
    icon: Users,
  },
  {
    type: 'companies' as SearchType,
    label: 'Find companies',
    description: 'Search for target accounts by industry, size, and location.',
    icon: Building2,
  },
  {
    type: 'jobs' as SearchType,
    label: 'Find jobs',
    description: 'Discover job postings to identify hiring companies and decision-makers.',
    icon: Briefcase,
  },
  {
    type: 'local' as SearchType,
    label: 'Local businesses',
    description: 'Pull local businesses from a specific area using Google Maps.',
    icon: MapPin,
  },
];

export function SearchTypeSelector({ onSelect }: SearchTypeSelectorProps) {
  return (
    <div className="h-full flex items-center justify-center">
      <div className="max-w-lg w-full px-6">
        <div className="text-center mb-8">
          <h2 className="text-lg font-semibold tracking-tight">What are you looking for?</h2>
          <p className="text-xs text-muted-foreground mt-1">
            Choose a search type to get started with the right filters.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {searchTypes.map((item) => (
            <button
              key={item.type}
              onClick={() => onSelect(item.type)}
              className="flex flex-col items-start gap-3 p-5 rounded-xl border border-border/50 hover:border-primary/40 hover:bg-muted/20 transition-all group text-left"
            >
              <div className="h-10 w-10 rounded-lg bg-muted/60 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                <item.icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </div>
              <div>
                <p className="text-sm font-semibold group-hover:text-foreground transition-colors">{item.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function SearchTypeHeader({ type, onBack }: { type: SearchType; onBack: () => void }) {
  const config = searchTypes.find((s) => s.type === type)!;
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      <config.icon className="h-3.5 w-3.5" />
      <span className="text-xs font-semibold">{config.label}</span>
    </button>
  );
}
