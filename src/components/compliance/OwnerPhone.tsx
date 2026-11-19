import { useId, useState, type ComponentProps, type ReactNode } from 'react';
import { Copy, MessageSquare, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DNC_HELP, normalizeUsPhone, type PhoneCheck } from '@/lib/phoneCompliance';
import { usePhoneCompliance } from '@/hooks/usePhoneCompliance';

function checkedWarning(check?: PhoneCheck) {
  const date = check?.checked_at ? new Date(check.checked_at).toLocaleDateString() : null;
  return `On the National Do Not Call Registry${date ? ` (checked ${date})` : ''}. Calling this number for marketing may violate federal law unless you have consent or an existing business relationship.`;
}

export function usePhoneWarning(phone?: string | null, blocked?: boolean) {
  const { check, pending, unavailable } = usePhoneCompliance(phone);
  const [confirmation, setConfirmation] = useState<{ action: 'call' | 'text'; run: () => void } | null>(null);
  const disabled = !!(blocked || pending || unavailable || check?.suppressed || check?.tcpa_litigator);
  const request = (action: 'call' | 'text', run: () => void) => {
    if (disabled || !phone) return;
    if (normalizeUsPhone(phone) && (check?.on_national_dnc || check?.status !== 'checked')) setConfirmation({ action, run });
    else run();
  };
  const warningDialog = <AlertDialog open={!!confirmation} onOpenChange={open => { if (!open) setConfirmation(null); }}>
    <AlertDialogContent onClick={e => e.stopPropagation()}>
      <AlertDialogHeader>
        <AlertDialogTitle>{check?.on_national_dnc ? 'This number is on the Do Not Call Registry' : 'DNC status is not confirmed'}</AlertDialogTitle>
        <AlertDialogDescription>{check?.on_national_dnc ? checkedWarning(check) : 'Check this number against the applicable do-not-call lists before contacting it.'} {DNC_HELP}</AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction disabled={disabled} onClick={() => { if (!disabled) confirmation?.run(); }}>Continue to {confirmation?.action}</AlertDialogAction></AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>;
  return { request, warningDialog, disabled, check };
}

function PhoneBadge({ label, detail, danger }: { label: string; detail?: string; danger?: boolean }) {
  return <Tooltip>
    <TooltipTrigger asChild><Badge tabIndex={0} variant={danger ? 'destructive' : 'secondary'} className="whitespace-normal">{label}</Badge></TooltipTrigger>
    <TooltipContent className="z-[10000] max-w-xs space-y-2 text-left">{detail && <p>{detail}</p>}<p>{DNC_HELP}</p></TooltipContent>
  </Tooltip>;
}

export function PhoneOutreachAction({ phone, action, blocked, children, label, ...props }: Omit<ComponentProps<typeof Button>, 'onClick' | 'asChild'> & { phone?: string | null; action: 'call' | 'text'; blocked?: boolean; children: ReactNode; label?: string }) {
  const { check, disabled, request, warningDialog } = usePhoneWarning(phone, blocked);
  const number = normalizeUsPhone(phone);
  const dialable = number ? `+1${number}` : phone && /^\+\d{7,15}$/.test(phone) ? phone : null;
  const href = dialable ? `${action === 'call' ? 'tel' : 'sms'}:${dialable}` : null;
  const content = <Button {...props} aria-label={label} disabled={props.disabled || disabled || !href} onKeyDown={e => e.stopPropagation()} onClick={e => {
    e.stopPropagation();
    if (!href || disabled) return;
    request(action, () => window.location.assign(href));
  }}>{children}</Button>;
  if (blocked || check?.suppressed || check?.tcpa_litigator) return null;
  return <>{content}{warningDialog}</>;
}

export function OwnerPhone({ phone, hideDnc = false, blocked = false, actions = false, large = false }: { phone: string; hideDnc?: boolean; blocked?: boolean; actions?: boolean; large?: boolean }) {
  const { check, pending, unavailable } = usePhoneCompliance(phone);
  if (pending) return <span className="text-xs text-muted-foreground">Checking phone…</span>;
  if (check?.tcpa_litigator) return <div className="text-xs text-muted-foreground" title={DNC_HELP}>1 number hidden (known TCPA litigator)</div>;
  if (check?.suppressed) return <div><PhoneBadge label="Your do-not-call list" danger /></div>;
  if (blocked) return <div><PhoneBadge label="Do not contact" danger /></div>;
  const flagged = check?.on_national_dnc === true;
  const hidden = hideDnc && flagged;
  return <div className="space-y-2">
    <div className="flex flex-wrap items-center gap-1.5">
      {!hidden && (actions || unavailable || !normalizeUsPhone(phone) ? <span className={large ? 'break-all text-xl font-semibold' : 'break-all'}>{phone}</span> : <PhoneOutreachAction phone={phone} action="call" variant="link" size="sm" className="h-auto p-0 text-xs">{phone}</PhoneOutreachAction>)}
      {flagged && <PhoneBadge label="DNC" detail={checkedWarning(check)} danger />}
      {!flagged && check?.status !== 'checked' && <PhoneBadge label="DNC not checked" />}
    </div>
    {!hidden && actions && <div className="flex flex-wrap gap-2">
      <PhoneOutreachAction phone={phone} action="call" className="min-h-11"><Phone className="h-4 w-4" />Call</PhoneOutreachAction>
      <PhoneOutreachAction phone={phone} action="text" variant="outline" className="min-h-11"><MessageSquare className="h-4 w-4" />Text</PhoneOutreachAction>
      <Button variant="outline" className="min-h-11" onClick={() => void navigator.clipboard.writeText(phone).then(() => toast.success('Copied'), () => toast.error('Could not copy phone number'))}><Copy className="h-4 w-4" />Copy phone</Button>
    </div>}
  </div>;
}

export function HideDncSwitch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return <label htmlFor={id} className="inline-flex min-h-11 items-center gap-2 text-xs" title={DNC_HELP}><Switch id={id} checked={checked} onCheckedChange={onChange} />Hide DNC numbers</label>;
}

export function DncExportOption({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) {
  const id = useId();
  return <label htmlFor={id} className="flex items-center gap-2 text-sm"><Checkbox id={id} checked={checked} onCheckedChange={value => onChange(value === true)} />Exclude DNC numbers</label>;
}

export function PhoneExportDialog({ children, onExport }: { children: ReactNode; onExport: (excludeDnc: boolean) => Promise<void> }) {
  const [open, setOpen] = useState(false);
  const [exclude, setExclude] = useState(true);
  const [busy, setBusy] = useState(false);
  return <Dialog open={open} onOpenChange={next => { if (!busy) { setOpen(next); if (next) setExclude(true); } }}>
    <DialogTrigger asChild>{children}</DialogTrigger>
    <DialogContent>
      <DialogHeader><DialogTitle>Export CSV</DialogTitle><DialogDescription>Known TCPA litigator and personally blocked phone numbers are always omitted. The default also omits numbers without a current check.</DialogDescription></DialogHeader>
      <DncExportOption checked={exclude} onChange={setExclude} />
      <DialogFooter><Button variant="outline" disabled={busy} onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy} onClick={async () => {
        setBusy(true);
        try { await onExport(exclude); setOpen(false); } catch { toast.error('Could not check phone numbers. Please try exporting again.'); } finally { setBusy(false); }
      }}>{busy ? 'Checking numbers…' : 'Download CSV'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}