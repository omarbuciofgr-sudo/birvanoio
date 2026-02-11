import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Bookmark, BookmarkCheck } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SearchFilters } from '@/components/prospect-search/SearchFilters';
import { PeopleFilters, defaultPeopleFilters, PeopleSearchFilters } from '@/components/prospect-search/PeopleFilters';
import { JobFilters, defaultJobFilters, JobSearchFilters } from '@/components/prospect-search/JobFilters';
import { LocalBusinessSearch } from '@/components/prospect-search/LocalBusinessSearch';
import { SearchResults } from '@/components/prospect-search/SearchResults';
import { SearchTypeSelector, SearchTypeHeader, SearchType } from '@/components/prospect-search/SearchTypeSelector';
import { defaultFilters, ProspectSearchFilters, INDUSTRIES } from '@/components/prospect-search/constants';
import { industrySearchApi, CompanyResult } from '@/lib/api/industrySearch';
import { EMPLOYEE_RANGES } from '@/lib/api/industrySearch';
import { supabase } from '@/integrations/supabase/client';

interface BrivanoLensProps {
  onSaveProspects?: (prospects: any[]) => void;
  externalFilters?: Partial<ProspectSearchFilters> | null;
  onSwitchTab?: (tab: string) => void;
  onSearchTypeChange?: (hasSearchType: boolean) => void;
}

