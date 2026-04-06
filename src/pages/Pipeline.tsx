import { useState, useEffect, useCallback } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import {
  Plus,
  MoreVertical,
  GripVertical,
  DollarSign,
  Calendar,
  Building2,
  User,
  Mail,
  Phone,
  Trash2,
  Edit,
  Settings2,
  Loader2,
  ArrowRight,
  Trophy,
  XCircle,
} from 'lucide-react';

interface PipelineStage {
  id: string;
  name: string;
  color: string;
  position: number;
  is_win: boolean;
  is_loss: boolean;
}

interface Deal {
  id: string;
  lead_id: string;
  stage_id: string;
  deal_value: number | null;
  close_date: string | null;
  notes: string | null;
  position: number;
  lead?: {
    id: string;
    business_name: string;
    contact_name: string | null;
    email: string | null;
    phone: string | null;
    industry: string | null;
    lead_score: number | null;
    status: string;
  };
}

const DEFAULT_STAGES = [
  { name: 'New Lead', color: '#6366f1', position: 0, is_win: false, is_loss: false },
  { name: 'Contacted', color: '#3b82f6', position: 1, is_win: false, is_loss: false },
  { name: 'Qualified', color: '#f59e0b', position: 2, is_win: false, is_loss: false },
  { name: 'Proposal', color: '#f97316', position: 3, is_win: false, is_loss: false },
  { name: 'Negotiation', color: '#8b5cf6', position: 4, is_win: false, is_loss: false },
  { name: 'Won', color: '#22c55e', position: 5, is_win: true, is_loss: false },
  { name: 'Lost', color: '#ef4444', position: 6, is_win: false, is_loss: true },
];

