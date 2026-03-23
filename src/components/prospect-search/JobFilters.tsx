import { useState, KeyboardEvent } from 'react';
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
  Briefcase,
  Search,
  Clock,
  FileText,
  Ban,
  Sparkles,
  CircleDot,
  GraduationCap,
  Eye,
  CalendarDays,
  Layers,
} from 'lucide-react';
import {
  INDUSTRIES,
  COUNTRIES,
  US_STATES,
  MAJOR_CITIES,
} from './constants';

export interface JobSearchFilters {
  jobTitles: string[];
  excludeJobTitles: string[];
  jobDescriptionKeywords: string[];
  industries: string[];
  companies: string[];
  countries: string[];
  states: string[];
  cities: string[];
  employmentType: string[];
  seniority: string[];
  recruiterKeywords: string[];
  postedWithin: string;
  limit: number;
}

export const defaultJobFilters: JobSearchFilters = {
  jobTitles: [],
  excludeJobTitles: [],
  jobDescriptionKeywords: [],
  industries: [],
  companies: [],
  countries: [],
  states: [],
  cities: [],
  employmentType: [],
  seniority: [],
  recruiterKeywords: [],
  postedWithin: '',
  limit: 50,
};

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: 'full_time', label: 'Full-time' },
  { value: 'part_time', label: 'Part-time' },
  { value: 'contract', label: 'Contract' },
  { value: 'temporary', label: 'Temporary' },
  { value: 'internship', label: 'Internship' },
  { value: 'freelance', label: 'Freelance' },
];

const SENIORITY_OPTIONS = [
  { value: 'intern', label: 'Internship' },
  { value: 'entry', label: 'Entry Level' },
  { value: 'associate', label: 'Associate' },
  { value: 'mid', label: 'Mid-Senior Level' },
  { value: 'director', label: 'Director' },
  { value: 'executive', label: 'Executive' },
];

const POSTED_WITHIN_OPTIONS = [
  { value: '24h', label: 'Past 24 hours' },
  { value: '7d', label: 'Past week' },
  { value: '30d', label: 'Past month' },
  { value: '90d', label: 'Past 3 months' },
];

const LIMIT_OPTIONS = [
  { value: '25', label: '25' },
  { value: '50', label: '50' },
  { value: '100', label: '100' },
  { value: '250', label: '250' },
];

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
      <Input placeholder={placeholder} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown} className="h-[34px] text-xs" />
    </div>
  );
}

/* ── Section wrapper matching screenshot style ───────────────── */

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

/* ── Main component ──────────────────────────────────────────── */

const stateOptions = US_STATES.map((s) => ({ value: s, label: s }));

interface JobFiltersProps {
  filters: JobSearchFilters;
  onFiltersChange: (filters: JobSearchFilters) => void;
  onSearch: () => void;
  isSearching: boolean;
  resultCount: number;
}

