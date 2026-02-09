import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { MessageTemplatesLibrary } from "@/components/templates/MessageTemplatesLibrary";
import { ScheduledMessages } from "@/components/scheduling/ScheduledMessages";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Clock } from "lucide-react";

const Templates = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

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
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Save winning templates and schedule messages for optimal delivery
          </p>
        </div>

        <Tabs defaultValue="templates" className="space-y-4">
          <TabsList className="h-9 p-0.5 bg-muted/60">
            <TabsTrigger value="templates" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <FileText className="w-3.5 h-3.5" />
              Templates Library
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="text-xs gap-1.5 px-3 data-[state=active]:bg-background data-[state=active]:shadow-sm">
              <Clock className="w-3.5 h-3.5" />
              Scheduled Messages
            </TabsTrigger>
          </TabsList>

          <TabsContent value="templates">
            <MessageTemplatesLibrary userId={user.id} />
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
