import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Leads from "./pages/Leads";
import Analytics from "./pages/Analytics";
import Settings from "./pages/Settings";
import Campaigns from "./pages/Campaigns";
import Templates from "./pages/Templates";
import VoiceAgent from "./pages/VoiceAgent";
import AdminImport from "./pages/AdminImport";
import Contacts from "./pages/Contacts";
import CheckoutSuccess from "./pages/CheckoutSuccess";
import CheckoutCancel from "./pages/CheckoutCancel";
import WebScraper from "./pages/WebScraper";
import SchemaTemplates from "./pages/admin/SchemaTemplates";
import ClientOrganizations from "./pages/admin/ClientOrganizations";
import ScrapeJobs from "./pages/admin/ScrapeJobs";
import ScrapedLeads from "./pages/admin/ScrapedLeads";
import APISettings from "./pages/admin/APISettings";
import ScraperSettings from "./pages/admin/ScraperSettings";
import ClientLeads from "./pages/client/ClientLeads";
import CSVEnrichment from "./pages/CSVEnrichment";
import ProspectSearch from "./pages/ProspectSearch";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" forcedTheme="light">
    <QueryClientProvider client={queryClient}>
      <SubscriptionProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/dashboard/leads" element={<ProtectedRoute><Leads /></ProtectedRoute>} />
              <Route path="/dashboard/analytics" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/dashboard/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
              <Route path="/dashboard/campaigns" element={<ProtectedRoute><Campaigns /></ProtectedRoute>} />
              <Route path="/dashboard/templates" element={<ProtectedRoute><Templates /></ProtectedRoute>} />
              <Route path="/dashboard/voice-agent" element={<ProtectedRoute><VoiceAgent /></ProtectedRoute>} />
              <Route path="/admin/import" element={<ProtectedRoute><AdminImport /></ProtectedRoute>} />
              <Route path="/dashboard/contacts" element={<ProtectedRoute><Contacts /></ProtectedRoute>} />
              <Route path="/dashboard/scraper" element={<ProtectedRoute><WebScraper /></ProtectedRoute>} />
              <Route path="/admin/schema-templates" element={<ProtectedRoute><SchemaTemplates /></ProtectedRoute>} />
              <Route path="/admin/clients" element={<ProtectedRoute><ClientOrganizations /></ProtectedRoute>} />
              <Route path="/admin/scrape-jobs" element={<ProtectedRoute><ScrapeJobs /></ProtectedRoute>} />
              <Route path="/admin/scraped-leads" element={<ProtectedRoute><ScrapedLeads /></ProtectedRoute>} />
              <Route path="/admin/api-settings" element={<ProtectedRoute><APISettings /></ProtectedRoute>} />
              <Route path="/admin/scraper-settings" element={<ProtectedRoute><ScraperSettings /></ProtectedRoute>} />
              <Route path="/client/leads" element={<ProtectedRoute><ClientLeads /></ProtectedRoute>} />
              <Route path="/dashboard/csv-enrichment" element={<ProtectedRoute><CSVEnrichment /></ProtectedRoute>} />
              <Route path="/dashboard/prospect-search" element={<ProtectedRoute><ProspectSearch /></ProtectedRoute>} />
              <Route path="/dashboard/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
              <Route path="/checkout/cancel" element={<ProtectedRoute><CheckoutCancel /></ProtectedRoute>} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </SubscriptionProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
