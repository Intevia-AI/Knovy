import { cn } from "@workspace/ui/lib/utils";
import Image from "next/image";

export const Logo = ({ className }: { className?: string }) => {
  return (
    <Image
      src="/placeholder.png"
      alt="Logo"
      width={100}
      height={100}
      className={cn("h-8 w-auto", className)}
      priority
    />
  );
};
