import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Compass, Sparkles } from "lucide-react";
import { usePersona } from "@/hooks/usePersona";
import { getGoalsForRole, getRole } from "@/lib/persona";
import { usePersonaAnalytics } from "@/hooks/usePersonaAnalytics";
import PersonaSetupDialog from "@/components/onboarding/PersonaSetupDialog";

export const WorkspaceFocusCard = () => {
  const { persona, savePersona, loading } = usePersona();
  const { recommendations, isLoading: recsLoading } = usePersonaAnalytics();
  const [editing, setEditing] = useState(false);

  const applyGoal = async (goalId: string) => {
    if (!persona.role) return;
    await savePersona(persona.role, Array.from(new Set([...persona.goals, goalId])));
  };

  const showRecs =
    !recsLoading &&
    recommendations.hasEnoughData &&
    (recommendations.suggestedGoals.length > 0 || !!recommendations.suggestedRole);

  const role = getRole(persona.role);
  const goals = getGoalsForRole(persona.role).filter((g) => persona.goals.includes(g.id));

  return (
    <Card className="border-border/60">
      <CardHeader>
        <CardTitle className="text-foreground flex items-center gap-2">
          <Compass className="h-4 w-4 text-primary" />
          Workspace Focus
        </CardTitle>
        <CardDescription>
          Your role and goals decide which tools appear in the sidebar.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Role</p>
              <p className="text-sm">{role?.label ?? "Not set yet"}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Goals</p>
              <div className="flex flex-wrap gap-1.5">
                {goals.length > 0 ? (
                  goals.map((g) => (
                    <Badge key={g.id} variant="secondary" className="text-[11px] font-normal">
                      {g.label}
                    </Badge>
                  ))
                ) : (
                  <span className="text-sm text-muted-foreground">No goals selected</span>
                )}
              </div>
            </div>
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setEditing(true)}>
              Change role & goals
            </Button>
          </>
        )}
      </CardContent>

      {editing && (
        <PersonaSetupDialog
          open={editing}
          dismissible
          initialRole={persona.role}
          initialGoals={persona.goals}
          onSave={savePersona}
          onClose={() => setEditing(false)}
        />
      )}
    </Card>
  );
};

export default WorkspaceFocusCard;
