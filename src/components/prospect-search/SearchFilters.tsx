import { useState, useRef, KeyboardEvent } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
  Search,
  SlidersHorizontal,
  Sparkles,
  Package,
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

function MultiSelectDropdown({
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
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <div
          className="min-h-[36px] w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm cursor-pointer flex flex-wrap gap-1 items-center"
          onClick={() => setIsOpen(!isOpen)}
        >
          {selected.length === 0 && (
            <span className="text-muted-foreground text-xs">{placeholder}</span>
          )}
          {selected.map((val) => {
            const opt = options.find((o) => o.value === val);
            return (
              <Badge
                key={val}
                variant="secondary"
                className="text-xs py-0 px-1.5 gap-1"
              >
                {opt?.label || val}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange(selected.filter((s) => s !== val));
                  }}
                />
              </Badge>
            );
          })}
        </div>
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg">
            <div className="p-2">
              <Input
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-7 text-xs"
                autoFocus
              />
            </div>
            <ScrollArea className="max-h-[200px]">
              <div className="p-1">
                {filtered.length === 0 && (
                  <p className="text-xs text-muted-foreground px-2 py-1">No results</p>
                )}
                {filtered.slice(0, 50).map((opt) => (
                  <button
                    key={opt.value}
                    className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent transition-colors"
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
                  <p className="text-xs text-muted-foreground px-2 py-1">
                    +{filtered.length - 50} more. Type to narrow down.
                  </p>
                )}
              </div>
            </ScrollArea>
            <div className="border-t p-1">
              <button
                className="w-full text-left px-2 py-1 text-xs text-muted-foreground hover:bg-accent rounded"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsOpen(false);
                }}
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
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex flex-wrap gap-1 mb-1">
        {tags.map((tag) => (
          <Badge key={tag} variant="secondary" className="text-xs py-0 px-1.5 gap-1">
            {tag}
            <X
              className="h-3 w-3 cursor-pointer"
              onClick={() => onChange(tags.filter((t) => t !== tag))}
            />
          </Badge>
        ))}
      </div>
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        className="h-8 text-xs"
      />
    </div>
  );
}

