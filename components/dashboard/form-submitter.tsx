"use client";

import type { FormEvent, ReactNode } from "react";
import { Button, cx } from "@/components/dashboard/ui";

export type FormSubmitIntent = "submit" | "draft" | "publish" | "finish" | "finish-publish";

type SubmitterAction = {
  label: string;
  intent: FormSubmitIntent;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  leadingIcon?: ReactNode;
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
