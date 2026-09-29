import { createContext, useContext, useState, type ReactNode } from "react";

type Ctx = { open: boolean; prompt: string | null; openAssistant: (prompt?: string) => void; close: () => void; clearPrompt: () => void };

const defaultContextValue: Ctx = { open: false, prompt: null, openAssistant: () => {}, close: () => {}, clearPrompt: () => {} };
const AssistantCtx = createContext<Ctx>(defaultContextValue);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  return (
    <AssistantCtx.Provider value={{
      open, prompt,
      openAssistant: (p) => { setPrompt(p ?? null); setOpen(true); },
      close: () => setOpen(false),
      clearPrompt: () => setPrompt(null),
    }}>
      {children}
    </AssistantCtx.Provider>
  );
}

export const useAssistant = () => useContext(AssistantCtx);
