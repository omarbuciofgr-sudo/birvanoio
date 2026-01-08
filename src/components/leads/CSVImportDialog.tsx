import { useState, useCallback, useEffect } from "react";
import { Upload, FileSpreadsheet, Loader2, AlertCircle, Check, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface CSVImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImportComplete: () => void;
}

interface Profile {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

type LeadField = "business_name" | "contact_name" | "email" | "phone" | "city" | "state" | "zip_code" | "industry" | "source_url" | "notes" | "skip";

const LEAD_FIELDS: { value: LeadField; label: string; required?: boolean }[] = [
  { value: "business_name", label: "Business Name", required: true },
  { value: "contact_name", label: "Contact Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "city", label: "City" },
  { value: "state", label: "State" },
  { value: "zip_code", label: "Zip Code" },
  { value: "industry", label: "Industry" },
  { value: "source_url", label: "Source URL" },
  { value: "notes", label: "Notes" },
  { value: "skip", label: "— Skip this column —" },
];

export function CSVImportDialog({ open, onOpenChange, onImportComplete }: CSVImportDialogProps) {
  const [step, setStep] = useState<"upload" | "map" | "assign" | "importing">("upload");
  const [csvData, setCsvData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, LeadField>>({});
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [clients, setClients] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: number } | null>(null);
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [checkingRole, setCheckingRole] = useState(true);

  // Check if user has admin role
  useEffect(() => {
    const checkAdminRole = async () => {
      setCheckingRole(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setIsAdmin(false);
          setCheckingRole(false);
          return;
        }

        const { data: roleData } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .eq('role', 'admin')
          .maybeSingle();

        setIsAdmin(!!roleData);
      } catch (error) {
        console.error('Error checking admin role:', error);
        setIsAdmin(false);
      }
      setCheckingRole(false);
    };

    if (open) {
      checkAdminRole();
    }
  }, [open]);

  const resetState = () => {
    setStep("upload");
    setCsvData([]);
    setHeaders([]);
    setColumnMapping({});
    setSelectedClientId("");
    setImportResult(null);
  };

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split("\n").filter(line => line.trim());
      const parsed = lines.map(line => {
        // Handle quoted fields with commas
        const result: string[] = [];
        let current = "";
        let inQuotes = false;
        
        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            result.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        result.push(current.trim());
        return result;
      });

      if (parsed.length < 2) {
        toast.error("CSV must have headers and at least one data row");
        return;
      }

      const headerRow = parsed[0];
      const dataRows = parsed.slice(1);

      setHeaders(headerRow);
      setCsvData(dataRows);

      // Auto-map columns based on header names
      const autoMapping: Record<number, LeadField> = {};
      headerRow.forEach((header, index) => {
        const lowerHeader = header.toLowerCase().replace(/[_\s-]/g, "");
        if (lowerHeader.includes("business") || lowerHeader.includes("company")) {
          autoMapping[index] = "business_name";
        } else if (lowerHeader.includes("contact") || lowerHeader === "name" || lowerHeader.includes("owner")) {
          autoMapping[index] = "contact_name";
        } else if (lowerHeader.includes("email")) {
          autoMapping[index] = "email";
        } else if (lowerHeader.includes("phone") || lowerHeader.includes("tel")) {
          autoMapping[index] = "phone";
        } else if (lowerHeader.includes("city")) {
          autoMapping[index] = "city";
        } else if (lowerHeader.includes("state") || lowerHeader === "st") {
          autoMapping[index] = "state";
        } else if (lowerHeader.includes("zip") || lowerHeader.includes("postal")) {
          autoMapping[index] = "zip_code";
        } else if (lowerHeader.includes("industry") || lowerHeader.includes("type")) {
          autoMapping[index] = "industry";
        } else if (lowerHeader.includes("url") || lowerHeader.includes("source") || lowerHeader.includes("link")) {
          autoMapping[index] = "source_url";
        } else if (lowerHeader.includes("note") || lowerHeader.includes("comment")) {
          autoMapping[index] = "notes";
        }
      });

      setColumnMapping(autoMapping);
      setStep("map");
    };

