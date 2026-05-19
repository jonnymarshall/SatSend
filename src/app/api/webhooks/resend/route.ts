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

  const dedupe = await admin
    .from("webhook_deliveries")
    .insert({ svix_id: svixId, event_type: eventType });
  if (dedupe.error) {
    return NextResponse.json({ ok: true, dedupe: "duplicate" }, { status: 200 });
  }

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

  const row = lookup.data as { id: string; status: string } | null;
  if (!row) {
    return NextResponse.json({ ok: true, ignored: "no-matching-row" }, { status: 200 });
  }

  if (!OVERWRITABLE_BY[targetStatus].includes(row.status)) {
    return NextResponse.json({ ok: true, ignored: "lifecycle-noop" }, { status: 200 });
  }

  const update: Record<string, unknown> = {
    status: targetStatus,
    updated_at: new Date().toISOString(),
  };
  if (targetStatus === "bounced") {
    const reason = event.data?.bounce?.message ?? "bounced";
    update.error_message = reason.slice(0, 500);
  }

  await admin.from("email_events").update(update).eq("id", row.id);

  return NextResponse.json({ ok: true, status: targetStatus }, { status: 200 });
}
