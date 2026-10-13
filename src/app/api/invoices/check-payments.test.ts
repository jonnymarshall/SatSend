import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetUser = vi.fn();
const selectCalls: Array<{ method: string; args: unknown[] }> = [];
let selectRows: unknown[] = [];
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => {
    const builder: Record<string, unknown> = {};
    const chain = (method: string) =>
      (...args: unknown[]) => {
        selectCalls.push({ method, args });
        return builder;
      };
    for (const m of ["select", "eq", "in", "not", "order", "limit"]) builder[m] = chain(m);
    builder.then = (ok: (v: unknown) => unknown) => Promise.resolve({ data: selectRows, error: null }).then(ok);
    return { auth: { getUser: mockGetUser }, from: () => builder };
  },
}));

vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => ({ admin: true }) }));
vi.mock("@/lib/mempool", () => ({ fetchTipHeight: vi.fn().mockResolvedValue(900_000) }));

const mockCheck = vi.fn();
vi.mock("@/lib/invoices/check-invoice-payment", async () => {
  const actual = await vi.importActual<typeof import("@/lib/invoices/check-invoice-payment")>(
    "@/lib/invoices/check-invoice-payment"
  );
  return { ...actual, checkInvoicePayment: (...args: unknown[]) => mockCheck(...args) };
});

async function post() {
  const { POST } = await import("./check-payments/route");
  return POST();
}

const inv = (id: string, status: string) => ({ id, status, user_id: "owner-1", btc_address: "tb1q" + id });

beforeEach(() => {
  vi.resetModules(); // fresh module = fresh per-owner cooldown
  vi.clearAllMocks();
  selectCalls.length = 0;
  selectRows = [];
  mockGetUser.mockResolvedValue({ data: { user: { id: "owner-1" } } });
  mockCheck.mockResolvedValue("unchanged");
});

describe("POST /api/invoices/check-payments", () => {
  it("returns 401 when signed out", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await post();
    expect(res.status).toBe(401);
    expect(mockCheck).not.toHaveBeenCalled();
  });

  it("only loads the owner's invoices that are waiting on the blockchain", async () => {
    await post();
    expect(selectCalls).toEqual(
      expect.arrayContaining([
        { method: "eq", args: ["user_id", "owner-1"] },
        { method: "in", args: ["status", ["pending", "payment_detected", "overdue"]] },
        { method: "not", args: ["btc_address", "is", null] },
      ])
    );
  });

  it("checks payment-detected invoices first, at most 10 per call, writing only on a status change", async () => {
    selectRows = [
      ...Array.from({ length: 12 }, (_, i) => inv(`p${i}`, "pending")),
      inv("d1", "payment_detected"),
      inv("o1", "overdue"),
    ];
    mockCheck.mockImplementation(async (_s: unknown, i: { id: string }) =>
      i.id === "d1" ? "transitioned" : "unchanged"
    );

    const res = await post();
    const body = await res.json();

    expect(mockCheck).toHaveBeenCalledTimes(10);
    expect(mockCheck.mock.calls[0][1].id).toBe("d1");
    expect(mockCheck.mock.calls[1][1].id).toBe("o1");
    for (const call of mockCheck.mock.calls) {
      expect(call[4]).toEqual(expect.objectContaining({ writeOnlyOnStatusChange: true }));
    }
    expect(body).toEqual({ checked: 10, transitioned: 1 });
  });

  it("throttles a second call from the same owner within the cooldown", async () => {
    selectRows = [inv("d1", "payment_detected")];
    const { POST } = await import("./check-payments/route");
    await POST();
    const second = await (await POST()).json();
    expect(second).toEqual({ checked: 0, transitioned: 0, throttled: true });
    expect(mockCheck).toHaveBeenCalledTimes(1);
  });
});
