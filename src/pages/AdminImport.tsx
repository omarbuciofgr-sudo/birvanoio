import { useState, useCallback, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, FileSpreadsheet, Loader2, AlertCircle, Check, ShieldAlert, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { useAuth } from "@/hooks/useAuth";
import * as XLSX from "xlsx";

interface Profile {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
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

const AdminImport = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  
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
      if (!user) {
        setIsAdmin(false);
        setCheckingRole(false);
        return;
      }

      try {
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

    if (!authLoading) {
      checkAdminRole();
    }
  }, [user, authLoading]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/auth");
    }
  }, [user, authLoading, navigate]);

  const resetState = () => {
    setStep("upload");
    setCsvData([]);
    setHeaders([]);
    setColumnMapping({});
    setSelectedClientId("");
    setImportResult(null);
  };

  const processFileData = useCallback((headerRow: string[], dataRows: string[][]) => {
    if (headerRow.length === 0 || dataRows.length === 0) {
      toast.error("File must have headers and at least one data row");
      return;
    }

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
  }, []);

  const parseCSV = useCallback((text: string): { headers: string[]; data: string[][] } => {
    const lines = text.split("\n").filter(line => line.trim());
    const parsed = lines.map(line => {
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

    return {
      headers: parsed[0] || [],
      data: parsed.slice(1)
    };
  }, []);

  const parseExcel = useCallback((buffer: ArrayBuffer): { headers: string[]; data: string[][] } => {
    const workbook = XLSX.read(buffer, { type: "array" });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to array of arrays
    const jsonData = XLSX.utils.sheet_to_json<string[]>(worksheet, { header: 1 });
    
    // Filter out empty rows
    const filteredData = jsonData.filter(row => row.some(cell => cell !== undefined && cell !== ""));
    
    // Convert all values to strings
    const stringData = filteredData.map(row => 
      row.map(cell => (cell !== undefined && cell !== null) ? String(cell) : "")
    );

    return {
      headers: stringData[0] || [],
      data: stringData.slice(1)
    };
  }, []);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    const isCSV = fileName.endsWith(".csv");
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");

    if (!isCSV && !isExcel) {
      toast.error("Please upload a CSV or Excel file (.csv, .xlsx, .xls)");
      return;
    }

    if (isCSV) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const { headers, data } = parseCSV(text);
        processFileData(headers, data);
      };
      reader.readAsText(file);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const buffer = e.target?.result as ArrayBuffer;
        try {
          const { headers, data } = parseExcel(buffer);
          processFileData(headers, data);
        } catch (error) {
          console.error("Error parsing Excel file:", error);
          toast.error("Failed to parse Excel file. Please check the file format.");
        }
      };
      reader.readAsArrayBuffer(file);
    }
  }, [parseCSV, parseExcel, processFileData]);

  const fetchClients = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("user_id, email, first_name, last_name, company_name")
      .order("email");

    if (!error && data) {
      setClients(data);
    }
    setIsLoading(false);
  };

  const handleMappingComplete = async () => {
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

    try {
      const leads = csvData
        .map(row => {
          const lead: Record<string, string | null> = {};
          
          for (const [indexStr, field] of Object.entries(columnMapping)) {
            const index = parseInt(indexStr);
            if (field !== "skip" && row[index]) {
              lead[field] = row[index];
            }
          }
          
          return lead;
        })
        .filter(lead => lead.business_name);

      if (leads.length === 0) {
        toast.error("No valid leads to import (all rows missing business name)");
        setImportResult({ success: 0, failed: csvData.length });
        setIsLoading(false);
        return;
      }

      const skippedCount = csvData.length - leads.length;

      const { data, error } = await supabase.functions.invoke("import-leads", {
        body: {
          targetClientId: selectedClientId,
          leads: leads,
        },
      });

      if (error) {
        console.error("Import failed:", error);
        toast.error(error.message || "Failed to import leads");
        setImportResult({ success: 0, failed: csvData.length });
        setIsLoading(false);
        return;
      }

      const successCount = data?.imported || 0;
      const failedCount = (data?.failed || 0) + skippedCount;

      setImportResult({ success: successCount, failed: failedCount });

      if (successCount > 0) {
        toast.success(`Successfully imported ${successCount} leads`);
      }
    } catch (err) {
      console.error("Import error:", err);
      toast.error("An unexpected error occurred during import");
      setImportResult({ success: 0, failed: csvData.length });
    }

    setIsLoading(false);
  };

  if (authLoading || checkingRole) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center gap-4 py-8">
              <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
                <ShieldAlert className="w-8 h-8 text-destructive" />
              </div>
              <div className="text-center">
                <p className="text-lg font-medium text-foreground">Access Denied</p>
                <p className="text-muted-foreground">
                  Only administrators can access the lead import tool.
                </p>
              </div>
              <Button onClick={() => navigate("/dashboard")}>Go to Dashboard</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <Button
          variant="ghost"
          className="mb-6"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Button>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-6 h-6" />
              Import Leads to Client CRM
            </CardTitle>
            <CardDescription>
              Upload a CSV file to import leads directly into a client's CRM.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {step === "upload" && (
              <div className="space-y-4">
                <div className="border-2 border-dashed border-border rounded-lg p-12 text-center hover:border-primary/50 transition-colors">
                  <input
                    type="file"
                    accept=".csv,.xlsx,.xls"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer flex flex-col items-center gap-4"
                  >
                    <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <Upload className="w-8 h-8 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-lg">Click to upload</p>
                      <p className="text-sm text-muted-foreground">CSV or Excel files (.csv, .xlsx, .xls)</p>
                    </div>
                  </label>
                </div>
                <p className="text-sm text-muted-foreground text-center">
                  Your file should have headers in the first row. We'll help you map the columns to lead fields.
                </p>
              </div>
            )}

            {step === "map" && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Map your CSV columns to lead fields. We've auto-detected some mappings.
                  </p>
                  <div className="text-sm font-medium text-primary">
                    {csvData.length} rows to import
                  </div>
                </div>

                <div className="space-y-3 max-h-96 overflow-y-auto border border-border rounded-lg p-4">
                  {headers.map((header, index) => (
                    <div key={index} className="flex items-center gap-4 p-2 rounded hover:bg-secondary/50">
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

                <div className="flex justify-between">
                  <Button variant="outline" onClick={resetState}>
                    Start Over
                  </Button>
                  <Button onClick={handleMappingComplete}>
                    Continue to Client Selection
                  </Button>
                </div>
              </div>
            )}

            {step === "assign" && (
              <div className="space-y-6">
                <div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Select which client should receive these <span className="font-medium text-foreground">{csvData.length} leads</span>.
                  </p>

                  {isLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin" />
                    </div>
                  ) : (
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a client" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.user_id} value={client.user_id}>
                            <div className="flex flex-col">
                              <span>
                                {client.first_name || client.last_name 
                                  ? `${client.first_name || ""} ${client.last_name || ""}`.trim()
                                  : client.email}
                              </span>
                              {(client.first_name || client.last_name) && (
                                <span className="text-xs text-muted-foreground">{client.email}</span>
                              )}
                              {client.company_name && (
                                <span className="text-xs text-muted-foreground">{client.company_name}</span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep("map")}>
                    Back to Mapping
                  </Button>
                  <Button onClick={handleImport} disabled={!selectedClientId}>
                    Import {csvData.length} Leads
                  </Button>
                </div>
              </div>
            )}

            {step === "importing" && (
              <div className="py-12">
                {isLoading ? (
                  <div className="flex flex-col items-center gap-4">
                    <Loader2 className="w-12 h-12 animate-spin text-primary" />
                    <p className="text-muted-foreground">Importing leads...</p>
                  </div>
                ) : importResult ? (
                  <div className="flex flex-col items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center">
                      <Check className="w-10 h-10 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-2xl font-semibold text-foreground">Import Complete</p>
                      <p className="text-muted-foreground mt-1">
                        {importResult.success} leads imported successfully
                      </p>
                      {importResult.failed > 0 && (
                        <p className="text-sm text-destructive flex items-center gap-1 justify-center mt-2">
                          <AlertCircle className="w-4 h-4" />
                          {importResult.failed} rows skipped or failed
                        </p>
                      )}
                    </div>
                    <div className="flex gap-3">
                      <Button variant="outline" onClick={resetState}>
                        Import More
                      </Button>
                      <Button onClick={() => navigate("/dashboard")}>
                        Go to Dashboard
                      </Button>
                    </div>
                  </div>
                ) : null}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AdminImport;
