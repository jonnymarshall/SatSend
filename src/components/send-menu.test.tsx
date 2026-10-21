import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SendMenu, type SendMenuProps } from "./send-menu";

// v1.5.19: an invoice is a draft or it's sent. There is no "Publish only"; each
// option sends it (and gives it its sent date).
const onSendEmail = vi.fn();
const onDownloadAndMarkSent = vi.fn();
const onCopyLinkAndMarkSent = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
});

function renderMenu(props: Partial<SendMenuProps> = {}) {
  render(
    <SendMenu
      invoiceId="inv-1"
      isDraft
      emailAttemptedAt={null}
      clientEmail="ada@example.com"
      onSendEmail={onSendEmail}
      onDownloadAndMarkSent={onDownloadAndMarkSent}
      onCopyLinkAndMarkSent={onCopyLinkAndMarkSent}
      {...props}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: /send/i }));
}

const item = (name: RegExp) => screen.getByRole("menuitem", { name });
const maybe = (name: RegExp) => screen.queryByRole("menuitem", { name });

describe("SendMenu: a draft", () => {
  beforeEach(() => renderMenu());

  it("is labelled Send, never Publish", () => {
    expect(screen.queryByRole("button", { name: /publish/i })).not.toBeInTheDocument();
  });

  it("offers exactly the three ways to send", () => {
    expect(screen.getAllByRole("menuitem")).toHaveLength(3);
    expect(item(/send now via email/i)).toBeInTheDocument();
    expect(item(/download pdf and mark as sent/i)).toBeInTheDocument();
    expect(item(/copy link and mark as sent/i)).toBeInTheDocument();
    expect(maybe(/publish/i)).not.toBeInTheDocument();
  });

  it("explains the copy option as sharing the link yourself", () => {
    expect(item(/copy link and mark as sent/i)).toHaveTextContent(/share the link yourself/i);
  });

  it.each([
    [/send now via email/i, onSendEmail],
    [/download pdf and mark as sent/i, onDownloadAndMarkSent],
    [/copy link and mark as sent/i, onCopyLinkAndMarkSent],
  ])("%s calls its handler with the invoice id", async (name, handler) => {
    fireEvent.click(item(name));
    await waitFor(() => expect(handler).toHaveBeenCalledWith("inv-1"));
  });
});

describe("SendMenu: already sent by hand (sent_at set, no email yet)", () => {
  beforeEach(() =>
    renderMenu({ isDraft: false, sentAt: "2026-04-28T10:00:00Z", sendMethod: "manual" }),
  );

  it("only offers email; the hand-sent options are already done", () => {
    expect(item(/send now via email/i)).not.toHaveAttribute("data-disabled");
    expect(maybe(/download pdf and mark as sent/i)).not.toBeInTheDocument();
    expect(maybe(/copy link and mark as sent/i)).not.toBeInTheDocument();
  });
});

describe("SendMenu: email gating", () => {
  it("disables email once an email has been attempted", () => {
    renderMenu({ isDraft: false, sentAt: "2026-04-28T10:00:00Z", emailAttemptedAt: "2026-04-28T10:00:00Z" });
    expect(item(/send now via email/i)).toHaveAttribute("data-disabled");
  });

  it("disables email when there is no client email", () => {
    renderMenu({ clientEmail: "" });
    expect(item(/send now via email/i)).toHaveAttribute("data-disabled");
  });
});
