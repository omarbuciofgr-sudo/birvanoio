import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Bookmark, BookmarkPlus, ChevronDown, Star, Trash2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface SearchFilters {
  status?: string;
  job_id?: string;
  source_type?: string;
  tags?: string[];
  search?: string;
  [key: string]: unknown;
}

interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  filters: SearchFilters;
  is_default: boolean;
  created_at: string;
}

interface SavedSearchesManagerProps {
  currentFilters: SearchFilters;
  onLoadSearch: (filters: SearchFilters) => void;
}

export function SavedSearchesManager({ currentFilters, onLoadSearch }: SavedSearchesManagerProps) {
  const queryClient = useQueryClient();
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [searchName, setSearchName] = useState('');
  const [searchDescription, setSearchDescription] = useState('');

  const { data: savedSearches = [] } = useQuery({
    queryKey: ['saved-searches'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return (data || []) as SavedSearch[];
    },
  });

  const saveSearchMutation = useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('saved_searches')
        .insert([{
          user_id: user.id,
          name,
          description: description || null,
          filters: JSON.parse(JSON.stringify(currentFilters)),
          is_default: false,
        }]);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
      toast.success('Search saved');
      setSaveDialogOpen(false);
      setSearchName('');
      setSearchDescription('');
    },
    onError: (error) => {
      toast.error(`Failed to save search: ${error.message}`);
    },
  });

  const deleteSearchMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('saved_searches')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
      toast.success('Search deleted');
    },
    onError: (error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Remove default from all searches
      await supabase
        .from('saved_searches')
        .update({ is_default: false })
        .eq('user_id', user.id);

      // Set new default
      const { error } = await supabase
        .from('saved_searches')
        .update({ is_default: true })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['saved-searches'] });
      toast.success('Default search updated');
    },
    onError: (error) => {
      toast.error(`Failed to set default: ${error.message}`);
    },
  });

  const hasActiveFilters = Object.values(currentFilters).some(v => 
    v !== 'all' && v !== undefined && v !== '' && 
    (Array.isArray(v) ? v.length > 0 : true)
  );

  const getFilterSummary = (filters: SearchFilters) => {
    const parts: string[] = [];
    if (filters.status && filters.status !== 'all') parts.push(`Status: ${filters.status}`);
    if (filters.source_type && filters.source_type !== 'all') parts.push(`Source: ${filters.source_type}`);
    if (filters.tags?.length) parts.push(`Tags: ${filters.tags.join(', ')}`);
    if (filters.search) parts.push(`Search: "${filters.search}"`);
    return parts.length > 0 ? parts.join(' • ') : 'No filters';
  };

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <Bookmark className="h-4 w-4 mr-2" />
            Saved Searches
            <ChevronDown className="h-4 w-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[300px]">
          {savedSearches.length === 0 ? (
            <div className="px-2 py-4 text-center text-sm text-muted-foreground">
              No saved searches yet
            </div>
          ) : (
            savedSearches.map((search) => (
              <DropdownMenuItem
                key={search.id}
                className="flex flex-col items-start gap-1 cursor-pointer"
                onClick={() => onLoadSearch(search.filters)}
              >
                <div className="flex items-center gap-2 w-full">
                  <span className="font-medium">{search.name}</span>
                  {search.is_default && (
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                  )}
                  <div className="flex-1" />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      setDefaultMutation.mutate(search.id);
                    }}
                  >
                    <Star className={`h-3 w-3 ${search.is_default ? 'fill-current' : ''}`} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSearchMutation.mutate(search.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground">
                  {getFilterSummary(search.filters)}
                </span>
              </DropdownMenuItem>
            ))
          )}
          
          <DropdownMenuSeparator />
          
          <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
            <DialogTrigger asChild>
              <DropdownMenuItem 
                onSelect={(e) => e.preventDefault()}
                disabled={!hasActiveFilters}
              >
                <BookmarkPlus className="h-4 w-4 mr-2" />
                Save Current Search
              </DropdownMenuItem>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Save Search</DialogTitle>
                <DialogDescription>
                  Save your current filters for quick access later.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., Hot Real Estate Leads"
                    value={searchName}
                    onChange={(e) => setSearchName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Input
                    id="description"
                    placeholder="e.g., High-priority FSBO leads in Texas"
                    value={searchDescription}
                    onChange={(e) => setSearchDescription(e.target.value)}
                  />
                </div>
                
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-sm font-medium mb-1">Current Filters</div>
                  <div className="text-xs text-muted-foreground">
                    {getFilterSummary(currentFilters)}
                  </div>
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={() => saveSearchMutation.mutate({ name: searchName, description: searchDescription })}
                  disabled={!searchName.trim() || saveSearchMutation.isPending}
                >
                  {saveSearchMutation.isPending ? 'Saving...' : 'Save Search'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
