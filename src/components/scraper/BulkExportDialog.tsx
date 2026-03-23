import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Download, FileSpreadsheet, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { ScrapedLead } from '@/types/scraper';

const EXPORT_FIELDS = [
  { key: 'domain', label: 'Domain', default: true },
  { key: 'full_name', label: 'Full Name', default: true },
  { key: 'best_email', label: 'Email', default: true },
  { key: 'best_phone', label: 'Phone', default: true },
  { key: 'address', label: 'Address', default: true },
  { key: 'lead_type', label: 'Lead Type', default: true },
  { key: 'lead_score', label: 'Lead Score', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'email_validation_status', label: 'Email Validation', default: false },
  { key: 'phone_validation_status', label: 'Phone Validation', default: false },
  { key: 'phone_line_type', label: 'Phone Line Type', default: false },
  { key: 'confidence_score', label: 'Confidence Score', default: false },
  { key: 'source_url', label: 'Source URL', default: false },
  { key: 'source_type', label: 'Source Type', default: false },
  { key: 'tags', label: 'Tags', default: false },
  { key: 'ai_insights', label: 'AI Insights', default: false },
  { key: 'created_at', label: 'Created At', default: false },
  { key: 'scraped_at', label: 'Scraped At', default: false },
];

interface BulkExportDialogProps {
  leads: ScrapedLead[];
  selectedIds?: string[];
  filters?: Record<string, unknown>;
}

export function BulkExportDialog({ leads, selectedIds, filters }: BulkExportDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELDS.filter(f => f.default).map(f => f.key)
  );
  const [exportScope, setExportScope] = useState<'all' | 'selected' | 'filtered'>('all');
  const [format, setFormat] = useState<'csv' | 'json'>('csv');

  const exportMutation = useMutation({
    mutationFn: async () => {
      let dataToExport = leads;
      
      if (exportScope === 'selected' && selectedIds?.length) {
        dataToExport = leads.filter(l => selectedIds.includes(l.id));
      }
      
      // Apply field selection
      const exportData = dataToExport.map(lead => {
        const row: Record<string, unknown> = {};
        selectedFields.forEach(field => {
          const value = lead[field as keyof ScrapedLead];
          if (field === 'tags' && Array.isArray(value)) {
            row[field] = value.join(', ');
          } else if (value instanceof Date) {
            row[field] = value.toISOString();
          } else {
            row[field] = value ?? '';
          }
        });
        return row;
      });

      if (format === 'json') {
        return JSON.stringify(exportData, null, 2);
      }

      // CSV format
      const headers = selectedFields.map(f => {
        const fieldDef = EXPORT_FIELDS.find(ef => ef.key === f);
        return fieldDef?.label || f;
      });
      
      const csvRows = [headers.join(',')];
      exportData.forEach(row => {
        const values = selectedFields.map(field => {
          const val = row[field];
          if (val === null || val === undefined) return '';
          const str = String(val);
          // Escape quotes and wrap in quotes if contains comma or quote
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
          }
          return str;
        });
        csvRows.push(values.join(','));
      });
      
      return csvRows.join('\n');
    },
    onSuccess: (data) => {
      const blob = new Blob([data], { 
        type: format === 'csv' ? 'text/csv' : 'application/json' 
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `leads-export-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success(`Exported ${leads.length} leads`);
      setOpen(false);
    },
    onError: (error) => {
      toast.error('Export failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    },
  });

  const toggleField = (field: string) => {
    setSelectedFields(prev => 
      prev.includes(field) 
        ? prev.filter(f => f !== field)
        : [...prev, field]
    );
  };

  const selectAll = () => setSelectedFields(EXPORT_FIELDS.map(f => f.key));
  const selectNone = () => setSelectedFields([]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Download className="h-4 w-4 mr-2" />
          Export
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            Export Leads
          </DialogTitle>
          <DialogDescription>
            Select fields and format to export your leads data.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Export Scope */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Export Scope</Label>
            <RadioGroup value={exportScope} onValueChange={(v) => setExportScope(v as 'all' | 'selected' | 'filtered')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="all" />
                <Label htmlFor="all" className="font-normal">All leads ({leads.length})</Label>
              </div>
              {selectedIds && selectedIds.length > 0 && (
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="selected" id="selected" />
                  <Label htmlFor="selected" className="font-normal">Selected leads ({selectedIds.length})</Label>
                </div>
              )}
            </RadioGroup>
          </div>

          {/* Format */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Format</Label>
            <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'csv' | 'json')}>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="font-normal">CSV</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="json" id="json" />
                  <Label htmlFor="json" className="font-normal">JSON</Label>
                </div>
              </div>
            </RadioGroup>
          </div>

          {/* Field Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-medium">Fields to Export</Label>
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={selectAll}>Select All</Button>
                <Button variant="ghost" size="sm" onClick={selectNone}>Clear</Button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-md">
              {EXPORT_FIELDS.map(field => (
                <div key={field.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={field.key}
                    checked={selectedFields.includes(field.key)}
                    onCheckedChange={() => toggleField(field.key)}
                  />
                  <Label htmlFor={field.key} className="text-sm font-normal cursor-pointer">
                    {field.label}
                  </Label>
                </div>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedFields.length} fields selected
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button 
            onClick={() => exportMutation.mutate()} 
            disabled={exportMutation.isPending || selectedFields.length === 0}
          >
            {exportMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exporting...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Export {format.toUpperCase()}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
