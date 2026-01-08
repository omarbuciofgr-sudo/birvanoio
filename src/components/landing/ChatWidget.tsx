import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Send } from "lucide-react";
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

  useEffect(() => {
    // Add initial welcome message
    setMessages([{
      id: 'welcome',
      sender_type: 'support',
      message: '👋 Hi there! How can we help you today?',
      created_at: new Date().toISOString()
    }]);
  }, []);

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
      // Save to database - notifications are handled server-side via database trigger
      const { error } = await supabase
        .from('chat_messages')
        .insert({
          session_id: sessionId,
          sender_type: 'visitor',
          message: messageText
        });

      if (error) {
        // Check for rate limit violation
        if (error.message?.includes('rate') || error.code === '23514') {
          toast.error("Too many messages. Please wait a moment before sending another.");
          return;
        }
        throw error;
      }

      toast.success("Message sent! We'll get back to you shortly.");
    } catch (error) {
      console.error('Error sending message:', error);
      toast.error("Failed to send message. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50">
      {/* Chat Panel */}
      {isOpen && (
        <div className="absolute bottom-16 right-0 w-80 bg-card border border-border rounded-2xl shadow-2xl overflow-hidden animate-fade-in">
          {/* Header */}
          <div className="bg-primary p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-primary-foreground" />
                </div>
                <div>
                  <h4 className="font-medium text-primary-foreground">Brivano Support</h4>
                  <p className="text-xs text-primary-foreground/80">Usually replies in minutes</p>
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
          <div className="p-4 h-48 overflow-y-auto bg-secondary/30 space-y-3">
            {messages.map((msg) => (
              <div 
                key={msg.id}
                className={`p-3 rounded-lg max-w-[80%] border border-border ${
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
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border bg-card">
            <div className="flex gap-2">
              <Input
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-secondary/50"
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
              />
              <Button size="icon" onClick={handleSend} className="shrink-0">
                <Send className="w-4 h-4" />
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
