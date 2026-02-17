import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useIsAdmin } from '@/hooks/useIsAdmin';
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
import { scraperBackendApi, buildHotpadsUrl, buildTruliaUrl } from '@/lib/api/scraperBackend';
import { supabase } from '@/integrations/supabase/client';
import { BrivanoLens } from '@/components/scraper/ProspectSearchDialog';
import { 
  Search, 
  Loader2, 
  ExternalLink, 
  Copy, 
  Download,
  UserPlus,
  Check,
  Home,
  Building,
  Building2,
  Target,
  Phone as PhoneIcon,
  Mail as MailIcon,
  MailCheck,
  Save,
  RotateCw,
  MapPin,
  Send,
  Bot,
  Sparkles,
  FileSpreadsheet,
  FileUp,
  TrendingUp,
  Users,
  UserSearch,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { lazy, Suspense } from 'react';
const ListingsMap = lazy(() => import('@/components/scraper/ListingsMap'));
import { getPlatformLogo, PLATFORM_CONFIG } from '@/lib/platformLogos';

const LOCATION_SUGGESTIONS = ['Washington', 'Minneapolis', 'Chicago', 'New York', 'San Francisco', 'Los Angeles'];

type ChatMsg = { role: 'user' | 'assistant'; content: string; appliedFilters?: Record<string, any> };

type SearchResult = {
  url: string;
  title: string;
  description?: string;
  markdown?: string;
  imported?: boolean;
};

export default function WebScraper() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: adminLoading } = useIsAdmin();
  const navigate = useNavigate();

  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLimit, setSearchLimit] = useState(10);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [importingIndex, setImportingIndex] = useState<number | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);

  // Real Estate state
  const [reLocation, setReLocation] = useState('');
  const [locationDropdownOpen, setLocationDropdownOpen] = useState(false);
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
  const [showMap, setShowMap] = useState(true);

  // Prospect Search state
  const [prospectSearchOpen, setProspectSearchOpen] = useState(false);
  const [externalFilters, setExternalFilters] = useState<Record<string, any> | null>(null);

  // Tab state (controlled)
  const [activeTab, setActiveTab] = useState('ai-chat');
  const [lensSearchTypeActive, setLensSearchTypeActive] = useState(false);

  // AI Chat state
  const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  if (authLoading || adminLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64 text-muted-foreground">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }


  // ── AI Chat Handler (uses prospect-search-chat with tool calling) ──
  const handleChatSend = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg: ChatMsg = { role: 'user', content: chatInput.trim() };
    setChatMessages(prev => [...prev, userMsg]);
    setChatInput('');
    setChatLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        setChatMessages(prev => [...prev, { role: 'assistant', content: 'Please sign in to use the AI assistant.' }]);
      return;
    }

      const { data, error: invokeError } = await supabase.functions.invoke('prospect-search-chat', {
        body: {
          messages: [...chatMessages, userMsg].map((m) => ({ role: m.role, content: m.content })),
        },
      });

      if (invokeError) throw invokeError;

      
      const assistantMsg: ChatMsg = {
        role: 'assistant',
        content: data.content || "I've configured your search filters. Switching to Brivano Lens now...",
        appliedFilters: data.filters || undefined,
      };
      setChatMessages(prev => [...prev, assistantMsg]);

      // If filters were returned, apply them and switch to Brivano Lens
      if (data.filters) {
        setExternalFilters(data.filters);
        setActiveTab('prospect-search');
        toast.success('Filters applied — switched to Brivano Lens');
      }
    } catch {
      toast.error('Failed to get AI response');
      setChatMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setChatLoading(false);
    }
  };

  const useCaseChips = [
    { label: 'List building', icon: 'Users' },
    { label: 'Account research & scoring', icon: 'TrendingUp' },
    { label: 'Inbound lead enrichment & routing', icon: 'MailCheck' },
    { label: 'Personalized outbound', icon: 'Send' },
  ];

  const sourceCards = [
    { label: 'Find people', icon: 'UserSearch', tab: 'prospect-search' },
    { label: 'Find companies', icon: 'Building2', tab: 'prospect-search' },
    { label: 'Local businesses', icon: 'MapPin', tab: 'search' },
    { label: 'Real estate', icon: 'Home', tab: 'real-estate' },
    { label: 'Import CSV', icon: 'FileUp', tab: 'csv-enrichment' },
    { label: 'AI search', icon: 'Sparkles', tab: 'ai-chat' },
  ];

  const chatSuggestions = [
    "Find property management companies in California",
    "SaaS companies with 50-200 employees",
    "Restaurants in New York",
    "Help me find roofing contractors in Texas",
  ];

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

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied to clipboard'); };
  const downloadAsFile = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/plain' }); const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
  };

  const handleRealEstateScrape = async () => {
    if (!reLocation.trim()) { toast.error('Please enter a location'); return; }
    setReLoading(true); setReListings([]); setReErrors([]); setReSkipTraceStats(null);

    const isHotpads = rePlatform === 'hotpads';
    const isTrulia = rePlatform === 'trulia';

    try {
      if (isHotpads) {
        // Check backend once so we show a clear message without multiple connection-refused console errors
        const backendReachable = await scraperBackendApi.isScraperBackendReachable();
        if (!backendReachable) {
          toast.error('HotPads scraper backend is not running. Start the backend server (e.g. port 8080) or use "All Platforms" for FSBO/FRBO scraping.');
          setReLoading(false);
          return;
        }
        // Build Hotpads URL on frontend to avoid backend search-location 500/encoding issues
        // When "For Rent (FRBO)" is selected, use FRBO-only URL (for-rent-by-owner); otherwise general rentals
        const propertyType = reListingType === 'rent' ? 'for-rent-by-owner' : 'apartments';
        let url: string | null = buildHotpadsUrl(reLocation.trim(), propertyType);
        if (!url) {
          toast.error('Could not build Hotpads URL. Use a city (e.g. Minneapolis, Washington, Chicago, New York, San Francisco, Los Angeles) or "City, ST" (e.g. Minneapolis, MN or Chicago IL).');
          setReLoading(false);
          return;
        }
        // Reset and always send force=1 so backend clears "already running" (works with any backend version)
        await scraperBackendApi.resetHotpadsStatus();
        const triggerRes = await scraperBackendApi.triggerFromUrl(url, { force: true });
        if (triggerRes.error) {
          toast.error(triggerRes.error);
          return;
        }
        toast.info('Hotpads scraper started. Waiting for results…');
        const pollInterval = 2000;
        const maxWait = 5 * 60 * 1000;
        const start = Date.now();
        let status = await scraperBackendApi.getHotpadsStatus();
        while (status.status === 'running' && Date.now() - start < maxWait) {
          await new Promise((r) => setTimeout(r, pollInterval));
          status = await scraperBackendApi.getHotpadsStatus();
        }
        if (status.status === 'running') {
          toast.warning('Scraper is still running. Results may appear later. You can refresh or run again.');
        }
        const result = await scraperBackendApi.getHotpadsLastResult();
        const mapped = (result.listings || []).map((l) => ({
          address: l.address,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          price: l.price,
          owner_name: l.owner_name,
          owner_phone: l.owner_phone,
          listing_url: l.listing_url,
          source_url: l.listing_url,
          source_platform: 'hotpads',
          listing_type: reListingType === 'rent' ? 'rent' : 'sale',
          square_feet: l.square_feet,
        }));
        setReListings(mapped);
        toast.success(`Found ${mapped.length} Hotpads listings`);
        if (result.error) setReErrors([{ url: '', error: result.error }]);
        // Save to Supabase scraped_leads when "Save to Database" is on (matches frontend structure)
        if (reSaveToDb && mapped.length > 0 && user?.id) {
          try {
            const rows = mapped.map((listing) => ({
              domain: listing.source_url ? (() => { try { return new URL(listing.source_url).hostname; } catch { return 'hotpads.com'; } })() : 'hotpads.com',
              source_url: listing.source_url || listing.listing_url || null,
              address: listing.address || null,
              full_name: listing.owner_name || null,
              best_email: (listing as any).owner_email || null,
              best_phone: listing.owner_phone || null,
              all_emails: (listing as any).owner_email ? [(listing as any).owner_email] : [],
              all_phones: listing.owner_phone ? [listing.owner_phone] : [],
              status: 'new',
              confidence_score: 50,
              lead_type: 'person',
              source_type: 'real_estate_scraper',
              schema_data: {
          address: listing.address,
                bedrooms: listing.bedrooms,
                bathrooms: listing.bathrooms,
          price: listing.price,
                listing_type: listing.listing_type,
                source_platform: 'hotpads',
          square_feet: listing.square_feet,
              },
              enrichment_providers_used: [],
            }));
            const { data, error } = await supabase.from('scraped_leads').insert(rows).select('id');
            if (!error && data?.length) {
              setReListings((prev) => prev.map((l) => ({ ...l, saved_to_db: true })));
              toast.success(`Saved ${data.length} Hotpads listings to database`);
            } else if (error) {
              const is404 = String((error as any)?.message || '').includes('404') || (error as any)?.code === 'PGRST116';
              if (is404) {
                toast.info('Listings are in hotpads_listings. The "scraped_leads" table was not found—run birvanoio Supabase migrations to save to the leads pipeline.');
              } else {
                toast.error('Could not save listings to database');
              }
            }
          } catch (e: any) {
            const msg = String(e?.message || '');
            const is404 = msg.includes('404') || msg.includes('Not Found');
            if (is404) {
              toast.info('Listings are in hotpads_listings. The "scraped_leads" table was not found—run birvanoio Supabase migrations to save to the leads pipeline.');
      } else {
              toast.error('Failed to save listings to database');
            }
          }
          }
        } else if (isTrulia) {
        // Trulia: same flow as Hotpads (backend scraper, trigger-from-url, last-result)
        const backendReachable = await scraperBackendApi.isScraperBackendReachable();
        if (!backendReachable) {
          toast.error('Trulia scraper backend is not running. Start the backend server (e.g. port 8080) or use "All Platforms" for FSBO/FRBO scraping.');
          setReLoading(false);
          return;
        }
        const url = buildTruliaUrl(reLocation.trim());
        if (!url) {
          toast.error('Could not build Trulia URL. Use a city (e.g. Minneapolis, Washington, Chicago, New York, San Francisco, Los Angeles) or "City, ST" (e.g. Chicago IL).');
          setReLoading(false);
          return;
        }
        await scraperBackendApi.resetTruliaStatus();
        const triggerRes = await scraperBackendApi.triggerFromUrl(url, { force: true });
        if (triggerRes.error) {
          toast.error(triggerRes.error);
          setReLoading(false);
          return;
        }
        toast.info('Trulia scraper started. Waiting for results…');
        const pollInterval = 2000;
        const maxWait = 5 * 60 * 1000;
        const start = Date.now();
        let status = await scraperBackendApi.getTruliaStatus();
        while (status.status === 'running' && Date.now() - start < maxWait) {
          await new Promise((r) => setTimeout(r, pollInterval));
          status = await scraperBackendApi.getTruliaStatus();
        }
        if (status.status === 'running') {
          toast.warning('Scraper is still running. Results may appear later. You can refresh or run again.');
        }
        const result = await scraperBackendApi.getTruliaLastResult();
        const mapped = (result.listings || []).map((l) => ({
          address: l.address,
          bedrooms: l.bedrooms,
          bathrooms: l.bathrooms,
          price: l.price,
          owner_name: l.owner_name,
          owner_phone: l.owner_phone,
          listing_url: l.listing_url,
          source_url: l.listing_url,
          source_platform: 'trulia',
          listing_type: 'sale',
          square_feet: l.square_feet,
        }));
        setReListings(mapped);
        toast.success(`Found ${mapped.length} Trulia listings`);
        if (result.error) setReErrors([{ url: '', error: result.error }]);
        if (reSaveToDb && mapped.length > 0 && user?.id) {
          try {
            const rows = mapped.map((listing) => ({
              domain: 'trulia.com',
              source_url: listing.source_url || listing.listing_url || null,
              address: listing.address || null,
              full_name: listing.owner_name || null,
              best_email: null,
              best_phone: listing.owner_phone || null,
              all_emails: [],
              all_phones: listing.owner_phone ? [listing.owner_phone] : [],
              status: 'new',
              confidence_score: 50,
              lead_type: 'person',
              source_type: 'real_estate_scraper',
              schema_data: {
                address: listing.address,
                bedrooms: listing.bedrooms,
                bathrooms: listing.bathrooms,
                price: listing.price,
                listing_type: 'sale',
                source_platform: 'trulia',
                square_feet: listing.square_feet,
              },
              enrichment_providers_used: [],
            }));
            const { data, error } = await supabase.from('scraped_leads').insert(rows).select('id');
            if (!error && data?.length) {
              setReListings((prev) => prev.map((l) => ({ ...l, saved_to_db: true })));
              toast.success(`Saved ${data.length} Trulia listings to database`);
            } else if (error) {
              toast.error('Could not save listings to database');
            }
          } catch {
            toast.error('Failed to save listings to database');
          }
        }
        } else {
        // FSBO/FRBO uses Edge Function that requires signed-in admin
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          toast.error('Please sign in to use Find Listings.');
          setReLoading(false);
          return;
        }
        try {
          const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user?.id, _role: 'admin' });
          if (isAdmin === false) {
            toast.error('Admin access is required to run the FSBO/FRBO scraper.');
            setReLoading(false);
            return;
          }
        } catch {
          // has_role RPC may be missing if migrations not run; let Edge Function enforce auth
        }
        const response = await firecrawlApi.scrapeAndTraceFSBO({ location: reLocation, platform: rePlatform as any, listingType: reListingType, enableSkipTrace: reEnableSkipTrace, saveToDatabase: reSaveToDb });
        if (response.success) {
          setReListings(response.listings || []);
          if (response.errors?.length) setReErrors(response.errors);
          if (response.skip_trace_stats) setReSkipTraceStats(response.skip_trace_stats);
          const skipInfo = reEnableSkipTrace && response.skip_trace_stats ? ` (${response.skip_trace_stats.successful}/${response.skip_trace_stats.attempted} skip traced)` : '';
          toast.success(`Found ${response.total || 0} listings${skipInfo}`);
          if (reSaveToDb && response.saved_to_database) toast.success(`Saved ${response.saved_to_database} leads to database`);
        } else {
          toast.error(response.error || 'Failed to scrape listings');
        }
      }
    } catch (e: any) {
      const msg = String(e?.message || '');
      if ((isHotpads || isTrulia) && /connection refused|failed to fetch|network error|ERR_|load failed/i.test(msg)) {
        toast.error(`${isTrulia ? 'Trulia' : 'HotPads'} scraper backend is not running. Start the backend server (e.g. port 8080) or use "All Platforms" for FSBO/FRBO scraping.`);
      } else {
        toast.error(isHotpads ? 'Failed to run Hotpads scraper' : isTrulia ? 'Failed to run Trulia scraper' : 'Failed to scrape listings');
      }
    } finally {
      setReLoading(false);
    }
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
        address: listing.address || null,
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
          source_url: listing.source_url || listing.listing_url,
          address: listing.address || null,
          full_name: listing.owner_name, best_email: listing.owner_email, best_phone: listing.owner_phone,
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
    <DashboardLayout fullWidth>
      <div className={lensSearchTypeActive && activeTab === 'prospect-search' ? '' : 'space-y-4'}>
        {!(lensSearchTypeActive && activeTab === 'prospect-search') && (
        <div>
            <h1 className="text-2xl font-semibold tracking-tight">Brivano Scout</h1>
            <p className="text-sm text-muted-foreground mt-1">Find prospects, scrape listings, and enrich your pipeline</p>
        </div>
        )}

        <Tabs value={activeTab} onValueChange={setActiveTab} className={lensSearchTypeActive && activeTab === 'prospect-search' ? '' : 'space-y-4'}>
          {!(lensSearchTypeActive && activeTab === 'prospect-search') && (
            <TabsList className="h-9 p-0.5 bg-muted/60">
              <TabsTrigger value="ai-chat" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Sparkles className="h-3.5 w-3.5" /> AI Assistant
          </TabsTrigger>
              <TabsTrigger value="prospect-search" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Target className="h-3.5 w-3.5" /> Brivano Lens
          </TabsTrigger>
              <TabsTrigger value="real-estate" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Home className="h-3.5 w-3.5" /> Real Estate
          </TabsTrigger>
              <TabsTrigger value="search" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <Search className="h-3.5 w-3.5" /> Search
          </TabsTrigger>
              <TabsTrigger value="csv-enrichment" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                <FileSpreadsheet className="h-3.5 w-3.5" /> CSV Enrichment
          </TabsTrigger>
        </TabsList>
          )}

          {/* ── Prospect Search Tab ── */}
          <TabsContent value="prospect-search" className="mt-0">
            <BrivanoLens externalFilters={externalFilters} onSwitchTab={setActiveTab} onSearchTypeChange={setLensSearchTypeActive} />
          </TabsContent>

          {/* ── AI Chat Tab ── */}
          <TabsContent value="ai-chat" className="mt-0">
            <Card className="border-border/60">
              <CardContent className="p-0">
                <div className="flex flex-col h-[600px]">
                  <ScrollArea className="flex-1 p-5">
                    {chatMessages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full py-10">
                        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                          <Bot className="h-6 w-6 text-primary" />
                        </div>
                        <h3 className="text-base font-semibold mb-1">What can we help you build today?</h3>
                        <p className="text-xs text-muted-foreground text-center max-w-md mb-5">
                          Tell us how you'd like to get started or pick a suggested use case below
                        </p>

                        {/* Use-case chips */}
                        <div className="flex flex-wrap gap-2 justify-center mb-6">
                          {useCaseChips.map((chip) => {
                            const IconComp = chip.icon === 'Users' ? Users : chip.icon === 'TrendingUp' ? TrendingUp : chip.icon === 'MailCheck' ? MailCheck : Send;
                            return (
                              <button
                                key={chip.label}
                                onClick={() => setChatInput(chip.label)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/60 hover:border-primary/40 hover:bg-muted/30 transition-all text-xs text-muted-foreground hover:text-foreground"
                              >
                                <IconComp className="h-3.5 w-3.5" />
                                {chip.label}
                              </button>
                            );
                          })}
                        </div>

                        {/* Start from a source */}
                        <div className="w-full max-w-lg">
                          <p className="text-[11px] text-muted-foreground mb-2.5 font-medium">Start from a source</p>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {sourceCards.map((card) => {
                              const IconComp = card.icon === 'UserSearch' ? UserSearch : card.icon === 'Building2' ? Building2 : card.icon === 'MapPin' ? MapPin : card.icon === 'Home' ? Home : card.icon === 'FileUp' ? FileUp : Sparkles;
                              return (
                                <button
                                  key={card.label}
                                  onClick={() => {
                                    if (card.tab === 'ai-chat') {
                                      setChatInput(card.label);
                                    } else {
                                      setActiveTab(card.tab);
                                    }
                                  }}
                                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-muted/20 transition-all group"
                                >
                                  <div className="h-8 w-8 rounded-lg bg-muted/60 group-hover:bg-primary/10 flex items-center justify-center transition-colors">
                                    <IconComp className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                                  </div>
                                  <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground transition-colors text-center leading-tight">{card.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Quick suggestions */}
                        <div className="w-full max-w-md mt-6">
                          <p className="text-[11px] text-muted-foreground mb-2 font-medium">Try asking</p>
                          <div className="grid grid-cols-2 gap-2">
                            {chatSuggestions.map((suggestion) => (
                              <button
                                key={suggestion}
                                onClick={() => { setChatInput(suggestion); }}
                                className="text-left px-3 py-2 rounded-lg border border-border/40 hover:border-primary/40 hover:bg-muted/20 transition-all text-xs text-muted-foreground hover:text-foreground"
                              >
                                {suggestion}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {chatMessages.map((msg, i) => (
                          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className="max-w-[80%] space-y-1.5">
                              <div className={`rounded-xl px-4 py-2.5 text-sm ${
                                msg.role === 'user'
                                  ? 'bg-primary text-primary-foreground'
                                  : 'bg-muted/60'
                              }`}>
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                              </div>
                              {msg.appliedFilters && (
                                <div className="flex items-center gap-1.5 flex-wrap px-1">
                                  <Target className="h-3 w-3 text-primary flex-shrink-0" />
                                  <span className="text-[10px] text-primary font-medium">Filters applied →</span>
                                  {Object.entries(msg.appliedFilters)
                                    .filter(([_, v]) => (Array.isArray(v) ? v.length > 0 : v !== undefined && v !== null && v !== ''))
                                    .map(([k]) => (
                                      <Badge key={k} variant="secondary" className="text-[9px] px-1.5 py-0">
                                        {k.replace(/([A-Z])/g, ' $1').trim()}
                                      </Badge>
                                    ))}
                                  <span className="text-[10px] text-muted-foreground">• Switching to Brivano Lens...</span>
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                        {chatLoading && (
                          <div className="flex justify-start">
                            <div className="bg-muted/60 rounded-xl px-4 py-2.5">
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </ScrollArea>

                  <div className="border-t border-border/60 p-4">
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Describe what companies you're looking for... e.g. 'property management in California'"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
                        className="min-h-[40px] max-h-[100px] resize-none text-sm"
                        rows={1}
                      />
                      <Button onClick={handleChatSend} disabled={chatLoading || !chatInput.trim()} size="sm" className="h-10 px-3 shrink-0">
                        {chatLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      </Button>
                </div>
                    <p className="text-[10px] text-muted-foreground mt-2">
                      I'll automatically configure filters and search in Brivano Lens for you.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

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

                <div className="flex gap-3 items-end">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Location</Label>
                    <div className="relative">
                      <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground z-10" />
                      <Input
                        placeholder={rePlatform === 'hotpads' ? 'e.g. Minneapolis, Washington, Chicago...' : 'Austin, TX or 90210'}
                        value={reLocation}
                        onChange={(e) => setReLocation(e.target.value)}
                        onFocus={() => setLocationDropdownOpen(true)}
                        onBlur={() => setTimeout(() => setLocationDropdownOpen(false), 200)}
                        className="pl-8 h-9 text-sm"
                      />
                      {locationDropdownOpen && (
                        <div className="absolute top-full left-0 right-0 mt-1 z-50 rounded-md border border-border bg-popover text-popover-foreground shadow-md overflow-hidden">
                          <div className="p-1 max-h-[220px] overflow-auto">
                            {LOCATION_SUGGESTIONS.filter(loc =>
                              !reLocation.trim() || loc.toLowerCase().includes(reLocation.toLowerCase().trim())
                            ).map((loc) => (
                              <button
                                key={loc}
                                type="button"
                                className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground rounded-sm focus:bg-accent focus:outline-none"
                                onMouseDown={(e) => { e.preventDefault(); setReLocation(loc); setLocationDropdownOpen(false); }}
                              >
                                {loc}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="w-40 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Platform</Label>
                  <Select value={rePlatform} onValueChange={setRePlatform}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Platform" /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">
                          <span className="flex items-center gap-2">All Platforms</span>
                        </SelectItem>
                        {Object.entries(PLATFORM_CONFIG).map(([key, config]) => (
                          <SelectItem key={key} value={key}>
                            <span className="flex items-center gap-2">
                              <img
                                src={`https://www.google.com/s2/favicons?domain=${config.domain}&sz=16`}
                                alt=""
                                className="h-4 w-4 rounded-sm"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                              {config.label}
                            </span>
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                  <div className="w-36 space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Listing Type</Label>
                  <Select value={reListingType} onValueChange={(v) => setReListingType(v as 'sale' | 'rent')}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
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

                <div className="flex items-center gap-6 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={reEnableSkipTrace} onCheckedChange={setReEnableSkipTrace} className="scale-90" />
                    <span className="text-xs font-medium">Auto Skip Trace</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Switch checked={reSaveToDb} onCheckedChange={setReSaveToDb} className="scale-90" />
                    <span className="text-xs font-medium">Save to Database</span>
                  </label>
              </div>
              
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

            {isAdmin && reErrors.length > 0 && (
              <div className="px-4 py-3 rounded-lg bg-destructive/5 border border-destructive/20 text-xs">
                <p className="font-medium text-destructive mb-1">Some sites couldn't be scraped:</p>
                    {reErrors.map((err, i) => (
                  <p key={i} className="text-muted-foreground truncate">• {err.url}: {err.error}</p>
                    ))}
                </div>
              )}

          {reListings.length > 0 && (
              <>
                {/* Map / List Toggle */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                      <Button 
                      variant={showMap ? "default" : "outline"}
                        size="sm" 
                      className="h-7 text-xs gap-1.5"
                      onClick={() => setShowMap(true)}
                    >
                      <MapPin className="h-3 w-3" /> Map View
                      </Button>
                      <Button 
                      variant={!showMap ? "default" : "outline"}
                        size="sm" 
                      className="h-7 text-xs gap-1.5"
                      onClick={() => setShowMap(false)}
                    >
                      <Building className="h-3 w-3" /> List View
                    </Button>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{reListings.length} listings found</span>
                </div>

                {/* Map */}
                {showMap && (
                  <Suspense fallback={<div className="h-[400px] rounded-lg bg-muted/30 border border-border/60 flex items-center justify-center text-xs text-muted-foreground">Loading map...</div>}>
                    <ListingsMap listings={reListings} onSelectListing={(i) => { setShowMap(false); }} searchLocation={reLocation} />
                  </Suspense>
                )}

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
                            
                            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                              {listing.favorites_count !== undefined && <span>♡ {listing.favorites_count}</span>}
                              {listing.views_count !== undefined && <span>👁 {listing.views_count}</span>}
                              {listing.source_platform && (
                                <span className="flex items-center gap-1">
                                  {listing.source_url && (
                                    <img
                                      src={`https://www.google.com/s2/favicons?domain=${(() => { try { return new URL(listing.source_url).hostname; } catch { return ''; } })()}&sz=16`}
                                      alt=""
                                      className="h-3.5 w-3.5 rounded-sm"
                                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                    />
                                  )}
                                  <Badge variant="outline" className="text-[10px] h-4 font-normal">{listing.source_platform}</Badge>
                                </span>
                              )}
                              {listing.listing_type && <Badge variant="secondary" className="text-[10px] h-4 font-normal uppercase">{listing.listing_type}</Badge>}
                            </div>

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
              </>
          )}
        </TabsContent>

          {/* ── Search Tab — Clay-like Rich Interface ── */}
          <TabsContent value="search" className="space-y-4 mt-0">
            {/* Search Command Bar */}
            <Card className="border-border/40 overflow-hidden">
              <div className="bg-gradient-to-r from-primary/[0.04] to-transparent">
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-center gap-3 mb-1">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Search className="h-4 w-4 text-primary" />
              </div>
                <div>
                      <h3 className="text-sm font-semibold">Search & Discover</h3>
                      <p className="text-[10px] text-muted-foreground">Search the web to find and import business leads</p>
                </div>
                </div>

                  {/* Search Categories */}
                  <div className="flex items-center gap-1.5">
                    {[
                      { label: "All", icon: Search },
                      { label: "Companies", icon: Building },
                      { label: "People", icon: UserPlus },
                      { label: "Local", icon: MapPin },
                    ].map(cat => (
                      <button
                        key={cat.label}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium border border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-muted-foreground hover:text-foreground"
                      >
                        <cat.icon className="h-3 w-3" />
                        {cat.label}
                      </button>
                        ))}
                      </div>

                  {/* Main Search Input */}
                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
                <Input
                        placeholder="Search for businesses, companies, or people..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleSearch(); }}
                        className="h-10 pl-10 text-sm bg-background border-border/60 focus-visible:ring-primary/30"
                />
              </div>
                    <div className="w-20">
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={searchLimit}
                  onChange={(e) => setSearchLimit(parseInt(e.target.value) || 10)}
                        className="h-10 text-sm text-center"
                        title="Max results"
                />
              </div>
                    <Button onClick={handleSearch} disabled={searchLoading} className="h-10 px-5 gap-2">
                      {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-3.5 w-3.5" /> Search</>}
              </Button>
                  </div>

                  {/* Quick Search Suggestions */}
                  {searchResults.length === 0 && !searchLoading && (
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        "Roofing companies in Dallas TX",
                        "SaaS startups San Francisco",
                        "HVAC contractors Miami",
                        "Dentists near Chicago IL",
                        "Real estate agents Austin",
                        "Marketing agencies NYC",
                      ].map(suggestion => (
                        <button
                          key={suggestion}
                          onClick={() => { setSearchQuery(suggestion); }}
                          className="px-2.5 py-1 rounded-md bg-muted/50 text-[10px] text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>
                  )}
            </CardContent>
              </div>
          </Card>

            {/* Results Table */}
          {searchResults.length > 0 && (
              <Card className="border-border/40">
                {/* Results Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
                  <div className="flex items-center gap-3">
                    <h3 className="text-sm font-semibold">{searchResults.length} Results</h3>
                    {selectedResults.size > 0 && (
                      <Badge variant="secondary" className="text-[10px] h-5">{selectedResults.size} selected</Badge>
                    )}
                  </div>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" className="h-7 text-[11px] px-2" onClick={toggleSelectAll}>
                    {selectedResults.size === searchResults.filter(r => !r.imported).length ? 'Deselect All' : 'Select All'}
                  </Button>
                    <Button size="sm" className="h-7 text-[11px] gap-1.5" onClick={importSelectedLeads} disabled={selectedResults.size === 0 || bulkImporting}>
                      {bulkImporting ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                      Import {selectedResults.size > 0 ? `(${selectedResults.size})` : ''}
                  </Button>
                </div>
                </div>
                <CardContent className="p-0">
                <ScrollArea className="h-[500px]">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-muted/80 backdrop-blur-sm z-10">
                        <tr className="border-b border-border/40">
                          <th className="w-10 px-4 py-2.5 text-left">
                            <Checkbox
                              checked={selectedResults.size === searchResults.filter(r => !r.imported).length && searchResults.length > 0}
                              onCheckedChange={toggleSelectAll}
                            />
                          </th>
                          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">#</th>
                          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Source</th>
                          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Preview</th>
                          <th className="px-3 py-2.5 text-left font-medium text-muted-foreground">Status</th>
                          <th className="w-24 px-3 py-2.5 text-right font-medium text-muted-foreground">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {searchResults.map((result, i) => {
                          let domain = '';
                          try { domain = new URL(result.url).hostname.replace('www.', ''); } catch {}
                          const favicon = domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=32` : null;
                          return (
                            <tr
                              key={i}
                              className={`border-b border-border/30 hover:bg-muted/20 transition-colors ${
                                result.imported ? 'opacity-50' : ''
                              } ${selectedResults.has(i) ? 'bg-primary/[0.03]' : ''}`}
                            >
                              <td className="px-4 py-3">
                                {!result.imported ? (
                                  <Checkbox checked={selectedResults.has(i)} onCheckedChange={() => toggleSelectResult(i)} />
                                ) : (
                                  <Check className="h-3.5 w-3.5 text-green-500" />
                                )}
                              </td>
                              <td className="px-3 py-3 text-muted-foreground">{i + 1}</td>
                              <td className="px-3 py-3 max-w-[300px]">
                                <div className="flex items-center gap-2.5">
                                  {favicon && (
                                    <img src={favicon} alt="" className="h-5 w-5 rounded-sm shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                                  )}
                                  <div className="min-w-0">
                                    <a href={result.url} target="_blank" rel="noopener noreferrer" className="text-xs font-medium hover:text-primary hover:underline truncate block">
                                {result.title}
                              </a>
                                    <p className="text-[10px] text-muted-foreground truncate">{domain}</p>
                            </div>
                          </div>
                              </td>
                              <td className="px-3 py-3 max-w-[300px]">
                                <p className="text-[11px] text-muted-foreground line-clamp-2">{result.description || '—'}</p>
                              </td>
                              <td className="px-3 py-3">
                                {result.imported ? (
                                  <Badge className="bg-green-500/10 text-green-600 dark:text-green-400 border-0 text-[10px] h-5">Imported</Badge>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] h-5 font-normal">New</Badge>
                                )}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex justify-end gap-0.5">
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyToClipboard(result.markdown || result.url)} title="Copy">
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => window.open(result.url, '_blank')} title="Open">
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                  {!result.imported && (
                                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-primary" onClick={() => importAsLead(result, i)} disabled={importingIndex === i} title="Import as lead">
                                      {importingIndex === i ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserPlus className="h-3 w-3" />}
                              </Button>
                            )}
                          </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                </ScrollArea>
              </CardContent>

                {/* Bottom Summary Bar */}
                <div className="flex items-center justify-between px-5 py-2.5 border-t border-border/40 bg-muted/20">
                  <p className="text-[10px] text-muted-foreground">
                    {searchResults.filter(r => r.imported).length} imported · {searchResults.filter(r => !r.imported).length} available
                  </p>
                  <div className="flex gap-1.5">
                    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2" onClick={() => {
                      const csv = searchResults.map(r => `"${r.title}","${r.url}","${r.description || ''}"`).join('\n');
                      downloadAsFile('Title,URL,Description\n' + csv, `search-results-${new Date().toISOString().slice(0,10)}.csv`);
                    }}>
                      <Download className="h-2.5 w-2.5 mr-1" /> Export CSV
                    </Button>
              </div>
              </div>
            </Card>
          )}
        </TabsContent>

          {/* ── CSV Enrichment Tab ── */}
          <TabsContent value="csv-enrichment" className="mt-0">
            <Card className="border-border/60">
              <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
                <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <FileSpreadsheet className="h-6 w-6 text-primary" />
              </div>
                <div>
                  <h3 className="text-sm font-semibold mb-1">CSV Enrichment</h3>
                  <p className="text-xs text-muted-foreground max-w-sm">
                    Upload a CSV of companies and enrich with contact info, emails, LinkedIn profiles, and AI insights.
                  </p>
                </div>
                <Button onClick={() => window.location.href = '/dashboard/csv-enrichment'} size="sm" className="gap-2">
                  <FileSpreadsheet className="h-3.5 w-3.5" /> Open CSV Enrichment
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </div>
    </DashboardLayout>
  );
}
