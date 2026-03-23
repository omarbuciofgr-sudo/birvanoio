import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Search, Download, Save, Cpu, ExternalLink } from 'lucide-react';
import { b2bToolsApi, TechSearchInput } from '@/lib/api/b2bTools';

const COMMON_TECHNOLOGIES = [
  'Salesforce', 'HubSpot', 'WordPress', 'Shopify', 'React', 'AWS',
  'Google Analytics', 'Stripe', 'Intercom', 'Zendesk', 'Slack',
  'Marketo', 'Segment', 'Cloudflare', 'Vercel', 'Tailwind CSS',
  'Vue.js', 'Angular', 'Drift', 'Mixpanel', 'Hotjar',
];

export function TechnographicsSearch() {
  const [selectedTech, setSelectedTech] = useState<string[]>([]);
  const [customTech, setCustomTech] = useState('');
  const [industry, setIndustry] = useState('');
  const [location, setLocation] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  const searchMutation = useMutation({
    mutationFn: () => {
      const technologies = [...selectedTech];
      if (customTech.trim()) technologies.push(...customTech.split(',').map(t => t.trim()).filter(Boolean));
      return b2bToolsApi.searchByTechnology({
        technologies,
        industry: industry || undefined,
        location: location || undefined,
        limit: 25,
      });
    },
    onSuccess: (data) => {
      if (data.success && data.companies) {
        setResults(data.companies);
        setSelectedRows(new Set());
        setHasSearched(true);
        toast.success(`Found ${data.companies.length} companies`);
      } else {
        toast.error(data.error || 'Search failed');
      }
    },
    onError: () => toast.error('Search failed'),
  });

  const toggleTech = (tech: string) => {
    setSelectedTech(prev => prev.includes(tech) ? prev.filter(t => t !== tech) : [...prev, tech]);
  };

  const handleExport = () => {
    const selected = selectedRows.size > 0 ? results.filter((_, i) => selectedRows.has(i)) : results;
    const headers = ['Name', 'Domain', 'Industry', 'Employees', 'City', 'State', 'Country', 'Technologies', 'LinkedIn'];
    const rows = selected.map(c => [
      c.name, c.domain, c.industry || '', c.employee_count?.toString() || '',
      c.headquarters_city || '', c.headquarters_state || '', c.headquarters_country || '',
      (c.technologies || []).join('; '), c.linkedin_url || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `tech-search-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${selected.length} companies`);
  };

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium text-sm">Find companies by technology stack</h3>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Discover companies using specific tools, platforms, or frameworks
          </p>

          <div>
            <Label className="text-xs text-muted-foreground">Select technologies</Label>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {COMMON_TECHNOLOGIES.map(tech => (
                <button
                  key={tech}
                  onClick={() => toggleTech(tech)}
                  className={`px-2.5 py-1 rounded-md text-xs border transition-colors ${
                    selectedTech.includes(tech)
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border/60 hover:bg-muted/60 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {tech}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Custom technologies</Label>
              <Input
                value={customTech}
                onChange={e => setCustomTech(e.target.value)}
                placeholder="e.g. Notion, Figma, Jira"
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Industry (optional)</Label>
              <Input value={industry} onChange={e => setIndustry(e.target.value)} placeholder="e.g. SaaS" className="h-9 text-sm" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Location (optional)</Label>
              <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="e.g. United States" className="h-9 text-sm" />
            </div>
          </div>

          <Button
            onClick={() => searchMutation.mutate()}
            disabled={searchMutation.isPending || (selectedTech.length === 0 && !customTech.trim())}
            size="sm" className="gap-1.5"
          >
            {searchMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Search className="h-3.5 w-3.5" />}
            Search by tech stack
          </Button>
        </CardContent>
      </Card>

      {hasSearched && (
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs text-muted-foreground">{results.length} companies found</span>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={handleExport}>
                  <Download className="h-3 w-3" /> Export CSV
                </Button>
              </div>
            </div>
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"><Checkbox checked={selectedRows.size === results.length && results.length > 0} onCheckedChange={() => setSelectedRows(prev => prev.size === results.length ? new Set() : new Set(results.map((_, i) => i)))} /></TableHead>
                    <TableHead className="text-xs">Company</TableHead>
                    <TableHead className="text-xs">Industry</TableHead>
                    <TableHead className="text-xs">Employees</TableHead>
                    <TableHead className="text-xs">Location</TableHead>
                    <TableHead className="text-xs">Technologies</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((company, i) => (
                    <TableRow key={i}>
                      <TableCell><Checkbox checked={selectedRows.has(i)} onCheckedChange={() => setSelectedRows(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; })} /></TableCell>
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
                      <TableCell className="text-xs text-muted-foreground">{company.industry || '—'}</TableCell>
                      <TableCell className="text-xs">{company.employee_count?.toLocaleString() || '—'}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {[company.headquarters_city, company.headquarters_state].filter(Boolean).join(', ') || '—'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {(company.technologies || []).slice(0, 3).map((t: string) => (
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
