import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
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
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // Check admin role
  useEffect(() => {
    const checkAdminRole = async () => {
      // Wait until auth finishes resolving; otherwise we may set isAdmin=false
      // briefly and trigger an incorrect redirect.
      if (authLoading) return;

      if (!user?.id) {
        setIsAdmin(false);
        return;
      }

      // Use backend check to avoid client-side RPC permission/config issues
      const { data, error } = await supabase.functions.invoke('check-admin');

      if (error) {
        console.error('Admin check failed:', error);
        toast.error(`Admin check failed: ${error.message}`);
        setIsAdmin(false);
        return;
      }

      if (data?.error) {
        console.error('Admin check returned error:', data.error);
        toast.error(`Admin check failed: ${data.error}`);
        setIsAdmin(false);
        return;
      }

      setIsAdmin(!!data?.isAdmin);
    };

    checkAdminRole();
  }, [user?.id, authLoading]);

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

  if (isAdmin === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  if (!isAdmin) {
    navigate('/dashboard');
    toast.error('Access denied. Admin privileges required.');
    return null;
  }

  const handleScrape = async () => {
    if (!scrapeUrl.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    setScrapeLoading(true);
    setScrapeResult(null);

    try {
      const response = await firecrawlApi.scrape(scrapeUrl, {
        formats: ['markdown', 'links'],
        onlyMainContent,
      });

      if (response.success) {
        setScrapeResult(response.data?.data || response.data);
        toast.success('Page scraped successfully');
      } else {
        toast.error(response.error || 'Failed to scrape page');
      }
    } catch (error) {
      console.error('Scrape error:', error);
      toast.error('Failed to scrape page');
    } finally {
      setScrapeLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setSearchLoading(true);
    setSearchResults([]);
    setSelectedResults(new Set());

    try {
      const response = await firecrawlApi.search(searchQuery, {
        limit: searchLimit,
        scrapeOptions: { formats: ['markdown'] },
      });

      if (response.success) {
        setSearchResults((response.data || []).map((r: SearchResult) => ({ ...r, imported: false })));
        toast.success(`Found ${response.data?.length || 0} results`);
      } else {
        toast.error(response.error || 'Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setSearchLoading(false);
    }
  };

  // Extract domain name for business name
  const extractBusinessName = (url: string, title: string): string => {
    try {
      const domain = new URL(url).hostname.replace('www.', '');
      // Use title if it seems like a business name, otherwise use domain
      if (title && title.length < 60 && !title.includes('|') && !title.includes('-')) {
        return title;
      }
      // Clean up domain to make it readable
      return domain.split('.')[0].replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    } catch {
      return title || 'Unknown Business';
    }
  };

  const importAsLead = async (result: SearchResult, index: number) => {
    if (!user?.id) {
      toast.error('You must be logged in to import leads');
      return;
    }

    setImportingIndex(index);

    try {
      const businessName = extractBusinessName(result.url, result.title);
      
      const { error } = await supabase.from('leads').insert({
        client_id: user.id,
        business_name: businessName,
        website: result.url,
        notes: result.description || '',
        source_url: result.url,
        status: 'new',
      });

      if (error) throw error;

      // Mark as imported
      setSearchResults(prev => prev.map((r, i) => 
        i === index ? { ...r, imported: true } : r
      ));
      setSelectedResults(prev => {
        const next = new Set(prev);
        next.delete(index);
        return next;
      });
      
      toast.success(`Imported "${businessName}" as a new lead`);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import lead');
    } finally {
      setImportingIndex(null);
    }
  };

  const importSelectedLeads = async () => {
    if (selectedResults.size === 0) {
      toast.error('Please select at least one result to import');
      return;
    }

    setBulkImporting(true);
    let successCount = 0;
    let errorCount = 0;

    for (const index of selectedResults) {
      const result = searchResults[index];
      if (result.imported) continue;

      try {
        const businessName = extractBusinessName(result.url, result.title);
        
        const { error } = await supabase.from('leads').insert({
          client_id: user!.id,
          business_name: businessName,
          website: result.url,
          notes: result.description || '',
          source_url: result.url,
          status: 'new',
        });

        if (error) throw error;
        successCount++;
        
        // Mark as imported
        setSearchResults(prev => prev.map((r, i) => 
          i === index ? { ...r, imported: true } : r
        ));
      } catch (error) {
        console.error('Import error:', error);
        errorCount++;
      }
    }

    setSelectedResults(new Set());
    setBulkImporting(false);

    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} lead${successCount > 1 ? 's' : ''}`);
    }
    if (errorCount > 0) {
      toast.error(`Failed to import ${errorCount} lead${errorCount > 1 ? 's' : ''}`);
    }
  };

  const toggleSelectResult = (index: number) => {
    setSelectedResults(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedResults.size === searchResults.filter(r => !r.imported).length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(searchResults.map((r, i) => r.imported ? -1 : i).filter(i => i >= 0)));
    }
  };

  const handleMap = async () => {
    if (!mapUrl.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    setMapLoading(true);
    setMapResults([]);

    try {
      const response = await firecrawlApi.map(mapUrl, {
        limit: mapLimit,
        includeSubdomains,
      });

      if (response.success) {
        const links = response.data?.links || response.links || [];
        setMapResults(links);
        toast.success(`Found ${links.length} URLs`);
      } else {
        toast.error(response.error || 'Failed to map website');
      }
    } catch (error) {
      console.error('Map error:', error);
      toast.error('Failed to map website');
    } finally {
      setMapLoading(false);
    }
  };

  const handleCrawl = async () => {
    if (!crawlUrl.trim()) {
      toast.error('Please enter a URL');
      return;
    }

    setCrawlLoading(true);
    setCrawlResult(null);

    try {
      const response = await firecrawlApi.crawl(crawlUrl, {
        limit: crawlLimit,
        maxDepth: crawlDepth,
      });

      if (response.success) {
        setCrawlResult(response);
        toast.success('Crawl started! Check back for results.');
      } else {
        toast.error(response.error || 'Failed to start crawl');
      }
    } catch (error) {
      console.error('Crawl error:', error);
      toast.error('Failed to start crawl');
    } finally {
      setCrawlLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const downloadAsFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRealEstateScrape = async () => {
    if (!reLocation.trim()) {
      toast.error('Please enter a location');
      return;
    }

    setReLoading(true);
    setReListings([]);
    setReErrors([]);
    setReSkipTraceStats(null);

    try {
      // Use the combined scrape + skip trace workflow
      const response = await firecrawlApi.scrapeAndTraceFSBO({
        location: reLocation,
        platform: rePlatform as any,
        listingType: reListingType,
        enableSkipTrace: reEnableSkipTrace,
        saveToDatabase: reSaveToDb,
      });

      if (response.success) {
        setReListings(response.listings || []);
        if (response.errors && response.errors.length > 0) {
          setReErrors(response.errors);
        }
        if (response.skip_trace_stats) {
          setReSkipTraceStats(response.skip_trace_stats);
        }
        
        const skipInfo = reEnableSkipTrace && response.skip_trace_stats 
          ? ` (${response.skip_trace_stats.successful}/${response.skip_trace_stats.attempted} skip traced)` 
          : '';
        toast.success(`Found ${response.total || 0} FSBO/FRBO listings${skipInfo}`);
        
        if (reSaveToDb && response.saved_to_database) {
          toast.success(`Saved ${response.saved_to_database} leads to database`);
        }
      } else {
        toast.error(response.error || 'Failed to scrape real estate listings');
      }
    } catch (error) {
      console.error('Real estate scrape error:', error);
      toast.error('Failed to scrape real estate listings');
    } finally {
      setReLoading(false);
    }
  };

  const exportListingsToCSV = () => {
    if (reListings.length === 0) return;
    
    const headers = [
      'Address', 'Bedrooms', 'Bathrooms', 'Price', 'Days on Market', 
      'Favorites', 'Views', 'Listing Type', 'Property Type', 'Sq Ft',
      'Year Built', 'Owner Name', 'Owner Phone', 'Owner Email', 'Source URL'
    ];
    
    const rows = reListings.map(l => [
      l.address || '',
      l.bedrooms || '',
      l.bathrooms || '',
      l.price || '',
      l.days_on_market || '',
      l.favorites_count || '',
      l.views_count || '',
      l.listing_type || '',
      l.property_type || '',
      l.square_feet || '',
      l.year_built || '',
      l.owner_name || '',
      l.owner_phone || '',
      l.owner_email || '',
      l.source_url || '',
    ]);
    
    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    downloadAsFile(csv, `fsbo-listings-${new Date().toISOString().split('T')[0]}.csv`);
    toast.success('Exported listings to CSV');
  };

  // Skip trace a single listing
  const handleSkipTraceListing = async (listing: any, index: number) => {
    if (!listing.address) {
      toast.error('No address available for skip trace');
      return;
    }

    setSkipTracingIndex(index);
    try {
      const parsed = skipTraceApi.parseAddress(listing.address);
      const result = await skipTraceApi.lookupOwner(parsed);

      if (result.success && result.data) {
        // Update the listing with the skip trace data
        setReListings(prev => prev.map((l, i) => {
          if (i !== index) return l;
          return {
            ...l,
            owner_name: result.data!.fullName || l.owner_name,
            owner_phone: result.data!.phones[0]?.number || l.owner_phone,
            owner_email: result.data!.emails[0]?.address || l.owner_email,
            all_phones: result.data!.phones,
            all_emails: result.data!.emails,
            skip_trace_confidence: result.data!.confidence,
            skip_trace_status: 'success',
          };
        }));
        toast.success(`Found owner info: ${result.data.fullName || 'Contact data retrieved'}`);
      } else {
        toast.error(result.error || result.message || 'No owner info found');
        setReListings(prev => prev.map((l, i) => {
          if (i !== index) return l;
          return { ...l, skip_trace_status: 'not_found' };
        }));
      }
    } catch (error) {
      console.error('Skip trace error:', error);
      toast.error('Failed to skip trace');
    } finally {
      setSkipTracingIndex(null);
    }
  };

  // Retry skip trace for listings that previously failed
  const handleRetrySkipTrace = async (listing: any, index: number) => {
    if (!listing.address) {
      toast.error('No address available for skip trace');
      return;
    }

    // Clear the previous status and retry
    setReListings(prev => prev.map((l, i) => {
      if (i !== index) return l;
      return { ...l, skip_trace_status: undefined };
    }));

    setSkipTracingIndex(index);
    try {
      const parsed = skipTraceApi.parseAddress(listing.address);
      const result = await skipTraceApi.lookupOwner(parsed);

      if (result.success && result.data) {
        setReListings(prev => prev.map((l, i) => {
          if (i !== index) return l;
          return {
            ...l,
            owner_name: result.data!.fullName || l.owner_name,
            owner_phone: result.data!.phones[0]?.number || l.owner_phone,
            owner_email: result.data!.emails[0]?.address || l.owner_email,
            all_phones: result.data!.phones,
            all_emails: result.data!.emails,
            skip_trace_confidence: result.data!.confidence,
            skip_trace_status: 'success',
          };
        }));
        toast.success(`Found owner info: ${result.data.fullName || 'Contact data retrieved'}`);
      } else {
        toast.error(result.error || result.message || 'Still no owner info found');
        setReListings(prev => prev.map((l, i) => {
          if (i !== index) return l;
          return { ...l, skip_trace_status: 'not_found' };
        }));
      }
    } catch (error) {
      console.error('Retry skip trace error:', error);
      toast.error('Failed to retry skip trace');
      setReListings(prev => prev.map((l, i) => {
        if (i !== index) return l;
        return { ...l, skip_trace_status: 'not_found' };
      }));
    } finally {
      setSkipTracingIndex(null);
    }
  };

  // Save a single listing to database
  const handleSaveListing = async (listing: any, index: number) => {
    if (!user?.id) {
      toast.error('You must be logged in');
      return;
    }

    setSavingIndex(index);
    try {
      const { error } = await supabase.from('scraped_leads').insert({
        domain: listing.source_url ? new URL(listing.source_url).hostname : 'unknown',
        source_url: listing.source_url || listing.listing_url,
        full_name: listing.owner_name,
        best_email: listing.owner_email,
        best_phone: listing.owner_phone,
        all_emails: listing.all_emails?.map((e: any) => e.address || e) || (listing.owner_email ? [listing.owner_email] : []),
        all_phones: listing.all_phones?.map((p: any) => p.number || p) || (listing.owner_phone ? [listing.owner_phone] : []),
        status: 'new',
        confidence_score: listing.skip_trace_confidence || 50,
        lead_type: 'person',
        source_type: 'real_estate_scraper',
        schema_data: {
          address: listing.address,
          bedrooms: listing.bedrooms,
          bathrooms: listing.bathrooms,
          price: listing.price,
          days_on_market: listing.days_on_market,
          property_type: listing.property_type,
          square_feet: listing.square_feet,
          year_built: listing.year_built,
          listing_type: listing.listing_type,
          source_platform: listing.source_platform,
        },
        enrichment_providers_used: listing.skip_trace_status === 'success' ? ['tracerfy'] : [],
      });

      if (error) throw error;

      // Mark as saved
      setReListings(prev => prev.map((l, i) => {
        if (i !== index) return l;
        return { ...l, saved_to_db: true };
      }));
      toast.success('Lead saved to database');
    } catch (error) {
      console.error('Save error:', error);
      toast.error('Failed to save lead');
    } finally {
      setSavingIndex(null);
    }
  };

  // Toggle selection for bulk actions
  const toggleListingSelection = (index: number) => {
    setSelectedListings(prev => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  // Select/deselect all listings
  const toggleSelectAllListings = () => {
    if (selectedListings.size === reListings.filter(l => !l.saved_to_db).length) {
      setSelectedListings(new Set());
    } else {
      setSelectedListings(new Set(reListings.map((l, i) => l.saved_to_db ? -1 : i).filter(i => i >= 0)));
    }
  };

  // Bulk skip trace selected listings
  const handleBulkSkipTrace = async () => {
    const toProcess = Array.from(selectedListings)
      .filter(i => reListings[i] && !reListings[i].owner_phone && !reListings[i].skip_trace_status);
    
    if (toProcess.length === 0) {
      toast.error('No listings to skip trace (already have contact info or already traced)');
      return;
    }

    setBulkSkipTracing(true);
    let successCount = 0;
    let errorCount = 0;

    for (const index of toProcess) {
      const listing = reListings[index];
      if (!listing.address) continue;

      try {
        const parsed = skipTraceApi.parseAddress(listing.address);
        const result = await skipTraceApi.lookupOwner(parsed);

        if (result.success && result.data) {
          setReListings(prev => prev.map((l, i) => {
            if (i !== index) return l;
            return {
              ...l,
              owner_name: result.data!.fullName || l.owner_name,
              owner_phone: result.data!.phones[0]?.number || l.owner_phone,
              owner_email: result.data!.emails[0]?.address || l.owner_email,
              all_phones: result.data!.phones,
              all_emails: result.data!.emails,
              skip_trace_confidence: result.data!.confidence,
              skip_trace_status: 'success',
            };
          }));
          successCount++;
        } else {
          setReListings(prev => prev.map((l, i) => {
            if (i !== index) return l;
            return { ...l, skip_trace_status: 'not_found' };
          }));
          errorCount++;
        }
      } catch (error) {
        errorCount++;
      }
    }

    setBulkSkipTracing(false);
    toast.success(`Skip traced ${successCount} listings (${errorCount} not found)`);
  };

  // Bulk save selected listings
  const handleBulkSave = async () => {
    const toSave = Array.from(selectedListings).filter(i => reListings[i] && !reListings[i].saved_to_db);
    
    if (toSave.length === 0) {
      toast.error('No new listings to save');
      return;
    }

    setBulkSaving(true);
    let successCount = 0;
    let errorCount = 0;

    for (const index of toSave) {
      const listing = reListings[index];
      try {
        const { error } = await supabase.from('scraped_leads').insert({
          domain: listing.source_url ? new URL(listing.source_url).hostname : 'unknown',
          source_url: listing.source_url || listing.listing_url,
          full_name: listing.owner_name,
          best_email: listing.owner_email,
          best_phone: listing.owner_phone,
          all_emails: listing.all_emails?.map((e: any) => e.address || e) || (listing.owner_email ? [listing.owner_email] : []),
          all_phones: listing.all_phones?.map((p: any) => p.number || p) || (listing.owner_phone ? [listing.owner_phone] : []),
          status: 'new',
          confidence_score: listing.skip_trace_confidence || 50,
          lead_type: 'person',
          source_type: 'real_estate_scraper',
          schema_data: {
            address: listing.address,
            bedrooms: listing.bedrooms,
            bathrooms: listing.bathrooms,
            price: listing.price,
            days_on_market: listing.days_on_market,
            property_type: listing.property_type,
            square_feet: listing.square_feet,
            year_built: listing.year_built,
            listing_type: listing.listing_type,
            source_platform: listing.source_platform,
          },
          enrichment_providers_used: listing.skip_trace_status === 'success' ? ['tracerfy'] : [],
        });

        if (error) throw error;
        
        setReListings(prev => prev.map((l, i) => {
          if (i !== index) return l;
          return { ...l, saved_to_db: true };
        }));
        successCount++;
      } catch (error) {
        errorCount++;
      }
    }

    setSelectedListings(new Set());
    setBulkSaving(false);
    toast.success(`Saved ${successCount} leads (${errorCount} failed)`);
  };

  return (
    <DashboardLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Web Scraper</h1>
          <p className="text-muted-foreground">Scrape websites, search the web, and crawl entire domains</p>
        </div>
        <Button onClick={() => setProspectSearchOpen(true)} className="bg-gradient-to-r from-primary to-purple-600">
          <Target className="h-4 w-4 mr-2" />
          Prospect Search (ZoomInfo-style)
        </Button>
      </div>

      <ProspectSearchDialog 
        open={prospectSearchOpen} 
        onOpenChange={setProspectSearchOpen}
      />

      <Tabs defaultValue="real-estate" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="real-estate" className="flex items-center gap-2">
            <Home className="h-4 w-4" />
            Real Estate
          </TabsTrigger>
          <TabsTrigger value="scrape" className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Scrape
          </TabsTrigger>
          <TabsTrigger value="search" className="flex items-center gap-2">
            <Search className="h-4 w-4" />
            Search
          </TabsTrigger>
          <TabsTrigger value="map" className="flex items-center gap-2">
            <Map className="h-4 w-4" />
            Map
          </TabsTrigger>
          <TabsTrigger value="crawl" className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            Crawl
          </TabsTrigger>
        </TabsList>

        {/* Real Estate Tab */}
        <TabsContent value="real-estate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                FSBO & FRBO Listing Scraper
              </CardTitle>
              <CardDescription>
                Scrape For Sale By Owner and For Rent By Owner listings from Zillow, Apartments.com, Hotpads, FSBO.com, Trulia, Redfin, and more
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-2">
                  <Label htmlFor="re-location">Location</Label>
                  <Input
                    id="re-location"
                    placeholder="e.g., Austin, TX or 90210"
                    value={reLocation}
                    onChange={(e) => setReLocation(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Platform</Label>
                  <Select value={rePlatform} onValueChange={setRePlatform}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select platform" />
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
                <div className="space-y-2">
                  <Label>Listing Type</Label>
                  <Select value={reListingType} onValueChange={(v) => setReListingType(v as 'sale' | 'rent')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="sale">For Sale (FSBO)</SelectItem>
                      <SelectItem value="rent">For Rent (FRBO)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <Button onClick={handleRealEstateScrape} disabled={reLoading} className="w-full">
                    {reLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        {reEnableSkipTrace ? 'Scraping & Skip Tracing...' : 'Scraping...'}
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Find Listings
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Skip Trace & Save Options */}
              <div className="flex flex-wrap gap-6 p-4 rounded-lg border border-border bg-muted/30">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="enable-skip-trace"
                    checked={reEnableSkipTrace}
                    onCheckedChange={setReEnableSkipTrace}
                  />
                  <Label htmlFor="enable-skip-trace" className="cursor-pointer">
                    <span className="font-medium">Auto Skip Trace</span>
                    <span className="text-xs text-muted-foreground ml-2">~$0.009/address via Tracerfy</span>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="save-to-db"
                    checked={reSaveToDb}
                    onCheckedChange={setReSaveToDb}
                  />
                  <Label htmlFor="save-to-db" className="cursor-pointer">
                    <span className="font-medium">Save to Database</span>
                    <span className="text-xs text-muted-foreground ml-2">Store leads in Scraped Leads</span>
                  </Label>
                </div>
              </div>
              
              <div className="rounded-lg border border-border bg-muted/50 p-4">
                <h4 className="font-medium text-sm mb-2">Extracted Fields:</h4>
                <div className="flex flex-wrap gap-2">
                  {['Address', 'Beds', 'Baths', 'Price', 'Days on Market', 'Favorites', 'Views', 'Owner Name', 'Owner Phone', 'Owner Email', 'Source Link'].map(field => (
                    <Badge key={field} variant="secondary" className="text-xs">{field}</Badge>
                  ))}
                  {reEnableSkipTrace && (
                    <Badge variant="default" className="text-xs bg-green-600">+ Skip Trace Data</Badge>
                  )}
                </div>
              </div>

              {/* Skip Trace Stats */}
              {reSkipTraceStats && (
                <div className="rounded-lg border border-green-500/50 bg-green-500/10 p-4">
                  <h4 className="font-medium text-sm text-green-700 dark:text-green-400 mb-2">Skip Trace Results</h4>
                  <div className="flex gap-6 text-sm">
                    <div>
                      <span className="text-muted-foreground">Attempted: </span>
                      <span className="font-medium">{reSkipTraceStats.attempted}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Successful: </span>
                      <span className="font-medium text-green-600">{reSkipTraceStats.successful}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Success Rate: </span>
                      <span className="font-medium">{reSkipTraceStats.rate}%</span>
                    </div>
                  </div>
                </div>
              )}

              {reErrors.length > 0 && (
                <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4">
                  <h4 className="font-medium text-sm text-destructive mb-2">Some sites couldn't be scraped:</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {reErrors.map((err, i) => (
                      <li key={i} className="truncate">• {err.url}: {err.error}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-muted-foreground mt-2">
                    Note: Some sites have anti-scraping protections that may block requests.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {reListings.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between flex-wrap gap-2">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {reListings.length} Listings Found
                    {selectedListings.size > 0 && (
                      <Badge variant="secondary">{selectedListings.size} selected</Badge>
                    )}
                  </CardTitle>
                  <CardDescription>FSBO/FRBO listings with owner contact info</CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={toggleSelectAllListings}>
                    <Users className="mr-2 h-4 w-4" />
                    {selectedListings.size === reListings.filter(l => !l.saved_to_db).length ? 'Deselect All' : 'Select All'}
                  </Button>
                  {selectedListings.size > 0 && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleBulkSkipTrace}
                        disabled={bulkSkipTracing}
                      >
                        {bulkSkipTracing ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RotateCw className="mr-2 h-4 w-4" />
                        )}
                        Skip Trace Selected
                      </Button>
                      <Button 
                        size="sm" 
                        onClick={handleBulkSave}
                        disabled={bulkSaving}
                      >
                        {bulkSaving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Save className="mr-2 h-4 w-4" />
                        )}
                        Save Selected
                      </Button>
                    </>
                  )}
                  <Button variant="outline" size="sm" onClick={exportListingsToCSV}>
                    <Download className="mr-2 h-4 w-4" />
                    Export CSV
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {reListings.map((listing, index) => (
                      <div 
                        key={index} 
                        className={`rounded-lg border p-4 space-y-3 transition-colors ${
                          selectedListings.has(index) ? 'border-primary bg-primary/5' : ''
                        } ${listing.saved_to_db ? 'opacity-60' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          {/* Selection checkbox */}
                          {!listing.saved_to_db && (
                            <Checkbox
                              checked={selectedListings.has(index)}
                              onCheckedChange={() => toggleListingSelection(index)}
                              className="mt-1"
                            />
                          )}
                          {listing.saved_to_db && (
                            <div className="mt-1">
                              <Check className="h-4 w-4 text-green-500" />
                            </div>
                          )}
                          
                          <div className="flex-1 space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <div className="flex items-center gap-2">
                                  <h4 className="font-semibold">{listing.address || 'Address not available'}</h4>
                                  {listing.saved_to_db && (
                                    <Badge variant="secondary" className="text-xs">Saved</Badge>
                                  )}
                                  {listing.skip_trace_status === 'success' && (
                                    <Badge className="bg-green-500/20 text-green-600 text-xs">Skip Traced</Badge>
                                  )}
                                  {listing.skip_trace_status === 'not_found' && (
                                    <Badge variant="outline" className="text-xs">No Owner Found</Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {listing.property_type} • {listing.bedrooms} bed • {listing.bathrooms} bath
                                  {listing.square_feet && ` • ${listing.square_feet.toLocaleString()} sq ft`}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="text-lg font-bold text-primary">{listing.price || 'Price N/A'}</p>
                                {listing.days_on_market && (
                                  <p className="text-xs text-muted-foreground">{listing.days_on_market} days on market</p>
                                )}
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
                              {listing.favorites_count !== undefined && (
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground">Favorites:</span>
                                  <Badge variant="outline">{listing.favorites_count}</Badge>
                                </div>
                              )}
                              {listing.views_count !== undefined && (
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground">Views:</span>
                                  <Badge variant="outline">{listing.views_count}</Badge>
                                </div>
                              )}
                              {listing.listing_type && (
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground">Type:</span>
                                  <Badge variant="secondary">{listing.listing_type.toUpperCase()}</Badge>
                                </div>
                              )}
                              {listing.source_platform && (
                                <div className="flex items-center gap-1">
                                  <span className="text-muted-foreground">Source:</span>
                                  <Badge>{listing.source_platform}</Badge>
                                </div>
                              )}
                            </div>

                            {/* Owner Contact Section */}
                            {(listing.owner_name || listing.owner_phone || listing.owner_email) ? (
                              <div className="rounded-md bg-primary/10 p-3">
                                <h5 className="text-sm font-medium mb-1">Owner Contact</h5>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                                  {listing.owner_name && (
                                    <div>
                                      <span className="text-muted-foreground">Name: </span>
                                      <span className="font-medium">{listing.owner_name}</span>
                                    </div>
                                  )}
                                  {listing.owner_phone && (
                                    <div className="flex items-center gap-1">
                                      <PhoneIcon className="h-3 w-3 text-muted-foreground" />
                                      <a href={`tel:${listing.owner_phone}`} className="font-medium text-primary hover:underline">
                                        {listing.owner_phone}
                                      </a>
                                    </div>
                                  )}
                                  {listing.owner_email && (
                                    <div className="flex items-center gap-1">
                                      <MailIcon className="h-3 w-3 text-muted-foreground" />
                                      <a href={`mailto:${listing.owner_email}`} className="font-medium text-primary hover:underline">
                                        {listing.owner_email}
                                      </a>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
                                No owner contact info available. Use Skip Trace to find the owner.
                              </div>
                            )}

                            {/* Action buttons */}
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <div className="flex gap-2">
                                {/* Show Skip Trace for listings without owner phone and no prior attempt */}
                                {!listing.owner_phone && !listing.skip_trace_status && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSkipTraceListing(listing, index)}
                                    disabled={skipTracingIndex === index}
                                  >
                                    {skipTracingIndex === index ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <RotateCw className="mr-2 h-4 w-4" />
                                    )}
                                    Skip Trace
                                  </Button>
                                )}
                                {/* Show Retry Skip Trace for listings that failed (not_found status) */}
                                {listing.skip_trace_status === 'not_found' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleRetrySkipTrace(listing, index)}
                                    disabled={skipTracingIndex === index}
                                    className="border-orange-500/50 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
                                  >
                                    {skipTracingIndex === index ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <RotateCw className="mr-2 h-4 w-4" />
                                    )}
                                    Retry Skip Trace
                                  </Button>
                                )}
                                {!listing.saved_to_db && (
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveListing(listing, index)}
                                    disabled={savingIndex === index}
                                  >
                                    {savingIndex === index ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Save className="mr-2 h-4 w-4" />
                                    )}
                                    Save Lead
                                  </Button>
                                )}
                              </div>
                              {listing.source_url && (
                                <a 
                                  href={listing.source_url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline flex items-center gap-1"
                                >
                                  View Original <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </div>
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

        {/* Scrape Tab */}
        <TabsContent value="scrape" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Scrape a Single Page</CardTitle>
              <CardDescription>
                Extract content from any URL in markdown format
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="scrape-url">URL to Scrape</Label>
                <Input
                  id="scrape-url"
                  placeholder="https://example.com"
                  value={scrapeUrl}
                  onChange={(e) => setScrapeUrl(e.target.value)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="main-content"
                  checked={onlyMainContent}
                  onCheckedChange={setOnlyMainContent}
                />
                <Label htmlFor="main-content">Only main content (exclude headers/footers)</Label>
              </div>
              <Button onClick={handleScrape} disabled={scrapeLoading}>
                {scrapeLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Scraping...
                  </>
                ) : (
                  <>
                    <Globe className="mr-2 h-4 w-4" />
                    Scrape Page
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {scrapeResult && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">
                    {scrapeResult.metadata?.title || 'Scraped Content'}
                  </CardTitle>
                  {scrapeResult.metadata?.sourceURL && (
                    <CardDescription className="flex items-center gap-1">
                      <ExternalLink className="h-3 w-3" />
                      {scrapeResult.metadata.sourceURL}
                    </CardDescription>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => copyToClipboard(scrapeResult.markdown || '')}
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => downloadAsFile(scrapeResult.markdown || '', 'scraped-content.md')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px] rounded-md border p-4">
                  <pre className="whitespace-pre-wrap text-sm">
                    {scrapeResult.markdown}
                  </pre>
                </ScrollArea>
                {scrapeResult.links && scrapeResult.links.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Found Links ({scrapeResult.links.length})</h4>
                    <ScrollArea className="h-[150px]">
                      <div className="space-y-1">
                        {scrapeResult.links.slice(0, 50).map((link, i) => (
                          <a 
                            key={i} 
                            href={link} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="block text-sm text-primary hover:underline truncate"
                          >
                            {link}
                          </a>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Search & Discover Leads</CardTitle>
              <CardDescription>
                Search the web for potential leads and scrape their information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="search-query">Search Query</Label>
                <Input
                  id="search-query"
                  placeholder="e.g., roofing companies in Dallas Texas"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="search-limit">Number of Results</Label>
                <Input
                  id="search-limit"
                  type="number"
                  min={1}
                  max={100}
                  value={searchLimit}
                  onChange={(e) => setSearchLimit(parseInt(e.target.value) || 10)}
                />
              </div>
              <Button onClick={handleSearch} disabled={searchLoading}>
                {searchLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="mr-2 h-4 w-4" />
                    Search Web
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {searchResults.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Search Results ({searchResults.length})</CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={toggleSelectAll}
                  >
                    {selectedResults.size === searchResults.filter(r => !r.imported).length ? 'Deselect All' : 'Select All'}
                  </Button>
                  <Button
                    size="sm"
                    onClick={importSelectedLeads}
                    disabled={selectedResults.size === 0 || bulkImporting}
                  >
                    {bulkImporting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Importing...
                      </>
                    ) : (
                      <>
                        <UserPlus className="mr-2 h-4 w-4" />
                        Import Selected ({selectedResults.size})
                      </>
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[500px]">
                  <div className="space-y-4">
                    {searchResults.map((result, i) => (
                      <Card key={i} className={`p-4 ${result.imported ? 'opacity-60 bg-muted/50' : ''}`}>
                        <div className="flex items-start gap-3">
                          {!result.imported && (
                            <Checkbox
                              checked={selectedResults.has(i)}
                              onCheckedChange={() => toggleSelectResult(i)}
                              className="mt-1"
                            />
                          )}
                          {result.imported && (
                            <div className="mt-1">
                              <Check className="h-4 w-4 text-green-500" />
                            </div>
                          )}
                          <div className="space-y-1 flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <a 
                                href={result.url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="font-medium text-primary hover:underline block truncate"
                              >
                                {result.title}
                              </a>
                              {result.imported && (
                                <Badge variant="secondary" className="text-xs">Imported</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground truncate">
                              {result.url}
                            </p>
                            {result.description && (
                              <p className="text-sm mt-2">{result.description}</p>
                            )}
                          </div>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => copyToClipboard(result.markdown || result.url)}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                            {!result.imported && (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => importAsLead(result, i)}
                                disabled={importingIndex === i}
                              >
                                {importingIndex === i ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <UserPlus className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Map Tab */}
        <TabsContent value="map" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Map Website URLs</CardTitle>
              <CardDescription>
                Quickly discover all URLs on a website (like a fast sitemap)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="map-url">Website URL</Label>
                <Input
                  id="map-url"
                  placeholder="https://example.com"
                  value={mapUrl}
                  onChange={(e) => setMapUrl(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="map-limit">Max URLs to Return</Label>
                <Input
                  id="map-limit"
                  type="number"
                  min={1}
                  max={5000}
                  value={mapLimit}
                  onChange={(e) => setMapLimit(parseInt(e.target.value) || 100)}
                />
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="subdomains"
                  checked={includeSubdomains}
                  onCheckedChange={setIncludeSubdomains}
                />
                <Label htmlFor="subdomains">Include subdomains</Label>
              </div>
              <Button onClick={handleMap} disabled={mapLoading}>
                {mapLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Mapping...
                  </>
                ) : (
                  <>
                    <Map className="mr-2 h-4 w-4" />
                    Map Website
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {mapResults.length > 0 && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Discovered URLs ({mapResults.length})</CardTitle>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => downloadAsFile(mapResults.join('\n'), 'sitemap.txt')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </Button>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[400px]">
                  <div className="space-y-1">
                    {mapResults.map((url, i) => (
                      <a 
                        key={i}
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block text-sm text-primary hover:underline truncate py-1"
                      >
                        {url}
                      </a>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Crawl Tab */}
        <TabsContent value="crawl" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Crawl Entire Website</CardTitle>
              <CardDescription>
                Recursively scrape all pages on a website
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="crawl-url">Starting URL</Label>
                <Input
                  id="crawl-url"
                  placeholder="https://example.com"
                  value={crawlUrl}
                  onChange={(e) => setCrawlUrl(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="crawl-limit">Max Pages to Crawl</Label>
                  <Input
                    id="crawl-limit"
                    type="number"
                    min={1}
                    max={1000}
                    value={crawlLimit}
                    onChange={(e) => setCrawlLimit(parseInt(e.target.value) || 50)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="crawl-depth">Max Depth</Label>
                  <Input
                    id="crawl-depth"
                    type="number"
                    min={1}
                    max={10}
                    value={crawlDepth}
                    onChange={(e) => setCrawlDepth(parseInt(e.target.value) || 3)}
                  />
                </div>
              </div>
              <Button onClick={handleCrawl} disabled={crawlLoading}>
                {crawlLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting Crawl...
                  </>
                ) : (
                  <>
                    <Layers className="mr-2 h-4 w-4" />
                    Start Crawl
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {crawlResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  Crawl Status
                  <Badge variant={crawlResult.status === 'completed' ? 'default' : 'secondary'}>
                    {crawlResult.status || 'Started'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <p><strong>Pages Completed:</strong> {crawlResult.completed || 0}</p>
                  <p><strong>Total Pages:</strong> {crawlResult.total || 'Calculating...'}</p>
                  <p><strong>Credits Used:</strong> {crawlResult.creditsUsed || 0}</p>
                  {crawlResult.expiresAt && (
                    <p><strong>Expires:</strong> {new Date(crawlResult.expiresAt).toLocaleString()}</p>
                  )}
                </div>
                {crawlResult.data && crawlResult.data.length > 0 && (
                  <div className="mt-4">
                    <h4 className="font-medium mb-2">Crawled Pages ({crawlResult.data.length})</h4>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {crawlResult.data.map((page: any, i: number) => (
                          <Card key={i} className="p-3">
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm font-medium truncate">
                                {page.metadata?.title || page.metadata?.sourceURL || `Page ${i + 1}`}
                              </span>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </DashboardLayout>
  );
}
