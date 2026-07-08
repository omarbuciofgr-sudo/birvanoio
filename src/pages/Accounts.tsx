import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, Building2, Sparkles, ArrowUpDown, MapPin, Flame, GitMerge } from "lucide-react";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"];

const statusColors: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  contacted: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  qualified: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  converted: "bg-green-500/10 text-green-600 dark:text-green-400",
  lost: "bg-destructive/10 text-destructive",
};

type SortKey = "count" | "score" | "activity" | "name";

interface Account {
  key: string;
  displayName: string;
  count: number;
  hotCount: number;
  topScore: number;
  industries: string[];
  locations: string[];
  domains: string[];
  statuses: Record<string, number>;
  lastActivity: string;
}

function extractDomain(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.trim().toLowerCase();
  if (!v) return null;
  if (v.includes("@")) {
    const parts = v.split("@");
    return parts[1] || null;
  }
  try {
    const url = v.startsWith("http") ? v : `https://${v}`;
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export default function Accounts() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("all");
  const [stateFilter, setStateFilter] = useState("all");
  const [hotOnly, setHotOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortKey>("count");

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setLeads(data);
      });
  }, [user]);

  const accounts: Account[] = useMemo(() => {
    const map = new Map<string, Account>();
    for (const l of leads) {
      const raw = (l.business_name || "").trim();
      if (!raw) continue;
      const key = raw.toLowerCase();
      const domain =
        extractDomain(l.website) || extractDomain(l.email) || null;
      const loc = [l.city, l.state].filter(Boolean).join(", ");
      const existing =
        map.get(key) ||
        {
          key,
          displayName: raw,
          count: 0,
          hotCount: 0,
          topScore: 0,
          industries: [],
          locations: [],
          domains: [],
          statuses: {},
          lastActivity: l.created_at,
        };
      existing.count += 1;
      const score = l.lead_score ?? 0;
      if (score >= 70) existing.hotCount += 1;
      existing.topScore = Math.max(existing.topScore, score);
      if (l.industry && !existing.industries.includes(l.industry))
        existing.industries.push(l.industry);
      if (loc && !existing.locations.includes(loc)) existing.locations.push(loc);
      if (domain && !existing.domains.includes(domain)) existing.domains.push(domain);
      existing.statuses[l.status] = (existing.statuses[l.status] || 0) + 1;
      if (new Date(l.created_at) > new Date(existing.lastActivity))
        existing.lastActivity = l.created_at;
      map.set(key, existing);
    }
    return Array.from(map.values());
  }, [leads]);

  const industries = useMemo(
    () => Array.from(new Set(accounts.flatMap((a) => a.industries))).sort(),
    [accounts]
  );
  const states = useMemo(
    () =>
      Array.from(
        new Set(leads.map((l) => l.state).filter(Boolean) as string[])
      ).sort(),
    [leads]
  );

  const filtered = useMemo(() => {
    let out = accounts;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      out = out.filter(
        (a) =>
          a.displayName.toLowerCase().includes(q) ||
          a.domains.some((d) => d.includes(q))
      );
    }
    if (industryFilter !== "all")
      out = out.filter((a) => a.industries.includes(industryFilter));
    if (stateFilter !== "all")
      out = out.filter((a) =>
        a.locations.some((loc) => loc.endsWith(stateFilter))
      );
    if (hotOnly) out = out.filter((a) => a.hotCount > 0);

    out = [...out].sort((a, b) => {
      switch (sortBy) {
        case "count":
          return b.count - a.count;
        case "score":
          return b.topScore - a.topScore;
        case "activity":
          return (
            new Date(b.lastActivity).getTime() -
            new Date(a.lastActivity).getTime()
          );
        case "name":
          return a.displayName.localeCompare(b.displayName);
      }
    });
    return out;
  }, [accounts, search, industryFilter, stateFilter, hotOnly, sortBy]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!user) return null;

  return (
    <DashboardLayout>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Accounts</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {filtered.length} of {accounts.length} companies · grouped from your leads
            </p>
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Search company name or domain..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 h-8 text-xs"
            />
          </div>
          <Select value={industryFilter} onValueChange={setIndustryFilter}>
            <SelectTrigger className="w-40 h-8 text-xs">
              <SelectValue placeholder="Industry" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All industries</SelectItem>
              {industries.map((i) => (
                <SelectItem key={i} value={i}>
                  {i}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={stateFilter} onValueChange={setStateFilter}>
            <SelectTrigger className="w-32 h-8 text-xs">
              <SelectValue placeholder="State" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {states.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={hotOnly ? "secondary" : "outline"}
            size="sm"
            className="h-8 text-xs gap-1"
            onClick={() => setHotOnly((v) => !v)}
          >
            <Flame className="w-3.5 h-3.5" /> Has hot lead
          </Button>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
            <SelectTrigger className="w-40 h-8 text-xs ml-auto">
              <ArrowUpDown className="w-3.5 h-3.5 mr-1" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="count">Most leads</SelectItem>
              <SelectItem value="score">Top score</SelectItem>
              <SelectItem value="activity">Recent activity</SelectItem>
              <SelectItem value="name">Name (A→Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Grid */}
        {filtered.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium">No accounts found</p>
              <p className="text-xs mt-1">
                Add or import leads to see companies here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((a) => (
              <Card
                key={a.key}
                className="cursor-pointer hover:border-primary/40 hover:shadow-sm transition-all"
                onClick={() =>
                  navigate(`/dashboard/accounts/${encodeURIComponent(a.displayName)}`)
                }
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <div className="w-8 h-8 rounded-md bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-sm truncate" title={a.displayName}>
                          {a.displayName}
                        </p>
                        {a.domains[0] && (
                          <p className="text-[10px] text-muted-foreground truncate">
                            {a.domains[0]}
                          </p>
                        )}
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] flex-shrink-0">
                      {a.count} lead{a.count === 1 ? "" : "s"}
                    </Badge>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {a.industries.slice(0, 2).map((i) => (
                      <Badge key={i} variant="outline" className="text-[9px] font-normal">
                        {i}
                      </Badge>
                    ))}
                    {a.domains.length > 1 && (
                      <Badge
                        variant="outline"
                        className="text-[9px] font-normal gap-1 border-amber-500/50 text-amber-600 dark:text-amber-400"
                        title={`Detected ${a.domains.length} domains: ${a.domains.join(", ")}`}
                      >
                        <GitMerge className="w-2.5 h-2.5" /> {a.domains.length} domains
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span className="truncate flex items-center gap-1">
                      <MapPin className="w-2.5 h-2.5" />
                      {a.locations[0] || "—"}
                    </span>
                    {a.topScore > 0 && (
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5" /> {a.topScore}
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-1 pt-1 border-t border-border/40">
                    {Object.entries(a.statuses).map(([s, n]) => (
                      <span
                        key={s}
                        className={`text-[9px] px-1.5 py-0.5 rounded-full ${
                          statusColors[s] || ""
                        }`}
                      >
                        {n} {s}
                      </span>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
