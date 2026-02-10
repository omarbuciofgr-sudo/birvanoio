import { useState, useRef, KeyboardEvent } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Building2,
  Globe,
  ChevronDown,
  X,
  Package,
  Sparkles,
  Search,
  Ban,
  Copy,
  SearchCheck,
  Layers,
} from 'lucide-react';
import {
  INDUSTRIES,
  COUNTRIES,
  US_STATES,
  MAJOR_CITIES,
  COMPANY_SIZES,
  REVENUE_RANGES,
  FUNDING_RANGES,
  COMPANY_TYPES,
  ProspectSearchFilters,
} from './constants';

interface SearchFiltersProps {
  filters: ProspectSearchFilters;
  onFiltersChange: (filters: ProspectSearchFilters) => void;
  onSearch: () => void;
  isSearching: boolean;
  resultCount: number;
}

/* ── Reusable sub-components ─────────────────────────────────── */

function FilterDropdown({
  label, placeholder, options, selected, onChange,
}: {
  label: string; placeholder: string;
  options: { value: string; label: string }[];
  selected: string[]; onChange: (values: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const filtered = options.filter(
    (o) => o.label.toLowerCase().includes(search.toLowerCase()) && !selected.includes(o.value)
  );

  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      <div className="relative">
        <div className="min-h-[34px] w-full rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm cursor-pointer flex flex-wrap gap-1 items-center hover:border-border transition-colors" onClick={() => setIsOpen(!isOpen)}>
          {selected.length === 0 && <span className="text-muted-foreground text-xs">{placeholder}</span>}
          {selected.map((val) => {
            const opt = options.find((o) => o.value === val);
            return (
              <Badge key={val} variant="secondary" className="text-[11px] py-0 px-1.5 gap-1 font-normal">
                {opt?.label || val}
                <X className="h-3 w-3 cursor-pointer opacity-60 hover:opacity-100" onClick={(e) => { e.stopPropagation(); onChange(selected.filter((s) => s !== val)); }} />
              </Badge>
            );
          })}
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground ml-auto transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </div>
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border/60 rounded-md shadow-xl">
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input placeholder="Search..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-7 text-xs pl-7" autoFocus />
              </div>
            </div>
            <ScrollArea className="max-h-[200px]">
              <div className="p-1">
                {filtered.length === 0 && <p className="text-xs text-muted-foreground px-2 py-2 text-center">No results</p>}
                {filtered.slice(0, 50).map((opt) => (
                  <button key={opt.value} className="w-full text-left px-2.5 py-1.5 text-xs rounded-sm hover:bg-accent/50 transition-colors" onClick={(e) => { e.stopPropagation(); onChange([...selected, opt.value]); setSearch(''); }}>{opt.label}</button>
                ))}
                {filtered.length > 50 && (
                  <p className="text-[10px] text-muted-foreground px-2 py-1 text-center">+{filtered.length - 50} more — type to narrow down</p>
                )}
              </div>
            </ScrollArea>
            <div className="border-t border-border/40 p-1">
              <button className="w-full text-left px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent/50 rounded-sm" onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}>Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SingleDropdown({ label, placeholder, options, value, onChange }: {
  label: string; placeholder: string; options: { value: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      <div className="relative">
        <button className="w-full h-[34px] rounded-md border border-border/60 bg-background px-3 text-sm text-left flex items-center justify-between hover:border-border transition-colors" onClick={() => setIsOpen(!isOpen)}>
          <span className={value ? 'text-xs' : 'text-muted-foreground text-xs'}>{value ? options.find((o) => o.value === value)?.label : placeholder}</span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border/60 rounded-md shadow-xl">
            <ScrollArea className="max-h-[200px]">
              <div className="p-1">
                <button className="w-full text-left px-2.5 py-1.5 text-xs rounded-sm hover:bg-accent/50 text-muted-foreground" onClick={() => { onChange(''); setIsOpen(false); }}>Any</button>
                {options.map((opt) => (
                  <button key={opt.value} className={`w-full text-left px-2.5 py-1.5 text-xs rounded-sm hover:bg-accent/50 ${value === opt.value ? 'bg-accent/60 font-medium' : ''}`} onClick={() => { onChange(opt.value); setIsOpen(false); }}>{opt.label}</button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}

function TagInput({ label, placeholder, tags, onChange }: { label: string; placeholder: string; tags: string[]; onChange: (tags: string[]) => void; }) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) { e.preventDefault(); if (!tags.includes(input.trim())) onChange([...tags, input.trim()]); setInput(''); }
  };
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[11px] py-0 px-1.5 gap-1 font-normal">
              {tag}<X className="h-3 w-3 cursor-pointer opacity-60 hover:opacity-100" onClick={() => onChange(tags.filter((t) => t !== tag))} />
            </Badge>
          ))}
        </div>
      )}
      <Input ref={inputRef} placeholder={placeholder} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} className="h-[34px] text-xs" />
    </div>
  );
}

