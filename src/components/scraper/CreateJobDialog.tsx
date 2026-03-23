import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
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
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { scrapeJobsApi } from '@/lib/api/scraper';
import { SchemaTemplate, CreateScrapeJobInput } from '@/types/scraper';
import { toast } from 'sonner';
import { Upload, Link, FileText } from 'lucide-react';
import { JobCostEstimate } from './JobCostEstimate';
import { usePlanLimits } from '@/hooks/usePlanLimits';

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  schema_template_id: z.string().optional(),
  max_pages_per_domain: z.number().min(1).max(100).default(10),
  respect_robots_txt: z.boolean().default(true),
  use_playwright_fallback: z.boolean().default(true),
  request_delay_ms: z.number().min(0).max(10000).default(1000),
});

type FormData = z.infer<typeof formSchema>;

interface CreateJobDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: SchemaTemplate[];
}

export function CreateJobDialog({ open, onOpenChange, templates }: CreateJobDialogProps) {
  const queryClient = useQueryClient();
  const [inputMethod, setInputMethod] = useState<'paste' | 'csv'>('paste');
  const [urlsText, setUrlsText] = useState('');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { limits } = usePlanLimits();

  const parsedUrls = urlsText
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);
  const targetCount = parsedUrls.length;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      description: '',
      schema_template_id: '',
      max_pages_per_domain: 10,
      respect_robots_txt: true,
      use_playwright_fallback: true,
      request_delay_ms: 1000,
    },
  });

  const createMutation = useMutation({
    mutationFn: (input: CreateScrapeJobInput) => scrapeJobsApi.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scrape-jobs'] });
      toast.success('Job created successfully');
      onOpenChange(false);
      resetForm();
    },
    onError: (error) => toast.error(`Failed to create job: ${error.message}`),
  });

  const resetForm = () => {
    form.reset();
    setUrlsText('');
    setCsvFile(null);
    setInputMethod('paste');
  };

  const parseUrls = (text: string): string[] => {
    return text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .map(url => {
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
          return `https://${url}`;
        }
        return url;
      });
  };

  const handleCsvUpload = async (file: File) => {
    setCsvFile(file);
    const text = await file.text();
    const lines = text.split('\n');
    
    // Try to find URL column
    const header = lines[0]?.toLowerCase() || '';
    const urlColIndex = header.split(',').findIndex(col => 
      col.trim() === 'url' || col.trim() === 'website' || col.trim() === 'domain'
    );
    
    const urls: string[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',');
      const url = urlColIndex >= 0 ? cols[urlColIndex]?.trim() : cols[0]?.trim();
      if (url && url.length > 0) {
        urls.push(url);
      }
    }
    
    setUrlsText(urls.join('\n'));
  };

  const handleSubmit = async (data: FormData) => {
    const urls = parseUrls(urlsText);
    
    if (urls.length === 0) {
      toast.error('Please enter at least one URL');
      return;
    }

    setIsSubmitting(true);
    try {
      await createMutation.mutateAsync({
        name: data.name,
        description: data.description,
        schema_template_id: data.schema_template_id && data.schema_template_id !== 'none' ? data.schema_template_id : undefined,
        target_urls: urls,
        input_method: inputMethod,
        max_pages_per_domain: data.max_pages_per_domain,
        respect_robots_txt: data.respect_robots_txt,
        use_playwright_fallback: data.use_playwright_fallback,
        request_delay_ms: data.request_delay_ms,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Scrape Job</DialogTitle>
          <DialogDescription>
            Configure a new web scraping job to extract leads
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Basic Info */}
            <div className="grid gap-4 md:grid-cols-2">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Job Name *</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Real Estate Agents NYC" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="schema_template_id"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Schema Template</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">No template (universal fields only)</SelectItem>
                        {templates.map((template) => (
                          <SelectItem key={template.id} value={template.id}>
                            {template.name} ({template.niche})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Optional description of this job"
                      rows={2}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* URL Input */}
            <div className="space-y-4">
              <Label>Target URLs *</Label>
              <Tabs value={inputMethod} onValueChange={(v) => setInputMethod(v as 'paste' | 'csv')}>
                <TabsList>
                  <TabsTrigger value="paste">
                    <Link className="h-4 w-4 mr-2" /> Paste URLs
                  </TabsTrigger>
                  <TabsTrigger value="csv">
                    <Upload className="h-4 w-4 mr-2" /> Upload CSV
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="paste" className="mt-4">
                  <Textarea
                    placeholder="Enter URLs (one per line)&#10;example.com&#10;another-site.com"
                    rows={6}
                    value={urlsText}
                    onChange={(e) => setUrlsText(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    {parseUrls(urlsText).length} URLs detected
                  </p>
                </TabsContent>

                <TabsContent value="csv" className="mt-4">
                  <div className="border-2 border-dashed rounded-lg p-6 text-center">
                    <input
                      type="file"
                      accept=".csv"
                      onChange={(e) => e.target.files?.[0] && handleCsvUpload(e.target.files[0])}
                      className="hidden"
                      id="csv-upload"
                    />
                    <label htmlFor="csv-upload" className="cursor-pointer">
                      <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
                      <p className="text-sm font-medium">
                        {csvFile ? csvFile.name : 'Click to upload CSV'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        CSV should have a 'url' column
                      </p>
                    </label>
                  </div>
                  {urlsText && (
                    <p className="text-sm text-muted-foreground mt-2">
                      {parseUrls(urlsText).length} URLs parsed from CSV
                    </p>
                  )}
                </TabsContent>
              </Tabs>
            </div>

            {/* Crawl Settings */}
            <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
              <h4 className="font-medium">Crawl Settings</h4>
              
              <div className="grid gap-4 md:grid-cols-2">
                <FormField
                  control={form.control}
                  name="max_pages_per_domain"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Pages per Domain</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={100}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 10)}
                        />
                      </FormControl>
                      <FormDescription>Limit pages crawled per site</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="request_delay_ms"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Request Delay (ms)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={10000}
                          step={100}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 1000)}
                        />
                      </FormControl>
                      <FormDescription>Delay between requests</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex flex-wrap gap-6">
                <FormField
                  control={form.control}
                  name="respect_robots_txt"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Respect robots.txt</FormLabel>
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="use_playwright_fallback"
                  render={({ field }) => (
                    <FormItem className="flex items-center gap-2">
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <FormLabel className="!mt-0">Use Playwright for JS sites</FormLabel>
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Job Cost Estimate */}
            <JobCostEstimate
              targetCount={targetCount}
              maxPagesPerDomain={form.watch('max_pages_per_domain')}
            />

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || targetCount > limits.max_targets_per_job}
              >
                {isSubmitting ? 'Creating...' : 'Create Job'}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
