import * as React from "react";
import { cn } from "@/lib/utils";

const base =
  "w-full rounded-xl border border-border bg-card px-4 text-sm text-foreground placeholder:text-muted focus:border-brand focus-visible:outline-none transition-colors";

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input ref={ref} className={cn(base, "h-11", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, "py-3 min-h-32 resize-y", className)} {...props} />
));
Textarea.displayName = "Textarea";
