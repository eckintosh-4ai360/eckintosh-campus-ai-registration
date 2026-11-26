# eckintosh-campus-ai-registration

# Eckintosh AI Campus Programme — registration website

Beyond the Books: AI Edition | Eckintosh Technologies

This replaces the earlier non-transmitting HTML demo. It is a full-stack registration application, prepared for a Vercel deployment and a Neon PostgreSQL database. There are no fictional event dates, fees, bookings or success responses in the public application. Registration remains closed until an approved event and the required credentials are configured.

## What is included
- Responsive website, privacy notice, accessible labelled fields, registration status lookup, receipt reference and manual payment follow-up.
- Server-side validation, origin checks, non-public database tables, per-event phone number checks and unique registration references.
- Database schema, Vercel Node API endpoints, tests, environment variable template and deployment instructions.
- No real money is collected. Payment verification is performed manually by the authorised organiser against provider records. Once MNotify SMS is configured and enabled, marking a registration paid sends a confirmation SMS. The official contact email is from the programme proposal; verify it is still correct before launch.

## 1. Prepare the database
1. Create a project in the [Neon console](https://console.neon.tech/) and choose an appropriate region.
2. Copy the connection string from Neon's Connect dialog. Create `.env` from `.env.example` and set `DATABASE_URL` to that value. Keep it private and never expose it in browser code or Git. A pooled connection string is suitable for the application.
3. Run `npm install`, then `npm run db:setup` once against a new, empty database. This creates the tables and functions in `database/setup.sql`; it does not insert an event. Existing tables are not overwritten. You can also run the SQL in Neon's SQL Editor using the same database role.
4. In Neon's SQL Editor, insert an approved event in `eai_events` with host, venue, date_label (including local time), fee_pesewas (integer, Ghana cedis × 100), and payment_instructions. Keep status `draft` until launch. Only one event may be open at once. Do not insert hypothetical event details.

The connection role owns the tables and bypasses row-level security; keep its credentials server-side and restrict access to your Neon project. SQL access for other roles must be explicitly granted as needed.

For an existing database created before these changes, run `database/allow-null-institution.sql`, `database/use-phone-for-registration.sql`, `database/remove-capacity-limit.sql`, and `database/short-registration-references.sql`, `database/hyphenated-registration-references.sql`, and `database/admin-setup.sql`, in that order, in the Neon SQL Editor before deploying this version.

For an existing database, also run `database/sms-setup.sql` before deploying SMS support. A new database created with `database/setup.sql` already includes these tables and columns.

## 2. Deploy to your domain
1. Upload the contents of this folder (including `api`, `lib`, `database`, `assets`, `vercel.json` and `package.json`) to a private Git repository. Do not upload a populated `.env` file. GitHub is optional: the Vercel CLI can deploy the directory directly.
2. In Vercel, create/import a project, use framework preset **Other**, root directory this folder, no build command and default output directory (do not choose a static-only output folder). Alternatively from this folder use `npx vercel` and then `npx vercel --prod` once configured.
3. Add the values listed in `.env.example` in Settings → Environment Variables for the correct environments. Redeploy after changes.
4. Under Settings → Domains, add your desired registration subdomain, for example `register.yourdomain.com`. Follow Vercel's actual DNS instructions at your registrar; do not replace the records for your existing main site unnecessarily. Confirm HTTPS. This is designed as a separate root-level project, not as a nested directory in an existing website.
5. Configure hosting-level request rate limits on `/api/register` and `/api/status` (and reasonable general API limits). Use the hosting provider's firewall or an equivalent reverse proxy. Review any hosting and database plan costs and commercial-use terms.
6. Open the website. In a staging project, run the checklist below. When the approved event is ready, set the database event status to `open`. To stop registrations set it to `closed`.

## 3. Manage registrations and payments
Sign in at `/admin` to view and search registrations. Enter the provider's transaction reference and choose **Paid** after verifying payment. Pending registrations can be cancelled and paid registrations can be marked refunded. The page does not verify payments automatically.

In **SMS settings**, enter your MNotify API key and approved sender ID, edit the confirmation text, then enable automatic SMS. The MNotify user ID field is optional account information; the Quick SMS API authenticates with the API key. The key is encrypted in the database using `ADMIN_SESSION_SECRET` and is never returned to the browser. Keep that secret stable: if you rotate it, re-enter the MNotify key. The sender ID must be approved by MNotify. The message must contain `{reference}` and may contain `{name}`. SMS is sent only when an admin marks a pending registration as paid while SMS is enabled. Existing paid registrations are not sent automatically.

The SMS column shows **Submitted** when MNotify accepts the request; this does not prove handset delivery. **Failed** means MNotify rejected it. **Check MNotify** means the request outcome is uncertain, such as a timeout. Check the MNotify dashboard before using **Send SMS** on an uncertain attempt because a repeat could create a duplicate. If SMS is disabled or incomplete, payment can still be confirmed and the message remains **Not sent**. The admin can send it later after enabling SMS. MNotify Quick SMS only serves supported local numbers; see its [API documentation](https://readthedocs.mnotify.com/sms/quick) for country restrictions.

For a new environment, generate admin credentials locally without placing the password in a file or command history:

```sh
read -r ADMIN_SETUP_EMAIL
read -rs ADMIN_SETUP_PASSWORD
export ADMIN_SETUP_EMAIL ADMIN_SETUP_PASSWORD
npm run admin:setup
unset ADMIN_SETUP_EMAIL ADMIN_SETUP_PASSWORD
```

The script writes a password hash and a random session secret to the ignored `.env` file. Restart the local server. For deployment, configure `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and `ADMIN_SESSION_SECRET` as server-side environment variables along with `DATABASE_URL`. Use a strong unique password and HTTPS. Run `database/admin-setup.sql` once on an existing database. Sign-in attempts are limited across server instances and sessions expire after eight hours.

The database is the source of truth. In the Neon SQL Editor, inspect `eai_registrations` for attendee details, reference, expected_fee_pesewas, status and timestamps. Use MFA and restrict dashboard access. Export only what is needed to a secured CSV; do not share raw records publicly.

`pending` = registration saved, payment not verified. `paid` = verified payment and seat confirmed. `cancelled` = registration cancelled. `refunded` = verified refund, no seat. The site does not accept payment credentials. The event's approved payment instructions are displayed only after registration; configure them to tell students how to contact you or pay via your approved merchant method. Never request PINs or OTPs.

To confirm a payment, compare the provider record with the expected fee, currency, participant and event, ensure it has not been refunded or reused, then update `payment_reference`, `payment_verified_at` and `status=paid` in a single database edit. The unique payment reference prevents reuse; no application verifies provider records automatically. Use only a trusted, authorised merchant channel. Resolve late payments before marking cancelled registrations paid. Cancel stale pending requests manually after following your published terms, to keep records current. Cancelled registrations retain the phone number check; restore or handle re-registration manually rather than deleting audit records. Avoid changing event fee while registrations are active; existing entries retain the original fee.

Four-digit AI-UG references provide 10,000 unique codes; registration cannot continue after all codes are used. There is no automatic expiry. Do not treat a pending registration as a confirmed seat. Define and publish a pending-payment deadline, terms and refund policy before opening registration. The admin page is available at `/admin`.

## 4. Launch checklist
- [ ] Approved date, venue, registration fee, payment instructions, refund/cancellation policy and support contact.
- [ ] Review the supplied privacy notice with the actual hosting/storage regions, providers, retention duration and Ghanaian data protection obligations; implement retention and access controls. Update the consent version in `database/setup.sql`/function when publishing a revised notice.
- [ ] Database tables have RLS, anonymous access denied, server secrets restricted, MFA on admin accounts, HTTPS, backups and rate limits configured.
- [ ] Valid submission creates one pending database row and a real reference; status lookup returns pending; wrong phone number/reference does not reveal personal data.
- [ ] Duplicate, missing fields, invalid phone, and closed events are rejected.
- [ ] Verify a controlled real payment via approved provider; update record; lookup returns paid; test refund/cancellation handling.
- [ ] With your MNotify credentials and credit, confirm a controlled payment and verify the SMS in the MNotify dashboard and on the recipient phone. Test a failed send and the manual retry flow.
- [ ] Check mobile and desktop form, keyboard navigation and screen-reader labels; verify support links.
- [ ] Close staging and remove test data from staging. Never use test credentials in production.

## Local development and files
Run `npm install`, copy `.env.example` to `.env`, and configure the variables. `npm run dev` serves the frontend and API locally at http://localhost:3000; restart it after editing `.env`. `npm run db:setup` initializes a new Neon database, and `npm test` runs Node validation tests. `npx vercel dev` is an alternative when using the Vercel CLI. A plain static server (`python -m http.server 8000`) is sufficient to preview layout only; submission correctly remains unavailable without the API. The included source is editable plain HTML/CSS/JS, not a framework-specific bundle.

Reference docs: https://vercel.com/docs/functions/runtimes/node-js ; https://neon.com/docs/connect/connect-from-any-app ; https://dpc.gov.gh/

Verification performed for this package: local validation tests and browser layout checks. Live Vercel/Neon integration and payment verification must still be tested with your own accounts and credentials. No domain changes or deployments have been performed.
