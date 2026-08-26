import { useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import RentCastListingsContent from "@/components/rentcast/RentCastListingsContent";
import WebScraper from "@/pages/WebScraper";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Home } from "lucide-react";

type ScoutTab = "rentcast" | "legacy";

function tabFromParam(raw: string | null): ScoutTab {
  return raw === "legacy" ? "legacy" : "rentcast";
}

export default function BrivanoScout() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = tabFromParam(searchParams.get("tab"));

  useEffect(() => {
    if (!searchParams.get("tab")) return;
    if (searchParams.get("tab") !== "legacy" && searchParams.get("tab") !== "rentcast") {
      setSearchParams({ tab: "rentcast" }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const onTabChange = (value: string) => {
    setSearchParams({ tab: value === "legacy" ? "legacy" : "rentcast" }, { replace: true });
  };

  return (
    <DashboardLayout fullWidth>
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Brivano Scout</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Find likely FSBO/FRBO listings with RentCast, enrich owners, and add to CRM. Use
            Platform Scraper to search Zillow, HotPads, and other sites when needed.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={onTabChange} className="space-y-4">
          <TabsList className="h-10 p-1 bg-muted/40 border border-border/30 gap-0.5">
            <TabsTrigger
              value="rentcast"
              className="text-xs gap-1.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Home className="h-3.5 w-3.5" />
              FSBO/FRBO Search
            </TabsTrigger>
            <TabsTrigger
              value="legacy"
              className="text-xs gap-1.5 px-3 rounded-md data-[state=active]:bg-background data-[state=active]:shadow-sm"
            >
              <Globe className="h-3.5 w-3.5" />
              Platform Scraper
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rentcast" className="mt-0">
            <RentCastListingsContent embedded />
          </TabsContent>

          <TabsContent value="legacy" className="mt-0 space-y-3">
            <p className="text-xs text-muted-foreground">
              Search FSBO and FRBO listings across Zillow, HotPads, Trulia, Redfin, and other
              platforms.
            </p>
            <WebScraper embedded />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
