# DeliverCrew Distribution

Static website hosted on Cloudflare Pages from the GitHub main branch.
Website content and orders are stored in the DeliverCrew Supabase project.
The owner edits page content at `/admin/` and manages orders at `/dashboard/`.

## Cloudflare Pages payments

The active deployment is Cloudflare Pages project `delivercrew`, connected to
`main`. `_worker.js` handles only `/api/payments/*` via `_routes.json`.
No card numbers enter DeliverCrew: payment is collected by Stripe Checkout.

Configure these **production** settings in Cloudflare > delivercrew > Settings >
Variables and secrets. Never commit their values:

- `STRIPE_SECRET_KEY` (Secret): the Stripe key already saved by the owner.
- `SUPABASE_SECRET_KEY` (Secret): a backend secret key for the DeliverCrew Supabase
  project `nbwbqosofzwnxhzpsicj`. A legacy `SUPABASE_SERVICE_ROLE_KEY` is also
  supported, but do not use the browser publishable key for this setting.
- `STRIPE_WEBHOOK_SECRET` (Secret): signing secret for the Stripe webhook endpoint
  `https://delivercrewdistribution.co.uk/api/payments/webhook`. Subscribe to
  `checkout.session.completed` and `checkout.session.async_payment_succeeded`.
  Use the same test/live environment as `STRIPE_SECRET_KEY`.
- `PAYMENTS_ENABLED` (Text): defaults to disabled. Set to `true` only when setup
  is ready for a controlled test, and keep a test Stripe key in place for tests.
  Before changing to a live key, disable payments, switch both Stripe secrets
  to their live equivalents, verify the live webhook endpoint and re-enable.

Redeploy after changing Cloudflare settings. Test keys create test campaigns in
this same database, so label the test customer's name clearly; don't use a real
customer's email. The confirmation page labels a test payment as a test.

Run `node --test tests/payments.test.mjs` for simulated integration tests.
A real Stripe test-mode payment and webhook delivery still need verification
before live payment launch. Test retries, cancellation, and return to the site.

Prices come from the existing `prepare_campaign_checkout` database RPC (restricted
to `service_role`). Stripe session creation uses a stable idempotency key; the
session is stored before the customer is redirected. Both webhook and return-page
confirmation retrieve the session from Stripe and match its campaign ID, stored
session ID, currency, amount and test/live mode. Only unpaid orders transition to
paid. The webhook retries through Stripe when saving fails. The return page is an
additional check, not the only confirmation path. Admin refunds must currently
be recorded in both Stripe and the DeliverCrew dashboard.

The customer-facing `/api/payments/config` returns only availability and test-mode
status. It never returns secret values. The checkout button remains disabled
until all three private settings and `PAYMENTS_ENABLED=true` are present.
