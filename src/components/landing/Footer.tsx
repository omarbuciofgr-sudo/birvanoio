import { Link } from "react-router-dom";
import { Instagram, Linkedin, Twitter, Mail, Phone } from "lucide-react";
import brivanoLogo from "@/assets/logo-min-4.png";

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="py-12 border-t border-border">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center mb-3">
              <img src={brivanoLogo} alt="Brivano" className="h-8 w-auto dark:brightness-0 dark:invert" style={{ mixBlendMode: 'multiply' }} />
            </Link>
            <p className="text-sm text-muted-foreground max-w-xs">
              AI-powered lead generation. Fresh, verified data for any niche, any market.
            </p>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold text-foreground mb-3">Links</h4>
            <ul className="space-y-2">
              {["Services", "Pricing", "About"].map((name) => (
                <li key={name}>
                  <a href={`#${name.toLowerCase()}`} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="font-display text-sm font-semibold text-foreground mb-3">Contact</h4>
            <ul className="space-y-2 mb-4">
              <li>
                <a href="mailto:info@brivano.io" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Mail className="w-3.5 h-3.5" /> info@brivano.io
                </a>
              </li>
              <li>
                <a href="tel:8723070387" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <Phone className="w-3.5 h-3.5" /> (872) 307-0387
                </a>
              </li>
            </ul>
            <div className="flex gap-2">
              {[
                { icon: Instagram, href: "https://www.instagram.com/brivano.io/" },
                { icon: Linkedin, href: "https://www.linkedin.com/company/brivano-io/" },
                { icon: Twitter, href: "https://x.com/brivanoio" },
              ].map(({ icon: Icon, href }) => (
                <a key={href} href={href} target="_blank" rel="noopener noreferrer" className="w-8 h-8 rounded-lg border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors">
                  <Icon className="w-3.5 h-3.5" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col sm:flex-row justify-between items-center gap-3">
          <p className="text-xs text-muted-foreground">© {currentYear} Brivano. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Privacy</a>
            <a href="#" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
