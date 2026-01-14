import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import {
  prospectSearchApi,
  ProspectSearchParams,
  ProspectResult,
  INDUSTRIES,
  DECISION_MAKER_TITLES,
  SENIORITY_LEVELS,
  US_STATES,
} from '@/lib/api/prospectSearch';
import { toast } from 'sonner';
import {
  Search,
  Users,
  Building2,
  MapPin,
  Mail,
  Phone,
  Linkedin,
  Download,
  Save,
  Loader2,
  Target,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

const quickSearchSchema = z.object({
  query: z.string().min(3, 'Enter at least 3 characters'),
});

const advancedSearchSchema = z.object({
  industry: z.string().min(1, 'Select an industry'),
  city: z.string().optional(),
  state: z.string().optional(),
  targetTitles: z.array(z.string()).optional(),
  employeeCountMax: z.number().optional(),
  limit: z.number().min(1).max(100).default(25),
});

type QuickSearchForm = z.infer<typeof quickSearchSchema>;
type AdvancedSearchForm = z.infer<typeof advancedSearchSchema>;

interface ProspectSearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaveProspects?: (prospects: ProspectResult[]) => void;
}

export function ProspectSearchDialog({ 
  open, 
  onOpenChange,
  onSaveProspects,
}: ProspectSearchDialogProps) {
  const [searchMode, setSearchMode] = useState<'quick' | 'advanced'>('quick');
  const [results, setResults] = useState<ProspectResult[]>([]);
  const [selectedProspects, setSelectedProspects] = useState<Set<number>>(new Set());
  const [hasSearched, setHasSearched] = useState(false);

  const quickForm = useForm<QuickSearchForm>({
    resolver: zodResolver(quickSearchSchema),
    defaultValues: { query: '' },
  });

  const advancedForm = useForm<AdvancedSearchForm>({
    resolver: zodResolver(advancedSearchSchema),
    defaultValues: {
      industry: '',
      city: '',
      state: '',
      targetTitles: [],
      employeeCountMax: undefined,
      limit: 25,
    },
  });

  const searchMutation = useMutation({
    mutationFn: async (params: ProspectSearchParams) => {
      return prospectSearchApi.search(params);
    },
    onSuccess: (response) => {
      if (response.success && response.data) {
        setResults(response.data);
        setSelectedProspects(new Set());
        setHasSearched(true);
        toast.success(`Found ${response.data.length} prospects`);
      } else {
        toast.error(response.error || 'Search failed');
      }
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : 'Search failed');
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (prospects: ProspectResult[]) => {
      return prospectSearchApi.saveProspectsAsLeads(prospects);
    },
    onSuccess: (result) => {
      if (result.success) {
        toast.success(`Saved ${result.savedCount} leads to database`);
        onSaveProspects?.(results.filter((_, i) => selectedProspects.has(i)));
      } else {
        toast.error(result.error || 'Failed to save leads');
      }
    },
  });

  const handleQuickSearch = (data: QuickSearchForm) => {
    const parsed = prospectSearchApi.parseSearchQuery(data.query);
    searchMutation.mutate({
      ...parsed,
      searchType: 'hybrid',
      limit: 25,
      enrichWebResults: true,
    });
  };

  const handleAdvancedSearch = (data: AdvancedSearchForm) => {
    searchMutation.mutate({
      industry: data.industry,
      location: {
        city: data.city || undefined,
        state: data.state || undefined,
        country: 'USA',
      },
      targetTitles: data.targetTitles?.length ? data.targetTitles : undefined,
      employeeCountMax: data.employeeCountMax || undefined,
      searchType: 'hybrid',
      limit: data.limit,
      enrichWebResults: true,
    });
  };

  const handleSelectAll = () => {
    if (selectedProspects.size === results.length) {
      setSelectedProspects(new Set());
    } else {
      setSelectedProspects(new Set(results.map((_, i) => i)));
    }
  };

  const handleSaveSelected = () => {
    const selectedResults = results.filter((_, i) => selectedProspects.has(i));
    if (selectedResults.length === 0) {
      toast.error('Select at least one prospect to save');
      return;
    }
    saveMutation.mutate(selectedResults);
  };

  const exportToCsv = () => {
    const selectedResults = selectedProspects.size > 0 
      ? results.filter((_, i) => selectedProspects.has(i))
      : results;

    const headers = [
      'Full Name', 'Email', 'Phone', 'Mobile', 'Job Title', 'Company',
      'Domain', 'Industry', 'City', 'State', 'LinkedIn', 'Confidence'
    ];
    
    const rows = selectedResults.map(p => [
      p.full_name || '',
      p.email || '',
      p.phone || '',
      p.mobile_phone || '',
      p.job_title || '',
      p.company_name || '',
      p.company_domain || '',
      p.industry || '',
      p.headquarters_city || '',
      p.headquarters_state || '',
      p.linkedin_url || '',
      p.confidence_score.toString(),
    ]);

    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast.success(`Exported ${selectedResults.length} prospects to CSV`);
  };

  const getConfidenceBadge = (score: number) => {
    if (score >= 70) return <Badge variant="default" className="bg-green-500">High</Badge>;
    if (score >= 40) return <Badge variant="secondary">Medium</Badge>;
    return <Badge variant="outline">Low</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            Prospect Search
          </DialogTitle>
          <DialogDescription>
            Find decision-makers by industry, location, and title — like ZoomInfo
          </DialogDescription>
        </DialogHeader>

        <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as 'quick' | 'advanced')} className="flex-1 flex flex-col">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="quick">
              <Sparkles className="h-4 w-4 mr-2" />
              Quick Search
            </TabsTrigger>
            <TabsTrigger value="advanced">
              <Search className="h-4 w-4 mr-2" />
              Advanced Search
            </TabsTrigger>
          </TabsList>

          {/* Quick Search */}
          <TabsContent value="quick" className="mt-4">
            <Form {...quickForm}>
              <form onSubmit={quickForm.handleSubmit(handleQuickSearch)} className="space-y-4">
                <FormField
                  control={quickForm.control}
                  name="query"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Search</FormLabel>
                      <FormControl>
                        <div className="flex gap-2">
                          <Input
                            placeholder="e.g., roofing companies in Houston, Texas"
                            {...field}
                            className="flex-1"
                          />
                          <Button type="submit" disabled={searchMutation.isPending}>
                            {searchMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Search className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </FormControl>
                      <FormDescription>
                        Enter your niche and location — we'll find decision-makers for you
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </form>
            </Form>

            <div className="mt-4 flex flex-wrap gap-2">
              <p className="text-sm text-muted-foreground w-full mb-1">Try these:</p>
              {[
                'Roofing contractors in Dallas, TX',
                'HVAC companies in Atlanta, GA',
                'Real estate agents in Miami, FL',
                'Law firms in Chicago, IL',
              ].map((example) => (
                <Button
                  key={example}
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    quickForm.setValue('query', example);
                    quickForm.handleSubmit(handleQuickSearch)();
                  }}
                >
                  {example}
                </Button>
              ))}
            </div>
          </TabsContent>

          {/* Advanced Search */}
          <TabsContent value="advanced" className="mt-4">
            <Form {...advancedForm}>
              <form onSubmit={advancedForm.handleSubmit(handleAdvancedSearch)} className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <FormField
                    control={advancedForm.control}
                    name="industry"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Industry *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select industry" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {INDUSTRIES.map((ind) => (
                              <SelectItem key={ind} value={ind}>{ind}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={advancedForm.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>City</FormLabel>
                        <FormControl>
                          <Input placeholder="e.g., Houston" {...field} />
                        </FormControl>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={advancedForm.control}
                    name="state"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>State</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select state" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">Any State</SelectItem>
                            {US_STATES.map((state) => (
                              <SelectItem key={state} value={state}>{state}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={advancedForm.control}
                    name="limit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Max Results</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 25)}
                          />
                        </FormControl>
                      </FormItem>
                    )}
                  />
                </div>

                <div>
                  <FormLabel className="mb-2 block">Target Titles</FormLabel>
                  <div className="flex flex-wrap gap-2">
                    {DECISION_MAKER_TITLES.slice(0, 8).map((title) => {
                      const isSelected = advancedForm.watch('targetTitles')?.includes(title);
                      return (
                        <Badge
                          key={title}
                          variant={isSelected ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => {
                            const current = advancedForm.getValues('targetTitles') || [];
                            if (isSelected) {
                              advancedForm.setValue('targetTitles', current.filter(t => t !== title));
                            } else {
                              advancedForm.setValue('targetTitles', [...current, title]);
                            }
                          }}
                        >
                          {title}
                        </Badge>
                      );
                    })}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Click to select target job titles (leave empty for auto-selection)
                  </p>
                </div>

                <Button type="submit" disabled={searchMutation.isPending}>
                  {searchMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Searching...
                    </>
                  ) : (
                    <>
                      <Search className="h-4 w-4 mr-2" />
                      Search Prospects
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </TabsContent>
        </Tabs>

        {/* Results */}
        {hasSearched && (
          <>
            <Separator className="my-4" />
            
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">
                  {results.length} Prospects Found
                </span>
                {selectedProspects.size > 0 && (
                  <Badge variant="secondary">{selectedProspects.size} selected</Badge>
                )}
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedProspects.size === results.length ? 'Deselect All' : 'Select All'}
                </Button>
                <Button variant="outline" size="sm" onClick={exportToCsv}>
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
                <Button size="sm" onClick={handleSaveSelected} disabled={saveMutation.isPending}>
                  <Save className="h-4 w-4 mr-1" />
                  Save to Leads
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 max-h-[300px]">
              <div className="space-y-2">
                {results.map((prospect, index) => (
                  <Card 
                    key={index} 
                    className={`cursor-pointer transition-colors ${
                      selectedProspects.has(index) ? 'border-primary bg-primary/5' : ''
                    }`}
                    onClick={() => {
                      const newSelected = new Set(selectedProspects);
                      if (newSelected.has(index)) {
                        newSelected.delete(index);
                      } else {
                        newSelected.add(index);
                      }
                      setSelectedProspects(newSelected);
                    }}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <Checkbox 
                            checked={selectedProspects.has(index)}
                            onCheckedChange={() => {}}
                          />
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {prospect.full_name || 'Unknown Contact'}
                              </span>
                              {prospect.job_title && (
                                <Badge variant="secondary">{prospect.job_title}</Badge>
                              )}
                              {getConfidenceBadge(prospect.confidence_score)}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {prospect.company_name && (
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-3 w-3" />
                                  {prospect.company_name}
                                </span>
                              )}
                              {(prospect.headquarters_city || prospect.headquarters_state) && (
                                <span className="flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {[prospect.headquarters_city, prospect.headquarters_state].filter(Boolean).join(', ')}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                          {prospect.email && (
                            <a 
                              href={`mailto:${prospect.email}`}
                              className="flex items-center gap-1 text-primary hover:underline"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Mail className="h-3 w-3" />
                              {prospect.email}
                            </a>
                          )}
                          {prospect.phone && (
                            <a 
                              href={`tel:${prospect.phone}`}
                              className="flex items-center gap-1 text-muted-foreground hover:text-foreground"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Phone className="h-3 w-3" />
                              {prospect.phone}
                            </a>
                          )}
                          {prospect.linkedin_url && (
                            <a 
                              href={prospect.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:text-blue-700"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <Linkedin className="h-4 w-4" />
                            </a>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}

                {results.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                    <p>No prospects found. Try adjusting your search criteria.</p>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
