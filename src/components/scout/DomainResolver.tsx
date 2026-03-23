import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Globe, Download, ExternalLink } from 'lucide-react';
import { b2bToolsApi, DomainCompanyProfile } from '@/lib/api/b2bTools';

export function DomainResolver() {
  const [domainsInput, setDomainsInput] = useState('');
  const [results, setResults] = useState<DomainCompanyProfile[]>([]);
  const [hasSearched, setHasSearched] = useState(false);

  const resolveMutation = useMutation({
    mutationFn: () => {
      const domains = domainsInput
        .split(/[\n,;]+/)
        .map(d => d.trim())
        .filter(Boolean);
      return b2bToolsApi.resolveDomainsToCompanies(domains);
    },
    onSuccess: (data) => {
      if (data.success && data.companies) {
        setResults(data.companies);
        setHasSearched(true);
        toast.success(`Resolved ${data.resolved} of ${data.total} domains`);
      } else {
        toast.error(data.error || 'Resolution failed');
      }
    },
    onError: () => toast.error('Resolution failed'),
  });

  const handleExport = () => {
    const headers = ['Domain', 'Name', 'Industry', 'Employees', 'Revenue', 'Founded', 'City', 'State', 'Country', 'LinkedIn', 'Phone', 'Technologies', 'Sources'];
    const rows = results.map(c => [
      c.domain, c.name || '', c.industry || '', c.employee_count?.toString() || '',
      c.annual_revenue?.toString() || '', c.founded_year?.toString() || '',
      c.headquarters_city || '', c.headquarters_state || '', c.headquarters_country || '',
      c.linkedin_url || '', c.phone || '', (c.technologies || []).join('; '),
      (c.source_providers || []).join(', '),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `domain-resolve-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${results.length} companies`);
  };

  const domainCount = domainsInput.split(/[\n,;]+/).map(d => d.trim()).filter(Boolean).length;

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Globe className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium text-sm">Domain → Company resolver</h3>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Paste a list of domains to get full company profiles with enrichment from multiple providers
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Domains (one per line, or comma-separated)</Label>
            <Textarea
              value={domainsInput}
              onChange={e => setDomainsInput(e.target.value)}
              placeholder="hubspot.com&#10;stripe.com&#10;notion.so"
              className="min-h-[120px] text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground">{domainCount} domain{domainCount !== 1 ? 's' : ''} • max 50</p>
          </div>

          <Button
            onClick={() => resolveMutation.mutate()}
            disabled={resolveMutation.isPending || domainCount === 0}
            size="sm" className="gap-1.5"
          >
            {resolveMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Globe className="h-3.5 w-3.5" />}
            Resolve domains
          </Button>
        </CardContent>
      </Card>

      {hasSearched && (
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">
                {results.filter(r => r.name).length} resolved of {results.length} domains
              </span>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={handleExport}>
                <Download className="h-3 w-3" /> Export CSV
              </Button>
            </div>
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Domain</TableHead>
                    <TableHead className="text-xs">Company</TableHead>
                    <TableHead className="text-xs">Industry</TableHead>
                    <TableHead className="text-xs">Employees</TableHead>
                    <TableHead className="text-xs">Location</TableHead>
                    <TableHead className="text-xs">Phone</TableHead>
                    <TableHead className="text-xs">Sources</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((company, i) => (
                    <TableRow key={i} className={!company.name ? 'opacity-50' : ''}>
                      <TableCell className="text-xs font-mono">{company.domain}</TableCell>
                      <TableCell>
                        <div>
                          <span className="text-sm font-medium">{company.name || '—'}</span>
                          {company.linkedin_url && (
                            <a href={company.linkedin_url} target="_blank" rel="noopener noreferrer" className="ml-1.5">
                              <ExternalLink className="h-3 w-3 text-muted-foreground hover:text-foreground inline" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{company.industry || '—'}</TableCell>
                      <TableCell className="text-xs">{company.employee_count?.toLocaleString() || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {[company.headquarters_city, company.headquarters_state].filter(Boolean).join(', ') || '—'}
                      </TableCell>
                      <TableCell className="text-xs">{company.phone || '—'}</TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {(company.source_providers || []).map(s => (
                            <Badge key={s} variant="outline" className="text-[9px] px-1 py-0">{s}</Badge>
                          ))}
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
