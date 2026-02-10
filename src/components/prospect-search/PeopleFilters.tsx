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
  GraduationCap,
  Award,
  User,
  Languages,
  Ban,
  Sparkles,
  Clock,
} from 'lucide-react';
import {
  INDUSTRIES,
  COUNTRIES,
  US_STATES,
  MAJOR_CITIES,
  COMPANY_SIZES,
} from './constants';

export interface PeopleSearchFilters {
  jobTitles: string[];
  seniority: string[];
  departments: string[];
  industries: string[];
  companySizes: string[];
  companies: string[];
  countries: string[];
  states: string[];
  cities: string[];
  yearsExperienceMin: string;
  yearsExperienceMax: string;
  skills: string[];
  certifications: string[];
  languages: string[];
  educationLevel: string[];
  schools: string[];
  excludePeople: string[];
  pastCompanies: string[];
  pastJobTitles: string[];
  profileKeywords: string[];
  limit: number;
}

export const defaultPeopleFilters: PeopleSearchFilters = {
  jobTitles: [],
  seniority: [],
  departments: [],
  industries: [],
  companySizes: [],
  companies: [],
  countries: [],
  states: [],
  cities: [],
  yearsExperienceMin: '',
  yearsExperienceMax: '',
  skills: [],
  certifications: [],
  languages: [],
  educationLevel: [],
  schools: [],
  excludePeople: [],
  pastCompanies: [],
  pastJobTitles: [],
  profileKeywords: [],
  limit: 50,
};

