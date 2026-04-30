"use client";

import * as ToastPrimitive from "@radix-ui/react-toast";
import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { cx } from "@/components/dashboard/ui";

type ToastVariant = "success" | "error" | "info";

type ToastRecord = {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
  duration: number;
};

type ToastInput = {
  title: string;
  description?: string;
  variant?: ToastVariant;
  duration?: number;
};

type ToastContextValue = {
  toast: (input: ToastInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: string) => void }) {
  return (
    <ToastPrimitive.Root
      open
      duration={toast.duration}
      className={cx("dashboard-toast", `is-${toast.variant}`)}
      onOpenChange={(open) => {
        if (!open) {
          onDismiss(toast.id);
        }
      }}
    >
      <div className="dashboard-toast__body">
        <ToastPrimitive.Title className="dashboard-toast__title">{toast.title}</ToastPrimitive.Title>
        {toast.description ? <ToastPrimitive.Description className="dashboard-toast__description">{toast.description}</ToastPrimitive.Description> : null}
      </div>
      <ToastPrimitive.Close className="dashboard-toast__close" aria-label="Dismiss notification">
        ×
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((item) => item.id !== id));
  }, []);

  const toast = useCallback((input: ToastInput) => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    setToasts((current) => [
      ...current,
      {
        id,
        title: input.title,
        description: input.description,
        variant: input.variant ?? "info",
        duration: input.duration ?? 5500,
      },
    ]);

    return id;
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [dismiss, toast]);

  return (
    <ToastContext.Provider value={value}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {toasts.map((record) => (
          <ToastItem key={record.id} toast={record} onDismiss={dismiss} />
        ))}
        <ToastPrimitive.Viewport className="dashboard-toast-viewport" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider.");
  }

  return context;
}
