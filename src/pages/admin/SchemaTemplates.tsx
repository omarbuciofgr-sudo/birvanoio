import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { SchemaTemplatesList } from '@/components/scraper/SchemaTemplatesList';
import { SchemaTemplateBuilder } from '@/components/scraper/SchemaTemplateBuilder';
import { schemaTemplatesApi } from '@/lib/api/scraper';
import { ALL_NICHE_TEMPLATES, REAL_ESTATE_TEMPLATE, INSURANCE_TEMPLATE, B2B_TEMPLATE } from '@/lib/nicheTemplates';
import type { SchemaTemplate, CreateSchemaTemplateInput } from '@/types/scraper';

type ViewMode = 'list' | 'create' | 'edit';

export default function SchemaTemplates() {
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [editingTemplate, setEditingTemplate] = useState<SchemaTemplate | null>(null);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: schemaTemplatesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema-templates'] });
      toast.success('Template created successfully');
      setViewMode('list');
    },
    onError: (error) => {
      toast.error('Failed to create template', { description: error.message });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: CreateSchemaTemplateInput }) =>
      schemaTemplatesApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema-templates'] });
      toast.success('Template updated successfully');
      setViewMode('list');
      setEditingTemplate(null);
    },
    onError: (error) => {
      toast.error('Failed to update template', { description: error.message });
    },
  });

  const handleEdit = (template: SchemaTemplate) => {
    setEditingTemplate(template);
    setViewMode('edit');
  };

  const handleSave = async (data: CreateSchemaTemplateInput) => {
    if (viewMode === 'edit' && editingTemplate) {
      await updateMutation.mutateAsync({ id: editingTemplate.id, data });
    } else {
      await createMutation.mutateAsync(data);
    }
  };

  const handleCancel = () => {
    setViewMode('list');
    setEditingTemplate(null);
  };

  const handleCreateFromPreset = async (preset: CreateSchemaTemplateInput) => {
    try {
      await createMutation.mutateAsync(preset);
    } catch {
      // Error already handled by mutation
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-6 px-4 max-w-5xl">
        {viewMode === 'list' ? (
          <SchemaTemplatesList
            onEdit={handleEdit}
            onCreateNew={() => setViewMode('create')}
          />
        ) : (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={handleCancel}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold">
                  {viewMode === 'create' ? 'Create Schema Template' : 'Edit Schema Template'}
                </h1>
                <p className="text-muted-foreground">
                  {viewMode === 'create'
                    ? 'Define custom fields for a new lead type'
                    : `Editing: ${editingTemplate?.name}`}
                </p>
              </div>
            </div>

            <SchemaTemplateBuilder
              template={editingTemplate || undefined}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
