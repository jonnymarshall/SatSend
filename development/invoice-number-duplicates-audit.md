# Invoice-number duplicates — production audit (v1.4.23-H follow-up)

Read-only snapshot of `public.invoices` on **production**, taken 2026-10-06,
before adding the `(user_id, invoice_number)` unique index. **8 duplicate groups
across 3 users.** Nothing here has been changed; this is the starting point for
the split-out follow-up.

**Why they exist.** The duplicate-invoice generator appended a fixed
`"... (copy)"`, so duplicating an invoice that was already a copy produced the
same number again. That generator is **fixed in v1.4.23-H** (`buildDuplicateInvoiceNumber`
now walks ` (copy)`, ` (copy 2)`, ... and skips numbers already taken). These rows
predate the fix.

**Decision needed per group:** delete or archive (fine for your own test
invoices) vs rename the later copies (light touch for real-user rows). All times
are UTC. `ids` are listed in creation order, so the first id is the original.

| # | owner (user_id) | invoice_number | n | statuses (in order) | created (in order) |
| - | --------------- | -------------- | - | ------------------- | ------------------ |
| 1 | `5a2a65cb-8199-4687-ad54-8e86fc85e978` | `THREEHUNDREDTHREEHUN... (copy)` | 3 | draft, draft, draft | 2026-05-09 01:20:44 / 01:20:51 / 01:21:05 |
| 2 | `5a2a65cb-8199-4687-ad54-8e86fc85e978` | `ABCDEFGHIJKLMNOPQRST... (copy)` | 2 | draft, pending | 2026-05-09 01:27:51 / 01:30:14 |
| 3 | `7c2de809-399c-4165-86cf-e56f8911e31f` | `INV-017-TNET` | 2 | draft, archived | 2026-04-23 17:19:47 / 17:19:58 |
| 4 | `7c2de809-399c-4165-86cf-e56f8911e31f` | `INV-019-TNET` | 2 | draft, pending | 2026-04-23 18:05:10 / 18:05:31 |
| 5 | `7c2de809-399c-4165-86cf-e56f8911e31f` | `INV-020-TNET` | 2 | paid, paid | 2026-04-23 18:07:38 / 18:10:40 |
| 6 | `5a2a65cb-8199-4687-ad54-8e86fc85e978` | `TNET_034` | 2 | paid, draft | 2026-04-27 17:13:35 / 20:51:26 |
| 7 | `62f58abc-dfd3-4cdc-bad4-bb71b25afc5d` | `TNET-024` | 2 | draft, paid | 2026-04-24 18:21:24 / 18:21:31 |
| 8 | `5a2a65cb-8199-4687-ad54-8e86fc85e978` | `YO... (copy)` | 2 | draft, draft | 2026-05-09 01:21:27 / 01:22:28 |

Record ids (in creation order), for the cleanup step:

```
group 1  THREEHUNDREDTHREEHUN... (copy)  5d594793-4b3d-4e63-ba80-df39948aae92  76d41c67-5302-4037-a0d7-7695ce6460db  f5f0c383-f4aa-460c-88b3-01f93fb3baf3
group 2  ABCDEFGHIJKLMNOPQRST... (copy)  7197e117-2e74-4b88-993a-0937127d50dd  41aa5b1a-1a97-4f96-9b6a-69083106770d
group 3  INV-017-TNET                     1b429b6d-df6d-4b37-8b3f-461c4439780e  b6f6cafe-6f4c-4456-bdbf-952d5d47e464
group 4  INV-019-TNET                     7c25300a-1cbd-43fe-bc87-bd6e922743b2  dbe3b229-a97e-4f4f-bc33-4601647a8031
group 5  INV-020-TNET                     ca2c5ff7-742f-46ff-b59c-2ab27ee4276b  aacda862-7e9d-4e4c-83d0-36d4e487d718
group 6  TNET_034                         f0d75692-a6f1-4f63-857c-fd2b1a47bc9c  e2e4d625-70c5-471d-9528-23902b3a4cda
group 7  TNET-024                         1cc19871-d07d-4295-8de9-1b27640db3a4  59b6300c-102e-48f6-aad8-8ae7945baefd
group 8  YO... (copy)                     612b91c4-9d9f-42b0-9b2f-47d4942d2a07  214c3ddf-b6f0-4d04-97d2-813e19a1dd88
```

## Suggested handling

- **Groups 1, 2, 8** (drafts, `... (copy)` names, user `5a2a65cb…`): these look
  like your own testing. Delete or archive the extras.
- **Groups 3–7** (`TNET*` names): likely your testnet testing too, but note
  group 5 has two **paid** rows and groups 6/7 each mix paid with a later
  duplicate. Keep the paid/original row; rename the later copy (light touch) or
  delete if it is junk.
- Do **not** rename the original in any group — rename the later copy.

## Then the constraint

After the data is clean, add:

```sql
create unique index invoices_user_id_invoice_number_key
  on public.invoices (user_id, invoice_number)
  where invoice_number is not null;

alter table public.invoices
  add constraint invoices_invoice_number_not_blank
  check (invoice_number is null or invoice_number <> '');
```

and a friendly message for the `23505` on the create / publish path.
