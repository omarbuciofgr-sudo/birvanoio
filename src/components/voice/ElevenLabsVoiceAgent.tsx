import { useConversation } from "@elevenlabs/react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Mic, MicOff, Phone, PhoneOff, Loader2, Volume2 } from "lucide-react";
import { toast } from "sonner";

interface ElevenLabsVoiceAgentProps {
  agentId: string;
  leadName?: string;
  onTranscriptUpdate?: (transcript: string) => void;
  onCallEnd?: (summary: string) => void;
}

export function ElevenLabsVoiceAgent({
  agentId,
  leadName,
  onTranscriptUpdate,
  onCallEnd,
}: ElevenLabsVoiceAgentProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const conversation = useConversation({
    onConnect: () => {
      console.log("Connected to ElevenLabs agent");
      toast.success("Connected to AI voice agent");
      setError(null);
    },
    onDisconnect: () => {
      console.log("Disconnected from ElevenLabs agent");
      const fullTranscript = transcript.join("\n");
      if (onCallEnd && fullTranscript) {
        onCallEnd(fullTranscript);
      }
    },
    onMessage: (message: any) => {
      console.log("Message from agent:", message);
      const messageType = message?.type || message?.message?.type;
      if (messageType === "user_transcript") {
        const userText = `You: ${message?.user_transcription_event?.user_transcript || message?.message?.user_transcription_event?.user_transcript || ""}`;
        setTranscript(prev => {
          const updated = [...prev, userText];
          onTranscriptUpdate?.(updated.join("\n"));
          return updated;
        });
      } else if (messageType === "agent_response") {
        const agentText = `Agent: ${message?.agent_response_event?.agent_response || message?.message?.agent_response_event?.agent_response || ""}`;
        setTranscript(prev => {
          const updated = [...prev, agentText];
          onTranscriptUpdate?.(updated.join("\n"));
          return updated;
        });
      }
    },
    onError: (error) => {
      console.error("ElevenLabs error:", error);
      setError("Connection error. Please try again.");
      toast.error("Voice agent connection error");
    },
  });

  const startConversation = useCallback(async () => {
    setIsConnecting(true);
    setError(null);
    setTranscript([]);

    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get token from edge function
      const { data, error: fnError } = await supabase.functions.invoke(
        "elevenlabs-conversation-token",
        { body: { agentId } }
      );

      if (fnError || !data?.token) {
        throw new Error(fnError?.message || "Failed to get conversation token");
      }

      // Start the conversation with WebRTC
      await conversation.startSession({
        conversationToken: data.token,
        connectionType: "webrtc",
      });
    } catch (err: any) {
      console.error("Failed to start conversation:", err);
      setError(err.message || "Failed to start conversation");
      toast.error(err.message || "Failed to connect to voice agent");
    } finally {
      setIsConnecting(false);
    }
  }, [agentId, conversation]);

  const stopConversation = useCallback(async () => {
    await conversation.endSession();
    toast.info("Call ended");
  }, [conversation]);

  const isConnected = conversation.status === "connected";

  return (
    <Card className="border-primary/20">
      <CardContent className="pt-6 space-y-4">
        {/* Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge 
              variant={isConnected ? "default" : "secondary"}
              className={isConnected ? "bg-green-500" : ""}
            >
              {isConnected ? "Connected" : "Disconnected"}
            </Badge>
            {leadName && (
              <span className="text-sm text-muted-foreground">
                Calling: {leadName}
              </span>
            )}
          </div>
          {isConnected && (
            <div className="flex items-center gap-2">
              {conversation.isSpeaking ? (
                <Badge variant="outline" className="gap-1">
                  <Volume2 className="w-3 h-3 animate-pulse" />
                  Agent speaking
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1">
                  <Mic className="w-3 h-3" />
                  Listening
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Transcript */}
        {transcript.length > 0 && (
          <div className="p-3 bg-secondary/50 rounded-lg max-h-48 overflow-y-auto space-y-1">
            {transcript.map((line, i) => (
              <p key={i} className={`text-sm ${line.startsWith("Agent:") ? "text-primary" : "text-foreground"}`}>
                {line}
              </p>
            ))}
          </div>
        )}

        {/* Controls */}
        <div className="flex gap-3">
          {!isConnected ? (
            <Button
              onClick={startConversation}
              disabled={isConnecting}
              className="flex-1 gap-2"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Phone className="w-4 h-4" />
                  Start AI Call
                </>
              )}
            </Button>
          ) : (
            <Button
              onClick={stopConversation}
              variant="destructive"
              className="flex-1 gap-2"
            >
              <PhoneOff className="w-4 h-4" />
              End Call
            </Button>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          Powered by ElevenLabs Conversational AI
        </p>
      </CardContent>
    </Card>
  );
}
