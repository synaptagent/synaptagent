import Link from "next/link";
import { cn } from "@/lib/utils";

type Variant = "primary" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary:
    "bg-orange-500 text-black hover:bg-orange-600 hover:shadow-[0_0_30px_rgba(255,87,34,0.3)]",
  ghost:
    "border border-zinc-800 text-cream hover:border-zinc-600 hover:bg-zinc-900/50",
  outline:
    "border border-orange-500/30 text-orange-500 hover:bg-orange-500 hover:text-black",
};

const sizes: Record<Size, string> = {
  sm: "px-4 py-2 text-xs",
  md: "px-6 py-3 text-sm",
  lg: "px-8 py-4 text-sm",
};

interface ButtonProps {
  variant?: Variant;
  size?: Size;
  href?: string;
  fullWidth?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function Button({
  variant = "primary",
  size = "md",
  href,
  fullWidth,
  children,
  className,
}: ButtonProps) {
  const cls = cn(
    "group inline-flex items-center justify-center gap-2 rounded-md font-mono uppercase tracking-widest transition-all",
    variants[variant],
    sizes[size],
    fullWidth && "w-full",
    className,
  );

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    );
  }
  return <button className={cls}>{children}</button>;
}
