import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Zap, Plus, Settings, Trash2, Edit, AlertTriangle, TrendingUp, Eye } from 'lucide-react';

interface IntentSignal {
  id: string;
  lead_id: string | null;
  signal_type: string;
  signal_source: string | null;
  signal_data: Record<string, unknown> | null;
  confidence_score: number;
  detected_at: string;
  expires_at: string | null;
  is_processed: boolean;
  created_at: string;
}

// Signal type definitions with detection rules
const SIGNAL_TYPES = [
  {
    type: 'pricing_page_visit',
    label: 'Pricing Page Visit',
    description: 'Lead visited pricing or plans page',
    defaultScore: 70,
    icon: '💰',
  },
  {
    type: 'demo_request',
    label: 'Demo Request',
    description: 'Lead requested a product demo',
    defaultScore: 90,
    icon: '🎯',
  },
  {
    type: 'content_download',
    label: 'Content Download',
    description: 'Lead downloaded whitepaper, case study, etc.',
    defaultScore: 60,
    icon: '📄',
  },
  {
    type: 'repeat_visit',
    label: 'Repeat Visitor',
    description: 'Lead visited website multiple times',
    defaultScore: 50,
    icon: '🔄',
  },
  {
    type: 'email_engagement',
    label: 'Email Engagement',
    description: 'Lead opened/clicked marketing emails',
    defaultScore: 55,
    icon: '📧',
  },
  {
    type: 'form_submission',
    label: 'Form Submission',
    description: 'Lead submitted a contact/inquiry form',
    defaultScore: 80,
    icon: '📝',
  },
  {
    type: 'social_engagement',
    label: 'Social Engagement',
    description: 'Lead engaged on social media',
    defaultScore: 40,
    icon: '📱',
  },
  {
    type: 'competitor_mention',
    label: 'Competitor Research',
    description: 'Lead researching competitors',
    defaultScore: 65,
    icon: '🔍',
  },
  {
    type: 'job_posting',
    label: 'Related Job Posting',
    description: 'Company posted relevant job listing',
    defaultScore: 75,
    icon: '💼',
  },
  {
    type: 'funding_news',
    label: 'Funding/Growth News',
    description: 'Company announced funding or expansion',
    defaultScore: 85,
    icon: '📈',
  },
  {
    type: 'technology_change',
    label: 'Technology Change',
    description: 'Company changed tech stack',
    defaultScore: 70,
    icon: '⚙️',
  },
  {
    type: 'custom',
    label: 'Custom Signal',
    description: 'User-defined intent signal',
    defaultScore: 50,
    icon: '🎨',
  },
];

interface SignalConfig {
  type: string;
  enabled: boolean;
  scoreWeight: number;
  expirationDays: number;
  autoProcess: boolean;
}

