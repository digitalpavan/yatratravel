# Yatra Travels: Phase 6, admin dashboard

The dashboard is at `/admin`. It's built on Supabase (Auth, Postgres with row-level security, and Storage) and Next.js server actions.

## First-time setup

1. Create a Supabase project (Mumbai region), then copy `.env.example` to `.env.local` and fill in every value.
2. Apply the schema and load the starting content:
   ```bash
   npm run db:migrate          # tables, roles, row-level security, audit triggers, storage bucket
   npm run db:seed             # packages, vehicles, destinations, settings, blog posts from content/
   npm run admin:create -- you@example.com "Your Name"
   ```
   The last command prints a **one-time password**. Sign in at `/admin/login`; you'll be asked to choose your own password first.
3. In Supabase → Authentication → URL Configuration, set the Site URL to your domain. Password-reset links need it.
4. Start the app: `npm run dev`.

`npm run test:rls` checks the access rules against an in-memory Postgres. Run it after every schema change.

## Roles

| | Staff | Admin |
|---|:---:|:---:|
| Dashboard figures, bookings, enquiries (view, status, notes, assign, contact) | ✓ | ✓ |
| Payment status and amounts on bookings | ✓ | ✓ |
| Vehicle list and fleet details (view); unavailable dates (edit) | ✓ | ✓ |
| Packages, prices, itineraries, images, SEO | | ✓ |
| Vehicle categories, capacity, pricing rules, fleet records | | ✓ |
| Website content, blog, destinations, reviews, launch switch | | ✓ |
| Staff accounts and roles, password resets | | ✓ |
| CSV export, audit log, revenue figures | | ✓ |

## How access is enforced (three layers)

1. **`proxy.ts`** refreshes the session and sends signed-out visitors to the login page. This is for convenience only.
2. **Server checks.** Every admin page and server action starts with `requireRole()`, and route handlers use `checkRole()`. These validate the session token with Supabase and read the role fresh from `profiles`, so deactivating someone takes effect on their next click. Hidden menu links are never the protection.
3. **Row-level security in Postgres.** Admin queries run *as the signed-in user*, so even a bug in the app can't read or change more than that role allows:
   - The public (`anon`) key can read only published packages, active vehicles, public settings and published posts. It has **no access** to bookings, enquiries, staff or the audit log.
   - Public booking and enquiry forms write through the server with the secret key, after validation.
   - Triggers enforce the booking workflow (pending → contacted → confirmed → completed, or cancelled; confirming needs an agreed price; completing needs the travel date to have arrived) and keep the reference read-only. See [08-booking-workflow.md](08-booking-workflow.md). They also stop anyone changing their own role or access.

Sessions use HttpOnly, SameSite=Lax cookies (Secure in production). Server actions have Next.js's built-in origin check. Sign-in is rate-limited, uses one error message for wrong email and wrong password, and only redirects within `/admin`. Password changes require the current password.

## Audit log

Database triggers record every insert, update and delete on bookings, enquiries, packages, prices, vehicles, availability, destinations, settings, blog posts, media and profiles: who made the change, when, and which fields changed. Customer details (name, phone, pickup, messages) are recorded only as "changed", never copied. Exports, account creation and password resets are logged explicitly. No role can edit or delete entries. Admins can view them at `/admin/audit`.

## Notes

- **Revenue** stays hidden until an admin turns on *Website content → Accounting → "Revenue figures are reliable"*. Even then it's calculated only from payments recorded on bookings.
- **Image uploads** are checked to be real images (at least 800px wide, up to 10 MB). Metadata is stripped, they're resized to 480–1600px WebP, and stored in the public `media` bucket. Alt text is required.
- **Launch:** *Website content → Business & launch → "Business details are verified"* removes the preview banner and the `noindex` tags.
- **Rate limits** live in server memory. On serverless hosting each instance counts separately, so add Supabase/Upstash rate limiting if spam appears.
- **Not built yet:** automatic staff notifications for new bookings (email or WhatsApp Business API), and confirmation messages sent to customers.
