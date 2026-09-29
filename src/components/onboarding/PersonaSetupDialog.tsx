import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import { PERSONA_ROLES, getGoalsForRole, type PersonaRoleId } from "@/lib/persona";
import { toast } from "sonner";
import { CityAutocomplete } from "./CityAutocomplete";

interface PersonaSetupDialogProps {
  open: boolean;
  initialRole?: string | null;
  initialGoals?: string[];
  onSave: (role: string, goals: string[], homeMarket?: string) => Promise<{ error: unknown }>;
  initialHomeMarket?: string | null;
  onClose?: () => void;
  dismissible?: boolean;
}

export const PersonaSetupDialog = ({
  open,
  initialRole,
  initialGoals,
  onSave,
  onClose,
  dismissible = false,
  initialHomeMarket,
}: PersonaSetupDialogProps) => {
  const [role, setRole] = useState<PersonaRoleId | null>((initialRole as PersonaRoleId) ?? null);
  const [goals, setGoals] = useState<string[]>(initialGoals ?? []);
  const [step, setStep] = useState<1 | 2 | 3>(initialRole ? 2 : 1);
  const [homeMarket, setHomeMarket] = useState(initialHomeMarket ?? "");
  const needsMarket = role === "realtor";
  const marketValid = /^[^,]{2,},\s*[A-Za-z]{2}$/.test(homeMarket.trim());
  const [saving, setSaving] = useState(false);

  const goalOptions = useMemo(() => getGoalsForRole(role), [role]);

  const toggleGoal = (id: string) =>
    setGoals((prev) => (prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]));

  const handleSave = async () => {
    if (!role || goals.length === 0) return;
    setSaving(true);
    if (needsMarket && !marketValid) return;
    const { error } = await onSave(role, goals, needsMarket ? homeMarket.trim() : undefined);
    setSaving(false);
    if (error) {
      toast.error("Couldn't save your setup. Please try again.");
      return;
    }
    toast.success("Workspace tailored to your role");
    onClose?.();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => (!o && dismissible ? onClose?.() : undefined)}>
      <DialogContent
        className={`max-w-2xl ${dismissible ? "" : "[&>button]:hidden"}`}
        onInteractOutside={(e) => !dismissible && e.preventDefault()}
        onEscapeKeyDown={(e) => !dismissible && e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-xl">
            {step === 1 ? "What best describes your role?" : step === 2 ? "What will you use Brivano for?" : "Where do you work?"}
          </DialogTitle>
          <DialogDescription>
            {step === 1
              ? "We'll only show the tools that fit how you work."
              : step === 2
                ? "Pick everything that applies. Your sidebar adapts to your answers."
                : "Enter the city you work in. We'll use it as your home market for owner searches."}
          </DialogDescription>
        </DialogHeader>

        {step === 1 ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {PERSONA_ROLES.map((r) => {
              const active = role === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setRole(r.id);
                    if (r.id !== role) setGoals([]);
                    setStep(2);
                  }}
                  className={`text-left rounded-lg border p-3 transition-colors ${
                    active
                      ? "border-primary bg-primary/[0.06]"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  }`}
                >
                  <p className="text-sm font-medium">{r.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{r.description}</p>
                </button>
              );
            })}
          </div>
        ) : step === 3 ? (
          <div className="space-y-1.5">
            <label className="text-xs text-muted-foreground">City, State</label>
            <CityAutocomplete value={homeMarket} onChange={setHomeMarket} autoFocus />
            {homeMarket.trim() && !marketValid && (
              <p className="text-xs text-muted-foreground">Use the format City, ST (for example Austin, TX).</p>
            )}
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 max-h-[45vh] overflow-y-auto pr-1">
            {goalOptions.map((g) => {
              const active = goals.includes(g.id);
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => toggleGoal(g.id)}
                  className={`flex items-start gap-3 text-left rounded-lg border p-3 transition-colors ${
                    active
                      ? "border-primary bg-primary/[0.06]"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  }`}
                >
                  <Checkbox checked={active} className="mt-0.5 pointer-events-none" />
                  <span>
                    <span className="block text-sm font-medium">{g.label}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5">{g.description}</span>
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          {step > 1 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep(step === 3 ? 2 : 1)} className="gap-1.5">
              <ChevronLeft className="w-3.5 h-3.5" />
              Back
            </Button>
          ) : (
            <span />
          )}
          {step === 2 && needsMarket && (
            <Button size="sm" onClick={() => setStep(3)} disabled={goals.length === 0}>
              Next
            </Button>
          )}
          {((step === 2 && !needsMarket) || step === 3) && (
            <Button size="sm" onClick={handleSave} disabled={goals.length === 0 || saving || (step === 3 && !marketValid)} className="gap-1.5">
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
              Save & continue
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PersonaSetupDialog;
