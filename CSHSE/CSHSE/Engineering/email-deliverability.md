---
name: Email deliverability (SendGrid / Postal)
description: How outbound email is sent — SendGrid-primary with Postal fallback, fixed branded From, trust footer, and how to verify delivery. Why the Spamhaus-listed Railway IP forced the switch.
type: concept
tags: [email, deliverability, sendgrid, postal, notifications, infra]
last_reviewed: 2026-06-16
---

# Email deliverability (SendGrid / Postal)

How the portal sends transactional email (invitations, validation results, review/board notifications) and why it lands in the inbox.

## Provider abstraction

`server/src/services/emailService.ts` is the single send path. It prefers SendGrid and falls back to the self-hosted Postal server:

```
const useSendgrid = isSendgridConfigured();      // !!SENDGRID_API_KEY
const send = useSendgrid ? sendgridSendEmail : postalSendEmail;
```

- SendGrid client: `server/src/services/sendgrid.ts` (thin v3 `POST https://api.sendgrid.com/v3/mail/send`, Bearer auth, 202 = sent, `x-message-id` is the id, retries 5xx/429/connection, never retries other 4xx). Contract test: `server/tests/unit/sendgrid.test.ts`.
- Postal client: `server/src/services/postal.ts`.
- Setting `SENDGRID_API_KEY` switches providers with no other change. **Dev and prod share the same SendGrid account.**
- Boot logs both: `assertPostalConfig()` + `assertSendgridConfig()` in `server/src/index.ts`.

## From address & identity

- **From is FIXED** to `cshse@courseworx.media` (env `SENDGRID_FROM` / `POSTAL_DEFAULT_FROM`), display name **"CSHSE Self-Study Portal"** (`SENDGRID_FROM_NAME`).
- Per-user identity rides in `reply_to`, never in From — keeps domain alignment for DKIM/SPF.

## Why SendGrid (the Spamhaus story)

The self-hosted Postal server runs on a Railway/GCP egress IP (`35.221.23.232`) with no reverse-DNS control. That IP is Spamhaus-listed, so Microsoft 365 / `.edu` receivers HardFailed outbound mail with `550 5.7.1 ... blocked using Spamhaus` — Postal reported `status=sent` but recipients never got it (e.g. the Kennesaw invitations). Railway egress IPs can't be de-listed or given a PTR, so the fix was to send through SendGrid (clean reverse-DNS IPs + domain-authenticated DKIM/return-path CNAMEs on `courseworx.media`). After the switch all three Kennesaw invites showed `delivered` in the SendGrid Activity API.

## Trust footer

Every template carries a shared footer (`BRAND_FOOTER_HTML` / `BRAND_FOOTER_TEXT` in `emailService.ts`): org name, physical mailing address **9600 SW Oak Street, Ste 565, Tigard, OR 97223**, `info@cshse.org`, and a one-line "automated message / reply for questions" note. A real postal address is what Microsoft/Gmail inbox-placement filters and CAN-SPAM both look for. Address sourced from the CSHSE Member Handbook (`CSHSE/docs/CSHSE Member Handbook - 2024 FINAL.pdf`).

## Verifying delivery (ops)

- SendGrid dashboard tiles aggregate on a delay; the real-time view is **Activity → Email Activity**, or the API:
  `GET https://api.sendgrid.com/v3/messages?limit=20` (Bearer the key) → per-message `to_email` + `status` (delivered / bounce / processed / deferred / dropped).
- `delivered` = the receiving server accepted it; inbox-vs-junk is then the receiver's filtering (reputation/warmup). New-domain mail may land in junk first — tell recipients to mark "Not junk" and add `cshse@courseworx.media` to contacts.

## Gotchas

- SendGrid wraps button links for click-tracking (`u*.ct.sendgrid.net/ls/click?...`) → 302 → the real app URL (e.g. `/accept-invitation?token=...`). This is normal; the token still verifies via `GET /api/invitations/verify/:token`.
- Resend invitation (`POST /api/users/invitations/:id/resend`) works server-side; the UI bug was missing toast feedback, not a broken send — see the resend feedback fix (commit `f753b29`).

## Related

- [[cr-053-board-decisions-cycle-scheduler]] — board/cycle reminder emails go through this same `notify` path.
- [[system-architecture]] · [[module-catalog]]
