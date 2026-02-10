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
      className={`${textSize} font-bold tracking-tight text-foreground`}
      style={{ fontFamily: "'Nunito', sans-serif", letterSpacing: "-0.02em" }}
      role="img"
      aria-label="Brivano"
    >
      brivano
    </span>
  );
}
