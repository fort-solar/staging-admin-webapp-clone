"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { ErrorMessage } from "@/components/dashboard/error-message";
import { FormField, Modal, ModalFooterActions, ModalTextArea, ModalTextInput } from "@/components/dashboard/modals";
import { useToast } from "@/components/ui/toast";
import { createCustomer } from "@/lib/admin-api";
import { getErrorMessage } from "@/lib/api/errors";
import type { CreateCustomerRequest } from "@/types/api.types";

type CustomerFormState = CreateCustomerRequest;

const defaultFormState: CustomerFormState = {
  email: "",
  password: "",
  name: "",
  phone: "",
  address: "",
};

export function CreateCustomerModal({
  open,
  onClose,
  onCreated,
  title = "Create Customer",
  initialValues,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: (customer: CreateCustomerRequest) => Promise<void> | void;
  title?: string;
  initialValues?: Partial<CreateCustomerRequest>;
}) {
  const { toast } = useToast();
  const [form, setForm] = useState<CustomerFormState>(defaultFormState);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mergedInitialValues = useMemo(
    () => ({
      ...defaultFormState,
      ...initialValues,
    }),
    [initialValues],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    setForm(mergedInitialValues);
    setError(null);
  }, [mergedInitialValues, open]);

  function handleClose(force = false) {
    if (isSaving && !force) {
      return;
    }

    setError(null);
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    const payload: CreateCustomerRequest = {
      email: form.email.trim(),
      password: form.password,
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim(),
    };

    try {
      await createCustomer(payload);
      await onCreated?.(payload);
      toast({
        title: "Customer created",
        description: `${payload.name || payload.email} was added successfully.`,
        variant: "success",
      });
      handleClose(true);
    } catch (createError) {
      const message = getErrorMessage(createError, "The customer could not be created.");
      setError(message);
      toast({
        title: "Create customer failed",
        description: message,
        variant: "error",
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={title}
      size="lg"
      footer={<ModalFooterActions formId="create-customer-form" cancelLabel="Cancel" submitLabel={isSaving ? "Creating..." : "Create Customer"} onCancel={handleClose} disabled={isSaving} />}
    >
      <ErrorMessage title="Customer creation failed" message={error} />

      <form id="create-customer-form" className="flex flex-col gap-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 md:grid-cols-2">
          <FormField label="Full Name">
            <ModalTextInput value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="Customer name" />
          </FormField>
          <FormField label="Email Address">
            <ModalTextInput value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} placeholder="user@example.com" type="email" />
          </FormField>
          <FormField label="Phone Number">
            <ModalTextInput value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="+2348000000000" />
          </FormField>
          <FormField label="Password">
            <ModalTextInput value={form.password} onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))} placeholder="Create a password" type="password" />
          </FormField>
        </div>

        <FormField label="Address">
          <ModalTextArea value={form.address} onChange={(value) => setForm((current) => ({ ...current, address: value }))} placeholder="Customer address" />
        </FormField>
      </form>
    </Modal>
  );
}
