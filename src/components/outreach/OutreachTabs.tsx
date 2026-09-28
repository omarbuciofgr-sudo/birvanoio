import { NavLink } from "react-router-dom";
import { Mail, Workflow, FileText } from "lucide-react";

const tabs = [
  { label: "Campaigns", href: "/dashboard/campaigns", icon: Mail },
  { label: "Sequences", href: "/dashboard/sequences", icon: Workflow },
  { label: "Templates", href: "/dashboard/templates", icon: FileText },
];

export function OutreachTabs() {
  return (
    <div className="mb-5 border-b border-border">
      <div className="flex items-center gap-1" aria-label="Outreach sections">
        {tabs.map(({ label, href, icon: Icon }) => (
          <NavLink
            key={href}
            to={href}
            className={({ isActive }) =>
              `inline-flex h-9 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}