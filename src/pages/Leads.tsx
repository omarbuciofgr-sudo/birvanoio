import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { CommunicationPanel } from "@/components/leads/CommunicationPanel";
import { CSVImportDialog } from "@/components/leads/CSVImportDialog";
import { LeadScoreBadge } from "@/components/leads/LeadScoreBadge";
import { LeadKanbanBoard } from "@/components/leads/LeadKanbanBoard";
import { LeadActivityTimeline } from "@/components/leads/LeadActivityTimeline";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Search, ExternalLink, Download, Filter, Upload, Sparkles, LayoutGrid, List } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";

const notesSchema = z.string().max(5000, "Notes must be less than 5000 characters");

type Lead = Database["public"]["Tables"]["leads"]["Row"] & {
  lead_score?: number | null;
};
type LeadStatus = Database["public"]["Enums"]["lead_status"];

const statusOptions: LeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];

const Leads = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchLeads();
    }
  }, [user]);

  useEffect(() => {
    filterLeads();
  }, [leads, searchQuery, statusFilter]);

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setLeads(data);
    }
  };

  const filterLeads = () => {
    let filtered = leads;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (lead) =>
          lead.business_name.toLowerCase().includes(query) ||
          lead.contact_name?.toLowerCase().includes(query) ||
          lead.email?.toLowerCase().includes(query) ||
          lead.city?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((lead) => lead.status === statusFilter);
    }

    setFilteredLeads(filtered);
  };

  const updateLeadStatus = async (leadId: string, status: LeadStatus) => {
    setIsUpdating(true);
    const updates: any = { status };
    
    if (status === "contacted" && !selectedLead?.contacted_at) {
      updates.contacted_at = new Date().toISOString();
    }
    if (status === "converted" && !selectedLead?.converted_at) {
      updates.converted_at = new Date().toISOString();
    }

    const { error } = await supabase
      .from("leads")
      .update(updates)
      .eq("id", leadId);

    if (error) {
      toast.error("Failed to update status");
    } else {
      toast.success("Status updated");
      fetchLeads();
      if (selectedLead) {
        setSelectedLead({ ...selectedLead, status, ...updates });
      }
    }
    setIsUpdating(false);
  };

  const updateLeadNotes = async () => {
    if (!selectedLead) return;
    
    // Validate notes before submitting
    const validation = notesSchema.safeParse(notes);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }
    
    setIsUpdating(true);
    const { error } = await supabase
      .from("leads")
      .update({ notes: notes.trim() || null })
      .eq("id", selectedLead.id);

    if (error) {
      toast.error("Failed to save notes. Please try again.");
    } else {
      toast.success("Notes saved");
      fetchLeads();
      setSelectedLead({ ...selectedLead, notes: notes.trim() || null });
    }
    setIsUpdating(false);
  };

  const exportLeads = () => {
    const csv = [
      ["Business Name", "Contact", "Email", "Phone", "City", "State", "Status", "Source URL"],
      ...filteredLeads.map((lead) => [
        lead.business_name,
        lead.contact_name || "",
        lead.email || "",
        lead.phone || "",
        lead.city || "",
        lead.state || "",
        lead.status,
        lead.source_url || "",
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `leads-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
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
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground">Leads</h1>
            <p className="text-muted-foreground">
              {filteredLeads.length} of {leads.length} leads
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as "table" | "kanban")}>
              <ToggleGroupItem value="table" aria-label="Table view" className="gap-1.5">
                <List className="w-4 h-4" />
                <span className="hidden sm:inline">Table</span>
              </ToggleGroupItem>
              <ToggleGroupItem value="kanban" aria-label="Kanban view" className="gap-1.5">
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden sm:inline">Kanban</span>
              </ToggleGroupItem>
            </ToggleGroup>
            <Button onClick={() => setImportDialogOpen(true)} variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Import CSV</span>
            </Button>
            <Button onClick={exportLeads} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              <span className="hidden sm:inline">Export CSV</span>
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search leads..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 bg-secondary/50 border-border"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-48 bg-secondary/50 border-border">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {statusOptions.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* View Content */}
        {viewMode === "kanban" ? (
          <LeadKanbanBoard
            leads={filteredLeads}
            onLeadClick={(lead) => {
              setSelectedLead(lead);
              setNotes(lead.notes || "");
            }}
            onLeadsUpdate={fetchLeads}
          />
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-secondary/50">
                  <TableHead>Business</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="hidden lg:table-cell">Location</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden sm:table-cell">Score</TableHead>
                  <TableHead className="hidden sm:table-cell">Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                      No leads found
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLeads.map((lead) => (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer hover:bg-secondary/30"
                      onClick={() => {
                        setSelectedLead(lead);
                        setNotes(lead.notes || "");
                      }}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground">{lead.business_name}</p>
                          <p className="text-sm text-muted-foreground md:hidden">
                            {lead.contact_name}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <div>
                          <p className="text-foreground">{lead.contact_name}</p>
                          <p className="text-sm text-muted-foreground">{lead.email}</p>
                        </div>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-muted-foreground">
                        {lead.city}, {lead.state}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex px-2.5 py-1 rounded-full text-xs font-medium ${
                            lead.status === "new"
                              ? "bg-status-new/20 text-status-new"
                              : lead.status === "contacted"
                              ? "bg-status-contacted/20 text-status-contacted"
                              : lead.status === "qualified"
                              ? "bg-status-qualified/20 text-status-qualified"
                              : lead.status === "converted"
                              ? "bg-status-converted/20 text-status-converted"
                              : "bg-status-lost/20 text-status-lost"
                          }`}
                        >
                          {lead.status}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell" onClick={(e) => e.stopPropagation()}>
                        <LeadScoreBadge 
                          leadId={lead.id} 
                          score={lead.lead_score ?? null}
                          onScoreUpdate={(newScore) => {
                            setLeads(prev => prev.map(l => 
                              l.id === lead.id ? { ...l, lead_score: newScore } : l
                            ));
                          }}
                        />
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        {lead.source_url && (
                          <a
                            href={lead.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-primary hover:underline inline-flex items-center gap-1"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View <ExternalLink className="w-3 h-3" />
                          </a>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Lead Detail Dialog */}
        <Dialog open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
          <DialogContent className="bg-card border-border max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="font-display text-2xl">
                {selectedLead?.business_name}
              </DialogTitle>
            </DialogHeader>

            {selectedLead && user && (
              <Tabs defaultValue="details" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="details">Details</TabsTrigger>
                  <TabsTrigger value="activity">Activity</TabsTrigger>
                  <TabsTrigger value="communication">Communication</TabsTrigger>
                </TabsList>
                
                <TabsContent value="activity" className="mt-4">
                  <LeadActivityTimeline leadId={selectedLead.id} maxHeight="350px" />
                </TabsContent>
                
                <TabsContent value="details" className="space-y-6 mt-4">
                  {/* AI Lead Score */}
                  <div className="flex items-center gap-4 p-4 rounded-lg bg-secondary/30 border border-border">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary" />
                      <span className="text-sm font-medium">AI Lead Score:</span>
                    </div>
                    <LeadScoreBadge 
                      leadId={selectedLead.id} 
                      score={selectedLead.lead_score ?? null}
                      onScoreUpdate={(newScore) => {
                        setSelectedLead({ ...selectedLead, lead_score: newScore });
                        setLeads(prev => prev.map(l => 
                          l.id === selectedLead.id ? { ...l, lead_score: newScore } : l
                        ));
                      }}
                    />
                  </div>

                  {/* Contact Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Contact</p>
                      <p className="text-foreground">{selectedLead.contact_name || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Email</p>
                      <p className="text-foreground">{selectedLead.email || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Phone</p>
                      <p className="text-foreground">{selectedLead.phone || "—"}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Location</p>
                      <p className="text-foreground">
                        {selectedLead.city}, {selectedLead.state} {selectedLead.zip_code}
                      </p>
                    </div>
                  </div>

                  {/* Source URL */}
                  {selectedLead.source_url && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Source</p>
                      <a
                        href={selectedLead.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline inline-flex items-center gap-1"
                      >
                        {selectedLead.source_url} <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  )}

                  {/* Status */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Status</p>
                    <Select
                      value={selectedLead.status}
                      onValueChange={(value: LeadStatus) =>
                        updateLeadStatus(selectedLead.id, value)
                      }
                      disabled={isUpdating}
                    >
                      <SelectTrigger className="w-48 bg-secondary/50 border-border">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {statusOptions.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status.charAt(0).toUpperCase() + status.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Notes */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Notes</p>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add notes about this lead..."
                      rows={4}
                      className="bg-secondary/50 border-border resize-none"
                    />
                    <Button
                      onClick={updateLeadNotes}
                      disabled={isUpdating || notes === (selectedLead.notes || "")}
                      className="mt-2"
                      size="sm"
                    >
                      Save Notes
                    </Button>
                  </div>

                  {/* Timestamps */}
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border">
                    <div>
                      <p className="text-xs text-muted-foreground">Added</p>
                      <p className="text-sm text-foreground">
                        {new Date(selectedLead.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    {selectedLead.contacted_at && (
                      <div>
                        <p className="text-xs text-muted-foreground">First Contacted</p>
                        <p className="text-sm text-foreground">
                          {new Date(selectedLead.contacted_at).toLocaleDateString()}
                        </p>
                      </div>
                    )}
                  </div>
                </TabsContent>
                
                <TabsContent value="communication" className="mt-4">
                  <CommunicationPanel
                    leadId={selectedLead.id}
                    clientId={user.id}
                    leadEmail={selectedLead.email}
                    leadPhone={selectedLead.phone}
                    leadName={selectedLead.contact_name}
                  />
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>

        {/* CSV Import Dialog */}
        <CSVImportDialog
          open={importDialogOpen}
          onOpenChange={setImportDialogOpen}
          onImportComplete={fetchLeads}
        />
      </div>
    </DashboardLayout>
  );
};

export default Leads;
