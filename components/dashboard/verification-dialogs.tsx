"use client";

import { useEffect, useState } from "react";
import { Button, TextAreaField, cx } from "@/components/dashboard/ui";
import { CheckCircleIcon } from "@/components/dashboard/icons";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import type { VerificationDocumentRecord } from "@/types/api.types";

type VerificationDocumentKind = "image" | "pdf" | "file";

const apiBaseUrl = process.env.NEXT_PUBLIC_FORTSOLAR_API_BASE_URL?.trim() ?? "";

function inferDocumentKind(source: string, mimeType?: string | null): VerificationDocumentKind {
  const normalizedMime = mimeType?.toLowerCase() ?? "";
  const normalizedSource = source.toLowerCase();

  if (normalizedMime.startsWith("image/") || /\.(png|jpe?g|webp|gif|svg)$/.test(normalizedSource)) {
    return "image";
  }

  if (normalizedMime.includes("pdf") || normalizedSource.endsWith(".pdf")) {
    return "pdf";
  }

  return "file";
}

function buildVerificationDocumentUrl(document: VerificationDocumentRecord) {
  const filePath = document.upload.file_path.trim();

  if (!filePath) {
    return "";
  }

  if (filePath.startsWith("/api/proxy/") || filePath.startsWith("blob:") || filePath.startsWith("data:")) {
    return filePath;
  }

  if (/^https?:\/\//i.test(filePath)) {
    if (apiBaseUrl) {
      try {
        const fileUrl = new URL(filePath);
        const configuredApiUrl = new URL(apiBaseUrl);

        if (fileUrl.origin === configuredApiUrl.origin) {
          return `/api/proxy${fileUrl.pathname}${fileUrl.search}`;
        }
      } catch {
        return filePath;
      }
    }

    return filePath;
  }

  const normalizedPath = filePath.startsWith("/") ? filePath : `/${filePath}`;
  return `/api/proxy${normalizedPath}`;
}

function DocumentThumbPreview({
  document,
  previewUrl,
  kind,
}: {
  document: VerificationDocumentRecord;
  previewUrl: string;
  kind: VerificationDocumentKind;
}) {
  if (kind === "image" && previewUrl) {
    // The preview is loaded from an authenticated proxy route, so raw img rendering is intentional.
    return (
      <>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={document.label}
          referrerPolicy="no-referrer"
          className="verification-documents__thumb-preview verification-documents__thumb-preview-image"
        />
      </>
    );
  }

  return (
    <div className={cx("verification-documents__thumb-preview verification-documents__thumb-preview-fallback", kind === "pdf" && "is-pdf")}>
      <span>{kind === "pdf" ? "PDF" : "FILE"}</span>
    </div>
  );
}