export function JobFilters({ filters, onFiltersChange }: JobFiltersProps) {
  const [sections, setSections] = useState<Record<string, boolean>>({
    exclude: false,
    title: false,
    description: false,
    location: false,
    employment: false,
    seniority: false,
    recruiter: false,
    posting: false,
    companies: false,
    limit: true,
  });

  const toggle = (key: string) => setSections((s) => ({ ...s, [key]: !s[key] }));
  const update = (partial: Partial<JobSearchFilters>) => onFiltersChange({ ...filters, ...partial });

  return (
    <div className="h-[calc(100%-56px)] flex flex-col">
      <div className="flex-shrink-0 px-5 pt-5 pb-4">
        <h2 className="text-base font-semibold tracking-tight">Add search criteria</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Search for jobs matching your criteria.</p>
      </div>

      <ScrollArea className="flex-1 px-5">
        <div className="space-y-0 pb-4">

          {/* Exclude jobs */}
          <FilterSection icon={Ban} label="Exclude jobs" badge={<Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-accent text-accent-foreground border-border gap-1"><Sparkles className="h-3 w-3" />Upgrade</Badge>} open={sections.exclude} onOpenChange={() => toggle('exclude')}>
            <TagInput label="Exclude job titles" placeholder="e.g. Intern, Junior" tags={filters.excludeJobTitles} onChange={(v) => update({ excludeJobTitles: v })} />
          </FilterSection>

          {/* Job title */}
          <FilterSection icon={Briefcase} label="Job title" open={sections.title} onOpenChange={() => toggle('title')}>
            <TagInput label="Job titles" placeholder="e.g. Account Executive, SDR" tags={filters.jobTitles} onChange={(v) => update({ jobTitles: v })} />
          </FilterSection>

          {/* Job description */}
          <FilterSection icon={FileText} label="Job description" open={sections.description} onOpenChange={() => toggle('description')}>
            <TagInput label="Keywords" placeholder="e.g. SaaS, enterprise, remote" tags={filters.jobDescriptionKeywords} onChange={(v) => update({ jobDescriptionKeywords: v })} />
          </FilterSection>

          {/* Location */}
          <FilterSection icon={Globe} label="Location" open={sections.location} onOpenChange={() => toggle('location')}>
            <FilterDropdown label="Countries" placeholder="e.g. United States" options={COUNTRIES} selected={filters.countries} onChange={(v) => update({ countries: v })} />
            <FilterDropdown label="States" placeholder="e.g. California" options={stateOptions} selected={filters.states} onChange={(v) => update({ states: v })} />
            <FilterDropdown label="Cities" placeholder="e.g. San Francisco" options={MAJOR_CITIES} selected={filters.cities} onChange={(v) => update({ cities: v })} />
          </FilterSection>

          {/* Employment type */}
          <FilterSection icon={CircleDot} label="Employment type" open={sections.employment} onOpenChange={() => toggle('employment')}>
            <FilterDropdown label="Type" placeholder="e.g. Full-time" options={EMPLOYMENT_TYPE_OPTIONS} selected={filters.employmentType} onChange={(v) => update({ employmentType: v })} />
          </FilterSection>

          {/* Seniority */}
          <FilterSection icon={GraduationCap} label="Seniority" open={sections.seniority} onOpenChange={() => toggle('seniority')}>
            <FilterDropdown label="Level" placeholder="e.g. Mid-Senior" options={SENIORITY_OPTIONS} selected={filters.seniority} onChange={(v) => update({ seniority: v })} />
          </FilterSection>

          {/* Recruiter */}
          <FilterSection icon={Eye} label="Recruiter" open={sections.recruiter} onOpenChange={() => toggle('recruiter')}>
            <TagInput label="Recruiter names or companies" placeholder="e.g. Robert Half" tags={filters.recruiterKeywords} onChange={(v) => update({ recruiterKeywords: v })} />
          </FilterSection>

          {/* Posting date */}
          <FilterSection icon={CalendarDays} label="Posting date" open={sections.posting} onOpenChange={() => toggle('posting')}>
            <SingleDropdown label="Posted within" placeholder="Any time" options={POSTED_WITHIN_OPTIONS} value={filters.postedWithin} onChange={(v) => update({ postedWithin: v })} />
          </FilterSection>

          {/* Companies */}
          <FilterSection icon={Building2} label="Companies" open={sections.companies} onOpenChange={() => toggle('companies')}>
            <FilterDropdown label="Industries" placeholder="e.g. Software Development" options={INDUSTRIES} selected={filters.industries} onChange={(v) => update({ industries: v })} />
            <TagInput label="Company names" placeholder="e.g. Google, Amazon" tags={filters.companies} onChange={(v) => update({ companies: v })} />
          </FilterSection>

          {/* Limit results */}
          <FilterSection icon={Layers} label="Limit results" open={sections.limit} onOpenChange={() => toggle('limit')}>
            <SingleDropdown label="Limit" placeholder="50" options={LIMIT_OPTIONS} value={String(filters.limit)} onChange={(v) => update({ limit: Number(v) || 50 })} />
          </FilterSection>

        </div>
      </ScrollArea>
    </div>
  );
}
