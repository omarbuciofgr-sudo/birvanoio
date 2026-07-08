import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ArrowDown, ArrowUp, LayoutGrid, RotateCcw, Settings2 } from "lucide-react";
import { WIDGET_CATALOG, type WidgetId } from "@/hooks/useOverviewLayout";

interface Props {
  order: WidgetId[];
  hidden: WidgetId[];
  onToggle: (id: WidgetId) => void;
  onMove: (id: WidgetId, dir: -1 | 1) => void;
  onReset: () => void;
}

export default function CustomizeOverviewSheet({ order, hidden, onToggle, onMove, onReset }: Props) {
  const metaById = new Map(WIDGET_CATALOG.map((w) => [w.id, w]));

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8">
          <LayoutGrid className="h-3.5 w-3.5" /> Customize
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[440px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Settings2 className="h-4 w-4" /> Customize Overview
          </SheetTitle>
          <SheetDescription>
            Show, hide, and reorder widgets on your Overview page. Preferences are saved to this browser.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-4 space-y-2">
          {order.map((id, idx) => {
            const meta = metaById.get(id);
            if (!meta) return null;
            const visible = !hidden.includes(id);
            return (
              <div
                key={id}
                className="flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 p-3"
              >
                <div className="flex flex-col gap-0.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={idx === 0}
                    onClick={() => onMove(id, -1)}
                    aria-label={`Move ${meta.label} up`}
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    disabled={idx === order.length - 1}
                    onClick={() => onMove(id, 1)}
                    aria-label={`Move ${meta.label} down`}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold">{meta.label}</p>
                  <p className="text-[10px] text-muted-foreground line-clamp-1">{meta.description}</p>
                </div>
                <Switch checked={visible} onCheckedChange={() => onToggle(id)} />
              </div>
            );
          })}
        </div>

        <div className="mt-6 flex justify-end">
          <Button variant="ghost" size="sm" onClick={onReset} className="gap-1.5 text-xs">
            <RotateCcw className="h-3.5 w-3.5" /> Reset to default
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
