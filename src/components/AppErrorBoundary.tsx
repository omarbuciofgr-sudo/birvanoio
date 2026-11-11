import * as React from "react";
import { Button } from "@/components/ui/button";

export class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error("App error:", error, info.componentStack); }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-6">
        <div className="max-w-sm w-full rounded-lg border border-border bg-card p-6 text-center shadow-sm">
          <h1 className="text-lg font-semibold text-foreground">Something went wrong</h1>
          <p className="mt-2 text-sm text-muted-foreground">Please reload the page to continue.</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>Reload</Button>
        </div>
      </div>
    );
  }
}
