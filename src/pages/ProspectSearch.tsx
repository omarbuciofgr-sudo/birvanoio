import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Bookmark, BookmarkCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { SearchFilters } from '@/components/prospect-search/SearchFilters';
import { SearchResults } from '@/components/prospect-search/SearchResults';
import { SearchChat } from '@/components/prospect-search/SearchChat';
import { defaultFilters, ProspectSearchFilters, INDUSTRIES } from '@/components/prospect-search/constants';
import { industrySearchApi, CompanyResult } from '@/lib/api/industrySearch';
import { EMPLOYEE_RANGES } from '@/lib/api/industrySearch';
import { supabase } from '@/integrations/supabase/client';

export default function ProspectSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ProspectSearchFilters>(defaultFilters);
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [savedSearches, setSavedSearches] = useState<{ id: string; name: string; filters: ProspectSearchFilters }[]>([]);
  const [loadDialogOpen, setLoadDialogOpen] = useState(false);

  // Load saved searches
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

      const location = [
        ...filters.citiesOrStates,
        ...filters.countries,
      ].join(', ') || undefined;

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

  const handleApplyFilters = useCallback((partial: Partial<ProspectSearchFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
    toast.success('Filters updated by AI assistant');
  }, []);

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

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex-shrink-0 h-12 border-b border-border flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate('/dashboard/scraper')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-display text-sm font-semibold">Find companies</h1>
        </div>
        <div className="flex items-center gap-2">
          {/* Save search */}
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5">
                <Bookmark className="h-3.5 w-3.5" />
                Save search
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Save current filters</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="e.g. SaaS companies in California"
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="text-sm"
                />
                <Button onClick={handleSaveSearch} disabled={!searchName.trim()} className="w-full">
                  Save
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Load search */}
          <Dialog open={loadDialogOpen} onOpenChange={(open) => {
            setLoadDialogOpen(open);
            if (open) loadSavedSearches();
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5">
                <BookmarkCheck className="h-3.5 w-3.5" />
                Load
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Saved searches</DialogTitle>
              </DialogHeader>
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {savedSearches.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">No saved searches yet.</p>
                )}
                {savedSearches.map((s) => (
                  <button
                    key={s.id}
                    className="w-full text-left px-3 py-2.5 rounded-md border border-border hover:bg-accent transition-colors"
                    onClick={() => handleLoadSearch(s)}
                  >
                    <span className="text-sm font-medium">{s.name}</span>
                  </button>
                ))}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 3-panel layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Filters */}
        <div className="w-[300px] flex-shrink-0 overflow-hidden">
          <SearchFilters
            filters={filters}
            onFiltersChange={setFilters}
            onSearch={() => searchMutation.mutate()}
            isSearching={searchMutation.isPending}
            resultCount={results.length}
          />
        </div>

        {/* Center: Results */}
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

        {/* Right: Chat */}
        <div className="w-[320px] flex-shrink-0 overflow-hidden">
          <SearchChat onApplyFilters={handleApplyFilters} />
        </div>
      </div>
    </div>
  );
}
