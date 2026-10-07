> **Historical document.** This is the original MVP PRD, written before the product rename (Paybitty to SatSend) and before the paid tier existed. Some details are superseded; `development/ROADMAP.md` is the single source of truth. Kept for provenance.

# PRD: SatSend MVP (Bitcoin-Enabled Invoicing)

## Problem Statement

Freelancers and small businesses who want to accept Bitcoin payments have no simple way to create professional invoices in fiat currency and let clients pay via BTC. Existing invoicing tools don't support crypto, and existing crypto payment tools don't produce proper invoices. The user needs to create an invoice in their local currency, share it with a client, and get paid in Bitcoin — without either party needing deep crypto knowledge.

## Solution

SatSend is a web app where users create fiat-denominated invoices, share a link and access code with their client, and the client pays via a BTC QR code. The system tracks payment status automatically using mempool.space, notifying the invoice creator when payment is detected and confirmed.

## User Stories

1. As a freelancer, I want to sign in with a magic link so that I don't have to manage a password.
2. As a freelancer, I want to create a new invoice with a client name, description, line items, and fiat amount so that I can bill for my work.
3. As a freelancer, I want to add an optional tax field to my invoice so that I can charge applicable taxes.
4. As a freelancer, I want to save an invoice as a draft so that I can finish it later before sending.
5. As a freelancer, I want to assign a unique Bitcoin address to each invoice so that payments can be tracked individually.
6. As a freelancer, I want the system to prevent me from reusing a BTC address across active invoices so that I don't accidentally misattribute payments.
7. As a freelancer, I want to publish an invoice and receive a shareable link and 8-character access code so that I can send these to my client.
8. As a freelancer, I want to send the invoice link and access code to my client via email so that they can view and pay the invoice.
9. As a freelancer, I want to see a dashboard of all my invoices with their statuses so that I can track outstanding payments.
10. As a freelancer, I want to see an invoice status of "draft", "pending", "payment detected", or "paid" so that I know where each invoice stands.
11. As a freelancer, I want to mark an overdue invoice as overdue so that I can track late payments.
12. As a freelancer, I want to receive an email notification when payment is detected (0 confirmations) on one of my invoices so that I know a client has paid.
13. As a freelancer, I want to receive an email notification when a payment is confirmed (1+ confirmation) so that I know the payment is settled.
14. As a freelancer, I want to delete a draft invoice so that I can remove invoices I no longer need.
15. As a freelancer, I want the BTC amount on my invoice to be calculated from the current BTC/fiat price at the time the client views the payment screen so that the amount is accurate.
16. As a client, I want to open an invoice link and enter an 8-character access code so that I can view the invoice securely without needing an account.
17. As a client, I want to see the invoice details including the fiat amount, line items, and the equivalent BTC amount so that I know exactly what I'm paying.
18. As a client, I want to scan a BTC QR code to pay the invoice so that I can pay quickly from my wallet.
19. As a client, I want the QR code to use BIP21 URI format so that my wallet pre-fills the address and amount.
20. As a client, I want to see the invoice status update in real time (e.g. "Payment Detected") after I send the BTC so that I know my payment was received.
21. As a client, I want to see a "Paid" confirmation once the transaction has at least one confirmation so that I have confidence the payment settled.

## Implementation Decisions

### Modules

**Auth Module**
- Magic link authentication via Supabase Auth
- Session management via Supabase server-side helpers for Next.js App Router
- Middleware to protect authenticated routes

**Invoice CRUD Module**
- Create, read, update, delete invoices
- Invoice schema: id, user_id, client_name, client_email, line_items (JSONB), subtotal, tax, total_fiat, currency, btc_address, status, access_code, created_at, updated_at, due_date
- Status enum: draft, pending, payment_detected, paid, overdue
- Access code: 8 random alphanumeric characters, generated on publish
- BTC address uniqueness enforced: system rejects address already used on any non-draft invoice for any user

**BTC Price Module**
- Fetch current BTC/fiat rate from Coinbase public API (primary) with CoinGecko as fallback
- Server-side cache with ~60s TTL
- Used at client payment view time to compute BTC amount

**Payment QR Module**
- Generate BTC QR code using `qrcode` npm package
- URI format: BIP21 (`bitcoin:<address>?amount=<btc_amount>&label=<invoice_label>`)
- Rendered server-side or client-side as SVG/PNG

