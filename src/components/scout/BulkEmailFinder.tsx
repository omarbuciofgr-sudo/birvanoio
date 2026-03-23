import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { Loader2, Mail, Download, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { b2bToolsApi, EmailFinderContact, EmailFinderResult } from '@/lib/api/b2bTools';

export function BulkEmailFinder() {
  const [inputMode, setInputMode] = useState<'text' | 'csv'>('text');
  const [textInput, setTextInput] = useState('');
  const [verify, setVerify] = useState(false);
  const [results, setResults] = useState<EmailFinderResult[]>([]);
  const [summary, setSummary] = useState<{ total: number; found: number; not_found: number } | null>(null);
  const [hasSearched, setHasSearched] = useState(false);

  const parseContacts = (): EmailFinderContact[] => {
    return textInput
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        const parts = line.split(/[,\t]+/).map(p => p.trim());
        return {
          first_name: parts[0] || '',
          last_name: parts[1] || '',
          domain: parts[2] || '',
          company: parts[3] || undefined,
        };
      })
      .filter(c => c.first_name && c.last_name && c.domain);
  };

  const findMutation = useMutation({
    mutationFn: () => {
      const contacts = parseContacts();
      if (contacts.length === 0) {
        toast.error('No valid contacts found');
        return Promise.reject('No contacts');
      }
      return b2bToolsApi.bulkFindEmails(contacts, verify);
    },
    onSuccess: (data) => {
      if (data.success && data.results) {
        setResults(data.results);
        setSummary(data.summary || null);
        setHasSearched(true);
        toast.success(`Found ${data.summary?.found || 0} emails out of ${data.summary?.total || 0} contacts`);
      } else {
        toast.error(data.error || 'Email finder failed');
      }
    },
    onError: () => toast.error('Email finder failed'),
  });

  const handleExport = () => {
    const headers = ['First Name', 'Last Name', 'Domain', 'Email', 'Confidence', 'Source', 'Verified'];
    const rows = results.map(r => [
      r.first_name, r.last_name, r.domain, r.email || '', r.confidence.toString(),
      r.source, r.verified ? 'Yes' : 'No',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `email-finder-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success(`Exported ${results.length} results`);
  };

  const contactCount = parseContacts().length;

  return (
    <div className="space-y-4">
      <Card className="border-border/60">
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-medium text-sm">Bulk Email Finder</h3>
          </div>
          <p className="text-xs text-muted-foreground -mt-2">
            Find email addresses for a list of contacts. Format: First Name, Last Name, Domain (one per line)
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Contacts (First, Last, Domain — one per line)</Label>
            <Textarea
              value={textInput}
              onChange={e => setTextInput(e.target.value)}
              placeholder="John, Smith, acme.com&#10;Jane, Doe, company.io&#10;Mike, Johnson, startup.co"
              className="min-h-[140px] text-sm font-mono"
            />
            <p className="text-[10px] text-muted-foreground">{contactCount} contact{contactCount !== 1 ? 's' : ''} • max 100</p>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Switch checked={verify} onCheckedChange={setVerify} />
              <Label className="text-xs">Verify emails (uses verification credits)</Label>
            </div>
            <Button
              onClick={() => findMutation.mutate()}
              disabled={findMutation.isPending || contactCount === 0}
              size="sm" className="gap-1.5"
            >
              {findMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}
              Find emails
            </Button>
          </div>
        </CardContent>
      </Card>

      {hasSearched && (
        <Card className="border-border/60">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                {summary && (
                  <>
                    <Badge variant="default" className="text-[10px] gap-1">
                      <CheckCircle className="h-2.5 w-2.5" /> {summary.found} found
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] gap-1">
                      <XCircle className="h-2.5 w-2.5" /> {summary.not_found} not found
                    </Badge>
                  </>
                )}
              </div>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={handleExport}>
                <Download className="h-3 w-3" /> Export CSV
              </Button>
            </div>
            <ScrollArea className="max-h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Name</TableHead>
                    <TableHead className="text-xs">Domain</TableHead>
                    <TableHead className="text-xs">Email</TableHead>
                    <TableHead className="text-xs">Confidence</TableHead>
                    <TableHead className="text-xs">Source</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {results.map((result, i) => (
                    <TableRow key={i} className={!result.email ? 'opacity-50' : ''}>
                      <TableCell className="text-sm font-medium">{result.first_name} {result.last_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground font-mono">{result.domain}</TableCell>
                      <TableCell className="text-xs font-mono">{result.email || '—'}</TableCell>
                      <TableCell>
                        {result.email ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-10 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${result.confidence > 80 ? 'bg-green-500' : result.confidence > 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                style={{ width: `${result.confidence}%` }}
                              />
                            </div>
                            <span className="text-[10px]">{result.confidence}%</span>
                          </div>
                        ) : '—'}
                      </TableCell>
                      <TableCell><Badge variant="outline" className="text-[9px] px-1.5 py-0">{result.source}</Badge></TableCell>
                      <TableCell>
                        {result.email ? (
                          result.verified ? (
                            <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                          ) : (
                            <AlertCircle className="h-3.5 w-3.5 text-yellow-500" />
                          )
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
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
