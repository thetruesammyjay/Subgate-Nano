import Image from "next/image";

type BrandMarkProps = {
  compact?: boolean;
};

export function BrandMark({ compact = false }: BrandMarkProps) {
  return (
    <Image
      src={compact ? "/subgate-ico.png" : "/subgate-logo.png"}
      alt="Subgate Nano"
      className={compact ? "brand-image brand-image-compact" : "brand-image"}
      width={compact ? 36 : 174}
      height={compact ? 36 : 38}
      priority
    />
  );
}