function SingleSelectDropdown({
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
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="relative">
        <button
          className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm text-left flex items-center justify-between"
          onClick={() => setIsOpen(!isOpen)}
        >
          <span className={value ? '' : 'text-muted-foreground text-xs'}>
            {value ? options.find((o) => o.value === value)?.label : placeholder}
          </span>
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        </button>
        {isOpen && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg">
            <ScrollArea className="max-h-[200px]">
              <div className="p-1">
                <button
                  className="w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent text-muted-foreground"
                  onClick={() => {
                    onChange('');
                    setIsOpen(false);
                  }}
                >
                  Any
                </button>
                {options.map((opt) => (
                  <button
                    key={opt.value}
                    className={`w-full text-left px-2 py-1.5 text-xs rounded hover:bg-accent ${
                      value === opt.value ? 'bg-accent font-medium' : ''
                    }`}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
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

// Convert US states to options format for multi-select
const stateOptions = US_STATES.map((s) => ({ value: s, label: s }));

export function SearchFilters({
  filters,
  onFiltersChange,
  onSearch,
  isSearching,
  resultCount,
}: SearchFiltersProps) {
  const [companyOpen, setCompanyOpen] = useState(true);
  const [locationOpen, setLocationOpen] = useState(true);
  const [productsOpen, setProductsOpen] = useState(false);
  const [aiFiltersOpen, setAiFiltersOpen] = useState(false);
  const [limitOpen, setLimitOpen] = useState(true);

  const update = (partial: Partial<ProspectSearchFilters>) => {
    onFiltersChange({ ...filters, ...partial });
  };

  const activeFilterCount = [
    filters.industries.length > 0,
    filters.industriesToExclude.length > 0,
    filters.companySizes.length > 0,
    filters.annualRevenue,
    filters.companyTypes.length > 0,
    filters.keywordsInclude.length > 0,
    filters.countries.length > 0,
    filters.citiesOrStates.length > 0,
    filters.productsDescription,
    filters.businessTypes.length > 0,
  ].filter(Boolean).length;

  return (
    <div className="h-full flex flex-col border-r border-border">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b border-border">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-display text-sm font-semibold flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Refine with filters
          </h3>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeFilterCount} filters
            </Badge>
          )}
        </div>
        <Button
          onClick={onSearch}
          disabled={isSearching || filters.industries.length === 0}
          className="w-full"
          size="sm"
        >
          {isSearching ? (
            <span className="flex items-center gap-2">
              <span className="h-3 w-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Searching...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              <Search className="h-3.5 w-3.5" />
              Find Companies
            </span>
          )}
        </Button>
      </div>

      {/* Scrollable Filters */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-1">
          {/* Company Attributes */}
          <Collapsible open={companyOpen} onOpenChange={setCompanyOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                Company attributes
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  companyOpen ? 'rotate-180' : ''
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2 pb-4">
              <MultiSelectDropdown
                label="Industries to include"
                placeholder="e.g. Software development"
                options={INDUSTRIES}
                selected={filters.industries}
                onChange={(v) => update({ industries: v })}
              />
              <MultiSelectDropdown
                label="Industries to exclude"
                placeholder="e.g. Advertising services"
                options={INDUSTRIES}
                selected={filters.industriesToExclude}
                onChange={(v) => update({ industriesToExclude: v })}
              />
              <MultiSelectDropdown
                label="Company sizes"
                placeholder="e.g. 11-50 employees"
                options={COMPANY_SIZES}
                selected={filters.companySizes}
                onChange={(v) => update({ companySizes: v })}
              />
              <SingleSelectDropdown
                label="Annual revenue"
                placeholder="e.g. $1M - $5M"
                options={REVENUE_RANGES}
                value={filters.annualRevenue}
                onChange={(v) => update({ annualRevenue: v })}
              />
              <MultiSelectDropdown
                label="Company types"
                placeholder="e.g. Privately held"
                options={COMPANY_TYPES}
                selected={filters.companyTypes}
                onChange={(v) => update({ companyTypes: v })}
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
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                Location
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  locationOpen ? 'rotate-180' : ''
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2 pb-4">
              <MultiSelectDropdown
                label="Countries to include"
                placeholder="e.g. United States, Canada"
                options={COUNTRIES}
                selected={filters.countries}
                onChange={(v) => update({ countries: v })}
              />
              <MultiSelectDropdown
                label="Countries to exclude"
                placeholder="e.g. France, Spain"
                options={COUNTRIES}
                selected={filters.countriesToExclude}
                onChange={(v) => update({ countriesToExclude: v })}
              />
              <MultiSelectDropdown
                label="Cities or states to include"
                placeholder="e.g. New York"
                options={stateOptions}
                selected={filters.citiesOrStates}
                onChange={(v) => update({ citiesOrStates: v })}
              />
              <MultiSelectDropdown
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
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                Products & services
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  productsOpen ? 'rotate-180' : ''
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2 pb-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">
                  Describe products and services
                </Label>
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs min-h-[60px] resize-y"
                  placeholder="e.g. Sales prospecting tools, lead enrichment platforms, B2B data providers"
                  value={filters.productsDescription}
                  onChange={(e) => update({ productsDescription: e.target.value })}
                />
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* AI Filters */}
          <Collapsible open={aiFiltersOpen} onOpenChange={setAiFiltersOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-muted-foreground" />
                AI filters
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  aiFiltersOpen ? 'rotate-180' : ''
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2 pb-4">
              <MultiSelectDropdown
                label="Business types"
                placeholder="e.g. B2B"
                options={BUSINESS_TYPES}
                selected={filters.businessTypes}
                onChange={(v) => update({ businessTypes: v })}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* Limit Results */}
          <Collapsible open={limitOpen} onOpenChange={setLimitOpen}>
            <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-semibold">
              <span className="flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                Limit results
              </span>
              <ChevronDown
                className={`h-4 w-4 text-muted-foreground transition-transform ${
                  limitOpen ? 'rotate-180' : ''
                }`}
              />
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-3 pt-2 pb-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Limit</Label>
                <p className="text-[10px] text-muted-foreground">
                  1,000 record max per search.
                </p>
                <Input
                  type="number"
                  min={1}
                  max={1000}
                  value={filters.limit}
                  onChange={(e) => update({ limit: parseInt(e.target.value) || 50 })}
                  className="h-8 text-xs"
                  placeholder="e.g. 10"
                />
              </div>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </ScrollArea>
    </div>
  );
}