const SENIORITY_OPTIONS = [
  { value: 'intern', label: 'Intern' },
  { value: 'entry', label: 'Entry Level' },
  { value: 'associate', label: 'Associate' },
  { value: 'mid', label: 'Mid-Level' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead' },
  { value: 'manager', label: 'Manager' },
  { value: 'director', label: 'Director' },
  { value: 'vp', label: 'VP' },
  { value: 'c_level', label: 'C-Level' },
  { value: 'founder', label: 'Founder / Owner' },
];

const DEPARTMENT_OPTIONS = [
  { value: 'engineering', label: 'Engineering' },
  { value: 'sales', label: 'Sales' },
  { value: 'marketing', label: 'Marketing' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'Human Resources' },
  { value: 'operations', label: 'Operations' },
  { value: 'product', label: 'Product' },
  { value: 'design', label: 'Design' },
  { value: 'legal', label: 'Legal' },
  { value: 'customer_success', label: 'Customer Success' },
  { value: 'it', label: 'IT' },
  { value: 'executive', label: 'Executive' },
];

const EDUCATION_OPTIONS = [
  { value: 'high_school', label: 'High School' },
  { value: 'associate', label: "Associate's Degree" },
  { value: 'bachelor', label: "Bachelor's Degree" },
  { value: 'master', label: "Master's Degree" },
  { value: 'mba', label: 'MBA' },
  { value: 'doctorate', label: 'Doctorate / PhD' },
];

const LANGUAGE_OPTIONS = [
  { value: 'english', label: 'English' },
  { value: 'spanish', label: 'Spanish' },
  { value: 'french', label: 'French' },
  { value: 'german', label: 'German' },
  { value: 'portuguese', label: 'Portuguese' },
  { value: 'mandarin', label: 'Mandarin' },
  { value: 'japanese', label: 'Japanese' },
  { value: 'korean', label: 'Korean' },
  { value: 'arabic', label: 'Arabic' },
  { value: 'hindi', label: 'Hindi' },
  { value: 'italian', label: 'Italian' },
  { value: 'dutch', label: 'Dutch' },
  { value: 'russian', label: 'Russian' },
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

/* ── Main component ──────────────────────────────────────────── */

const stateOptions = US_STATES.map((s) => ({ value: s, label: s }));

interface PeopleFiltersProps {
  filters: PeopleSearchFilters;
  onFiltersChange: (filters: PeopleSearchFilters) => void;
  onSearch: () => void;
  isSearching: boolean;
  resultCount: number;
}

export function PeopleFilters({ filters, onFiltersChange }: PeopleFiltersProps) {
  const [sections, setSections] = useState<Record<string, boolean>>({
    companyAttributes: false,
    jobTitle: false,
    experience: false,
    location: false,
    profile: false,
    certifications: false,
    languages: false,
    education: false,
    companies: false,
    exclude: false,
    pastExperiences: false,
  });

  const toggle = (key: string) => setSections((s) => ({ ...s, [key]: !s[key] }));
  const update = (partial: Partial<PeopleSearchFilters>) => onFiltersChange({ ...filters, ...partial });

  return (
    <div className="h-[calc(100%-56px)] flex flex-col">
      <div className="flex-shrink-0 px-5 pt-5 pb-4">
        <h2 className="text-base font-semibold tracking-tight">People Search</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Search for people matching your criteria.</p>
      </div>

      <ScrollArea className="flex-1 px-5">
        <div className="space-y-0 pb-4">

          {/* Company attributes */}
          <FilterSection icon={Building2} label="Company attributes" open={sections.companyAttributes} onOpenChange={() => toggle('companyAttributes')}>
            <FilterDropdown label="Industries" placeholder="e.g. Software Development" options={INDUSTRIES} selected={filters.industries} onChange={(v) => update({ industries: v })} />
            <FilterDropdown label="Company sizes" placeholder="e.g. 11-50 employees" options={COMPANY_SIZES} selected={filters.companySizes} onChange={(v) => update({ companySizes: v })} />
          </FilterSection>

          {/* Job title */}
          <FilterSection icon={Briefcase} label="Job title" open={sections.jobTitle} onOpenChange={() => toggle('jobTitle')}>
            <TagInput label="Job titles" placeholder="e.g. CEO, VP of Sales" tags={filters.jobTitles} onChange={(v) => update({ jobTitles: v })} />
            <FilterDropdown label="Seniority" placeholder="e.g. C-Level, VP" options={SENIORITY_OPTIONS} selected={filters.seniority} onChange={(v) => update({ seniority: v })} />
            <FilterDropdown label="Department" placeholder="e.g. Sales, Engineering" options={DEPARTMENT_OPTIONS} selected={filters.departments} onChange={(v) => update({ departments: v })} />
          </FilterSection>

          {/* Experience */}
          <FilterSection icon={Award} label="Experience" open={sections.experience} onOpenChange={() => toggle('experience')}>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Min years</Label>
                <Input type="number" placeholder="Min" value={filters.yearsExperienceMin} onChange={(e) => update({ yearsExperienceMin: e.target.value })} className="h-[34px] text-xs" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">Max years</Label>
                <Input type="number" placeholder="Max" value={filters.yearsExperienceMax} onChange={(e) => update({ yearsExperienceMax: e.target.value })} className="h-[34px] text-xs" />
              </div>
            </div>
            <TagInput label="Skills" placeholder="e.g. Salesforce, Python" tags={filters.skills} onChange={(v) => update({ skills: v })} />
          </FilterSection>

          {/* Location */}
          <FilterSection icon={Globe} label="Location" open={sections.location} onOpenChange={() => toggle('location')}>
            <FilterDropdown label="Countries" placeholder="e.g. United States" options={COUNTRIES} selected={filters.countries} onChange={(v) => update({ countries: v })} />
            <FilterDropdown label="States" placeholder="e.g. California" options={stateOptions} selected={filters.states} onChange={(v) => update({ states: v })} />
            <FilterDropdown label="Cities" placeholder="e.g. San Francisco" options={MAJOR_CITIES} selected={filters.cities} onChange={(v) => update({ cities: v })} />
          </FilterSection>

          {/* Profile */}
          <FilterSection icon={User} label="Profile" open={sections.profile} onOpenChange={() => toggle('profile')}>
            <TagInput label="Profile keywords" placeholder="e.g. entrepreneur, advisor" tags={filters.profileKeywords} onChange={(v) => update({ profileKeywords: v })} />
          </FilterSection>

          {/* Certifications */}
          <FilterSection icon={Award} label="Certifications" open={sections.certifications} onOpenChange={() => toggle('certifications')}>
            <TagInput label="Certifications" placeholder="e.g. PMP, AWS, CPA" tags={filters.certifications} onChange={(v) => update({ certifications: v })} />
          </FilterSection>

          {/* Languages */}
          <FilterSection icon={Languages} label="Languages" open={sections.languages} onOpenChange={() => toggle('languages')}>
            <FilterDropdown label="Languages spoken" placeholder="e.g. English, Spanish" options={LANGUAGE_OPTIONS} selected={filters.languages} onChange={(v) => update({ languages: v })} />
          </FilterSection>

          {/* Education */}
          <FilterSection icon={GraduationCap} label="Education" open={sections.education} onOpenChange={() => toggle('education')}>
            <FilterDropdown label="Education level" placeholder="e.g. Bachelor's" options={EDUCATION_OPTIONS} selected={filters.educationLevel} onChange={(v) => update({ educationLevel: v })} />
            <TagInput label="Schools" placeholder="e.g. Stanford, MIT" tags={filters.schools} onChange={(v) => update({ schools: v })} />
          </FilterSection>

          {/* Companies */}
          <FilterSection icon={Building2} label="Companies" open={sections.companies} onOpenChange={() => toggle('companies')}>
            <TagInput label="Current companies" placeholder="e.g. Google, Salesforce" tags={filters.companies} onChange={(v) => update({ companies: v })} />
          </FilterSection>

          {/* Exclude people */}
          <FilterSection
            icon={Ban}
            label="Exclude people"
            badge={<Badge variant="outline" className="text-[10px] py-0 px-1.5 bg-accent text-accent-foreground border-border gap-1"><Sparkles className="h-3 w-3" />Upgrade</Badge>}
            open={sections.exclude}
            onOpenChange={() => toggle('exclude')}
          >
            <TagInput label="Exclude by name or keyword" placeholder="e.g. recruiter, freelancer" tags={filters.excludePeople} onChange={(v) => update({ excludePeople: v })} />
          </FilterSection>

          {/* Past experiences */}
          <FilterSection icon={Clock} label="Past experiences" open={sections.pastExperiences} onOpenChange={() => toggle('pastExperiences')}>
            <TagInput label="Past companies" placeholder="e.g. McKinsey, Deloitte" tags={filters.pastCompanies} onChange={(v) => update({ pastCompanies: v })} />
            <TagInput label="Past job titles" placeholder="e.g. Consultant, Analyst" tags={filters.pastJobTitles} onChange={(v) => update({ pastJobTitles: v })} />
          </FilterSection>

        </div>
      </ScrollArea>
    </div>
  );
}
