import { cn } from "@workspace/ui/lib/utils";
import Image from "next/image";

export const Logo = ({ className }: { className?: string }) => {
  return (
    <Image
      src="/meeting/intevia_logo.svg"
      alt="INTEVIA"
      width={100}
      height={100}
      className={cn("h-8 w-auto", className)}
      priority
    />
  );
};

export const LogoText = ({ className }: { className?: string }) => {
  return (
    <Image
      src="/meeting/intevia(+logo).svg"
      alt="INTEVIA"
      width={200}
      height={100}
      className={cn("h-8 w-auto", className)}
      priority
    />
  );
};
