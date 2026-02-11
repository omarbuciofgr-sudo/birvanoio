import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, Mail, Phone, Globe, User, Building, MapPin, Linkedin, Check, X, AlertCircle, Cpu, Star, MessageSquareText, Radar, TrendingUp, Fingerprint } from 'lucide-react';
import { ScrapedLead } from '@/types/scraper';
import { FieldEvidencePanel } from './FieldEvidencePanel';

interface LeadDetailSheetProps {
  lead: ScrapedLead | null;
  onClose: () => void;
}

const ValidationBadge = ({ status }: { status: string | undefined }) => {
  if (!status || status === 'unverified') return <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">Unverified</span>;
  if (status === 'verified') return <span className="text-[10px] text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-0.5"><Check className="h-2.5 w-2.5" />Verified</span>;
  if (status === 'likely_valid') return <span className="text-[10px] text-amber-600 bg-amber-500/10 px-1.5 py-0.5 rounded">Likely Valid</span>;
  return <span className="text-[10px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded flex items-center gap-0.5"><X className="h-2.5 w-2.5" />Invalid</span>;
};

const Section = ({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</h3>
    </div>
    {children}
  </div>
);

const InfoRow = ({ label, value, href, icon: Icon }: { label: string; value: string | null | undefined; href?: string; icon?: any }) => {
  if (!value) return null;
  return (
    <div className="flex items-start justify-between gap-2 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" className="text-xs font-medium text-primary hover:underline text-right truncate max-w-[60%] flex items-center gap-1">
          {value} <ExternalLink className="h-2.5 w-2.5 shrink-0" />
        </a>
      ) : (
        <span className="text-xs font-medium text-foreground text-right truncate max-w-[60%]">{value}</span>
      )}
    </div>
  );
};