export function BrivanoLens({ onSaveProspects, externalFilters, onSwitchTab, onSearchTypeChange }: BrivanoLensProps) {
  const { user } = useAuth();
  const [searchType, setSearchType] = useState<SearchType | null>(null);
  const [filters, setFilters] = useState<ProspectSearchFilters>(defaultFilters);
  const [peopleFilters, setPeopleFilters] = useState<PeopleSearchFilters>(defaultPeopleFilters);
  const [jobFilters, setJobFilters] = useState<JobSearchFilters>(defaultJobFilters);
  const lastAppliedRef = useRef<string | null>(null);
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [savedSearches, setSavedSearches] = useState<{ id: string; name: string; filters: ProspectSearchFilters }[]>([]);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalResults, setTotalResults] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const [shouldAutoSearch, setShouldAutoSearch] = useState(false);

  // When external filters arrive, auto-select companies mode
  useEffect(() => {
    if (!externalFilters) return;
    const key = JSON.stringify(externalFilters);
    if (key === lastAppliedRef.current) return;
    lastAppliedRef.current = key;

    const merged = { ...defaultFilters };
    if (externalFilters.industries) merged.industries = externalFilters.industries;
    if (externalFilters.companySizes) merged.companySizes = externalFilters.companySizes;
    if (externalFilters.annualRevenue) merged.annualRevenue = externalFilters.annualRevenue;
    if (externalFilters.countries) merged.countries = externalFilters.countries;
    if (externalFilters.citiesOrStates) merged.citiesOrStates = externalFilters.citiesOrStates;
    if (externalFilters.cities) merged.cities = externalFilters.cities;
    if (externalFilters.states) merged.states = externalFilters.states;
    if (externalFilters.keywordsInclude) merged.keywordsInclude = externalFilters.keywordsInclude;
    if (externalFilters.limit) merged.limit = externalFilters.limit;
    setFilters(merged);
    setSearchType('companies');
    setShouldAutoSearch(true);
  }, [externalFilters]);

  useEffect(() => {
    if (shouldAutoSearch && !searchMutation.isPending) {
      setShouldAutoSearch(false);
      const timer = setTimeout(() => searchMutation.mutate({}), 100);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoSearch, filters]);

  const handleSelectSearchType = (type: SearchType) => {
    setSearchType(type);
    setResults([]);
    setHasSearched(false);
    setSelectedRows(new Set());
    onSearchTypeChange?.(true);
  };

  const loadSavedSearches = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('saved_searches')
      .select('id, name, filters')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (data) {
      setSavedSearches(data.map((d) => ({
        id: d.id,
        name: d.name,
        filters: d.filters as unknown as ProspectSearchFilters,
      })));
    }
  }, [user]);

  const handleLocalSearch = useCallback(async (params: { lat: number; lng: number; radiusMiles: number; searchType: string; keyword: string }) => {
    localSearchMutation.mutate(params);
  }, []);

  const localSearchMutation = useMutation({
    mutationFn: async (params: { lat: number; lng: number; radiusMiles: number; searchType: string; keyword: string }) => {
      const query = [params.keyword, params.searchType.replace(/_/g, ' ')].filter(Boolean).join(' ');
      const { data, error } = await supabase.functions.invoke('google-places-search', {
        body: {
          action: 'search',
          query,
          location: { lat: params.lat, lng: params.lng },
          radius: Math.round(params.radiusMiles * 1609.34),
          type: params.searchType,
          limit: 20,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      const places = data?.data || [];
      if (places.length > 0) {
        const mapped: CompanyResult[] = places.map((r: any) => ({
          name: r.name || '',
          domain: r.website || '',
          industry: (r.types || []).slice(0, 2).join(', '),
          employee_count: undefined,
          employee_range: '',
          annual_revenue: undefined,
          founded_year: undefined,
          headquarters_city: '',
          headquarters_state: '',
          headquarters_country: 'US',
          linkedin_url: '',
          technologies: [],
          description: r.address || '',
          website_url: r.website || '',
          phone: r.phone || '',
          rating: r.rating,
          review_count: r.review_count,
          place_id: r.place_id,
        }));
        setResults(mapped);
        setHasSearched(true);
        setSelectedRows(new Set());
        toast.success(`Found ${mapped.length} local businesses`);
      } else {
        setResults([]);
        setHasSearched(true);
        toast.info('No businesses found in this area');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Search failed');
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (opts?: { page?: number; append?: boolean }) => {
      const page = opts?.page || 1;
      // ── People Search ─────────────────────────────────
      if (searchType === 'people') {
        const locationParts = [...peopleFilters.cities, ...peopleFilters.states, ...peopleFilters.countries];

        // Build profile keywords including certifications, languages, education, schools
        const allKeywords = [
          ...peopleFilters.skills,
          ...peopleFilters.profileKeywords,
          ...peopleFilters.certifications,
          ...peopleFilters.languages,
          ...peopleFilters.educationLevel,
          ...peopleFilters.schools,
        ].filter(Boolean);

        const response = await industrySearchApi.searchPeople({
          person_titles: peopleFilters.jobTitles.length > 0 ? peopleFilters.jobTitles : undefined,
          person_seniorities: peopleFilters.seniority.length > 0 ? peopleFilters.seniority : undefined,
          person_departments: peopleFilters.departments.length > 0 ? peopleFilters.departments : undefined,
          person_locations: locationParts.length > 0 ? locationParts : undefined,
          organization_industry_tag_ids: peopleFilters.industries.length > 0
            ? peopleFilters.industries.map((v) => INDUSTRIES.find((i) => i.value === v)?.label || v)
            : undefined,
          organization_num_employees_ranges: peopleFilters.companySizes.length > 0 ? peopleFilters.companySizes : undefined,
          q_organization_name: peopleFilters.companies.length > 0 ? peopleFilters.companies.join(' ') : undefined,
          profile_keywords: allKeywords.length > 0 ? allKeywords : undefined,
          email_status: peopleFilters.emailStatus || undefined,
          technologies: peopleFilters.technologies.length > 0 ? peopleFilters.technologies : undefined,
          revenue_range: peopleFilters.annualRevenue || undefined,
          funding_range: peopleFilters.fundingRaised || undefined,
          funding_stage: peopleFilters.fundingStage || undefined,
          market_segments: peopleFilters.marketSegments.length > 0 ? peopleFilters.marketSegments : undefined,
          buying_intent: peopleFilters.buyingIntent || undefined,
          sic_codes: peopleFilters.sicCodes.length > 0 ? peopleFilters.sicCodes : undefined,
          naics_codes: peopleFilters.naicsCodes.length > 0 ? peopleFilters.naicsCodes : undefined,
          job_posting_filter: peopleFilters.jobPostingFilter || undefined,
          job_categories: peopleFilters.jobCategories.length > 0 ? peopleFilters.jobCategories : undefined,
          exclude_person_names: peopleFilters.excludePeople.length > 0 ? peopleFilters.excludePeople : undefined,
          person_past_titles: peopleFilters.pastJobTitles.length > 0 ? peopleFilters.pastJobTitles : undefined,
          past_companies: peopleFilters.pastCompanies.length > 0 ? peopleFilters.pastCompanies : undefined,
          years_experience_min: peopleFilters.yearsExperienceMin ? parseInt(peopleFilters.yearsExperienceMin) : undefined,
          years_experience_max: peopleFilters.yearsExperienceMax ? parseInt(peopleFilters.yearsExperienceMax) : undefined,
          limit: peopleFilters.limit,
        });

        if (response.success && response.people) {
          // Map people results to CompanyResult for display compatibility
          const mapped: CompanyResult[] = response.people.map((p) => ({
            name: p.name,
            domain: p.organization_domain || '',
            website: p.organization_domain ? `https://${p.organization_domain}` : null,
            linkedin_url: p.linkedin_url,
            industry: p.organization_industry,
            employee_count: p.organization_employee_count,
            employee_range: null,
            annual_revenue: null,
            founded_year: null,
            description: [p.title, p.organization_name].filter(Boolean).join(' at '),
            headquarters_city: p.city,
            headquarters_state: p.state,
            headquarters_country: p.country,
            technologies: [],
            keywords: p.departments || [],
          }));
          return { success: true, companies: mapped };
        }
        return { success: false, error: response.error || 'No results' };
      }

      // ── Job Search ─────────────────────────────────
      if (searchType === 'jobs') {
        const locationParts = [...jobFilters.cities, ...jobFilters.states, ...jobFilters.countries];

        const response = await industrySearchApi.searchJobs({
          job_titles: jobFilters.jobTitles.length > 0 ? jobFilters.jobTitles : undefined,
          exclude_job_titles: jobFilters.excludeJobTitles.length > 0 ? jobFilters.excludeJobTitles : undefined,
          job_description_keywords: jobFilters.jobDescriptionKeywords.length > 0 ? jobFilters.jobDescriptionKeywords : undefined,
          industries: jobFilters.industries.length > 0
            ? jobFilters.industries.map((v) => INDUSTRIES.find((i) => i.value === v)?.label || v)
            : undefined,
          companies: jobFilters.companies.length > 0 ? jobFilters.companies : undefined,
          locations: locationParts.length > 0 ? locationParts : undefined,
          employment_types: jobFilters.employmentType.length > 0 ? jobFilters.employmentType : undefined,
          seniority: jobFilters.seniority.length > 0 ? jobFilters.seniority : undefined,
          recruiter_keywords: jobFilters.recruiterKeywords.length > 0 ? jobFilters.recruiterKeywords : undefined,
          posted_within: jobFilters.postedWithin || undefined,
          limit: jobFilters.limit,
        });

        if (response.success && response.jobs) {
          const mapped: CompanyResult[] = response.jobs.map((j) => ({
            name: j.title,
            domain: j.company_domain || '',
            website: j.apply_url,
            linkedin_url: j.linkedin_url,
            industry: j.company_industry,
            employee_count: null,
            employee_range: null,
            annual_revenue: null,
            founded_year: null,
            description: [j.company_name, j.location].filter(Boolean).join(' — '),
            headquarters_city: null,
            headquarters_state: null,
            headquarters_country: null,
            technologies: [],
            keywords: [],
          }));
          return { success: true, companies: mapped };
        }
        return { success: false, error: response.error || 'No results' };
      }

      // ── Company Search ─────────────────────────────────
      const industry = filters.industries
        .map((v) => INDUSTRIES.find((i) => i.value === v)?.label || v)
        .join(', ');

      const locationParts = [
        ...filters.cities, ...filters.states, ...filters.citiesOrStates, ...filters.countries,
      ];
      const location = locationParts.join(', ') || undefined;

      const locationsExclude = [
        ...filters.citiesToExclude, ...filters.statesToExclude, ...filters.countriesToExclude,
        ...filters.citiesOrStatesToExclude,
      ].filter(Boolean);

      const keywords = [
        ...filters.keywordsInclude, filters.productsDescription,
      ].filter(Boolean).join(', ') || undefined;

      const employee_ranges = filters.companySizes.length > 0 ? filters.companySizes : undefined;

      return industrySearchApi.searchCompanies({
        industry,
        employee_ranges,
        location,
        keywords,
        revenue_range: filters.annualRevenue || undefined,
        funding_range: filters.fundingRaised || undefined,
        funding_stage: filters.fundingStage || undefined,
        company_types: filters.companyTypes.length > 0 ? filters.companyTypes : undefined,
        technologies: filters.technologies.length > 0 ? filters.technologies : undefined,
        sic_codes: filters.sicCodes.length > 0 ? filters.sicCodes : undefined,
        naics_codes: filters.naicsCodes.length > 0 ? filters.naicsCodes : undefined,
        buying_intent: filters.buyingIntent || undefined,
        market_segments: filters.marketSegments.length > 0 ? filters.marketSegments : undefined,
        job_posting_filter: filters.jobPostingFilter || undefined,
        job_categories: filters.jobCategories.length > 0 ? filters.jobCategories : undefined,
        industries_exclude: filters.industriesToExclude.length > 0
          ? filters.industriesToExclude.map((v) => INDUSTRIES.find((i) => i.value === v)?.label || v)
          : undefined,
        locations_exclude: locationsExclude.length > 0 ? locationsExclude : undefined,
        keywords_exclude: filters.keywordsExclude.length > 0 ? filters.keywordsExclude : undefined,
        limit: filters.limit,
        page,
      });
    },
    onSuccess: (response, variables) => {
      if (response.success && response.companies) {
        const append = variables?.append;
        if (append) {
          setResults(prev => [...prev, ...response.companies!]);
        } else {
          setResults(response.companies);
          setSelectedRows(new Set());
        }
        setHasSearched(true);
        setTotalResults(response.pagination?.total_entries || response.companies.length);
        setTotalPages(response.pagination?.total_pages || 1);
        setCurrentPage(variables?.page || 1);
        setIsLoadingMore(false);
        toast.success(`Found ${response.companies.length} results`);
      } else {
        setIsLoadingMore(false);
        toast.error(response.error || 'Search failed');
      }
    },
    onError: (error) => {
      setIsLoadingMore(false);
      toast.error(error instanceof Error ? error.message : 'Search failed');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const selected = results.filter((_, i) => selectedRows.has(i));
      return industrySearchApi.saveAsLeads(selected);
    },
    onSuccess: (result) => {
      toast.success(`Saved ${result.saved} companies as leads`);
      if (result.errors > 0) toast.error(`${result.errors} failed to save`);
    },
    onError: () => toast.error('Failed to save leads'),
  });

  const handleExport = () => {
    const selected = selectedRows.size > 0
      ? results.filter((_, i) => selectedRows.has(i))
      : results;
    const headers = ['Name', 'Domain', 'Industry', 'Employees', 'Employee Range', 'Revenue', 'Founded', 'City', 'State', 'Country', 'LinkedIn', 'Technologies'];
    const rows = selected.map((c) => [
      c.name, c.domain, c.industry || '', c.employee_count?.toString() || '', c.employee_range || '',
      c.annual_revenue?.toString() || '', c.founded_year?.toString() || '',
      c.headquarters_city || '', c.headquarters_state || '', c.headquarters_country || '',
      c.linkedin_url || '', (c.technologies || []).join('; '),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `companies-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selected.length} companies`);
  };

  const handleSaveSearch = async () => {
    if (!user || !searchName.trim()) return;
    const { error } = await supabase.from('saved_searches').insert([{
      user_id: user.id,
      name: searchName.trim(),
      filters: JSON.parse(JSON.stringify(filters)),
    }]);
    if (error) {
      toast.error('Failed to save search');
    } else {
      toast.success('Search saved!');
      setSaveDialogOpen(false);
      setSearchName('');
    }
  };

  const handleLoadSearch = (search: { filters: ProspectSearchFilters }) => {
    setFilters(search.filters);
    setSearchType('companies');
    setLoadDialogOpen(false);
    toast.success('Filters loaded');
  };

  const canSearch = () => {
    if (searchType === 'local') return true;
    if (searchType === 'people') return peopleFilters.jobTitles.length > 0 || peopleFilters.industries.length > 0 || peopleFilters.companies.length > 0;
    if (searchType === 'jobs') return jobFilters.jobTitles.length > 0 || jobFilters.industries.length > 0 || jobFilters.companies.length > 0;
    return filters.industries.length > 0;
  };

  // Show search type selector if no type chosen
  if (!searchType) {
    return (
      <div className="h-[calc(100vh-180px)] min-h-[500px] flex flex-col border border-border/60 rounded-lg overflow-hidden bg-background">
        <SearchTypeSelector onSelect={handleSelectSearchType} />
      </div>
    );
  }

  // When a search type is active, the parent hides tabs/header so we can use more vertical space
  const isFullMode = !!onSearchTypeChange;

  return (
    <div className={`${isFullMode ? 'h-[calc(100vh-80px)]' : 'h-[calc(100vh-180px)]'} min-h-[500px] flex flex-col border border-border/60 rounded-lg overflow-hidden bg-background`}>
      {/* Top bar */}
      <div className="flex-shrink-0 h-11 border-b border-border/60 flex items-center justify-between px-4 bg-muted/30">
        <SearchTypeHeader type={searchType} onBack={() => { setSearchType(null); onSearchTypeChange?.(false); }} />
        <div className="flex items-center gap-2">
          <Dialog open={loadDialogOpen} onOpenChange={(open) => {
            setLoadDialogOpen(open);
            if (open) loadSavedSearches();
          }}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="text-[11px] h-7 gap-1.5 text-muted-foreground hover:text-foreground">
                <BookmarkCheck className="h-3 w-3" />
                Browse past searches
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle className="text-sm">Saved searches</DialogTitle>
              </DialogHeader>
              <div className="space-y-1.5 max-h-[300px] overflow-y-auto">
                {savedSearches.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-6">No saved searches yet.</p>
                )}
                {savedSearches.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left px-3 py-2.5 rounded-md border border-border/50 hover:bg-accent/50 transition-colors"
                    onClick={() => handleLoadSearch(s)}
                  >
                    <span className="text-xs font-medium">{s.name}</span>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 2-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Filters */}
        <div className="w-[360px] flex-shrink-0 overflow-hidden border-r border-border/60 flex flex-col">
          {searchType === 'local' && (
            <LocalBusinessSearch
              onSearch={handleLocalSearch}
              isSearching={localSearchMutation.isPending}
            />
          )}
          {searchType === 'people' && (
            <>
              <PeopleFilters
                filters={peopleFilters}
                onFiltersChange={setPeopleFilters}
                onSearch={() => searchMutation.mutate({})}
                isSearching={searchMutation.isPending}
                resultCount={results.length}
              />
            </>
          )}
          {searchType === 'jobs' && (
            <>
              <JobFilters
                filters={jobFilters}
                onFiltersChange={setJobFilters}
                onSearch={() => searchMutation.mutate({})}
                isSearching={searchMutation.isPending}
                resultCount={results.length}
              />
            </>
          )}
          {searchType === 'companies' && (
            <>
              <SearchFilters
                filters={filters}
                onFiltersChange={setFilters}
                onSearch={() => searchMutation.mutate({})}
                isSearching={searchMutation.isPending}
                resultCount={results.length}
              />
            </>
          )}
          {/* Bottom bar - hidden for local (has its own) */}
          {searchType !== 'local' && (
            <div className="h-12 border-t border-border/60 px-4 flex items-center justify-between bg-muted/30">
              <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="text-[11px] h-7 gap-1.5 text-muted-foreground hover:text-foreground">
                    <Bookmark className="h-3 w-3" />
                    Save search
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-sm">
                  <DialogHeader>
                    <DialogTitle className="text-sm">Save current filters</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input
                      placeholder="e.g. SaaS companies in California"
                      value={searchName}
                      onChange={(e) => setSearchName(e.target.value)}
                      className="text-sm h-9"
                    />
                    <Button onClick={handleSaveSearch} disabled={!searchName.trim()} className="w-full h-9 text-sm">
                      Save
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                onClick={() => searchMutation.mutate({})}
                disabled={searchMutation.isPending || !canSearch()}
                size="sm"
                className="h-7 px-5 text-xs font-semibold"
              >
                {searchMutation.isPending ? 'Searching…' : 'Next'}
              </Button>
            </div>
          )}
        </div>

        {/* Right: Results */}
        <div className="flex-1 overflow-hidden">
          <SearchResults
            results={results}
            selectedRows={selectedRows}
            onSelectionChange={setSelectedRows}
            isLoading={searchMutation.isPending && !isLoadingMore}
            hasSearched={hasSearched}
            onSave={() => saveMutation.mutate()}
            onExport={handleExport}
            isSaving={saveMutation.isPending}
            onLoadMore={() => {
              const nextPage = currentPage + 1;
              setIsLoadingMore(true);
              searchMutation.mutate({ page: nextPage, append: true });
            }}
            isLoadingMore={isLoadingMore}
            hasMoreResults={currentPage < totalPages}
            totalResults={totalResults}
          />
        </div>
      </div>
    </div>
  );
}
