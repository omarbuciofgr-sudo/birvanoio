interface BrivanoLogoProps {
  className?: string;
}

export function BrivanoLogo({ className = "h-20" }: BrivanoLogoProps) {
  // Map height classes to appropriate text sizes
  const sizeMap: Record<string, string> = {
    "h-8": "text-lg",
    "h-16": "text-2xl",
    "h-16 mx-auto": "text-2xl",
    "h-20": "text-2xl",
  };

  const textSize = sizeMap[className] || "text-xl";

  return (
    <span
      className={`${textSize} font-semibold tracking-tight text-foreground`}
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
      role="img"
      aria-label="Brivano"
    >
      brivano
    </span>
  );
}
