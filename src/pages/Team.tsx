import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Users, MessageSquare, Activity, Clock, Send, Trash2, Loader2,
  UserPlus, Bell, TrendingUp, Target,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

type TeamActivity = {
  id: string;
  user_id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string | null;
  details: any;
  created_at: string;
};

type TeamComment = {
  id: string;
  lead_id: string;
  user_id: string;
  content: string;
  created_at: string;
  leads?: { business_name: string } | null;
};

type TeamMember = {
  user_id: string;
  role: string;
  profiles?: { email: string; first_name: string | null; last_name: string | null } | null;
};

const actionIcons: Record<string, typeof Activity> = {
  comment: MessageSquare,
  lead_created: UserPlus,
  lead_updated: TrendingUp,
  deal_moved: Target,
};

export default function Team() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch activity feed
  const { data: activities = [], isLoading: loadingActivity } = useQuery({
    queryKey: ["team-activity"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_activity")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as TeamActivity[];
    },
    enabled: !!user,
  });

  // Fetch recent comments
  const { data: comments = [], isLoading: loadingComments } = useQuery({
    queryKey: ["team-comments-recent"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_comments")
        .select("*, leads(business_name)")
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data as TeamComment[];
    },
    enabled: !!user,
  });

  // Fetch workspace members
  const { data: members = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workspace_memberships")
        .select("user_id, role")
        .limit(50);
      if (error) throw error;
      // Fetch profiles separately
      const userIds = (data || []).map(d => d.user_id);
      if (userIds.length === 0) return [] as TeamMember[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, first_name, last_name")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      return (data || []).map(d => ({
        user_id: d.user_id,
        role: d.role,
        profiles: profileMap.get(d.user_id) || null,
      })) as TeamMember[];
    },
    enabled: !!user,
  });

  const getInitials = (member: TeamMember) => {
    if (member.profiles?.first_name) {
      return `${member.profiles.first_name[0]}${(member.profiles.last_name || "")[0] || ""}`.toUpperCase();
    }
    return (member.profiles?.email?.[0] || "?").toUpperCase();
  };

  const getMemberName = (member: TeamMember) => {
    if (member.profiles?.first_name) {
      return `${member.profiles.first_name} ${member.profiles.last_name || ""}`.trim();
    }
    return member.profiles?.email || "Unknown";
  };

  const roleColors: Record<string, string> = {
    owner: "bg-amber-500/10 text-amber-600 border-amber-200",
    admin: "bg-purple-500/10 text-purple-600 border-purple-200",
    member: "bg-blue-500/10 text-blue-600 border-blue-200",
    viewer: "bg-muted text-muted-foreground",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Team</h1>
            <p className="text-sm text-muted-foreground">Collaborate with your team, track activity, and manage members</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Users className="h-4 w-4 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{members.length}</p>
                <p className="text-xs text-muted-foreground">Team Members</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10"><Activity className="h-4 w-4 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold">{activities.length}</p>
                <p className="text-xs text-muted-foreground">Recent Actions</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10"><MessageSquare className="h-4 w-4 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{comments.length}</p>
                <p className="text-xs text-muted-foreground">Comments</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="activity">
          <TabsList>
            <TabsTrigger value="activity">Activity Feed</TabsTrigger>
            <TabsTrigger value="comments">Comments</TabsTrigger>
            <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
          </TabsList>

          {/* Activity Feed */}
          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Activity</CardTitle>
                <CardDescription>What your team has been working on</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingActivity ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : activities.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Activity className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No activity yet. Actions like creating leads, moving deals, and leaving comments will show here.</p>
                  </div>
                ) : (
                  <div className="space-y-1">
                    {activities.map(act => {
                      const Icon = actionIcons[act.action] || Activity;
                      return (
                        <div key={act.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <div className="p-1.5 rounded-full bg-muted mt-0.5">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-medium">{act.action.replace(/_/g, " ")}</span>
                              {act.entity_name && <span className="text-muted-foreground"> · {act.entity_name}</span>}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              <Clock className="h-3 w-3 inline mr-1" />
                              {formatDistanceToNow(new Date(act.created_at), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Comments */}
          <TabsContent value="comments">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Comments</CardTitle>
                <CardDescription>Comments left on leads across your workspace</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingComments ? (
                  <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No comments yet. Leave notes on leads to collaborate with your team.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {comments.map(c => (
                      <div key={c.id} className="flex gap-3 p-3 border rounded-lg">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback className="text-xs bg-primary/10 text-primary">
                            {c.user_id.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            {c.leads?.business_name && (
                              <Badge variant="outline" className="text-[10px]">{c.leads.business_name}</Badge>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="text-sm mt-1">{c.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Members */}
          <TabsContent value="members">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Team Members</CardTitle>
                <CardDescription>People in your workspace</CardDescription>
              </CardHeader>
              <CardContent>
                {members.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm">No team members found. Invite people from Settings to collaborate.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {members.map(m => (
                      <div key={m.user_id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-medium">
                              {getInitials(m)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{getMemberName(m)}</p>
                            <p className="text-xs text-muted-foreground">{m.profiles?.email}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={`text-xs capitalize ${roleColors[m.role] || ""}`}>
                          {m.role}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
