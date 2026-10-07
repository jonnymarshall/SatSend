"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { canMarkAsOverdue, canMarkAsPending, type InvoiceForOverdueActions } from "@/lib/invoices/overdue-actions";

export interface MarkAsMenuProps {
  invoiceId: string;
  status: InvoiceForOverdueActions["status"];
  dueDate: string | null;
  onMarkPaid: (id: string) => void;
  onMarkUnpaid: (id: string) => void;
  onMarkOverdue: (id: string) => void;
  busy?: boolean;
}

const UNPAID_STATES = new Set(["pending", "payment_detected", "underpaid"]);

export function MarkAsMenu({
  invoiceId,
  status,
  dueDate,
  onMarkPaid,
  onMarkUnpaid,
  onMarkOverdue,
  busy,
}: MarkAsMenuProps) {
  const isPaid = status === "paid";
  const isUnpaid = UNPAID_STATES.has(status);
  const showOverdue = canMarkAsOverdue({ status, due_date: dueDate });
  // "Pending" is the case-#4 reverse (overdue → pending). The paid → pending
  // transition keeps its existing always-on availability for paid invoices.
  const showPending = isPaid || canMarkAsPending({ status, due_date: dueDate });
  // Suppress the duplicate when the row is already in an unpaid state.
  const showPendingItem = showPending && !isUnpaid;

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
        {showPendingItem && (
          <DropdownMenuItem
            id={`mark-as-menu--unpaid-${invoiceId}`}
            onClick={() => onMarkUnpaid(invoiceId)}
          >
            {isPaid ? "Unpaid" : "Pending"}
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
