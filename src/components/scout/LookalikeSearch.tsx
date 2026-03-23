import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Search, Download, ExternalLink, Target } from 'lucide-react';
import { b2bToolsApi, LookalikeCompany } from '@/lib/api/b2bTools';

export function LookalikeSearch() {
  const [domain, setDomain] = useState('');
  const [results, setResults] = useState<LookalikeCompany[]>([]);
  const [seedCompany, setSeedCompany] = useState<{ name: string; industry: string | null; employee_count: number | null } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const searchMutation = useMutation({
    mutationFn: () => b2bToolsApi.findLookalikes(domain.trim(), 25),
    onSuccess: (data) => {
      if (data.success && data.companies) {
        setResults(data.companies);
        setSeedCompany(data.seed_company || null);
        setHasSearched(true);
        toast.success(`Found ${data.companies.length} similar companies`);
      } else {
        toast.error(data.error || 'Search failed');
      }
    },
    onError: () => toast.error('Search failed'),
  });

  const handleExport = () => {
    const headers = ['Name', 'Domain', 'Industry', 'Employees', 'Similarity', 'City', 'State', 'Country', 'LinkedIn'];
    const rows = results.map(c => [
      c.name, c.domain, c.industry || '', c.employee_count?.toString() || '',
      `${c.similarity_score}%`, c.headquarters_city || '', c.headquarters_state || '',
      c.headquarters_country || '', c.linkedin_url || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `lookalikes-${domain}-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${results.length} companies`);
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Target className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium text-sm">Find similar companies</h3>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Enter a company domain to find businesses with similar firmographics, size, industry, and tech stack
          </p>

          <div className="flex gap-3 items-end">
            <div className="flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Company domain</Label>
              <Input
                value={domain}
                onChange={e => setDomain(e.target.value)}
                placeholder="e.g. hubspot.com"
                className="h-9 text-sm"
                onKeyDown={e => { if (e.key === 'Enter' && domain.trim()) searchMutation.mutate(); }}
              />
            </div>
            <Button
              onClick={() => searchMutation.mutate()}
              disabled={searchMutation.isPending || !domain.trim()}
              size="sm" className="gap-1.5 h-9"
            >
              {searchMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
              Find lookalikes
            </Button>
          </div>
        </CardContent>
      </Card>

      {seedCompany && (
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-muted/40 border border-border/40">
          <span className="text-xs text-muted-foreground">Seed:</span>
          <span className="text-sm font-medium">{seedCompany.name}</span>
          {seedCompany.industry && <Badge variant="secondary" className="text-[10px]">{seedCompany.industry}</Badge>}
          {seedCompany.employee_count && <Badge variant="outline" className="text-[10px]">{seedCompany.employee_count.toLocaleString()} employees</Badge>}
        </div>
      )}

      {hasSearched && (
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">{results.length} similar companies</span>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={handleExport}>
                <Download className="h-3 w-3" /> Export CSV
              </Button>
            </div>
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Company</TableHead>
                    <TableHead className="text-xs">Similarity</TableHead>
                    <TableHead className="text-xs">Industry</TableHead>
                    <TableHead className="text-xs">Employees</TableHead>
                    <TableHead className="text-xs">Location</TableHead>
                    <TableHead className="text-xs">Tech Stack</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((company, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        <div>
                          <span className="text-sm font-medium">{company.name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-xs text-muted-foreground">{company.domain}</span>
                            {company.linkedin_url && (
                              <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer">
                                <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground" />
                              </a>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className="w-12 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${company.similarity_score}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium">{company.similarity_score}%</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{company.industry || '—'}</TableCell>
                      <TableCell className="text-xs">{company.employee_count?.toLocaleString() || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {[company.headquarters_city, company.headquarters_state].filter(Boolean).join(', ') || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[180px]">
                          {(company.technologies || []).slice(0, 3).map(t => (
                            <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                          ))}
                          {(company.technologies || []).length > 3 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">+{company.technologies.length - 3}</Badge>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
