import { useState, useEffect, useCallback } from "react";
import { Phone, PhoneOff, Mic, MicOff, Pause, Play, Hash, PhoneForwarded, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CallDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  leadName: string | null;
  leadPhone: string | null;
  onEndCall: () => void;
}

type CallStatus = "ringing" | "connected" | "on_hold" | "ended";

export function CallDialog({
  open,
  onOpenChange,
  leadName,
  leadPhone,
  onEndCall,
}: CallDialogProps) {
  const [callStatus, setCallStatus] = useState<CallStatus>("ringing");
  const [isMuted, setIsMuted] = useState(false);
  const [showKeypad, setShowKeypad] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [transferNumber, setTransferNumber] = useState("");
  const [dtmfInput, setDtmfInput] = useState("");
  const [callDuration, setCallDuration] = useState(0);

  // Simulate call connecting after a delay
  useEffect(() => {
    if (open && callStatus === "ringing") {
      const timer = setTimeout(() => {
        setCallStatus("connected");
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [open, callStatus]);

  // Call duration timer
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callStatus === "connected") {
      interval = setInterval(() => {
        setCallDuration((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callStatus]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setCallStatus("ringing");
      setIsMuted(false);
      setShowKeypad(false);
      setShowTransfer(false);
      setTransferNumber("");
      setDtmfInput("");
      setCallDuration(0);
    }
  }, [open]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  const handleHoldToggle = () => {
    setCallStatus(callStatus === "on_hold" ? "connected" : "on_hold");
  };

  const handleKeypadPress = (digit: string) => {
    setDtmfInput((prev) => prev + digit);
    // In a real implementation, you would send DTMF tones here
    console.log("DTMF:", digit);
  };

  const handleEndCall = () => {
    setCallStatus("ended");
    setTimeout(() => {
      onEndCall();
      onOpenChange(false);
    }, 1000);
  };

  const handleTransfer = () => {
    if (transferNumber) {
      console.log("Transferring to:", transferNumber);
      // In a real implementation, you would transfer the call here
      setShowTransfer(false);
      handleEndCall();
    }
  };

  const keypadButtons = [
    ["1", "2", "3"],
    ["4", "5", "6"],
    ["7", "8", "9"],
    ["*", "0", "#"],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center">
            {callStatus === "ended" ? "Call Ended" : leadName || leadPhone}
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-6 py-4">
          {/* Call Status Indicator */}
          <div className="relative">
            <div
              className={cn(
                "w-24 h-24 rounded-full flex items-center justify-center",
                callStatus === "ringing" && "bg-primary/20 animate-pulse",
                callStatus === "connected" && "bg-green-500/20",
                callStatus === "on_hold" && "bg-yellow-500/20",
                callStatus === "ended" && "bg-muted"
              )}
            >
              <Phone
                className={cn(
                  "w-10 h-10",
                  callStatus === "ringing" && "text-primary animate-bounce",
                  callStatus === "connected" && "text-green-500",
                  callStatus === "on_hold" && "text-yellow-500",
                  callStatus === "ended" && "text-muted-foreground"
                )}
              />
            </div>
            {callStatus === "ringing" && (
              <div className="absolute inset-0 rounded-full border-2 border-primary animate-ping" />
            )}
          </div>

          {/* Status Text */}
          <div className="text-center">
            <p className="text-lg font-medium text-foreground">
              {callStatus === "ringing" && "Ringing..."}
              {callStatus === "connected" && formatDuration(callDuration)}
              {callStatus === "on_hold" && "On Hold"}
              {callStatus === "ended" && "Call Ended"}
            </p>
            <p className="text-sm text-muted-foreground">{leadPhone}</p>
          </div>

          {/* Keypad View */}
          {showKeypad && callStatus !== "ended" && (
            <div className="space-y-3">
              <Input
                value={dtmfInput}
                readOnly
                className="text-center text-xl tracking-widest"
                placeholder="DTMF"
              />
              <div className="grid grid-cols-3 gap-2">
                {keypadButtons.flat().map((digit) => (
                  <Button
                    key={digit}
                    variant="outline"
                    className="w-14 h-14 text-xl"
                    onClick={() => handleKeypadPress(digit)}
                  >
                    {digit}
                  </Button>
                ))}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="w-full"
                onClick={() => setShowKeypad(false)}
              >
                Hide Keypad
              </Button>
            </div>
          )}

          {/* Transfer View */}
          {showTransfer && callStatus !== "ended" && (
            <div className="space-y-3 w-full">
              <Input
                value={transferNumber}
                onChange={(e) => setTransferNumber(e.target.value)}
                placeholder="Enter number to transfer to"
                className="text-center"
              />
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  className="flex-1"
                  onClick={() => setShowTransfer(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleTransfer}
                  disabled={!transferNumber}
                >
                  <PhoneForwarded className="w-4 h-4 mr-2" />
                  Transfer
                </Button>
              </div>
            </div>
          )}

          {/* Call Controls */}
          {!showKeypad && !showTransfer && callStatus !== "ended" && (
            <div className="grid grid-cols-4 gap-3">
              {/* Mute */}
              <Button
                variant={isMuted ? "default" : "outline"}
                size="lg"
                className="flex flex-col gap-1 h-auto py-3"
                onClick={handleMuteToggle}
                disabled={callStatus === "ringing"}
              >
                {isMuted ? (
                  <MicOff className="w-5 h-5" />
                ) : (
                  <Mic className="w-5 h-5" />
                )}
                <span className="text-xs">Mute</span>
              </Button>

              {/* Hold */}
              <Button
                variant={callStatus === "on_hold" ? "default" : "outline"}
                size="lg"
                className="flex flex-col gap-1 h-auto py-3"
                onClick={handleHoldToggle}
                disabled={callStatus === "ringing"}
              >
                {callStatus === "on_hold" ? (
                  <Play className="w-5 h-5" />
                ) : (
                  <Pause className="w-5 h-5" />
                )}
                <span className="text-xs">Hold</span>
              </Button>

              {/* Keypad */}
              <Button
                variant="outline"
                size="lg"
                className="flex flex-col gap-1 h-auto py-3"
                onClick={() => setShowKeypad(true)}
                disabled={callStatus === "ringing"}
              >
                <Hash className="w-5 h-5" />
                <span className="text-xs">Keypad</span>
              </Button>

              {/* Transfer */}
              <Button
                variant="outline"
                size="lg"
                className="flex flex-col gap-1 h-auto py-3"
                onClick={() => setShowTransfer(true)}
                disabled={callStatus === "ringing"}
              >
                <PhoneForwarded className="w-5 h-5" />
                <span className="text-xs">Transfer</span>
              </Button>
            </div>
          )}

          {/* End Call Button */}
          {callStatus !== "ended" && (
            <Button
              variant="destructive"
              size="lg"
              className="w-full gap-2"
              onClick={handleEndCall}
            >
              <PhoneOff className="w-5 h-5" />
              End Call
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
