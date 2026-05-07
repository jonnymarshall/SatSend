"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canMarkAsOverdue, canMarkAsPending } from "@/lib/invoices/overdue-actions";
import { canMarkAsUnpaid } from "@/lib/invoices/manual-confirmation";

export interface MarkAsMenuProps {
  invoiceId: string;
  status: string;
  dueDate: string | null;
  paymentConfirmationMethod: "onchain" | "manual" | null;
  onMarkPaid: (id: string) => void;
  onMarkUnpaid: (id: string) => void;
  onMarkOverdue: (id: string) => void;
  busy?: boolean;
}

const UNPAID_STATES = new Set(["pending", "payment_detected"]);

export function MarkAsMenu({
  invoiceId,
  status,
  dueDate,
  paymentConfirmationMethod,
  onMarkPaid,
  onMarkUnpaid,
  onMarkOverdue,
  busy,
}: MarkAsMenuProps) {
  const isPaid = status === "paid";
  const isUnpaid = UNPAID_STATES.has(status);
  const showOverdue = canMarkAsOverdue({ status, due_date: dueDate });
  // "Unpaid" (paid → pending): v1.4.14 only renders this for manual
  // confirmations — see canMarkAsUnpaid. "Pending" (overdue → pending) is
  // case #4 and stays governed by canMarkAsPending.
  const showUnpaid = canMarkAsUnpaid({
    status,
    payment_confirmation_method: paymentConfirmationMethod,
  });
  const showPending = canMarkAsPending({ status, due_date: dueDate }) && !isUnpaid;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            id={`mark-as-menu--trigger-${invoiceId}`}
            variant="outline"
            disabled={busy}
          >
            Mark as
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-40">
        {!isPaid && (
          <DropdownMenuItem
            id={`mark-as-menu--paid-${invoiceId}`}
            onClick={() => onMarkPaid(invoiceId)}
          >
            Paid
          </DropdownMenuItem>
        )}
        {showUnpaid && (
          <DropdownMenuItem
            id={`mark-as-menu--unpaid-${invoiceId}`}
            onClick={() => onMarkUnpaid(invoiceId)}
          >
            Unpaid
          </DropdownMenuItem>
        )}
        {showPending && (
          <DropdownMenuItem
            id={`mark-as-menu--pending-${invoiceId}`}
            onClick={() => onMarkUnpaid(invoiceId)}
          >
            Pending
          </DropdownMenuItem>
        )}
        {showOverdue && (
          <DropdownMenuItem
            id={`mark-as-menu--overdue-${invoiceId}`}
            onClick={() => onMarkOverdue(invoiceId)}
          >
            Overdue
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
