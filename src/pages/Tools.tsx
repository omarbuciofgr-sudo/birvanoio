import { useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Cpu, Target, Globe, Mail, FileSpreadsheet, ListFilter } from 'lucide-react';
import { TechnographicsSearch } from '@/components/scout/TechnographicsSearch';
import { LookalikeSearch } from '@/components/scout/LookalikeSearch';
import { DomainResolver } from '@/components/scout/DomainResolver';
import { BulkEmailFinder } from '@/components/scout/BulkEmailFinder';
import { DynamicLists } from '@/components/scout/DynamicLists';
import CSVEnrichment from '@/pages/CSVEnrichment';

const Tools = () => {
  const [activeTab, setActiveTab] = useState('tech-search');

  return (
    <DashboardLayout fullWidth>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Enrichment Tools</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Enrich, resolve, and manage your prospect data</p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="h-10 p-1 bg-muted/40 border border-border/30 gap-0.5">
            <TabsTrigger value="tech-search" className="text-xs gap-1.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Cpu className="h-3.5 w-3.5" /> Tech Stack
            </TabsTrigger>
            <TabsTrigger value="lookalike" className="text-xs gap-1.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Target className="h-3.5 w-3.5" /> Lookalikes
            </TabsTrigger>
            <TabsTrigger value="domain-resolve" className="text-xs gap-1.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Globe className="h-3.5 w-3.5" /> Domains
            </TabsTrigger>
            <TabsTrigger value="email-finder" className="text-xs gap-1.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Mail className="h-3.5 w-3.5" /> Email Finder
            </TabsTrigger>
            <TabsTrigger value="csv-enrichment" className="text-xs gap-1.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FileSpreadsheet className="h-3.5 w-3.5" /> CSV Enrichment
            </TabsTrigger>
            <TabsTrigger value="lists" className="text-xs gap-1.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <ListFilter className="h-3.5 w-3.5" /> Lists
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tech-search" className="mt-0">
            <TechnographicsSearch />
          </TabsContent>
          <TabsContent value="lookalike" className="mt-0">
            <LookalikeSearch />
          </TabsContent>
          <TabsContent value="domain-resolve" className="mt-0">
            <DomainResolver />
          </TabsContent>
          <TabsContent value="email-finder" className="mt-0">
            <BulkEmailFinder />
          </TabsContent>
          <TabsContent value="csv-enrichment" className="mt-0">
            <CSVEnrichment embedded />
          </TabsContent>
          <TabsContent value="lists" className="mt-0">
            <DynamicLists />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Tools;
