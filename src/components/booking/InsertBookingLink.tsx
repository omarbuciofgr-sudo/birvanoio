import { Link } from "react-router-dom";
import { CalendarPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useBookingLink } from "@/hooks/useBookingLink";

/** Appends the user's booking link to a message. Shows "Add your booking link" when none is set. */
export function InsertBookingLink({ value, onChange, className = "" }: { value: string; onChange: (next: string) => void; className?: string }) {
  const { url, loading } = useBookingLink();
  if (loading) return null;
  if (!url) {
    return (
      <Button asChild size="sm" variant="ghost" className={`h-8 gap-1 text-xs text-muted-foreground ${className}`}>
        <Link to="/dashboard/settings#booking-link"><CalendarPlus className="h-3.5 w-3.5" /> Add your booking link</Link>
      </Button>
    );
  }
  const insert = () => {
    if (value.includes(url)) return;
    const sep = !value ? "" : value.endsWith("\n") ? "" : value.endsWith(" ") ? "" : " ";
    onChange(`${value}${sep}${url}`);
  };
  return (
    <Button type="button" size="sm" variant="outline" className={`h-8 gap-1 text-xs ${className}`} onClick={insert} disabled={value.includes(url)}>
      <CalendarPlus className="h-3.5 w-3.5" /> Insert booking link
    </Button>
  );
}
