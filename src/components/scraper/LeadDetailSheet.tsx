import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ExternalLink, Mail, Phone, Globe, User, Building, MapPin, Linkedin, Check, X, AlertCircle, Cpu, Star, MessageSquareText, Radar, TrendingUp } from 'lucide-react';
import { ScrapedLead } from '@/types/scraper';

interface LeadDetailSheetProps {
  lead: ScrapedLead | null;
  onClose: () => void;
}

const validationBadge = (status: string | undefined) => {
  if (!status || status === 'unverified') {
    return <Badge variant="outline" className="bg-muted">Unverified</Badge>;
  }
  if (status === 'verified') {
    return <Badge className="bg-green-500/20 text-green-600"><Check className="h-3 w-3 mr-1" /> Verified</Badge>;
  }
  if (status === 'likely_valid') {
    return <Badge className="bg-yellow-500/20 text-yellow-600">Likely Valid</Badge>;
  }
  return <Badge className="bg-destructive/20 text-destructive"><X className="h-3 w-3 mr-1" /> Invalid</Badge>;
};

export function LeadDetailSheet({ lead, onClose }: LeadDetailSheetProps) {
  if (!lead) return null;

  const schemaData = (lead.schema_data || {}) as Record<string, any>;
  const schemaEvidence = (lead.schema_evidence || {}) as Record<string, string>;
  const enrichmentData = (lead.enrichment_data || {}) as Record<string, any>;

  // Extract advanced enrichment data from schema_data and enrichment_data
  const technologies = enrichmentData.technologies as string[] || schemaData.technologies as string[] || [];
  const revenueEstimate = enrichmentData.revenue_estimate as string || schemaData.revenue_estimate as string || null;
  const reviewSentiment = schemaData.google_places?.review_sentiment as Record<string, any> || null;
  const competitorSignals = schemaData.competitor_signals as Record<string, any> || null;
  const hiringSignals = enrichmentData.hiring_signals || schemaData.hiring_signals || null;

  return (
    <Sheet open={!!lead} onOpenChange={() => onClose()}>
      <SheetContent className="w-full sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            {lead.domain}
          </SheetTitle>
          <SheetDescription>
            Scraped on {new Date(lead.scraped_at).toLocaleDateString()}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-6 pr-4">
          <div className="space-y-6">
            {/* Status & Confidence */}
            <div className="flex items-center justify-between">
              <Badge variant="outline" className="text-sm">
                {lead.status.replace('_', ' ')}
              </Badge>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Confidence:</span>
                <Badge className={
                  lead.confidence_score >= 80 ? 'bg-green-500/20 text-green-600' :
                  lead.confidence_score >= 50 ? 'bg-yellow-500/20 text-yellow-600' :
                  'bg-destructive/20 text-destructive'
                }>
                  {lead.confidence_score}%
                </Badge>
              </div>
            </div>

            {/* QC Flag */}
            {lead.qc_flag && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20">
                <div className="flex items-center gap-2 text-destructive">
                  <AlertCircle className="h-4 w-4" />
                  <span className="font-medium">{lead.qc_flag}</span>
                </div>
                {lead.qc_notes && (
                  <p className="text-sm text-muted-foreground mt-1">{lead.qc_notes}</p>
                )}
              </div>
            )}

            <Separator />

            {/* Contact Information */}
            <div className="space-y-4">
              <h3 className="font-semibold">Contact Information</h3>

              {/* Full Name */}
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{lead.full_name || 'Not found'}</span>
                </div>
                {lead.name_source_url && (
                  <a
                    href={lead.name_source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:underline flex items-center gap-1 ml-6"
                  >
                    Source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {/* Email */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{lead.best_email || 'Not found'}</span>
                  {validationBadge(lead.email_validation_status)}
                </div>
                {lead.email_validation_notes && (
                  <p className="text-xs text-muted-foreground ml-6">{lead.email_validation_notes}</p>
                )}
                {lead.email_source_url && (
                  <a
                    href={lead.email_source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:underline flex items-center gap-1 ml-6"
                  >
                    Source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {lead.all_emails.length > 1 && (
                  <div className="ml-6 space-y-1">
                    <p className="text-xs text-muted-foreground">All emails found:</p>
                    {lead.all_emails.map((email, i) => (
                      <Badge key={i} variant="outline" className="mr-1">{email}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{lead.best_phone || 'Not found'}</span>
                  {validationBadge(lead.phone_validation_status)}
                  {lead.phone_line_type && (
                    <Badge variant="outline" className="text-xs">{lead.phone_line_type}</Badge>
                  )}
                </div>
                {lead.phone_validation_notes && (
                  <p className="text-xs text-muted-foreground ml-6">{lead.phone_validation_notes}</p>
                )}
                {lead.phone_source_url && (
                  <a
                    href={lead.phone_source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:underline flex items-center gap-1 ml-6"
                  >
                    Source <ExternalLink className="h-3 w-3" />
                  </a>
                )}
                {lead.all_phones.length > 1 && (
                  <div className="ml-6 space-y-1">
                    <p className="text-xs text-muted-foreground">All phones found:</p>
                    {lead.all_phones.map((phone, i) => (
                      <Badge key={i} variant="outline" className="mr-1">{phone}</Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Contact Form */}
              {lead.contact_form_url && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={lead.contact_form_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline flex items-center gap-1"
                    >
                      Contact Form <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* LinkedIn */}
              {lead.linkedin_search_url && (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={lead.linkedin_search_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm hover:underline flex items-center gap-1"
                    >
                      LinkedIn Search <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              )}
            </div>

            {/* Tech Stack */}
            {technologies.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Cpu className="h-4 w-4" /> Tech Stack
                  </h3>
                  <div className="flex flex-wrap gap-1.5">
                    {technologies.map((tech, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">{tech}</Badge>
                    ))}
                  </div>
                  {revenueEstimate && (
                    <div className="flex items-center gap-2 text-sm">
                      <TrendingUp className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Est. Revenue:</span>
                      <span className="font-medium">{revenueEstimate}</span>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Review Sentiment */}
            {reviewSentiment && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <MessageSquareText className="h-4 w-4" /> Review Intelligence
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge className={
                      reviewSentiment.overall_sentiment === 'positive' ? 'bg-green-500/20 text-green-600' :
                      reviewSentiment.overall_sentiment === 'negative' ? 'bg-destructive/20 text-destructive' :
                      'bg-yellow-500/20 text-yellow-600'
                    }>
                      {reviewSentiment.overall_sentiment}
                    </Badge>
                    {reviewSentiment.avg_rating && (
                      <span className="flex items-center gap-1 text-sm">
                        <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                        {reviewSentiment.avg_rating} ({reviewSentiment.review_count} reviews)
                      </span>
                    )}
                  </div>
                  {reviewSentiment.pain_points?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Pain Points:</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {reviewSentiment.pain_points.map((p: string, i: number) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-destructive">•</span> {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {reviewSentiment.outreach_hooks?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Outreach Hooks:</p>
                      <ul className="text-xs text-muted-foreground space-y-0.5">
                        {reviewSentiment.outreach_hooks.map((h: string, i: number) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-primary">💡</span> {h}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Competitor / Hiring Signals */}
            {(competitorSignals || hiringSignals) && (
              <>
                <Separator />
                <div className="space-y-3">
                  <h3 className="font-semibold flex items-center gap-2">
                    <Radar className="h-4 w-4" /> Market Signals
                  </h3>
                  {hiringSignals && (
                    <div className="flex items-center gap-2 text-sm">
                      <Badge variant="outline" className="bg-blue-500/10 text-blue-600">🧑‍💼 Hiring</Badge>
                      <span className="text-muted-foreground">
                        ~{typeof hiringSignals === 'object' ? hiringSignals.job_count_estimate || 0 : 0} open roles
                      </span>
                    </div>
                  )}
                  {competitorSignals?.competitor_mentions?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground mb-1">Competitor Mentions:</p>
                      <div className="flex flex-wrap gap-1">
                        {competitorSignals.competitor_mentions.map((c: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{c}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Schema Data */}
            {Object.keys(schemaData).filter(k => !['google_places', 'technologies', 'competitor_signals', 'hiring_signals', 'revenue_estimate'].includes(k)).length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold">Schema-Specific Data</h3>
                  {Object.entries(schemaData).map(([key, value]) => {
                    // Skip keys already rendered above
                    if (['google_places', 'technologies', 'competitor_signals', 'hiring_signals', 'revenue_estimate'].includes(key)) return null;
                    
                    // For address, show full formatted address
                    if (key === 'address' || key === 'full_address') {
                      const street = schemaData.address || schemaData.full_address || '';
                      const city = schemaData.city || '';
                      const state = schemaData.state || '';
                      const zip = schemaData.zip || schemaData.zip_code || '';
                      const fullAddress = [street, city, state, zip].filter(Boolean).join(', ');
                      
                      if (key !== 'address' && key !== 'full_address') return null;
                      
                      return (
                        <div key={key} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Address:</span>
                            <span className="font-medium">{fullAddress || '-'}</span>
                          </div>
                        </div>
                      );
                    }
                    
                    // Skip individual city/state/zip fields if address is present
                    if (['city', 'state', 'zip', 'zip_code'].includes(key) && (schemaData.address || schemaData.full_address)) {
                      return null;
                    }
                    
                    return (
                      <div key={key} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Building className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground capitalize">
                            {key.replace(/_/g, ' ')}:
                          </span>
                          <span className="font-medium">
                            {Array.isArray(value) ? value.join(', ') : String(value)}
                          </span>
                        </div>
                        {schemaEvidence[key] && (
                          <a
                            href={schemaEvidence[key]}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-muted-foreground hover:underline flex items-center gap-1 ml-6"
                          >
                            Source <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Enrichment Data */}
            {lead.enrichment_providers_used.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h3 className="font-semibold">Enrichment Sources</h3>
                  <div className="flex flex-wrap gap-2">
                    {lead.enrichment_providers_used.map((provider, i) => {
                      const displayProvider = provider.toLowerCase() === 'tracerfy' 
                        ? 'Tracerfy (legacy) → BatchData'
                        : provider;
                      return (
                        <Badge key={i} variant="outline">{displayProvider}</Badge>
                      );
                    })}
                  </div>
                </div>
              </>
            )}

            {/* Assignment Info */}
            {lead.assigned_organization && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold">Assignment</h3>
                  <div className="flex items-center gap-2">
                    <Building className="h-4 w-4 text-muted-foreground" />
                    <span>{lead.assigned_organization.name}</span>
                  </div>
                  {lead.assigned_at && (
                    <p className="text-xs text-muted-foreground ml-6">
                      Assigned on {new Date(lead.assigned_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </>
            )}

            {/* Source URL */}
            {lead.source_url && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h3 className="font-semibold">Source</h3>
                  <a
                    href={lead.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm hover:underline flex items-center gap-1 break-all"
                  >
                    {lead.source_url} <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </a>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
