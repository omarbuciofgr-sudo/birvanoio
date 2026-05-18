import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Building2,
  Globe,
  Linkedin,
  Mail,
  Phone,
  MapPin,
  Users,
  DollarSign,
  Calendar,
  Briefcase,
  ExternalLink,
  Twitter,
  Facebook,
  Instagram,
  Youtube,
  Github,
  Play,
  Loader2,
  CheckCircle2,
  Copy,
} from 'lucide-react';
import type { CompanyResult } from '@/lib/api/industrySearch';
import { toast } from 'sonner';

interface EnrichmentResult {
  email?: string | null;
  phone?: string | null;
  contact_name?: string | null;
  linkedin_url?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  company: CompanyResult | null;
  enrichmentTarget?: 'company' | 'person';
  enrichment?: EnrichmentResult;
  enrichmentStatus?: 'idle' | 'loading' | 'done' | 'error';
  onEnrich?: () => void;
}

function copy(value: string, label: string) {
  navigator.clipboard.writeText(value).then(
    () => toast.success(`${label} copied`),
    () => toast.error('Copy failed'),
  );
}

export function CompanyDetailSheet({
  open,
  onOpenChange,
  company,
  enrichmentTarget = 'company',
  enrichment,
  enrichmentStatus = 'idle',
  onEnrich,
}: Props) {
  if (!company) return null;

  const website = company.website || (company.domain ? `https://${company.domain}` : null);
  const location = [company.headquarters_city, company.headquarters_state, company.headquarters_country]
    .filter(Boolean)
    .join(', ');

  const initial = (company.name || '?').charAt(0).toUpperCase();
  const isPerson = enrichmentTarget === 'person';

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
        {/* Header */}
        <div className="px-6 pt-6 pb-4 border-b border-border/60">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
              <span className="text-lg font-semibold text-primary">{initial}</span>
            </div>
            <div className="flex-1 min-w-0">
              <SheetHeader className="text-left space-y-1">
                <SheetTitle className="text-base leading-tight">{company.name}</SheetTitle>
                {company.industry && (
                  <SheetDescription className="text-xs">{company.industry}</SheetDescription>
                )}
              </SheetHeader>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {company.employee_range && (
                  <Badge variant="outline" className="text-[10px] h-5">{company.employee_range}</Badge>
                )}
                {company.founded_year && (
                  <Badge variant="outline" className="text-[10px] h-5">Founded {company.founded_year}</Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-6 py-4 space-y-5">
          {/* Contact info (from enrichment) */}
          {(enrichment || onEnrich) && (
            <section>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                {isPerson ? 'Contact info' : 'Decision maker'}
              </h4>
              {enrichmentStatus === 'done' && enrichment ? (
                <div className="space-y-2">
                  {enrichment.contact_name && (
                    <DetailRow icon={<CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />} label="Name" value={enrichment.contact_name} />
                  )}
                  {enrichment.email && (
                    <DetailRow icon={<Mail className="h-3.5 w-3.5" />} label="Email" value={enrichment.email} copyable />
                  )}
                  {enrichment.phone && (
                    <DetailRow icon={<Phone className="h-3.5 w-3.5" />} label="Phone" value={enrichment.phone} copyable />
                  )}
                  {enrichment.linkedin_url && (
                    <DetailRow
                      icon={<Linkedin className="h-3.5 w-3.5" />}
                      label="LinkedIn"
                      value={enrichment.linkedin_url}
                      href={enrichment.linkedin_url}
                    />
                  )}
                </div>
              ) : enrichmentStatus === 'loading' ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enriching…
                </div>
              ) : (
                <Button size="sm" variant="outline" onClick={onEnrich} className="h-8 text-xs gap-1.5 w-full">
                  <Play className="h-3 w-3" /> Run enrichment
                </Button>
              )}
            </section>
          )}

          {(enrichment || onEnrich) && <Separator />}

          {/* People preview parity: same employer + profile URL as SearchResults table */}
          {isPerson && (
            <section className="space-y-2">
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">
                Employer & profile
              </h4>
              <ol className="text-[10px] text-muted-foreground space-y-1 mb-2 list-decimal list-inside leading-relaxed">
                <li>Check employer and LinkedIn match the row (empty means Apollo did not return them).</li>
                <li>Use Resolve domains / Industry / Email / Phone in the preview footer to enrich; or run single-row enrichment below.</li>
              </ol>
              <DetailRow
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Employer"
                value={(company.organization_name || '').trim() || '—'}
              />
              {company.linkedin_url ? (
                <DetailRow
                  icon={<Linkedin className="h-3.5 w-3.5" />}
                  label="LinkedIn"
                  value={
                    company.linkedin_url.length > 48
                      ? `${company.linkedin_url.slice(0, 45)}…`
                      : company.linkedin_url
                  }
                  href={company.linkedin_url}
                />
              ) : (
                <DetailRow icon={<Linkedin className="h-3.5 w-3.5" />} label="LinkedIn" value="—" />
              )}
            </section>
          )}

          {isPerson && <Separator />}

          {/* Company details */}
          <section className="space-y-2">
            <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2.5">Company</h4>
            {website && (
              <DetailRow
                icon={<Globe className="h-3.5 w-3.5" />}
                label="Website"
                value={company.domain || website}
                href={website}
              />
            )}
            {location && (
              <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={location} />
            )}
            {(company.employee_count || company.employee_range) && (
              <DetailRow
                icon={<Users className="h-3.5 w-3.5" />}
                label="Employees"
                value={company.employee_range || company.employee_count?.toLocaleString() || '—'}
              />
            )}
            {company.annual_revenue && (
              <DetailRow
                icon={<DollarSign className="h-3.5 w-3.5" />}
                label="Revenue"
                value={`$${Number(company.annual_revenue).toLocaleString()}`}
              />
            )}
            {company.founded_year && (
              <DetailRow icon={<Calendar className="h-3.5 w-3.5" />} label="Founded" value={String(company.founded_year)} />
            )}
            {company.industry && (
              <DetailRow icon={<Briefcase className="h-3.5 w-3.5" />} label="Industry" value={company.industry} />
            )}
          </section>

          {company.description && (
            <>
              <Separator />
              <section>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">About</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">{company.description}</p>
              </section>
            </>
          )}

          {company.technologies && company.technologies.length > 0 && (
            <>
              <Separator />
              <section>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Technologies</h4>
                <div className="flex flex-wrap gap-1.5">
                  {company.technologies.slice(0, 24).map((t, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px] h-5 font-normal">{t}</Badge>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Social links (person LinkedIn is under Employer & profile) */}
          {((!isPerson && company.linkedin_url) || company.social_profiles) && (
            <>
              <Separator />
              <section>
                <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Links</h4>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {!isPerson && company.linkedin_url && (
                    <SocialLink href={company.linkedin_url} icon={<Linkedin className="h-3.5 w-3.5" />} label="LinkedIn" />
                  )}
                  {company.social_profiles?.twitter && <SocialLink href={company.social_profiles.twitter} icon={<Twitter className="h-3.5 w-3.5" />} label="Twitter" />}
                  {company.social_profiles?.facebook && <SocialLink href={company.social_profiles.facebook} icon={<Facebook className="h-3.5 w-3.5" />} label="Facebook" />}
                  {company.social_profiles?.instagram && <SocialLink href={company.social_profiles.instagram} icon={<Instagram className="h-3.5 w-3.5" />} label="Instagram" />}
                  {company.social_profiles?.youtube && <SocialLink href={company.social_profiles.youtube} icon={<Youtube className="h-3.5 w-3.5" />} label="YouTube" />}
                  {company.social_profiles?.github && <SocialLink href={company.social_profiles.github} icon={<Github className="h-3.5 w-3.5" />} label="GitHub" />}
                </div>
              </section>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({
  icon,
  label,
  value,
  href,
  copyable,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href?: string;
  copyable?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 group">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">{label}</p>
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs text-foreground hover:text-primary truncate block flex items-center gap-1">
            <span className="truncate">{value}</span>
            <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-60" />
          </a>
        ) : (
          <p className="text-xs text-foreground break-words">{value}</p>
        )}
      </div>
      {copyable && (
        <button
          onClick={() => copy(value, label)}
          className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-foreground"
          title={`Copy ${label}`}
        >
          <Copy className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

function SocialLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors border border-border/60"
      title={label}
    >
      {icon}
    </a>
  );
}
