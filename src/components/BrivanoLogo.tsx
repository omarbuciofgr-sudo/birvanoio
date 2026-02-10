import brivanoLogo from "@/assets/logo-min-4.png";

interface BrivanoLogoProps {
  className?: string;
}

export function BrivanoLogo({ className = "h-20" }: BrivanoLogoProps) {
  return (
    <div
      className={`${className} w-auto aspect-[4/1] bg-foreground`}
      style={{
        maskImage: `url(${brivanoLogo})`,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskImage: `url(${brivanoLogo})`,
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
      }}
      role="img"
      aria-label="Brivano"
    />
  );
}
