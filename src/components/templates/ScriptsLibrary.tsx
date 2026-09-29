import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Copy, Pencil, Phone, Mail, MessageSquare, Trash2 } from "lucide-react";
import { STARTER_SCRIPTS, TYPE_LABEL, scriptCategory, type OwnerSituation, type ScriptKind } from "@/lib/scriptTemplates";

type Saved = { id: string; name: string; type: ScriptKind; subject: string | null; body: string; category: string | null };
type Draft = { id?: string; name: string; type: ScriptKind; situation: OwnerSituation; subject: string; body: string };

const ICON = { call: Phone, sms: MessageSquare, email: Mail } as const;
const situationOf = (c: string | null): OwnerSituation => (c === "script_frbo" ? "frbo" : "fsbo");

export function ScriptsLibrary({ userId }: { userId: string }) {
  const [saved, setSaved] = useState<Saved[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await supabase.from("message_templates")
      .select("id, name, type, subject, body, category")
      .eq("client_id", userId).in("category", ["script_fsbo", "script_frbo"]).order("created_at", { ascending: false });
    setSaved((data ?? []) as Saved[]);
  }, [userId]);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!draft || !draft.name.trim() || !draft.body.trim()) return toast.error("Add a name and a script.");
    setSaving(true);
    const row = {
      name: draft.name.trim().slice(0, 120),
      type: draft.type,
      subject: draft.type === "email" ? draft.subject.trim() || null : null,
      body: draft.body.trim().slice(0, 10000),
      category: scriptCategory(draft.situation),
    };
    const { error } = draft.id
      ? await supabase.from("message_templates").update(row).eq("id", draft.id)
      : await supabase.from("message_templates").insert({ ...row, client_id: userId });
    setSaving(false);
    if (error) return toast.error("Couldn't save the script. Please try again.");
    toast.success("Script saved");
    setDraft(null);
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("message_templates").delete().eq("id", id);
    if (error) return toast.error("Couldn't delete the script.");
    load();
  };

  const card = (key: string, name: string, type: ScriptKind, situation: OwnerSituation, body: string, actions: React.ReactNode) => {
    const Icon = ICON[type];
    return (
      <Card key={key} className="flex flex-col">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Icon className="h-4 w-4 text-primary" />{name}</CardTitle>
          <div className="flex gap-1">
            <Badge variant="secondary" className="text-[10px]">{situation === "fsbo" ? "Selling (FSBO)" : "Renting (FRBO)"}</Badge>
            <Badge variant="outline" className="text-[10px]">{TYPE_LABEL[type]}</Badge>
          </div>
        </CardHeader>
        <CardContent className="flex-1 flex flex-col gap-3">
          <p className="text-xs text-muted-foreground whitespace-pre-line line-clamp-5 flex-1">{body}</p>
          <div className="flex gap-1">{actions}</div>
        </CardContent>
      </Card>
    );
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success("Copied"); };

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold">My scripts</h2>
          <p className="text-xs text-muted-foreground">Your saved versions. Merge fields like {"{{owner_name}}"} and {"{{address}}"} are placeholders to fill in.</p>
        </div>
        {saved === null ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"><Skeleton className="h-40" /><Skeleton className="h-40" /></div>
        ) : saved.length === 0 ? (
          <p className="text-xs text-muted-foreground">No saved scripts yet. Edit a starter below and save it as your own.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {saved.map((s) => card(s.id, s.name, s.type, situationOf(s.category), s.body, (
              <>
                <Button size="sm" variant="outline" className="h-7" onClick={() => setDraft({ id: s.id, name: s.name, type: s.type, situation: situationOf(s.category), subject: s.subject ?? "", body: s.body })}><Pencil className="h-3.5 w-3.5 mr-1" />Edit</Button>
                <Button size="sm" variant="ghost" className="h-7" onClick={() => copy(s.subject ? `Subject: ${s.subject}\n\n${s.body}` : s.body)}><Copy className="h-3.5 w-3.5" /></Button>
                <Button size="sm" variant="ghost" className="h-7 ml-auto" onClick={() => remove(s.id)} aria-label="Delete"><Trash2 className="h-3.5 w-3.5" /></Button>
              </>
            )))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Starter scripts</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STARTER_SCRIPTS.map((s) => card(s.key, s.name, s.type, s.situation, s.body, (
            <>
              <Button size="sm" variant="outline" className="h-7" onClick={() => setDraft({ name: `My ${s.name}`, type: s.type, situation: s.situation, subject: s.subject ?? "", body: s.body })}><Pencil className="h-3.5 w-3.5 mr-1" />Edit &amp; save</Button>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => copy(s.subject ? `Subject: ${s.subject}\n\n${s.body}` : s.body)}><Copy className="h-3.5 w-3.5" /></Button>
            </>
          )))}
        </div>
      </section>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{draft?.id ? "Edit script" : "Save as my script"}</DialogTitle></DialogHeader>
          {draft && (
            <div className="space-y-3">
              <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} maxLength={120} placeholder="Script name" />
              {draft.type === "email" && (
                <Input value={draft.subject} onChange={(e) => setDraft({ ...draft, subject: e.target.value })} maxLength={200} placeholder="Subject" />
              )}
              <Textarea value={draft.body} onChange={(e) => setDraft({ ...draft, body: e.target.value })} rows={12} maxLength={10000} className="text-sm" />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>Cancel</Button>
            <Button onClick={save} disabled={saving}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
