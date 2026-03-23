import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { X, Plus, Tag, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface LeadTagsManagerProps {
  leadId: string;
  tags: string[];
  availableTags?: string[];
  onTagsChange?: (tags: string[]) => void;
  compact?: boolean;
}

const TAG_COLORS: Record<string, string> = {
  hot: 'bg-red-500/20 text-red-600 border-red-500/30',
  warm: 'bg-orange-500/20 text-orange-600 border-orange-500/30',
  cold: 'bg-blue-500/20 text-blue-600 border-blue-500/30',
  priority: 'bg-purple-500/20 text-purple-600 border-purple-500/30',
  vip: 'bg-yellow-500/20 text-yellow-600 border-yellow-500/30',
  followup: 'bg-green-500/20 text-green-600 border-green-500/30',
  dnc: 'bg-gray-500/20 text-gray-600 border-gray-500/30',
  callback: 'bg-cyan-500/20 text-cyan-600 border-cyan-500/30',
};

const SUGGESTED_TAGS = ['hot', 'warm', 'cold', 'priority', 'vip', 'followup', 'dnc', 'callback'];

export function LeadTagsManager({ 
  leadId, 
  tags = [], 
  availableTags = SUGGESTED_TAGS,
  onTagsChange,
  compact = false 
}: LeadTagsManagerProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [newTag, setNewTag] = useState('');

  const updateTagsMutation = useMutation({
    mutationFn: async (newTags: string[]) => {
      const { error } = await supabase
        .from('scraped_leads')
        .update({ tags: newTags })
        .eq('id', leadId);
      
      if (error) throw error;
      return newTags;
    },
    onSuccess: (newTags) => {
      queryClient.invalidateQueries({ queryKey: ['scraped-leads'] });
      onTagsChange?.(newTags);
    },
    onError: (error) => {
      toast.error(`Failed to update tags: ${error.message}`);
    },
  });

  const addTag = (tag: string) => {
    const normalizedTag = tag.toLowerCase().trim();
    if (!normalizedTag || tags.includes(normalizedTag)) return;
    
    const newTags = [...tags, normalizedTag];
    updateTagsMutation.mutate(newTags);
    setNewTag('');
    setOpen(false);
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter(t => t !== tagToRemove);
    updateTagsMutation.mutate(newTags);
  };

  const getTagColor = (tag: string) => {
    return TAG_COLORS[tag.toLowerCase()] || 'bg-muted text-foreground border-border';
  };

  if (compact) {
    return (
      <div className="flex flex-wrap gap-1">
        {tags.slice(0, 3).map((tag) => (
          <Badge 
            key={tag} 
            variant="outline" 
            className={cn('text-xs', getTagColor(tag))}
          >
            {tag}
          </Badge>
        ))}
        {tags.length > 3 && (
          <Badge variant="outline" className="text-xs">
            +{tags.length - 3}
          </Badge>
        )}
        {tags.length === 0 && (
          <span className="text-xs text-muted-foreground">No tags</span>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <Badge 
            key={tag} 
            variant="outline" 
            className={cn('flex items-center gap-1', getTagColor(tag))}
          >
            <Tag className="h-3 w-3" />
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="ml-1 hover:bg-background/50 rounded-full"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2">
              <Plus className="h-3 w-3 mr-1" />
              Add Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="start">
            <Command>
              <CommandInput 
                placeholder="Search or create tag..." 
                value={newTag}
                onValueChange={setNewTag}
              />
              <CommandList>
                <CommandEmpty>
                  {newTag && (
                    <Button 
                      variant="ghost" 
                      className="w-full justify-start"
                      onClick={() => addTag(newTag)}
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Create "{newTag}"
                    </Button>
                  )}
                </CommandEmpty>
                <CommandGroup heading="Suggested">
                  {availableTags
                    .filter(t => !tags.includes(t))
                    .filter(t => t.toLowerCase().includes(newTag.toLowerCase()))
                    .map((tag) => (
                      <CommandItem
                        key={tag}
                        value={tag}
                        onSelect={() => addTag(tag)}
                      >
                        <div className={cn(
                          'w-3 h-3 rounded-full mr-2',
                          TAG_COLORS[tag]?.split(' ')[0] || 'bg-muted'
                        )} />
                        {tag}
                        {tags.includes(tag) && (
                          <Check className="h-4 w-4 ml-auto" />
                        )}
                      </CommandItem>
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

// Bulk tag operations component
interface BulkTagOperationsProps {
  selectedLeadIds: string[];
  onComplete?: () => void;
}

export function BulkTagOperations({ selectedLeadIds, onComplete }: BulkTagOperationsProps) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  const bulkAddTagMutation = useMutation({
    mutationFn: async (tag: string) => {
      // Get current tags for all selected leads
      const { data: leads, error: fetchError } = await supabase
        .from('scraped_leads')
        .select('id, tags')
        .in('id', selectedLeadIds);
      
      if (fetchError) throw fetchError;
      
      // Update each lead with the new tag
      const updates = leads?.map(lead => ({
        id: lead.id,
        tags: [...new Set([...(lead.tags || []), tag])],
      })) || [];
      
      for (const update of updates) {
        const { error } = await supabase
          .from('scraped_leads')
          .update({ tags: update.tags })
          .eq('id', update.id);
        
        if (error) throw error;
      }
      
      return updates.length;
    },
    onSuccess: (count) => {
      queryClient.invalidateQueries({ queryKey: ['scraped-leads'] });
      toast.success(`Added tag to ${count} leads`);
      setOpen(false);
      onComplete?.();
    },
    onError: (error) => {
      toast.error(`Failed to add tags: ${error.message}`);
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" disabled={selectedLeadIds.length === 0}>
          <Tag className="h-4 w-4 mr-2" />
          Tag ({selectedLeadIds.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[200px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Select tag..." />
          <CommandList>
            <CommandGroup>
              {SUGGESTED_TAGS.map((tag) => (
                <CommandItem
                  key={tag}
                  value={tag}
                  onSelect={() => bulkAddTagMutation.mutate(tag)}
                >
                  <div className={cn(
                    'w-3 h-3 rounded-full mr-2',
                    TAG_COLORS[tag]?.split(' ')[0] || 'bg-muted'
                  )} />
                  {tag}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
