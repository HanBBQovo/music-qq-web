import Image from "next/image";
import { cn } from "@/lib/utils";
import { ComponentProps } from "react";

interface RemoteImageProps
  extends Omit<ComponentProps<typeof Image>, "src" | "alt"> {
  src: string;
  alt?: string;
  className?: string;
  fallbackIcon?: React.ReactNode;
}

export default function RemoteImage({
  src,
  alt = "image",
  className,
  fallbackIcon,
  ...rest
}: RemoteImageProps) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      sizes="100vw"
      className={cn("object-cover", className)}
      onError={(e) => {
        const target = e.currentTarget as unknown as HTMLElement;
        target.style.display = "none";
        if (target.parentElement && fallbackIcon) {
          target.parentElement.innerHTML = "";
          target.parentElement.appendChild(
            (fallbackIcon as unknown as HTMLElement) ??
              document.createElement("span")
          );
        }
      }}
      {...rest}
    />
  );
}
