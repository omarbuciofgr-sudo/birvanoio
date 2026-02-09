import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { CommunicationPanel } from "@/components/leads/CommunicationPanel";
import { CSVImportDialog } from "@/components/leads/CSVImportDialog";
import { CreateLeadDialog } from "@/components/leads/CreateLeadDialog";
import { LeadScoreBadge } from "@/components/leads/LeadScoreBadge";
import { LeadKanbanBoard } from "@/components/leads/LeadKanbanBoard";
import { LeadActivityTimeline } from "@/components/leads/LeadActivityTimeline";
import { TeamAssignment } from "@/components/leads/TeamAssignment";
import { AIQualifyPanel } from "@/components/leads/AIQualifyPanel";
import { AIOutreachPanel } from "@/components/leads/AIOutreachPanel";
import { AISmartReply } from "@/components/leads/AISmartReply";
import { AISubjectOptimizer } from "@/components/leads/AISubjectOptimizer";
import { AICallPrep } from "@/components/leads/AICallPrep";
import { AIMeetingNotes } from "@/components/leads/AIMeetingNotes";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  Search, ExternalLink, Download, Filter, Upload, Sparkles,
  LayoutGrid, List, Plus, X, ChevronDown, MoreHorizontal,
  Phone, Mail, Globe, MapPin, Calendar, Building2, Users,
  ArrowUpDown, Trash2, Tag, UserCheck, Eye, EyeOff,
  CheckCircle, Clock, TrendingUp, AlertTriangle,
} from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const notesSchema = z.string().max(5000, "Notes must be less than 5000 characters");

type Lead = Database["public"]["Tables"]["leads"]["Row"] & {
  lead_score?: number | null;
};
type LeadStatus = Database["public"]["Enums"]["lead_status"];

const statusOptions: LeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];

