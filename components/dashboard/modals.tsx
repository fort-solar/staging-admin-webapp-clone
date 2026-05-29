"use client";

import { type ChangeEvent, type ReactNode, useEffect, useId, useState } from "react";
import { FormSubmitter } from "@/components/dashboard/form-submitter";
import { SelectField, TextAreaField, TextField, cx, type SelectOption } from "@/components/dashboard/ui";
import { CameraIcon, MessageIcon, PhoneIcon, ProductsIcon, SearchIcon } from "@/components/dashboard/icons";
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
  error,
  children,
}: {
  label: string;
  icon?: ReactNode;
  hint?: string;
  error?: string | null;
  children: ReactNode;
}) {
  return (
    <label className={cx("form-field", error && "is-invalid")}>
      <span className="form-field__label">
        {icon}
        <span>{label}</span>
      </span>
      {children}
      {hint ? <small className="form-field__hint">{hint}</small> : null}
      {error ? <small className="form-field__error">{error}</small> : null}
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
  type?: "text" | "email" | "password" | "date" | "time" | "datetime-local";
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

function formatFileSize(value: number) {
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }

  if (value >= 1024) {
    return `${Math.round(value / 1024)} KB`;
  }

  return `${value} B`;
}

export function ImageSelectField({
  file,
  onFileChange,
  previewUrl,
  placeholder = "Select an image to upload",
  buttonLabel,
}: {
  file: File | null;
  onFileChange: (file: File | null) => void;
  previewUrl?: string | null;
  placeholder?: string;
  buttonLabel?: string;
}) {
  const inputId = useId();
  const [objectUrl, setObjectUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === "string") {
        setObjectUrl(reader.result);
      }
    };

    reader.readAsDataURL(file);

    return () => {
      reader.abort();
    };
  }, [file]);

  const activePreviewUrl = file ? (objectUrl ?? "") : (previewUrl ?? "");
  const activeLabel = file?.name ?? (previewUrl ? "Current image on record" : placeholder);
  const activeButtonLabel = buttonLabel ?? (file || previewUrl ? "Replace image" : "Choose image");
  const helper = file
    ? `${file.type || "image"} • ${formatFileSize(file.size)}`
    : previewUrl
      ? "The current image will remain until you select a replacement."
      : "PNG, JPG, WEBP, or SVG.";

  return (
    <div className="upload-preview-card">
      <label className="upload-field" htmlFor={inputId}>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
        />
        <span className="upload-field__button">
          <CameraIcon className="mini-icon" />
          <span>{activeButtonLabel}</span>
        </span>
        <span className="upload-field__value">{activeLabel}</span>
      </label>

      {activePreviewUrl ? (
        <div
          className="upload-preview-card__canvas has-image"
          style={{ backgroundImage: `linear-gradient(180deg, rgba(17, 24, 39, 0.08) 0%, rgba(17, 24, 39, 0.72) 100%), url("${activePreviewUrl}")` }}
          role="img"
          aria-label={file ? `Preview of ${file.name}` : "Current uploaded image"}
        >
          <div className="upload-preview-card__meta">
            <strong>{file ? file.name : "Current image"}</strong>
            <span>{helper}</span>
          </div>
        </div>
      ) : (
        <div className="upload-showcase-empty">
          <CameraIcon className="mini-icon" />
          <p>{helper}</p>
        </div>
      )}

      {file ? (
        <button type="button" className="upload-preview-card__reset" onClick={() => onFileChange(null)}>
          {previewUrl ? "Use current image instead" : "Clear selected image"}
        </button>
      ) : null}
    </div>
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
