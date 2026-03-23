import { supabase } from '@/integrations/supabase/client';

export interface ProviderPricing {
  id: string;
  provider_name: string;
  api_name: string;
  unit_cost_cents: number;
  unit_type: string;
  is_active: boolean;
  notes: string | null;
}

export interface CreditEventConfig {
  id: string;
  event_type: string;
  event_name: string;
  base_credits: number;
  description: string | null;
  providers_involved: string[];
  avg_calls_per_lead: number;
  confidence_threshold: number;
  success_rate: number;
  max_provider_calls: number;
  cache_ttl_hours: number;
  is_active: boolean;
}

export interface CostAnalysis {
  event_type: string;
  event_name: string;
  scenario: 'conservative' | 'expected' | 'aggressive';
  blended_cost_cents: number;
  cogs_cost_cents: number;
  calls_per_lead: number;
  providers_used: string[];
  margin_percent: number;
}

const skipOptionalTables = import.meta.env.VITE_SKIP_OPTIONAL_TABLES === 'true';

// Fetch provider pricing config (optional table - return [] if missing/error)
export const fetchProviderPricing = async (): Promise<ProviderPricing[]> => {
  if (skipOptionalTables) return [];
  try {
    const { data, error } = await supabase
      .from('provider_pricing_config')
      .select('*')
      .eq('is_active', true);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
};

// Fetch credit event configurations (optional table - return [] if missing/error)
export const fetchCreditEventConfigs = async (): Promise<CreditEventConfig[]> => {
  if (skipOptionalTables) return [];
  try {
    const { data, error } = await supabase
      .from('credit_event_config')
      .select('*')
      .eq('is_active', true);
    if (error) return [];
    return data || [];
  } catch {
    return [];
  }
};

// Update provider pricing
export const updateProviderPricing = async (
  providerId: string,
  updates: Partial<ProviderPricing>
) => {
  const { data, error } = await supabase
    .from('provider_pricing_config')
    .update(updates)
    .eq('id', providerId)
    .select();
  
  if (error) throw error;
  return data?.[0];
};

// Update credit event config
export const updateCreditEventConfig = async (
  eventId: string,
  updates: Partial<CreditEventConfig>
) => {
  const { data, error } = await supabase
    .from('credit_event_config')
    .update(updates)
    .eq('id', eventId)
    .select();
  
  if (error) throw error;
  return data?.[0];
};

// Calculate cost for a single event
export const calculateEventCost = (
  eventConfig: CreditEventConfig,
  providerPricing: ProviderPricing[],
  scenario: 'conservative' | 'expected' | 'aggressive' = 'expected'
): CostAnalysis => {
  const scenarioMultipliers = {
    conservative: 0.7,  // Best case - higher success rate
    expected: 1.0,       // Normal case
    aggressive: 1.4,     // Worst case - more retries
  };

  const multiplier = scenarioMultipliers[scenario];

  // Calculate actual calls per lead based on scenario
  let callsPerLead = eventConfig.avg_calls_per_lead;
  if (scenario === 'conservative') {
    callsPerLead = Math.max(1, eventConfig.avg_calls_per_lead * 0.7);
  } else if (scenario === 'aggressive') {
    callsPerLead = Math.min(
      eventConfig.max_provider_calls,
      eventConfig.avg_calls_per_lead * 1.5
    );
  }

  // Calculate COGS based on providers involved
  let totalCostCents = 0;
  const activeProviders: string[] = [];

  for (const providerName of eventConfig.providers_involved) {
    const provider = providerPricing.find(
      (p) => p.provider_name === providerName && p.is_active
    );

    if (provider) {
      activeProviders.push(provider.provider_name);
      
      // Scale by success rate and calls
      const successFactor = eventConfig.success_rate / 100;
      const costForProvider = provider.unit_cost_cents * callsPerLead * successFactor;
      totalCostCents += costForProvider;
    }
  }

  // Apply scenario multiplier for actual COGS
  const cogsCostCents = Math.round(totalCostCents * multiplier);

  // Assume $0.06 per credit sell price
  const sellPriceCents = 6;
  const marginPercent =
    eventConfig.base_credits > 0
      ? ((sellPriceCents * eventConfig.base_credits - cogsCostCents) /
          (sellPriceCents * eventConfig.base_credits)) *
        100
      : 0;

  return {
    event_type: eventConfig.event_type,
    event_name: eventConfig.event_name,
    scenario,
    blended_cost_cents: cogsCostCents,
    cogs_cost_cents: cogsCostCents,
    calls_per_lead: callsPerLead,
    providers_used: activeProviders,
    margin_percent: Math.round(marginPercent * 100) / 100,
  };
};

// Calculate all event costs
export const calculateAllEventCosts = (
  eventConfigs: CreditEventConfig[],
  providerPricing: ProviderPricing[],
  scenario: 'conservative' | 'expected' | 'aggressive' = 'expected'
): CostAnalysis[] => {
  return eventConfigs.map((config) =>
    calculateEventCost(config, providerPricing, scenario)
  );
};

// Calculate blended COGS per credit across all events
export const calculateBlendedCostPerCredit = (
  analyses: CostAnalysis[],
  usageWeights: Record<string, number> = {}
): number => {
  let totalCost = 0;
  let totalCredits = 0;

  for (const analysis of analyses) {
    const weight = usageWeights[analysis.event_type] || 1;
    const config = {
      base_credits: analysis.scenario === 'expected' ? 1 : 1,
    };

    // Rough estimate: use base credits from scenario
    const estimatedCredits = config.base_credits * weight;
    totalCost += analysis.blended_cost_cents * weight;
    totalCredits += estimatedCredits;
  }

  return totalCredits > 0 ? totalCost / totalCredits : 0;
};
