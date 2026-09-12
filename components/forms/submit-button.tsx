"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingText,
  variant = "default",
  className,
  formAction,
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: "default" | "outline" | "destructive" | "ghost";
  className?: string;
  formAction?: (formData: FormData) => void | Promise<void>;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} size="lg" className={`h-11 ${className ?? ""}`} disabled={pending} formAction={formAction}>
      {pending ? (pendingText ?? children) : children}
    </Button>
  );
}
