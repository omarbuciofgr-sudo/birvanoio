import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { MapPin, Loader2 } from "lucide-react";

const STATE_ABBR: Record<string, string> = {
  Alabama: "AL", Alaska: "AK", Arizona: "AZ", Arkansas: "AR", California: "CA", Colorado: "CO", Connecticut: "CT",
  Delaware: "DE", "District of Columbia": "DC", Florida: "FL", Georgia: "GA", Hawaii: "HI", Idaho: "ID", Illinois: "IL",
  Indiana: "IN", Iowa: "IA", Kansas: "KS", Kentucky: "KY", Louisiana: "LA", Maine: "ME", Maryland: "MD",
  Massachusetts: "MA", Michigan: "MI", Minnesota: "MN", Mississippi: "MS", Missouri: "MO", Montana: "MT",
  Nebraska: "NE", Nevada: "NV", "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", Ohio: "OH", Oklahoma: "OK", Oregon: "OR", Pennsylvania: "PA",
  "Rhode Island": "RI", "South Carolina": "SC", "South Dakota": "SD", Tennessee: "TN", Texas: "TX", Utah: "UT",
  Vermont: "VT", Virginia: "VA", Washington: "WA", "West Virginia": "WV", Wisconsin: "WI", Wyoming: "WY",
};

interface CityAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  /** Called when the user picks a suggestion ("City, ST"). */
  onSelect?: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/** US "City, ST" input with suggestions from OpenStreetMap. */
export const CityAutocomplete = ({ value, onChange, onSelect, placeholder = "Naperville, IL", autoFocus }: CityAutocompleteProps) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const skipNext = useRef(false);

  useEffect(() => {
    if (skipNext.current) { skipNext.current = false; return; }
    const q = value.trim();
    if (q.length < 3) { setSuggestions([]); return; }
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&countrycodes=us&limit=8&q=${encodeURIComponent(q)}`;
        const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: "application/json" } });
        const rows = (await res.json()) as Array<{ address?: Record<string, string> }>;
        const seen = new Set<string>();
        const out: string[] = [];
        for (const r of rows) {
          const a = r.address ?? {};
          const city = a.city || a.town || a.village || a.hamlet || a.municipality;
          const st = a.state ? STATE_ABBR[a.state] : undefined;
          if (!city || !st) continue;
          const label = `${city}, ${st}`;
          if (!seen.has(label)) { seen.add(label); out.push(label); }
        }
        setSuggestions(out);
        setOpen(out.length > 0);
      } catch { /* ignore aborted or failed lookups */ }
      finally { setLoading(false); }
    }, 300);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value]);

  const pick = (s: string) => {
    skipNext.current = true;
    onChange(s);
    onSelect?.(s);
    setOpen(false);
  };

  return (
    <div className="relative">
      <MapPin className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => suggestions.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={placeholder}
        className="pl-8"
        autoComplete="off"
      />
      {loading && <Loader2 className="absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />}
      {open && (
        <ul className="absolute z-50 mt-1 w-full overflow-hidden rounded-md border border-border bg-popover shadow-md">
          {suggestions.map((s) => (
            <li key={s}>
              <button type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => pick(s)}
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted">
                {s}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
