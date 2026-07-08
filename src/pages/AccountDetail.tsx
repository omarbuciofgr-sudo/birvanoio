import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AddToCampaignDialog } from "@/components/leads/AddToCampaignDialog";
import {
  ArrowLeft,
  Building2,
  Download,
  Send,
  Sparkles,
  MapPin,
  Flame,
  CheckCircle,
  Save,
} from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const statusColors: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  contacted: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  qualified: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  converted: "bg-green-500/10 text-green-600 dark:text-green-400",
  lost: "bg-destructive/10 text-destructive",
};

function extractDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v.includes("@")) return v.split("@")[1] || null;
  try {
    const url = v.startsWith("http") ? v : `https://${v}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

const notesKey = (name: string) => `account-notes:${name.trim().toLowerCase()}`;

export default function AccountDetail() {
  const { name } = useParams<{ name: string }>();
  const decodedName = decodeURIComponent(name || "");
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [campaignDialogOpen, setCampaignDialogOpen] = useState(false);
  const [notes, setNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user || !decodedName) return;
    supabase
      .from("leads")
      .select("*")
      .ilike("business_name", decodedName)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setLeads(data);
      });
  }, [user, decodedName]);

  useEffect(() => {
    if (!decodedName) return;
    try {
      setNotes(localStorage.getItem(notesKey(decodedName)) || "");
      setNotesDirty(false);
    } catch {
      /* ignore */
    }
  }, [decodedName]);

  const stats = useMemo(() => {
    const hot = leads.filter((l) => (l.lead_score ?? 0) >= 70).length;
    const converted = leads.filter((l) => l.status === "converted").length;
    const topScore = leads.reduce((m, l) => Math.max(m, l.lead_score ?? 0), 0);
    const domains = Array.from(
      new Set(
        leads
          .flatMap((l) => [extractDomain(l.website), extractDomain(l.email)])
          .filter(Boolean) as string[]
      )
    );
    const industries = Array.from(
      new Set(leads.map((l) => l.industry).filter(Boolean) as string[])
    );
    const locations = Array.from(
      new Set(
        leads
          .map((l) => [l.city, l.state].filter(Boolean).join(", "))
          .filter(Boolean)
      )
    );
    const lastActivity = leads.reduce<string | null>((latest, l) => {
      if (!latest) return l.created_at;
      return new Date(l.created_at) > new Date(latest) ? l.created_at : latest;
    }, null);
    return { hot, converted, topScore, domains, industries, locations, lastActivity };
  }, [leads]);

  const saveNotes = () => {
    try {
      localStorage.setItem(notesKey(decodedName), notes);
      setNotesDirty(false);
      toast.success("Notes saved");
    } catch {
      toast.error("Could not save notes");
    }
  };

  const exportCsv = () => {
    const rows = [
      ["Business", "Contact", "Email", "Phone", "City", "State", "Industry", "Status", "Score", "Created"],
      ...leads.map((l) => [
        l.business_name,
        l.contact_name || "",
        l.email || "",
        l.phone || "",
        l.city || "",
        l.state || "",
        l.industry || "",
        l.status,
        l.lead_score?.toString() || "",
        new Date(l.created_at).toLocaleDateString(),
      ]),
    ]
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${decodedName}-leads.csv`;
    a.click();
    URL.revokeObjectURL(url);
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={() => navigate("/dashboard/accounts")}
            >
              <ArrowLeft className="w-4 h-4" /> Accounts
            </Button>
            <div className="w-10 h-10 rounded-md bg-primary/10 text-primary flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-2xl font-semibold tracking-tight truncate">
                {decodedName}
              </h1>
              <p className="text-xs text-muted-foreground truncate">
                {stats.domains.length > 0
                  ? stats.domains.join(" · ")
                  : "No domain detected"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={exportCsv}
              disabled={leads.length === 0}
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => setCampaignDialogOpen(true)}
              disabled={leads.length === 0}
            >
              <Send className="w-3.5 h-3.5" /> Add to Campaign
            </Button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Leads</p>
              <p className="text-lg font-semibold mt-1">{leads.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Flame className="w-3 h-3" /> Hot leads
              </p>
              <p className="text-lg font-semibold mt-1">{stats.hot}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Converted
              </p>
              <p className="text-lg font-semibold mt-1">{stats.converted}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Top score
              </p>
              <p className="text-lg font-semibold mt-1">{stats.topScore || "—"}</p>
            </CardContent>
          </Card>
        </div>

        {/* Meta chips */}
        <div className="flex flex-wrap gap-1">
          {stats.industries.map((i) => (
            <Badge key={i} variant="outline" className="text-[10px]">
              {i}
            </Badge>
          ))}
          {stats.locations.slice(0, 4).map((l) => (
            <Badge key={l} variant="secondary" className="text-[10px] gap-1">
              <MapPin className="w-2.5 h-2.5" /> {l}
            </Badge>
          ))}
        </div>

        <Tabs defaultValue="leads">
          <TabsList className="h-8">
            <TabsTrigger value="leads" className="text-xs">Leads</TabsTrigger>
            <TabsTrigger value="activity" className="text-xs">Activity</TabsTrigger>
            <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
          </TabsList>

          <TabsContent value="leads" className="mt-3">
            <Card>
              <CardContent className="p-0">
                {leads.length === 0 ? (
                  <div className="p-8 text-center text-sm text-muted-foreground">
                    No leads for this company yet.
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contact</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Score</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leads.map((l) => (
                        <TableRow
                          key={l.id}
                          className="cursor-pointer"
                          onClick={() => navigate(`/dashboard/leads?lead=${l.id}`)}
                        >
                          <TableCell className="font-medium">
                            {l.contact_name || "—"}
                          </TableCell>
                          <TableCell className="text-xs">{l.email || "—"}</TableCell>
                          <TableCell className="text-xs">{l.phone || "—"}</TableCell>
                          <TableCell className="text-xs">
                            {[l.city, l.state].filter(Boolean).join(", ") || "—"}
                          </TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                statusColors[l.status] || ""
                              }`}
                            >
                              {l.status}
                            </span>
                          </TableCell>
                          <TableCell className="text-right text-xs font-medium">
                            {l.lead_score ?? "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity" className="mt-3">
            <Card>
              <CardContent className="p-4 space-y-2 text-sm">
                {stats.lastActivity ? (
                  <p className="text-muted-foreground">
                    Last lead added on{" "}
                    <span className="font-medium text-foreground">
                      {new Date(stats.lastActivity).toLocaleString()}
                    </span>
                  </p>
                ) : (
                  <p className="text-muted-foreground">No activity yet.</p>
                )}
                <p className="text-xs text-muted-foreground">
                  A merged company-level activity timeline arrives once accounts become
                  their own entity. For now, open an individual lead from the Leads tab
                  to see its detailed timeline.
                </p>
                <Link
                  to="/dashboard/leads"
                  className="text-xs text-primary hover:underline inline-block"
                >
                  Go to Leads →
                </Link>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="notes" className="mt-3">
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-[11px] text-muted-foreground">
                  Company-level notes. Stored locally in your browser for now; they'll
                  move to the database when accounts become a first-class entity.
                </p>
                <Textarea
                  value={notes}
                  onChange={(e) => {
                    setNotes(e.target.value);
                    setNotesDirty(true);
                  }}
                  placeholder="Anything worth remembering about this account..."
                  rows={8}
                  className="text-sm"
                />
                <div className="flex justify-end">
                  <Button size="sm" onClick={saveNotes} disabled={!notesDirty} className="gap-1">
                    <Save className="w-3.5 h-3.5" /> Save notes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <AddToCampaignDialog
        open={campaignDialogOpen}
        onOpenChange={setCampaignDialogOpen}
        leadIds={leads.map((l) => l.id)}
      />
    </DashboardLayout>
  );
}
