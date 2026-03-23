import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";

interface ThemeProviderProps {
  children: React.ReactNode;
  attribute?: "class" | "data-theme";
  defaultTheme?: string;
  enableSystem?: boolean;
  forcedTheme?: string;
  disableTransitionOnChange?: boolean;
}

export const ThemeProvider = React.forwardRef<HTMLDivElement, ThemeProviderProps>(
  ({ children, ...props }, ref) => (
    <div ref={ref} style={{ display: "contents" }}>
      <NextThemesProvider {...props}>{children}</NextThemesProvider>
    </div>
  )
);
ThemeProvider.displayName = "ThemeProvider";
