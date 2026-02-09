import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Building2,
  Download,
  Save,
  Loader2,
  Globe,
  Linkedin,
  ExternalLink,
} from 'lucide-react';
import { CompanyResult } from '@/lib/api/industrySearch';
import { INDUSTRIES } from './constants';

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

function getEmployeeBadgeColor(range: string | null): string {
  if (!range) return 'bg-muted text-muted-foreground';
  if (range.includes('1-10') || range.includes('2-10')) return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300';
  if (range.includes('11-50')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300';
  if (range.includes('51-200')) return 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300';
  if (range.includes('201-500')) return 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300';
  if (range.includes('501') || range.includes('1000') || range.includes('5000')) return 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300';
  return 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300';
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

  const toggleAll = () => {
    if (selectedRows.size === results.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(results.map((_, i) => i)));
    }
  };

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">Searching companies...</p>
        </div>
      </div>
    );
  }

  if (!hasSearched) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3 max-w-xs">
          <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <h3 className="font-display text-sm font-semibold text-muted-foreground">Preview</h3>
          <p className="text-xs text-muted-foreground">
            Select your filters on the left and click "Find Companies" to see results here.
            Use the chat on the right for guidance.
          </p>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center space-y-3">
          <Building2 className="h-10 w-10 text-muted-foreground/40 mx-auto" />
          <h3 className="font-display text-sm font-semibold text-muted-foreground">No results</h3>
          <p className="text-xs text-muted-foreground">Try broadening your filters.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="font-display text-sm font-semibold">Preview</h3>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExport} className="text-xs h-7">
            <Download className="h-3 w-3 mr-1" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="min-w-[700px]">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
              <tr className="border-b border-border">
                <th className="w-10 px-3 py-2 text-left">
                  <Checkbox
                    checked={selectedRows.size === results.length && results.length > 0}
                    onCheckedChange={toggleAll}
                  />
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">#</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Name</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Description</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Industry</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Size</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Location</th>
                <th className="w-16 px-3 py-2 text-left font-medium text-muted-foreground">Links</th>
              </tr>
            </thead>
            <tbody>
              {results.map((company, index) => (
                <tr
                  key={index}
                  className={`border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer ${
                    selectedRows.has(index) ? 'bg-primary/5' : ''
                  }`}
                  onClick={() => toggleRow(index)}
                >
                  <td className="px-3 py-2.5">
                    <Checkbox
                      checked={selectedRows.has(index)}
                      onCheckedChange={() => toggleRow(index)}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground">{index + 1}</td>
                  <td className="px-3 py-2.5 font-medium max-w-[180px] truncate">
                    <div className="flex items-center gap-1.5">
                      <Building2 className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                      {company.name}
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[200px] truncate">
                    {company.description || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {company.industry || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    {company.employee_range ? (
                      <Badge
                        variant="secondary"
                        className={`text-[10px] px-1.5 py-0 ${getEmployeeBadgeColor(company.employee_range)}`}
                      >
                        {company.employee_range}
                      </Badge>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground max-w-[150px] truncate">
                    {[company.headquarters_city, company.headquarters_state]
                      .filter(Boolean)
                      .join(', ') || '—'}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-1">
                      {company.website && (
                        <a
                          href={company.website}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Globe className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {company.linkedin_url && (
                        <a
                          href={company.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-muted-foreground hover:text-primary"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Linkedin className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ScrollArea>

      {/* Bottom bar */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-border bg-muted/30 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Previewing {results.length} results.{' '}
          {selectedRows.size > 0
            ? `${selectedRows.size} will be imported.`
            : 'Select rows to import.'}
        </p>
        <Button
          size="sm"
          onClick={onSave}
          disabled={isSaving || selectedRows.size === 0}
          className="text-xs h-8"
        >
          {isSaving ? (
            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
          ) : (
            <Save className="h-3 w-3 mr-1" />
          )}
          Save {selectedRows.size > 0 ? `${selectedRows.size} rows` : ''}
        </Button>
      </div>
    </div>
  );
}
