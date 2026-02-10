import brivanoLogo from "@/assets/brivano-logo-transparent.png";

interface BrivanoLogoProps {
  className?: string;
}

export function BrivanoLogo({ className = "h-20" }: BrivanoLogoProps) {
  return (
    <img
      src={brivanoLogo}
      alt="Brivano"
      className={`${className} w-auto dark:invert`}
    />
  );
}
