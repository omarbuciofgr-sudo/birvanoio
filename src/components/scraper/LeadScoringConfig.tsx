import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Save, RotateCcw, Loader2, Brain, Mail, Phone, MapPin, TrendingUp, Building2, Target } from 'lucide-react';

interface ScoringConfig {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  weight_has_email: number;
  weight_email_verified: number;
  weight_has_phone: number;
  weight_phone_verified: number;
  weight_has_address: number;
  weight_intent_signal: number;
  weight_recent_activity: number;
  weight_website_quality: number;
  weight_company_size_match: number;
  weight_industry_match: number;
  weight_location_match: number;
  threshold_hot: number;
  threshold_warm: number;
  threshold_cold: number;
}

const DEFAULT_CONFIG: Partial<ScoringConfig> = {
  weight_has_email: 15,
  weight_email_verified: 10,
  weight_has_phone: 15,
  weight_phone_verified: 10,
  weight_has_address: 5,
  weight_intent_signal: 8,
  weight_recent_activity: 10,
  weight_website_quality: 5,
  weight_company_size_match: 10,
  weight_industry_match: 12,
  weight_location_match: 5,
  threshold_hot: 80,
  threshold_warm: 50,
  threshold_cold: 25,
};

interface WeightSliderProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  icon: React.ReactNode;
  max?: number;
}

function WeightSlider({ label, value, onChange, icon, max = 25 }: WeightSliderProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {icon}
          <Label className="text-sm">{label}</Label>
        </div>
        <Badge variant="outline" className="font-mono">{value}%</Badge>
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        max={max}
        step={1}
        className="w-full"
      />
    </div>
  );
}