export function IntentSignalsConfig() {
  const queryClient = useQueryClient();
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState<SignalConfig | null>(null);
  const [configs, setConfigs] = useState<SignalConfig[]>(
    SIGNAL_TYPES.map((st) => ({
      type: st.type,
      enabled: true,
      scoreWeight: st.defaultScore,
      expirationDays: 30,
      autoProcess: true,
    }))
  );

  const [newSignal, setNewSignal] = useState({
    lead_id: '',
    signal_type: 'custom',
    signal_source: '',
    confidence_score: 50,
    notes: '',
  });

  // Fetch recent intent signals
  const { data: signals = [], isLoading } = useQuery({
    queryKey: ['intent-signals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('intent_signals')
        .select('*')
        .order('detected_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as IntentSignal[];
    },
  });

  // Stats calculations
  const totalSignals = signals.length;
  const processedSignals = signals.filter((s) => s.is_processed).length;
  const avgConfidence = signals.length > 0
    ? signals.reduce((sum, s) => sum + s.confidence_score, 0) / signals.length
    : 0;

  const signalsByType = signals.reduce((acc, s) => {
    acc[s.signal_type] = (acc[s.signal_type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleConfigChange = (type: string, field: keyof SignalConfig, value: unknown) => {
    setConfigs((prev) =>
      prev.map((c) => (c.type === type ? { ...c, [field]: value } : c))
    );
  };

  const handleSaveConfigs = () => {
    // In a real app, save to database or localStorage
    toast.success('Signal configurations saved');
    setIsConfigOpen(false);
  };

  const getSignalInfo = (type: string) => {
    return SIGNAL_TYPES.find((st) => st.type === type) || SIGNAL_TYPES[SIGNAL_TYPES.length - 1];
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Zap className="h-5 w-5" />
            Intent Signals Configuration
          </h2>
          <p className="text-muted-foreground text-sm">
            Configure how intent signals are detected, scored, and processed
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsConfigOpen(true)}>
            <Settings className="h-4 w-4 mr-2" />
            Signal Settings
          </Button>
          <Button onClick={() => setIsCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Manual Signal
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{totalSignals}</p>
              <p className="text-sm text-muted-foreground">Total Signals</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{processedSignals}</p>
              <p className="text-sm text-muted-foreground">Processed</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{avgConfidence.toFixed(0)}%</p>
              <p className="text-sm text-muted-foreground">Avg Confidence</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-2xl font-bold">{Object.keys(signalsByType).length}</p>
              <p className="text-sm text-muted-foreground">Signal Types</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Signal Types Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Signal Type Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {SIGNAL_TYPES.map((st) => {
              const count = signalsByType[st.type] || 0;
              const config = configs.find((c) => c.type === st.type);
              return (
                <div
                  key={st.type}
                  className={`p-3 rounded-lg border text-center ${
                    config?.enabled ? 'bg-background' : 'bg-muted opacity-50'
                  }`}
                >
                  <div className="text-2xl mb-1">{st.icon}</div>
                  <p className="text-sm font-medium truncate">{st.label}</p>
                  <p className="text-lg font-bold">{count}</p>
                  <Badge variant={config?.enabled ? 'default' : 'secondary'} className="text-xs mt-1">
                    {config?.scoreWeight}pts
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Signals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recent Intent Signals
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-muted-foreground">Loading signals...</p>
          ) : signals.length === 0 ? (
            <p className="text-muted-foreground">No intent signals detected yet</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Confidence</TableHead>
                  <TableHead>Detected</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Expires</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {signals.slice(0, 20).map((signal) => {
                  const info = getSignalInfo(signal.signal_type);
                  return (
                    <TableRow key={signal.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span>{info.icon}</span>
                          <span className="font-medium">{info.label}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {signal.signal_source || 'System'}
                      </TableCell>
                      <TableCell>
                        <Badge className={getConfidenceColor(signal.confidence_score)}>
                          {signal.confidence_score}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm">
                        {format(new Date(signal.detected_at), 'MMM dd, HH:mm')}
                      </TableCell>
                      <TableCell>
                        <Badge variant={signal.is_processed ? 'secondary' : 'default'}>
                          {signal.is_processed ? 'Processed' : 'Pending'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {signal.expires_at
                          ? format(new Date(signal.expires_at), 'MMM dd')
                          : 'Never'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Signal Configuration Dialog */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Signal Detection Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {SIGNAL_TYPES.map((st) => {
              const config = configs.find((c) => c.type === st.type)!;
              return (
                <div key={st.type} className="p-4 border rounded-lg">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{st.icon}</span>
                      <div>
                        <p className="font-medium">{st.label}</p>
                        <p className="text-sm text-muted-foreground">{st.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={config.enabled}
                      onCheckedChange={(checked) =>
                        handleConfigChange(st.type, 'enabled', checked)
                      }
                    />
                  </div>
                  {config.enabled && (
                    <div className="grid grid-cols-3 gap-4 mt-4 pt-4 border-t">
                      <div>
                        <Label className="text-xs">Score Weight</Label>
                        <div className="flex items-center gap-2 mt-1">
                          <Slider
                            value={[config.scoreWeight]}
                            onValueChange={([v]) =>
                              handleConfigChange(st.type, 'scoreWeight', v)
                            }
                            max={100}
                            min={10}
                            step={5}
                            className="flex-1"
                          />
                          <span className="text-sm w-10">{config.scoreWeight}</span>
                        </div>
                      </div>
                      <div>
                        <Label className="text-xs">Expiration (days)</Label>
                        <Input
                          type="number"
                          value={config.expirationDays}
                          onChange={(e) =>
                            handleConfigChange(
                              st.type,
                              'expirationDays',
                              parseInt(e.target.value) || 30
                            )
                          }
                          min={1}
                          max={365}
                          className="mt-1"
                        />
                      </div>
                      <div className="flex items-end">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={config.autoProcess}
                            onCheckedChange={(checked) =>
                              handleConfigChange(st.type, 'autoProcess', checked)
                            }
                          />
                          <Label className="text-xs">Auto-process</Label>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => setIsConfigOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSaveConfigs}>Save Settings</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Manual Signal Creation Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Manual Intent Signal</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Lead ID</Label>
              <Input
                value={newSignal.lead_id}
                onChange={(e) => setNewSignal({ ...newSignal, lead_id: e.target.value })}
                placeholder="Enter lead UUID"
              />
            </div>
            <div>
              <Label>Signal Type</Label>
              <Select
                value={newSignal.signal_type}
                onValueChange={(v) => setNewSignal({ ...newSignal, signal_type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIGNAL_TYPES.map((st) => (
                    <SelectItem key={st.type} value={st.type}>
                      {st.icon} {st.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Source</Label>
              <Input
                value={newSignal.signal_source}
                onChange={(e) => setNewSignal({ ...newSignal, signal_source: e.target.value })}
                placeholder="e.g., Website, LinkedIn, Manual entry"
              />
            </div>
            <div>
              <Label>Confidence Score: {newSignal.confidence_score}%</Label>
              <Slider
                value={[newSignal.confidence_score]}
                onValueChange={([v]) => setNewSignal({ ...newSignal, confidence_score: v })}
                max={100}
                min={10}
                step={5}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Notes (optional)</Label>
              <Textarea
                value={newSignal.notes}
                onChange={(e) => setNewSignal({ ...newSignal, notes: e.target.value })}
                placeholder="Additional context..."
                rows={2}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => {
                  toast.success('Manual signal would be created (demo mode)');
                  setIsCreateOpen(false);
                }}
              >
                Create Signal
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
