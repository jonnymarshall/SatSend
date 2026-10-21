"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/signal/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * The Send menu (v1.5.19, was PublishMenu). An invoice is a draft or it's sent:
 * every option here sends it, makes the client's link live and records its sent
 * date. There is no "Publish only".
 */
export interface SendMenuProps {
  invoiceId: string;
  isDraft: boolean;
  emailAttemptedAt: string | null;
  clientEmail: string | null;
  sentAt?: string | null;
  sendMethod?: string | null;
  onSendEmail: (id: string) => void;
  onDownloadAndMarkSent: (id: string) => void;
  onCopyLinkAndMarkSent: (id: string) => void;
  triggerVariant?: "primary" | "secondary";
  busy?: boolean;
}

export function SendMenu({
  invoiceId,
  emailAttemptedAt,
  clientEmail,
  sentAt,
  onSendEmail,
  onDownloadAndMarkSent,
  onCopyLinkAndMarkSent,
  triggerVariant = "primary",
  busy,
}: SendMenuProps) {
  const emailDisabled = !!emailAttemptedAt || !clientEmail;
  const emailDisabledReason = emailAttemptedAt
    ? "An email has already been attempted for this invoice; multiple sends are not supported."
    : !clientEmail
    ? "No client email on this invoice, so it can't be sent by email."
    : undefined;
  // Once it's been sent by hand, the hand-sent options have nothing left to do;
  // only "Send now via email" can still add something.
  const showManualSendOptions = !sentAt;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button id={`send-menu--trigger-${invoiceId}`} variant={triggerVariant} disabled={busy}>
            Send
            <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
        }
      />
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuItem
          id={`send-menu--email-${invoiceId}`}
          disabled={emailDisabled}
          title={emailDisabled ? emailDisabledReason : undefined}
          onClick={() => !emailDisabled && onSendEmail(invoiceId)}
        >
          Send now via email
        </DropdownMenuItem>
        {showManualSendOptions && (
          <>
            <DropdownMenuItem id={`send-menu--download-${invoiceId}`} onClick={() => onDownloadAndMarkSent(invoiceId)}>
              Download PDF and mark as sent
            </DropdownMenuItem>
            <DropdownMenuItem
              id={`send-menu--copy-link-${invoiceId}`}
              onClick={() => onCopyLinkAndMarkSent(invoiceId)}
              className="flex-col items-start gap-0.5"
            >
              <span>Copy link and mark as sent</span>
              <span className="text-xs text-(--color-text-secondary)">Share the link yourself</span>
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
