import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, UserRound } from "lucide-react";

/** Agent headshot stored privately at agent-photos/<userId>/photo. */
export function AgentPhotoField({ userId, path, onChange }: { userId: string; path: string | null; onChange: (p: string | null) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!path) { setUrl(null); return; }
    supabase.storage.from("agent-photos").createSignedUrl(path, 3600).then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);

  const save = async (next: string | null) => {
    const { error } = await supabase.from("profiles").update({ agent_photo_path: next } as never).eq("user_id", userId);
    if (error) throw error;
    onChange(next);
  };

  const upload = async (file: File) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast.error("Please choose a JPG, PNG or WebP photo.");
    if (file.size > 5 * 1024 * 1024) return toast.error("Please choose a photo under 5 MB.");
    setBusy(true);
    try {
      const p = `${userId}/photo-${Date.now()}`;
      const { error } = await supabase.storage.from("agent-photos").upload(p, file, { contentType: file.type });
      if (error) throw error;
      const old = path;
      await save(p);
      if (old) supabase.storage.from("agent-photos").remove([old]);
      toast.success("Photo updated.");
    } catch {
      toast.error("We couldn't upload that photo. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!path) return;
    setBusy(true);
    try { await save(null); await supabase.storage.from("agent-photos").remove([path]); }
    catch { toast.error("We couldn't remove the photo."); }
    finally { setBusy(false); }
  };

  return (
    <div className="flex items-center gap-4">
      <div className="h-16 w-16 flex-none overflow-hidden rounded-full border border-border bg-muted flex items-center justify-center">
        {url ? <img src={url} alt="Your photo" className="h-full w-full object-cover" /> : <UserRound className="h-6 w-6 text-muted-foreground" />}
      </div>
      <div className="flex flex-wrap gap-2">
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
        <Button type="button" size="sm" variant="outline" className="h-8" disabled={busy} onClick={() => input.current?.click()}>
          {busy && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}{path ? "Change photo" : "Upload photo"}
        </Button>
        {path && <Button type="button" size="sm" variant="ghost" className="h-8" disabled={busy} onClick={remove}>Remove</Button>}
      </div>
    </div>
  );
}
