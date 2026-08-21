/**
 * Panel for tuning which listing-intel signals create follow-up steps, the
 * thresholds behind each one, and the call/email scripts (with merge fields)
 * used when the step is generated.
 */
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { RotateCcw, Save, SlidersHorizontal } from "lucide-react";
import {
  DEFAULT_INTEL_SETTINGS,
  MERGE_FIELDS,
  SIGNAL_LABELS,
  loadIntelSettings,
  renderScript,
  saveIntelSettings,
  type IntelSettings,
  type SignalId,
} from "@/lib/ownerIntelSettings";

const SIGNAL_IDS = Object.keys(SIGNAL_LABELS) as SignalId[];
const KINDS = ["call", "email", "text", "task"] as const;

const PREVIEW = {
  address: "1420 W Superior St, Chicago IL",
  owner_name: "Dana Whitfield",
  price: 429000,
  price_drop: 15000,
  price_drop_pct: 3.4,
  days_on_market: 63,
  agent_name: "You",
};

type NumField = {
  key: keyof Pick<
    IntelSettings,
    | "priceDropWindowDays"
    | "priceDropMinPct"
    | "freshThresholdDays"
    | "agingThresholdDays"
    | "staleThresholdDays"
    | "relistDomDropDays"
  >;
  label: string;
  hint: string;
  suffix: string;
};

const NUM_FIELDS: NumField[] = [
  {
    key: "priceDropWindowDays",
    label: "Price-drop window",
    hint: "Only count cuts first seen inside this window.",
    suffix: "days",
  },
  {
    key: "priceDropMinPct",
    label: "Minimum price cut",
    hint: "Ignore anything smaller than this.",
    suffix: "%",
  },
  {
    key: "freshThresholdDays",
    label: "Just listed up to",
    hint: "Days on market that still counts as new.",
    suffix: "days",
  },
  {
    key: "agingThresholdDays",
    label: "Aging starts at",
    hint: "When a listing needs a soft check-in.",
    suffix: "days",
  },
  {
    key: "staleThresholdDays",
    label: "Stale starts at",
    hint: "Triggers the market-update email.",
    suffix: "days",
  },
  {
    key: "relistDomDropDays",
    label: "Re-list detection",
    hint: "Days the counter must fall to call it re-listed.",
    suffix: "days",
  },
];

export default function IntelTriggerSettings({ onSaved }: { onSaved?: () => void }) {
  const [settings, setSettings] = useState<IntelSettings>(() => loadIntelSettings());
  const [dirty, setDirty] = useState(false);

  const update = (patch: Partial<IntelSettings>) => {
    setSettings((s) => ({ ...s, ...patch }));
    setDirty(true);
  };
  const updateSignal = (id: SignalId, patch: Partial<IntelSettings["signals"][SignalId]>) => {
    setSettings((s) => ({ ...s, signals: { ...s.signals, [id]: { ...s.signals[id], ...patch } } }));
    setDirty(true);
  };

  const enabledCount = useMemo(
    () => SIGNAL_IDS.filter((id) => settings.signals[id].enabled).length,
    [settings],
  );

  const save = () => {
    saveIntelSettings(settings);
    setDirty(false);
    toast.success("Follow-up rules saved");
    onSaved?.();
  };

  const reset = () => {
    setSettings(DEFAULT_INTEL_SETTINGS);
    setDirty(true);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4" />
            Follow-up triggers & scripts
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            {enabledCount} of {SIGNAL_IDS.length} signals create steps automatically.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={reset}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" /> Defaults
          </Button>
          <Button size="sm" onClick={save} disabled={!dirty}>
            <Save className="h-3.5 w-3.5 mr-1" /> Save
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {NUM_FIELDS.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs">{f.label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  className="h-8"
                  value={settings[f.key]}
                  onChange={(e) => update({ [f.key]: Number(e.target.value) } as Partial<IntelSettings>)}
                />
                <span className="text-xs text-muted-foreground w-10">{f.suffix}</span>
              </div>
              <p className="text-[11px] text-muted-foreground">{f.hint}</p>
            </div>
          ))}
        </div>

        <div>
          <p className="text-xs font-medium mb-2">Merge fields</p>
          <div className="flex flex-wrap gap-1.5">
            {MERGE_FIELDS.map((m) => (
              <Badge key={m.token} variant="secondary" className="font-mono text-[10px]" title={m.description}>
                {m.token}
              </Badge>
            ))}
          </div>
        </div>

        <Tabs defaultValue={SIGNAL_IDS[0]}>
          <TabsList className="flex-wrap h-auto">
            {SIGNAL_IDS.map((id) => (
              <TabsTrigger key={id} value={id} className="text-xs">
                {SIGNAL_LABELS[id]}
              </TabsTrigger>
            ))}
          </TabsList>

          {SIGNAL_IDS.map((id) => {
            const s = settings.signals[id];
            return (
              <TabsContent key={id} value={id} className="space-y-3 pt-3">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="flex items-center gap-2">
                    <Switch
                      id={`enabled-${id}`}
                      checked={s.enabled}
                      onCheckedChange={(v) => updateSignal(id, { enabled: v })}
                    />
                    <Label htmlFor={`enabled-${id}`} className="text-xs">
                      Create this step
                    </Label>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Step type</Label>
                    <Select value={s.kind} onValueChange={(v) => updateSignal(id, { kind: v as typeof KINDS[number] })}>
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {KINDS.map((k) => (
                          <SelectItem key={k} value={k} className="text-xs capitalize">
                            {k}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Due in (days)</Label>
                    <Input
                      type="number"
                      min={0}
                      className="h-8 w-24"
                      value={s.dueInDays}
                      onChange={(e) => updateSignal(id, { dueInDays: Number(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">Task title</Label>
                  <Input
                    className="h-8"
                    value={s.title}
                    onChange={(e) => updateSignal(id, { title: e.target.value })}
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs">
                    {s.kind === "email" ? "Email script" : "Call / talk track"}
                  </Label>
                  <Textarea
                    rows={6}
                    value={s.body}
                    onChange={(e) => updateSignal(id, { body: e.target.value })}
                  />
                </div>

                <div className="rounded-md border bg-muted/40 p-3">
                  <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">
                    Preview with sample listing
                  </p>
                  <p className="text-xs font-medium">{renderScript(s.title, PREVIEW)}</p>
                  <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">
                    {renderScript(s.body, PREVIEW)}
                  </p>
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
}
