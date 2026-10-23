import { Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

/** A block of script text with a copy button. */
export function CopyText({ text, label }: { text: string; label?: string }) {
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); toast.success("Copied"); } catch { toast.error("Couldn't copy"); }
  };
  return (
    <div className="rounded-md border border-border bg-muted/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {label && <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>}
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{text}</p>
        </div>
        <Button type="button" size="sm" variant="ghost" className="h-11 w-11 shrink-0 p-0 md:h-8 md:w-8" onClick={copy} aria-label={`Copy ${label ?? "text"}`}>
          <Copy className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
