# eckintosh-campus-ai-registration

# Eckintosh AI Campus Programme — registration website

Beyond the Books: AI Edition | Eckintosh Technologies

This replaces the earlier non-transmitting HTML demo. It is a full-stack registration application, prepared for a Vercel deployment and a Neon PostgreSQL database. There are no fictional event dates, fees, bookings or success responses in the public application. Registration remains closed until an approved event and the required credentials are configured.

## What is included
- Responsive website, privacy notice, accessible labelled fields, registration status lookup, receipt reference and manual payment follow-up.
- Server-side validation, Cloudflare Turnstile challenge, origin checks, non-public database tables, transactional intake capacity, per-event unique email and unguessable registration references.
- Database schema, three Vercel Node API endpoints, tests, environment variable template and deployment instructions.
- No real money is collected. Payment verification is performed manually by the authorised organiser against provider records. No automated email, SMS or WhatsApp is sent; the browser shows the reference. The official contact email is from the programme proposal; verify it is still correct before launch.

## 1. Prepare the database
1. Create a project in the [Neon console](https://console.neon.tech/) and choose an appropriate region.
2. Copy the connection string from Neon's Connect dialog. Create `.env` from `.env.example` and set `DATABASE_URL` to that value. Keep it private and never expose it in browser code or Git. A pooled connection string is suitable for the application.
3. Run `npm install`, then `npm run db:setup` once against a new, empty database. This creates the tables and functions in `database/setup.sql`; it does not insert an event. Existing tables are not overwritten. You can also run the SQL in Neon's SQL Editor using the same database role.
4. In Neon's SQL Editor, insert an approved event in `eai_events` with host, venue, date_label (including local time), fee_pesewas (integer, Ghana cedis × 100), capacity and payment_instructions. Keep status `draft` until launch. Only one event may be open at once. Do not insert hypothetical event details.

The connection role owns the tables and bypasses row-level security; keep its credentials server-side and restrict access to your Neon project. SQL access for other roles must be explicitly granted as needed.

## 2. Configure bot protection
1. Create a Cloudflare Turnstile widget at https://dash.cloudflare.com/ in the Turnstile section, with your intended registration hostname allowlisted.
2. Copy its site key and secret key. Set `TURNSTILE_HOSTNAME` to the exact production hostname (no protocol or slash). Use a separate staging widget/hostname for testing. The application verifies tokens server-side and checks the hostname. For local browser tests use a separate test environment and never use test keys in production.

## 3. Deploy to your domain
1. Upload the contents of this folder (including `api`, `lib`, `database`, `assets`, `vercel.json` and `package.json`) to a private Git repository. Do not upload a populated `.env` file. GitHub is optional: the Vercel CLI can deploy the directory directly.
2. In Vercel, create/import a project, use framework preset **Other**, root directory this folder, no build command and default output directory (do not choose a static-only output folder). Alternatively from this folder use `npx vercel` and then `npx vercel --prod` once configured.
3. Add the four values listed in `.env.example` in Settings → Environment Variables for the correct environments. Redeploy after changes.
4. Under Settings → Domains, add your desired registration subdomain, for example `register.yourdomain.com`. Follow Vercel's actual DNS instructions at your registrar; do not replace the records for your existing main site unnecessarily. Confirm HTTPS and exact Turnstile hostname. This is designed as a separate root-level project, not as a nested directory in an existing website.
5. Configure hosting-level request rate limits on `/api/register` and `/api/status` (and reasonable general API limits). Use the hosting provider's firewall or an equivalent reverse proxy. Review any hosting and database plan costs and commercial-use terms.
6. Open the website. In a staging project, run the checklist below. When the approved event is ready, set the database event status to `open`. To stop registrations set it to `closed`.

## 4. Manage registrations and payments
The database is the source of truth. In the Neon SQL Editor, inspect `eai_registrations` for attendee details, reference, expected_fee_pesewas, status and timestamps. Use MFA and restrict dashboard access. Export only what is needed to a secured CSV; do not share raw records publicly.

`pending` = registration saved, payment not verified. `paid` = verified payment and seat confirmed. `cancelled` = released intake slot. `refunded` = verified refund, no seat. The site does not accept payment credentials. The event's approved payment instructions are displayed only after registration; configure them to tell students how to contact you or pay via your approved merchant method. Never request PINs or OTPs. Contact the participant yourself; no automated message is sent.

To confirm a payment, compare the provider record with the expected fee, currency, participant and event, ensure it has not been refunded or reused, then update `payment_reference`, `payment_verified_at` and `status=paid` in a single database edit. The unique payment reference prevents reuse; no application verifies provider records automatically. Use only a trusted, authorised merchant channel. Do not mark cancelled registrations paid without checking availability and resolving any late payment. Cancel stale pending requests manually after following your published terms, to release capacity. Cancelled registrations retain the unique email constraint; restore or handle re-registration manually rather than deleting audit records. Avoid changing event fee/capacity while registrations are active; existing entries retain the original fee.

The capacity gate counts both pending and paid registrations, so requests temporarily occupy intake slots until the organiser cancels them. No automatic expiry or waitlist is provided. Do not treat a pending registration as a confirmed seat. Define and publish a pending-payment deadline, terms and refund policy before opening registration. No separate custom admin interface is included: the secured Neon console serves as the initial management interface.

## 5. Launch checklist
- [ ] Approved date, venue, registration fee, capacity, payment instructions, refund/cancellation policy and support contact.
- [ ] Review the supplied privacy notice with the actual hosting/storage regions, providers, retention duration and Ghanaian data protection obligations; implement retention and access controls. Update the consent version in `database/setup.sql`/function when publishing a revised notice.
- [ ] Database tables have RLS, anonymous access denied, server secrets restricted, MFA on admin accounts, HTTPS, backups and rate limits configured.
- [ ] Valid submission creates one pending database row and a real reference; status lookup returns pending; wrong email/reference does not reveal personal data.
- [ ] Duplicate, missing fields, invalid phone, expired CAPTCHA, closed event and full capacity are rejected; two simultaneous requests for the last intake slot result in only one success.
- [ ] Verify a controlled real payment via approved provider; update record; lookup returns paid; test refund/cancellation handling.
- [ ] Check mobile and desktop form, keyboard navigation and screen-reader labels; verify support links.
- [ ] Close staging and remove test data from staging. Never use test credentials in production.

## Local development and files
Run `npm install`, copy `.env.example` to `.env`, and configure the variables. `npm run dev` serves the frontend and API locally at http://localhost:3000; restart it after editing `.env`. `npm run db:setup` initializes a new Neon database, and `npm test` runs Node validation tests. `npx vercel dev` is an alternative when using the Vercel CLI. A plain static server (`python -m http.server 8000`) is sufficient to preview layout only; submission correctly remains unavailable without the API. The included source is editable plain HTML/CSS/JS, not a framework-specific bundle.

Reference docs: https://vercel.com/docs/functions/runtimes/node-js ; https://neon.com/docs/connect/connect-from-any-app ; https://developers.cloudflare.com/turnstile/get-started/server-side-validation/ ; https://dpc.gov.gh/

Verification performed for this package: local validation tests and browser layout checks. Live Vercel/Neon/Turnstile integration and payment verification must still be tested with your own accounts and credentials. No domain changes or deployments have been performed.
