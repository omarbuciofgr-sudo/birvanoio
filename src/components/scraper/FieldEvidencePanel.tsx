import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, FileText, Globe, Database, ShieldCheck, ChevronDown, ChevronRight } from "lucide-react";

interface FieldEvidence {
  id: string;
  field_name: string;
  field_value: string;
  source_url: string | null;
  evidence_snippet: string | null;
  evidence_type: "on_page_text" | "structured_data" | "pdf" | "enrichment_provider";
  provider_reference: string | null;
  provider_label: string | null;
  verification_method: string | null;
  verification_result: string | null;
  captured_at: string;
}

interface FieldEvidencePanelProps {
  leadId: string;
}

const EVIDENCE_TYPE_CONFIG: Record<string, { label: string; icon: typeof Globe; className: string }> = {
  on_page_text: { label: "Web Page", icon: Globe, className: "bg-primary/10 text-primary" },
  structured_data: { label: "Structured", icon: Database, className: "bg-emerald-500/10 text-emerald-600" },
  pdf: { label: "PDF", icon: FileText, className: "bg-amber-500/10 text-amber-600" },
  enrichment_provider: { label: "Provider", icon: ShieldCheck, className: "bg-violet-500/10 text-violet-600" },
};

const FIELD_ORDER = ["name", "email", "phone", "title", "company", "address"];

function sortFields(a: string, b: string) {
  const ai = FIELD_ORDER.indexOf(a);
  const bi = FIELD_ORDER.indexOf(b);
  if (ai === -1 && bi === -1) return a.localeCompare(b);
  if (ai === -1) return 1;
  if (bi === -1) return -1;
  return ai - bi;
}

function formatFieldName(name: string) {
  return name
    .replace(/_/g, " ")
    .replace(/\b\w/g, (l) => l.toUpperCase());
}

export function FieldEvidencePanel({ leadId }: FieldEvidencePanelProps) {
  const [evidence, setEvidence] = useState<FieldEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFields, setExpandedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchEvidence = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("field_evidence")
        .select("*")
        .eq("lead_id", leadId)
        .order("field_name")
        .order("captured_at", { ascending: false });

      if (!error && data) {
        setEvidence(data as FieldEvidence[]);
        // Auto-expand first 3 fields
        const fields = [...new Set(data.map((e: any) => e.field_name))];
        setExpandedFields(new Set(fields.slice(0, 3)));
      }
      setLoading(false);
    };
    fetchEvidence();
  }, [leadId]);

  if (loading) {
    return (
      <div className="py-4 text-center">
        <p className="text-xs text-muted-foreground">Loading evidence…</p>
      </div>
    );
  }

  if (evidence.length === 0) {
    return (
      <div className="py-4 text-center">
        <p className="text-xs text-muted-foreground">No field evidence recorded yet.</p>
      </div>
    );
  }

  // Group by field_name
  const grouped = evidence.reduce<Record<string, FieldEvidence[]>>((acc, e) => {
    if (!acc[e.field_name]) acc[e.field_name] = [];
    acc[e.field_name].push(e);
    return acc;
  }, {});

  const sortedFields = Object.keys(grouped).sort(sortFields);

  const toggleField = (field: string) => {
    setExpandedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  return (
    <div className="space-y-1">
      {sortedFields.map((fieldName) => {
        const items = grouped[fieldName];
        const isExpanded = expandedFields.has(fieldName);
        const latestValue = items[0].field_value;

        return (
          <div key={fieldName} className="rounded-lg border border-border bg-card overflow-hidden">
            {/* Field header */}
            <button
              onClick={() => toggleField(fieldName)}
              className="w-full flex items-center justify-between px-3.5 py-2.5 hover:bg-muted/50 transition-colors text-left"
            >
              <div className="flex items-center gap-2 min-w-0">
                {isExpanded ? (
                  <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
                ) : (
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                )}
                <span className="text-xs font-semibold text-foreground">
                  {formatFieldName(fieldName)}
                </span>
                <span className="text-xs text-muted-foreground truncate max-w-[140px]">
                  {latestValue}
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] text-muted-foreground">
                  {items.length} source{items.length !== 1 ? "s" : ""}
                </span>
              </div>
            </button>

            {/* Evidence items */}
            {isExpanded && (
              <div className="border-t border-border divide-y divide-border">
                {items.map((item) => {
                  const config = EVIDENCE_TYPE_CONFIG[item.evidence_type] || EVIDENCE_TYPE_CONFIG.on_page_text;
                  const Icon = config.icon;

                  return (
                    <div key={item.id} className="px-3.5 py-2.5 space-y-1.5">
                      {/* Type badge + value */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded ${config.className}`}>
                            <Icon className="h-2.5 w-2.5" />
                            {config.label}
                          </span>
                          {item.verification_result && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              item.verification_result === "valid" || item.verification_result === "verified"
                                ? "bg-emerald-500/10 text-emerald-600"
                                : item.verification_result === "invalid"
                                ? "bg-destructive/10 text-destructive"
                                : "bg-amber-500/10 text-amber-600"
                            }`}>
                              {item.verification_result}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {new Date(item.captured_at).toLocaleDateString()}
                        </span>
                      </div>

                      {/* Value */}
                      <p className="text-xs font-medium text-foreground break-all">
                        {item.field_value}
                      </p>

                      {/* Snippet */}
                      {item.evidence_snippet && (
                        <p className="text-[11px] text-muted-foreground bg-muted/60 rounded px-2 py-1.5 leading-relaxed italic">
                          "…{item.evidence_snippet}…"
                        </p>
                      )}

                      {/* Source URL */}
                      {item.source_url && (
                        <a
                          href={item.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline break-all"
                        >
                          <ExternalLink className="h-2.5 w-2.5 shrink-0" />
                          {item.source_url.length > 60
                            ? item.source_url.slice(0, 60) + "…"
                            : item.source_url}
                        </a>
                      )}

                      {/* Provider info (no waterfall details) */}
                      {item.evidence_type === "enrichment_provider" && (
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          {item.provider_label && (
                            <span>Source: {item.provider_label}</span>
                          )}
                          {item.verification_method && (
                            <>
                              <span>•</span>
                              <span>Method: {item.verification_method}</span>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
