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
import { SearchResults } from '@/components/prospect-search/SearchResults';
import { defaultFilters, ProspectSearchFilters, INDUSTRIES } from '@/components/prospect-search/constants';
import { industrySearchApi, CompanyResult } from '@/lib/api/industrySearch';
import { EMPLOYEE_RANGES } from '@/lib/api/industrySearch';
import { supabase } from '@/integrations/supabase/client';

interface BrivanoLensProps {
  onSaveProspects?: (prospects: any[]) => void;
  externalFilters?: Partial<ProspectSearchFilters> | null;
}

export function BrivanoLens({ onSaveProspects, externalFilters }: BrivanoLensProps) {
  const { user } = useAuth();
  const [filters, setFilters] = useState<ProspectSearchFilters>(defaultFilters);
  const lastAppliedRef = useRef<string | null>(null);
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [savedSearches, setSavedSearches] = useState<{ id: string; name: string; filters: ProspectSearchFilters }[]>([]);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);

  // Apply external filters from AI chat and auto-trigger search
  const [shouldAutoSearch, setShouldAutoSearch] = useState(false);

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
    setShouldAutoSearch(true);
  }, [externalFilters]);

  // Auto-trigger search after filters are applied from AI
  useEffect(() => {
    if (shouldAutoSearch && !searchMutation.isPending) {
      setShouldAutoSearch(false);
      // Small delay to ensure state is settled
      const timer = setTimeout(() => searchMutation.mutate(), 100);
      return () => clearTimeout(timer);
    }
  }, [shouldAutoSearch, filters]);

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

  const searchMutation = useMutation({
    mutationFn: async () => {
      const industry = filters.industries
        .map((v) => INDUSTRIES.find((i) => i.value === v)?.label || v)
        .join(', ');

      const locationParts = [
        ...filters.cities,
        ...filters.states,
        ...filters.citiesOrStates,
        ...filters.countries,
      ];
      const location = locationParts.join(', ') || undefined;

      const keywords = [
        ...filters.keywordsInclude,
        filters.productsDescription,
      ].filter(Boolean).join(', ') || undefined;

      let employee_count_min: number | undefined;
      let employee_count_max: number | undefined;
      if (filters.companySizes.length > 0) {
        const range = EMPLOYEE_RANGES.find((r) => r.value === filters.companySizes[0]);
        if (range) {
          employee_count_min = range.min;
          employee_count_max = range.max;
        }
      }

      return industrySearchApi.searchCompanies({
        industry,
        employee_count_min,
        employee_count_max,
        location,
        keywords,
        limit: filters.limit,
      });
    },
    onSuccess: (response) => {
      if (response.success && response.companies) {
        setResults(response.companies);
        setSelectedRows(new Set());
        setHasSearched(true);
        toast.success(`Found ${response.companies.length} companies`);
      } else {
        toast.error(response.error || 'Search failed');
      }
    },
    onError: (error) => {
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
    setLoadDialogOpen(false);
    toast.success('Filters loaded');
  };

  return (
    <div className="h-[calc(100vh-180px)] min-h-[500px] flex flex-col border border-border/60 rounded-lg overflow-hidden bg-background">
      {/* Top bar */}
      <div className="flex-shrink-0 h-11 border-b border-border/60 flex items-center justify-between px-4 bg-muted/30">
        <h2 className="text-xs font-semibold tracking-tight">Find companies</h2>
        <div className="flex items-center gap-2">
          {/* Load saved searches */}
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
        <div className="w-[360px] flex-shrink-0 overflow-hidden border-r border-border/60">
          <SearchFilters
            filters={filters}
            onFiltersChange={setFilters}
            onSearch={() => searchMutation.mutate()}
            isSearching={searchMutation.isPending}
            resultCount={results.length}
          />
          {/* Bottom bar */}
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
              onClick={() => searchMutation.mutate()}
              disabled={searchMutation.isPending || filters.industries.length === 0}
              size="sm"
              className="h-7 px-5 text-xs font-semibold"
            >
              {searchMutation.isPending ? 'Searching…' : 'Next'}
            </Button>
          </div>
        </div>

        {/* Right: Results */}
        <div className="flex-1 overflow-hidden">
          <SearchResults
            results={results}
            selectedRows={selectedRows}
            onSelectionChange={setSelectedRows}
            isLoading={searchMutation.isPending}
            hasSearched={hasSearched}
            onSave={() => saveMutation.mutate()}
            onExport={handleExport}
            isSaving={saveMutation.isPending}
          />
        </div>
      </div>
    </div>
  );
}
