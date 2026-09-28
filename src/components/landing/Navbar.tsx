import * as React from "react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronDown, Menu, X } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { BrivanoLogo } from "@/components/BrivanoLogo";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

const Navbar = React.forwardRef<HTMLElement>(function Navbar(_props, ref) {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  const navLinks = [
    { name: "AI Features", href: "#services" },
    { name: "How It Works", href: "#how-it-works" },
  ];

  const scrollToSection = (href: string) => {
    setIsOpen(false);
    const element = document.querySelector(href);
    element?.scrollIntoView({ behavior: "smooth" });
  };

  return (
    <nav ref={ref} className="fixed top-0 left-0 right-0 z-50 bg-background/90 backdrop-blur-lg border-b border-border/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <Link to="/" className="flex items-center">
            <BrivanoLogo className="h-28" />
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-1 px-0 text-sm font-normal text-muted-foreground hover:bg-transparent hover:text-foreground">
                  Who we help <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem asChild><Link to="/who-we-help/agents">Real Estate Agents</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/who-we-help/property-managers">Property Managers</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link to="/who-we-help/investors">Investors</Link></DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => scrollToSection(link.href)}
                className="text-muted-foreground hover:text-foreground transition-colors text-sm"
              >
                {link.name}
              </button>
            ))}
          </div>

          <div className="hidden md:flex items-center gap-2">
            <ThemeToggle />
            <Button
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => navigate("/auth")}
            >
              Sign In
            </Button>
            <Button
              size="sm"
              className="bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={() => navigate("/auth")}
            >
              Start Free
            </Button>
          </div>

          <div className="md:hidden flex items-center gap-2">
            <ThemeToggle />
            <button
              className="p-2 text-muted-foreground"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {isOpen && (
        <div className="md:hidden bg-background border-b border-border">
          <div className="px-4 py-4 space-y-3">
            {navLinks.map((link) => (
              <button
                key={link.name}
                onClick={() => scrollToSection(link.href)}
                className="block text-muted-foreground hover:text-foreground text-sm"
              >
                {link.name}
              </button>
            ))}
            <div className="space-y-2 border-t border-border pt-3">
              <p className="text-xs font-medium text-foreground">Who we help</p>
              <Link className="block text-sm text-muted-foreground" to="/who-we-help/agents" onClick={() => setIsOpen(false)}>Real Estate Agents</Link>
              <Link className="block text-sm text-muted-foreground" to="/who-we-help/property-managers" onClick={() => setIsOpen(false)}>Property Managers</Link>
              <Link className="block text-sm text-muted-foreground" to="/who-we-help/investors" onClick={() => setIsOpen(false)}>Investors</Link>
            </div>
            <div className="pt-3 space-y-2 border-t border-border">
              <Button
                variant="ghost"
                size="sm"
                className="w-full justify-start text-muted-foreground"
                onClick={() => navigate("/auth")}
              >
                Sign In
              </Button>
              <Button
                size="sm"
                className="w-full bg-primary text-primary-foreground"
                onClick={() => navigate("/auth")}
              >
                Start Free
              </Button>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
});

Navbar.displayName = "Navbar";

export default Navbar;
