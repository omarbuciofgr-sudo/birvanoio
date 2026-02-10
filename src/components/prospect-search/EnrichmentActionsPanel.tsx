import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Loader2, Sparkles, User, Mail, Globe, BarChart3, DollarSign, Cpu, TrendingUp, Briefcase, Search, ChevronDown, ExternalLink } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useCredits, CREDIT_COSTS } from '@/hooks/useCredits';
import { CompanyResult } from '@/lib/api/industrySearch';
import { EnrichmentIntentDialog, EnrichmentIntent } from './EnrichmentIntentDialog';

interface EnrichmentAction {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  creditCost: string;
  category: 'suggested' | 'company' | 'contact';
  sources: string[];
}

const ENRICHMENT_ACTIONS: EnrichmentAction[] = [
  { id: 'ai_summary', label: 'Use AI', description: 'Artificial Intelligence', icon: <Sparkles className="h-4 w-4 text-purple-500" />, creditCost: '0.1 / row', category: 'suggested', sources: ['Gemini AI'] },
  { id: 'enrich_person', label: 'Enrich person', description: 'Companies, People, Jobs', icon: <User className="h-4 w-4 text-blue-500" />, creditCost: '1 / row', category: 'suggested', sources: ['Apollo', 'PDL', 'Hunter.io', 'RocketReach'] },
  { id: 'work_email', label: 'Work Email', description: "Find a person's work email.", icon: <Mail className="h-4 w-4 text-amber-500" />, creditCost: '~3 / row', category: 'suggested', sources: ['Hunter.io', 'Apollo', 'Snov.io', 'ContactOut'] },
  { id: 'company_domain', label: 'Company Domain', description: 'Find a domain from a company name.', icon: <Globe className="h-4 w-4 text-green-500" />, creditCost: '~1 / row', category: 'suggested', sources: ['Clearbit', 'PDL', 'Google'] },
  { id: 'website_traffic', label: 'Website Traffic (Monthly)', description: 'Get the monthly website traffic for a domain.', icon: <BarChart3 className="h-4 w-4 text-cyan-500" />, creditCost: '~3 / row', category: 'company', sources: ['SimilarWeb API'] },
  { id: 'company_funding', label: 'Company Latest Funding', description: "Find a company's latest funding details.", icon: <DollarSign className="h-4 w-4 text-emerald-500" />, creditCost: '~4 / row', category: 'company', sources: ['Crunchbase', 'PDL'] },
  { id: 'website_techstack', label: 'Website Techstack', description: 'Technologies a website uses.', icon: <Cpu className="h-4 w-4 text-indigo-500" />, creditCost: '~6 / row', category: 'company', sources: ['BuiltWith', 'Wappalyzer'] },
  { id: 'company_revenue', label: 'Company Revenue', description: "Find a company's revenue.", icon: <TrendingUp className="h-4 w-4 text-pink-500" />, creditCost: '~9 / row', category: 'company', sources: ['PDL', 'ZoomInfo'] },
  { id: 'company_jobs', label: 'Company Job Openings', description: "Find a company's job openings.", icon: <Briefcase className="h-4 w-4 text-orange-500" />, creditCost: '~3 / row', category: 'company', sources: ['LinkedIn', 'Indeed API'] },
];

interface EnrichmentActionsPanelProps {
  selectedCompany: CompanyResult | null;
  selectedRows: Set<number>;
  results: CompanyResult[];
}

