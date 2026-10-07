"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface PublishMenuProps {
  invoiceId: string;
  isDraft: boolean;
  emailAttemptedAt: string | null;
  clientEmail: string | null;
  sentAt?: string | null;
  sendMethod?: string | null;
  onSendEmail: (id: string) => void;
  onMarkSent: (id: string) => void;
  onDownloadAndMarkSent: (id: string) => void;
  onPublishOnly: (id: string) => void;
  triggerLabel?: string;
  triggerVariant?: "default" | "outline";
  busy?: boolean;
}

export function PublishMenu({
  invoiceId,
  isDraft,
  emailAttemptedAt,
  clientEmail,
  sentAt,
  onSendEmail,
  onMarkSent,
  onDownloadAndMarkSent,
  onPublishOnly,
  triggerLabel,
  triggerVariant = "default",
  busy,
}: PublishMenuProps) {
  const emailDisabled = !!emailAttemptedAt || !clientEmail;
  const emailDisabledReason = emailAttemptedAt
    ? "An email has already been attempted for this invoice; multiple sends are not supported."
    : !clientEmail
    ? "No client email on this invoice — cannot send."
    : undefined;

  // Once the invoice is marked as sent (either method), the manual options are no-ops —
  // only "Send now via email" still has work to do. The Download PDF action lives elsewhere.
  const showManualSendOptions = !sentAt;

  const label = triggerLabel ?? (isDraft ? "Publish" : "Send");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            id={`publish-menu--trigger-${invoiceId}`}
            variant={triggerVariant}
            disabled={busy}
          >
            {label}
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-64 whitespace-nowrap">
        <DropdownMenuItem
          disabled={emailDisabled}
          title={emailDisabled ? emailDisabledReason : undefined}
          onClick={() => !emailDisabled && onSendEmail(invoiceId)}
        >
          Send now via email
        </DropdownMenuItem>
        {showManualSendOptions && (
          <>
            <DropdownMenuItem onClick={() => onDownloadAndMarkSent(invoiceId)}>
              Download and mark as sent
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onMarkSent(invoiceId)}>
              Mark as sent
            </DropdownMenuItem>
          </>
        )}
        {isDraft && (
          <DropdownMenuItem onClick={() => onPublishOnly(invoiceId)}>
            Publish only (don&apos;t send yet)
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
