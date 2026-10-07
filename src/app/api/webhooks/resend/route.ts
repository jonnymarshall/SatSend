// Resend webhook lifecycle endpoint.
//
// Resend delivers post-acceptance email events (delivered, bounced,
// complained) via a Svix-signed webhook. This route verifies the signature,
// deduplicates by `svix-id`, and updates the matching `email_events` row.
//
// Manual test (preview env): configure the endpoint in the Resend dashboard,
// subscribe to email.sent/delivered/bounced/complained, then send a publish
// email to bounce@simulator.amazonses.com — the row should flip sent →
// bounced within seconds.

import { NextResponse, type NextRequest } from "next/server";
import { Webhook, WebhookVerificationError } from "svix";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/database.types";

// Map Resend event type → target email_events.status value. Unrecognised
// types fall through to a no-op 200 (Resend retries on 5xx; we don't want
// retries on events we explicitly do not handle).
const EVENT_TO_STATUS: Record<string, "delivered" | "bounced" | "complained"> = {
  "email.delivered": "delivered",
  "email.bounced": "bounced",
  "email.complained": "complained",
};

// Statuses that may be overwritten by a given incoming status. Worse signals
// (bounced, complained) overwrite a prior 'delivered'; a late 'delivered'
// retry never overwrites a 'bounced' or 'complained' row.
const OVERWRITABLE_BY: Record<"delivered" | "bounced" | "complained", string[]> = {
  delivered: ["queued", "sent"],
  bounced: ["queued", "sent", "delivered"],
  complained: ["queued", "sent", "delivered", "bounced"],
};

// Keep the dedupe table small. Svix retries for at most hours, so 30 days is
// generous. This must never fail the webhook: a sweep error is logged and
// swallowed. No index on received_at: at this table size it is wasted.
// (v1.4.23-H / M-DB-7)
const DEDUPE_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;
async function sweepOldDeliveries(admin: ReturnType<typeof createAdminClient>): Promise<void> {
  try {
    const cutoff = new Date(Date.now() - DEDUPE_RETENTION_MS).toISOString();
    await admin.from("webhook_deliveries").delete().lt("received_at", cutoff);
  } catch (err) {
    console.error("[resend-webhook] retention sweep failed", err);
  }
}

interface ResendEvent {
  type?: string;
  data?: {
    email_id?: string;
    bounce?: { message?: string };
  };
}

export async function POST(request: NextRequest) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error("[resend-webhook] RESEND_WEBHOOK_SECRET is not set");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 500 });
  }

  const svixId = request.headers.get("svix-id");
  const svixTimestamp = request.headers.get("svix-timestamp");
  const svixSignature = request.headers.get("svix-signature");
  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing signature headers" }, { status: 401 });
  }

  const rawBody = await request.text();

  try {
    new Webhook(secret).verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
  } catch (err) {
    if (err instanceof WebhookVerificationError) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }
    throw err;
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody) as ResendEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const eventType = event.type ?? "";
  const targetStatus = EVENT_TO_STATUS[eventType];

  const admin = createAdminClient();

  // Claim the svix-id. Insert first: the primary key is the atomic claim that
  // stops two concurrent copies of the same delivery both proceeding.
  const dedupe = await admin
    .from("webhook_deliveries")
    .insert({ svix_id: svixId, event_type: eventType });
  if (dedupe.error) {
    if (dedupe.error.code === "23505") {
      // A genuine duplicate (Svix retry). Already handled.
      return NextResponse.json({ ok: true, dedupe: "duplicate" }, { status: 200 });
    }
    // Any other insert error is a real failure. Do NOT report success, or Svix
    // will never retry and the event is silently lost. (v1.4.23-H / M-DB-7)
    console.error("[resend-webhook] dedupe insert failed", dedupe.error);
    return NextResponse.json({ error: "Dedupe insert failed" }, { status: 500 });
  }

  // Retention sweep, best-effort. Never allowed to fail the webhook.
  await sweepOldDeliveries(admin);

  // From here on, any *unexpected* failure must release the claim so Svix's retry
  // can run again; otherwise the dedupe row blocks it forever. Re-applying the
  // event is harmless because the lifecycle-overwrite guard below is idempotent.
  const releaseClaim = async () => {
    try {
      await admin.from("webhook_deliveries").delete().eq("svix_id", svixId);
    } catch (err) {
      console.error("[resend-webhook] failed to release dedupe claim", err);
    }
  };

  if (!targetStatus) {
    return NextResponse.json({ ok: true, ignored: eventType || "unknown" }, { status: 200 });
  }

  const messageId = event.data?.email_id;
  if (!messageId) {
    console.warn(`[resend-webhook] ${eventType} missing data.email_id`);
    return NextResponse.json({ ok: true, ignored: "missing-email-id" }, { status: 200 });
  }

  const lookup = await admin
    .from("email_events")
    .select("id, status")
    .eq("resend_message_id", messageId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lookup.error) {
    await releaseClaim();
    console.error("[resend-webhook] email_events lookup failed", lookup.error);
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  const row = lookup.data as { id: string; status: string } | null;
  if (!row) {
    return NextResponse.json({ ok: true, ignored: "no-matching-row" }, { status: 200 });
  }

  if (!OVERWRITABLE_BY[targetStatus].includes(row.status)) {
    return NextResponse.json({ ok: true, ignored: "lifecycle-noop" }, { status: 200 });
  }

  // updated_at is owned by the DB trigger (migration 0029), so it is not set here.
  const update: Database["public"]["Tables"]["email_events"]["Update"] = { status: targetStatus };
  if (targetStatus === "bounced") {
    const raw = event.data?.bounce?.message ?? "bounced";
    // Resend bounce messages are often multi-sentence with SMTP detail. Surface
    // just the first sentence in the UI; full payload remains in Resend's logs.
    const firstSentence = raw.split(/[.\n]/)[0].trim();
    update.error_message = (firstSentence || raw).slice(0, 200);
  }

  const { error: updateError } = await admin.from("email_events").update(update).eq("id", row.id);
  if (updateError) {
    await releaseClaim();
    console.error("[resend-webhook] email_events update failed", updateError);
    return NextResponse.json({ error: "Update failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: targetStatus }, { status: 200 });
}
