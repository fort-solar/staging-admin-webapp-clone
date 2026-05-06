"use client";

import { useEffect, useRef } from "react";
import { useToast } from "@/components/ui/toast";
import { isSessionErrorMessage } from "@/lib/api/errors";

export function ErrorMessage({
  title = "Something went wrong",
  message,
}: {
  title?: string;
  message?: string | null;
  className?: string;
}) {
  const { toast } = useToast();
  const lastMessageRef = useRef<string | null>(null);

  useEffect(() => {
    if (!message) {
      lastMessageRef.current = null;
      return;
    }

    if (isSessionErrorMessage(message)) {
      return;
    }

    const key = `${title}:${message}`;

    if (lastMessageRef.current === key) {
      return;
    }

    lastMessageRef.current = key;
    toast({
      title,
      description: message,
      variant: "error",
    });
  }, [message, title, toast]);

  return null;
}
