"use client";

import type { ChangeEvent, ReactNode } from "react";
import { FormSubmitter } from "@/components/dashboard/form-submitter";
import { SelectField, TextAreaField, TextField, cx, type SelectOption } from "@/components/dashboard/ui";
import { MessageIcon, PhoneIcon, ProductsIcon, SearchIcon } from "@/components/dashboard/icons";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";

export function Modal({
  open,
  title,
  onClose,
  children,
  footer,
  size = "md",
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className={cx("modal-card", size === "lg" && "is-large")}>
        <div className="modal-card__header">
          <DialogTitle>{title}</DialogTitle>
          <DialogClose type="button" className="modal-card__close" aria-label="Close modal">
            ×
          </DialogClose>
        </div>
        <div className="modal-card__body">{children}</div>
        {footer ? <div className="modal-card__footer">{footer}</div> : null}
      </DialogContent>
    </Dialog>
  );
}

export function FormField({
  label,
  icon,
  hint,
  children,
}: {
  label: string;
  icon?: ReactNode;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="form-field">
      <span className="form-field__label">
        {icon}
        <span>{label}</span>
      </span>
      {children}
      {hint ? <small className="form-field__hint">{hint}</small> : null}
    </label>
  );
}

export function ModalTextInput({
  value,
  onChange,
  placeholder,
  type,
}: {
  value: string;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  type?: "text" | "email" | "password";
}) {
  return <TextField value={value} onChange={onChange} placeholder={placeholder} type={type} />;
}

export function ModalTextArea({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return <TextAreaField value={value} onChange={onChange} placeholder={placeholder} rows={4} />;
}

export function ModalSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled,
  required,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
}) {
  return <SelectField value={value} onChange={onChange} options={options} placeholder={placeholder} disabled={disabled} required={required} />;
}

export function ChipPicker({
  active,
  options,
  onToggle,
  searchable,
}: {
  active: string[];
  options: string[];
  onToggle: (value: string) => void;
  searchable?: string;
}) {
  return (
    <div className="chip-picker">
      {searchable !== undefined ? (
        <div className="chip-picker__search">
          <span className="chip-picker__active">{active[0] ?? "Select option"}</span>
          <label className="chip-picker__input">
            <SearchIcon className="mini-icon" />
            <input value={searchable} readOnly placeholder="Search or add expertise" />
          </label>
        </div>
      ) : null}
      <div className="chip-picker__list">
        {options.map((option) => (
          <button key={option} type="button" className={cx("chip-pill", active.includes(option) && "is-active")} onClick={() => onToggle(option)}>
            {active.includes(option) ? "" : "+"} {option}
          </button>
        ))}
      </div>
    </div>
  );
}

export function UploadField({
  value,
  onChange,
  placeholder = "No file chosen",
  buttonLabel = "Upload file",
  accept,
  showIcon = false,
}: {
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  buttonLabel?: string;
  accept?: string;
  showIcon?: boolean;
}) {
  return (
    <label className="upload-field">
      <input
        type="file"
        accept={accept}
        onChange={(event) => onChange?.(event.target.files?.[0]?.name ?? "")}
      />
      <span className="upload-field__button">
        {showIcon ? <ProductsIcon className="mini-icon" /> : null}
        <span>{buttonLabel}</span>
      </span>
      <span className="upload-field__value">{value || placeholder}</span>
    </label>
  );
}

export function ModalFooterActions({
  cancelLabel,
  submitLabel,
  onCancel,
  formId,
  disabled,
}: {
  cancelLabel: string;
  submitLabel: string;
  onCancel: () => void;
  formId: string;
  disabled?: boolean;
}) {
  return <FormSubmitter formId={formId} cancelLabel={cancelLabel} onCancel={onCancel} primaryLabel={submitLabel} disabled={disabled} />;
}

export const ModalIcons = {
  user: <ProductsIcon className="mini-icon" />,
  phone: <PhoneIcon className="mini-icon" />,
  message: <MessageIcon className="mini-icon" />,
};
