import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  Mail,
  Bot,
  FileText,
  Inbox,
  Globe,
  Key,
  Briefcase,
  ClipboardList,
  Upload,
  ChevronLeft,
  Bell,
  Search,
  Command,
} from "lucide-react";
import brivanoLogo from "@/assets/logo-min-4.png";
import AIDashboardChat from "@/components/dashboard/AIDashboardChat";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const navSections = [
  {
    label: "Core",
    items: [
      { name: "Overview", href: "/dashboard", icon: LayoutDashboard },
      { name: "Leads", href: "/dashboard/leads", icon: Users },
      { name: "Campaigns", href: "/dashboard/campaigns", icon: Mail },
    ],
  },
  {
    label: "Tools",
    items: [
      { name: "Web Scraper", href: "/dashboard/scraper", icon: Globe },
      { name: "Voice Agent", href: "/dashboard/voice-agent", icon: Bot },
      { name: "Templates", href: "/dashboard/templates", icon: FileText },
    ],
  },
  {
    label: "Insights",
    items: [
      { name: "Reports", href: "/dashboard/reports", icon: ClipboardList },
      { name: "Settings", href: "/dashboard/settings", icon: Settings },
    ],
  },
];

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isClient, setIsClient] = useState(false);
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const checkUserRoles = async () => {
      if (!user?.id) return;
      const { data: adminData } = await supabase.rpc('has_role', {
        _user_id: user.id,
        _role: 'admin'
      });
      if (adminData) setIsAdmin(true);

      const { data: clientData } = await supabase
        .from('client_users')
        .select('organization_id')
        .eq('user_id', user.id)
        .maybeSingle();
      if (clientData?.organization_id) setIsClient(true);
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

  const sidebarWidth = sidebarCollapsed ? "w-[68px]" : "w-64";

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full ${sidebarWidth} bg-card border-r border-border/60 transform transition-all duration-200 ease-out lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-14 px-4 border-b border-border/60">
            <Link to="/" className="flex items-center">
              {sidebarCollapsed ? (
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary">B</span>
                </div>
              ) : (
                <>
                  <img src={brivanoLogo} alt="Brivano" className="h-20 w-auto mix-blend-multiply dark:hidden" />
                  <span className="hidden dark:inline text-xl font-semibold tracking-tight font-display text-foreground">brivano</span>
                </>
              )}
            </Link>
            <div className="flex items-center gap-1">
              <button
                className="hidden lg:flex h-7 w-7 items-center justify-center rounded-md hover:bg-muted text-muted-foreground transition-colors"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              >
                <ChevronLeft className={`w-3.5 h-3.5 transition-transform ${sidebarCollapsed ? 'rotate-180' : ''}`} />
              </button>
              <button
                className="lg:hidden h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted text-muted-foreground"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-5 overflow-y-auto">
            {navSections.map((section) => (
              <div key={section.label}>
                {!sidebarCollapsed && (
                  <p className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                    {section.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group relative ${
                          isActive
                            ? "bg-primary/[0.08] text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                        onClick={() => setSidebarOpen(false)}
                        title={sidebarCollapsed ? item.name : undefined}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />
                        )}
                        <item.icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? '' : 'group-hover:text-foreground'}`} />
                        {!sidebarCollapsed && (
                          <span className="text-[13px]">{item.name}</span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Admin items */}
            {isAdmin && (
              <div>
                {!sidebarCollapsed && (
                  <p className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                    Admin
                  </p>
                )}
                <div className="space-y-0.5">
                  {[...adminNavItems, ...adminScraperItems].map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group relative ${
                          isActive
                            ? "bg-primary/[0.08] text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                        onClick={() => setSidebarOpen(false)}
                        title={sidebarCollapsed ? item.name : undefined}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />
                        )}
                        <item.icon className={`w-[18px] h-[18px] shrink-0`} />
                        {!sidebarCollapsed && <span className="text-[13px]">{item.name}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Client items */}
            {isClient && !isAdmin && (
              <div>
                {!sidebarCollapsed && (
                  <p className="px-3 mb-2 text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-[0.12em]">
                    Client
                  </p>
                )}
                <div className="space-y-0.5">
                  {clientNavItems.map((item) => {
                    const isActive = location.pathname === item.href;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all duration-150 group relative ${
                          isActive
                            ? "bg-primary/[0.08] text-primary font-medium"
                            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                        } ${sidebarCollapsed ? 'justify-center px-0' : ''}`}
                        onClick={() => setSidebarOpen(false)}
                        title={sidebarCollapsed ? item.name : undefined}
                      >
                        {isActive && (
                          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r-full bg-primary" />
                        )}
                        <item.icon className={`w-[18px] h-[18px] shrink-0`} />
                        {!sidebarCollapsed && <span className="text-[13px]">{item.name}</span>}
                      </Link>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          {/* User section */}
          <div className="p-3 border-t border-border/60">
            {!sidebarCollapsed ? (
              <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                  <span className="text-xs font-semibold text-primary">
                    {user?.email?.[0].toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {user?.email?.split('@')[0]}
                  </p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
                <button
                  onClick={handleSignOut}
                  className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                  title="Sign out"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={handleSignOut}
                className="w-full h-9 rounded-md flex items-center justify-center hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                title="Sign out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className={`transition-all duration-200 ${sidebarCollapsed ? 'lg:pl-[68px]' : 'lg:pl-64'}`}>
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-14 bg-background/80 backdrop-blur-xl border-b border-border/60">
          <div className="flex items-center justify-between h-full px-4 lg:px-6">
            <div className="flex items-center gap-3">
              <button
                className="lg:hidden p-2 -ml-2 text-muted-foreground hover:text-foreground rounded-md hover:bg-muted transition-colors"
                onClick={() => setSidebarOpen(true)}
              >
                <Menu className="w-5 h-5" />
              </button>
              {/* Breadcrumb-style page title */}
              <div className="hidden sm:flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">Brivano</span>
                <span className="text-muted-foreground/40">/</span>
                <span className="font-medium text-foreground">
                  {navSections.flatMap(s => s.items).find(i => location.pathname === i.href)?.name || 
                   (location.pathname.includes('admin') ? 'Admin' : 'Dashboard')}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <ThemeToggle />
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 lg:p-6 max-w-[1600px] mx-auto">{children}</main>
      </div>

      {/* AI Chat Assistant */}
      <AIDashboardChat />
    </div>
  );
};

export default DashboardLayout;
