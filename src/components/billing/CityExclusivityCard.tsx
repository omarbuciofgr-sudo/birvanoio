import { useEffect, useState } from "react";
import { MapPin, Lock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CityAutocomplete } from "@/components/onboarding/CityAutocomplete";

type Held = { id: string; city_label: string; status: string };

export function CityExclusivityCard({ isPaid, priceCents = 14900 }: { isPaid: boolean; priceCents?: number }) {
  const [city, setCity] = useState("");
  const [held, setHeld] = useState<Held[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (supabase as any)
      .from("city_exclusivities")
      .select("id, city_label, status")
      .in("status", ["active", "past_due"])
      .then(({ data }: { data: Held[] | null }) => setHeld(data ?? []));
  }, []);

  const reserve = async () => {
    if (!city.trim()) return toast.error("Choose a city first");
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { checkoutType: "city_exclusivity", city: city.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      if (data?.url) window.open(data.url, "_blank");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start checkout");
    } finally {
      setBusy(false);
    }
  };

  const price = `$${(priceCents / 100).toFixed(0)}/mo`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2"><Lock className="h-4 w-4" /> City exclusivity</CardTitle>
        <CardDescription>
          Be the only Brivano member who can search a city. {price} per city. Cancel anytime from Manage billing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {held.length > 0 && (
          <ul className="space-y-2">
            {held.map((h) => (
              <li key={h.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2 text-sm">
                <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-primary" />{h.city_label}</span>
                <Badge variant={h.status === "active" ? "default" : "destructive"}>
                  {h.status === "active" ? "Exclusive" : "Payment due"}
                </Badge>
              </li>
            ))}
          </ul>
        )}
        {isPaid ? (
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1"><CityAutocomplete value={city} onChange={setCity} placeholder="City, State" /></div>
            <Button onClick={reserve} disabled={busy} className="min-h-11">
              {busy ? "Opening…" : `Reserve city · ${price}`}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Available on Starter, Growth and Scale plans.</p>
        )}
      </CardContent>
    </Card>
  );
}
