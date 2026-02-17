import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit, Trash2, DollarSign, TrendingUp, Calculator } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { Loader2 } from 'lucide-react';
import {
  fetchProviderPricing,
  fetchCreditEventConfigs,
  updateProviderPricing,
  updateCreditEventConfig,
  calculateAllEventCosts,
  type ProviderPricing,
  type CreditEventConfig,
} from '@/lib/api/costCalculator';

const providerSchema = z.object({
  provider_name: z.string().min(1, 'Provider name required'),
  unit_cost_cents: z.number().min(0, 'Cost must be >= 0'),
  notes: z.string().optional(),
});

const eventSchema = z.object({
  event_name: z.string().min(1, 'Event name required'),
  base_credits: z.number().min(1, 'Must be >= 1'),
  avg_calls_per_lead: z.number().min(0.1, 'Must be > 0'),
  success_rate: z.number().min(0, 'Must be >= 0').max(100, 'Must be <= 100'),
  max_provider_calls: z.number().min(1, 'Must be >= 1'),
});

export default function CostCalculator() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [scenario, setScenario] = useState<'conservative' | 'expected' | 'aggressive'>('expected');
  const [editingProvider, setEditingProvider] = useState<ProviderPricing | null>(null);
  const [editingEvent, setEditingEvent] = useState<CreditEventConfig | null>(null);
  const [showProviderDialog, setShowProviderDialog] = useState(false);
  const [showEventDialog, setShowEventDialog] = useState(false);

  // Fetch data (retry: false, no refetch on focus - avoid repeated 404s when tables don't exist)
  const { data: providers = [], isLoading: providersLoading } = useQuery({
    queryKey: ['provider-pricing'],
    queryFn: fetchProviderPricing,
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ['credit-event-configs'],
    queryFn: fetchCreditEventConfigs,
    retry: false,
    staleTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  // Calculate costs
  const costs = calculateAllEventCosts(events, providers, scenario);

  // Update provider mutation
  const updateProviderMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<ProviderPricing> }) =>
      updateProviderPricing(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-pricing'] });
      setEditingProvider(null);
      toast.success('Provider pricing updated');
    },
    onError: () => toast.error('Failed to update provider'),
  });

  // Update event mutation
  const updateEventMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreditEventConfig> }) =>
      updateCreditEventConfig(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-event-configs'] });
      setEditingEvent(null);
      toast.success('Event config updated');
    },
    onError: () => toast.error('Failed to update event'),
  });

  const providerForm = useForm({
    resolver: zodResolver(providerSchema),
    defaultValues: editingProvider
      ? { provider_name: editingProvider.provider_name, unit_cost_cents: editingProvider.unit_cost_cents, notes: editingProvider.notes || '' }
      : { provider_name: '', unit_cost_cents: 0, notes: '' },
  });

  const eventForm = useForm({
    resolver: zodResolver(eventSchema),
    defaultValues: editingEvent
      ? {
          event_name: editingEvent.event_name,
          base_credits: editingEvent.base_credits,
          avg_calls_per_lead: editingEvent.avg_calls_per_lead,
          success_rate: editingEvent.success_rate,
          max_provider_calls: editingEvent.max_provider_calls,
        }
      : {
          event_name: '',
          base_credits: 1,
          avg_calls_per_lead: 1,
          success_rate: 100,
          max_provider_calls: 3,
        },
  });

  const onProviderSubmit = async (data: z.infer<typeof providerSchema>) => {
    if (!editingProvider) return;
    await updateProviderMutation.mutateAsync({
      id: editingProvider.id,
      data: { unit_cost_cents: data.unit_cost_cents, notes: data.notes },
    });
    providerForm.reset();
  };

  const onEventSubmit = async (data: z.infer<typeof eventSchema>) => {
    if (!editingEvent) return;
    await updateEventMutation.mutateAsync({
      id: editingEvent.id,
      data,
    });
    eventForm.reset();
  };

  if (providersLoading || eventsLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Calculator className="h-8 w-8" />
              Cost Calculator
            </h1>
            <p className="text-muted-foreground">
              Manage provider pricing and calculate credit costs dynamically
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant={scenario === 'conservative' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setScenario('conservative')}>
              Conservative
            </Badge>
            <Badge variant={scenario === 'expected' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setScenario('expected')}>
              Expected
            </Badge>
            <Badge variant={scenario === 'aggressive' ? 'default' : 'outline'} className="cursor-pointer" onClick={() => setScenario('aggressive')}>
              Aggressive
            </Badge>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Cost Overview
            </TabsTrigger>
            <TabsTrigger value="providers" className="flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Provider Pricing
            </TabsTrigger>
            <TabsTrigger value="events" className="flex items-center gap-2">
              <Calculator className="h-4 w-4" />
              Credit Events
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Cost Analysis by Event ({scenario})</CardTitle>
                <CardDescription>
                  COGS per event and margin percentages based on $0.06/credit pricing
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Calls/Lead</TableHead>
                        <TableHead>Providers</TableHead>
                        <TableHead>COGS (cents)</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Margin %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {costs.map((cost) => {
                        const event = events.find((e) => e.event_type === cost.event_type);
                        return (
                          <TableRow key={cost.event_type}>
                            <TableCell className="font-medium">{cost.event_name}</TableCell>
                            <TableCell>{cost.calls_per_lead.toFixed(1)}</TableCell>
                            <TableCell className="text-xs">
                              {cost.providers_used.length > 0 ? (
                                <div className="flex flex-wrap gap-1">
                                  {cost.providers_used.map((p) => (
                                    <Badge key={p} variant="secondary">
                                      {p}
                                    </Badge>
                                  ))}
                                </div>
                              ) : (
                                'N/A'
                              )}
                            </TableCell>
                            <TableCell>${(cost.cogs_cost_cents / 100).toFixed(3)}</TableCell>
                            <TableCell>{event?.base_credits || 1}</TableCell>
                            <TableCell>
                              <span className={cost.margin_percent >= 30 ? 'text-green-600' : 'text-red-600'}>
                                {cost.margin_percent.toFixed(1)}%
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Summary Stats - guard for empty costs to avoid reduce on empty array */}
            <div className="grid grid-cols-3 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Average Margin</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {costs.length
                      ? `${(costs.reduce((sum, c) => sum + c.margin_percent, 0) / costs.length).toFixed(1)}%`
                      : "0.0%"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Highest Cost Event</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-lg font-semibold">
                    {costs.length
                      ? costs.reduce((max, c) => (c.cogs_cost_cents > max.cogs_cost_cents ? c : max), costs[0]).event_name
                      : "—"}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {costs.length
                      ? `$${(costs.reduce((max, c) => (c.cogs_cost_cents > max.cogs_cost_cents ? c : max), costs[0]).cogs_cost_cents / 100).toFixed(3)}`
                      : "—"}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Total Providers</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{providers.length}</div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Provider Pricing Tab */}
          <TabsContent value="providers" className="space-y-4">
            <div className="flex justify-end">
              <Button onClick={() => setShowProviderDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Provider
              </Button>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Provider Pricing Configuration</CardTitle>
                <CardDescription>Set unit costs for each provider</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Provider</TableHead>
                        <TableHead>Unit Type</TableHead>
                        <TableHead>Cost/Unit</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Notes</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {providers.map((provider) => (
                        <TableRow key={provider.id}>
                          <TableCell className="font-medium">{provider.provider_name}</TableCell>
                          <TableCell>{provider.unit_type}</TableCell>
                          <TableCell>${(provider.unit_cost_cents / 100).toFixed(4)}</TableCell>
                          <TableCell>
                            <Badge variant={provider.is_active ? 'default' : 'secondary'}>
                              {provider.is_active ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{provider.notes}</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingProvider(provider);
                                providerForm.reset({
                                  provider_name: provider.provider_name,
                                  unit_cost_cents: provider.unit_cost_cents,
                                  notes: provider.notes || '',
                                });
                                setShowProviderDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Credit Event Configuration</CardTitle>
                <CardDescription>Manage how credits are charged for different events</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Credits</TableHead>
                        <TableHead>Avg Calls</TableHead>
                        <TableHead>Success Rate</TableHead>
                        <TableHead>Max Calls</TableHead>
                        <TableHead>Cache TTL</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell className="font-medium">{event.event_name}</TableCell>
                          <TableCell>{event.base_credits}</TableCell>
                          <TableCell>{event.avg_calls_per_lead.toFixed(1)}</TableCell>
                          <TableCell>{event.success_rate}%</TableCell>
                          <TableCell>{event.max_provider_calls}</TableCell>
                          <TableCell>{event.cache_ttl_hours}h</TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingEvent(event);
                                eventForm.reset({
                                  event_name: event.event_name,
                                  base_credits: event.base_credits,
                                  avg_calls_per_lead: event.avg_calls_per_lead,
                                  success_rate: event.success_rate,
                                  max_provider_calls: event.max_provider_calls,
                                });
                                setShowEventDialog(true);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Provider Dialog */}
        <Dialog open={showProviderDialog} onOpenChange={setShowProviderDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingProvider ? 'Edit Provider' : 'Add Provider'}</DialogTitle>
              <DialogDescription>Update provider pricing configuration</DialogDescription>
            </DialogHeader>
            <Form {...providerForm}>
              <form onSubmit={providerForm.handleSubmit(onProviderSubmit)} className="space-y-4">
                <FormField
                  control={providerForm.control}
                  name="provider_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Provider Name</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!!editingProvider} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={providerForm.control}
                  name="unit_cost_cents"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Unit Cost (cents)</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.01" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={providerForm.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Notes</FormLabel>
                      <FormControl>
                        <Textarea {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={updateProviderMutation.isPending}>
                    {updateProviderMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

        {/* Event Dialog */}
        <Dialog open={showEventDialog} onOpenChange={setShowEventDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingEvent ? 'Edit Event' : 'Add Event'}</DialogTitle>
              <DialogDescription>Update credit event configuration</DialogDescription>
            </DialogHeader>
            <Form {...eventForm}>
              <form onSubmit={eventForm.handleSubmit(onEventSubmit)} className="space-y-4">
                <FormField
                  control={eventForm.control}
                  name="event_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Event Name</FormLabel>
                      <FormControl>
                        <Input {...field} disabled={!!editingEvent} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="base_credits"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Base Credits</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="avg_calls_per_lead"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Avg Calls Per Lead</FormLabel>
                      <FormControl>
                        <Input type="number" step="0.1" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="success_rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Success Rate (%)</FormLabel>
                      <FormControl>
                        <Input type="number" step="1" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={eventForm.control}
                  name="max_provider_calls"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Max Provider Calls</FormLabel>
                      <FormControl>
                        <Input type="number" {...field} onChange={(e) => field.onChange(parseInt(e.target.value))} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={updateEventMutation.isPending}>
                    {updateEventMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