export function EnrichmentActionsPanel({ selectedCompany, selectedRows, results }: EnrichmentActionsPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'enrichments' | 'signals'>('enrichments');
  const [runningAction, setRunningAction] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<'suggested' | 'all'>('suggested');
  const { canAfford, spendCredits } = useCredits();
  const [intentDialog, setIntentDialog] = useState<{ open: boolean; action: EnrichmentAction | null }>({ open: false, action: null });

  const filteredActions = ENRICHMENT_ACTIONS.filter(a => {
    if (searchQuery) return a.label.toLowerCase().includes(searchQuery.toLowerCase());
    if (categoryFilter === 'suggested') return a.category === 'suggested';
    return true;
  });

  const targetCount = selectedRows.size > 0 ? selectedRows.size : (selectedCompany ? 1 : 0);

  const handleActionClick = (action: EnrichmentAction) => {
    if (targetCount === 0) {
      toast.error('Select a company or rows first');
      return;
    }
    // Open intent dialog before running
    setIntentDialog({ open: true, action });
  };

  const handleRunAction = async (action: EnrichmentAction, intent: EnrichmentIntent) => {
    if (!canAfford('enrich', targetCount)) {
      toast.error('Not enough credits');
      return;
    }

    setRunningAction(action.id);
    try {
      const targets = selectedRows.size > 0
        ? Array.from(selectedRows).map(i => results[i]).filter(Boolean)
        : selectedCompany ? [selectedCompany] : [];

      for (const company of targets) {
        const domain = company.domain?.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        if (!domain) continue;

        await spendCredits('enrich', 1, `${action.id}_${domain}`);

        const enrichBody: any = { domain, intent_goals: intent.goals, custom_goal: intent.customGoal };

        if (action.id === 'ai_summary') {
          await supabase.functions.invoke('ai-company-summary', { body: { ...enrichBody, company_name: company.name } });
        } else if (action.id === 'enrich_person') {
          await supabase.functions.invoke('data-waterfall-enrich', { body: { ...enrichBody, target_titles: ['owner', 'ceo', 'founder'] } });
        } else if (action.id === 'work_email') {
          await supabase.functions.invoke('data-waterfall-enrich', { body: { ...enrichBody, enrich_fields: ['email'] } });
        } else if (action.id === 'website_techstack') {
          await supabase.functions.invoke('technographics-enrichment', { body: enrichBody });
        } else {
          await supabase.functions.invoke('data-waterfall-enrich', { body: { ...enrichBody, enrich_fields: [action.id] } });
        }
      }
      toast.success(`${action.label} completed for ${targets.length} ${targets.length === 1 ? 'company' : 'companies'}`);
    } catch {
      toast.error(`${action.label} failed`);
    } finally {
      setRunningAction(null);
    }
  };

  return (
    <div className="w-[300px] border-l border-border/60 bg-card flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/60">
        <h3 className="text-sm font-semibold mb-2">Actions</h3>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border/60">
        {(['enrichments', 'signals'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2.5 text-xs font-medium capitalize transition-colors relative ${
              activeTab === tab ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'enrichments' ? '✨ Enrichments' : '⚡ Signals'}
            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />}
          </button>
        ))}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        {activeTab === 'enrichments' && (
          <div className="p-3 space-y-1">
            <button
              onClick={() => setCategoryFilter(f => f === 'suggested' ? 'all' : 'suggested')}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 px-1"
            >
              <ChevronDown className={`h-3 w-3 transition-transform ${categoryFilter === 'all' ? 'rotate-180' : ''}`} />
              {categoryFilter === 'suggested' ? 'Suggested' : 'All enrichments'}
            </button>

            {filteredActions.map(action => (
              <button
                key={action.id}
                onClick={() => handleActionClick(action)}
                disabled={runningAction === action.id || targetCount === 0}
                className="w-full flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/60 transition-colors text-left group disabled:opacity-50"
              >
                <div className="mt-0.5 shrink-0">
                  {runningAction === action.id ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : action.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{action.label}</span>
                    <Badge variant="outline" className="text-[9px] py-0 px-1 font-normal border-border/60 shrink-0">
                      {action.creditCost}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{action.description}</p>
                  {/* Source info */}
                  <div className="flex items-center gap-1 mt-1">
                    <ExternalLink className="h-2.5 w-2.5 text-muted-foreground/60" />
                    <span className="text-[9px] text-muted-foreground/70">{action.sources.join(' · ')}</span>
                  </div>
                </div>
              </button>
            ))}

            {categoryFilter === 'suggested' && (
              <button
                onClick={() => setCategoryFilter('all')}
                className="w-full py-2 text-xs text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1"
              >
                ↓ Load More
              </button>
            )}
          </div>
        )}

        {activeTab === 'signals' && (
          <div className="p-4 text-center space-y-2">
            <p className="text-xs text-muted-foreground">
              Monitor signals like job changes, new hires, and funding events for your prospects.
            </p>
            <Button size="sm" variant="outline" className="text-xs" onClick={() => window.location.href = '/dashboard/signals'}>
              Go to Signals →
            </Button>
          </div>
        )}
      </ScrollArea>

      {/* Footer */}
      {targetCount > 0 && (
        <div className="px-4 py-2.5 border-t border-border/60 bg-muted/30">
          <p className="text-[10px] text-muted-foreground text-center">
            {targetCount} {targetCount === 1 ? 'company' : 'companies'} selected
          </p>
        </div>
      )}

      {/* Intent Dialog */}
      <EnrichmentIntentDialog
        open={intentDialog.open}
        onOpenChange={(open) => setIntentDialog(prev => ({ ...prev, open }))}
        actionLabel={intentDialog.action?.label || ''}
        onConfirm={(intent) => {
          if (intentDialog.action) handleRunAction(intentDialog.action, intent);
        }}
      />
    </div>
  );
}