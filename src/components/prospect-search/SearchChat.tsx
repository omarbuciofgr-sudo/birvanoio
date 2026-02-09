import { useState, useRef, useEffect } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, Bot, User, Wand2 } from 'lucide-react';
import { ProspectSearchFilters } from './constants';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  appliedFilters?: Partial<ProspectSearchFilters>;
}

interface SearchChatProps {
  onApplyFilters?: (filters: Partial<ProspectSearchFilters>) => void;
}

export function SearchChat({ onApplyFilters }: SearchChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content:
        "Hi! I'm your prospect search assistant. Tell me what kind of companies you're looking for and I'll automatically configure your filters.\n\nFor example:\n- \"Property management companies in California\"\n- \"SaaS companies with 50-200 employees\"\n- \"Restaurants in New York and New Jersey\"",
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/prospect-search-chat`;

      const resp = await fetch(CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMsg].map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (resp.status === 429) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Rate limit exceeded. Please wait a moment and try again.' },
        ]);
        return;
      }

      if (resp.status === 402) {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Usage limit reached. Please add credits to continue.' },
        ]);
        return;
      }

      if (!resp.ok) {
        throw new Error('Failed to get response');
      }

      const data = await resp.json();
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: data.content || 'I\'ve updated your filters based on your request.',
        appliedFilters: data.filters || undefined,
      };

      // Auto-apply filters if returned
      if (data.filters && onApplyFilters) {
        onApplyFilters(data.filters);
      }

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error) {
      console.error('Chat error:', error);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, I had trouble processing that. Please try again.',
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const filterKeys = (filters: Partial<ProspectSearchFilters>): string[] => {
    return Object.entries(filters)
      .filter(([_, v]) => {
        if (Array.isArray(v)) return v.length > 0;
        return v !== undefined && v !== '' && v !== null;
      })
      .map(([k]) => k);
  };

  return (
    <div className="h-full flex flex-col border-l border-border">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <div>
            <h3 className="font-display text-sm font-semibold">AI Search Assistant</h3>
            <p className="text-[10px] text-muted-foreground">Describe what you need — I'll set your filters</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1" ref={scrollRef}>
        <div className="p-4 space-y-4">
          {messages.map((msg, i) => (
            <div key={i} className={`flex gap-2 ${msg.role === 'user' ? 'justify-end' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Bot className="h-3.5 w-3.5 text-primary" />
                </div>
              )}
              <div className="max-w-[85%] space-y-1.5">
                <div
                  className={`rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
                    msg.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted'
                  }`}
                >
                  {msg.content}
                </div>
                {msg.appliedFilters && filterKeys(msg.appliedFilters).length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    <Wand2 className="h-3 w-3 text-primary flex-shrink-0" />
                    <span className="text-[10px] text-primary font-medium">Applied:</span>
                    {filterKeys(msg.appliedFilters).map((k) => (
                      <Badge key={k} variant="secondary" className="text-[9px] px-1 py-0">
                        {k.replace(/([A-Z])/g, ' $1').trim()}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-0.5">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-3.5 w-3.5 text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-xs">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-pulse" />
                  <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <span className="h-1.5 w-1.5 bg-muted-foreground rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                </span>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Suggested prompts */}
      {messages.length <= 1 && (
        <div className="flex-shrink-0 px-4 pb-2 space-y-1.5">
          {[
            'Property management in Texas',
            'SaaS companies, 50-200 employees',
            'Restaurants in California',
          ].map((suggestion) => (
            <button
              key={suggestion}
              className="w-full text-left text-[10px] px-2.5 py-1.5 rounded-md border border-border hover:bg-accent transition-colors text-muted-foreground"
              onClick={() => {
                setInput(suggestion);
              }}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex-shrink-0 p-3 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Sparkles className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="What are you looking for?"
              className="pl-8 h-9 text-xs"
              disabled={isLoading}
            />
          </div>
          <Button
            size="icon"
            className="h-9 w-9 flex-shrink-0"
            onClick={sendMessage}
            disabled={isLoading || !input.trim()}
          >
            <Send className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
