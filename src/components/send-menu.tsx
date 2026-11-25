"use client";

import { ChevronDown } from "lucide-react";
import { Button } from "@/components/signal/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { sendAvailability } from "@/lib/invoices/action-availability";
import { MenuItemLabel } from "@/components/menu-item-label";

// Placeholders that pass the shared rules, used when the caller (the invoice
// form) checks the address and client email fields itself.
const ADDRESS_CHECKED_ELSEWHERE = "bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq";
const EMAIL_CHECKED_ELSEWHERE = "checked@elsewhere.invalid";

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
  /**
   * v1.5.37: the saved invoice's bitcoin address, so a draft without a valid one
   * can't be sent from the invoice page.
   */
  btcAddress?: string | null;
  /**
   * v1.5.37: the invoice form. Nothing is greyed out for a missing address or
   * client email; clicking shows the error under the field instead.
   */
  checksFieldsItself?: boolean;
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
  btcAddress,
  checksFieldsItself = false,
  sentAt,
  onSendEmail,
  onDownloadAndMarkSent,
  onCopyLinkAndMarkSent,
  triggerVariant = "primary",
  busy,
}: SendMenuProps) {
  // v1.5.37 (roadmap v1.4.24): the shared rules. The form checks the address
  // and client email itself, so placeholders that pass stand in for them.
  const { email, byHand } = sendAvailability({
    status: "draft",
    btc_address: checksFieldsItself ? ADDRESS_CHECKED_ELSEWHERE : (btcAddress ?? null),
    client_email: checksFieldsItself ? EMAIL_CHECKED_ELSEWHERE : clientEmail,
    email_attempted_at: emailAttemptedAt,
  });
  // When sending is blocked for the same reason every way, say it once (under
  // "Send now via email").
  const byHandShownReason =
    byHand.ok || (!email.ok && email.reason === byHand.reason) ? undefined : byHand.reason;
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
          disabled={!email.ok}
          title={email.ok ? undefined : email.reason}
          onClick={() => email.ok && onSendEmail(invoiceId)}
        >
          <MenuItemLabel label="Send now via email" reason={email.ok ? undefined : email.reason} />
        </DropdownMenuItem>
        {showManualSendOptions && (
          <>
            <DropdownMenuItem
              id={`send-menu--download-${invoiceId}`}
              disabled={!byHand.ok}
              title={byHand.ok ? undefined : byHand.reason}
              onClick={() => byHand.ok && onDownloadAndMarkSent(invoiceId)}
            >
              <MenuItemLabel label="Download PDF and mark as sent" reason={byHandShownReason} />
            </DropdownMenuItem>
            <DropdownMenuItem
              id={`send-menu--copy-link-${invoiceId}`}
              disabled={!byHand.ok}
              title={byHand.ok ? undefined : byHand.reason}
              onClick={() => byHand.ok && onCopyLinkAndMarkSent(invoiceId)}
            >
              <MenuItemLabel
                label="Copy link and mark as sent"
                reason={byHandShownReason}
                hint="Share the link yourself"
              />
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
