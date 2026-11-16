import { cn } from "@/lib/cn";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";

type FieldProps = {
  label: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
};

export function Field({ label, htmlFor, children, className }: FieldProps) {
  return (
    <label className={cn("block", className)} htmlFor={htmlFor}>
      <span className="mb-1 mt-2.5 block text-[12.5px] font-semibold text-mu">
        {label}
      </span>
      {children}
    </label>
  );
}

const controlClass =
  "w-full rounded-md border border-bd bg-bg2 px-[11px] py-[9px] text-[14px] font-semibold text-tx outline-none transition-[border-color,box-shadow] duration-150 focus:border-ac focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--ac)_17%,transparent)]";

type InputProps = InputHTMLAttributes<HTMLInputElement>;

export function Input({ className, ...rest }: InputProps) {
  return <input className={cn(controlClass, className)} {...rest} />;
}

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

export function Select({ className, children, ...rest }: SelectProps) {
  return (
    <select className={cn(controlClass, className)} {...rest}>
      {children}
    </select>
  );
}
