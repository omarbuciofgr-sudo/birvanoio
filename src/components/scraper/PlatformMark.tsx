import { useState, useEffect } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  logoSrc: string | null;
  fallbackLetter: string;
  className?: string;
  imgClassName?: string;
  title?: string;
  /** `sm` for listing rows; `md` for dropdown (default) */
  size?: 'sm' | 'md';
};

/**
 * Local platform SVG from `/public/platform-logos/` with letter fallback (no Google favicon / gstatic).
 */
export function PlatformMark({ logoSrc, fallbackLetter, className, imgClassName, title, size = 'md' }: Props) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [logoSrc]);
  const letter = (fallbackLetter && /^[a-z0-9]/i.test(fallbackLetter) ? fallbackLetter.charAt(0) : '?').toUpperCase();
  const box = size === 'sm' ? 'h-3.5 w-3.5 text-[8px]' : 'h-4 w-4 text-[9px]';

  if (!logoSrc || failed) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full bg-muted font-bold text-muted-foreground',
          box,
          className,
        )}
        title={title}
      >
        {letter}
      </span>
    );
  }

  return (
    <img
      key={logoSrc}
      src={logoSrc}
      alt=""
      title={title}
      className={cn('shrink-0 rounded-full object-cover', box, imgClassName)}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
