import Image from 'next/image';

interface LogoProps {
  size?: number;
  withWordmark?: boolean;
}

export function Logo({ size = 36, withWordmark = true }: LogoProps) {
  return (
    <div className="flex items-center gap-3">
      <Image
        src="/brand/octera-logo.png"
        alt="Octera"
        width={size}
        height={size}
        priority
        className="h-auto w-auto"
        style={{ height: size, width: size }}
      />
      {withWordmark && (
        <span className="text-xl font-semibold tracking-tight text-octera-text">
          Octera
        </span>
      )}
    </div>
  );
}
