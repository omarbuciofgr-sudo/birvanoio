import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Send, Loader2, Bot, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Message {
  id: string;
  sender_type: 'visitor' | 'support';
  message: string;
  created_at: string;
}

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [isSending, setIsSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Add initial welcome message
    setMessages([{
      id: 'welcome',
      sender_type: 'support',
      message: '👋 Hi there! I\'m Brivano\'s AI assistant. I can help you learn about our lead generation platform, answer questions, or connect you with our team. What brings you here today?',
      created_at: new Date().toISOString()
    }]);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || isSending) return;
    
    setIsSending(true);
    const messageText = message.trim();
    setMessage("");

    // Optimistically add message to UI
    const tempMessage: Message = {
      id: crypto.randomUUID(),
      sender_type: 'visitor',
      message: messageText,
      created_at: new Date().toISOString()
    };
    setMessages(prev => [...prev, tempMessage]);

    try {
      // Save visitor message to database
      const { error: insertError } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          sender_type: 'visitor',
          message: messageText
        });

      if (insertError) {
        if (insertError.message?.includes('rate') || insertError.code === '23514') {
          toast.error("Too many messages. Please wait a moment.");
          return;
        }
        throw insertError;
      }

      // Show typing indicator
      setIsTyping(true);

      // Get AI response
      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: { 
          message: messageText, 
          sessionId,
          conversationHistory: messages.filter(m => m.id !== 'welcome')
        },
      });

      setIsTyping(false);

      if (error) throw error;

      if (data?.message) {
        const aiMessage: Message = {
          id: crypto.randomUUID(),
          sender_type: 'support',
          message: data.message,
          created_at: new Date().toISOString()
        };
        setMessages(prev => [...prev, aiMessage]);

        if (data.captured) {
          // AI captured lead info
          if (data.captured.email || data.captured.phone) {
            toast.success("Thanks for sharing your info! We'll be in touch soon.", {
              icon: <Sparkles className="w-4 h-4" />
            });
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      setIsTyping(false);
      
      // Add a fallback message
      const fallbackMessage: Message = {
        id: crypto.randomUUID(),
        sender_type: 'support',
        message: "I'm having a bit of trouble right now. Please try again or email us at info@brivano.io!",
        created_at: new Date().toISOString()
      };
      setMessages(prev => [...prev, fallbackMessage]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 sm:w-96 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="bg-primary p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <Bot className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h4 className="font-medium text-primary-foreground flex items-center gap-1.5">
                    Brivano AI
                    <Sparkles className="w-3.5 h-3.5" />
                  </h4>
                  <p className="text-xs text-primary-foreground/80">Powered by AI • Always available</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="text-primary-foreground/80 hover:text-primary-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="p-4 h-72 overflow-y-auto bg-secondary/30 space-y-3">
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className={`p-3 rounded-lg max-w-[85%] border border-border ${
                  msg.sender_type === 'visitor' 
                    ? 'ml-auto bg-primary text-primary-foreground rounded-br-none' 
                    : 'bg-card rounded-tl-none'
                }`}
              >
                <p className={`text-sm ${msg.sender_type === 'visitor' ? 'text-primary-foreground' : 'text-foreground'}`}>
                  {msg.message}
                </p>
              </div>
            ))}
            
            {/* Typing Indicator */}
            {isTyping && (
              <div className="p-3 rounded-lg max-w-[85%] bg-card border border-border rounded-tl-none">
                <div className="flex items-center gap-1">
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border bg-card">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ask me anything..."
                className="flex-1 bg-secondary/50"
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
                disabled={isSending}
              />
              <Button 
                size="icon" 
                onClick={handleSend} 
                className="shrink-0"
                disabled={isSending || !message.trim()}
              >
                {isSending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle Button */}
      <Button
        size="lg"
        onClick={() => setIsOpen(!isOpen)}
        className={`rounded-full w-14 h-14 shadow-lg transition-all duration-300 ${
          isOpen 
            ? "bg-muted text-muted-foreground hover:bg-muted/80" 
            : "bg-primary text-primary-foreground hover:bg-primary/90 glow-box"
        }`}
      >
        {isOpen ? (
          <X className="w-6 h-6" />
        ) : (
          <MessageCircle className="w-6 h-6" />
        )}
      </Button>

      {/* Notification Dot */}
      {!isOpen && (
        <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-background animate-pulse" />
      )}
    </div>
  );
};

export default ChatWidget;