export function LeadDetailSheet({ lead, onClose }: LeadDetailSheetProps) {
  if (!lead) return null;

  const schemaData = (lead.schema_data || {}) as Record<string, any>;
  const schemaEvidence = (lead.schema_evidence || {}) as Record<string, string>;
  const enrichmentData = (lead.enrichment_data || {}) as Record<string, any>;

  const technologies = enrichmentData.technologies as string[] || schemaData.technologies as string[] || [];
  const revenueEstimate = enrichmentData.revenue_estimate as string || schemaData.revenue_estimate as string || null;
  const reviewSentiment = schemaData.google_places?.review_sentiment as Record<string, any> || null;
  const competitorSignals = schemaData.competitor_signals as Record<string, any> || null;
  const hiringSignals = enrichmentData.hiring_signals || schemaData.hiring_signals || null;

  const confidenceColor = lead.confidence_score >= 80 ? 'text-emerald-600 bg-emerald-500/10' :
    lead.confidence_score >= 50 ? 'text-amber-600 bg-amber-500/10' : 'text-destructive bg-destructive/10';

  // Build full address
  const street = lead.address || schemaData.address || schemaData.full_address || '';
  const city = schemaData.city || '';
  const state = schemaData.state || '';
  const zip = schemaData.zip || schemaData.zip_code || '';
  const fullAddress = [street, city, state, zip].filter(Boolean).join(', ');

  return (
    <Sheet open={!!lead} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-md p-0 border-l border-border">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-border bg-muted/30">
          <SheetHeader className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <SheetTitle className="text-base font-semibold truncate">{lead.domain}</SheetTitle>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  Scraped {new Date(lead.scraped_at).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Badge variant="outline" className="text-[10px] h-5 capitalize">
                  {lead.status.replace('_', ' ')}
                </Badge>
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${confidenceColor}`}>
                  {lead.confidence_score}%
                </span>
              </div>
            </div>
          </SheetHeader>

          {/* QC Flag */}
          {lead.qc_flag && (
            <div className="mt-3 p-2.5 rounded-md bg-destructive/5 border border-destructive/15">
              <div className="flex items-center gap-1.5 text-destructive text-xs font-medium">
                <AlertCircle className="h-3 w-3" />
                {lead.qc_flag}
              </div>
              {lead.qc_notes && (
                <p className="text-[11px] text-muted-foreground mt-1 ml-[18px]">{lead.qc_notes}</p>
              )}
            </div>
          )}
        </div>

        <ScrollArea className="h-[calc(100vh-140px)]">
          <div className="px-5 py-5 space-y-6">

            {/* Contact */}
            <Section title="Contact" icon={User}>
              <div className="rounded-lg border border-border bg-card overflow-hidden divide-y divide-border">
                {/* Name */}
                <div className="px-3.5 py-2.5">
                  <p className="text-[10px] text-muted-foreground mb-0.5">Name</p>
                  <p className="text-sm font-medium">{lead.full_name || 'Not found'}</p>
                  {lead.best_contact_title && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">{lead.best_contact_title}</p>
                  )}
                </div>

                {/* Email */}
                <div className="px-3.5 py-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[10px] text-muted-foreground">Email</p>
                    <ValidationBadge status={lead.email_validation_status} />
                  </div>
                  {lead.best_email ? (
                    <a href={`mailto:${lead.best_email}`} className="text-sm font-medium text-primary hover:underline">
                      {lead.best_email}
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not found</p>
                  )}
                  {lead.all_emails.length > 1 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {lead.all_emails.filter(e => e !== lead.best_email).map((email, i) => (
                        <span key={i} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{email}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Phone */}
                <div className="px-3.5 py-2.5">
                  <div className="flex items-center justify-between mb-0.5">
                    <p className="text-[10px] text-muted-foreground">Phone</p>
                    <div className="flex items-center gap-1">
                      {lead.phone_line_type && (
                        <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{lead.phone_line_type}</span>
                      )}
                      <ValidationBadge status={lead.phone_validation_status} />
                    </div>
                  </div>
                  {lead.best_phone ? (
                    <a href={`tel:${lead.best_phone}`} className="text-sm font-medium text-primary hover:underline">
                      {lead.best_phone}
                    </a>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not found</p>
                  )}
                  {lead.all_phones.length > 1 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {lead.all_phones.filter(p => p !== lead.best_phone).map((phone, i) => (
                        <span key={i} className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{phone}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Links */}
                {(lead.contact_form_url || lead.linkedin_search_url) && (
                  <div className="px-3.5 py-2.5 flex items-center gap-3">
                    {lead.contact_form_url && (
                      <a href={lead.contact_form_url} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-primary hover:underline flex items-center gap-1">
                        <Globe className="h-3 w-3" /> Contact Form
                      </a>
                    )}
                    {lead.linkedin_search_url && (
                      <a href={lead.linkedin_search_url} target="_blank" rel="noopener noreferrer"
                        className="text-[11px] text-primary hover:underline flex items-center gap-1">
                        <Linkedin className="h-3 w-3" /> LinkedIn
                      </a>
                    )}
                  </div>
                )}
              </div>
            </Section>

            {/* Location */}
            {fullAddress && (
              <Section title="Location" icon={MapPin}>
                <div className="rounded-lg border border-border bg-card px-3.5 py-2.5">
                  <p className="text-sm">{fullAddress}</p>
                </div>
              </Section>
            )}

            {/* Tech Stack */}
            {technologies.length > 0 && (
              <Section title="Tech Stack" icon={Cpu}>
                <div className="flex flex-wrap gap-1">
                  {technologies.map((tech, i) => (
                    <span key={i} className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-1 rounded-md">{tech}</span>
                  ))}
                </div>
                {revenueEstimate && (
                  <div className="flex items-center gap-2 text-xs mt-2">
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">Est. Revenue:</span>
                    <span className="font-medium">{revenueEstimate}</span>
                  </div>
                )}
              </Section>
            )}

            {/* Review Intelligence */}
            {reviewSentiment && (
              <Section title="Reviews" icon={MessageSquareText}>
                <div className="rounded-lg border border-border bg-card px-3.5 py-3 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded capitalize ${
                      reviewSentiment.overall_sentiment === 'positive' ? 'bg-emerald-500/10 text-emerald-600' :
                      reviewSentiment.overall_sentiment === 'negative' ? 'bg-destructive/10 text-destructive' :
                      'bg-amber-500/10 text-amber-600'
                    }`}>
                      {reviewSentiment.overall_sentiment}
                    </span>
                    {reviewSentiment.avg_rating && (
                      <span className="flex items-center gap-0.5 text-xs">
                        <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                        {reviewSentiment.avg_rating} ({reviewSentiment.review_count})
                      </span>
                    )}
                  </div>
                  {reviewSentiment.pain_points?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Pain Points</p>
                      {reviewSentiment.pain_points.map((p: string, i: number) => (
                        <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">• {p}</p>
                      ))}
                    </div>
                  )}
                  {reviewSentiment.outreach_hooks?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Outreach Hooks</p>
                      {reviewSentiment.outreach_hooks.map((h: string, i: number) => (
                        <p key={i} className="text-[11px] text-muted-foreground leading-relaxed">💡 {h}</p>
                      ))}
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Market Signals */}
            {(competitorSignals || hiringSignals) && (
              <Section title="Market Signals" icon={Radar}>
                <div className="rounded-lg border border-border bg-card px-3.5 py-3 space-y-2">
                  {hiringSignals && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[10px] font-medium bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded">Hiring</span>
                      <span className="text-muted-foreground">
                        ~{typeof hiringSignals === 'object' ? hiringSignals.job_count_estimate || 0 : 0} open roles
                      </span>
                    </div>
                  )}
                  {competitorSignals?.competitor_mentions?.length > 0 && (
                    <div>
                      <p className="text-[10px] font-medium text-muted-foreground mb-1">Competitors</p>
                      <div className="flex flex-wrap gap-1">
                        {competitorSignals.competitor_mentions.map((c: string, i: number) => (
                          <span key={i} className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{c}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </Section>
            )}

            {/* Schema Data */}
            {Object.keys(schemaData).filter(k => !['google_places', 'technologies', 'competitor_signals', 'hiring_signals', 'revenue_estimate', 'address', 'full_address', 'city', 'state', 'zip', 'zip_code'].includes(k)).length > 0 && (
              <Section title="Additional Data" icon={Building}>
                <div className="rounded-lg border border-border bg-card px-3.5 py-1 divide-y divide-border">
                  {Object.entries(schemaData).map(([key, value]) => {
                    if (['google_places', 'technologies', 'competitor_signals', 'hiring_signals', 'revenue_estimate', 'address', 'full_address', 'city', 'state', 'zip', 'zip_code'].includes(key)) return null;
                    const displayValue = Array.isArray(value) ? value.join(', ') : String(value);
                    return (
                      <InfoRow
                        key={key}
                        label={key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                        value={displayValue}
                        href={schemaEvidence[key]}
                      />
                    );
                  })}
                </div>
              </Section>
            )}

            {/* Evidence */}
            <Section title="Field Evidence" icon={Fingerprint}>
              <FieldEvidencePanel leadId={lead.id} />
            </Section>

            {/* Enrichment Sources */}
            {lead.enrichment_providers_used.length > 0 && (
              <Section title="Enrichment Sources" icon={Cpu}>
                <div className="flex flex-wrap gap-1">
                  {lead.enrichment_providers_used.map((provider, i) => (
                    <span key={i} className="text-[10px] font-medium bg-muted text-muted-foreground px-2 py-1 rounded-md">
                      {provider.toLowerCase() === 'tracerfy' ? 'Tracerfy → BatchData' : provider}
                    </span>
                  ))}
                </div>
              </Section>
            )}

            {/* Assignment */}
            {lead.assigned_organization && (
              <Section title="Assignment" icon={Building}>
                <div className="rounded-lg border border-border bg-card px-3.5 py-2.5">
                  <p className="text-sm font-medium">{lead.assigned_organization.name}</p>
                  {lead.assigned_at && (
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Assigned {new Date(lead.assigned_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </Section>
            )}

            {/* Source */}
            {lead.source_url && (
              <Section title="Source" icon={Globe}>
                <a href={lead.source_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline flex items-center gap-1 break-all">
                  {lead.source_url} <ExternalLink className="h-3 w-3 shrink-0" />
                </a>
              </Section>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
