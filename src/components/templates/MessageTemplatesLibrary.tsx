import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Mail, MessageSquare, Copy, Pencil, Trash2, Search } from "lucide-react";

interface MessageTemplate {
  id: string;
  name: string;
  type: "email" | "sms";
  subject: string | null;
  body: string;
  category: string | null;
  is_shared: boolean;
  usage_count: number;
  created_at: string;
}

interface MessageTemplatesLibraryProps {
  userId: string;
  onSelectTemplate?: (template: MessageTemplate) => void;
  selectionMode?: boolean;
}

const categories = [
  { value: "introduction", label: "Introduction" },
  { value: "follow-up", label: "Follow-up" },
  { value: "closing", label: "Closing" },
  { value: "nurture", label: "Nurture" },
  { value: "re-engagement", label: "Re-engagement" },
];

export function MessageTemplatesLibrary({ 
  userId, 
  onSelectTemplate,
  selectionMode = false 
}: MessageTemplatesLibraryProps) {
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<MessageTemplate | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"all" | "email" | "sms">("all");

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    type: "email" as "email" | "sms",
    subject: "",
    body: "",
    category: "",
    is_shared: false,
  });

  useEffect(() => {
    fetchTemplates();
  }, [userId]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("message_templates")
      .select("*")
      .order("usage_count", { ascending: false });

    if (!error && data) {
      setTemplates(data as MessageTemplate[]);
    }
    setIsLoading(false);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.body) {
      toast.error("Name and body are required");
      return;
    }

    const templateData = {
      client_id: userId,
      name: formData.name,
      type: formData.type,
      subject: formData.type === "email" ? formData.subject : null,
      body: formData.body,
      category: formData.category || null,
      is_shared: formData.is_shared,
    };

    if (editingTemplate) {
      const { error } = await supabase
        .from("message_templates")
        .update(templateData)
        .eq("id", editingTemplate.id);

      if (error) {
        toast.error("Failed to update template");
        return;
      }
      toast.success("Template updated");
    } else {
      const { error } = await supabase
        .from("message_templates")
        .insert(templateData);

      if (error) {
        toast.error("Failed to create template");
        return;
      }
      toast.success("Template created");
    }

    setIsDialogOpen(false);
    resetForm();
    fetchTemplates();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("message_templates")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete template");
      return;
    }
    toast.success("Template deleted");
    fetchTemplates();
  };

  const handleUseTemplate = async (template: MessageTemplate) => {
    // Increment usage count
    await supabase
      .from("message_templates")
      .update({ usage_count: template.usage_count + 1 })
      .eq("id", template.id);

    if (onSelectTemplate) {
      onSelectTemplate(template);
    } else {
      // Copy to clipboard
      navigator.clipboard.writeText(template.body);
      toast.success("Template copied to clipboard");
    }
    fetchTemplates();
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "email",
      subject: "",
      body: "",
      category: "",
      is_shared: false,
    });
    setEditingTemplate(null);
  };

  const openEditDialog = (template: MessageTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      type: template.type,
      subject: template.subject || "",
      body: template.body,
      category: template.category || "",
      is_shared: template.is_shared,
    });
    setIsDialogOpen(true);
  };

  const filteredTemplates = templates.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.body.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "all" || t.type === filterType;
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search templates..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="email">Email</SelectItem>
            <SelectItem value="sms">SMS</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={() => { resetForm(); setIsDialogOpen(true); }} className="gap-2">
          <Plus className="w-4 h-4" />
          New Template
        </Button>
      </div>

      {/* Templates Grid */}
      {isLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading...</div>
      ) : filteredTemplates.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <MessageSquare className="w-12 h-12 mx-auto mb-4 opacity-30" />
          <p>No templates yet</p>
          <p className="text-sm">Create your first template to save time</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => (
            <Card key={template.id} className="hover:border-primary/50 transition-colors">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {template.type === "email" ? (
                      <Mail className="w-4 h-4 text-primary" />
                    ) : (
                      <MessageSquare className="w-4 h-4 text-green-500" />
                    )}
                    <CardTitle className="text-base">{template.name}</CardTitle>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditDialog(template)}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(template.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {template.subject && (
                  <p className="text-sm font-medium text-muted-foreground truncate">
                    Subject: {template.subject}
                  </p>
                )}
                <p className="text-sm text-muted-foreground line-clamp-3">
                  {template.body}
                </p>
                <div className="flex items-center justify-between pt-2">
                  <div className="flex gap-2">
                    {template.category && (
                      <Badge variant="secondary" className="text-xs">
                        {template.category}
                      </Badge>
                    )}
                    {template.is_shared && (
                      <Badge variant="outline" className="text-xs">Shared</Badge>
                    )}
                  </div>
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => handleUseTemplate(template)}
                    className="gap-1"
                  >
                    <Copy className="w-3 h-3" />
                    {selectionMode ? "Use" : "Copy"}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Used {template.usage_count} times
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Template Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Follow-up after demo"
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type</Label>
                <Select 
                  value={formData.type} 
                  onValueChange={(v) => setFormData({ ...formData, type: v as "email" | "sms" })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="sms">SMS</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Category</Label>
                <Select 
                  value={formData.category} 
                  onValueChange={(v) => setFormData({ ...formData, category: v })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>
                        {cat.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.type === "email" && (
              <div>
                <Label>Subject Line</Label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Email subject..."
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <Label>Message Body</Label>
              <Textarea
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Type your message... Use {{name}} for personalization"
                rows={6}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {"{{name}}"}, {"{{company}}"} for merge fields
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={formData.is_shared}
                onCheckedChange={(v) => setFormData({ ...formData, is_shared: v })}
              />
              <Label>Share with team</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              {editingTemplate ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
