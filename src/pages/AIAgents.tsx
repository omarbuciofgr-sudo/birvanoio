import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Bot, Plus, Search, Play, Trash2, Loader2, Sparkles, ArrowRight } from 'lucide-react';

const MODEL_OPTIONS = [
  { value: 'google/gemini-3-flash-preview', label: 'Gemini 3 Flash' },
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'google/gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
  { value: 'openai/gpt-5-mini', label: 'GPT-5 Mini' },
];

const TOOL_OPTIONS = [
  'Enrich Company', 'Find Email', 'Skip Trace', 'Technographics',
  'Score Lead', 'Sentiment Analysis', 'Company Summary', 'Web Search',
];

export default function AIAgents() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [builderPrompt, setBuilderPrompt] = useState('');
  const [builderModel, setBuilderModel] = useState('google/gemini-3-flash-preview');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editAgent, setEditAgent] = useState<any>(null);

  const { data: agents = [], isLoading } = useQuery({
    queryKey: ['ai-agents'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ai_agents')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createMutation = useMutation({
    mutationFn: async ({ name, prompt, model }: { name: string; prompt: string; model: string }) => {
      const { error } = await supabase.from('ai_agents').insert({
        user_id: user!.id,
        name,
        prompt,
        model,
        tools: [],
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      toast.success('Agent created');
      setBuilderPrompt('');
    },
    onError: () => toast.error('Failed to create agent'),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ai_agents').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-agents'] });
      toast.success('Agent deleted');
    },
  });

  const handleBuildAgent = () => {
    if (!builderPrompt.trim()) { toast.error('Describe your agent first'); return; }
    const name = builderPrompt.length > 40 ? builderPrompt.slice(0, 40) + '…' : builderPrompt;
    createMutation.mutate({ name, prompt: builderPrompt, model: builderModel });
  };

  const filteredAgents = agents.filter(a =>
    !searchQuery || a.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Builder */}
        <Card className="border-border/60">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Start building your AI Agent in natural language</h2>
            </div>
            <div className="border border-border/60 rounded-xl p-4 space-y-3">
              <Textarea
                placeholder={'Describe your task in natural language and we\'ll create an AI Agent for you... (Tip: Type "@" to mention files and business context)'}
                value={builderPrompt}
                onChange={e => setBuilderPrompt(e.target.value)}
                className="min-h-[80px] border-0 shadow-none focus-visible:ring-0 resize-none text-sm p-0"
              />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Select value={builderModel} onValueChange={setBuilderModel}>
                    <SelectTrigger className="h-8 w-[220px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODEL_OPTIONS.map(m => (
                        <SelectItem key={m.value} value={m.value} className="text-xs">{m.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleBuildAgent}
                  disabled={createMutation.isPending || !builderPrompt.trim()}
                  variant="outline"
                  className="gap-2 text-xs"
                >
                  {createMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                  Build Agent
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Agents List */}
        <Card className="border-border/60">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5" />
                <h3 className="text-base font-bold">AI Agents</h3>
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search agents..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 w-[200px] text-xs"
                  />
                </div>
                <Button size="sm" className="gap-1.5 text-xs" onClick={() => setIsCreating(true)}>
                  <Plus className="h-3.5 w-3.5" /> Create new
                </Button>
              </div>
            </div>

            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : filteredAgents.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                You haven't created any agents yet.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Prompt</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Tools</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAgents.map(agent => (
                    <TableRow key={agent.id}>
                      <TableCell className="font-medium">{agent.name}</TableCell>
                      <TableCell className="text-muted-foreground max-w-[300px] truncate text-xs">{agent.prompt}</TableCell>
                      <TableCell>v{agent.version}</TableCell>
                      <TableCell>{(agent.tools || []).length}</TableCell>
                      <TableCell className="text-xs">{format(new Date(agent.created_at), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="Run">
                            <Play className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive"
                            onClick={() => deleteMutation.mutate(agent.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
