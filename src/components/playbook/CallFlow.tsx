import { gettingStarted } from "@/data/playbookContent";

export function CallFlow() {
  return (
    <ol className="list-decimal space-y-3 pl-5 text-sm">
      {gettingStarted.callFlow.map(({ step, text }) => <li key={step} className="pl-1">
        <p className="font-medium">{step}</p>
        <p className="text-muted-foreground">{text}</p>
      </li>)}
    </ol>
  );
}