**Client Payment View Module**
- Public route: `/invoice/[id]` with access code gate
- On access code entry, fetch invoice and current BTC price, compute BTC amount
- Display invoice details + QR code
- Subscribe to payment status via WebSocket or polling; update UI in real time

**Payment Detection Module**
- Primary: mempool.space WebSocket connection per active invoice
- Fallback: exponential backoff polling (starts 30s, doubles, caps at ~10min)
- On login, sweep all unconfirmed invoices for the logged-in user to catch missed events
- On 0-conf: update invoice status to `payment_detected`, trigger email notification
- On 1-conf: update invoice status to `paid`, trigger email notification

**Email Notification Module**
- Transactional email via Resend + React Email templates
- Triggers: invoice link + access code send; payment detected; payment confirmed

### Architecture Decisions
- Next.js App Router with server components for data fetching
- Supabase for database, auth, and storage
- All BTC price fetching happens server-side; clients never call price APIs directly
- Payment detection runs in a long-lived client-side WebSocket connection (initiated on the client payment view page), not a serverless function, to avoid cold starts and timeout limits
- mempool.space WebSocket is opened per invoice view; connection closed when invoice reaches `paid`
- Row-level security (RLS) in Supabase: users can only read/write their own invoices; public invoice view authenticated by access code via an API route

### Schema
- `invoices` table: id (uuid), user_id (uuid, FK to auth.users), client_name, client_email, line_items (jsonb), subtotal_fiat (numeric), tax_fiat (numeric), total_fiat (numeric), currency (text), btc_address (text), status (enum), access_code (text), due_date (date), created_at, updated_at
- Unique partial index on `btc_address` where `status != 'draft'`

### API Contracts
- `GET /api/btc-price?currency=USD` — returns `{ price: number, source: string }`
- `GET /api/invoice/[id]?code=XXXXXXXX` — returns invoice data if access code matches (public)
- `POST /api/invoice/[id]/status` — internal server action to update status after payment detection

## Testing Decisions

A good test verifies externally observable behavior, not implementation details. Tests should not mock internal modules — only external I/O boundaries (database, third-party APIs, email).

- **BTC Price Module** — mock HTTP calls to Coinbase and CoinGecko; verify fallback behavior and caching
- **Payment Detection Module** — mock mempool.space WebSocket events; verify status transitions and email trigger calls
- **Invoice CRUD** — integration tests against a real Supabase test instance; verify address uniqueness enforcement, access code generation, and status transitions
- **Client Payment View** — end-to-end: enter valid/invalid access code, verify BTC amount displayed, simulate payment detected event

## Monetisation (Free + Pro)

SatSend launches with a free tier and a paid tier (Pro). Invoicing is unlimited on both tiers; the paid tier is feature-gated, not volume-gated.

- **Free:** unlimited invoices, BTC payment detection, share link, PDF, dashboard, and owner-facing payment notifications ("you got paid").
- **Pro:** pretty links (`satsend.me/yourcompany`), client pages, saved clients, custom branding, client-facing email (sent from your display name), payment reminders, financial reports + export, and API access.

All client-facing email is Pro-only. Owner-facing payment notifications stay free. Billing is Bitcoin-only and self-serve from day one.

The full split, the entitlement model, and the build order live in `development/ROADMAP.md` (section v2, "Monetisation plan").

## Out of Scope (MVP)

Not part of the MVP. Several of these are planned for the paid tier in v2 (paid accounts, branding, saved clients, custom subdomains); see `development/ROADMAP.md`.

- OAuth (Google, GitHub, LinkedIn)
- Custom subdomains (yourcompany.satsend.me)
- Branding/logo upload
- xpub / HD wallet support
- Saved contacts / address book
- Reusable services/line items list
- Mobile apps
- Multi-currency support beyond fiat/BTC pair

## Further Notes

- BTC address is entered manually by the invoice creator for v1 — no wallet integration or xpub derivation.
- mempool.space WebSocket is free tier — no API key required for basic transaction watching.
- The access code is low-security by design: it protects casual snooping but is not cryptographically secure. Invoice links are not publicly indexed.
- Dark-first UI using shadcn/ui default dark aesthetic. Brand colors: background `#0A0A0A`, surface `#181818`, accent `#DE3C4B`, muted `#7C7F65`.
