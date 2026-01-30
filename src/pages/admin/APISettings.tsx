import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { Settings, Key, Check, X, Shield, ExternalLink, Database, Mail, Phone, Search } from 'lucide-react';
import { enrichmentProvidersApi } from '@/lib/api/scraper';
import { toast } from 'sonner';

interface ProviderConfig {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: 'scraping' | 'enrichment' | 'validation';
  envVariable: string;
  docsUrl?: string;
  features: string[];
}

const PROVIDERS: ProviderConfig[] = [
  {
    id: 'firecrawl',
    name: 'Firecrawl',
    description: 'Web scraping and crawling API for extracting content from websites',
    icon: <Database className="h-5 w-5" />,
    category: 'scraping',
    envVariable: 'FIRECRAWL_API_KEY',
    docsUrl: 'https://firecrawl.dev/docs',
    features: ['Website scraping', 'JavaScript rendering', 'Sitemap crawling', 'Contact extraction'],
  },
  {
    id: 'apollo',
    name: 'Apollo.io',
    description: 'B2B data enrichment platform for contact and company information',
    icon: <Search className="h-5 w-5" />,
    category: 'enrichment',
    envVariable: 'APOLLO_API_KEY',
    docsUrl: 'https://apolloio.github.io/apollo-api-docs',
    features: ['Person lookup', 'Company lookup', 'Email discovery', 'Phone enrichment'],
  },
  {
    id: 'hunter',
    name: 'Hunter.io',
    description: 'Email finder and verification service',
    icon: <Mail className="h-5 w-5" />,
    category: 'enrichment',
    envVariable: 'HUNTER_API_KEY',
    docsUrl: 'https://hunter.io/api-documentation',
    features: ['Email finder', 'Email verification', 'Domain search'],
  },
  {
    id: 'clearbit',
    name: 'Clearbit',
    description: 'Company and contact enrichment API',
    icon: <Shield className="h-5 w-5" />,
    category: 'enrichment',
    envVariable: 'CLEARBIT_API_KEY',
    docsUrl: 'https://clearbit.com/docs',
    features: ['Company enrichment', 'Person enrichment', 'Logo API'],
  },
  {
    id: 'zerobounce',
    name: 'ZeroBounce',
    description: 'Email validation and deliverability service',
    icon: <Mail className="h-5 w-5" />,
    category: 'validation',
    envVariable: 'ZEROBOUNCE_API_KEY',
    docsUrl: 'https://www.zerobounce.net/docs',
    features: ['Email validation', 'Spam trap detection', 'Abuse email detection'],
  },
  {
    id: 'twilio',
    name: 'Twilio Lookup',
    description: 'Phone number validation and carrier lookup',
    icon: <Phone className="h-5 w-5" />,
    category: 'validation',
    envVariable: 'TWILIO_ACCOUNT_SID',
    docsUrl: 'https://www.twilio.com/docs/lookup',
    features: ['Phone validation', 'Line type detection', 'Carrier lookup'],
  },
];

