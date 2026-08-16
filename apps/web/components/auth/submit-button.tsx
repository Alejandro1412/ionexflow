"use client";

import { useFormStatus } from "react-dom";
import { Button, type ButtonProps } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingText,
  ...props
}: ButtonProps & { pendingText: string }) {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" disabled={pending} className="w-full" {...props}>
      {pending ? pendingText : children}
    </Button>
  );
}
