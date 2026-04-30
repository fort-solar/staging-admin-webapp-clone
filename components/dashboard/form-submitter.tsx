"use client";

import { type FormEvent, type ReactNode, useState } from "react";
import { Button, cx } from "@/components/dashboard/ui";
import { useToast } from "@/components/ui/toast";
import { submitDashboardForm } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import type { ApiMethod } from "@/types/common.types";

export type FormSubmitIntent = "submit" | "draft" | "publish" | "finish" | "finish-publish";

type SubmitterAction = {
  label: string;
  intent: FormSubmitIntent;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  leadingIcon?: ReactNode;
};

type SubmissionBody = Record<string, unknown> | BodyInit | FormData | null;

type FormSubmissionConfig<TBody, TResponse> = {
  endpoint: string;
  method?: Exclude<ApiMethod, "GET">;
  successTitle?: string;
  successMessage?: string | ((payload: TResponse) => string);
  errorTitle?: string;
  suppressSuccessToast?: boolean;
  suppressErrorToast?: boolean;
  onSuccess?: (payload: TResponse) => void | Promise<void>;
  transformBody?: (body: TBody) => SubmissionBody;
};

export function getFormSubmitIntent(event: FormEvent<HTMLFormElement>, fallback: FormSubmitIntent = "submit") {
  const submitter = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
  const value = submitter?.value as FormSubmitIntent | undefined;

  return value ?? fallback;
}

export function FormSubmitter({
  formId,
  cancelLabel = "Cancel",
  onCancel,
  primaryLabel = "Submit",
  primaryIntent = "submit",
  secondaryActions = [],
  className,
  align = "end",
  disabled,
}: {
  formId: string;
  cancelLabel?: string;
  onCancel?: () => void;
  primaryLabel?: string;
  primaryIntent?: FormSubmitIntent;
  secondaryActions?: SubmitterAction[];
  className?: string;
  align?: "start" | "end" | "between";
  disabled?: boolean;
}) {
  return (
    <div className={cx("form-submitter", `is-${align}`, className)}>
      {onCancel ? (
        <Button variant="secondary" onClick={onCancel} disabled={disabled}>
          {cancelLabel}
        </Button>
      ) : null}
      {secondaryActions.map((action) => (
        <Button
          key={`${action.intent}-${action.label}`}
          type="submit"
          form={formId}
          name="intent"
          value={action.intent}
          variant={action.variant ?? "secondary"}
          leadingIcon={action.leadingIcon}
          disabled={disabled || action.disabled}
        >
          {action.label}
        </Button>
      ))}
      <Button type="submit" form={formId} name="intent" value={primaryIntent} variant="primary" disabled={disabled}>
        {primaryLabel}
      </Button>
    </div>
  );
}

export function useFormSubmission<TBody, TResponse>(config: FormSubmissionConfig<TBody, TResponse>) {
  const { toast } = useToast();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(body: TBody, overrides: Partial<FormSubmissionConfig<TBody, TResponse>> = {}) {
    const endpoint = overrides.endpoint ?? config.endpoint;
    const method = overrides.method ?? config.method ?? "POST";
    const nextConfig = { ...config, ...overrides };

    setError(null);
    setIsSubmitting(true);

    try {
      const requestBody = nextConfig.transformBody ? nextConfig.transformBody(body) : (body as SubmissionBody);
      const payload = await submitDashboardForm<TResponse>(endpoint, requestBody, { method });

      if (!nextConfig.suppressSuccessToast && nextConfig.successTitle) {
        toast({
          title: nextConfig.successTitle,
          description: typeof nextConfig.successMessage === "function" ? nextConfig.successMessage(payload) : nextConfig.successMessage,
          variant: "success",
        });
      }

      await nextConfig.onSuccess?.(payload);
      return payload;
    } catch (submitError) {
      const message = getErrorMessage(submitError, "The form could not be submitted.");
      setError(message);

      if (!nextConfig.suppressErrorToast) {
        toast({
          title: nextConfig.errorTitle ?? "Request failed",
          description: message,
          variant: "error",
        });
      }

      throw submitError;
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    error,
    isSubmitting,
    setError,
    submit,
  };
}