export default function APISettings() {
  const queryClient = useQueryClient();
  const [testingProvider, setTestingProvider] = useState<string | null>(null);

  const { data: dbProviders = [] } = useQuery({
    queryKey: ['enrichment-providers'],
    queryFn: () => enrichmentProvidersApi.list(),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ provider, enabled }: { provider: string; enabled: boolean }) => {
      const typedProvider = provider as 'apollo' | 'hunter' | 'clearbit' | 'manual';
      if (enabled) {
        await enrichmentProvidersApi.enable(typedProvider);
      } else {
        await enrichmentProvidersApi.disable(typedProvider);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['enrichment-providers'] });
      toast.success('Provider settings updated');
    },
    onError: (error) => toast.error(`Failed to update: ${error.message}`),
  });

  const isProviderEnabled = (providerId: string) => {
    const dbProvider = dbProviders.find(p => p.provider === providerId);
    return dbProvider?.is_enabled ?? false;
  };

  const renderProviderCard = (provider: ProviderConfig) => {
    const isEnabled = isProviderEnabled(provider.id);
    const isSupported = ['apollo', 'hunter', 'clearbit'].includes(provider.id);

    return (
      <Card key={provider.id}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                {provider.icon}
              </div>
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  {provider.name}
                  {isEnabled && <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">Active</Badge>}
                </CardTitle>
                <CardDescription>{provider.description}</CardDescription>
              </div>
            </div>
            {isSupported && (
              <Switch
                checked={isEnabled}
                onCheckedChange={(checked) => toggleMutation.mutate({ provider: provider.id, enabled: checked })}
              />
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {provider.features.map((feature) => (
              <Badge key={feature} variant="secondary" className="text-xs">
                {feature}
              </Badge>
            ))}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Key className="h-4 w-4" />
              <code className="bg-muted px-2 py-0.5 rounded">{provider.envVariable}</code>
            </div>
            {provider.docsUrl && (
              <a
                href={provider.docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Documentation
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
          </div>

          {provider.id === 'firecrawl' && (
            <div className="p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">Connected via Lovable Connector</span>
              </div>
            </div>
          )}

          {provider.id === 'apollo' && (
            <div className="p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">Configured (APOLLO_API_KEY)</span>
              </div>
            </div>
          )}

          {provider.id === 'hunter' && (
            <div className="p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">Configured (HUNTER_API_KEY)</span>
              </div>
            </div>
          )}

          {provider.id === 'zerobounce' && (
            <div className="p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">Configured (ZEROBOUNCE_API_KEY)</span>
              </div>
            </div>
          )}

          {provider.id === 'twilio' && (
            <div className="p-3 rounded-lg border bg-emerald-500/10 border-emerald-500/20">
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                <Check className="h-4 w-4" />
                <span className="text-sm font-medium">Configured (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  const categories = [
    { id: 'scraping', title: 'Web Scraping', description: 'Services for extracting data from websites' },
    { id: 'enrichment', title: 'Data Enrichment', description: 'APIs for enriching lead data with additional information' },
    { id: 'validation', title: 'Validation', description: 'Services for validating email and phone data' },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">API Settings</h1>
          <p className="text-muted-foreground">Configure API keys for scraping, enrichment, and validation services</p>
        </div>

        {/* Instructions Card */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              How to Configure API Keys
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              API keys are securely stored as backend secrets. To add or update an API key:
            </p>
            <ol className="list-decimal list-inside space-y-2 text-sm">
              <li>Navigate to your project's backend settings</li>
              <li>Add a new secret with the environment variable name shown below</li>
              <li>The service will automatically use the key when enabled</li>
            </ol>
            <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/20">
              <p className="text-sm text-yellow-700 dark:text-yellow-400">
                <strong>Note:</strong> Firecrawl is already connected via Lovable's connector integration. 
                For other services, add the API key as a secret in your backend settings.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Provider Categories */}
        {categories.map((category) => (
          <div key={category.id} className="space-y-4">
            <div>
              <h2 className="text-xl font-semibold">{category.title}</h2>
              <p className="text-muted-foreground text-sm">{category.description}</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {PROVIDERS.filter(p => p.category === category.id).map(renderProviderCard)}
            </div>
          </div>
        ))}

        {/* Enrichment Order Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Enrichment Order</CardTitle>
            <CardDescription>
              Configure the order in which enrichment providers are used
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-medium text-muted-foreground">1</span>
                  <span>On-site scraping (Firecrawl)</span>
                </div>
                <Badge variant="outline">Always First</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-medium text-muted-foreground">2</span>
                  <span>Apollo.io enrichment</span>
                </div>
                <Badge variant="outline">If enabled</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-medium text-muted-foreground">3</span>
                  <span>Hunter.io email discovery</span>
                </div>
                <Badge variant="outline">If enabled</Badge>
              </div>
              <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-medium text-muted-foreground">4</span>
                  <span>Validation (ZeroBounce/Twilio)</span>
                </div>
                <Badge variant="outline">Final step</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              The system first attempts to extract data from the website. If contact information is missing,
              it falls back to enrichment providers in order. Finally, validation providers verify the data.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
