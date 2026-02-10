import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Building2,
  Download,
  Save,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { CompanyResult } from '@/lib/api/industrySearch';

function CompanyLogo({ domain, name }: { domain: string | null | undefined; name: string }) {
  const [errored, setErrored] = useState(false);

  // Extract clean domain for favicon lookup
  const cleanDomain = (() => {
    if (!domain) return null;
    try {
      const d = domain.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
      return d || null;
    } catch {
      return null;
    }
  })();

  if (!cleanDomain || errored) {
    return (
      <div className="h-6 w-6 rounded bg-muted flex items-center justify-center flex-shrink-0">
        <span className="text-[10px] font-bold text-muted-foreground">
          {name.charAt(0).toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <img
      src={`https://www.google.com/s2/favicons?domain=${cleanDomain}&sz=64`}
      alt=""
      className="h-6 w-6 rounded flex-shrink-0 object-contain"
      onError={() => setErrored(true)}
    />
  );
}

interface SearchResultsProps {
  results: CompanyResult[];
  selectedRows: Set<number>;
  onSelectionChange: (selected: Set<number>) => void;
  isLoading: boolean;
  hasSearched: boolean;
  onSave: () => void;
  onExport: () => void;
  isSaving: boolean;
}

function getTypeBadge(types: string[], industry: string | null): string {
  if (types.includes('public')) return 'Public Company';
  if (types.includes('nonprofit')) return 'Non Profit';
  if (types.includes('privately_held')) return 'Privately Held';
  if (industry?.toLowerCase().includes('non-profit') || industry?.toLowerCase().includes('nonprofit')) return 'Non Profit';
  return 'Privately Held';
}

function formatSize(count: number | null, range: string | null): string {
  if (range) return range;
  if (!count) return '—';
  if (count >= 10001) return '10,001+ employees';
  if (count >= 5001) return '5,001-10,000 employees';
  if (count >= 1001) return '1,001-5,000 employees';
  if (count >= 501) return '501-1,000 employees';
  if (count >= 201) return '201-500 employees';
  if (count >= 51) return '51-200 employees';
  if (count >= 11) return '11-50 employees';
  return '1-10 employees';
}

export function SearchResults({
  results,
  selectedRows,
  onSelectionChange,
  isLoading,
  hasSearched,
  onSave,
  onExport,
  isSaving,
}: SearchResultsProps) {
  const toggleRow = (index: number) => {
    const newSelected = new Set(selectedRows);
    if (newSelected.has(index)) {
      newSelected.delete(index);
    } else {
      newSelected.add(index);
    }
    onSelectionChange(newSelected);
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-xs text-muted-foreground">Searching companies…</p>
        </div>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-3 border-b border-border/60 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Preview</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2 max-w-xs">
            <Building2 className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-xs text-muted-foreground">
              Select filters on the left and click <span className="font-medium text-foreground">Next</span> to preview results.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <div className="flex-shrink-0 px-5 py-3 border-b border-border/60">
          <h3 className="text-sm font-semibold">Preview</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2">
            <Building2 className="h-8 w-8 text-muted-foreground/30 mx-auto" />
            <p className="text-xs text-muted-foreground">No results found. Try broadening your filters.</p>
          </div>
        </div>
      </div>
    );
  }

  const importCount = selectedRows.size > 0 ? selectedRows.size : results.length;

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex-shrink-0 px-5 py-3 border-b border-border/60 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Preview</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-primary font-medium">
            Previewing {results.length} results. {importCount.toLocaleString()} will be imported.
          </span>
          <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="min-w-[900px]">
          <table className="w-full text-[13px]">
            <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur-sm">
              <tr className="border-b border-border/60">
                <th className="w-12 px-4 py-2.5 text-left text-xs font-medium text-muted-foreground"></th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="text-primary font-semibold">T</span> Name
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="text-primary font-semibold">T</span> Description
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="text-primary font-semibold">T</span> Primary Industry
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="text-primary font-semibold">T</span> Size
                  </span>
                </th>
                <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="text-primary font-semibold">T</span> Type
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((company, index) => {
                const isSelected = selectedRows.has(index);
                return (
                  <tr
                    key={index}
                    className={`border-b border-border/30 hover:bg-accent/30 transition-colors cursor-pointer ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                    onClick={() => toggleRow(index)}
                  >
                    <td className="px-4 py-3 text-muted-foreground tabular-nums text-xs">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 font-medium max-w-[180px]">
                      <div className="flex items-center gap-2">
                        <CompanyLogo domain={company.domain || company.website} name={company.name} />
                        <span className="truncate">{company.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground max-w-[260px]">
                      <span className="truncate block text-xs">
                        {company.description
                          ? company.description.length > 60
                            ? company.description.slice(0, 60) + '…'
                            : company.description
                          : '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3 max-w-[200px]">
                      <span className="truncate block text-xs">{company.industry || '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {formatSize(company.employee_count, company.employee_range)}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      {getTypeBadge([], company.industry)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </ScrollArea>

      {/* Bottom bar */}
      <div className="flex-shrink-0 px-5 py-3 border-t border-border/60 bg-muted/30 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {selectedRows.size > 0
            ? `${selectedRows.size} of ${results.length} selected`
            : `${results.length} results`}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExport} className="text-xs h-8 gap-1.5 border-border/60">
            <Download className="h-3 w-3" />
            Export CSV
          </Button>
          <Button
            size="sm"
            onClick={onSave}
            disabled={isSaving || selectedRows.size === 0}
            className="text-xs h-8 gap-1.5"
          >
            {isSaving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <Save className="h-3 w-3" />
            )}
            Import {selectedRows.size > 0 ? `${selectedRows.size} leads` : ''}
          </Button>
        </div>
      </div>
    </div>
  );
}
