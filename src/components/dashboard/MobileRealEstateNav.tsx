import { Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BarChart3, CreditCard, Download, Home, House, MoreHorizontal, Send, Settings, Share, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const tabs = [
  { label: "Home", href: "/dashboard", icon: Home },
  { label: "Find Owners", href: "/dashboard/scraper?tab=real-estate", icon: House },
  { label: "My Leads", href: "/dashboard/leads", icon: Users },
  { label: "Outreach", href: "/dashboard/outreach", icon: Send },
] as const;

const outreachPaths = ["/dashboard/outreach", "/dashboard/campaigns", "/dashboard/sequences", "/dashboard/templates"];

export function MobileRealEstateNav({ onSignOut }: { onSignOut: () => void }) {
  const location = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);
  const [installPrompt, setInstallPrompt] = useState<InstallPromptEvent | null>(null);
  const [showInstallTip, setShowInstallTip] = useState(false);

  useEffect(() => {
    const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
    const standalone = window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone;
    const dismissed = window.localStorage.getItem("brivano:install-tip-dismissed") === "1";
    setShowInstallTip(!standalone && !dismissed);
    if (!standalone && !dismissed) window.localStorage.setItem("brivano:install-tip-dismissed", "1");
    const capture = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);

  const dismissInstall = () => {
    window.localStorage.setItem("brivano:install-tip-dismissed", "1");
    setShowInstallTip(false);
  };

  const install = async () => {
    if (installPrompt) {
      await installPrompt.prompt();
      const choice = await installPrompt.userChoice;
      if (choice.outcome === "accepted") dismissInstall();
      return;
    }
    setMoreOpen(true);
  };

  const isActive = (label: string, href: string) =>
    label === "Outreach" ? outreachPaths.includes(location.pathname) : location.pathname === href.split("?")[0];

  return (
    <>
      {showInstallTip && (
        <div className="fixed inset-x-3 z-40 rounded-md border border-border bg-background p-3 shadow-lg md:hidden bottom-[calc(4.75rem+env(safe-area-inset-bottom))]">
          <div className="flex items-start gap-3">
            <Download className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">Add Brivano to your home screen</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Open your workspace faster from an app icon.</p>
              <div className="mt-2 flex gap-2">
                <Button size="sm" className="min-h-11" onClick={install}>{installPrompt ? "Add now" : "Show me how"}</Button>
                <Button size="sm" variant="ghost" className="min-h-11" onClick={dismissInstall}>Not now</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 backdrop-blur-xl md:hidden" aria-label="Main navigation">
        <div className="grid grid-cols-5 px-1 pb-[env(safe-area-inset-bottom)]">
          {tabs.map(({ label, href, icon: Icon }) => {
            const active = isActive(label, href);
            return (
              <Link key={href} to={href} className={cn("flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium", active ? "text-primary" : "text-muted-foreground")}>
                <Icon className="h-5 w-5" />
                <span className="max-w-full truncate">{label}</span>
              </Link>
            );
          })}
          <button type="button" onClick={() => setMoreOpen(true)} className={cn("flex min-h-[60px] min-w-0 flex-col items-center justify-center gap-1 px-1 text-[10px] font-medium", moreOpen || ["/dashboard/results", "/dashboard/settings", "/dashboard/billing"].includes(location.pathname) ? "text-primary" : "text-muted-foreground")}>
            <MoreHorizontal className="h-5 w-5" />
            <span>More</span>
          </button>
        </div>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent side="bottom" className="rounded-t-lg pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:hidden">
          <SheetHeader><SheetTitle>More</SheetTitle></SheetHeader>
          <div className="mt-4 grid gap-2">
            {[
              { label: "My Results", href: "/dashboard/results", icon: BarChart3 },
              { label: "Automations", href: "/dashboard/automations", icon: Workflow },
              { label: "Settings", href: "/dashboard/settings", icon: Settings },
              { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
            ].map(({ label, href, icon: Icon }) => (
              <Button key={href} asChild variant="ghost" className="min-h-11 justify-start" onClick={() => setMoreOpen(false)}>
                <Link to={href}><Icon className="h-5 w-5" />{label}</Link>
              </Button>
            ))}
            {!installPrompt && <p className="px-3 text-xs text-muted-foreground"><Share className="mr-1 inline h-4 w-4" />On iPhone, tap Share, then Add to Home Screen.</p>}
            <div className="flex min-h-11 items-center justify-between rounded-md px-3 text-sm"><span>Appearance</span><ThemeToggle /></div>
            <Button variant="outline" className="min-h-11" onClick={onSignOut}>Sign out</Button>
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
}