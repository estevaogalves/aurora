import { cn } from "@/lib/utils";

export default function Logo({ className }: { className?: string }) {
  return (
    <img
      src="/logo.svg"
      alt=""
      aria-hidden="true"
      className={cn("h-10 w-10 rounded-xl", className)}
    />
  );
}
