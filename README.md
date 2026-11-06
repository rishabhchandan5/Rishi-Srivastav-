# RoboHouse website starter

A responsive robotics project showcase and booking website with a Node.js/Express backend.
It stores booking requests locally and includes secure Razorpay order creation + signature verification endpoints.

## Included
- Home page, project catalogue, indicative starting prices
- Booking form (name, phone, email, project, budget, deadline, requirements, address)
- Booking requests stored in Supabase (recommended) or local JSON for local testing
- Razorpay backend integration scaffold (credentials required)
- FAQ and responsive mobile layout

## Run locally
1. Install Node.js 18 or later.
2. Open this folder in a terminal.
3. Run:
   ```bash
   npm install
   cp .env.example .env
   npm start
   ```
4. Open http://localhost:3000

## Important: before accepting real payments
- Create/verify your merchant account with Razorpay and complete its KYC/website review.
- Create a Supabase project, run `supabase-schema.sql` in SQL Editor, and set `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in the backend host's secret settings.
- Copy your Razorpay **Test** Key ID and Key Secret into the backend host's secret settings first.
- Never put the Key Secret in browser JavaScript or share it publicly.
- The backend has `/api/create-order` and `/api/verify-payment` endpoints. Payment must only be initiated after you confirm a quote with the customer.
- This starter intentionally does not expose a public payment button with arbitrary customer-entered amounts. Build an owner/admin quote workflow before going live.
- Test the complete payment flow in Razorpay test mode, then switch to live credentials only after approval.
- For production, use a hosted database (PostgreSQL/MongoDB), HTTPS, backups, rate limiting, admin authentication, payment webhooks, and privacy/terms/refund pages.
- If Supabase environment variables are missing, the app falls back to local JSON. Do not use that fallback on ephemeral hosting: those files can be lost. Use Supabase for deployed bookings.

## Customize before launch
- Owner/brand: RoboHouse. Contact details configured: WhatsApp +91 79854 13828 and rishabhchandan17@gmail.com. Review sample project prices, business details and delivery policy before publishing.
- Add your real WhatsApp contact and social media links.
- Add Privacy Policy, Terms & Conditions, Cancellation/Refund Policy and Shipping/Delivery Policy.
- Confirm all project prices include component cost, labour, packaging, shipping and taxes where applicable.

## Booking workflow
1. Customer submits the form.
2. RoboHouse receives a booking ID; the request is stored in `data/bookings.json`.
3. You contact the customer and confirm scope, delivery and final quote.
4. An authenticated owner/admin workflow should create a Razorpay order for that confirmed quote and send the customer to checkout.
5. Verify payment on the server before marking the booking paid.

## API
- `POST /api/bookings` — create booking
- `POST /api/create-order` — create Razorpay order for an existing booking
- `POST /api/verify-payment` — verify checkout signature
- `GET /api/health` — health check

The supplied frontend submits booking requests. The payment API is prepared but requires an owner/admin quote workflow and credentials before it can be used by customers.

## Suggested no-custom-domain publishing route
- Deploy the whole Node app as a Render Web Service from a GitHub repository. It will receive a free `onrender.com` subdomain and HTTPS.
- Set the start command to `npm start` and add the environment variables listed in `.env.example` in Render's Environment settings.
- Create a Supabase project, run `supabase-schema.sql`, and configure its URL and service-role key in Render. The service-role key must stay server-side.
- Render's free web service sleeps after inactivity and its local filesystem is ephemeral. Supabase keeps booking records outside that filesystem. Free tiers are useful for a demo, not a guaranteed always-on commercial service.
- Configure HTTPS, owner-only admin access, spam protection and database backups before taking real bookings.

## Payment setup (manual quote flow recommended to start)
- Create/activate a Razorpay merchant account and complete the requested KYC/business verification.
- In Razorpay Dashboard, create a Payment Link for the exact confirmed quote and send it to the customer over WhatsApp/email. Do not collect money before confirming scope, price, delivery and refund terms.
- Test with Razorpay test mode before switching to live mode.
- The included backend contains Razorpay Orders API and signature-verification starter endpoints, but this starter does not yet include an owner/admin dashboard or a customer-facing checkout button. Do not treat a booking request as a paid order. Verify the captured/paid status and configure webhooks before automating fulfilment.
