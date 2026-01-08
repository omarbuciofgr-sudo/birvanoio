import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageCircle, X, Send } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

const ChatWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState("");

  const handleSend = () => {
    if (!message.trim()) return;
    
    toast.success("Message sent! We'll get back to you shortly.");
    setMessage("");
    setIsOpen(false);
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
          <div className="p-4 h-48 overflow-y-auto bg-secondary/30">
            <div className="bg-card p-3 rounded-lg rounded-tl-none max-w-[80%] border border-border">
              <p className="text-sm text-foreground">
                👋 Hi there! How can we help you today?
              </p>
              <p className="text-xs text-muted-foreground mt-1">Just now</p>
            </div>
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
