import { Badge } from "@/components/ui/badge";
import { fillTokens, roleLabels, type CallScript, type TokenKey } from "@/data/playbookContent";
import { CopyText } from "./CopyText";

type Props = { script: CallScript; values?: Partial<Record<TokenKey, string>>; recommended?: boolean };

export function ScriptCard({ script, values = {}, recommended }: Props) {
  const f = (t: string) => fillTokens(t, values);
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline">{script.leadType}</Badge>
        {recommended && <Badge>For your role</Badge>}
        <span className="text-xs text-muted-foreground">{script.roles.map((r) => roleLabels[r]).join(" · ")}</span>
      </div>
      <p className="text-sm"><span className="font-medium">Goal: </span>{script.goal}</p>
      <CopyText label="Opener" text={f(script.opener)} />
      <div>
        <p className="mb-1.5 text-sm font-medium">Discovery questions</p>
        <ul className="list-disc space-y-1 pl-5 text-sm">{script.discovery.map((q) => <li key={q}>{f(q)}</li>)}</ul>
      </div>
      {script.bridge && (
        <div>
          <p className="mb-1.5 text-sm font-medium">Bridge</p>
          <p className="text-sm text-muted-foreground">{f(script.bridge)}</p>
        </div>
      )}
      <div className="space-y-2">
        <p className="text-sm font-medium">Asks</p>
        {script.asks.map((a) => <CopyText key={a.label} label={a.label} text={f(a.text)} />)}
      </div>
      {script.objections.length > 0 && <ObjectionList items={script.objections} values={values} />}
      {script.notes?.length ? (
        <div>
          <p className="mb-1.5 text-sm font-medium">Notes</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">{script.notes.map((n) => <li key={n}>{n}</li>)}</ul>
        </div>
      ) : null}
    </div>
  );
}

export function ObjectionList({ items, values = {} }: { items: { theySay: string; youSay: string }[]; values?: Partial<Record<TokenKey, string>> }) {
  return (
    <div>
      <p className="mb-1.5 text-sm font-medium">Objections</p>
      <div className="divide-y divide-border rounded-md border border-border">
        {items.map((o) => (
          <div key={o.theySay} className="grid gap-1 p-3 text-sm sm:grid-cols-[1fr_2fr] sm:gap-3">
            <p className="font-medium">"{o.theySay}"</p>
            <p className="text-muted-foreground">{fillTokens(o.youSay, values)}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
