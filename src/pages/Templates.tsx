import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { OutreachTabs } from "@/components/outreach/OutreachTabs";
import { MessageTemplatesLibrary } from "@/components/templates/MessageTemplatesLibrary";
import { ScriptsLibrary } from "@/components/templates/ScriptsLibrary";
import { ScheduledMessages } from "@/components/scheduling/ScheduledMessages";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Clock, ScrollText } from "lucide-react";
import DataPageSkeleton from "@/components/dashboard/DataPageSkeleton";

const Templates = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) return <DataPageSkeleton />;

  if (!user) return null;

  return (
    <DashboardLayout>
      <OutreachTabs />
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Save winning templates and schedule messages for optimal delivery
          </p>
        </div>

        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList className="flex h-11 w-full justify-start overflow-x-auto p-0.5 bg-muted/60 sm:h-9 sm:w-auto">
            <TabsTrigger value="templates" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FileText className="w-3.5 h-3.5" />
              Templates Library
            </TabsTrigger>
            <TabsTrigger value="scripts" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <ScrollText className="w-3.5 h-3.5" />
              Scripts
            </TabsTrigger>
            <TabsTrigger value="plans" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <ListChecks className="w-3.5 h-3.5" />
              Follow-up plans
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Clock className="w-3.5 h-3.5" />
              Scheduled Messages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <MessageTemplatesLibrary userId={user.id} />
          </TabsContent>

          <TabsContent value="scripts">
            <ScriptsLibrary userId={user.id} />
          </TabsContent>

          <TabsContent value="plans">
            <FollowUpPlansEditor />
          </TabsContent>

          <TabsContent value="scheduled">
            <ScheduledMessages userId={user.id} />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default Templates;
