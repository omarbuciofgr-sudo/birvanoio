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
  Users,
  Calendar,
  DollarSign,
  MapPin,
} from 'lucide-react';
import { CompanyResult } from '@/lib/api/industrySearch';

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

function formatRevenue(revenue: number | null): string {
  if (!revenue) return '—';
  if (revenue >= 1_000_000_000) return `$${(revenue / 1_000_000_000).toFixed(1)}B`;
  if (revenue >= 1_000_000) return `$${(revenue / 1_000_000).toFixed(1)}M`;
  if (revenue >= 1_000) return `$${(revenue / 1_000).toFixed(0)}K`;
  return `$${revenue}`;
}

function formatEmployeeCount(count: number | null): string {
  if (!count) return '';
  return count.toLocaleString();
}

function getFaviconUrl(domain: string | null): string | null {
  if (!domain) return null;
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
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
            Or ask the AI assistant on the right to configure filters for you.
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
        <div className="flex items-center gap-2">
          <h3 className="font-display text-sm font-semibold">Results</h3>
          <Badge variant="secondary" className="text-[10px]">{results.length} companies</Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onExport} className="text-xs h-7">
            <Download className="h-3 w-3 mr-1" />
            Export
          </Button>
        </div>
      </div>

      {/* Table */}
      <ScrollArea className="flex-1">
        <div className="min-w-[1100px]">
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
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Company</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Domain</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Industry</th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  <div className="flex items-center gap-1"><Users className="h-3 w-3" /> Employees</div>
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  <div className="flex items-center gap-1"><DollarSign className="h-3 w-3" /> Revenue</div>
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  <div className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Founded</div>
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">
                  <div className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Location</div>
                </th>
                <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tech Stack</th>
                <th className="w-16 px-3 py-2 text-left font-medium text-muted-foreground">Links</th>
              </tr>
            </thead>
            <tbody>
              {results.map((company, index) => {
                const favicon = getFaviconUrl(company.domain);
                return (
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
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <div className="flex items-center gap-2">
                        {favicon ? (
                          <img
                            src={favicon}
                            alt=""
                            className="h-4 w-4 rounded-sm flex-shrink-0"
                            onError={(e) => {
                              (e.target as HTMLImageElement).style.display = 'none';
                            }}
                          />
                        ) : (
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <span className="font-medium truncate block">{company.name}</span>
                          {company.description && (
                            <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {company.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[120px] truncate">
                      {company.domain ? (
                        <a
                          href={`https://${company.domain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-primary hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {company.domain}
                        </a>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2.5 max-w-[120px] truncate">
                      {company.industry || '—'}
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex flex-col gap-0.5">
                        {company.employee_count ? (
                          <span className="font-medium">{formatEmployeeCount(company.employee_count)}</span>
                        ) : null}
                        {company.employee_range ? (
                          <Badge
                            variant="secondary"
                            className={`text-[10px] px-1.5 py-0 w-fit ${getEmployeeBadgeColor(company.employee_range)}`}
                          >
                            {company.employee_range}
                          </Badge>
                        ) : !company.employee_count ? '—' : null}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 font-medium">
                      {formatRevenue(company.annual_revenue)}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground">
                      {company.founded_year || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground max-w-[150px] truncate">
                      {[company.headquarters_city, company.headquarters_state, company.headquarters_country]
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </td>
                    <td className="px-3 py-2.5 max-w-[150px]">
                      {company.technologies && company.technologies.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {company.technologies.slice(0, 3).map((tech, i) => (
                            <Badge key={i} variant="outline" className="text-[9px] px-1 py-0">
                              {tech}
                            </Badge>
                          ))}
                          {company.technologies.length > 3 && (
                            <Badge variant="outline" className="text-[9px] px-1 py-0">
                              +{company.technologies.length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : '—'}
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
                );
              })}
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
