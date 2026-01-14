import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, Copy, FileJson, ChevronDown, ChevronUp, Sparkles, Home, Shield, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { schemaTemplatesApi } from '@/lib/api/scraper';
import { REAL_ESTATE_TEMPLATE, INSURANCE_TEMPLATE, B2B_TEMPLATE } from '@/lib/nicheTemplates';
import type { SchemaTemplate, SchemaField, CreateSchemaTemplateInput } from '@/types/scraper';

interface SchemaTemplatesListProps {
  onEdit: (template: SchemaTemplate) => void;
  onCreateNew: () => void;
  onCreateFromPreset?: (preset: any) => void;
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  string: 'Text',
  number: 'Number',
  array: 'List',
  url: 'URL',
  boolean: 'Yes/No',
};

const NICHE_COLORS: Record<string, string> = {
  real_estate: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  insurance: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  b2b: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  healthcare: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  legal: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
  financial: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  ecommerce: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  general: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  custom: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
};

export function SchemaTemplatesList({ onEdit, onCreateNew, onCreateFromPreset }: SchemaTemplatesListProps) {
  const [expandedTemplates, setExpandedTemplates] = useState<Set<string>>(new Set());
  const queryClient = useQueryClient();

  const createPresetMutation = useMutation({
    mutationFn: schemaTemplatesApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema-templates'] });
      toast.success('Template created from preset');
    },
    onError: (error) => {
      toast.error('Failed to create template', { description: error.message });
    },
  });

  const handleCreateFromPreset = (preset: CreateSchemaTemplateInput) => {
    if (onCreateFromPreset) {
      onCreateFromPreset(preset);
    } else {
      createPresetMutation.mutate(preset);
    }
  };

  const { data: templates, isLoading } = useQuery({
    queryKey: ['schema-templates'],
    queryFn: schemaTemplatesApi.list,
  });

  const deleteMutation = useMutation({
    mutationFn: schemaTemplatesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema-templates'] });
      toast.success('Template deleted');
    },
    onError: (error) => {
      toast.error('Failed to delete template', { description: error.message });
    },
  });

  const duplicateMutation = useMutation({
    mutationFn: async (template: SchemaTemplate) => {
      return schemaTemplatesApi.create({
        name: `${template.name} (Copy)`,
        description: template.description || undefined,
        niche: template.niche,
        fields: template.fields,
        is_default: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schema-templates'] });
      toast.success('Template duplicated');
    },
    onError: (error) => {
      toast.error('Failed to duplicate template', { description: error.message });
    },
  });

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedTemplates);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedTemplates(newExpanded);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Schema Templates</h2>
          <p className="text-muted-foreground">
            Define custom data fields for different lead types
          </p>
        </div>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" disabled={createPresetMutation.isPending}>
                <Sparkles className="h-4 w-4 mr-2" />
                Quick Start
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => handleCreateFromPreset(REAL_ESTATE_TEMPLATE)}>
                <Home className="h-4 w-4 mr-2" />
                Real Estate Template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreateFromPreset(INSURANCE_TEMPLATE)}>
                <Shield className="h-4 w-4 mr-2" />
                Insurance Template
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleCreateFromPreset(B2B_TEMPLATE)}>
                <Building2 className="h-4 w-4 mr-2" />
                B2B Business Template
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button onClick={onCreateNew}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {templates?.length === 0 ? (
        <Card className="p-8 text-center">
          <FileJson className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold mb-2">No templates yet</h3>
          <p className="text-muted-foreground mb-4">
            Create your first schema template to define custom fields for lead extraction.
          </p>
          <div className="flex gap-2 justify-center">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Sparkles className="h-4 w-4 mr-2" />
                  Quick Start Presets
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => handleCreateFromPreset(REAL_ESTATE_TEMPLATE)}>
                  <Home className="h-4 w-4 mr-2" />
                  Real Estate
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCreateFromPreset(INSURANCE_TEMPLATE)}>
                  <Shield className="h-4 w-4 mr-2" />
                  Insurance
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleCreateFromPreset(B2B_TEMPLATE)}>
                  <Building2 className="h-4 w-4 mr-2" />
                  B2B Business
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button onClick={onCreateNew}>
              <Plus className="h-4 w-4 mr-2" />
              Create Custom
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates?.map((template) => (
            <Collapsible
              key={template.id}
              open={expandedTemplates.has(template.id)}
              onOpenChange={() => toggleExpanded(template.id)}
            >
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-lg">{template.name}</CardTitle>
                        {template.is_default && (
                          <Badge variant="secondary">Default</Badge>
                        )}
                      </div>
                      <CardDescription>{template.description}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={NICHE_COLORS[template.niche] || NICHE_COLORS.custom}>
                        {template.niche.replace('_', ' ')}
                      </Badge>
                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="icon">
                          {expandedTemplates.has(template.id) ? (
                            <ChevronUp className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </Button>
                      </CollapsibleTrigger>
                    </div>
                  </div>
                </CardHeader>

                <CollapsibleContent>
                  <CardContent className="pt-0">
                    <div className="space-y-4">
                      {/* Fields list */}
                      <div>
                        <h4 className="text-sm font-medium mb-2">Custom Fields</h4>
                        <div className="grid gap-2">
                          {template.fields.map((field: SchemaField, index: number) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <code className="text-sm font-mono bg-background px-2 py-0.5 rounded">
                                    {field.field_name}
                                  </code>
                                  <Badge variant="outline" className="text-xs">
                                    {FIELD_TYPE_LABELS[field.type] || field.type}
                                  </Badge>
                                  {field.required && (
                                    <Badge variant="destructive" className="text-xs">
                                      Required
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {field.description}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-2 pt-2 border-t">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => duplicateMutation.mutate(template)}
                          disabled={duplicateMutation.isPending}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onEdit(template)}
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Template?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently delete the "{template.name}" template.
                                Existing leads using this template will not be affected.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMutation.mutate(template.id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          ))}
        </div>
      )}
    </div>
  );
}
