import { useState, useCallback } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileSpreadsheet,
  Loader2,
  Sparkles,
  RefreshCw,
  Download,
  CheckCircle2,
  AlertCircle,
  MinusCircle,
  ArrowRight,
  Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useCredits } from "@/hooks/useCredits";
import { CreditLimitPopup } from "@/components/subscription/CreditLimitPopup";

type EnrichmentStatus = "pending" | "enriching" | "enriched" | "partial" | "not_found" | "error";

interface EnrichedRow {
  id: number;
  company_name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  linkedin_url: string | null;
  company_domain: string | null;
  contact_name: string | null;
  job_title: string | null;
  ai_description: string | null;
  enrichment_source: string | null;
  status: EnrichmentStatus;
  original_data: Record<string, string>;
}

type MappableField = "company_name" | "phone" | "email" | "website" | "contact_name" | "skip";

const FIELD_OPTIONS: { value: MappableField; label: string }[] = [
  { value: "company_name", label: "Company Name" },
  { value: "contact_name", label: "Contact Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "website", label: "Website" },
  { value: "skip", label: "— Skip —" },
];

function parseCSV(text: string): string[][] {
  const lines = text.split("\n").filter((line) => line.trim());
  return lines.map((line) => {
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
}

const StatusIcon = ({ status }: { status: EnrichmentStatus }) => {
  switch (status) {
    case "enriched":
      return <CheckCircle2 className="w-4 h-4 text-primary" />;
    case "partial":
      return <MinusCircle className="w-4 h-4 text-accent-foreground" />;
    case "not_found":
      return <AlertCircle className="w-4 h-4 text-muted-foreground" />;
    case "error":
      return <AlertCircle className="w-4 h-4 text-destructive" />;
    case "enriching":
      return <Loader2 className="w-4 h-4 animate-spin text-primary" />;
    default:
      return <MinusCircle className="w-4 h-4 text-muted-foreground" />;
  }
};

const CSVEnrichment = () => {
  const [step, setStep] = useState<"upload" | "map" | "table">("upload");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rawData, setRawData] = useState<string[][]>([]);
  const [columnMapping, setColumnMapping] = useState<Record<number, MappableField>>({});
  const [rows, setRows] = useState<EnrichedRow[]>([]);
  const [isEnrichingAll, setIsEnrichingAll] = useState(false);
  const [enrichProgress, setEnrichProgress] = useState({ done: 0, total: 0 });
  const [showCreditPopup, setShowCreditPopup] = useState(false);
  const { creditsUsed, monthlyAllowance, remaining, isAtLimit, spendCredits, refreshCredits, tier } = useCredits();

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !file.name.endsWith(".csv")) {
      toast.error("Please upload a CSV file");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const parsed = parseCSV(text);
      if (parsed.length < 2) {
        toast.error("CSV must have headers and at least one data row");
        return;
      }

      const headerRow = parsed[0];
      const dataRows = parsed.slice(1);
      setHeaders(headerRow);
      setRawData(dataRows);

      // Auto-map columns
      const autoMapping: Record<number, MappableField> = {};
      headerRow.forEach((header, index) => {
        const h = header.toLowerCase().replace(/[_\s-]/g, "");
        if (h.includes("company") || h.includes("business") || h === "name") {
          autoMapping[index] = "company_name";
        } else if (h.includes("email")) {
          autoMapping[index] = "email";
        } else if (h.includes("phone") || h.includes("tel")) {
          autoMapping[index] = "phone";
        } else if (h.includes("website") || h.includes("url") || h.includes("domain")) {
          autoMapping[index] = "website";
        } else if (h.includes("contact") || h.includes("owner")) {
          autoMapping[index] = "contact_name";
        }
      });
      setColumnMapping(autoMapping);
      setStep("map");
    };
    reader.readAsText(file);
  }, []);

  const handleMappingComplete = () => {
    const hasCompanyName = Object.values(columnMapping).includes("company_name");
    if (!hasCompanyName) {
      toast.error("Please map at least the Company Name column");
      return;
    }

    const enrichedRows: EnrichedRow[] = rawData.map((row, index) => {
      const originalData: Record<string, string> = {};
      headers.forEach((h, i) => {
        if (row[i]) originalData[h] = row[i];
      });

      const getValue = (field: MappableField): string | null => {
        const colIndex = Object.entries(columnMapping).find(([, f]) => f === field)?.[0];
        return colIndex !== undefined ? row[parseInt(colIndex)] || null : null;
      };

      return {
        id: index,
        company_name: getValue("company_name") || "Unknown",
        phone: getValue("phone"),
        email: getValue("email"),
        website: getValue("website"),
        linkedin_url: null,
        company_domain: null,
        contact_name: getValue("contact_name"),
        job_title: null,
        ai_description: null,
        enrichment_source: null,
        status: "pending" as EnrichmentStatus,
        original_data: originalData,
      };
    });

    setRows(enrichedRows);
    setStep("table");
  };

  const enrichRow = async (rowIndex: number) => {
    if (isAtLimit) {
      setShowCreditPopup(true);
      return;
    }

    setRows((prev) =>
      prev.map((r) => (r.id === rowIndex ? { ...r, status: "enriching" as EnrichmentStatus } : r))
    );

    try {
      const row = rows.find((r) => r.id === rowIndex);
      if (!row) return;

      const { data, error } = await supabase.functions.invoke("csv-enrich", {
        body: {
          rows: [{ company_name: row.company_name, existing_data: row.original_data }],
          row_index: rowIndex,
        },
      });

      if (error) throw error;
      const result = data.results?.[0];
      if (result) {
        await spendCredits("enrich", 1);
        setRows((prev) =>
          prev.map((r) =>
            r.id === rowIndex
              ? {
                  ...r,
                  phone: result.phone || r.phone,
                  email: result.email || r.email,
                  website: result.website || r.website,
                  linkedin_url: result.linkedin_url || r.linkedin_url,
                  company_domain: result.company_domain || r.company_domain,
                  contact_name: result.contact_name || r.contact_name,
                  job_title: result.job_title || r.job_title,
                  ai_description: result.ai_description || r.ai_description,
                  enrichment_source: result.enrichment_source || r.enrichment_source,
                  status: result.status as EnrichmentStatus,
                }
              : r
          )
        );
      }
    } catch (error) {
      console.error("Enrichment error:", error);
      setRows((prev) =>
        prev.map((r) => (r.id === rowIndex ? { ...r, status: "error" as EnrichmentStatus } : r))
      );
    }
  };

  const enrichAll = async () => {
    const pendingRows = rows.filter((r) => r.status === "pending" || r.status === "not_found" || r.status === "error");
    if (pendingRows.length === 0) {
      toast.info("All rows are already enriched");
      return;
    }

    if (isAtLimit) {
      setShowCreditPopup(true);
      return;
    }

    // Cap to remaining credits
    const rowsToEnrich = monthlyAllowance === Infinity ? pendingRows : pendingRows.slice(0, Math.floor(remaining / 2));
    if (rowsToEnrich.length < pendingRows.length) {
      toast.info(`Only enriching ${rowsToEnrich.length} of ${pendingRows.length} rows (credit limit)`);
    }

    setIsEnrichingAll(true);
    setEnrichProgress({ done: 0, total: rowsToEnrich.length });

    const batchSize = 5;
    let totalDeducted = 0;
    for (let i = 0; i < rowsToEnrich.length; i += batchSize) {
      const batch = rowsToEnrich.slice(i, i + batchSize);

      setRows((prev) =>
        prev.map((r) =>
          batch.some((b) => b.id === r.id) ? { ...r, status: "enriching" as EnrichmentStatus } : r
        )
      );

      try {
        const { data, error } = await supabase.functions.invoke("csv-enrich", {
          body: {
            rows: batch.map((r) => ({
              company_name: r.company_name,
              existing_data: r.original_data,
            })),
          },
        });

        if (error) throw error;

        const results = data.results || [];
        const successCount = results.filter((r: any) => r.status !== "error").length;
        totalDeducted += successCount;
        await spendCredits("enrich", successCount);

        setRows((prev) =>
          prev.map((r) => {
            const batchIdx = batch.findIndex((b) => b.id === r.id);
            if (batchIdx === -1) return r;
            const result = results[batchIdx];
            if (!result) return { ...r, status: "error" as EnrichmentStatus };
            return {
              ...r,
              phone: result.phone || r.phone,
              email: result.email || r.email,
              website: result.website || r.website,
              linkedin_url: result.linkedin_url || r.linkedin_url,
              company_domain: result.company_domain || r.company_domain,
              contact_name: result.contact_name || r.contact_name,
              job_title: result.job_title || r.job_title,
              ai_description: result.ai_description || r.ai_description,
              enrichment_source: result.enrichment_source || r.enrichment_source,
              status: result.status as EnrichmentStatus,
            };
          })
        );
      } catch (error) {
        console.error("Batch enrichment error:", error);
        setRows((prev) =>
          prev.map((r) =>
            batch.some((b) => b.id === r.id) ? { ...r, status: "error" as EnrichmentStatus } : r
          )
        );
      }

      setEnrichProgress((prev) => ({ ...prev, done: Math.min(i + batchSize, rowsToEnrich.length) }));

      if (i + batchSize < rowsToEnrich.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    setIsEnrichingAll(false);
    await refreshCredits();
    toast.success("Enrichment complete!");
  };

  const exportCSV = () => {
    const csvHeaders = [
      "Company Name",
      "Contact Name",
      "Job Title",
      "Email",
      "Phone",
      "Website",
      "LinkedIn",
      "Company Domain",
      "AI Description",
      "Source",
      "Status",
    ];

    const csvRows = rows.map((r) => [
      r.company_name,
      r.contact_name || "",
      r.job_title || "",
      r.email || "",
      r.phone || "",
      r.website || "",
      r.linkedin_url || "",
      r.company_domain || "",
      r.ai_description || "",
      r.enrichment_source || "",
      r.status,
    ]);

    const csvContent = [csvHeaders, ...csvRows]
      .map((row) => row.map((cell) => `"${(cell || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `enriched-leads-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const enrichedCount = rows.filter((r) => r.status === "enriched" || r.status === "partial").length;

  return (
    <DashboardLayout>
      <CreditLimitPopup
        open={showCreditPopup}
        onOpenChange={setShowCreditPopup}
        creditsUsed={creditsUsed}
        monthlyAllowance={monthlyAllowance}
        currentTier={tier}
      />
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">CSV Enrichment</h1>
            <p className="text-muted-foreground mt-1">
              Upload a CSV of companies and enrich with contact info, emails, and AI insights
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant="outline" className="gap-1 py-1 px-3">
              <Zap className="w-3.5 h-3.5" />
              {monthlyAllowance === Infinity ? "Unlimited" : `${remaining} / ${monthlyAllowance}`} credits
            </Badge>
            {step === "table" && (
              <>
                <Button variant="outline" onClick={exportCSV} disabled={rows.length === 0}>
                  <Download className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
                <Button onClick={enrichAll} disabled={isEnrichingAll}>
                  {isEnrichingAll ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Enriching {enrichProgress.done}/{enrichProgress.total}...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Enrich All
                    </>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Upload Step */}
        {step === "upload" && (
          <Card>
            <CardContent className="p-12">
              <div className="border-2 border-dashed border-border rounded-lg p-12 text-center">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                  id="csv-enrich-upload"
                />
                <label htmlFor="csv-enrich-upload" className="cursor-pointer flex flex-col items-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <div>
                    <p className="text-lg font-semibold text-foreground">Upload your CSV</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Upload a CSV with company names. We'll find phone, email, website, LinkedIn, and more.
                    </p>
                  </div>
                  <Button variant="outline" className="mt-2" asChild>
                    <span>
                      <FileSpreadsheet className="w-4 h-4 mr-2" />
                      Choose File
                    </span>
                  </Button>
                </label>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Mapping Step */}
        {step === "map" && (
          <Card>
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold">Map Your Columns</h2>
                  <p className="text-sm text-muted-foreground">
                    We detected {rawData.length} rows. Map your columns so we know what to enrich.
                  </p>
                </div>
                <Badge variant="secondary">{rawData.length} rows</Badge>
              </div>

              <div className="space-y-3 max-h-96 overflow-y-auto">
                {headers.map((header, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 bg-secondary/30 rounded-lg">
                    <div className="w-1/3">
                      <p className="font-medium text-sm">{header}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        e.g., {rawData[0]?.[index] || "—"}
                      </p>
                    </div>
                    <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <Select
                      value={columnMapping[index] || "skip"}
                      onValueChange={(value: MappableField) =>
                        setColumnMapping({ ...columnMapping, [index]: value })
                      }
                    >
                      <SelectTrigger className="w-1/2">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map((f) => (
                          <SelectItem key={f.value} value={f.value}>
                            {f.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              <div className="flex justify-between pt-4">
                <Button variant="ghost" onClick={() => setStep("upload")}>
                  Back
                </Button>
                <Button onClick={handleMappingComplete}>
                  Continue
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Enrichment Table */}
        {step === "table" && (
          <>
            {/* Stats Bar */}
            <div className="flex items-center gap-4 text-sm">
              <Badge variant="outline">{rows.length} total rows</Badge>
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                {enrichedCount} enriched
              </Badge>
              <Badge variant="secondary">
                {rows.filter((r) => r.status === "pending").length} pending
              </Badge>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("upload");
                  setRows([]);
                  setHeaders([]);
                  setRawData([]);
                  setColumnMapping({});
                }}
              >
                <Upload className="w-4 h-4 mr-2" />
                New CSV
              </Button>
            </div>

            <div className="border border-border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-secondary/30">
                    <TableHead className="w-8">#</TableHead>
                    <TableHead>Company</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Website</TableHead>
                    <TableHead>LinkedIn</TableHead>
                    <TableHead className="min-w-[200px]">AI Description</TableHead>
                    <TableHead className="w-10">Status</TableHead>
                    <TableHead className="w-24">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id} className="hover:bg-secondary/20">
                      <TableCell className="text-muted-foreground text-xs">{row.id + 1}</TableCell>
                      <TableCell className="font-medium max-w-[180px] truncate">{row.company_name}</TableCell>
                      <TableCell className="max-w-[150px]">
                        {row.contact_name ? (
                          <div>
                            <p className="text-sm truncate">{row.contact_name}</p>
                            {row.job_title && (
                              <p className="text-xs text-muted-foreground truncate">{row.job_title}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.email ? (
                          <span className="text-sm truncate block max-w-[180px]">{row.email}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.phone ? (
                          <span className="text-sm">{row.phone}</span>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.website ? (
                          <a
                            href={row.website.startsWith("http") ? row.website : `https://${row.website}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline truncate block max-w-[150px]"
                          >
                            {row.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.linkedin_url ? (
                          <a
                            href={row.linkedin_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            Profile
                          </a>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        {row.ai_description ? (
                          <p className="text-xs text-muted-foreground line-clamp-2">{row.ai_description}</p>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusIcon status={row.status} />
                      </TableCell>
                      <TableCell>
                        {row.status === "enriching" ? (
                          <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => enrichRow(row.id)}
                            disabled={isEnrichingAll}
                            className="h-7 px-2 text-xs"
                          >
                            <RefreshCw className="w-3 h-3 mr-1" />
                            {row.status === "pending" ? "Enrich" : "Re-enrich"}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default CSVEnrichment;
