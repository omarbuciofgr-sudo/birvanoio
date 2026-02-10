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
  ChevronUp,
  X,
  Package,
  Sparkles,
  Search,
} from 'lucide-react';
import {
  INDUSTRIES,
  COUNTRIES,
  US_STATES,
  COMPANY_SIZES,
  REVENUE_RANGES,
  COMPANY_TYPES,
  BUSINESS_TYPES,
  ProspectSearchFilters,
} from './constants';

interface SearchFiltersProps {
  filters: ProspectSearchFilters;
  onFiltersChange: (filters: ProspectSearchFilters) => void;
  onSearch: () => void;
  isSearching: boolean;
  resultCount: number;
}

/* ── Reusable filter sub-components ─────────────────────────── */

function FilterDropdown({
  label,
  placeholder,
  options,
  selected,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [search, setSearch] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const filtered = options.filter(
    (o) =>
      o.label.toLowerCase().includes(search.toLowerCase()) &&
      !selected.includes(o.value)
  );

  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      <div className="relative">
        <div
          className="min-h-[34px] w-full rounded-md border border-border/60 bg-background px-3 py-1.5 text-sm cursor-pointer flex flex-wrap gap-1 items-center hover:border-border transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          {selected.length === 0 && (
            <span className="text-muted-foreground text-xs">{placeholder}</span>
          )}
          {selected.map((val) => {
            const opt = options.find((o) => o.value === val);
            return (
              <Badge key={val} variant="secondary" className="text-[11px] py-0 px-1.5 gap-1 font-normal">
                {opt?.label || val}
                <X
                  className="h-3 w-3 cursor-pointer opacity-60 hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selected.filter((s) => s !== val));
                  }}
                />
              </Badge>
            );
          })}
          <ChevronUp className={`h-3.5 w-3.5 text-muted-foreground ml-auto transition-transform ${isOpen ? '' : 'rotate-180'}`} />
        </div>
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border/60 rounded-md shadow-xl">
            <div className="p-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-7 text-xs pl-7"
                  autoFocus
                />
              </div>
            </div>
            <ScrollArea className="max-h-[200px]">
              <div className="p-1">
                {filtered.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-2 text-center">No results</p>
                )}
                {filtered.slice(0, 50).map((opt) => (
                  <button
                    key={opt.value}
                    className="w-full text-left px-2.5 py-1.5 text-xs rounded-sm hover:bg-accent/50 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      onChange([...selected, opt.value]);
                      setSearch('');
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
                {filtered.length > 50 && (
                  <p className="text-[10px] text-muted-foreground px-2 py-1 text-center">
                    +{filtered.length - 50} more — type to narrow down
                  </p>
                )}
              </div>
            </ScrollArea>
            <div className="border-t border-border/40 p-1">
              <button
                className="w-full text-left px-2.5 py-1 text-xs text-muted-foreground hover:bg-accent/50 rounded-sm"
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SingleDropdown({
  label,
  placeholder,
  options,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      <div className="relative">
        <button
          className="w-full h-[34px] rounded-md border border-border/60 bg-background px-3 text-sm text-left flex items-center justify-between hover:border-border transition-colors"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={value ? 'text-xs' : 'text-muted-foreground text-xs'}>
            {value ? options.find((o) => o.value === value)?.label : placeholder}
          </span>
          <ChevronUp className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${isOpen ? '' : 'rotate-180'}`} />
        </button>
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border/60 rounded-md shadow-xl">
            <ScrollArea className="max-h-[200px]">
              <div className="p-1">
                <button
                  className="w-full text-left px-2.5 py-1.5 text-xs rounded-sm hover:bg-accent/50 text-muted-foreground"
                  onClick={() => { onChange(''); setIsOpen(false); }}
                >
                  Any
                </button>
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    className={`w-full text-left px-2.5 py-1.5 text-xs rounded-sm hover:bg-accent/50 ${
                      value === opt.value ? 'bg-accent/60 font-medium' : ''
                    }`}
                    onClick={() => { onChange(opt.value); setIsOpen(false); }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
}

function TagInput({
  label,
  placeholder,
  tags,
  onChange,
}: {
  label: string;
  placeholder: string;
  tags: string[];
  onChange: (tags: string[]) => void;
}) {
  const [input, setInput] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && input.trim()) {
      e.preventDefault();
      if (!tags.includes(input.trim())) {
        onChange([...tags, input.trim()]);
      }
      setInput('');
    }
  };

  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1">
          {tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-[11px] py-0 px-1.5 gap-1 font-normal">
              {tag}
              <X className="h-3 w-3 cursor-pointer opacity-60 hover:opacity-100" onClick={() => onChange(tags.filter((t) => t !== tag))} />
            </Badge>
          ))}
        </div>
      )}
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-[34px] text-xs"
      />
    </div>
  );
}

function MinMaxInput({
  label,
  min,
  max,
  onMinChange,
  onMaxChange,
}: {
  label: string;
  min: string;
  max: string;
  onMinChange: (v: string) => void;
  onMaxChange: (v: string) => void;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold text-foreground">{label}</Label>
      <div className="flex gap-2">
        <Input placeholder="Min" value={min} onChange={(e) => onMinChange(e.target.value)} className="h-[34px] text-xs" />
        <Input placeholder="Max" value={max} onChange={(e) => onMaxChange(e.target.value)} className="h-[34px] text-xs" />
      </div>
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */

const stateOptions = US_STATES.map((s) => ({ value: s, label: s }));

export function SearchFilters({
  filters,
  onFiltersChange,
  onSearch,
  isSearching,
  resultCount,
}: SearchFiltersProps) {
  const [companyOpen, setCompanyOpen] = useState(true);
  const [locationOpen, setLocationOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [aiFiltersOpen, setAiFiltersOpen] = useState(false);

  const update = (partial: Partial<ProspectSearchFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  return (
    <div className="h-[calc(100%-56px)] flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-5 pt-5 pb-4">
        <h2 className="text-base font-semibold tracking-tight">Company Search</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Search for target accounts to research.</p>
      </div>

      {/* Scrollable Filters */}
      <ScrollArea className="flex-1 px-5">
        <div className="space-y-1 pb-4">
          {/* Company Attributes */}
          <Collapsible open={companyOpen} onOpenChange={setCompanyOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2.5 text-sm font-semibold border-b border-border/40">
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Company attributes
              </span>
              <ChevronUp className={`h-4 w-4 text-muted-foreground transition-transform ${companyOpen ? '' : 'rotate-180'}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3 pb-4">
              <FilterDropdown
                label="Industries to include"
                placeholder="e.g. Software development"
                options={INDUSTRIES}
                selected={filters.industries}
                onChange={(v) => update({ industries: v })}
              />
              <FilterDropdown
                label="Industries to exclude"
                placeholder="e.g. Advertising services"
                options={INDUSTRIES}
                selected={filters.industriesToExclude}
                onChange={(v) => update({ industriesToExclude: v })}
              />
              <FilterDropdown
                label="Company sizes"
                placeholder="e.g. 11-50 employees"
                options={COMPANY_SIZES}
                selected={filters.companySizes}
                onChange={(v) => update({ companySizes: v })}
              />
              <SingleDropdown
                label="Annual revenue"
                placeholder="e.g. $1M - $5M"
                options={REVENUE_RANGES}
                value={filters.annualRevenue}
                onChange={(v) => update({ annualRevenue: v })}
              />
              <FilterDropdown
                label="Company types"
                placeholder="e.g. Privately held"
                options={COMPANY_TYPES}
                selected={filters.companyTypes}
                onChange={(v) => update({ companyTypes: v })}
              />
              <MinMaxInput
                label="Associated member count"
                min=""
                max=""
                onMinChange={() => {}}
                onMaxChange={() => {}}
              />
              <TagInput
                label="Description keywords to include"
                placeholder="e.g. sales, data, outbound"
                tags={filters.keywordsInclude}
                onChange={(v) => update({ keywordsInclude: v })}
              />
              <TagInput
                label="Description keywords to exclude"
                placeholder="e.g. agency, marketing"
                tags={filters.keywordsExclude}
                onChange={(v) => update({ keywordsExclude: v })}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Location */}
          <Collapsible open={locationOpen} onOpenChange={setLocationOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2.5 text-sm font-semibold border-b border-border/40">
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Location
              </span>
              <ChevronUp className={`h-4 w-4 text-muted-foreground transition-transform ${locationOpen ? '' : 'rotate-180'}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3 pb-4">
              <FilterDropdown
                label="Countries to include"
                placeholder="e.g. United States, Canada"
                options={COUNTRIES}
                selected={filters.countries}
                onChange={(v) => update({ countries: v })}
              />
              <FilterDropdown
                label="Countries to exclude"
                placeholder="e.g. France, Spain"
                options={COUNTRIES}
                selected={filters.countriesToExclude}
                onChange={(v) => update({ countriesToExclude: v })}
              />
              <FilterDropdown
                label="Cities or states to include"
                placeholder="e.g. New York"
                options={stateOptions}
                selected={filters.citiesOrStates}
                onChange={(v) => update({ citiesOrStates: v })}
              />
              <FilterDropdown
                label="Cities or states to exclude"
                placeholder="e.g. San Francisco"
                options={stateOptions}
                selected={filters.citiesOrStatesToExclude}
                onChange={(v) => update({ citiesOrStatesToExclude: v })}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Products & Services */}
          <Collapsible open={productsOpen} onOpenChange={setProductsOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2.5 text-sm font-semibold border-b border-border/40">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Products & services
              </span>
              <ChevronUp className={`h-4 w-4 text-muted-foreground transition-transform ${productsOpen ? '' : 'rotate-180'}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-3 pb-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-foreground">Describe products and services</Label>
                <textarea
                  className="w-full rounded-md border border-border/60 bg-background px-3 py-2 text-xs min-h-[60px] resize-y focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 hover:border-border transition-colors"
                  placeholder="e.g. Sales prospecting tools, lead enrichment platforms"
                  value={filters.productsDescription}
                  onChange={(e) => update({ productsDescription: e.target.value })}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* AI Filters */}
          <Collapsible open={aiFiltersOpen} onOpenChange={setAiFiltersOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2.5 text-sm font-semibold border-b border-border/40">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                AI filters
              </span>
              <ChevronUp className={`h-4 w-4 text-muted-foreground transition-transform ${aiFiltersOpen ? '' : 'rotate-180'}`} />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-4 pt-3 pb-4">
              <FilterDropdown
                label="Business types"
                placeholder="e.g. B2B"
                options={BUSINESS_TYPES}
                selected={filters.businessTypes}
                onChange={(v) => update({ businessTypes: v })}
              />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
