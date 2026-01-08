import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { 
  Phone, 
  Mail, 
  MessageSquare, 
  Calendar, 
  ChevronDown, 
  ChevronRight,
  PhoneIncoming,
  PhoneOutgoing,
  Clock,
  User
} from "lucide-react";
import { format, formatDistanceToNow, isToday, isYesterday, isThisWeek } from "date-fns";

interface ActivityItem {
  id: string;
  type: "call" | "email" | "sms" | "note";
  direction?: "inbound" | "outbound";
  content: string | null;
  subject?: string | null;
  sentiment?: string | null;
  duration_seconds?: number | null;
  created_at: string;
}

interface EnhancedActivityTimelineProps {
  leadId: string;
  maxHeight?: string;
}

export function EnhancedActivityTimeline({ leadId, maxHeight = "400px" }: EnhancedActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [groupByDate, setGroupByDate] = useState(true);

  useEffect(() => {
    fetchActivities();
  }, [leadId]);

  const fetchActivities = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("conversation_logs")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setActivities(data as ActivityItem[]);
    }
    setIsLoading(false);
  };

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedItems(newExpanded);
  };

  const getActivityIcon = (activity: ActivityItem) => {
    switch (activity.type) {
      case "call":
        return activity.direction === "inbound" 
          ? <PhoneIncoming className="w-4 h-4 text-green-500" />
          : <PhoneOutgoing className="w-4 h-4 text-blue-500" />;
      case "email":
        return <Mail className="w-4 h-4 text-purple-500" />;
      case "sms":
        return <MessageSquare className="w-4 h-4 text-orange-500" />;
      default:
        return <User className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getActivityTitle = (activity: ActivityItem) => {
    switch (activity.type) {
      case "call":
        return activity.direction === "inbound" ? "Incoming Call" : "Outgoing Call";
      case "email":
        return activity.subject || "Email";
      case "sms":
        return "SMS Message";
      default:
        return "Note";
    }
  };

  const formatDuration = (seconds: number | null | undefined) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getDateGroup = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Today";
    if (isYesterday(date)) return "Yesterday";
    if (isThisWeek(date)) return "This Week";
    return format(date, "MMMM yyyy");
  };

  // Group activities by date
  const groupedActivities = activities.reduce((groups, activity) => {
    const group = getDateGroup(activity.created_at);
    if (!groups[group]) groups[group] = [];
    groups[group].push(activity);
    return groups;
  }, {} as Record<string, ActivityItem[]>);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Clock className="w-4 h-4 animate-pulse mr-2" />
        Loading timeline...
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Calendar className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p>No activity yet</p>
        <p className="text-sm">Calls, emails, and messages will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4" style={{ maxHeight, overflowY: "auto" }}>
      {/* Toggle View */}
      <div className="flex justify-end">
        <Button 
          variant="ghost" 
          size="sm"
          onClick={() => setGroupByDate(!groupByDate)}
        >
          {groupByDate ? "Show All" : "Group by Date"}
        </Button>
      </div>

      {groupByDate ? (
        // Grouped View
        Object.entries(groupedActivities).map(([group, items]) => (
          <div key={group} className="space-y-2">
            <div className="flex items-center gap-2 sticky top-0 bg-background py-1 z-10">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-medium text-muted-foreground px-2">
                {group}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
            {items.map((activity) => (
              <ActivityCard
                key={activity.id}
                activity={activity}
                expanded={expandedItems.has(activity.id)}
                onToggle={() => toggleExpanded(activity.id)}
                getActivityIcon={getActivityIcon}
                getActivityTitle={getActivityTitle}
                formatDuration={formatDuration}
              />
            ))}
          </div>
        ))
      ) : (
        // Flat View
        <div className="space-y-2">
          {activities.map((activity) => (
            <ActivityCard
              key={activity.id}
              activity={activity}
              expanded={expandedItems.has(activity.id)}
              onToggle={() => toggleExpanded(activity.id)}
              getActivityIcon={getActivityIcon}
              getActivityTitle={getActivityTitle}
              formatDuration={formatDuration}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Activity Card Component
function ActivityCard({
  activity,
  expanded,
  onToggle,
  getActivityIcon,
  getActivityTitle,
  formatDuration,
}: {
  activity: ActivityItem;
  expanded: boolean;
  onToggle: () => void;
  getActivityIcon: (a: ActivityItem) => React.ReactNode;
  getActivityTitle: (a: ActivityItem) => string;
  formatDuration: (s: number | null | undefined) => string | null;
}) {
  const hasContent = activity.content && activity.content.length > 100;

  return (
    <Card className="overflow-hidden">
      <Collapsible open={expanded} onOpenChange={onToggle}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-3 cursor-pointer hover:bg-secondary/50 transition-colors">
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="mt-0.5 p-2 rounded-full bg-secondary">
                {getActivityIcon(activity)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm">
                    {getActivityTitle(activity)}
                  </span>
                  {activity.duration_seconds && (
                    <Badge variant="outline" className="text-xs">
                      {formatDuration(activity.duration_seconds)}
                    </Badge>
                  )}
                  {activity.sentiment && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${
                        activity.sentiment === "positive" 
                          ? "bg-green-500/20 text-green-500" 
                          : activity.sentiment === "negative"
                          ? "bg-red-500/20 text-red-500"
                          : "bg-yellow-500/20 text-yellow-500"
                      }`}
                    >
                      {activity.sentiment}
                    </Badge>
                  )}
                </div>
                
                {activity.content && (
                  <p className={`text-sm text-muted-foreground mt-1 ${!expanded && hasContent ? "line-clamp-2" : ""}`}>
                    {activity.content}
                  </p>
                )}

                <p className="text-xs text-muted-foreground mt-2">
                  {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                  {" • "}
                  {format(new Date(activity.created_at), "h:mm a")}
                </p>
              </div>

              {/* Expand indicator */}
              {hasContent && (
                <div className="mt-1">
                  {expanded ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleTrigger>
        
        {hasContent && (
          <CollapsibleContent>
            <div className="px-3 pb-3 pt-0 ml-11">
              <div className="p-3 bg-secondary/30 rounded-lg text-sm">
                {activity.content}
              </div>
            </div>
          </CollapsibleContent>
        )}
      </Collapsible>
    </Card>
  );
}
