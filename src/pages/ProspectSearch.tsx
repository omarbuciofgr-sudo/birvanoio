import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SearchFilters } from '@/components/prospect-search/SearchFilters';
import { SearchResults } from '@/components/prospect-search/SearchResults';
import { SearchChat } from '@/components/prospect-search/SearchChat';
import { defaultFilters, ProspectSearchFilters, INDUSTRIES } from '@/components/prospect-search/constants';
import { industrySearchApi, CompanyResult } from '@/lib/api/industrySearch';
import { EMPLOYEE_RANGES } from '@/lib/api/industrySearch';

export default function ProspectSearch() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filters, setFilters] = useState<ProspectSearchFilters>(defaultFilters);
  const [results, setResults] = useState<CompanyResult[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  const searchMutation = useMutation({
    mutationFn: async () => {
      // Map filters to API params
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

      // Parse employee range from first selected size
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
    const headers = ['Name', 'Domain', 'Industry', 'Employees', 'City', 'State', 'Country', 'LinkedIn'];
    const rows = selected.map((c) => [
      c.name, c.domain, c.industry || '', c.employee_range || '',
      c.headquarters_city || '', c.headquarters_state || '', c.headquarters_country || '',
      c.linkedin_url || '',
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
          <SearchChat />
        </div>
      </div>
    </div>
  );
}