const Pipeline = () => {
  const { user } = useAuth();
  const [stages, setStages] = useState<PipelineStage[]>([]);
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [draggedDeal, setDraggedDeal] = useState<string | null>(null);
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);

  // Dialogs
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [addDealStageId, setAddDealStageId] = useState<string | null>(null);
  const [editStageOpen, setEditStageOpen] = useState(false);
  const [stageForm, setStageForm] = useState({ name: '', color: '#6366f1', is_win: false, is_loss: false });
  const [editingStageId, setEditingStageId] = useState<string | null>(null);

  // Add deal form
  const [availableLeads, setAvailableLeads] = useState<any[]>([]);
  const [leadSearch, setLeadSearch] = useState('');
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [dealValue, setDealValue] = useState('');
  const [dealCloseDate, setDealCloseDate] = useState('');
  const [leadsLoading, setLeadsLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);

    // Load stages
    const { data: stagesData } = await supabase
      .from('pipeline_stages')
      .select('*')
      .eq('user_id', user.id)
      .order('position');

    if (!stagesData?.length) {
      // Seed default stages
      const toInsert = DEFAULT_STAGES.map((s) => ({ ...s, user_id: user.id }));
      const { data: inserted } = await supabase
        .from('pipeline_stages')
        .insert(toInsert)
        .select();
      if (inserted) setStages(inserted);
    } else {
      setStages(stagesData);
    }

    // Load deals with lead data
    const { data: dealsData } = await supabase
      .from('deals')
      .select('*, lead:leads(id, business_name, contact_name, email, phone, industry, lead_score, status)')
      .eq('user_id', user.id)
      .order('position');

    if (dealsData) setDeals(dealsData as unknown as Deal[]);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { loadData(); }, [loadData]);

  // Search leads for adding to pipeline
  const searchLeads = useCallback(async (query: string) => {
    if (!user?.id) return;
    setLeadsLoading(true);
    const q = supabase
      .from('leads')
      .select('id, business_name, contact_name, email, industry')
      .eq('client_id', user.id)
      .limit(20);
    if (query) q.ilike('business_name', `%${query}%`);
    const { data } = await q;
    
    // Filter out leads already in pipeline
    const existingLeadIds = new Set(deals.map(d => d.lead_id));
    setAvailableLeads((data || []).filter(l => !existingLeadIds.has(l.id)));
    setLeadsLoading(false);
  }, [user?.id, deals]);

  useEffect(() => {
    if (addDealOpen) searchLeads(leadSearch);
  }, [addDealOpen, leadSearch, searchLeads]);

  // Drag handlers
  const handleDragStart = (dealId: string) => setDraggedDeal(dealId);
  const handleDragOver = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    setDragOverStage(stageId);
  };
  const handleDragLeave = () => setDragOverStage(null);
  const handleDrop = async (stageId: string) => {
    if (!draggedDeal) return;
    setDragOverStage(null);

    const deal = deals.find(d => d.id === draggedDeal);
    if (!deal || deal.stage_id === stageId) { setDraggedDeal(null); return; }

    // Optimistic update
    setDeals(prev => prev.map(d => d.id === draggedDeal ? { ...d, stage_id: stageId } : d));
    setDraggedDeal(null);

    const { error } = await supabase
      .from('deals')
      .update({ stage_id: stageId })
      .eq('id', draggedDeal);

    if (error) {
      toast.error('Failed to move deal');
      loadData();
    }
  };

  // Add deal
  const handleAddDeal = async () => {
    if (!selectedLeadId || !addDealStageId || !user?.id) return;
    const stageDeals = deals.filter(d => d.stage_id === addDealStageId);
    const { error } = await supabase.from('deals').insert({
      user_id: user.id,
      lead_id: selectedLeadId,
      stage_id: addDealStageId,
      deal_value: dealValue ? parseFloat(dealValue) : 0,
      close_date: dealCloseDate || null,
      position: stageDeals.length,
    });
    if (error) { toast.error('Failed to add deal'); return; }
    toast.success('Deal added to pipeline');
    setAddDealOpen(false);
    setSelectedLeadId(null);
    setDealValue('');
    setDealCloseDate('');
    setLeadSearch('');
    loadData();
  };

  // Remove deal
  const handleRemoveDeal = async (dealId: string) => {
    setDeals(prev => prev.filter(d => d.id !== dealId));
    const { error } = await supabase.from('deals').delete().eq('id', dealId);
    if (error) { toast.error('Failed to remove deal'); loadData(); }
  };

  // Stage CRUD
  const handleSaveStage = async () => {
    if (!stageForm.name.trim() || !user?.id) return;
    if (editingStageId) {
      await supabase.from('pipeline_stages').update({
        name: stageForm.name,
        color: stageForm.color,
        is_win: stageForm.is_win,
        is_loss: stageForm.is_loss,
      }).eq('id', editingStageId);
    } else {
      await supabase.from('pipeline_stages').insert({
        user_id: user.id,
        name: stageForm.name,
        color: stageForm.color,
        position: stages.length,
        is_win: stageForm.is_win,
        is_loss: stageForm.is_loss,
      });
    }
    setEditStageOpen(false);
    setEditingStageId(null);
    setStageForm({ name: '', color: '#6366f1', is_win: false, is_loss: false });
    loadData();
  };

  const handleDeleteStage = async (stageId: string) => {
    const stageDeals = deals.filter(d => d.stage_id === stageId);
    if (stageDeals.length > 0) { toast.error('Move all deals out of this stage first'); return; }
    await supabase.from('pipeline_stages').delete().eq('id', stageId);
    loadData();
  };

  const getDealsForStage = (stageId: string) => deals.filter(d => d.stage_id === stageId);
  const getStageTotalValue = (stageId: string) =>
    getDealsForStage(stageId).reduce((sum, d) => sum + (d.deal_value || 0), 0);

  const totalPipelineValue = deals.reduce((sum, d) => sum + (d.deal_value || 0), 0);
  const wonDeals = deals.filter(d => {
    const stage = stages.find(s => s.id === d.stage_id);
    return stage?.is_win;
  });
  const wonValue = wonDeals.reduce((sum, d) => sum + (d.deal_value || 0), 0);

  if (loading) {
    return (
      <DashboardLayout fullWidth>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout fullWidth>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Deal Pipeline</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Drag deals between stages to track your sales progress</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>Pipeline: <strong className="text-foreground">${totalPipelineValue.toLocaleString()}</strong></span>
              <span>Won: <strong className="text-emerald-500">${wonValue.toLocaleString()}</strong></span>
              <span>Deals: <strong className="text-foreground">{deals.length}</strong></span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingStageId(null);
                setStageForm({ name: '', color: '#6366f1', is_win: false, is_loss: false });
                setEditStageOpen(true);
              }}
            >
              <Settings2 className="h-3.5 w-3.5 mr-1.5" /> Add Stage
            </Button>
          </div>
        </div>

        {/* Kanban Board */}
        <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: '70vh' }}>
          {stages.map((stage) => {
            const stageDeals = getDealsForStage(stage.id);
            const stageValue = getStageTotalValue(stage.id);
            const isOver = dragOverStage === stage.id;

            return (
              <div
                key={stage.id}
                className={`flex-shrink-0 w-72 flex flex-col rounded-xl border transition-colors ${
                  isOver ? 'border-primary/50 bg-primary/5' : 'border-border/40 bg-muted/20'
                }`}
                onDragOver={(e) => handleDragOver(e, stage.id)}
                onDragLeave={handleDragLeave}
                onDrop={() => handleDrop(stage.id)}
              >
                {/* Stage Header */}
                <div className="p-3 flex items-center justify-between border-b border-border/30">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: stage.color }} />
                    <span className="text-xs font-semibold truncate">{stage.name}</span>
                    {stage.is_win && <Trophy className="h-3 w-3 text-emerald-500 flex-shrink-0" />}
                    {stage.is_loss && <XCircle className="h-3 w-3 text-destructive flex-shrink-0" />}
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 ml-1">{stageDeals.length}</Badge>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreVertical className="h-3 w-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => {
                        setEditingStageId(stage.id);
                        setStageForm({ name: stage.name, color: stage.color, is_win: stage.is_win, is_loss: stage.is_loss });
                        setEditStageOpen(true);
                      }}>
                        <Edit className="h-3.5 w-3.5 mr-2" /> Edit Stage
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDeleteStage(stage.id)}>
                        <Trash2 className="h-3.5 w-3.5 mr-2" /> Delete Stage
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Stage Value */}
                {stageValue > 0 && (
                  <div className="px-3 py-1.5 border-b border-border/20">
                    <span className="text-[10px] text-muted-foreground">
                      <DollarSign className="h-3 w-3 inline" />{stageValue.toLocaleString()}
                    </span>
                  </div>
                )}

                {/* Deal Cards */}
                <ScrollArea className="flex-1 p-2">
                  <div className="space-y-2">
                    {stageDeals.map((deal) => (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={() => handleDragStart(deal.id)}
                        className={`group rounded-lg border border-border/40 bg-card p-3 cursor-grab active:cursor-grabbing hover:border-primary/30 hover:shadow-sm transition-all ${
                          draggedDeal === deal.id ? 'opacity-50' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1.5">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <GripVertical className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                            <span className="text-xs font-semibold truncate">{deal.lead?.business_name || 'Unknown'}</span>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveDeal(deal.id)}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>

                        {deal.lead?.contact_name && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1">
                            <User className="h-3 w-3" /> {deal.lead.contact_name}
                          </div>
                        )}

                        {deal.lead?.industry && (
                          <div className="flex items-center gap-1 text-[10px] text-muted-foreground mb-1.5">
                            <Building2 className="h-3 w-3" /> {deal.lead.industry}
                          </div>
                        )}

                        <div className="flex items-center justify-between">
                          {deal.deal_value ? (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              <DollarSign className="h-2.5 w-2.5" />{deal.deal_value.toLocaleString()}
                            </Badge>
                          ) : <span />}
                          {deal.close_date && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Calendar className="h-2.5 w-2.5" />
                              {new Date(deal.close_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          )}
                        </div>

                        {deal.lead?.email && (
                          <div className="flex items-center gap-2 mt-1.5 pt-1.5 border-t border-border/20">
                            {deal.lead.email && (
                              <span className="text-[9px] text-muted-foreground flex items-center gap-0.5 truncate">
                                <Mail className="h-2.5 w-2.5" /> {deal.lead.email}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}

                    {/* Add deal button */}
                    <button
                      onClick={() => { setAddDealStageId(stage.id); setAddDealOpen(true); }}
                      className="w-full rounded-lg border border-dashed border-border/40 hover:border-primary/40 hover:bg-primary/5 p-2 flex items-center justify-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-all"
                    >
                      <Plus className="h-3 w-3" /> Add deal
                    </button>
                  </div>
                </ScrollArea>
              </div>
            );
          })}
        </div>
      </div>

      {/* Add Deal Dialog */}
      <Dialog open={addDealOpen} onOpenChange={setAddDealOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm">Add Deal to Pipeline</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Search Leads</label>
              <Input
                placeholder="Search by business name..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <ScrollArea className="h-40 border border-border/40 rounded-lg">
              <div className="p-1.5 space-y-0.5">
                {leadsLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : availableLeads.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">No available leads found</p>
                ) : (
                  availableLeads.map((lead) => (
                    <button
                      key={lead.id}
                      onClick={() => setSelectedLeadId(lead.id)}
                      className={`w-full text-left px-2.5 py-2 rounded-md text-xs transition-colors ${
                        selectedLeadId === lead.id
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="font-medium">{lead.business_name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {[lead.contact_name, lead.industry].filter(Boolean).join(' · ')}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-medium mb-1 block">Deal Value ($)</label>
                <Input
                  type="number"
                  placeholder="0"
                  value={dealValue}
                  onChange={(e) => setDealValue(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Close Date</label>
                <Input
                  type="date"
                  value={dealCloseDate}
                  onChange={(e) => setDealCloseDate(e.target.value)}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setAddDealOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleAddDeal} disabled={!selectedLeadId}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Deal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Stage Dialog */}
      <Dialog open={editStageOpen} onOpenChange={setEditStageOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm">{editingStageId ? 'Edit Stage' : 'Add Stage'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium mb-1 block">Stage Name</label>
              <Input
                value={stageForm.name}
                onChange={(e) => setStageForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Discovery"
                className="h-8 text-xs"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block">Color</label>
              <div className="flex gap-2">
                {['#6366f1', '#3b82f6', '#22c55e', '#f59e0b', '#f97316', '#ef4444', '#8b5cf6', '#ec4899'].map((c) => (
                  <button
                    key={c}
                    onClick={() => setStageForm(f => ({ ...f, color: c }))}
                    className={`h-6 w-6 rounded-full border-2 transition-all ${stageForm.color === c ? 'border-foreground scale-110' : 'border-transparent'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex gap-4">
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={stageForm.is_win}
                  onChange={(e) => setStageForm(f => ({ ...f, is_win: e.target.checked, is_loss: e.target.checked ? false : f.is_loss }))}
                  className="rounded"
                />
                <Trophy className="h-3 w-3 text-emerald-500" /> Won stage
              </label>
              <label className="flex items-center gap-1.5 text-xs">
                <input
                  type="checkbox"
                  checked={stageForm.is_loss}
                  onChange={(e) => setStageForm(f => ({ ...f, is_loss: e.target.checked, is_win: e.target.checked ? false : f.is_win }))}
                  className="rounded"
                />
                <XCircle className="h-3 w-3 text-destructive" /> Lost stage
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setEditStageOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveStage} disabled={!stageForm.name.trim()}>
              {editingStageId ? 'Save Changes' : 'Add Stage'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Pipeline;
