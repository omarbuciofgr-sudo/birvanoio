interface BrivanoLogoProps {
  className?: string;
}

export function BrivanoLogo({ className = "h-20" }: BrivanoLogoProps) {
  const sizeMap: Record<string, string> = {
    "h-8": "text-xl",
    "h-16": "text-3xl",
    "h-16 mx-auto": "text-3xl",
    "h-20": "text-3xl",
  };

  const textSize = sizeMap[className] || "text-2xl";

  return (
    <span
      className={`${textSize} font-bold text-foreground brivano-logo-font`}
      role="img"
      aria-label="Brivano"
    >
      brivano
    </span>
  );
}