export function LeadScoringConfig() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<Partial<ScoringConfig> | null>(null);

  // Fetch current config
  const { data: savedConfig, isLoading } = useQuery({
    queryKey: ['lead-scoring-config'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('lead_scoring_config')
        .select('*')
        .eq('is_active', true)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data as ScoringConfig | null;
    },
  });

  // Initialize local state when data loads
  if (savedConfig && !config) {
    setConfig(savedConfig);
  } else if (!savedConfig && !config) {
    setConfig(DEFAULT_CONFIG);
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!config) return;
      
      if (savedConfig?.id) {
        const { error } = await supabase
          .from('lead_scoring_config')
          .update({
            ...config,
            updated_at: new Date().toISOString(),
          })
          .eq('id', savedConfig.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('lead_scoring_config')
          .insert({
            ...config,
            name: 'default',
            is_active: true,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-scoring-config'] });
      toast.success('Scoring configuration saved');
    },
    onError: (error: Error) => {
      toast.error('Failed to save: ' + error.message);
    },
  });

  const updateWeight = (key: keyof ScoringConfig, value: number) => {
    setConfig(prev => prev ? { ...prev, [key]: value } : prev);
  };

  const resetToDefaults = () => {
    setConfig(DEFAULT_CONFIG);
    toast.info('Reset to default values');
  };

  const totalWeight = config ? (
    (config.weight_has_email || 0) +
    (config.weight_email_verified || 0) +
    (config.weight_has_phone || 0) +
    (config.weight_phone_verified || 0) +
    (config.weight_has_address || 0) +
    (config.weight_intent_signal || 0) +
    (config.weight_recent_activity || 0) +
    (config.weight_website_quality || 0) +
    (config.weight_company_size_match || 0) +
    (config.weight_industry_match || 0) +
    (config.weight_location_match || 0)
  ) : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="h-5 w-5" />
            Lead Scoring Model
          </h2>
          <p className="text-sm text-muted-foreground">
            Customize how leads are scored based on data quality and engagement signals
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={resetToDefaults}>
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
        <span className="text-sm text-muted-foreground">Total Weight:</span>
        <Badge variant={totalWeight === 100 ? 'default' : 'destructive'} className="font-mono">
          {totalWeight}%
        </Badge>
        {totalWeight !== 100 && (
          <span className="text-xs text-destructive">Should equal 100%</span>
        )}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Contact Data Weights */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Contact Data Quality
            </CardTitle>
            <CardDescription>Weight for having and verifying contact information</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <WeightSlider
              label="Has Email"
              value={config.weight_has_email || 0}
              onChange={v => updateWeight('weight_has_email', v)}
              icon={<Mail className="h-4 w-4 text-muted-foreground" />}
            />
            <WeightSlider
              label="Email Verified"
              value={config.weight_email_verified || 0}
              onChange={v => updateWeight('weight_email_verified', v)}
              icon={<Mail className="h-4 w-4 text-green-500" />}
            />
            <WeightSlider
              label="Has Phone"
              value={config.weight_has_phone || 0}
              onChange={v => updateWeight('weight_has_phone', v)}
              icon={<Phone className="h-4 w-4 text-muted-foreground" />}
            />
            <WeightSlider
              label="Phone Verified"
              value={config.weight_phone_verified || 0}
              onChange={v => updateWeight('weight_phone_verified', v)}
              icon={<Phone className="h-4 w-4 text-green-500" />}
            />
            <WeightSlider
              label="Has Address"
              value={config.weight_has_address || 0}
              onChange={v => updateWeight('weight_has_address', v)}
              icon={<MapPin className="h-4 w-4 text-muted-foreground" />}
            />
          </CardContent>
        </Card>

        {/* Engagement Weights */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Engagement Signals
            </CardTitle>
            <CardDescription>Weight for engagement and intent indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <WeightSlider
              label="Intent Signal (per signal)"
              value={config.weight_intent_signal || 0}
              onChange={v => updateWeight('weight_intent_signal', v)}
              icon={<Target className="h-4 w-4 text-orange-500" />}
            />
            <WeightSlider
              label="Recent Activity"
              value={config.weight_recent_activity || 0}
              onChange={v => updateWeight('weight_recent_activity', v)}
              icon={<TrendingUp className="h-4 w-4 text-blue-500" />}
            />
            <WeightSlider
              label="Website Quality"
              value={config.weight_website_quality || 0}
              onChange={v => updateWeight('weight_website_quality', v)}
              icon={<Building2 className="h-4 w-4 text-purple-500" />}
            />
          </CardContent>
        </Card>

        {/* Business Quality Weights */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              Business Fit
            </CardTitle>
            <CardDescription>Weight for matching target business criteria</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <WeightSlider
              label="Company Size Match"
              value={config.weight_company_size_match || 0}
              onChange={v => updateWeight('weight_company_size_match', v)}
              icon={<Building2 className="h-4 w-4 text-muted-foreground" />}
            />
            <WeightSlider
              label="Industry Match"
              value={config.weight_industry_match || 0}
              onChange={v => updateWeight('weight_industry_match', v)}
              icon={<Building2 className="h-4 w-4 text-green-500" />}
            />
            <WeightSlider
              label="Location Match"
              value={config.weight_location_match || 0}
              onChange={v => updateWeight('weight_location_match', v)}
              icon={<MapPin className="h-4 w-4 text-blue-500" />}
            />
          </CardContent>
        </Card>

        {/* Score Thresholds */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Score Thresholds</CardTitle>
            <CardDescription>Define score ranges for lead prioritization</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Badge className="bg-red-500">Hot</Badge>
                  Minimum Score
                </Label>
                <Input
                  type="number"
                  value={config.threshold_hot || 80}
                  onChange={e => updateWeight('threshold_hot', parseInt(e.target.value) || 0)}
                  className="w-20"
                  min={0}
                  max={100}
                />
              </div>
              <p className="text-xs text-muted-foreground">Leads scoring above this are high priority</p>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Badge className="bg-yellow-500">Warm</Badge>
                  Minimum Score
                </Label>
                <Input
                  type="number"
                  value={config.threshold_warm || 50}
                  onChange={e => updateWeight('threshold_warm', parseInt(e.target.value) || 0)}
                  className="w-20"
                  min={0}
                  max={100}
                />
              </div>
              <p className="text-xs text-muted-foreground">Leads scoring above this need nurturing</p>
            </div>
            
            <Separator />
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-2">
                  <Badge variant="secondary">Cold</Badge>
                  Minimum Score
                </Label>
                <Input
                  type="number"
                  value={config.threshold_cold || 25}
                  onChange={e => updateWeight('threshold_cold', parseInt(e.target.value) || 0)}
                  className="w-20"
                  min={0}
                  max={100}
                />
              </div>
              <p className="text-xs text-muted-foreground">Leads below this may need more data</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
