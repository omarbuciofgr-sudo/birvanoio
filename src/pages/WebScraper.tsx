import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { firecrawlApi } from '@/lib/api/firecrawl';
import { skipTraceApi } from '@/lib/api/skipTrace';
import { supabase } from '@/integrations/supabase/client';
import { ProspectSearchDialog } from '@/components/scraper/ProspectSearchDialog';
import { 
  Globe, 
  Search, 
  Map, 
  Layers, 
  Loader2, 
  ExternalLink, 
  Copy, 
  Download,
  FileText,
  UserPlus,
  Check,
  Home,
  Building,
  Target,
  Phone as PhoneIcon,
  Mail as MailIcon,
  Save,
  Users,
  RotateCw,
  ArrowRight,
  MapPin,
} from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type ScrapeResult = {
  markdown?: string;
  html?: string;
  links?: string[];
  metadata?: {
    title?: string;
    description?: string;
    sourceURL?: string;
  };
};

type SearchResult = {
  url: string;
  title: string;
  description?: string;
  markdown?: string;
  imported?: boolean;
};

export default function WebScraper() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  // Scrape state
  const [scrapeUrl, setScrapeUrl] = useState('');
  const [scrapeLoading, setScrapeLoading] = useState(false);
  const [scrapeResult, setScrapeResult] = useState<ScrapeResult | null>(null);
  const [onlyMainContent, setOnlyMainContent] = useState(true);

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLimit, setSearchLimit] = useState(10);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [importingIndex, setImportingIndex] = useState<number | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);

  // Map state
  const [mapUrl, setMapUrl] = useState('');
  const [mapLimit, setMapLimit] = useState(100);
  const [includeSubdomains, setIncludeSubdomains] = useState(false);
  const [mapLoading, setMapLoading] = useState(false);
  const [mapResults, setMapResults] = useState<string[]>([]);

  // Crawl state
  const [crawlUrl, setCrawlUrl] = useState('');
  const [crawlLimit, setCrawlLimit] = useState(50);
  const [crawlDepth, setCrawlDepth] = useState(3);
  const [crawlLoading, setCrawlLoading] = useState(false);
  const [crawlResult, setCrawlResult] = useState<any>(null);

  // Real Estate state
  const [reLocation, setReLocation] = useState('');
  const [rePlatform, setRePlatform] = useState<string>('all');
  const [reListingType, setReListingType] = useState<'sale' | 'rent'>('sale');
  const [reEnableSkipTrace, setReEnableSkipTrace] = useState(true);
  const [reSaveToDb, setReSaveToDb] = useState(false);
  const [reLoading, setReLoading] = useState(false);
  const [reListings, setReListings] = useState<any[]>([]);
  const [reErrors, setReErrors] = useState<{ url: string; error: string }[]>([]);
  const [reSkipTraceStats, setReSkipTraceStats] = useState<{ attempted: number; successful: number; rate: number } | null>(null);
  const [skipTracingIndex, setSkipTracingIndex] = useState<number | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [selectedListings, setSelectedListings] = useState<Set<number>>(new Set());
  const [bulkSkipTracing, setBulkSkipTracing] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Prospect Search state
  const [prospectSearchOpen, setProspectSearchOpen] = useState(false);

  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) { toast.error('Please enter a URL'); return; }
    setScrapeLoading(true); setScrapeResult(null);
    try {
      const response = await firecrawlApi.scrape(scrapeUrl, { formats: ['markdown', 'links'], onlyMainContent });
      if (response.success) { setScrapeResult(response.data?.data || response.data); toast.success('Page scraped successfully'); }
      else { toast.error(response.error || 'Failed to scrape page'); }
    } catch { toast.error('Failed to scrape page'); } finally { setScrapeLoading(false); }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) { toast.error('Please enter a search query'); return; }
    setSearchLoading(true); setSearchResults([]); setSelectedResults(new Set());
    try {
      const response = await firecrawlApi.search(searchQuery, { limit: searchLimit, scrapeOptions: { formats: ['markdown'] } });
      if (response.success) { setSearchResults((response.data || []).map((r: SearchResult) => ({ ...r, imported: false }))); toast.success(`Found ${response.data?.length || 0} results`); }
      else { toast.error(response.error || 'Search failed'); }
    } catch { toast.error('Search failed'); } finally { setSearchLoading(false); }
  };

  const extractBusinessName = (url: string, title: string): string => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      if (title && title.length < 60 && !title.includes('|') && !title.includes('-')) return title;
      return domain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    } catch { return title || 'Unknown Business'; }
  };

  const importAsLead = async (result: SearchResult, index: number) => {
    if (!user?.id) { toast.error('You must be logged in to import leads'); return; }
    setImportingIndex(index);
    try {
      const businessName = extractBusinessName(result.url, result.title);
      const { error } = await supabase.from('leads').insert({ client_id: user.id, business_name: businessName, website: result.url, notes: result.description || '', source_url: result.url, status: 'new' });
      if (error) throw error;
      setSearchResults(prev => prev.map((r, i) => i === index ? { ...r, imported: true } : r));
      setSelectedResults(prev => { const next = new Set(prev); next.delete(index); return next; });
      toast.success(`Imported "${businessName}" as a new lead`);
    } catch { toast.error('Failed to import lead'); } finally { setImportingIndex(null); }
  };

  const importSelectedLeads = async () => {
    if (selectedResults.size === 0) { toast.error('Please select at least one result to import'); return; }
    setBulkImporting(true); let successCount = 0; let errorCount = 0;
    for (const index of selectedResults) {
      const result = searchResults[index]; if (result.imported) continue;
      try {
        const businessName = extractBusinessName(result.url, result.title);
        const { error } = await supabase.from('leads').insert({ client_id: user!.id, business_name: businessName, website: result.url, notes: result.description || '', source_url: result.url, status: 'new' });
        if (error) throw error; successCount++;
        setSearchResults(prev => prev.map((r, i) => i === index ? { ...r, imported: true } : r));
      } catch { errorCount++; }
    }
    setSelectedResults(new Set()); setBulkImporting(false);
    if (successCount > 0) toast.success(`Imported ${successCount} lead${successCount > 1 ? 's' : ''}`);
    if (errorCount > 0) toast.error(`Failed to import ${errorCount} lead${errorCount > 1 ? 's' : ''}`);
  };

  const toggleSelectResult = (index: number) => { setSelectedResults(prev => { const next = new Set(prev); if (next.has(index)) next.delete(index); else next.add(index); return next; }); };
  const toggleSelectAll = () => { if (selectedResults.size === searchResults.filter(r => !r.imported).length) setSelectedResults(new Set()); else setSelectedResults(new Set(searchResults.map((r, i) => r.imported ? -1 : i).filter(i => i >= 0))); };

  const handleMap = async () => {
    if (!mapUrl.trim()) { toast.error('Please enter a URL'); return; }
    setMapLoading(true); setMapResults([]);
    try {
      const response = await firecrawlApi.map(mapUrl, { limit: mapLimit, includeSubdomains });
      if (response.success) { const links = response.data?.links || response.links || []; setMapResults(links); toast.success(`Found ${links.length} URLs`); }
      else { toast.error(response.error || 'Failed to map website'); }
    } catch { toast.error('Failed to map website'); } finally { setMapLoading(false); }
  };

  const handleCrawl = async () => {
    if (!crawlUrl.trim()) { toast.error('Please enter a URL'); return; }
    setCrawlLoading(true); setCrawlResult(null);
    try {
      const response = await firecrawlApi.crawl(crawlUrl, { limit: crawlLimit, maxDepth: crawlDepth });
      if (response.success) { setCrawlResult(response); toast.success('Crawl started! Check back for results.'); }
      else { toast.error(response.error || 'Failed to start crawl'); }
    } catch { toast.error('Failed to start crawl'); } finally { setCrawlLoading(false); }
  };

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied to clipboard'); };
  const downloadAsFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const handleRealEstateScrape = async () => {
    if (!reLocation.trim()) { toast.error('Please enter a location'); return; }
    setReLoading(true); setReListings([]); setReErrors([]); setReSkipTraceStats(null);
    try {
      const response = await firecrawlApi.scrapeAndTraceFSBO({ location: reLocation, platform: rePlatform as any, listingType: reListingType, enableSkipTrace: reEnableSkipTrace, saveToDatabase: reSaveToDb });
      if (response.success) {
        setReListings(response.listings || []);
        if (response.errors?.length) setReErrors(response.errors);
        if (response.skip_trace_stats) setReSkipTraceStats(response.skip_trace_stats);
        const skipInfo = reEnableSkipTrace && response.skip_trace_stats ? ` (${response.skip_trace_stats.successful}/${response.skip_trace_stats.attempted} skip traced)` : '';
        toast.success(`Found ${response.total || 0} listings${skipInfo}`);
        if (reSaveToDb && response.saved_to_database) toast.success(`Saved ${response.saved_to_database} leads to database`);
      } else { toast.error(response.error || 'Failed to scrape listings'); }
    } catch { toast.error('Failed to scrape listings'); } finally { setReLoading(false); }
  };

  const exportListingsToCSV = () => {
    if (reListings.length === 0) return;
    const headers = ['Address', 'Bedrooms', 'Bathrooms', 'Price', 'Days on Market', 'Favorites', 'Views', 'Listing Type', 'Property Type', 'Sq Ft', 'Year Built', 'Owner Name', 'Owner Phone', 'Owner Email', 'Source URL'];
    const rows = reListings.map(l => [l.address || '', l.bedrooms || '', l.bathrooms || '', l.price || '', l.days_on_market || '', l.favorites_count || '', l.views_count || '', l.listing_type || '', l.property_type || '', l.square_feet || '', l.year_built || '', l.owner_name || '', l.owner_phone || '', l.owner_email || '', l.source_url || '']);
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadAsFile(csv, `fsbo-listings-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Exported listings to CSV');
  };

  const handleSkipTraceListing = async (listing: any, index: number) => {
    if (!listing.address) { toast.error('No address available for skip trace'); return; }
    setSkipTracingIndex(index);
    try {
      const parsed = skipTraceApi.parseAddress(listing.address);
      const result = await skipTraceApi.lookupOwner(parsed);
      if (result.success && result.data) {
        setReListings(prev => prev.map((l, i) => i !== index ? l : { ...l, owner_name: result.data!.fullName || l.owner_name, owner_phone: result.data!.phones[0]?.number || l.owner_phone, owner_email: result.data!.emails[0]?.address || l.owner_email, all_phones: result.data!.phones, all_emails: result.data!.emails, skip_trace_confidence: result.data!.confidence, skip_trace_status: 'success' }));
        toast.success(`Found owner info: ${result.data.fullName || 'Contact data retrieved'}`);
      } else {
        toast.error(result.error || result.message || 'No owner info found');
        setReListings(prev => prev.map((l, i) => i !== index ? l : { ...l, skip_trace_status: 'not_found' }));
      }
    } catch { toast.error('Failed to skip trace'); } finally { setSkipTracingIndex(null); }
  };

  const handleRetrySkipTrace = async (listing: any, index: number) => {
    if (!listing.address) { toast.error('No address available for skip trace'); return; }
    setReListings(prev => prev.map((l, i) => i !== index ? l : { ...l, skip_trace_status: undefined }));
    setSkipTracingIndex(index);
    try {
      const parsed = skipTraceApi.parseAddress(listing.address);
      const result = await skipTraceApi.lookupOwner(parsed);
      if (result.success && result.data) {
        setReListings(prev => prev.map((l, i) => i !== index ? l : { ...l, owner_name: result.data!.fullName || l.owner_name, owner_phone: result.data!.phones[0]?.number || l.owner_phone, owner_email: result.data!.emails[0]?.address || l.owner_email, all_phones: result.data!.phones, all_emails: result.data!.emails, skip_trace_confidence: result.data!.confidence, skip_trace_status: 'success' }));
        toast.success(`Found owner info: ${result.data.fullName || 'Contact data retrieved'}`);
      } else {
        toast.error(result.error || result.message || 'Still no owner info found');
        setReListings(prev => prev.map((l, i) => i !== index ? l : { ...l, skip_trace_status: 'not_found' }));
      }
    } catch {
      toast.error('Failed to retry skip trace');
      setReListings(prev => prev.map((l, i) => i !== index ? l : { ...l, skip_trace_status: 'not_found' }));
    } finally { setSkipTracingIndex(null); }
  };

  const handleSaveListing = async (listing: any, index: number) => {
    if (!user?.id) { toast.error('You must be logged in'); return; }
    setSavingIndex(index);
    try {
      const { error } = await supabase.from('scraped_leads').insert({
        domain: listing.source_url ? new URL(listing.source_url).hostname : 'unknown',
        source_url: listing.source_url || listing.listing_url,
        full_name: listing.owner_name, best_email: listing.owner_email, best_phone: listing.owner_phone,
        all_emails: listing.all_emails?.map((e: any) => e.address || e) || (listing.owner_email ? [listing.owner_email] : []),
        all_phones: listing.all_phones?.map((p: any) => p.number || p) || (listing.owner_phone ? [listing.owner_phone] : []),
        status: 'new', confidence_score: listing.skip_trace_confidence || 50, lead_type: 'person', source_type: 'real_estate_scraper',
        schema_data: { address: listing.address, bedrooms: listing.bedrooms, bathrooms: listing.bathrooms, price: listing.price, days_on_market: listing.days_on_market, property_type: listing.property_type, square_feet: listing.square_feet, year_built: listing.year_built, listing_type: listing.listing_type, source_platform: listing.source_platform },
        enrichment_providers_used: listing.skip_trace_status === 'success' ? ['batchdata'] : [],
      });
      if (error) throw error;
      setReListings(prev => prev.map((l, i) => i !== index ? l : { ...l, saved_to_db: true }));
      toast.success('Lead saved to database');
    } catch { toast.error('Failed to save lead'); } finally { setSavingIndex(null); }
  };

  const toggleListingSelection = (index: number) => { setSelectedListings(prev => { const next = new Set(prev); if (next.has(index)) next.delete(index); else next.add(index); return next; }); };
  const toggleSelectAllListings = () => { if (selectedListings.size === reListings.filter(l => !l.saved_to_db).length) setSelectedListings(new Set()); else setSelectedListings(new Set(reListings.map((l, i) => l.saved_to_db ? -1 : i).filter(i => i >= 0))); };

  const handleBulkSkipTrace = async () => {
    const toProcess = Array.from(selectedListings).filter(i => reListings[i] && !reListings[i].owner_phone && !reListings[i].skip_trace_status);
    if (toProcess.length === 0) { toast.error('No listings to skip trace'); return; }
    setBulkSkipTracing(true); let successCount = 0; let errorCount = 0;
    for (const index of toProcess) {
      const listing = reListings[index]; if (!listing.address) continue;
      try {
        const parsed = skipTraceApi.parseAddress(listing.address);
        const result = await skipTraceApi.lookupOwner(parsed);
        if (result.success && result.data) {
          setReListings(prev => prev.map((l, i) => i !== index ? l : { ...l, owner_name: result.data!.fullName || l.owner_name, owner_phone: result.data!.phones[0]?.number || l.owner_phone, owner_email: result.data!.emails[0]?.address || l.owner_email, all_phones: result.data!.phones, all_emails: result.data!.emails, skip_trace_confidence: result.data!.confidence, skip_trace_status: 'success' }));
          successCount++;
        } else { setReListings(prev => prev.map((l, i) => i !== index ? l : { ...l, skip_trace_status: 'not_found' })); errorCount++; }
      } catch { errorCount++; }
    }
    setBulkSkipTracing(false); toast.success(`Skip traced ${successCount} listings (${errorCount} not found)`);
  };

  const handleBulkSave = async () => {
    const toSave = Array.from(selectedListings).filter(i => reListings[i] && !reListings[i].saved_to_db);
    if (toSave.length === 0) { toast.error('No new listings to save'); return; }
    setBulkSaving(true); let successCount = 0; let errorCount = 0;
    for (const index of toSave) {
      const listing = reListings[index];
      try {
        const { error } = await supabase.from('scraped_leads').insert({
          domain: listing.source_url ? new URL(listing.source_url).hostname : 'unknown',
          source_url: listing.source_url || listing.listing_url, full_name: listing.owner_name, best_email: listing.owner_email, best_phone: listing.owner_phone,
          all_emails: listing.all_emails?.map((e: any) => e.address || e) || (listing.owner_email ? [listing.owner_email] : []),
          all_phones: listing.all_phones?.map((p: any) => p.number || p) || (listing.owner_phone ? [listing.owner_phone] : []),
          status: 'new', confidence_score: listing.skip_trace_confidence || 50, lead_type: 'person', source_type: 'real_estate_scraper',
          schema_data: { address: listing.address, bedrooms: listing.bedrooms, bathrooms: listing.bathrooms, price: listing.price, days_on_market: listing.days_on_market, property_type: listing.property_type, square_feet: listing.square_feet, year_built: listing.year_built, listing_type: listing.listing_type, source_platform: listing.source_platform },
          enrichment_providers_used: listing.skip_trace_status === 'success' ? ['batchdata'] : [],
        });
        if (error) throw error;
        setReListings(prev => prev.map((l, i) => i !== index ? l : { ...l, saved_to_db: true })); successCount++;
      } catch { errorCount++; }
    }
    setSelectedListings(new Set()); setBulkSaving(false); toast.success(`Saved ${successCount} leads (${errorCount} failed)`);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Web Scraper</h1>
            <p className="text-sm text-muted-foreground mt-1">Extract data from websites, find prospects, and scrape listings</p>
          </div>
          <Button 
            onClick={() => setProspectSearchOpen(true)} 
            size="sm"
            className="gap-2"
          >
            <Target className="h-4 w-4" />
            Prospect Search
          </Button>
        </div>

        <ProspectSearchDialog open={prospectSearchOpen} onOpenChange={setProspectSearchOpen} />

        {/* Tabs */}
        <Tabs defaultValue="real-estate" className="space-y-4">
          <TabsList className="h-9 p-0.5 bg-muted/60">
            <TabsTrigger value="real-estate" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Home className="h-3.5 w-3.5" /> Real Estate
            </TabsTrigger>
            <TabsTrigger value="scrape" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Globe className="h-3.5 w-3.5" /> Scrape
            </TabsTrigger>
            <TabsTrigger value="search" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Search className="h-3.5 w-3.5" /> Search
            </TabsTrigger>
            <TabsTrigger value="map" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Map className="h-3.5 w-3.5" /> Map
            </TabsTrigger>
            <TabsTrigger value="crawl" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Layers className="h-3.5 w-3.5" /> Crawl
            </TabsTrigger>
          </TabsList>

          {/* ── Real Estate Tab ── */}
          <TabsContent value="real-estate" className="space-y-4 mt-0">
            <Card className="border-border/60">
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-2 mb-1">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  <h3 className="font-medium text-sm">FSBO & FRBO Listing Scraper</h3>
                </div>
                <p className="text-xs text-muted-foreground -mt-2">
                  Find For Sale / For Rent By Owner listings across Zillow, Apartments.com, HotPads, Trulia, Redfin, and more
                </p>

                {/* Search row */}
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        placeholder="Austin, TX or 90210"
                        value={reLocation}
                        onChange={(e) => setReLocation(e.target.value)}
                        className="pl-8 h-9 text-sm"
                      />
                    </div>
                  </div>
                  <div className="w-40 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Platform</Label>
                    <Select value={rePlatform} onValueChange={setRePlatform}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="Platform" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Platforms</SelectItem>
                        <SelectItem value="zillow">Zillow</SelectItem>
                        <SelectItem value="fsbo">FSBO.com</SelectItem>
                        <SelectItem value="trulia">Trulia</SelectItem>
                        <SelectItem value="redfin">Redfin</SelectItem>
                        <SelectItem value="apartments">Apartments.com</SelectItem>
                        <SelectItem value="hotpads">Hotpads</SelectItem>
                        <SelectItem value="realtor">Realtor.com</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="w-36 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Listing Type</Label>
                    <Select value={reListingType} onValueChange={(v) => setReListingType(v as 'sale' | 'rent')}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="sale">For Sale (FSBO)</SelectItem>
                        <SelectItem value="rent">For Rent (FRBO)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleRealEstateScrape} disabled={reLoading} size="sm" className="h-9 px-4">
                    {reLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-3.5 w-3.5 mr-1.5" /> Find Listings</>}
                  </Button>
                </div>

                {/* Options row */}
                <div className="flex items-center gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={reEnableSkipTrace} onCheckedChange={setReEnableSkipTrace} className="scale-90" />
                    <span className="text-xs font-medium">Auto Skip Trace</span>
                    <span className="text-[10px] text-muted-foreground">~$0.009/address</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={reSaveToDb} onCheckedChange={setReSaveToDb} className="scale-90" />
                    <span className="text-xs font-medium">Save to Database</span>
                  </label>
                </div>

                {/* Fields preview */}
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {['Address', 'Beds', 'Baths', 'Price', 'Days on Market', 'Favorites', 'Views', 'Owner Name', 'Owner Phone', 'Owner Email', 'Source'].map(field => (
                    <span key={field} className="inline-flex items-center px-2 py-0.5 rounded-md bg-muted text-[10px] font-medium text-muted-foreground">{field}</span>
                  ))}
                  {reEnableSkipTrace && (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-green-500/10 text-[10px] font-medium text-green-600 dark:text-green-400">+ Skip Trace Data</span>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Skip Trace Stats */}
            {reSkipTraceStats && (
              <div className="flex items-center gap-6 px-4 py-3 rounded-lg bg-green-500/5 border border-green-500/20 text-sm">
                <span className="text-xs font-medium text-green-700 dark:text-green-400">Skip Trace Results</span>
                <div className="flex gap-4 text-xs">
                  <span>Attempted: <strong>{reSkipTraceStats.attempted}</strong></span>
                  <span>Successful: <strong className="text-green-600">{reSkipTraceStats.successful}</strong></span>
                  <span>Rate: <strong>{reSkipTraceStats.rate}%</strong></span>
                </div>
              </div>
            )}

            {/* Errors */}
            {reErrors.length > 0 && (
              <div className="px-4 py-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs">
                <p className="font-medium text-destructive mb-1">Some sites couldn't be scraped:</p>
                {reErrors.map((err, i) => (
                  <p key={i} className="text-muted-foreground truncate">• {err.url}: {err.error}</p>
                ))}
              </div>
            )}

            {/* Listings Results */}
            {reListings.length > 0 && (
              <Card className="border-border/60">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">{reListings.length} Listings</h3>
                    {selectedListings.size > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5">{selectedListings.size} selected</Badge>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={toggleSelectAllListings}>
                      {selectedListings.size === reListings.filter(l => !l.saved_to_db).length ? 'Deselect All' : 'Select All'}
                    </Button>
                    {selectedListings.size > 0 && (
                      <>
                        <Button variant="outline" size="sm" className="h-7 text-xs px-2.5" onClick={handleBulkSkipTrace} disabled={bulkSkipTracing}>
                          {bulkSkipTracing ? <Loader2 className="h-3 w-3 animate-spin" /> : <><RotateCw className="h-3 w-3 mr-1" /> Skip Trace</>}
                        </Button>
                        <Button size="sm" className="h-7 text-xs px-2.5" onClick={handleBulkSave} disabled={bulkSaving}>
                          {bulkSaving ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Save className="h-3 w-3 mr-1" /> Save</>}
                        </Button>
                      </>
                    )}
                    <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={exportListingsToCSV}>
                      <Download className="h-3 w-3 mr-1" /> CSV
                    </Button>
                  </div>
                </div>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <div className="divide-y divide-border/40">
                      {reListings.map((listing, index) => (
                        <div 
                          key={index} 
                          className={`px-5 py-3.5 flex gap-3 transition-colors hover:bg-muted/30 ${
                            selectedListings.has(index) ? 'bg-primary/[0.03]' : ''
                          } ${listing.saved_to_db ? 'opacity-50' : ''}`}
                        >
                          {!listing.saved_to_db ? (
                            <Checkbox checked={selectedListings.has(index)} onCheckedChange={() => toggleListingSelection(index)} className="mt-0.5" />
                          ) : (
                            <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          )}
                          
                          <div className="flex-1 min-w-0 space-y-2">
                            {/* Top row: address + price */}
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <h4 className="text-sm font-medium truncate">{listing.address || 'Address not available'}</h4>
                                  {listing.saved_to_db && <Badge variant="secondary" className="text-[10px] h-4 shrink-0">Saved</Badge>}
                                  {listing.skip_trace_status === 'success' && <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 text-[10px] h-4 border-0 shrink-0">Traced</Badge>}
                                  {listing.skip_trace_status === 'not_found' && <Badge variant="outline" className="text-[10px] h-4 shrink-0">Not Found</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                  {[listing.property_type, listing.bedrooms && `${listing.bedrooms} bed`, listing.bathrooms && `${listing.bathrooms} bath`, listing.square_feet && `${listing.square_feet.toLocaleString()} sqft`].filter(Boolean).join(' · ')}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-sm font-semibold">{listing.price || '—'}</p>
                                {listing.days_on_market && <p className="text-[10px] text-muted-foreground">{listing.days_on_market}d on market</p>}
                              </div>
                            </div>

                            {/* Meta row */}
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              {listing.favorites_count !== undefined && <span>♡ {listing.favorites_count}</span>}
                              {listing.views_count !== undefined && <span>👁 {listing.views_count}</span>}
                              {listing.source_platform && <Badge variant="outline" className="text-[10px] h-4 font-normal">{listing.source_platform}</Badge>}
                              {listing.listing_type && <Badge variant="secondary" className="text-[10px] h-4 font-normal uppercase">{listing.listing_type}</Badge>}
                            </div>

                            {/* Owner contact */}
                            {(listing.owner_name || listing.owner_phone || listing.owner_email) ? (
                              <div className="flex items-center gap-4 text-xs bg-muted/40 rounded-md px-3 py-2">
                                {listing.owner_name && <span className="font-medium">{listing.owner_name}</span>}
                                {listing.owner_phone && (
                                  <a href={`tel:${listing.owner_phone}`} className="flex items-center gap-1 text-primary hover:underline">
                                    <PhoneIcon className="h-3 w-3" /> {listing.owner_phone}
                                  </a>
                                )}
                                {listing.owner_email && (
                                  <a href={`mailto:${listing.owner_email}`} className="flex items-center gap-1 text-primary hover:underline">
                                    <MailIcon className="h-3 w-3" /> {listing.owner_email}
                                  </a>
                                )}
                              </div>
                            ) : null}

                            {/* Actions */}
                            <div className="flex items-center gap-1.5">
                              {!listing.owner_phone && !listing.skip_trace_status && (
                                <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleSkipTraceListing(listing, index)} disabled={skipTracingIndex === index}>
                                  {skipTracingIndex === index ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCw className="h-3 w-3 mr-1" />} Skip Trace
                                </Button>
                              )}
                              {listing.skip_trace_status === 'not_found' && (
                                <Button variant="outline" size="sm" className="h-7 text-xs text-orange-600 border-orange-500/30 hover:bg-orange-50 dark:hover:bg-orange-950/20" onClick={() => handleRetrySkipTrace(listing, index)} disabled={skipTracingIndex === index}>
                                  {skipTracingIndex === index ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCw className="h-3 w-3 mr-1" />} Retry
                                </Button>
                              )}
                              {!listing.saved_to_db && (
                                <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveListing(listing, index)} disabled={savingIndex === index}>
                                  {savingIndex === index ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Save className="h-3 w-3 mr-1" />} Save
                                </Button>
                              )}
                              {listing.source_url && (
                                <a href={listing.source_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-[10px] text-muted-foreground hover:text-primary flex items-center gap-0.5">
                                  View <ExternalLink className="h-2.5 w-2.5" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Scrape Tab ── */}
          <TabsContent value="scrape" className="space-y-4 mt-0">
            <Card className="border-border/60">
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-medium">Scrape a Page</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Extract content from any URL as markdown</p>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">URL</Label>
                    <Input placeholder="https://example.com" value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <Button onClick={handleScrape} disabled={scrapeLoading} size="sm" className="h-9">
                    {scrapeLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Globe className="h-3.5 w-3.5 mr-1.5" /> Scrape</>}
                  </Button>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={onlyMainContent} onCheckedChange={setOnlyMainContent} className="scale-90" />
                  <span className="text-xs">Only main content</span>
                </label>
              </CardContent>
            </Card>

            {scrapeResult && (
              <Card className="border-border/60">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
                  <div>
                    <h3 className="text-sm font-medium truncate">{scrapeResult.metadata?.title || 'Scraped Content'}</h3>
                    {scrapeResult.metadata?.sourceURL && <p className="text-[10px] text-muted-foreground truncate">{scrapeResult.metadata.sourceURL}</p>}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => copyToClipboard(scrapeResult.markdown || '')}><Copy className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => downloadAsFile(scrapeResult.markdown || '', 'scraped-content.md')}><Download className="h-3.5 w-3.5" /></Button>
                  </div>
                </div>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px] p-4">
                    <pre className="whitespace-pre-wrap text-xs text-muted-foreground font-mono">{scrapeResult.markdown}</pre>
                  </ScrollArea>
                  {scrapeResult.links && scrapeResult.links.length > 0 && (
                    <div className="border-t border-border/60 px-5 py-3">
                      <h4 className="text-xs font-medium mb-2">Links ({scrapeResult.links.length})</h4>
                      <ScrollArea className="h-[120px]">
                        <div className="space-y-0.5">
                          {scrapeResult.links.slice(0, 50).map((link, i) => (
                            <a key={i} href={link} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary hover:underline truncate">{link}</a>
                          ))}
                        </div>
                      </ScrollArea>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Search Tab ── */}
          <TabsContent value="search" className="space-y-4 mt-0">
            <Card className="border-border/60">
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-medium">Search & Discover Leads</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Search the web and import results as leads</p>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Query</Label>
                    <Input placeholder="e.g., roofing companies in Dallas Texas" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="w-24 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Results</Label>
                    <Input type="number" min={1} max={100} value={searchLimit} onChange={(e) => setSearchLimit(parseInt(e.target.value) || 10)} className="h-9 text-sm" />
                  </div>
                  <Button onClick={handleSearch} disabled={searchLoading} size="sm" className="h-9">
                    {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-3.5 w-3.5 mr-1.5" /> Search</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {searchResults.length > 0 && (
              <Card className="border-border/60">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
                  <h3 className="text-sm font-medium">{searchResults.length} Results</h3>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={toggleSelectAll}>
                      {selectedResults.size === searchResults.filter(r => !r.imported).length ? 'Deselect All' : 'Select All'}
                    </Button>
                    <Button size="sm" className="h-7 text-xs" onClick={importSelectedLeads} disabled={selectedResults.size === 0 || bulkImporting}>
                      {bulkImporting ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <UserPlus className="h-3 w-3 mr-1" />}
                      Import ({selectedResults.size})
                    </Button>
                  </div>
                </div>
                <CardContent className="p-0">
                  <ScrollArea className="h-[500px]">
                    <div className="divide-y divide-border/40">
                      {searchResults.map((result, i) => (
                        <div key={i} className={`px-5 py-3 flex gap-3 hover:bg-muted/30 transition-colors ${result.imported ? 'opacity-50' : ''}`}>
                          {!result.imported ? (
                            <Checkbox checked={selectedResults.has(i)} onCheckedChange={() => toggleSelectResult(i)} className="mt-0.5" />
                          ) : (
                            <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primary hover:underline truncate">{result.title}</a>
                              {result.imported && <Badge variant="secondary" className="text-[10px] h-4 shrink-0">Imported</Badge>}
                            </div>
                            <p className="text-[10px] text-muted-foreground truncate">{result.url}</p>
                            {result.description && <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{result.description}</p>}
                          </div>
                          <div className="flex gap-0.5 shrink-0">
                            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => copyToClipboard(result.markdown || result.url)}><Copy className="h-3 w-3" /></Button>
                            {!result.imported && (
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => importAsLead(result, i)} disabled={importingIndex === i}>
                                {importingIndex === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Map Tab ── */}
          <TabsContent value="map" className="space-y-4 mt-0">
            <Card className="border-border/60">
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-medium">Map Website URLs</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Discover all URLs on a website like a fast sitemap</p>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Website URL</Label>
                    <Input placeholder="https://example.com" value={mapUrl} onChange={(e) => setMapUrl(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="w-28 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Max URLs</Label>
                    <Input type="number" min={1} max={5000} value={mapLimit} onChange={(e) => setMapLimit(parseInt(e.target.value) || 100)} className="h-9 text-sm" />
                  </div>
                  <Button onClick={handleMap} disabled={mapLoading} size="sm" className="h-9">
                    {mapLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Map className="h-3.5 w-3.5 mr-1.5" /> Map</>}
                  </Button>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={includeSubdomains} onCheckedChange={setIncludeSubdomains} className="scale-90" />
                  <span className="text-xs">Include subdomains</span>
                </label>
              </CardContent>
            </Card>

            {mapResults.length > 0 && (
              <Card className="border-border/60">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
                  <h3 className="text-sm font-medium">{mapResults.length} URLs Discovered</h3>
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => downloadAsFile(mapResults.join('\n'), 'sitemap.txt')}>
                    <Download className="h-3 w-3 mr-1" /> Export
                  </Button>
                </div>
                <CardContent className="p-0">
                  <ScrollArea className="h-[400px] px-5 py-3">
                    <div className="space-y-0.5">
                      {mapResults.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block text-xs text-primary hover:underline truncate py-0.5">{url}</a>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Crawl Tab ── */}
          <TabsContent value="crawl" className="space-y-4 mt-0">
            <Card className="border-border/60">
              <CardContent className="p-5 space-y-4">
                <div>
                  <h3 className="text-sm font-medium">Crawl Entire Website</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Recursively scrape all pages on a website</p>
                </div>
                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Starting URL</Label>
                    <Input placeholder="https://example.com" value={crawlUrl} onChange={(e) => setCrawlUrl(e.target.value)} className="h-9 text-sm" />
                  </div>
                  <div className="w-28 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Max Pages</Label>
                    <Input type="number" min={1} max={1000} value={crawlLimit} onChange={(e) => setCrawlLimit(parseInt(e.target.value) || 50)} className="h-9 text-sm" />
                  </div>
                  <div className="w-24 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Depth</Label>
                    <Input type="number" min={1} max={10} value={crawlDepth} onChange={(e) => setCrawlDepth(parseInt(e.target.value) || 3)} className="h-9 text-sm" />
                  </div>
                  <Button onClick={handleCrawl} disabled={crawlLoading} size="sm" className="h-9">
                    {crawlLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Layers className="h-3.5 w-3.5 mr-1.5" /> Crawl</>}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {crawlResult && (
              <Card className="border-border/60">
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/60">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-medium">Crawl Status</h3>
                    <Badge variant={crawlResult.status === 'completed' ? 'default' : 'secondary'} className="text-[10px] h-4">
                      {crawlResult.status || 'Started'}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-5 space-y-3">
                  <div className="flex gap-6 text-xs">
                    <span>Pages: <strong>{crawlResult.completed || 0}</strong> / {crawlResult.total || '...'}</span>
                    <span>Credits: <strong>{crawlResult.creditsUsed || 0}</strong></span>
                    {crawlResult.expiresAt && <span>Expires: {new Date(crawlResult.expiresAt).toLocaleString()}</span>}
                  </div>
                  {crawlResult.data && crawlResult.data.length > 0 && (
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-1">
                        {crawlResult.data.map((page: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/40 text-xs">
                            <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className="truncate">{page.metadata?.title || page.metadata?.sourceURL || `Page ${i + 1}`}</span>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  )}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
