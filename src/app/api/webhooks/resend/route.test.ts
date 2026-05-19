import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { Webhook } from "svix";

const WEBHOOK_SECRET = "whsec_" + Buffer.from("test-secret-bytes-for-svix-1234").toString("base64");

const mockFrom = vi.fn();
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ from: mockFrom }),
}));

async function postEvent(opts: {
  body: object;
  svixId?: string;
  tamper?: boolean;
  missingHeader?: "svix-id" | "svix-timestamp" | "svix-signature";
}) {
  const { POST } = await import("./route");
  const payload = JSON.stringify(opts.body);
  const svixId = opts.svixId ?? "msg_" + Math.random().toString(36).slice(2);
  const timestamp = new Date();
  const wh = new Webhook(WEBHOOK_SECRET);
  const signature = wh.sign(svixId, timestamp, payload);

  const headers: Record<string, string> = {
    "svix-id": svixId,
    "svix-timestamp": Math.floor(timestamp.getTime() / 1000).toString(),
    "svix-signature": opts.tamper ? signature.replace(/.$/, "X") : signature,
  };
  if (opts.missingHeader) delete headers[opts.missingHeader];

  const req = new NextRequest("http://localhost/api/webhooks/resend", {
    method: "POST",
    headers,
    body: payload,
  });
  const res = await POST(req);
  return { res, svixId };
}

interface UpdateCall {
  payload: Record<string, unknown>;
  rowId: string;
}

interface FromMockState {
  dedupeInsert: { error: unknown };
  emailEventsRow: Record<string, unknown> | null;
  updates: UpdateCall[];
}

function installFromMock(state: FromMockState) {
  mockFrom.mockImplementation((table: string) => {
    if (table === "webhook_deliveries") {
      return {
        insert: vi.fn().mockResolvedValue(state.dedupeInsert),
      };
    }
    if (table === "email_events") {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockReturnValue({
                maybeSingle: vi.fn().mockResolvedValue({ data: state.emailEventsRow, error: null }),
              }),
            }),
          }),
        }),
        update: vi.fn((payload: Record<string, unknown>) => ({
          eq: vi.fn((col: string, val: string) => {
            if (col === "id") state.updates.push({ payload, rowId: val });
            return Promise.resolve({ error: null });
          }),
        })),
      };
    }
    throw new Error(`unexpected table: ${table}`);
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.RESEND_WEBHOOK_SECRET = WEBHOOK_SECRET;
});

