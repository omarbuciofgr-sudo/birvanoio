import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useOwnerLookups } from '@/hooks/useOwnerLookups';

export function FreeLookupCounter({ compact = false }: { compact?: boolean }) {
  const lookup = useOwnerLookups();
  if (lookup.loading || !lookup.isFree) return null;
  return <div className={`flex flex-wrap items-center gap-2 ${compact ? 'text-xs' : 'text-sm'}`}>
    <span className="font-medium tabular-nums">{lookup.remaining > 0 ? `${lookup.remaining} of ${lookup.total} free lookups left` : '0 free lookups left'}</span>
    {lookup.remaining === 0 && <Button asChild size="sm" className="min-h-11"><Link to="/pricing">Upgrade</Link></Button>}
  </div>;
}