const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  new: { label: "New", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", icon: TrendingUp },
  contacted: { label: "Contacted", color: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400", icon: Phone },
  qualified: { label: "Qualified", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400", icon: UserCheck },
  converted: { label: "Converted", color: "bg-green-500/10 text-green-600 dark:text-green-400", icon: CheckCircle },
  lost: { label: "Lost", color: "bg-destructive/10 text-destructive", icon: AlertTriangle },
};

type SortField = "business_name" | "created_at" | "status" | "lead_score" | "city";
type SortDir = "asc" | "desc";

const Leads = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [industryFilter, setIndustryFilter] = useState<string>("all");
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [scoreFilter, setScoreFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());

  const [notes, setNotes] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [isUpdating, setIsUpdating] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");
  const [showFilters, setShowFilters] = useState(false);
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState({
    contact: true,
    email: true,
    phone: true,
    location: true,
    industry: true,
    score: true,
    source: true,
    created: false,
  });

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchLeads();
  }, [user]);

  useEffect(() => {
    if (!selectedLead) return;
    setNotes(selectedLead.notes || "");
    setContactName(selectedLead.contact_name || "");
    setEmail(selectedLead.email || "");
    setPhone(selectedLead.phone || "");
  }, [selectedLead]);

  const fetchLeads = async () => {
    const { data, error } = await supabase.from("leads").select("*").order("created_at", { ascending: false });
    if (!error && data) setLeads(data);
  };

  // Derived data for filters
  const industries = useMemo(() => [...new Set(leads.map(l => l.industry).filter(Boolean))].sort() as string[], [leads]);
  const states = useMemo(() => [...new Set(leads.map(l => l.state).filter(Boolean))].sort() as string[], [leads]);

  const filteredLeads = useMemo(() => {
    let filtered = leads;

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(l =>
        l.business_name.toLowerCase().includes(q) ||
        l.contact_name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q) ||
        l.phone?.includes(q) ||
        l.city?.toLowerCase().includes(q) ||
        l.industry?.toLowerCase().includes(q)
      );
    }

    if (statusFilter !== "all") filtered = filtered.filter(l => l.status === statusFilter);
    if (industryFilter !== "all") filtered = filtered.filter(l => l.industry === industryFilter);
    if (stateFilter !== "all") filtered = filtered.filter(l => l.state === stateFilter);
    if (scoreFilter !== "all") {
      if (scoreFilter === "hot") filtered = filtered.filter(l => (l.lead_score ?? 0) >= 70);
      else if (scoreFilter === "warm") filtered = filtered.filter(l => (l.lead_score ?? 0) >= 40 && (l.lead_score ?? 0) < 70);
      else if (scoreFilter === "cold") filtered = filtered.filter(l => (l.lead_score ?? 0) < 40);
      else if (scoreFilter === "unscored") filtered = filtered.filter(l => l.lead_score == null);
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      let cmp = 0;
      switch (sortField) {
        case "business_name": cmp = a.business_name.localeCompare(b.business_name); break;
        case "created_at": cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime(); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
        case "lead_score": cmp = (a.lead_score ?? -1) - (b.lead_score ?? -1); break;
        case "city": cmp = (a.city || "").localeCompare(b.city || ""); break;
      }
      return sortDir === "desc" ? -cmp : cmp;
    });

    return filtered;
  }, [leads, searchQuery, statusFilter, industryFilter, stateFilter, scoreFilter, sortField, sortDir]);

  const activeFilterCount = [statusFilter, industryFilter, stateFilter, scoreFilter].filter(f => f !== "all").length;

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const toggleSelectAll = () => {
    if (selectedLeads.size === filteredLeads.length) setSelectedLeads(new Set());
    else setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
  };

  const toggleSelectLead = (id: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkUpdateStatus = async (status: LeadStatus) => {
    const ids = Array.from(selectedLeads);
    const { error } = await supabase.from("leads").update({ status }).in("id", ids);
    if (error) toast.error("Failed to update");
    else { toast.success(`Updated ${ids.length} leads to ${status}`); fetchLeads(); setSelectedLeads(new Set()); }
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedLeads);
    const { error } = await supabase.from("leads").delete().in("id", ids);
    if (error) toast.error("Failed to delete");
    else { toast.success(`Deleted ${ids.length} leads`); fetchLeads(); setSelectedLeads(new Set()); }
  };

  const updateLeadStatus = async (leadId: string, status: LeadStatus) => {
    setIsUpdating(true);
    const updates: any = { status };
    if (status === "contacted" && !selectedLead?.contacted_at) updates.contacted_at = new Date().toISOString();
    if (status === "converted" && !selectedLead?.converted_at) updates.converted_at = new Date().toISOString();
    const { error } = await supabase.from("leads").update(updates).eq("id", leadId);
    if (error) toast.error("Failed to update status");
    else { toast.success("Status updated"); fetchLeads(); if (selectedLead) setSelectedLead({ ...selectedLead, status, ...updates }); }
    setIsUpdating(false);
  };

  const updateLeadNotes = async () => {
    if (!selectedLead) return;
    const validation = notesSchema.safeParse(notes);
    if (!validation.success) { toast.error(validation.error.errors[0].message); return; }
    setIsUpdating(true);
    const { error } = await supabase.from("leads").update({ notes: notes.trim() || null }).eq("id", selectedLead.id);
    if (error) toast.error("Failed to save notes");
    else { toast.success("Notes saved"); fetchLeads(); setSelectedLead({ ...selectedLead, notes: notes.trim() || null }); }
    setIsUpdating(false);
  };

  const updateLeadContactInfo = async () => {
    if (!selectedLead) return;
    const contactSchema = z.object({
      contact_name: z.string().trim().max(255).optional(),
      email: z.string().trim().max(255).email("Please enter a valid email").or(z.literal("")).optional(),
      phone: z.string().trim().max(50).optional(),
    });
    const validation = contactSchema.safeParse({ contact_name: contactName, email, phone });
    if (!validation.success) { toast.error(validation.error.errors[0].message); return; }
    const payload = { contact_name: contactName.trim() || null, email: email.trim() || null, phone: phone.trim() || null };
    setIsUpdating(true);
    const { error } = await supabase.from("leads").update(payload).eq("id", selectedLead.id);
    if (error) toast.error("Failed to save contact info");
    else { toast.success("Contact info saved"); fetchLeads(); setSelectedLead({ ...selectedLead, ...payload }); }
    setIsUpdating(false);
  };

  const exportLeads = () => {
    const csv = [
      ["Business Name", "Contact", "Email", "Phone", "City", "State", "Industry", "Status", "Score", "Source URL", "Created"],
      ...filteredLeads.map(l => [
        l.business_name, l.contact_name || "", l.email || "", l.phone || "",
        l.city || "", l.state || "", l.industry || "", l.status,
        l.lead_score?.toString() || "", l.source_url || "",
        new Date(l.created_at).toLocaleDateString(),
      ]),
    ].map(row => row.map(cell => `"${cell}"`).join(",")).join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `leads-${new Date().toISOString().split("T")[0]}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Leads exported!");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filteredLeads.length} of {leads.length} leads
              {activeFilterCount > 0 && ` · ${activeFilterCount} filter${activeFilterCount > 1 ? 's' : ''} active`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "table" | "kanban")}>
              <ToggleGroupItem value="table" aria-label="Table view" className="gap-1 h-8 text-xs px-2.5">
                <List className="w-3.5 h-3.5" />
              </ToggleGroupItem>
              <ToggleGroupItem value="kanban" aria-label="Kanban view" className="gap-1 h-8 text-xs px-2.5">
                <LayoutGrid className="w-3.5 h-3.5" />
              </ToggleGroupItem>
            </ToggleGroup>
            <Button onClick={() => setCreateDialogOpen(true)} size="sm" className="gap-1.5 text-xs h-8">
              <Plus className="w-3.5 h-3.5" /> Add Lead
            </Button>
            <Button onClick={() => setImportDialogOpen(true)} variant="outline" size="sm" className="gap-1.5 text-xs h-8">
              <Upload className="w-3.5 h-3.5" /> Import
            </Button>
            <Button onClick={exportLeads} variant="outline" size="sm" className="gap-1.5 text-xs h-8">
              <Download className="w-3.5 h-3.5" /> Export
            </Button>
          </div>
        </div>

        {/* Search + Filter Bar */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search by name, email, phone, city..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>

          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statusOptions.map(s => (
                <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button
            variant={showFilters ? "secondary" : "outline"}
            size="sm"
            className="gap-1.5 text-xs h-8"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3 h-3" />
            Filters
            {activeFilterCount > 1 && (
              <Badge className="h-4 w-4 p-0 text-[9px] rounded-full flex items-center justify-center">{activeFilterCount}</Badge>
            )}
          </Button>

          {/* Column Visibility */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
                <Eye className="w-3 h-3" /> Columns
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="end">
              <p className="text-[10px] font-medium text-muted-foreground px-2 mb-1">Toggle columns</p>
              {Object.entries(visibleColumns).map(([key, visible]) => (
                <label key={key} className="flex items-center gap-2 px-2 py-1.5 hover:bg-muted/50 rounded cursor-pointer">
                  <Checkbox
                    checked={visible}
                    onCheckedChange={(checked) => setVisibleColumns(prev => ({ ...prev, [key]: !!checked }))}
                  />
                  <span className="text-xs capitalize">{key}</span>
                </label>
              ))}
            </PopoverContent>
          </Popover>

          {activeFilterCount > 0 && (
            <Button variant="ghost" size="sm" className="text-xs h-8 text-muted-foreground" onClick={() => {
              setStatusFilter("all"); setIndustryFilter("all"); setStateFilter("all"); setScoreFilter("all");
            }}>
              <X className="w-3 h-3 mr-1" /> Clear
            </Button>
          )}
        </div>

        {/* Advanced Filters Row */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-border/60 bg-muted/20">
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Filters:</span>

            <Select value={industryFilter} onValueChange={setIndustryFilter}>
              <SelectTrigger className="w-40 h-7 text-xs">
                <Building2 className="w-3 h-3 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Industry" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Industries</SelectItem>
                {industries.map(i => <SelectItem key={i} value={i}>{i}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={stateFilter} onValueChange={setStateFilter}>
              <SelectTrigger className="w-36 h-7 text-xs">
                <MapPin className="w-3 h-3 mr-1 text-muted-foreground" />
                <SelectValue placeholder="State" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All States</SelectItem>
                {states.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={scoreFilter} onValueChange={setScoreFilter}>
              <SelectTrigger className="w-36 h-7 text-xs">
                <Sparkles className="w-3 h-3 mr-1 text-muted-foreground" />
                <SelectValue placeholder="Score" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Scores</SelectItem>
                <SelectItem value="hot">🔥 Hot (70+)</SelectItem>
                <SelectItem value="warm">🌡️ Warm (40-69)</SelectItem>
                <SelectItem value="cold">❄️ Cold (&lt;40)</SelectItem>
                <SelectItem value="unscored">— Unscored</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Bulk Actions Bar */}
        {selectedLeads.size > 0 && (
          <div className="flex items-center gap-3 p-2.5 rounded-lg border border-primary/20 bg-primary/[0.03]">
            <span className="text-xs font-medium">{selectedLeads.size} selected</span>
            <Separator orientation="vertical" className="h-4" />
            <Select onValueChange={(v) => bulkUpdateStatus(v as LeadStatus)}>
              <SelectTrigger className="w-36 h-7 text-xs">
                <SelectValue placeholder="Change status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => (
                  <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="destructive" size="sm" className="h-7 text-xs gap-1" onClick={bulkDelete}>
              <Trash2 className="w-3 h-3" /> Delete
            </Button>
            <Button variant="ghost" size="sm" className="h-7 text-xs ml-auto" onClick={() => setSelectedLeads(new Set())}>
              Cancel
            </Button>
          </div>
        )}

        {/* View Content */}
        {viewMode === "kanban" ? (
          <LeadKanbanBoard
            leads={filteredLeads}
            onLeadClick={(lead) => setSelectedLead(lead)}
            onLeadsUpdate={fetchLeads}
          />
        ) : (
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <ScrollArea className="max-h-[calc(100vh-280px)]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="w-10">
                      <Checkbox
                        checked={selectedLeads.size === filteredLeads.length && filteredLeads.length > 0}
                        onCheckedChange={toggleSelectAll}
                      />
                    </TableHead>
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("business_name")}>
                      <div className="flex items-center gap-1 text-xs">
                        Business {sortField === "business_name" && <ArrowUpDown className="w-3 h-3" />}
                      </div>
                    </TableHead>
                    {visibleColumns.contact && <TableHead className="text-xs">Contact</TableHead>}
                    {visibleColumns.email && <TableHead className="text-xs hidden md:table-cell">Email</TableHead>}
                    {visibleColumns.phone && <TableHead className="text-xs hidden lg:table-cell">Phone</TableHead>}
                    {visibleColumns.location && (
                      <TableHead className="text-xs hidden lg:table-cell cursor-pointer select-none" onClick={() => toggleSort("city")}>
                        <div className="flex items-center gap-1">
                          Location {sortField === "city" && <ArrowUpDown className="w-3 h-3" />}
                        </div>
                      </TableHead>
                    )}
                    {visibleColumns.industry && <TableHead className="text-xs hidden xl:table-cell">Industry</TableHead>}
                    <TableHead className="cursor-pointer select-none" onClick={() => toggleSort("status")}>
                      <div className="flex items-center gap-1 text-xs">
                        Status {sortField === "status" && <ArrowUpDown className="w-3 h-3" />}
                      </div>
                    </TableHead>
                    {visibleColumns.score && (
                      <TableHead className="text-xs cursor-pointer select-none" onClick={() => toggleSort("lead_score")}>
                        <div className="flex items-center gap-1">
                          Score {sortField === "lead_score" && <ArrowUpDown className="w-3 h-3" />}
                        </div>
                      </TableHead>
                    )}
                    {visibleColumns.source && <TableHead className="text-xs hidden sm:table-cell">Source</TableHead>}
                    {visibleColumns.created && (
                      <TableHead className="text-xs hidden xl:table-cell cursor-pointer select-none" onClick={() => toggleSort("created_at")}>
                        <div className="flex items-center gap-1">
                          Created {sortField === "created_at" && <ArrowUpDown className="w-3 h-3" />}
                        </div>
                      </TableHead>
                    )}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={12} className="text-center py-16 text-muted-foreground">
                        <div className="flex flex-col items-center gap-2">
                          <Users className="w-8 h-8 text-muted-foreground/30" />
                          <p className="text-sm font-medium">No leads found</p>
                          <p className="text-xs">Try adjusting your filters or add a new lead</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredLeads.map((lead) => {
                      const sc = statusConfig[lead.status] || statusConfig.new;
                      const location = [lead.city, lead.state].filter(Boolean).join(", ") || "—";
                      return (
                        <TableRow
                          key={lead.id}
                          className={`cursor-pointer transition-colors ${selectedLeads.has(lead.id) ? 'bg-primary/[0.04]' : ''}`}
                          onClick={() => setSelectedLead(lead)}
                        >
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedLeads.has(lead.id)}
                              onCheckedChange={() => toggleSelectLead(lead.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm text-foreground truncate max-w-[200px]">{lead.business_name}</p>
                          </TableCell>
                          {visibleColumns.contact && (
                            <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]">
                              {lead.contact_name || "—"}
                            </TableCell>
                          )}
                          {visibleColumns.email && (
                            <TableCell className="hidden md:table-cell">
                              {lead.email ? (
                                <a href={`mailto:${lead.email}`} onClick={e => e.stopPropagation()} className="text-xs text-primary hover:underline truncate block max-w-[180px]">
                                  {lead.email}
                                </a>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                          )}
                          {visibleColumns.phone && (
                            <TableCell className="hidden lg:table-cell">
                              {lead.phone ? (
                                <a href={`tel:${lead.phone}`} onClick={e => e.stopPropagation()} className="text-xs text-primary hover:underline">
                                  {lead.phone}
                                </a>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                          )}
                          {visibleColumns.location && (
                            <TableCell className="hidden lg:table-cell text-xs text-muted-foreground truncate max-w-[150px]">
                              {location}
                            </TableCell>
                          )}
                          {visibleColumns.industry && (
                            <TableCell className="hidden xl:table-cell">
                              {lead.industry ? (
                                <Badge variant="outline" className="text-[10px] font-normal">{lead.industry}</Badge>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                          )}
                          <TableCell>
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${sc.color}`}>
                              {lead.status}
                            </span>
                          </TableCell>
                          {visibleColumns.score && (
                            <TableCell onClick={(e) => e.stopPropagation()}>
                              <LeadScoreBadge
                                leadId={lead.id}
                                score={lead.lead_score ?? null}
                                onScoreUpdate={(newScore) => {
                                  setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, lead_score: newScore } : l));
                                }}
                              />
                            </TableCell>
                          )}
                          {visibleColumns.source && (
                            <TableCell className="hidden sm:table-cell">
                              {lead.source_url ? (
                                <a href={lead.source_url} target="_blank" rel="noopener noreferrer"
                                  className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
                                  onClick={(e) => e.stopPropagation()}>
                                  View <ExternalLink className="w-2.5 h-2.5" />
                                </a>
                              ) : <span className="text-xs text-muted-foreground">—</span>}
                            </TableCell>
                          )}
                          {visibleColumns.created && (
                            <TableCell className="hidden xl:table-cell text-xs text-muted-foreground">
                              {new Date(lead.created_at).toLocaleDateString()}
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </div>
        )}

        {/* Lead Detail Sheet (slide-out panel) */}
        <Sheet open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
          <SheetContent className="w-full sm:max-w-lg p-0 flex flex-col">
            <SheetHeader className="px-5 pt-5 pb-0">
              <SheetTitle className="text-base font-semibold">{selectedLead?.business_name}</SheetTitle>
              {selectedLead && (
                <div className="flex items-center gap-2 mt-1">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusConfig[selectedLead.status]?.color}`}>
                    {selectedLead.status}
                  </span>
                  {selectedLead.industry && <Badge variant="outline" className="text-[10px]">{selectedLead.industry}</Badge>}
                </div>
              )}
            </SheetHeader>

            {selectedLead && user && (
              <Tabs defaultValue="details" className="flex-1 flex flex-col overflow-hidden">
                <TabsList className="mx-5 mt-4 h-8 p-0.5 bg-muted/60 grid grid-cols-6">
                  <TabsTrigger value="details" className="text-[10px]">Details</TabsTrigger>
                  <TabsTrigger value="ai" className="text-[10px]">AI</TabsTrigger>
                  <TabsTrigger value="outreach" className="text-[10px]">Outreach</TabsTrigger>
                  <TabsTrigger value="activity" className="text-[10px]">Activity</TabsTrigger>
                  <TabsTrigger value="team" className="text-[10px]">Team</TabsTrigger>
                  <TabsTrigger value="comms" className="text-[10px]">Comms</TabsTrigger>
                </TabsList>

                <ScrollArea className="flex-1 px-5 py-4">
                  <TabsContent value="details" className="mt-0 space-y-5">
                    {/* Quick Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <Card className="border-border/60">
                        <CardContent className="p-3 text-center">
                          <p className="text-[10px] text-muted-foreground">Score</p>
                          <div className="mt-1">
                            <LeadScoreBadge
                              leadId={selectedLead.id}
                              score={selectedLead.lead_score ?? null}
                              onScoreUpdate={(newScore) => {
                                setSelectedLead({ ...selectedLead, lead_score: newScore });
                                setLeads(prev => prev.map(l => l.id === selectedLead.id ? { ...l, lead_score: newScore } : l));
                              }}
                            />
                          </div>
                        </CardContent>
                      </Card>
                      <Card className="border-border/60">
                        <CardContent className="p-3 text-center">
                          <p className="text-[10px] text-muted-foreground">Added</p>
                          <p className="text-xs font-medium mt-1">{new Date(selectedLead.created_at).toLocaleDateString()}</p>
                        </CardContent>
                      </Card>
                      <Card className="border-border/60">
                        <CardContent className="p-3 text-center">
                          <p className="text-[10px] text-muted-foreground">Revenue</p>
                          <p className="text-xs font-medium mt-1">{selectedLead.estimated_revenue || "—"}</p>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Contact Info */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Contact</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground">Name</label>
                          <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground">Email</label>
                          <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground">Phone</label>
                          <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="h-8 text-xs" />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] text-muted-foreground">Location</label>
                          <p className="text-xs pt-2">{[selectedLead.city, selectedLead.state, selectedLead.zip_code].filter(Boolean).join(", ") || "—"}</p>
                        </div>
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={updateLeadContactInfo} disabled={isUpdating || (contactName === (selectedLead.contact_name || "") && email === (selectedLead.email || "") && phone === (selectedLead.phone || ""))} size="sm" variant="outline" className="h-7 text-xs">
                          Save Contact
                        </Button>
                      </div>
                    </div>

                    <Separator />

                    {/* Status */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</h4>
                      <div className="flex gap-1.5">
                        {statusOptions.map(s => {
                          const sc = statusConfig[s];
                          return (
                            <Button
                              key={s}
                              variant={selectedLead.status === s ? "default" : "outline"}
                              size="sm"
                              className="h-7 text-[10px] gap-1"
                              onClick={() => updateLeadStatus(selectedLead.id, s)}
                              disabled={isUpdating}
                            >
                              {sc.label}
                            </Button>
                          );
                        })}
                      </div>
                    </div>

                    <Separator />

                    {/* Source */}
                    {selectedLead.source_url && (
                      <div className="space-y-1">
                        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source</h4>
                        <a href={selectedLead.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline inline-flex items-center gap-1">
                          {selectedLead.source_url} <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}

                    {/* Notes */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Notes</h4>
                      <Textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes about this lead..."
                        rows={4}
                        className="text-xs resize-none"
                      />
                      <Button onClick={updateLeadNotes} disabled={isUpdating || notes === (selectedLead.notes || "")} size="sm" className="h-7 text-xs">
                        Save Notes
                      </Button>
                    </div>

                    {/* Timestamps */}
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      {selectedLead.contacted_at && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">First Contacted</p>
                          <p className="text-xs">{new Date(selectedLead.contacted_at).toLocaleDateString()}</p>
                        </div>
                      )}
                      {selectedLead.converted_at && (
                        <div>
                          <p className="text-[10px] text-muted-foreground">Converted</p>
                          <p className="text-xs">{new Date(selectedLead.converted_at).toLocaleDateString()}</p>
                        </div>
                      )}
                    </div>
                  </TabsContent>

                  <TabsContent value="ai" className="mt-0 space-y-4">
                    <AIQualifyPanel lead={selectedLead} />
                    <Separator />
                    <AICallPrep lead={selectedLead} />
                    <Separator />
                    <AIMeetingNotes lead={selectedLead} />
                  </TabsContent>

                  <TabsContent value="outreach" className="mt-0 space-y-4">
                    <AIOutreachPanel lead={selectedLead} />
                    <Separator />
                    <AISubjectOptimizer />
                    <Separator />
                    <AISmartReply lead={selectedLead} />
                  </TabsContent>

                  <TabsContent value="activity" className="mt-0">
                    <LeadActivityTimeline leadId={selectedLead.id} maxHeight="500px" />
                  </TabsContent>

                  <TabsContent value="team" className="mt-0">
                    <TeamAssignment leadId={selectedLead.id} clientId={user.id} />
                  </TabsContent>

                  <TabsContent value="comms" className="mt-0">
                    <CommunicationPanel leadId={selectedLead.id} clientId={user.id} leadEmail={selectedLead.email} leadPhone={selectedLead.phone} leadName={selectedLead.contact_name} />
                  </TabsContent>
                </ScrollArea>
              </Tabs>
            )}
          </SheetContent>
        </Sheet>

        <CSVImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} onImportComplete={fetchLeads} />
        <CreateLeadDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} onLeadCreated={fetchLeads} />
      </div>
    </DashboardLayout>
  );
};

export default Leads;