function PreviewCanvas({
  document,
  previewUrl,
  kind,
}: {
  document: VerificationDocumentRecord;
  previewUrl: string;
  kind: VerificationDocumentKind;
}) {
  if (!previewUrl) {
    return (
      <div className="verification-documents__canvas">
        <div className="verification-documents__canvas-empty">
          Preview unavailable for this file.
        </div>
      </div>
    );
  }

  return (
    <div className="verification-documents__canvas">
      {kind === "image" ? (
        <>
          {/* The preview is loaded from an authenticated proxy route, so raw img rendering is intentional. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt={document.upload.original_filename || document.label}
            referrerPolicy="no-referrer"
            className="verification-documents__canvas-media is-image"
          />
        </>
      ) : kind === "pdf" ? (
        <iframe
          src={previewUrl}
          title={document.upload.original_filename || document.label}
          referrerPolicy="no-referrer"
          className="verification-documents__canvas-media is-pdf"
        />
      ) : (
        <div className="verification-documents__canvas-empty">
          Preview is unavailable for this file type. Use the open or download action instead.
        </div>
      )}
    </div>
  );
}

export function VerificationDocumentsDialog({
  open,
  submissionName,
  documents,
  isLoading,
  error,
  onClose,
}: {
  open: boolean;
  submissionName?: string | null;
  documents: VerificationDocumentRecord[];
  isLoading?: boolean;
  error?: string | null;
  onClose: () => void;
}) {
  return (
    <VerificationDocumentsDialogContent
      key={submissionName ?? "verification-documents"}
      open={open}
      submissionName={submissionName ?? "Installer"}
      documents={documents}
      isLoading={isLoading ?? false}
      error={error ?? null}
      onClose={onClose}
    />
  );
}

function VerificationDocumentsDialogContent({
  open,
  submissionName,
  documents,
  isLoading,
  error,
  onClose,
}: {
  open: boolean;
  submissionName: string;
  documents: VerificationDocumentRecord[];
  isLoading: boolean;
  error: string | null;
  onClose: () => void;
}) {
  const [selectedDocumentId, setSelectedDocumentId] = useState(documents[0]?.id ?? "");
  const selectedDocument = documents.find((document) => document.id === selectedDocumentId) ?? documents[0] ?? null;
  const selectedDocumentUrl = selectedDocument ? buildVerificationDocumentUrl(selectedDocument) : "";
  const selectedDocumentKind = selectedDocument
    ? inferDocumentKind(
        selectedDocumentUrl || selectedDocument.upload.original_filename,
        selectedDocument.upload.mime_type,
      )
    : "file";

  useEffect(() => {
    queueMicrotask(() => {
      setSelectedDocumentId(documents[0]?.id ?? "");
    });
  }, [documents]);

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="modal-card verification-documents-dialog is-large">
        <div className="modal-card__header">
          <DialogTitle>Verification Documents</DialogTitle>
          <DialogClose type="button" className="modal-card__close" aria-label="Close modal">
            ×
          </DialogClose>
        </div>
        <div className="modal-card__body verification-documents__body">
          <div className="verification-documents__sidebar">
            {isLoading ? (
              Array.from({ length: 3 }).map((_, index) => (
                <div key={`loading-${index}`} className="verification-documents__thumb">
                  <Skeleton className="verification-documents__thumb-preview" />
                  <div className="verification-documents__thumb-copy">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <small>{index + 1}</small>
                </div>
              ))
            ) : documents.length ? (
              documents.map((document, index) => (
                (() => {
                  const previewUrl = buildVerificationDocumentUrl(document);
                  const kind = inferDocumentKind(
                    previewUrl || document.upload.original_filename,
                    document.upload.mime_type,
                  );

                  return (
                    <button
                      key={document.id}
                      type="button"
                      className={cx("verification-documents__thumb", selectedDocument?.id === document.id && "is-active")}
                      onClick={() => setSelectedDocumentId(document.id)}
                    >
                      <DocumentThumbPreview document={document} previewUrl={previewUrl} kind={kind} />
                      <div className="verification-documents__thumb-copy">
                        <strong>{document.label}</strong>
                        <span>{document.category}</span>
                      </div>
                      <small>{index + 1}</small>
                    </button>
                  );
                })()
              ))
            ) : (
              <div className="text-sm text-[var(--text-soft)]">{error ?? "No verification documents were found for this submission."}</div>
            )}
          </div>
          <div className="verification-documents__preview">
            {selectedDocument ? (
              <>
                <div className="verification-documents__preview-header">
                  <div>
                    <strong>{selectedDocument.label}</strong>
                    <span>{selectedDocument.category}</span>
                  </div>
                  <small>{selectedDocument.pages} page{selectedDocument.pages > 1 ? "s" : ""}</small>
                </div>
                <PreviewCanvas document={selectedDocument} previewUrl={selectedDocumentUrl} kind={selectedDocumentKind} />
                <div className="verification-documents__preview-footer">
                  <span>{submissionName}</span>
                  <span>{selectedDocument.upload.original_filename}</span>
                </div>
              </>
            ) : (
              <div className="flex h-full min-h-[260px] items-center justify-center text-sm text-[var(--text-soft)]">
                {isLoading ? "Loading documents..." : error ?? "Select a document to preview."}
              </div>
            )}
          </div>
        </div>
        <div className="modal-card__footer">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          {selectedDocumentUrl ? (
            <>
              <a
                href={selectedDocumentUrl}
                target="_blank"
                rel="noreferrer"
                referrerPolicy="no-referrer"
                className="action-button is-secondary is-md"
              >
                Open file
              </a>
              <a
                href={selectedDocumentUrl}
                download={selectedDocument.upload.original_filename || undefined}
                referrerPolicy="no-referrer"
                className="action-button is-primary is-md"
              >
                Download
              </a>
            </>
          ) : (
            <Button variant="primary" disabled>
              Download
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ApproveVerificationDialog({
  open,
  canViewDocuments,
  title,
  description,
  onClose,
  onViewDocuments,
  onConfirm,
}: {
  open: boolean;
  canViewDocuments?: boolean;
  title: string;
  description: string;
  onClose: () => void;
  onViewDocuments?: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="modal-card verification-action-dialog">
        <div className="verification-action-dialog__close">
          <DialogClose type="button" className="modal-card__close" aria-label="Close modal">
            ×
          </DialogClose>
        </div>
        <div className="modal-card__body verification-action-dialog__body">
          <div className="verification-action-dialog__icon">
            <CheckCircleIcon className="verification-action-dialog__icon-svg" />
          </div>
          <DialogTitle className="verification-action-dialog__title">{title}</DialogTitle>
          <DialogDescription className="verification-action-dialog__description">{description}</DialogDescription>
          <div className="verification-action-dialog__actions">
            {canViewDocuments && onViewDocuments ? (
              <Button variant="secondary" onClick={onViewDocuments}>
                View Documents
              </Button>
            ) : null}
            <Button variant="primary" onClick={onConfirm}>
              Approve Verification
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function RejectVerificationDialog({
  open,
  submissionName,
  submissionEmail,
  note,
  onNoteChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  submissionName?: string | null;
  submissionEmail?: string | null;
  note: string;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!submissionName && !submissionEmail) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="modal-card">
        <div className="modal-card__header">
          <DialogTitle>Reject verification</DialogTitle>
          <DialogClose type="button" className="modal-card__close" aria-label="Close modal">
            ×
          </DialogClose>
        </div>
        <div className="modal-card__body">
          <div className="verification-reject__intro">
            <strong>{submissionName ?? "Installer"}</strong>
            <span>{submissionEmail ?? "No email provided"}</span>
          </div>
          <label className="form-field">
            <span className="form-field__label">
              <span>Admin Note</span>
            </span>
            <TextAreaField
              value={note}
              onChange={onNoteChange}
              placeholder="Enter any notes about why this installer's verification or documents were rejected."
              rows={4}
            />
          </label>
        </div>
        <div className="modal-card__footer">
          <button type="button" className="text-link-button" onClick={onClose}>
            Cancel
          </button>
          <Button variant="primary" onClick={onConfirm} disabled={!note.trim()}>
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
