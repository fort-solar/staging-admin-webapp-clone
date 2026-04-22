"use client";

import { useState } from "react";
import type { VerificationDocument, VerificationRow } from "@/lib/dashboard-data";
import { Button, TextAreaField, cx } from "@/components/dashboard/ui";
import { CheckCircleIcon } from "@/components/dashboard/icons";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

function PreviewCanvas({ document }: { document: VerificationDocument }) {
  return (
    <div className="verification-documents__canvas">
      <Skeleton className="verification-documents__page" />
      <div className="verification-documents__page-lines">
        <Skeleton className="verification-documents__line is-title" />
        <Skeleton className="verification-documents__line" />
        <Skeleton className="verification-documents__line is-short" />
        <Skeleton className="verification-documents__line" />
        <Skeleton className="verification-documents__line is-short" />
      </div>
      <div className="verification-documents__stamp">
        <span>{document.label}</span>
      </div>
    </div>
  );
}

export function VerificationDocumentsDialog({
  open,
  submission,
  onClose,
}: {
  open: boolean;
  submission: VerificationRow | null;
  onClose: () => void;
}) {
  if (!submission) {
    return null;
  }

  return <VerificationDocumentsDialogContent key={submission.id} open={open} submission={submission} onClose={onClose} />;
}

function VerificationDocumentsDialogContent({
  open,
  submission,
  onClose,
}: {
  open: boolean;
  submission: VerificationRow;
  onClose: () => void;
}) {
  const [selectedDocumentId, setSelectedDocumentId] = useState(submission.documents[0]?.id ?? "");
  const selectedDocument = submission.documents.find((document) => document.id === selectedDocumentId) ?? submission.documents[0];

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
            {submission.documents.map((document, index) => (
              <button
                key={document.id}
                type="button"
                className={cx("verification-documents__thumb", selectedDocument?.id === document.id && "is-active")}
                onClick={() => setSelectedDocumentId(document.id)}
              >
                <Skeleton className="verification-documents__thumb-preview" />
                <div className="verification-documents__thumb-copy">
                  <strong>{document.label}</strong>
                  <span>{document.category}</span>
                </div>
                <small>{index + 1}</small>
              </button>
            ))}
          </div>
          <div className="verification-documents__preview">
            <div className="verification-documents__preview-header">
              <div>
                <strong>{selectedDocument.label}</strong>
                <span>{selectedDocument.category}</span>
              </div>
              <small>{selectedDocument.pages} page{selectedDocument.pages > 1 ? "s" : ""}</small>
            </div>
            <PreviewCanvas document={selectedDocument} />
            <div className="verification-documents__preview-footer">
              <span>{submission.name}</span>
              <span>100%</span>
            </div>
          </div>
        </div>
        <div className="modal-card__footer">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="primary" disabled>
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function ApproveVerificationDialog({
  open,
  submission,
  title,
  description,
  onClose,
  onViewDocuments,
  onConfirm,
}: {
  open: boolean;
  submission: VerificationRow | null;
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
            {submission && onViewDocuments ? (
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
  submission,
  note,
  onNoteChange,
  onClose,
  onConfirm,
}: {
  open: boolean;
  submission: VerificationRow | null;
  note: string;
  onNoteChange: (value: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!submission) {
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
            <strong>{submission.name}</strong>
            <span>{submission.email}</span>
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
