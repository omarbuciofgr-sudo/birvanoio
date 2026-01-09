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
          <h1 className="font-display text-3xl font-bold text-foreground">Messages</h1>
          <p className="text-muted-foreground">
            Save winning templates and schedule messages for optimal delivery
          </p>
        </div>

        <Tabs defaultValue="templates" className="space-y-6">
          <TabsList>
            <TabsTrigger value="templates" className="gap-2">
              <FileText className="w-4 h-4" />
              Templates Library
            </TabsTrigger>
            <TabsTrigger value="scheduled" className="gap-2">
              <Clock className="w-4 h-4" />
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
