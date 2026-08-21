import { useEffect, useMemo, useRef, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Copy, Megaphone, Printer, RotateCcw } from "lucide-react";
import ListingFlyer, { emptyFlyer, type FlyerData } from "@/components/realtor/ListingFlyer";
import {
  FLYER_TEMPLATES,
  HEADING_FONT_OPTIONS,
  getTemplate,
} from "@/components/realtor/flyerTemplates";

const STORAGE_KEY = "brivano:marketing:flyer";

type DealOption = {
  id: string;
  client_name: string;
  property_address: string | null;
  deal_value: number | null;
};

const money = (v: number | null) =>
  typeof v === "number" && v > 0
    ? v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "";

/** Opens a print window containing only the flyer, using the app's stylesheets. */
function printFlyer(node: HTMLElement | null) {
  if (!node) return;
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) {
    toast.error("Allow pop-ups to print or save the flyer as a PDF.");
    return;
  }
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"], style'))
    .map((el) => el.outerHTML)
    .join("");
  win.document.write(
    `<!doctype html><html class="${document.documentElement.className}"><head><title>Listing flyer</title>${styles}` +
      `<style>@page{size:letter;margin:0}body{margin:0}[data-flyer-root]{border:none!important}</style>` +
      `</head><body>${node.outerHTML}</body></html>`,
  );
  win.document.close();
  win.focus();
  // Give the cloned stylesheets a moment to apply before printing.
  setTimeout(() => {
    win.print();
  }, 600);
}

