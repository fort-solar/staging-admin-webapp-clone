"use client";

import { type ReactNode, useEffect, useState } from "react";
import { Button } from "@/components/dashboard/ui";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { type ResolvedDashboardRequestConfirmation, registerDashboardConfirmationHandler } from "@/lib/api/client";

type PendingConfirmation = ResolvedDashboardRequestConfirmation & {
  resolve: (approved: boolean) => void;
};

export function MutationConfirmationProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirmation | null>(null);

  useEffect(() => {
    return registerDashboardConfirmationHandler(
      (options) =>
        new Promise<boolean>((resolve) => {
          setPending({ ...options, resolve });
        }),
    );
  }, []);

  function settle(approved: boolean) {
    setPending((current) => {
      current?.resolve(approved);
      return null;
    });
  }

  return (
    <>
      {children}
      <Dialog open={Boolean(pending)} onOpenChange={(open) => !open && settle(false)}>
        <DialogContent className="modal-card confirmation-dialog">
          <div className="modal-card__header">
            <DialogTitle>{pending?.title ?? "Confirm this action?"}</DialogTitle>
          </div>
          <div className="modal-card__body confirmation-dialog__body">
            <DialogDescription>{pending?.description}</DialogDescription>
          </div>
          <div className="modal-card__footer confirmation-dialog__footer">
            <Button variant="secondary" onClick={() => settle(false)}>
              {pending?.cancelLabel ?? "Cancel"}
            </Button>
            <Button variant={pending?.tone === "danger" ? "danger" : "primary"} onClick={() => settle(true)}>
              {pending?.confirmLabel ?? "Continue"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
