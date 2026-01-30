import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { 
  Copy, 
  Merge, 
  Loader2, 
  AlertTriangle, 
  Mail, 
  Phone, 
  Globe,
  Check,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface DuplicateGroup {
  matchField: 'email' | 'phone' | 'domain';
  matchValue: string;
  leads: Array<{
    id: string;
    domain: string;
    full_name: string | null;
    best_email: string | null;
    best_phone: string | null;
    lead_score: number | null;
    status: string;
    created_at: string;
  }>;
}

export function LeadDeduplicationPanel() {
  const queryClient = useQueryClient();
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());

  // Fetch potential duplicates
  const { data: duplicates = [], isLoading, refetch } = useQuery({
    queryKey: ['lead-duplicates'],
    queryFn: async () => {
      // Get all leads with emails and phones
      const { data: leads, error } = await supabase
        .from('scraped_leads')
        .select('id, domain, full_name, best_email, best_phone, lead_score, status, created_at')
        .eq('is_suppressed', false)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const groups: DuplicateGroup[] = [];
      const emailMap = new Map<string, typeof leads>();
      const phoneMap = new Map<string, typeof leads>();
      const domainMap = new Map<string, typeof leads>();

      // Group by normalized email
      leads?.forEach(lead => {
        if (lead.best_email) {
          const normalizedEmail = lead.best_email.toLowerCase().trim();
          if (!emailMap.has(normalizedEmail)) {
            emailMap.set(normalizedEmail, []);
          }
          emailMap.get(normalizedEmail)!.push(lead);
        }
      });

      // Group by normalized phone
      leads?.forEach(lead => {
        if (lead.best_phone) {
          const normalizedPhone = lead.best_phone.replace(/\D/g, '').slice(-10);
          if (normalizedPhone.length >= 10) {
            if (!phoneMap.has(normalizedPhone)) {
              phoneMap.set(normalizedPhone, []);
            }
            phoneMap.get(normalizedPhone)!.push(lead);
          }
        }
      });

      // Group by domain (excluding real estate property addresses)
      leads?.forEach(lead => {
        if (lead.domain && !lead.domain.includes('-') && lead.domain.includes('.')) {
          const normalizedDomain = lead.domain.toLowerCase().trim();
          if (!domainMap.has(normalizedDomain)) {
            domainMap.set(normalizedDomain, []);
          }
          domainMap.get(normalizedDomain)!.push(lead);
        }
      });

      // Add email duplicates
      emailMap.forEach((matchedLeads, email) => {
        if (matchedLeads.length > 1) {
          groups.push({
            matchField: 'email',
            matchValue: email,
            leads: matchedLeads,
          });
        }
      });

      // Add phone duplicates (only if not already in email group)
      const seenIds = new Set(groups.flatMap(g => g.leads.map(l => l.id)));
      phoneMap.forEach((matchedLeads, phone) => {
        const uniqueLeads = matchedLeads.filter(l => !seenIds.has(l.id));
        if (uniqueLeads.length > 1) {
          groups.push({
            matchField: 'phone',
            matchValue: phone,
            leads: matchedLeads,
          });
        }
      });

      return groups;
    },
  });

  const mergeMutation = useMutation({
    mutationFn: async (group: DuplicateGroup) => {
      const { data, error } = await supabase.functions.invoke('dedupe-leads', {
        body: {
          lead_ids: group.leads.map(l => l.id),
          match_reason: `${group.matchField}: ${group.matchValue}`,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Leads merged successfully');
      queryClient.invalidateQueries({ queryKey: ['lead-duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['scraped-leads'] });
    },
    onError: (error) => {
      toast.error('Merge failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    },
  });

  const getMatchIcon = (field: 'email' | 'phone' | 'domain') => {
    switch (field) {
      case 'email': return <Mail className="h-4 w-4" />;
      case 'phone': return <Phone className="h-4 w-4" />;
      case 'domain': return <Globe className="h-4 w-4" />;
    }
  };

  const getMatchColor = (field: 'email' | 'phone' | 'domain') => {
    switch (field) {
      case 'email': return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
      case 'phone': return 'bg-green-500/10 text-green-600 dark:text-green-400';
      case 'domain': return 'bg-purple-500/10 text-purple-600 dark:text-purple-400';
    }
  };

  const toggleGroup = (key: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(key)) {
      newSelected.delete(key);
    } else {
      newSelected.add(key);
    }
    setSelectedGroups(newSelected);
  };

  const mergeSelected = async () => {
    const groupsToMerge = duplicates.filter((_, i) => selectedGroups.has(String(i)));
    for (const group of groupsToMerge) {
      await mergeMutation.mutateAsync(group);
    }
    setSelectedGroups(new Set());
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5" />
              Lead Deduplication
            </CardTitle>
            <CardDescription>
              {duplicates.length} potential duplicate groups found
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              Scan Again
            </Button>
            {selectedGroups.size > 0 && (
              <Button 
                size="sm" 
                onClick={mergeSelected}
                disabled={mergeMutation.isPending}
              >
                {mergeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Merge className="h-4 w-4 mr-2" />
                )}
                Merge Selected ({selectedGroups.size})
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {duplicates.length === 0 ? (
          <Alert>
            <Check className="h-4 w-4" />
            <AlertDescription>
              No duplicate leads found. Your data is clean!
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {duplicates.map((group, index) => (
              <div 
                key={`${group.matchField}-${group.matchValue}`}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Checkbox
                      checked={selectedGroups.has(String(index))}
                      onCheckedChange={() => toggleGroup(String(index))}
                    />
                    <Badge className={getMatchColor(group.matchField)}>
                      {getMatchIcon(group.matchField)}
                      <span className="ml-1">{group.matchField}</span>
                    </Badge>
                    <code className="text-sm bg-muted px-2 py-0.5 rounded">
                      {group.matchValue}
                    </code>
                    <span className="text-sm text-muted-foreground">
                      {group.leads.length} matches
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => mergeMutation.mutate(group)}
                    disabled={mergeMutation.isPending}
                  >
                    <Merge className="h-4 w-4 mr-1" />
                    Merge
                  </Button>
                </div>

                <div className="ml-7 space-y-2">
                  {group.leads.map((lead, leadIndex) => (
                    <div 
                      key={lead.id}
                      className={`flex items-center justify-between text-sm p-2 rounded ${
                        leadIndex === 0 ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-muted/50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {leadIndex === 0 && (
                          <Badge variant="outline" className="text-xs">Primary</Badge>
                        )}
                        <span className="font-medium">{lead.domain}</span>
                        {lead.full_name && (
                          <span className="text-muted-foreground">• {lead.full_name}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-muted-foreground">
                        {lead.lead_score && (
                          <span>Score: {lead.lead_score}</span>
                        )}
                        <span>{format(new Date(lead.created_at), 'MMM d, yyyy')}</span>
                        <Badge variant="outline" className="text-xs">{lead.status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
