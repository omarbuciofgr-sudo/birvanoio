import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  Mail,
  MessageSquare,
  Search,
  RefreshCw,
  CheckCircle,
  Clock,
  XCircle,
  AlertCircle,
  Eye,
  Calendar,
} from "lucide-react";

interface ContactSubmission {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  message: string;
  status: string;
  notes: string | null;
  created_at: string;
  followed_up_at: string | null;
}

const statusOptions = [
  { value: "new", label: "New", color: "bg-blue-500" },
  { value: "contacted", label: "Contacted", color: "bg-yellow-500" },
  { value: "qualified", label: "Qualified", color: "bg-green-500" },
  { value: "converted", label: "Converted", color: "bg-primary" },
  { value: "lost", label: "Lost", color: "bg-destructive" },
];

const Contacts = () => {
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("id");
  const { user } = useAuth();
  
  const [submissions, setSubmissions] = useState<ContactSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedSubmission, setSelectedSubmission] = useState<ContactSubmission | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [editNotes, setEditNotes] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user?.id) return;
      const { data } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      setIsAdmin(!!data);
    };
    checkAdmin();
  }, [user?.id]);

  const fetchSubmissions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("contact_submissions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setSubmissions((data as ContactSubmission[]) || []);

      // Auto-open highlighted submission
      if (highlightId && data) {
        const highlighted = data.find((s: ContactSubmission) => s.id === highlightId);
        if (highlighted) {
          setSelectedSubmission(highlighted as ContactSubmission);
          setEditNotes(highlighted.notes || "");
          setEditStatus(highlighted.status);
          setIsDetailsOpen(true);
        }
      }
    } catch (error: any) {
      console.error("Error fetching submissions:", error);
      toast.error("Failed to load contact submissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      fetchSubmissions();
    }
  }, [isAdmin, highlightId]);

  const handleViewDetails = (submission: ContactSubmission) => {
    setSelectedSubmission(submission);
    setEditNotes(submission.notes || "");
    setEditStatus(submission.status);
    setIsDetailsOpen(true);
  };

  const handleSaveChanges = async () => {
    if (!selectedSubmission) return;
    setSaving(true);

    try {
      const updates: Partial<ContactSubmission> = {
        status: editStatus,
        notes: editNotes,
      };

      // If status changed to contacted and no follow-up date, set it
      if (editStatus !== "new" && !selectedSubmission.followed_up_at) {
        updates.followed_up_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from("contact_submissions")
        .update(updates)
        .eq("id", selectedSubmission.id);

      if (error) throw error;

      toast.success("Contact updated successfully");
      setIsDetailsOpen(false);
      fetchSubmissions();
    } catch (error: any) {
      console.error("Error updating submission:", error);
      toast.error("Failed to update contact");
    } finally {
      setSaving(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = statusOptions.find((s) => s.value === status);
    const icons: Record<string, React.ReactNode> = {
      new: <AlertCircle className="w-3 h-3" />,
      contacted: <Clock className="w-3 h-3" />,
      qualified: <CheckCircle className="w-3 h-3" />,
      converted: <CheckCircle className="w-3 h-3" />,
      lost: <XCircle className="w-3 h-3" />,
    };

    return (
      <Badge
        variant="secondary"
        className={`${statusConfig?.color} text-white gap-1`}
      >
        {icons[status]}
        {statusConfig?.label || status}
      </Badge>
    );
  };

  const filteredSubmissions = submissions.filter((submission) => {
    const matchesSearch =
      searchQuery === "" ||
      `${submission.first_name} ${submission.last_name}`
        .toLowerCase()
        .includes(searchQuery.toLowerCase()) ||
      submission.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      submission.message.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === "all" || submission.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    total: submissions.length,
    new: submissions.filter((s) => s.status === "new").length,
    contacted: submissions.filter((s) => s.status === "contacted").length,
    converted: submissions.filter((s) => s.status === "converted").length,
  };

  if (!isAdmin) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Access Denied
            </h2>
            <p className="text-muted-foreground">
              You need admin privileges to view this page.
            </p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              Contact Submissions
            </h1>
            <p className="text-muted-foreground">
              Manage and follow up on website contact form submissions
            </p>
          </div>
          <Button onClick={fetchSubmissions} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <MessageSquare className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.total}</p>
                  <p className="text-sm text-muted-foreground">Total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <AlertCircle className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.new}</p>
                  <p className="text-sm text-muted-foreground">New</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/10">
                  <Clock className="w-5 h-5 text-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.contacted}</p>
                  <p className="text-sm text-muted-foreground">Contacted</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{stats.converted}</p>
                  <p className="text-sm text-muted-foreground">Converted</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name, email, or message..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-[180px]">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Submissions Table */}
        <Card>
          <CardHeader>
            <CardTitle>Submissions ({filteredSubmissions.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredSubmissions.length === 0 ? (
              <div className="text-center py-8">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No submissions found</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSubmissions.map((submission) => (
                      <TableRow
                        key={submission.id}
                        className={
                          submission.id === highlightId
                            ? "bg-primary/5 border-primary/20"
                            : ""
                        }
                      >
                        <TableCell className="font-medium">
                          {submission.first_name} {submission.last_name}
                        </TableCell>
                        <TableCell>
                          <a
                            href={`mailto:${submission.email}`}
                            className="text-primary hover:underline flex items-center gap-1"
                          >
                            <Mail className="w-3 h-3" />
                            {submission.email}
                          </a>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate">
                          {submission.message}
                        </TableCell>
                        <TableCell>{getStatusBadge(submission.status)}</TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(submission.created_at), "MMM d, yyyy")}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(submission)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Contact Submission Details</DialogTitle>
          </DialogHeader>

          {selectedSubmission && (
            <div className="space-y-6">
              {/* Contact Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Name
                  </label>
                  <p className="text-foreground">
                    {selectedSubmission.first_name} {selectedSubmission.last_name}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Email
                  </label>
                  <p>
                    <a
                      href={`mailto:${selectedSubmission.email}`}
                      className="text-primary hover:underline"
                    >
                      {selectedSubmission.email}
                    </a>
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Submitted
                  </label>
                  <p className="text-foreground flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    {format(
                      new Date(selectedSubmission.created_at),
                      "MMM d, yyyy 'at' h:mm a"
                    )}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-muted-foreground">
                    Followed Up
                  </label>
                  <p className="text-foreground">
                    {selectedSubmission.followed_up_at
                      ? format(
                          new Date(selectedSubmission.followed_up_at),
                          "MMM d, yyyy"
                        )
                      : "Not yet"}
                  </p>
                </div>
              </div>

              {/* Message */}
              <div>
                <label className="text-sm font-medium text-muted-foreground">
                  Niche & Target Location
                </label>
                <div className="mt-1 p-4 rounded-lg bg-secondary/50 text-foreground whitespace-pre-wrap">
                  {selectedSubmission.message}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">
                  Status
                </label>
                <Select value={editStatus} onValueChange={setEditStatus}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium text-muted-foreground block mb-2">
                  Internal Notes
                </label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Add notes about this contact..."
                  rows={3}
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setIsDetailsOpen(false)}
                >
                  Cancel
                </Button>
                <Button onClick={handleSaveChanges} disabled={saving}>
                  {saving ? (
                    <>
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save Changes"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Contacts;
