import { useState } from "react";
import { List, Map as MapIcon } from "lucide-react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type ListMapLayout = "list" | "map";

export function useListMapLayout(scope: string) {
  const storageKey = `brivano:layout:${scope}`;
  const [value, setValue] = useState<ListMapLayout>(() =>
    typeof window !== "undefined" && localStorage.getItem(storageKey) === "map" ? "map" : "list",
  );
  const set = (v: ListMapLayout) => {
    setValue(v);
    try { localStorage.setItem(storageKey, v); } catch { /* ignore */ }
  };
  return [value, set] as const;
}

export function ListMapToggle({ value, onChange }: { value: ListMapLayout; onChange: (v: ListMapLayout) => void }) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as ListMapLayout)}
      className="justify-start"
      aria-label="Show results as list or map"
    >
      <ToggleGroupItem value="list" className="min-h-11 gap-1.5 px-3 text-xs sm:min-h-9" aria-label="List view">
        <List className="h-4 w-4" /> List
      </ToggleGroupItem>
      <ToggleGroupItem value="map" className="min-h-11 gap-1.5 px-3 text-xs sm:min-h-9" aria-label="Map view">
        <MapIcon className="h-4 w-4" /> Map
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
