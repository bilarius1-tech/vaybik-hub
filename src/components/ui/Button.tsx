import { cn } from "@/lib/cn";
import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "ghost" | "danger";
type Size = "sm" | "md";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

const variants: Record<Variant, string> = {
  primary:
    "bg-ac text-ac-contrast shadow-[0_4px_14px_color-mix(in_srgb,var(--ac)_33%,transparent)] hover:brightness-110",
  ghost: "bg-card text-tx border border-bd hover:bg-card2",
  danger: "bg-rd text-white hover:brightness-110",
};

const sizes: Record<Size, string> = {
  sm: "px-3 py-1.5 text-[12.5px]",
  md: "px-3.5 py-2 text-[13px]",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  type = "button",
  ...rest
}: Props) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md font-bold transition-[filter,background-color] duration-150 disabled:opacity-50",
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}
