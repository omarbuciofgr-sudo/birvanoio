import { NavLink } from "react-router-dom";
import { Mail, Workflow, FileText } from "lucide-react";

const tabs = [
  { label: "Campaigns", href: "/dashboard/campaigns", icon: Mail },
  { label: "Sequences", href: "/dashboard/sequences", icon: Workflow },
  { label: "Templates", href: "/dashboard/templates", icon: FileText },
];

export function OutreachTabs() {
  return (
    <div className="mb-5 overflow-x-auto border-b border-border">
      <div className="flex min-w-max items-center gap-1" aria-label="Outreach sections">
        {tabs.map(({ label, href, icon: Icon }) => (
          <NavLink
            key={href}
            to={href}
            className={({ isActive }) =>
              `inline-flex min-h-11 items-center gap-2 border-b-2 px-3 text-sm font-medium transition-colors md:min-h-9 ${
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