export default function Marketing() {
  const { user } = useAuth();
  const flyerRef = useRef<HTMLDivElement>(null);
  const [deals, setDeals] = useState<DealOption[]>([]);
  const [highlightsText, setHighlightsText] = useState("");
  const [data, setData] = useState<FlyerData>(() => {
    if (typeof window === "undefined") return emptyFlyer;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) return { ...emptyFlyer, ...JSON.parse(saved) } as FlyerData;
    } catch {
      /* ignore */
    }
    return emptyFlyer;
  });

  useEffect(() => {
    setHighlightsText((prev) => (prev ? prev : data.highlights.join("\n")));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      /* ignore */
    }
  }, [data]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: rows } = await supabase
        .from("realtor_deals")
        .select("id, client_name, property_address, deal_value")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      setDeals((rows as DealOption[]) || []);
    })();
  }, [user]);

  useEffect(() => {
    if (!user || data.agentEmail) return;
    setData((d) => ({ ...d, agentEmail: user.email || "" }));
  }, [user, data.agentEmail]);

  const set = (patch: Partial<FlyerData>) => setData((d) => ({ ...d, ...patch }));

  const shareText = useMemo(() => {
    const specs = [data.beds && `${data.beds}bd`, data.baths && `${data.baths}ba`, data.sqft && `${data.sqft} sqft`]
      .filter(Boolean)
      .join(" · ");
    return [
      `${data.headline || "Just listed"}: ${data.address || "New listing"}`,
      [data.price, specs].filter(Boolean).join(" | "),
      data.description,
      data.openHouse && `Open house: ${data.openHouse}`,
      [data.agentName, data.agentPhone, data.agentEmail].filter(Boolean).join(" · "),
    ]
      .filter(Boolean)
      .join("\n\n");
  }, [data]);

  const prefillFromDeal = (id: string) => {
    const deal = deals.find((d) => d.id === id);
    if (!deal) return;
    set({
      address: deal.property_address || data.address,
      price: money(deal.deal_value) || data.price,
    });
    toast.success(`Loaded ${deal.client_name}'s property`);
  };

  return (
    <DashboardLayout fullWidth>
      <div className="space-y-5">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Megaphone className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Marketing</h1>
            <p className="text-sm text-muted-foreground">
              Build shareable listing collateral straight from your deals.
            </p>
          </div>
        </div>

        <Tabs defaultValue="flyer">
          <TabsList>
            <TabsTrigger value="flyer">Listing flyer</TabsTrigger>
            <TabsTrigger value="social">Social copy</TabsTrigger>
          </TabsList>

          <TabsContent value="flyer" className="mt-4">
            <div className="grid gap-5 lg:grid-cols-[minmax(0,380px)_1fr]">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Flyer details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {deals.length > 0 && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Prefill from a deal</Label>
                      <Select onValueChange={prefillFromDeal}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Select a deal" />
                        </SelectTrigger>
                        <SelectContent position="popper" className="z-[9999]">
                          {deals.map((d) => (
                            <SelectItem key={d.id} value={d.id}>
                              {d.client_name}
                              {d.property_address ? ` — ${d.property_address}` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2 rounded-lg border border-border p-3">
                    <Label className="text-xs">Template</Label>
                    <div className="grid grid-cols-3 gap-2">
                      {FLYER_TEMPLATES.map((t) => {
                        const active = t.id === (data.templateId || FLYER_TEMPLATES[0].id);
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => set({ templateId: t.id })}
                            title={t.description}
                            className={`rounded-md border p-2 text-left transition ${
                              active ? "border-primary ring-1 ring-primary" : "border-border hover:border-primary/50"
                            }`}
                          >
                            <span
                              className="block h-8 w-full rounded-sm mb-1.5 flex items-center justify-center"
                              style={{ background: t.bg, border: `1px solid ${t.border}` }}
                            >
                              <span className="h-1.5 w-8 rounded-full" style={{ background: t.accent }} />
                            </span>
                            <span className="text-[11px] font-medium leading-tight block truncate">{t.name}</span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Brand name</Label>
                        <Input
                          className="h-9"
                          value={data.brandName}
                          onChange={(e) => set({ brandName: e.target.value })}
                          placeholder="Brivano Realty"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Accent color</Label>
                        <div className="flex items-center gap-2">
                          <Input
                            type="color"
                            className="h-9 w-12 p-1"
                            value={data.accentColor || getTemplate(data.templateId).accent}
                            onChange={(e) => set({ accentColor: e.target.value })}
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-9 px-2 text-xs"
                            onClick={() => set({ accentColor: "" })}
                          >
                            Reset
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Logo URL</Label>
                      <Input
                        className="h-9"
                        value={data.logoUrl}
                        onChange={(e) => set({ logoUrl: e.target.value })}
                        placeholder="https://…/logo.png"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs">Heading font</Label>
                      <Select
                        value={data.headingFont || "default"}
                        onValueChange={(v) => set({ headingFont: v === "default" ? "" : v })}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent position="popper" className="z-[9999]">
                          {HEADING_FONT_OPTIONS.map((f) => (
                            <SelectItem key={f.id || "default"} value={f.id || "default"}>
                              {f.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Headline</Label>
                      <Input
                        className="h-9"
                        value={data.headline}
                        onChange={(e) => set({ headline: e.target.value })}
                        placeholder="Just Listed"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Price</Label>
                      <Input
                        className="h-9"
                        value={data.price}
                        onChange={(e) => set({ price: e.target.value })}
                        placeholder="$2,400 / mo"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Address</Label>
                    <Input
                      className="h-9"
                      value={data.address}
                      onChange={(e) => set({ address: e.target.value })}
                      placeholder="123 Main St, Chicago, IL"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Beds</Label>
                      <Input className="h-9" value={data.beds} onChange={(e) => set({ beds: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Baths</Label>
                      <Input className="h-9" value={data.baths} onChange={(e) => set({ baths: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Sqft</Label>
                      <Input className="h-9" value={data.sqft} onChange={(e) => set({ sqft: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Photo URL</Label>
                    <Input
                      className="h-9"
                      value={data.photoUrl}
                      onChange={(e) => set({ photoUrl: e.target.value })}
                      placeholder="https://…/photo.jpg"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Description</Label>
                    <Textarea
                      rows={4}
                      value={data.description}
                      onChange={(e) => set({ description: e.target.value })}
                      placeholder="Sun-filled corner unit with updated kitchen…"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Highlights (one per line)</Label>
                    <Textarea
                      rows={4}
                      value={highlightsText}
                      onChange={(e) => {
                        setHighlightsText(e.target.value);
                        set({
                          highlights: e.target.value
                            .split("\n")
                            .map((l) => l.trim())
                            .filter(Boolean)
                            .slice(0, 8),
                        });
                      }}
                      placeholder={"In-unit laundry\nParking included\nPet friendly"}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">Open house</Label>
                    <Input
                      className="h-9"
                      value={data.openHouse}
                      onChange={(e) => set({ openHouse: e.target.value })}
                      placeholder="Sat 12–2pm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Your name</Label>
                      <Input className="h-9" value={data.agentName} onChange={(e) => set({ agentName: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Title</Label>
                      <Input className="h-9" value={data.agentTitle} onChange={(e) => set({ agentTitle: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Phone</Label>
                      <Input className="h-9" value={data.agentPhone} onChange={(e) => set({ agentPhone: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email</Label>
                      <Input className="h-9" value={data.agentEmail} onChange={(e) => set({ agentEmail: e.target.value })} />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="h-8" onClick={() => printFlyer(flyerRef.current)}>
                      <Printer className="h-3.5 w-3.5 mr-1.5" /> Print / Save PDF
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8"
                      onClick={() => {
                        navigator.clipboard.writeText(shareText);
                        toast.success("Listing copy copied");
                      }}
                    >
                      <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy text
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8"
                      onClick={() => {
                        setData((d) => ({
                          ...emptyFlyer,
                          agentEmail: user?.email || "",
                          templateId: d.templateId,
                          brandName: d.brandName,
                          logoUrl: d.logoUrl,
                          accentColor: d.accentColor,
                          headingFont: d.headingFont,
                        }));
                        setHighlightsText("");
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card className="overflow-hidden">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm">Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-auto">
                    <div className="origin-top-left scale-[0.62] w-[816px]">
                      <ListingFlyer ref={flyerRef} data={data} />
                    </div>
                    {/* Reserve the scaled height so the card sizes correctly. */}
                    <div className="h-[655px]" />
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="social" className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Ready-to-post copy</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Textarea rows={12} readOnly value={shareText} className="font-mono text-xs" />
                <Button
                  size="sm"
                  className="h-8"
                  onClick={() => {
                    navigator.clipboard.writeText(shareText);
                    toast.success("Copied");
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1.5" /> Copy
                </Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
