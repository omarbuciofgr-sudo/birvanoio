import { scriptParts } from "@/lib/playbook";

/** Keep authored line breaks while visually separating unspoken directions. */
export function ScriptText({ text }: { text: string }) {
  return <span className="whitespace-pre-wrap break-words">{scriptParts(text).map((part, i) =>
    part.cue ? <span key={i} className="text-xs italic text-muted-foreground">{part.text}</span> : <span key={i}>{part.text}</span>
  )}</span>;
}