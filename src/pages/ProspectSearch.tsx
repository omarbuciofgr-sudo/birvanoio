import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Building2, Bookmark, BookmarkCheck } from 'lucide-react';
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
        ...filters.cities,
        ...filters.states,
        ...filters.citiesOrStates,
        ...filters.countries,
      ].join(', ') || undefined;

      const keywords = [
        ...filters.keywordsInclude,
        filters.productsDescription,
      ].filter(Boolean).join(', ') || undefined;

      // Pass all selected employee size ranges directly
      const employee_ranges = filters.companySizes.length > 0 ? filters.companySizes : undefined;

      return industrySearchApi.searchCompanies({
        industry,
        employee_ranges,
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

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Top bar */}
      <div className="flex-shrink-0 h-12 border-b border-border/60 flex items-center justify-between px-4 bg-background">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" onClick={() => navigate('/dashboard/scraper')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            <h1 className="text-sm font-semibold tracking-tight">Find companies</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Load saved searches */}
          <Dialog open={loadDialogOpen} onOpenChange={(open) => {
            setLoadDialogOpen(open);
            if (open) loadSavedSearches();
          }}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-xs h-8 gap-1.5 border-border/60">
                <BookmarkCheck className="h-3.5 w-3.5" />
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
        <div className="w-[420px] flex-shrink-0 overflow-hidden border-r border-border/60">
          <SearchFilters
            filters={filters}
            onFiltersChange={setFilters}
            onSearch={() => searchMutation.mutate()}
            isSearching={searchMutation.isPending}
            resultCount={results.length}
          />
          {/* Bottom bar for Save/Next */}
          <div className="h-14 border-t border-border/60 px-4 flex items-center justify-between bg-muted/30">
            <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs h-8 gap-1.5 text-muted-foreground hover:text-foreground">
                  <Bookmark className="h-3.5 w-3.5" />
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
              className="h-8 px-6 text-xs font-semibold"
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
