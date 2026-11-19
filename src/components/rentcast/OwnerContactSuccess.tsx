import { Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OwnerPhone } from '@/components/compliance/OwnerPhone';
import { collectPhones } from '@/lib/phoneCompliance';
import { toast } from 'sonner';
import type { RentCastListing } from '@/lib/api/rentcastApi';

export function OwnerContactSuccess({ row, dnc = false }: { row: RentCastListing; dnc?: boolean }) {
  const phones = collectPhones(row.owner_phone, row.all_phones);
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast.success('Copied'); }
    catch { toast.error('Could not copy. Please select and copy the contact.'); }
  };
  return <div className="space-y-4" aria-live="polite">
    <p className="font-semibold text-primary">Owner contact found.</p>
    {phones.length ? <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Phone numbers</p>
      {phones.map(phone => <OwnerPhone key={phone} phone={phone} blocked={dnc} actions large />)}
    </div> : <p className="text-sm text-muted-foreground">Phone number not available.</p>}
    {row.owner_email ? <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Email</p><p className="break-all text-lg font-semibold">{row.owner_email}</p>
      <Button variant="outline" className="min-h-11" onClick={() => row.owner_email && copy(row.owner_email)}><Copy className="mr-2 h-4 w-4" />Copy email</Button>
    </div> : <p className="text-sm text-muted-foreground">Email not available.</p>}
    {dnc && <p className="text-sm text-destructive">Do not contact. Call and Text are unavailable.</p>}
  </div>;
}