describe("POST /api/webhooks/resend", () => {
  it("returns 401 when the svix signature is invalid", async () => {
    const state: FromMockState = { dedupeInsert: { error: null }, emailEventsRow: null, updates: [] };
    installFromMock(state);
    const { res } = await postEvent({
      body: { type: "email.delivered", data: { email_id: "re_abc" } },
      tamper: true,
    });
    expect(res.status).toBe(401);
    expect(state.updates).toHaveLength(0);
  });

  it("returns 401 when a required svix header is missing", async () => {
    const state: FromMockState = { dedupeInsert: { error: null }, emailEventsRow: null, updates: [] };
    installFromMock(state);
    const { res } = await postEvent({
      body: { type: "email.delivered", data: { email_id: "re_abc" } },
      missingHeader: "svix-signature",
    });
    expect(res.status).toBe(401);
  });

  it("flips email_events.status from 'sent' to 'delivered' for email.delivered", async () => {
    const state: FromMockState = {
      dedupeInsert: { error: null },
      emailEventsRow: { id: "row-1", status: "sent" },
      updates: [],
    };
    installFromMock(state);
    const { res } = await postEvent({
      body: { type: "email.delivered", data: { email_id: "re_abc" } },
    });
    expect(res.status).toBe(200);
    expect(state.updates).toHaveLength(1);
    expect(state.updates[0]).toMatchObject({
      rowId: "row-1",
      payload: expect.objectContaining({ status: "delivered" }),
    });
  });

  it("flips status to 'bounced' and captures error_message for email.bounced", async () => {
    const state: FromMockState = {
      dedupeInsert: { error: null },
      emailEventsRow: { id: "row-2", status: "sent" },
      updates: [],
    };
    installFromMock(state);
    const { res } = await postEvent({
      body: {
        type: "email.bounced",
        data: {
          email_id: "re_abc",
          bounce: { message: "mailbox does not exist" },
        },
      },
    });
    expect(res.status).toBe(200);
    expect(state.updates[0].payload.status).toBe("bounced");
    expect(state.updates[0].payload.error_message).toContain("mailbox does not exist");
  });

  it("truncates a multi-sentence bounce reason to the first sentence", async () => {
    const state: FromMockState = {
      dedupeInsert: { error: null },
      emailEventsRow: { id: "row-trim", status: "sent" },
      updates: [],
    };
    installFromMock(state);
    const { res } = await postEvent({
      body: {
        type: "email.bounced",
        data: {
          email_id: "re_abc",
          bounce: {
            message:
              "The recipient mailbox does not exist. SMTP error 550-5.1.1 user unknown. Refer to RFC 5321 section 4.2.2 for details.",
          },
        },
      },
    });
    expect(res.status).toBe(200);
    expect(state.updates[0].payload.error_message).toBe("The recipient mailbox does not exist");
  });

  it("flips status to 'complained' for email.complained", async () => {
    const state: FromMockState = {
      dedupeInsert: { error: null },
      emailEventsRow: { id: "row-3", status: "delivered" },
      updates: [],
    };
    installFromMock(state);
    const { res } = await postEvent({
      body: { type: "email.complained", data: { email_id: "re_abc" } },
    });
    expect(res.status).toBe(200);
    expect(state.updates[0].payload.status).toBe("complained");
  });

  it("is idempotent: duplicate svix-id returns 200 and does not update the row", async () => {
    const state: FromMockState = {
      dedupeInsert: { error: { code: "23505", message: "duplicate key value" } },
      emailEventsRow: { id: "row-4", status: "sent" },
      updates: [],
    };
    installFromMock(state);
    const { res } = await postEvent({
      body: { type: "email.delivered", data: { email_id: "re_abc" } },
    });
    expect(res.status).toBe(200);
    expect(state.updates).toHaveLength(0);
  });

  it("returns 200 and ignores unknown event types (no DB update)", async () => {
    const state: FromMockState = {
      dedupeInsert: { error: null },
      emailEventsRow: { id: "row-5", status: "sent" },
      updates: [],
    };
    installFromMock(state);
    const { res } = await postEvent({
      body: { type: "email.opened", data: { email_id: "re_abc" } },
    });
    expect(res.status).toBe(200);
    expect(state.updates).toHaveLength(0);
  });

  it("returns 200 when no email_events row matches the resend_message_id", async () => {
    const state: FromMockState = {
      dedupeInsert: { error: null },
      emailEventsRow: null,
      updates: [],
    };
    installFromMock(state);
    const { res } = await postEvent({
      body: { type: "email.delivered", data: { email_id: "re_unknown" } },
    });
    expect(res.status).toBe(200);
    expect(state.updates).toHaveLength(0);
  });

  it("does not downgrade: ignores 'delivered' event when row is already 'complained'", async () => {
    const state: FromMockState = {
      dedupeInsert: { error: null },
      emailEventsRow: { id: "row-6", status: "complained" },
      updates: [],
    };
    installFromMock(state);
    const { res } = await postEvent({
      body: { type: "email.delivered", data: { email_id: "re_abc" } },
    });
    expect(res.status).toBe(200);
    expect(state.updates).toHaveLength(0);
  });

  it("allows 'complained' to overwrite 'delivered' (post-delivery complaint)", async () => {
    const state: FromMockState = {
      dedupeInsert: { error: null },
      emailEventsRow: { id: "row-7", status: "delivered" },
      updates: [],
    };
    installFromMock(state);
    const { res } = await postEvent({
      body: { type: "email.complained", data: { email_id: "re_abc" } },
    });
    expect(res.status).toBe(200);
    expect(state.updates[0].payload.status).toBe("complained");
  });
});