/* ── Section wrapper ─────────────────────────────────────────── */

function FilterSection({
  icon: Icon, label, badge, open, onOpenChange, children,
}: {
  icon: React.ElementType; label: string; badge?: React.ReactNode;
  open: boolean; onOpenChange: (v: boolean) => void; children: React.ReactNode;
}) {
  return (
    <Collapsible open={open} onOpenChange={onOpenChange}>
      <CollapsibleTrigger className="flex items-center justify-between w-full py-3 px-1 text-sm font-semibold border-b border-border/40 hover:bg-muted/30 rounded-sm transition-colors">
        <span className="flex items-center gap-2.5">
          <Icon className="h-4 w-4 text-muted-foreground" />
          {label}
        </span>
        <span className="flex items-center gap-2">
          {badge}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
        </span>
      </CollapsibleTrigger>
      <CollapsibleContent className="space-y-4 pt-3 pb-4 px-1">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Main Component ─────────────────────────────────────────── */

const stateOptions = US_STATES.map((s) => ({ value: s, label: s }));

const LIMIT_OPTIONS = [
  { value: '10', label: '10' },
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: '250', label: '250' },
];

export function SearchFilters({
  filters,
  onFiltersChange,
}: SearchFiltersProps) {
  const [sections, setSections] = useState<Record<string, boolean>>({
    companyAttributes: false,
    location: false,
    exclude: false,
    lookalike: false,
    products: false,
    aiFilters: false,
    limit: true,
  });

  const toggle = (key: string) => setSections((s) => ({ ...s, [key]: !s[key] }));
  const update = (partial: Partial<ProspectSearchFilters>) => onFiltersChange({ ...filters, ...partial });

  return (
    <div className="h-[calc(100%-56px)] flex flex-col">
      <div className="flex-shrink-0 px-5 pt-5 pb-4">
        <h2 className="text-base font-semibold tracking-tight">Company Search</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Search for target accounts to research.</p>
      </div>

      <ScrollArea className="flex-1 px-5">
        <div className="space-y-0 pb-4">

          {/* Company attributes */}
          <FilterSection icon={Building2} label="Company attributes" open={sections.companyAttributes} onOpenChange={() => toggle('companyAttributes')}>
            <FilterDropdown label="Industries" placeholder="e.g. Software Development" options={INDUSTRIES} selected={filters.industries} onChange={(v) => update({ industries: v })} />
            <FilterDropdown label="Company sizes" placeholder="e.g. 11-50 employees" options={COMPANY_SIZES} selected={filters.companySizes} onChange={(v) => update({ companySizes: v })} />
            <FilterDropdown label="Company types" placeholder="e.g. Privately held" options={COMPANY_TYPES} selected={filters.companyTypes} onChange={(v) => update({ companyTypes: v })} />
            <TagInput label="Industry & Keywords" placeholder="e.g. property management, tenant services" tags={filters.keywordsInclude} onChange={(v) => update({ keywordsInclude: v })} />
            <SingleDropdown label="Annual revenue" placeholder="e.g. $1M - $5M" options={REVENUE_RANGES} value={filters.annualRevenue} onChange={(v) => update({ annualRevenue: v })} />
            <SingleDropdown label="Funding raised" placeholder="e.g. $5M - $10M" options={FUNDING_RANGES} value={filters.fundingRaised} onChange={(v) => update({ fundingRaised: v })} />
          </FilterSection>

          {/* Location */}
          <FilterSection icon={Globe} label="Location" open={sections.location} onOpenChange={() => toggle('location')}>
            <FilterDropdown label="Countries" placeholder="e.g. United States" options={COUNTRIES} selected={filters.countries} onChange={(v) => update({ countries: v })} />
            <FilterDropdown label="States" placeholder="e.g. California" options={stateOptions} selected={filters.states} onChange={(v) => update({ states: v })} />
            <FilterDropdown label="Cities" placeholder="e.g. San Francisco" options={MAJOR_CITIES} selected={filters.cities} onChange={(v) => update({ cities: v })} />
          </FilterSection>

          {/* Exclude companies */}
          <FilterSection
            icon={Ban}
            label="Exclude companies"
            badge={<Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-accent text-accent-foreground border-border gap-1"><Sparkles className="h-3 w-3" />Upgrade</Badge>}
            open={sections.exclude}
            onOpenChange={() => toggle('exclude')}
          >
            <FilterDropdown label="Exclude industries" placeholder="e.g. Advertising services" options={INDUSTRIES} selected={filters.industriesToExclude} onChange={(v) => update({ industriesToExclude: v })} />
            <FilterDropdown label="Exclude countries" placeholder="e.g. France, Spain" options={COUNTRIES} selected={filters.countriesToExclude} onChange={(v) => update({ countriesToExclude: v })} />
            <FilterDropdown label="Exclude states" placeholder="e.g. Alaska" options={stateOptions} selected={filters.statesToExclude} onChange={(v) => update({ statesToExclude: v })} />
            <FilterDropdown label="Exclude cities" placeholder="e.g. New York" options={MAJOR_CITIES} selected={filters.citiesToExclude} onChange={(v) => update({ citiesToExclude: v })} />
            <TagInput label="Exclude keywords" placeholder="e.g. agency, marketing" tags={filters.keywordsExclude} onChange={(v) => update({ keywordsExclude: v })} />
          </FilterSection>

          {/* Lookalike companies */}
          <FilterSection icon={Copy} label="Lookalike companies" open={sections.lookalike} onOpenChange={() => toggle('lookalike')}>
            <TagInput label="Similar to these companies" placeholder="e.g. Salesforce, HubSpot" tags={filters.keywordsInclude.length > 0 ? [] : []} onChange={() => {}} />
            <p className="text-[11px] text-muted-foreground">Enter company names or domains to find similar companies.</p>
          </FilterSection>

          {/* Products & services */}
          <FilterSection icon={Package} label="Products & services" open={sections.products} onOpenChange={() => toggle('products')}>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">Describe products and services</Label>
              <textarea
                className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-xs min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:border-border transition-colors"
                placeholder="e.g. Sales prospecting tools, lead enrichment platforms"
                value={filters.productsDescription}
                onChange={(e) => update({ productsDescription: e.target.value })}
              />
            </div>
          </FilterSection>

          {/* AI filters */}
          <FilterSection icon={SearchCheck} label="AI filters" open={sections.aiFilters} onOpenChange={() => toggle('aiFilters')}>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-foreground">AI search query</Label>
              <textarea
                className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-xs min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:border-border transition-colors"
                placeholder="Describe your ideal company in natural language, e.g. 'B2B SaaS companies with 50-200 employees that recently raised Series A'"
                value={filters.productsDescription}
                onChange={(e) => update({ productsDescription: e.target.value })}
              />
            </div>
          </FilterSection>

          {/* Limit results */}
          <FilterSection icon={Layers} label="Limit results" open={sections.limit} onOpenChange={() => toggle('limit')}>
            <div className="space-y-1">
              <Label className="text-xs font-semibold">Limit</Label>
              <p className="text-[11px] text-muted-foreground">1,000 record max per search. To import more than 1,000 records, <span className="underline cursor-pointer">upgrade your plan</span>.</p>
              <Input
                type="number"
                placeholder="e.g. 10"
                value={filters.limit || ''}
                onChange={(e) => update({ limit: Number(e.target.value) || 50 })}
                className="h-[34px] text-xs"
              />
            </div>
          </FilterSection>

        </div>
      </ScrollArea>
    </div>
  );
}
