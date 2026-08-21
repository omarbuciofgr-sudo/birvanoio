import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Phone, Search, Mail, User } from "lucide-react";
import { toast } from "sonner";
import { skipTraceApi, type SkipTraceResult } from "@/lib/api/skipTrace";

/**
 * Owner phone lookup for realtors: paste a property address, get the owner's
 * name, phone numbers and any emails on file.
 */
export const OwnerPhoneFinder = () => {
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SkipTraceResult | null>(null);

  const run = async () => {
    const trimmed = address.trim();
    if (!trimmed) {
      toast.error("Enter a property address");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const parsed = skipTraceApi.parseAddress(trimmed);
      const res = await skipTraceApi.lookupOwner(parsed);
      setResult(res);
      if (!res.success) toast.error(res.error || "No owner match found");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  };

  const data = result?.data;

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Phone className="h-4 w-4 text-primary" /> Phone Finder
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Enter a property address to find the owner's name, phone numbers and email.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-xs">Property address</Label>
          <div className="flex gap-2">
            <Input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && run()}
              placeholder="1234 W Chicago Ave, Chicago, IL 60622"
              className="h-9 text-sm"
            />
            <Button onClick={run} disabled={loading} size="sm" className="h-9 gap-1.5">
              {loading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Search className="h-3.5 w-3.5" />
              )}
              Find owner
            </Button>
          </div>
        </div>

        {data && (
          <div className="rounded-lg border border-border/60 p-4 space-y-3">
            <div className="flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{data.fullName || "Owner on record"}</span>
              {typeof data.confidence === "number" && (
                <Badge variant="outline" className="text-[10px]">
                  {Math.round(data.confidence)}% match
                </Badge>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Phones</p>
              {data.phones?.length ? (
                data.phones.map((p) => (
                  <div key={p.number} className="flex items-center gap-2 text-sm">
                    <a href={`tel:${p.number}`} className="text-primary hover:underline">
                      {p.number}
                    </a>
                    <Badge variant="outline" className="text-[10px] capitalize">
                      {p.lineType || p.type || "phone"}
                    </Badge>
                    <Button size="sm" variant="ghost" className="h-6 text-[11px]" asChild>
                      <a href={`sms:${p.number}`}>Text</a>
                    </Button>
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No phone on record.</p>
              )}
            </div>

            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Emails</p>
              {data.emails?.length ? (
                data.emails.map((em) => (
                  <a
                    key={em.address}
                    href={`mailto:${em.address}`}
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5" /> {em.address}
                  </a>
                ))
              ) : (
                <p className="text-xs text-muted-foreground">No email on record.</p>
              )}
            </div>
          </div>
        )}

        {result && !result.success && (
          <p className="text-xs text-muted-foreground">
            {result.error || "No owner match for that address."}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default OwnerPhoneFinder;
