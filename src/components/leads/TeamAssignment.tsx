import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { UserPlus, Users, X, Clock } from "lucide-react";
import { format } from "date-fns";

interface TeamMember {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface Assignment {
  id: string;
  lead_id: string;
  assigned_to: string;
  assigned_by: string;
  assigned_at: string;
  notes: string | null;
  assignee?: TeamMember;
}

interface TeamAssignmentProps {
  leadId: string;
  clientId: string;
}

export function TeamAssignment({ leadId, clientId }: TeamAssignmentProps) {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [selectedMember, setSelectedMember] = useState<string>("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);

  useEffect(() => {
    fetchAssignments();
    fetchTeamMembers();
  }, [leadId]);

  const fetchAssignments = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("team_assignments")
      .select("*")
      .eq("lead_id", leadId)
      .order("assigned_at", { ascending: false });

    if (!error && data) {
      // Fetch assignee profiles
      const assigneeIds = data.map(a => a.assigned_to);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, user_id, email, first_name, last_name")
        .in("user_id", assigneeIds);

      const assignmentsWithProfiles = data.map(assignment => ({
        ...assignment,
        assignee: profiles?.find(p => p.user_id === assignment.assigned_to)
      }));

      setAssignments(assignmentsWithProfiles);
    }
    setIsLoading(false);
  };

  const fetchTeamMembers = async () => {
    // Fetch all profiles as potential team members
    // In a real app, you might have a team/organization table
    const { data, error } = await supabase
      .from("profiles")
      .select("id, user_id, email, first_name, last_name")
      .order("email");

    if (!error && data) {
      setTeamMembers(data);
    }
  };

  const assignMember = async () => {
    if (!selectedMember) {
      toast.error("Please select a team member");
      return;
    }

    // Check if already assigned
    if (assignments.some(a => a.assigned_to === selectedMember)) {
      toast.error("This member is already assigned to this lead");
      return;
    }

    setIsAssigning(true);
    const { error } = await supabase
      .from("team_assignments")
      .insert({
        lead_id: leadId,
        assigned_to: selectedMember,
        assigned_by: clientId,
        notes: assignmentNotes.trim() || null,
      });

    if (error) {
      toast.error("Failed to assign team member");
    } else {
      toast.success("Team member assigned");
      setSelectedMember("");
      setAssignmentNotes("");
      fetchAssignments();
    }
    setIsAssigning(false);
  };

  const removeAssignment = async (assignmentId: string) => {
    const { error } = await supabase
      .from("team_assignments")
      .delete()
      .eq("id", assignmentId);

    if (error) {
      toast.error("Failed to remove assignment");
    } else {
      toast.success("Assignment removed");
      fetchAssignments();
    }
  };

  const getInitials = (member: TeamMember) => {
    if (member.first_name && member.last_name) {
      return `${member.first_name[0]}${member.last_name[0]}`.toUpperCase();
    }
    return member.email.substring(0, 2).toUpperCase();
  };

  const getMemberName = (member: TeamMember) => {
    if (member.first_name || member.last_name) {
      return `${member.first_name || ""} ${member.last_name || ""}`.trim();
    }
    return member.email;
  };

  const availableMembers = teamMembers.filter(
    m => !assignments.some(a => a.assigned_to === m.user_id)
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        Loading team assignments...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current Assignments */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="font-medium text-foreground">Assigned Team Members</h3>
          <Badge variant="secondary" className="ml-auto">
            {assignments.length} assigned
          </Badge>
        </div>

        {assignments.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-border rounded-lg">
            <Users className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground text-sm">
              No team members assigned yet
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {assignments.map((assignment) => (
              <div
                key={assignment.id}
                className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm">
                    {assignment.assignee ? getInitials(assignment.assignee) : "??"}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground">
                    {assignment.assignee ? getMemberName(assignment.assignee) : "Unknown"}
                  </p>
                  <p className="text-sm text-muted-foreground truncate">
                    {assignment.assignee?.email}
                  </p>
                  {assignment.notes && (
                    <p className="text-sm text-muted-foreground mt-1 italic">
                      "{assignment.notes}"
                    </p>
                  )}
                  <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    Assigned {format(new Date(assignment.assigned_at), "MMM d, yyyy")}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  onClick={() => removeAssignment(assignment.id)}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Assignment */}
      {availableMembers.length > 0 && (
        <div className="pt-4 border-t border-border">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-4 h-4 text-primary" />
            <h3 className="font-medium text-foreground">Assign Team Member</h3>
          </div>

          <div className="space-y-3">
            <Select value={selectedMember} onValueChange={setSelectedMember}>
              <SelectTrigger className="bg-secondary/50 border-border">
                <SelectValue placeholder="Select a team member" />
              </SelectTrigger>
              <SelectContent>
                {availableMembers.map((member) => (
                  <SelectItem key={member.user_id} value={member.user_id}>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-6 w-6">
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {getInitials(member)}
                        </AvatarFallback>
                      </Avatar>
                      <span>{getMemberName(member)}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Textarea
              placeholder="Add a note about this assignment (optional)"
              value={assignmentNotes}
              onChange={(e) => setAssignmentNotes(e.target.value)}
              rows={2}
              className="bg-secondary/50 border-border resize-none"
            />

            <Button
              onClick={assignMember}
              disabled={!selectedMember || isAssigning}
              className="w-full"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              {isAssigning ? "Assigning..." : "Assign to Lead"}
            </Button>
          </div>
        </div>
      )}

      {availableMembers.length === 0 && teamMembers.length > 0 && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          All team members are already assigned to this lead
        </div>
      )}
    </div>
  );
}
