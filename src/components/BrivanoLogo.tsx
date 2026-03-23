import * as React from "react";
import brivanoLogo from "@/assets/brivano-logo-transparent.png";

interface BrivanoLogoProps {
  className?: string;
}

export const BrivanoLogo = React.forwardRef<HTMLImageElement, BrivanoLogoProps>(
  function BrivanoLogo({ className = "h-8" }, ref) {
    return (
      <img
        ref={ref}
        src={brivanoLogo}
        alt="Brivano"
        className={`${className} w-auto dark:invert`}
      />
    );
  }
);