    reader.readAsText(file);
  }, []);

  const fetchClients = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, email, first_name, last_name")
      .order("email");

    if (!error && data) {
      setClients(data);
    }
    setIsLoading(false);
  };

  const handleMappingComplete = async () => {
    // Validate that business_name is mapped
    const hasBusinessName = Object.values(columnMapping).includes("business_name");
    if (!hasBusinessName) {
      toast.error("Please map at least the Business Name field");
      return;
    }

    await fetchClients();
    setStep("assign");
  };

  const handleImport = async () => {
    if (!selectedClientId) {
      toast.error("Please select a client to assign leads to");
      return;
    }

    setStep("importing");
    setIsLoading(true);

    let successCount = 0;
    let failedCount = 0;

    for (const row of csvData) {
      const lead: Record<string, string> = {};
      
      for (const [indexStr, field] of Object.entries(columnMapping)) {
        const index = parseInt(indexStr);
        if (field !== "skip" && row[index]) {
          lead[field] = row[index];
        }
      }

      // Skip rows without business name
      if (!lead.business_name) {
        failedCount++;
        continue;
      }

      const { error } = await supabase.from("leads").insert({
        client_id: selectedClientId,
        business_name: lead.business_name,
        contact_name: lead.contact_name || null,
        email: lead.email || null,
        phone: lead.phone || null,
        city: lead.city || null,
        state: lead.state || null,
        zip_code: lead.zip_code || null,
        industry: lead.industry || null,
        source_url: lead.source_url || null,
        notes: lead.notes || null,
        status: "new",
      });

      if (error) {
        console.error("Failed to import lead:", error);
        failedCount++;
      } else {
        successCount++;
      }
    }

    setImportResult({ success: successCount, failed: failedCount });
    setIsLoading(false);

    if (successCount > 0) {
      toast.success(`Successfully imported ${successCount} leads`);
      onImportComplete();
    }
  };

  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5" />
            Import Leads from CSV
          </DialogTitle>
        </DialogHeader>

        {/* Loading state while checking role */}
        {checkingRole && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Access denied for non-admins */}
        {!checkingRole && !isAdmin && (
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
            <div className="text-center">
              <p className="text-lg font-medium text-foreground">Access Denied</p>
              <p className="text-muted-foreground">
                Only administrators can import leads via CSV.
              </p>
            </div>
            <Button onClick={handleClose}>Close</Button>
          </div>
        )}

        {step === "upload" && !checkingRole && isAdmin && (
          <div className="space-y-4">
            <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
              />
              <label
                htmlFor="csv-upload"
                className="cursor-pointer flex flex-col items-center gap-3"
              >
                <Upload className="w-10 h-10 text-muted-foreground" />
                <div>
                  <p className="font-medium text-foreground">Click to upload CSV</p>
                  <p className="text-sm text-muted-foreground">or drag and drop</p>
                </div>
              </label>
            </div>
            <p className="text-sm text-muted-foreground">
              Your CSV should have headers in the first row. We'll help you map the columns to lead fields.
            </p>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Map your CSV columns to lead fields. We've auto-detected some mappings for you.
            </p>
            
            <div className="text-sm text-muted-foreground bg-secondary/50 p-2 rounded">
              Preview: {csvData.length} rows to import
            </div>

            <div className="space-y-3 max-h-80 overflow-y-auto">
              {headers.map((header, index) => (
                <div key={index} className="flex items-center gap-4">
                  <div className="w-1/2">
                    <Label className="text-sm font-medium">{header}</Label>
                    <p className="text-xs text-muted-foreground truncate">
                      e.g., {csvData[0]?.[index] || "—"}
                    </p>
                  </div>
                  <Select
                    value={columnMapping[index] || "skip"}
                    onValueChange={(value: LeadField) =>
                      setColumnMapping({ ...columnMapping, [index]: value })
                    }
                  >
                    <SelectTrigger className="w-1/2">
                      <SelectValue placeholder="Select field" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_FIELDS.map((field) => (
                        <SelectItem key={field.value} value={field.value}>
                          {field.label}
                          {field.required && " *"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("upload")}>
                Back
              </Button>
              <Button onClick={handleMappingComplete}>
                Continue
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "assign" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select which client these {csvData.length} leads should be assigned to.
            </p>

            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : (
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.user_id} value={client.user_id}>
                      {client.first_name} {client.last_name} ({client.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("map")}>
                Back
              </Button>
              <Button onClick={handleImport} disabled={!selectedClientId}>
                Import {csvData.length} Leads
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "importing" && (
          <div className="space-y-4 py-8">
            {isLoading ? (
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="w-10 h-10 animate-spin text-primary" />
                <p className="text-muted-foreground">Importing leads...</p>
              </div>
            ) : importResult ? (
              <div className="flex flex-col items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                  <Check className="w-8 h-8 text-primary" />
                </div>
                <div className="text-center">
                  <p className="text-lg font-medium text-foreground">Import Complete</p>
                  <p className="text-muted-foreground">
                    {importResult.success} leads imported successfully
                  </p>
                  {importResult.failed > 0 && (
                    <p className="text-sm text-destructive flex items-center gap-1 justify-center mt-1">
                      <AlertCircle className="w-4 h-4" />
                      {importResult.failed} rows failed
                    </p>
                  )}
                </div>
                <Button onClick={handleClose}>Done</Button>
              </div>
            ) : null}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
