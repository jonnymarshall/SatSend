"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { markInvoicePaidByPayer } from "./actions";

interface Props {
  invoiceId: string;
  currency: string;
  // The payable status check at the call site decides whether to render this.
  // Once the payer confirms, we update local state via onMarked so the parent
  // can flip the UI without waiting for the realtime echo.
  onMarked: () => void;
}

export function PayFiatButton({ invoiceId, currency, onMarked }: Props) {
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = () => {
    setError(null);
    startTransition(async () => {
      const result = await markInvoicePaidByPayer(invoiceId);
      if (result.ok) {
        setOpen(false);
        onMarked();
      } else {
        setError(result.reason);
      }
    });
  };

  return (
    <>
      <Button
        id="invoice-view--pay-fiat-button"
        variant="outline"
        className="w-full"
        onClick={() => setOpen(true)}
      >
        Pay with {currency}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent id="invoice-view--pay-fiat-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>Mark this invoice as paid in {currency}?</AlertDialogTitle>
            <AlertDialogDescription>
              By clicking confirm, you are marking this invoice as paid. To avoid
              any confusion with the payee, please do not click confirm until
              after you have made payment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && (
            <p
              id="invoice-view--pay-fiat-error"
              role="alert"
              className="text-sm text-destructive"
            >
              {error}
            </p>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel id="invoice-view--pay-fiat-cancel" disabled={isPending}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              id="invoice-view--pay-fiat-confirm"
              onClick={(e) => {
                e.preventDefault();
                handleConfirm();
              }}
              disabled={isPending}
            >
              {isPending ? "Confirming..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
