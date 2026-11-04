import { Copy, Phone, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { RentCastListing } from '@/lib/api/rentcastApi';

export function OwnerContactSuccess({ row, dnc = false }: { row: RentCastListing; dnc?: boolean }) {
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast.success('Copied'); }
    catch { toast.error('Could not copy. Please select and copy the contact.'); }
  };
  return <div className="space-y-4" aria-live="polite">
    <p className="font-semibold text-primary">Owner contact found.</p>
    {row.owner_phone ? <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Phone number</p>
      <p className="break-all text-xl font-semibold">{row.owner_phone}</p>
      <div className="flex flex-wrap gap-2">
        {!dnc && <><Button asChild className="min-h-11"><a href={`tel:${row.owner_phone}`}><Phone className="mr-2 h-4 w-4" />Call</a></Button><Button asChild variant="outline" className="min-h-11"><a href={`sms:${row.owner_phone}`}><MessageSquare className="mr-2 h-4 w-4" />Text</a></Button></>}
        <Button variant="outline" className="min-h-11" onClick={() => row.owner_phone && copy(row.owner_phone)}><Copy className="mr-2 h-4 w-4" />Copy phone</Button>
      </div>
    </div> : <p className="text-sm text-muted-foreground">Phone number not available.</p>}
    {row.owner_email ? <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Email</p><p className="break-all text-lg font-semibold">{row.owner_email}</p>
      <Button variant="outline" className="min-h-11" onClick={() => row.owner_email && copy(row.owner_email)}><Copy className="mr-2 h-4 w-4" />Copy email</Button>
    </div> : <p className="text-sm text-muted-foreground">Email not available.</p>}
    {dnc && <p className="text-sm text-destructive">Do not contact. Call and Text are unavailable.</p>}
  </div>;
}