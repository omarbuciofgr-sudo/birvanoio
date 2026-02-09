import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Users,
  BarChart3,
  Settings,
  LogOut,
  Menu,
  X,
  Upload,
  Mail,
  Bot,
  FileText,
  Inbox,
  Globe,
  Key,
  Briefcase,
  Sparkles,
} from "lucide-react";
import brivanoLogo from "@/assets/brivano-logo.png";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
  { name: "Leads", href: "/dashboard/leads", icon: Users },
  { name: "Web Scraper", href: "/dashboard/scraper", icon: Globe },
  { name: "CSV Enrichment", href: "/dashboard/csv-enrichment", icon: Sparkles },
  { name: "Campaigns", href: "/dashboard/campaigns", icon: Mail },
  { name: "Templates", href: "/dashboard/templates", icon: FileText },
  { name: "Voice Agent", href: "/dashboard/voice-agent", icon: Bot },
  { name: "Analytics", href: "/dashboard/analytics", icon: BarChart3 },
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const checkUserRoles = async () => {
      if (!user?.id) return;
      
      // Always verify admin role via database - no client-side whitelist
      const { data: adminData } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      
      if (adminData) {
        setIsAdmin(true);
      }

      // Check if client (has organization)
      const { data: clientData } = await supabase
        .from('client_users')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (clientData?.organization_id) {
        setIsClient(true);
      }
    };
    
    checkUserRoles();
  }, [user?.id]);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const adminNavItems = [
    { name: "Contacts", href: "/dashboard/contacts", icon: Inbox },
    { name: "Import Leads", href: "/admin/import", icon: Upload },
  ];

  const adminScraperItems = [
    { name: "Scrape Jobs", href: "/admin/scrape-jobs", icon: Globe },
    { name: "Scraped Leads", href: "/admin/scraped-leads", icon: Users },
    { name: "Schema Templates", href: "/admin/schema-templates", icon: FileText },
    { name: "Client Orgs", href: "/admin/clients", icon: Inbox },
    { name: "API Settings", href: "/admin/api-settings", icon: Key },
  ];

  const clientNavItems = [
    { name: "My Leads", href: "/client/leads", icon: Briefcase },
  ];

  const allNavItems = [
    ...navItems,
    ...(isAdmin ? adminNavItems : []),
    ...(isClient && !isAdmin ? clientNavItems : []),
  ];

  const allAdminScraperItems = isAdmin ? adminScraperItems : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-card border-r border-border transform transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-20 px-6 border-b border-border">
            <Link to="/" className="flex items-center">
              <img src={brivanoLogo} alt="Brivano" className="h-16 w-auto" />
            </Link>
            <button
              className="lg:hidden text-muted-foreground"
              onClick={() => setSidebarOpen(false)}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
            {allNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}
                  onClick={() => setSidebarOpen(false)}
                >
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.name}</span>
                </Link>
              );
            })}

            {/* Admin Scraper Section */}
            {allAdminScraperItems.length > 0 && (
              <>
                <div className="pt-4 pb-2">
                  <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    Admin Scraper
                  </p>
                </div>
                {allAdminScraperItems.map((item) => {
                  const isActive = location.pathname === item.href;
                  return (
                    <Link
                      key={item.name}
                      to={item.href}
                      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        isActive
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.name}</span>
                    </Link>
                  );
                })}
              </>
            )}
          </nav>

          {/* User section */}
          <div className="p-4 border-t border-border">
            <div className="flex items-center gap-3 px-3 py-2 mb-2">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-sm font-medium text-primary">
                  {user?.email?.[0].toUpperCase()}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.email}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              className="w-full justify-start text-muted-foreground hover:text-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign out
            </Button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 bg-background/80 backdrop-blur-xl border-b border-border">
          <div className="flex items-center justify-between h-full px-4 lg:px-8">
            <button
              className="lg:hidden p-2 text-muted-foreground"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex-1" />
            <ThemeToggle />
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-8">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
