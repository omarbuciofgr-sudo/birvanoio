import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Phone, Mail, MessageSquare, FileText, Clock, PhoneOutgoing, PhoneIncoming, MailOpen, MessageCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { SentimentBadge } from "./SentimentBadge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ActivityLog {
  id: string;
  lead_id: string;
  type: string;
  direction: string | null;
  subject: string | null;
  content: string | null;
  duration_seconds: number | null;
  created_at: string;
  recording_url: string | null;
  sentiment: string | null;
}

interface LeadActivityTimelineProps {
  leadId: string;
  maxHeight?: string;
}

const typeIcons: Record<string, { icon: typeof Phone; color: string }> = {
  call: { icon: Phone, color: "text-green-500 bg-green-500/10" },
  email: { icon: Mail, color: "text-blue-500 bg-blue-500/10" },
  sms: { icon: MessageSquare, color: "text-purple-500 bg-purple-500/10" },
  note: { icon: FileText, color: "text-yellow-500 bg-yellow-500/10" },
};

const directionIcons: Record<string, Record<string, typeof PhoneOutgoing>> = {
  call: { outbound: PhoneOutgoing, inbound: PhoneIncoming },
  email: { outbound: Mail, inbound: MailOpen },
  sms: { outbound: MessageSquare, inbound: MessageCircle },
};

export function LeadActivityTimeline({ leadId, maxHeight = "400px" }: LeadActivityTimelineProps) {
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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
      setActivities(data);
    }
    setIsLoading(false);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getActivityIcon = (type: string, direction: string | null) => {
    const typeConfig = typeIcons[type] || typeIcons.note;
    
    if (direction && directionIcons[type]) {
      const DirectionalIcon = directionIcons[type][direction] || typeConfig.icon;
      return { Icon: DirectionalIcon, color: typeConfig.color };
    }
    
    return { Icon: typeConfig.icon, color: typeConfig.color };
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-10 h-10 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No activity yet</p>
        <p className="text-xs mt-1">Communications will appear here</p>
      </div>
    );
  }

  return (
    <ScrollArea style={{ maxHeight }} className="pr-4">
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />

        <div className="space-y-4">
          {activities.map((activity, index) => {
            const { Icon, color } = getActivityIcon(activity.type, activity.direction);
            const isLast = index === activities.length - 1;

            return (
              <div key={activity.id} className="relative flex gap-4">
                {/* Icon */}
                <div className={`relative z-10 flex items-center justify-center w-10 h-10 rounded-full ${color}`}>
                  <Icon className="w-4 h-4" />
                </div>

                {/* Content */}
                <div className={`flex-1 pb-4 ${!isLast ? "" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-foreground capitalize">
                        {activity.type}
                      </span>
                      {activity.direction && (
                        <Badge variant="outline" className="text-xs capitalize">
                          {activity.direction}
                        </Badge>
                      )}
                      {activity.duration_seconds && (
                        <Badge variant="secondary" className="text-xs">
                          {formatDuration(activity.duration_seconds)}
                        </Badge>
                      )}
                      {activity.sentiment && (
                        <SentimentBadge 
                          logId={activity.id} 
                          content={activity.content} 
                          sentiment={activity.sentiment} 
                        />
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0" title={format(new Date(activity.created_at), "PPpp")}>
                      {formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}
                    </span>
                  </div>

                  {activity.subject && (
                    <p className="text-sm font-medium text-foreground mt-1">
                      {activity.subject}
                    </p>
                  )}

                  {activity.content && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                      {activity.content}
                    </p>
                  )}

                  {activity.recording_url && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        <Phone className="w-3 h-3 mr-1" />
                        Recording available
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </ScrollArea>
  );
}
