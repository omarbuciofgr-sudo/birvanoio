import { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Trash2, GripVertical, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import type { SchemaTemplate, SchemaField, CreateSchemaTemplateInput } from '@/types/scraper';

const fieldSchema = z.object({
  field_name: z.string().min(1, 'Field name is required').regex(/^[a-z_][a-z0-9_]*$/, 'Use snake_case format'),
  type: z.enum(['string', 'number', 'array', 'url', 'boolean']),
  description: z.string().min(1, 'Description is required'),
  extraction_hints: z.string().min(1, 'Extraction hints are required'),
  required: z.boolean(),
});

const templateSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  niche: z.string().min(1, 'Niche is required'),
  fields: z.array(fieldSchema).min(1, 'At least one field is required'),
  is_default: z.boolean().optional(),
});

type FormData = z.infer<typeof templateSchema>;

interface SchemaTemplateBuilderProps {
  template?: SchemaTemplate;
  onSave: (data: CreateSchemaTemplateInput) => Promise<void>;
  onCancel: () => void;
}

const FIELD_TYPES = [
  { value: 'string', label: 'Text', description: 'Single text value' },
  { value: 'number', label: 'Number', description: 'Numeric value' },
  { value: 'array', label: 'List', description: 'Multiple values' },
  { value: 'url', label: 'URL', description: 'Web link' },
  { value: 'boolean', label: 'Yes/No', description: 'True or false' },
];

const NICHE_PRESETS = [
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'b2b', label: 'B2B / Corporate' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'legal', label: 'Legal' },
  { value: 'financial', label: 'Financial Services' },
  { value: 'ecommerce', label: 'E-commerce' },
  { value: 'general', label: 'General' },
  { value: 'custom', label: 'Custom' },
];

export function SchemaTemplateBuilder({ template, onSave, onCancel }: SchemaTemplateBuilderProps) {
  const [isSaving, setIsSaving] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: template?.name || '',
      description: template?.description || '',
      niche: template?.niche || '',
      fields: template?.fields || [
        {
          field_name: '',
          type: 'string',
          description: '',
          extraction_hints: '',
          required: false,
        },
      ],
      is_default: template?.is_default || false,
    },
  });

  const { fields, append, remove, move } = useFieldArray({
    control: form.control,
    name: 'fields',
  });

  const handleSubmit = async (data: FormData) => {
    setIsSaving(true);
    try {
      await onSave(data as CreateSchemaTemplateInput);
    } finally {
      setIsSaving(false);
    }
  };

  const addField = () => {
    append({
      field_name: '',
      type: 'string',
      description: '',
      extraction_hints: '',
      required: false,
    });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
        {/* Basic Info */}
        <Card>
          <CardHeader>
            <CardTitle>Template Information</CardTitle>
            <CardDescription>
              Define the basic details of your schema template
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., Real Estate Agents" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="niche"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Niche / Category</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a niche" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {NICHE_PRESETS.map((niche) => (
                        <SelectItem key={niche.value} value={niche.value}>
                          {niche.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what this template is used for..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="is_default"
              render={({ field }) => (
                <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FormLabel className="text-base">Default Template</FormLabel>
                    <FormDescription>
                      Make this template available to all users as a preset
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                </FormItem>
              )}
            />
          </CardContent>
        </Card>

        {/* Universal Fields Info */}
        <Card className="border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Universal Fields
              <Badge variant="secondary">Auto-extracted</Badge>
            </CardTitle>
            <CardDescription>
              These fields are automatically extracted for every lead, regardless of schema:
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="outline">full_name</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">email</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">phone</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">contact_form_url</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">linkedin_url</Badge>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline">source_urls</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom Fields */}
        <Card>
          <CardHeader>
            <CardTitle>Niche-Specific Fields</CardTitle>
            <CardDescription>
              Define custom fields to extract for this niche. Each field includes extraction hints
              to help the AI understand what to look for.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {fields.map((field, index) => (
              <Card key={field.id} className="p-4">
                <div className="flex items-start gap-2">
                  <div className="mt-2 cursor-move text-muted-foreground">
                    <GripVertical className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name={`fields.${index}.field_name`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Field Name</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g., mailing_address" {...field} />
                            </FormControl>
                            <FormDescription>Use snake_case format</FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name={`fields.${index}.type`}
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Type</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {FIELD_TYPES.map((type) => (
                                  <SelectItem key={type.value} value={type.value}>
                                    <div className="flex flex-col">
                                      <span>{type.label}</span>
                                      <span className="text-xs text-muted-foreground">
                                        {type.description}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name={`fields.${index}.description`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Description</FormLabel>
                          <FormControl>
                            <Input
                              placeholder="e.g., Business or office mailing address"
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`fields.${index}.extraction_hints`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Extraction Hints</FormLabel>
                          <FormControl>
                            <Textarea
                              placeholder="e.g., Look for: office address, location, physical address, headquarters"
                              {...field}
                            />
                          </FormControl>
                          <FormDescription>
                            Keywords and patterns to help identify this data on pages
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`fields.${index}.required`}
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center gap-2">
                          <FormControl>
                            <Switch checked={field.value} onCheckedChange={field.onChange} />
                          </FormControl>
                          <FormLabel className="!mt-0">Required field</FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </Card>
            ))}

            <Button type="button" variant="outline" onClick={addField} className="w-full">
              <Plus className="h-4 w-4 mr-2" />
              Add Field
            </Button>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isSaving}>
            <Save className="h-4 w-4 mr-2" />
            {isSaving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
          </Button>
        </div>
      </form>
    </Form>
  );
}
