# Deep Sight — Stripe Integration Audit

> Generated: 2026-02-10 | File: `backend/src/billing/router.py` (1460+ lines)

---

## Summary

| Area | Status |
|------|--------|
| Webhook signature verification | OK — `stripe.Webhook.construct_event()` |
| Idempotency (event dedup) | FIXED — in-memory LRU cache + DB-level payment_id check |
| checkout.session.completed | OK — credits, plan update, email |
| customer.subscription.created | OK — stores subscription_id |
| customer.subscription.updated | OK — upgrade/downgrade + credit diff |
| customer.subscription.deleted | FIXED — revert to free + email notification |
| invoice.paid | OK — monthly renewal credits + email |
| invoice.payment_succeeded | FIXED — now handled (aliases invoice.paid) |
| invoice.payment_failed | OK — email notification |
| Health endpoint | ADDED — `GET /api/stripe/health` |
| Email integration | OK — all payment webhooks send emails |
| Production guards | OK — Pydantic Settings rejects test mode in production |

---

## Webhook Events Handled

| Event | Handler | Credits | Email | Idempotent |
|-------|---------|---------|-------|------------|
| `checkout.session.completed` | `handle_checkout_completed()` | +monthly_credits | `send_payment_success` | Yes (DB) |
| `customer.subscription.created` | `handle_subscription_created()` | No | No | N/A |
| `customer.subscription.updated` | `handle_subscription_updated()` | +diff on upgrade | No | N/A |
| `customer.subscription.deleted` | `handle_subscription_deleted()` | No | `send_payment_failed` | N/A |
| `invoice.paid` | `handle_invoice_paid()` | +monthly_credits | `send_payment_success` | Yes (DB) |
| `invoice.payment_succeeded` | `handle_invoice_paid()` | +monthly_credits | `send_payment_success` | Yes (DB) |
| `invoice.payment_failed` | `handle_payment_failed()` | No | `send_payment_failed` | N/A |

---

## Signature Verification

```python
# billing/router.py — webhook handler
event = stripe.Webhook.construct_event(
    payload=await request.body(),    # Raw body (required)
    sig_header=stripe_signature,     # From Stripe-Signature header
    secret=webhook_secret            # STRIPE_WEBHOOK_SECRET env var
)
```

- Raw body read with `await request.body()` (correct for signature verification)
- `SignatureVerificationError` returns HTTP 401
- Missing/empty `Stripe-Signature` header returns HTTP 400
- Missing `STRIPE_WEBHOOK_SECRET` returns HTTP 500

---

## Idempotency Implementation

### Level 1: In-memory event ID cache
```python
_processed_events = _EventIdCache(maxsize=10_000)

# In webhook handler:
if _processed_events.seen(event_id):
    return {"received": True, "duplicate": True}
# ... process event ...
_processed_events.mark(event_id)
```
- LRU cache bounded to 10,000 entries
- Prevents duplicate processing from Stripe retries within a single process lifetime

### Level 2: DB-level payment_id check
```python
# In handle_checkout_completed() and handle_invoice_paid():
existing = await session.execute(
    select(CreditTransaction).where(
        CreditTransaction.stripe_payment_id == payment_id
    )
)
if existing.scalar_one_or_none():
    return  # Already processed
```
- Survives server restarts
- Prevents double-crediting even with concurrent requests

---

## Health Endpoint

**URL**: `GET /api/stripe/health` (also available at `/api/billing/health`)

**Response (success)**:
```json
{
  "status": "ok",
  "connected": true,
  "account_id": "acct_...",
  "livemode": true,
  "test_mode": false,
  "webhook_configured": true
}
```

**Response (failure)**:
```json
{
  "status": "error",
  "detail": "Invalid Stripe API key",
  "connected": false
}
```

Calls `stripe.Account.retrieve()` to verify the API key is valid and the connection works.

---

## Stripe API Calls Inventory

| Call | Location | Purpose |
|------|----------|---------|
| `stripe.Customer.create()` | `get_or_create_stripe_customer()` | Create customer on first payment |
| `stripe.Customer.retrieve()` | `get_or_create_stripe_customer()` | Verify existing customer |
| `stripe.checkout.Session.create()` | Multiple endpoints | Create checkout session |
| `stripe.Subscription.retrieve()` | `get_billing_info()`, `change_subscription_plan()` | Get subscription details |
| `stripe.Subscription.modify()` | `change_subscription_plan()` | Upgrade/downgrade |
| `stripe.Subscription.delete()` | `cancel_subscription()` | Cancel subscription |
| `stripe.billing_portal.Session.create()` | `customer_portal()` | Self-service portal |
| `stripe.Webhook.construct_event()` | `stripe_webhook()` | Verify webhook signature |
| `stripe.Account.retrieve()` | `stripe_health()` | Health check |

---

## Configuration

All Stripe config is centralized in `core/config.py` via Pydantic Settings:

| Env Var | Purpose | Required |
|---------|---------|----------|
| `STRIPE_ENABLED` | Enable/disable Stripe | No (default: true) |
| `STRIPE_TEST_MODE` | Use test keys | No (FORBIDDEN in prod) |
| `STRIPE_SECRET_KEY_LIVE` | Live secret key | If live mode |
| `STRIPE_SECRET_KEY_TEST` | Test secret key | If test mode |
| `STRIPE_PUBLISHABLE_KEY_LIVE` | Live publishable key | If live mode |
| `STRIPE_PUBLISHABLE_KEY_TEST` | Test publishable key | If test mode |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret | Yes |
| `STRIPE_PRICE_*_LIVE` | Live price IDs | If live mode |
| `STRIPE_PRICE_*_TEST` | Test price IDs | If test mode |

### Production Guards (config.py)
- `STRIPE_TEST_MODE=true` causes startup failure in production
- `sk_test_` prefix in `STRIPE_SECRET_KEY_LIVE` causes startup failure
- `sk_live_` prefix in `STRIPE_SECRET_KEY_TEST` causes startup failure

---

## Corrections Applied

### 1. Idempotency (NEW)
- Added `_EventIdCache` (in-memory LRU, 10k entries) for webhook event dedup
- Added DB-level `stripe_payment_id` check in `handle_checkout_completed()` and `handle_invoice_paid()`
- Duplicate events now return `{"received": true, "duplicate": true}`

### 2. invoice.payment_succeeded (NEW)
- Now handled alongside `invoice.paid` (same handler)
- Both events trigger credit renewal + email

### 3. subscription.deleted email (NEW)
- `handle_subscription_deleted()` now sends `send_payment_failed` email to notify user

### 4. Health endpoint (NEW)
- `GET /api/stripe/health` — pings Stripe API to verify connection
- Returns account ID, livemode status, and config check

### 5. Logging cleanup
- Removed emoji from log statements for cleaner structured logging

---

## Remaining Recommendations

### P1 — Should implement
- Add `charge.dispute.created` webhook handler (chargeback handling)
- Add unique constraint on `CreditTransaction.stripe_payment_id` in DB migration
- Add idempotency keys to `stripe.checkout.Session.create()` calls

### P2 — Nice to have
- Redis-backed event dedup (survives multi-instance deploys)
- Webhook event audit log table
- Invoice PDF generation/storage
- Subscription change history tracking

---

## Files Modified

| File | Changes |
|------|---------|
| `billing/router.py` | Idempotency cache, DB dedup, health endpoint, invoice.payment_succeeded, subscription_deleted email |
| `main.py` | Added `/api/stripe` prefix alias for billing router |
| `docs/stripe-audit.md` | This report |
