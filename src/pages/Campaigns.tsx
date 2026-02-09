import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { Plus, Mail, Trash2, Edit, Users, Wand2, Loader2, Clock, Sparkles } from "lucide-react";
import { format } from "date-fns";
import { AICampaignOptimizer } from "@/components/campaigns/AICampaignOptimizer";

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CampaignStep {
  id: string;
  campaign_id: string;
  step_order: number;
  delay_days: number;
  subject_template: string;
  body_template: string;
}

interface Enrollment {
  id: string;
  lead_id: string;
  campaign_id: string;
  current_step: number;
  status: string;
  enrolled_at: string;
  lead?: { business_name: string; contact_name: string | null };
}

const Campaigns = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [steps, setSteps] = useState<CampaignStep[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [campaignName, setCampaignName] = useState("");
  const [campaignDescription, setCampaignDescription] = useState("");
  const [editingStep, setEditingStep] = useState<CampaignStep | null>(null);
  const [stepSubject, setStepSubject] = useState("");
  const [stepBody, setStepBody] = useState("");
  const [stepDelay, setStepDelay] = useState(1);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCampaigns();
    }
  }, [user]);

  useEffect(() => {
    if (selectedCampaign) {
      fetchSteps(selectedCampaign.id);
      fetchEnrollments(selectedCampaign.id);
    }
  }, [selectedCampaign]);

  const fetchCampaigns = async () => {
    const { data, error } = await supabase
      .from("email_campaigns")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCampaigns(data);
    }
  };

  const fetchSteps = async (campaignId: string) => {
    const { data, error } = await supabase
      .from("email_campaign_steps")
      .select("*")
      .eq("campaign_id", campaignId)
      .order("step_order", { ascending: true });

    if (!error && data) {
      setSteps(data);
    }
  };

  const fetchEnrollments = async (campaignId: string) => {
    const { data, error } = await supabase
      .from("lead_campaign_enrollments")
      .select("*, lead:leads(business_name, contact_name)")
      .eq("campaign_id", campaignId)
      .order("enrolled_at", { ascending: false });

    if (!error && data) {
      setEnrollments(data as any);
    }
  };

  const createCampaign = async () => {
    if (!user || !campaignName.trim()) return;

    setIsSaving(true);
    const { data, error } = await supabase
      .from("email_campaigns")
      .insert({
        client_id: user.id,
        name: campaignName.trim(),
        description: campaignDescription.trim() || null,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create campaign");
    } else {
      toast.success("Campaign created!");
      setCampaigns([data, ...campaigns]);
      setIsCreating(false);
      setCampaignName("");
      setCampaignDescription("");
      setSelectedCampaign(data);
    }
    setIsSaving(false);
  };

  const toggleCampaignActive = async (campaign: Campaign) => {
    const { error } = await supabase
      .from("email_campaigns")
      .update({ is_active: !campaign.is_active })
      .eq("id", campaign.id);

    if (error) {
      toast.error("Failed to update campaign");
    } else {
      setCampaigns(campaigns.map(c => 
        c.id === campaign.id ? { ...c, is_active: !c.is_active } : c
      ));
      if (selectedCampaign?.id === campaign.id) {
        setSelectedCampaign({ ...selectedCampaign, is_active: !campaign.is_active });
      }
    }
  };

  const deleteCampaign = async (campaignId: string) => {
    const { error } = await supabase
      .from("email_campaigns")
      .delete()
      .eq("id", campaignId);

    if (error) {
      toast.error("Failed to delete campaign");
    } else {
      toast.success("Campaign deleted");
      setCampaigns(campaigns.filter(c => c.id !== campaignId));
      if (selectedCampaign?.id === campaignId) {
        setSelectedCampaign(null);
      }
    }
  };

  const addStep = async () => {
    if (!selectedCampaign || !stepSubject.trim() || !stepBody.trim()) return;

    setIsSaving(true);
    const newOrder = steps.length + 1;

    const { data, error } = await supabase
      .from("email_campaign_steps")
      .insert({
        campaign_id: selectedCampaign.id,
        step_order: newOrder,
        delay_days: stepDelay,
        subject_template: stepSubject.trim(),
        body_template: stepBody.trim(),
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to add step");
    } else {
      toast.success("Step added!");
      setSteps([...steps, data]);
      setIsEditing(false);
      resetStepForm();
    }
    setIsSaving(false);
  };

  const updateStep = async () => {
    if (!editingStep || !stepSubject.trim() || !stepBody.trim()) return;

    setIsSaving(true);
    const { error } = await supabase
      .from("email_campaign_steps")
      .update({
        delay_days: stepDelay,
        subject_template: stepSubject.trim(),
        body_template: stepBody.trim(),
      })
      .eq("id", editingStep.id);

    if (error) {
      toast.error("Failed to update step");
    } else {
      toast.success("Step updated!");
      setSteps(steps.map(s => 
        s.id === editingStep.id 
          ? { ...s, delay_days: stepDelay, subject_template: stepSubject.trim(), body_template: stepBody.trim() }
          : s
      ));
      setIsEditing(false);
      resetStepForm();
    }
    setIsSaving(false);
  };

  const deleteStep = async (stepId: string) => {
    const { error } = await supabase
      .from("email_campaign_steps")
      .delete()
      .eq("id", stepId);

    if (error) {
      toast.error("Failed to delete step");
    } else {
      toast.success("Step deleted");
      setSteps(steps.filter(s => s.id !== stepId));
    }
  };

  const resetStepForm = () => {
    setEditingStep(null);
    setStepSubject("");
    setStepBody("");
    setStepDelay(1);
  };

  const openEditStep = (step: CampaignStep) => {
    setEditingStep(step);
    setStepSubject(step.subject_template);
    setStepBody(step.body_template);
    setStepDelay(step.delay_days);
    setIsEditing(true);
  };

  const generateWithAI = async () => {
    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-message", {
        body: {
          messageType: "email",
          leadName: "{{contact_name}}",
          businessName: "{{business_name}}",
          context: editingStep 
            ? `Follow-up email step ${editingStep.step_order} in a drip campaign`
            : `First email in a lead nurturing drip campaign`,
        },
      });

      if (error) throw error;

      if (data?.subject) setStepSubject(data.subject);
      if (data?.body) setStepBody(data.body);
      toast.success("AI generated email template!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate template");
    } finally {
      setIsGenerating(false);
    }
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
            <h1 className="text-2xl font-semibold tracking-tight">Email Campaigns</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Create automated email sequences for lead nurturing
            </p>
          </div>
          <Button onClick={() => setIsCreating(true)} size="sm" className="gap-1.5 text-xs">
            <Plus className="w-3.5 h-3.5" />
            New Campaign
          </Button>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Campaign List */}
          <div className="space-y-4">
            <h2 className="font-medium text-foreground">Your Campaigns</h2>
            {campaigns.length === 0 ? (
              <Card className="p-6 text-center text-muted-foreground">
                <Mail className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No campaigns yet</p>
                <p className="text-xs mt-1">Create your first drip campaign</p>
              </Card>
            ) : (
              campaigns.map((campaign) => (
                <Card
                  key={campaign.id}
                  className={`cursor-pointer transition-all hover:border-primary/50 ${
                    selectedCampaign?.id === campaign.id ? "border-primary" : ""
                  }`}
                  onClick={() => setSelectedCampaign(campaign)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{campaign.name}</CardTitle>
                        {campaign.description && (
                          <CardDescription className="text-xs mt-1">
                            {campaign.description}
                          </CardDescription>
                        )}
                      </div>
                      <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                        <Switch
                          checked={campaign.is_active}
                          onCheckedChange={() => toggleCampaignActive(campaign)}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => deleteCampaign(campaign.id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={campaign.is_active ? "default" : "secondary"}>
                        {campaign.is_active ? "Active" : "Paused"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        Created {format(new Date(campaign.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Campaign Details */}
          <div className="lg:col-span-2 space-y-4">
            {selectedCampaign ? (
              <>
                {/* Steps */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Mail className="w-5 h-5" />
                          Email Sequence
                        </CardTitle>
                        <CardDescription>
                          Define the emails in your drip campaign
                        </CardDescription>
                      </div>
                      <Button size="sm" onClick={() => { resetStepForm(); setIsEditing(true); }}>
                        <Plus className="w-4 h-4 mr-1" />
                        Add Step
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {steps.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        <Clock className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No steps yet</p>
                        <p className="text-xs mt-1">Add emails to your sequence</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {steps.map((step, index) => (
                          <div
                            key={step.id}
                            className="flex items-start gap-4 p-3 rounded-lg bg-secondary/30 border border-border"
                          >
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary font-medium text-sm shrink-0">
                              {step.step_order}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm text-foreground truncate">
                                  {step.subject_template}
                                </span>
                                {index > 0 && (
                                  <Badge variant="outline" className="text-xs shrink-0">
                                    +{step.delay_days} day{step.delay_days !== 1 ? "s" : ""}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2">
                                {step.body_template}
                              </p>
                            </div>
                            <div className="flex gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditStep(step)}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive"
                                onClick={() => deleteStep(step.id)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* AI Campaign Optimizer */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-primary" />
                      AI Campaign Optimizer
                    </CardTitle>
                    <CardDescription>
                      Get AI-powered suggestions to improve this campaign
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AICampaignOptimizer
                      campaignId={selectedCampaign.id}
                    />
                  </CardContent>
                </Card>

                {/* Enrolled Leads */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="w-5 h-5" />
                      Enrolled Leads
                    </CardTitle>
                    <CardDescription>
                      Leads currently in this campaign
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {enrollments.length === 0 ? (
                      <div className="text-center py-6 text-muted-foreground">
                        <p className="text-sm">No leads enrolled</p>
                        <p className="text-xs mt-1">Enroll leads from the Leads page</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Lead</TableHead>
                            <TableHead>Step</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Enrolled</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {enrollments.map((enrollment) => (
                            <TableRow key={enrollment.id}>
                              <TableCell>
                                <div>
                                  <p className="font-medium">{enrollment.lead?.business_name}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {enrollment.lead?.contact_name}
                                  </p>
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline">
                                  Step {enrollment.current_step}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <Badge
                                  variant={enrollment.status === "active" ? "default" : "secondary"}
                                >
                                  {enrollment.status}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {format(new Date(enrollment.enrolled_at), "MMM d, yyyy")}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </>
            ) : (
              <Card className="h-full flex items-center justify-center p-12">
                <div className="text-center text-muted-foreground">
                  <Mail className="w-12 h-12 mx-auto mb-4 opacity-30" />
                  <p>Select a campaign to view details</p>
                  <p className="text-sm mt-1">Or create a new one to get started</p>
                </div>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Create Campaign Dialog */}
      <Dialog open={isCreating} onOpenChange={setIsCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Email Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Campaign Name</label>
              <Input
                value={campaignName}
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="e.g., New Lead Nurture Sequence"
                className="mt-1"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description (optional)</label>
              <Textarea
                value={campaignDescription}
                onChange={(e) => setCampaignDescription(e.target.value)}
                placeholder="Describe the purpose of this campaign..."
                className="mt-1"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsCreating(false)}>Cancel</Button>
            <Button onClick={createCampaign} disabled={isSaving || !campaignName.trim()}>
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Create Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit/Add Step Dialog */}
      <Dialog open={isEditing} onOpenChange={setIsEditing}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{editingStep ? "Edit Step" : "Add Email Step"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Delay (days after previous step)</label>
              <Input
                type="number"
                min={0}
                value={stepDelay}
                onChange={(e) => setStepDelay(parseInt(e.target.value) || 0)}
                className="mt-1 w-32"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Set to 0 for immediate send
              </p>
            </div>
            <div>
              <label className="text-sm font-medium">Subject Line</label>
              <Input
                value={stepSubject}
                onChange={(e) => setStepSubject(e.target.value)}
                placeholder="e.g., Quick question about {{business_name}}"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {"{{contact_name}}"} and {"{{business_name}}"} as placeholders
              </p>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Email Body</label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={generateWithAI}
                  disabled={isGenerating}
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Wand2 className="w-4 h-4 mr-2" />
                  )}
                  Generate with AI
                </Button>
              </div>
              <Textarea
                value={stepBody}
                onChange={(e) => setStepBody(e.target.value)}
                placeholder="Write your email content..."
                className="mt-1"
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setIsEditing(false); resetStepForm(); }}>
              Cancel
            </Button>
            <Button
              onClick={editingStep ? updateStep : addStep}
              disabled={isSaving || !stepSubject.trim() || !stepBody.trim()}
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingStep ? "Update Step" : "Add Step"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default Campaigns;
