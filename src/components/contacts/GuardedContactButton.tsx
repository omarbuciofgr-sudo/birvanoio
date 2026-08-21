import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";
import { EMPTY_CHECK, useContactGuard, type ContactCheck, type ContactValueType } from "@/hooks/useContactGuard";
import { Ban, AlertTriangle } from "lucide-react";

type Props = {
  value: string;
  type?: ContactValueType;
  /** call | text | email — recorded in the shared contact history. */
  channel: string;
  href: string;
  label: string;
  contactName?: string;
  icon?: React.ReactNode;
  className?: string;
};

/**
 * Contact action that checks the workspace do-not-contact list and the shared
 * contact history before it dials/texts/emails, then logs the touch so
 * teammates see it.
 */
export function GuardedContactButton({
  value,
  type,
  channel,
  href,
  label,
  contactName,
  icon,
  className,
}: Props) {
  const { checkContact, logTouch } = useContactGuard();
  const [check, setCheck] = useState<ContactCheck>(EMPTY_CHECK);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    let active = true;
    checkContact(value, type).then((c) => {
      if (active) setCheck(c);
    });
    return () => {
      active = false;
    };
  }, [value, type, checkContact]);

  const blocked = check.suppressed && !confirmed;
  const warn = check.duplicateByTeammate;

  const onClick = (e: React.MouseEvent) => {
    if (check.suppressed && !confirmed) {
      e.preventDefault();
      toast.error("On the do-not-contact list", {
        description: check.suppressionReason || "This contact was marked do-not-contact by your workspace.",
      });
      return;
    }
    if (warn) {
      const when = check.lastTouch ? new Date(check.lastTouch.created_at).toLocaleDateString() : "recently";
      toast.warning(`A teammate already reached out ${when}`, {
        description: `Last touch: ${check.lastTouch?.channel || "contact"}.`,
      });
    }
    logTouch(value, { channel, contactName, type });
  };

  const tip = check.suppressed
    ? `Do not contact${check.suppressionReason ? ` — ${check.suppressionReason}` : ""}`
    : warn
      ? `Already contacted by a teammate (${check.totalTouches} touch${check.totalTouches === 1 ? "" : "es"})`
      : label;

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="sm"
            variant="outline"
            className={`h-7 text-[11px] gap-1 ${warn && !check.suppressed ? "border-amber-500/60 text-amber-700 dark:text-amber-400" : ""} ${
              blocked ? "border-destructive/60 text-destructive" : ""
            } ${className || ""}`}
            asChild
          >
            <a href={blocked ? undefined : href} onClick={onClick}>
              {check.suppressed ? <Ban className="h-3 w-3" /> : warn ? <AlertTriangle className="h-3 w-3" /> : icon}
              {label}
            </a>
          </Button>
        </TooltipTrigger>
        <TooltipContent className="text-xs max-w-xs">{tip}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default GuardedContactButton;
