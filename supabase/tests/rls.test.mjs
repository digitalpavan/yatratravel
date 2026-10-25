// Access-control regression test: applies the migrations to an in-memory Postgres (PGlite) with minimal
// Supabase stand-ins (roles, auth.uid(), storage tables) and checks what anon, staff and admin can do.
// Run: npm run test:rls
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const db = new PGlite({ extensions: { pgcrypto } });
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : fail++; console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); };

// --- Supabase stand-ins: roles, auth.uid() from a session setting, auth.users, storage tables
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users (id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  alter table storage.objects enable row level security;
  grant usage on schema public, storage, auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
  grant all on storage.objects to anon, authenticated, service_role;
`);
for (const f of fs.readdirSync(`${root}/supabase/migrations`).filter(f => f.endsWith(".sql")).sort()) await db.exec(fs.readFileSync(`${root}/supabase/migrations/${f}`, "utf8"));
ok(true, 'migration applied cleanly');

// --- Fixtures (as superuser)
const ADMIN = '11111111-1111-1111-1111-111111111111', STAFF = '22222222-2222-2222-2222-222222222222', EX = '33333333-3333-3333-3333-333333333333';
await db.exec(`
  insert into auth.users values ('${ADMIN}','a@x.in'),('${STAFF}','s@x.in'),('${EX}','e@x.in');
  insert into public.profiles (id,email,full_name,role,active) values ('${ADMIN}','a@x.in','Admin','admin',true),('${STAFF}','s@x.in','Staff','staff',true),('${EX}','e@x.in','Ex','staff',false);
  insert into public.vehicles (slug,name,passengers) values ('sedan','Sedan',4);
  insert into public.vehicles (slug,name,passengers,active) values ('old-bus','Old bus',20,false);
  insert into public.vehicle_internal (vehicle_id, fleet_details) select id, 'AP03 secret reg' from public.vehicles where slug='sedan';
  insert into public.packages (slug,title,category,published) values ('live','Live','day-tour',true),('draft','Draft','day-tour',false);
  insert into public.package_vehicles (package_id,vehicle_id,price_paise) select p.id, v.id, 250000 from public.packages p, public.vehicles v where v.slug='sedan';
  insert into public.itinerary_days (package_id,day,title) select id, 1, 'Day 1' from public.packages;
  insert into public.reviews (name,quote,published) values ('Anil','Very good trip',true),('Hidden','Not approved yet',false);
  insert into public.coupons (code,discount_type,percent_off) values ('DIWALI10','percent',10);
  insert into public.site_settings (key,value,is_public) values ('contact','{"phone":null}',true),('accounting','{"revenueReliable":false}',false);
  insert into public.bookings (reference,idempotency_key,name,phone,package_slug,package_title,travel_date,passengers,pickup,vehicle,consent_at)
    values ('YT-261024-ABCD',gen_random_uuid(),'Ravi','9876543210','live','Live','2026-11-01',3,'Station','sedan',now());
  insert into public.enquiries (idempotency_key,source,name,phone,message,consent_at) values (gen_random_uuid(),'contact','Priya','9000000001','hello',now());
`);

async function as(role, sub, fn) {
  await db.exec(`set role ${role}; select set_config('request.jwt.claim.sub', '${sub ?? ''}', false);`);
  try { return await fn(); } finally { await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`); }
}
const rows = async sql => (await db.query(sql)).rows;
const fails = async sql => { try { await db.query(sql); return false; } catch { return true; } };
const affected = async sql => { try { return (await db.query(sql)).affectedRows ?? 0; } catch { return -1; } };
// Blocked either by a missing grant (error) or by RLS (no rows).
const hidden = async sql => { try { return (await db.query(sql)).rows.length === 0; } catch { return true; } };

// --- anon (public website)
await as('anon', null, async () => {
  ok((await rows('select slug from public.packages')).map(r => r.slug).join() === 'live', 'anon sees only published packages');
  ok((await rows('select * from public.package_vehicles')).length === 1, 'anon sees prices of published packages only');
  ok((await rows('select slug from public.vehicles')).map(r => r.slug).join() === 'sedan', 'anon sees only active vehicles');
  ok(await hidden('select * from public.vehicle_internal'), 'anon cannot read fleet details / pricing rules');
  ok(await hidden('select * from public.bookings'), 'anon cannot read bookings');
  ok(await hidden('select * from public.enquiries'), 'anon cannot read enquiries');
  ok(await hidden('select * from public.profiles'), 'anon cannot read staff profiles');
  ok(await hidden('select * from public.audit_log'), 'anon cannot read the audit log');
  ok((await rows("select key from public.site_settings")).map(r => r.key).join() === 'contact', 'anon sees public settings only (not accounting)');
  ok(await fails(`insert into public.bookings (reference,idempotency_key,name,phone,package_slug,package_title,travel_date,passengers,pickup,vehicle,consent_at) values ('YT-261024-ZZZZ',gen_random_uuid(),'x','9876543210','live','Live','2026-11-01',1,'x','sedan',now())`), 'anon cannot insert bookings directly');
  ok(await affected("update public.packages set title='hacked'") <= 0, 'anon cannot edit packages');
  ok(await fails("select public.log_event('x','y',null,'{}')"), 'anon cannot write audit events');
  ok(await hidden('select * from public.payments'), 'anon cannot read payments');
  ok(await hidden('select * from public.booking_items'), 'anon cannot read booking items');
  ok(await hidden('select * from public.coupons'), 'anon cannot list coupon codes');
  ok(await hidden('select * from public.notifications'), 'anon cannot read notifications');
  ok((await rows('select * from public.itinerary_days')).length === 1, 'anon sees itinerary of published packages only');
  ok((await rows('select name from public.reviews')).map(r => r.name).join() === 'Anil', 'anon sees published reviews only');
  ok(await fails("insert into public.reviews (name,quote,published) values ('Fake','Fake review',true)"), 'anon cannot post reviews');
  ok(await fails("update public.site_settings set value='{}'"), 'anon has no write grant on content');
});

// --- deactivated staff
await as('authenticated', EX, async () => {
  ok((await rows('select * from public.bookings')).length === 0, 'deactivated staff sees no bookings');
});

// --- staff
await as('authenticated', STAFF, async () => {
  ok((await rows('select * from public.bookings')).length === 1, 'staff reads bookings');
  ok((await rows('select * from public.enquiries')).length === 1, 'staff reads enquiries');
  ok((await rows('select slug from public.packages order by slug')).length === 2, 'staff sees draft packages too');
  ok((await rows('select status from public.bookings'))[0].status === 'pending', 'new bookings start as pending');
  ok(await affected("update public.bookings set status='contacted'") === 1, 'staff marks the customer contacted');
  ok(await fails("update public.bookings set status='confirmed'"), 'cannot confirm without an agreed price');
  ok(await affected("update public.bookings set quoted_price_paise=300000, status='confirmed'") === 1, 'staff confirms with the agreed price');
  ok(await fails("update public.bookings set status='pending'"), 'status cannot move backwards (trigger)');
  ok(await fails("update public.bookings set status='completed'"), 'a future trip cannot be marked completed');
  ok(await affected("update public.bookings set customer_notified_status='confirmed', customer_notified_at=now()") === 1, 'staff records that the customer was told');
  ok(await fails("update public.bookings set reference='YT-000000-AAAA'"), 'booking reference is read-only');
  const bid = (await rows('select id from public.bookings'))[0].id;
  ok(!(await fails(`insert into public.booking_notes (booking_id, body, author_id) values ('${bid}','called', '${STAFF}')`)), 'staff adds a note as themselves');
  ok(await fails(`insert into public.booking_notes (booking_id, body, author_id) values ('${bid}','spoof', '${ADMIN}')`), 'staff cannot post a note as someone else');
  ok(await affected("update public.booking_notes set body='edited'") <= 0, 'notes cannot be edited');
  ok(await affected("update public.packages set title='x'") === 0, 'staff cannot edit packages');
  ok(await fails("insert into public.packages (slug,title,category) values ('n','N','cab')"), 'staff cannot create packages');
  ok(await affected("update public.vehicles set passengers=9") === 0, 'staff cannot edit vehicles');
  ok(await affected("update public.site_settings set value='{}'") === 0, 'staff cannot edit website content');
  ok(await affected(`update public.profiles set role='admin' where id='${STAFF}'`) <= 0 && (await rows(`select role from public.profiles where id='${STAFF}'`))[0].role === 'staff', 'staff cannot promote themselves');
  ok(await affected(`update public.profiles set role='staff' where id='${ADMIN}'`) <= 0, 'staff cannot demote an admin');
  ok(await affected(`update public.profiles set full_name='Staff Two', phone='9000000002', job_title='Driver desk', avatar_url='https://x/a.webp' where id='${STAFF}'`) === 1, 'staff edits their own profile details');
  ok(await affected(`update public.profiles set full_name='Hacked' where id='${ADMIN}'`) <= 0, 'staff cannot edit someone else\'s profile');
  ok(await fails(`update public.profiles set email='new@x.in' where id='${STAFF}'`), 'staff cannot change their own sign-in email');
  ok(await fails(`update public.profiles set must_change_password=false where id='${STAFF}'`), 'staff cannot clear the one-time password flag');
  ok(!(await fails(`insert into storage.objects (bucket_id, name) values ('avatars', '${STAFF}/me.webp')`)), 'staff uploads a photo to their own folder');
  ok(await fails(`insert into storage.objects (bucket_id, name) values ('avatars', '${ADMIN}/me.webp')`), 'staff cannot upload into someone else\'s photo folder');
  ok((await rows('select * from public.audit_log')).length === 0, 'staff cannot read the audit log');
  const vid = (await rows("select id from public.vehicles where slug='sedan'"))[0].id;
  ok(!(await fails(`insert into public.vehicle_blocks (vehicle_id,start_date,end_date) values ('${vid}','2026-11-01','2026-11-02')`)), 'staff blocks vehicle dates');
  ok((await rows('select * from public.vehicle_internal')).length === 1, 'staff can view fleet details');
  ok(await fails("insert into storage.objects (bucket_id,name) values ('media','x.webp')"), 'staff cannot upload images');
  ok(!(await fails("select public.log_event('export','bookings',null,'{}')")), 'staff can log an event as themselves');
  ok(await fails("update public.bookings set phone='9999999999'"), 'staff cannot change customer details (column grant)');
  ok(await fails("update public.bookings set amount_paid_paise=1"), 'amount paid can only change through payments');
  ok(await affected("update public.bookings set quoted_price_paise=300000") === 1, 'staff records the agreed quote');
  ok(!(await fails(`insert into public.payments (booking_id,amount_paise,method,recorded_by) values ('${bid}',100000,'upi','${STAFF}')`)), 'staff records a payment');
  ok(await fails(`insert into public.payments (booking_id,amount_paise,method,recorded_by) values ('${bid}',100000,'cash','${ADMIN}')`), 'staff cannot record a payment as someone else');
  let b = (await rows('select amount_paid_paise, payment_status from public.bookings'))[0];
  ok(Number(b.amount_paid_paise) === 100000 && b.payment_status === 'pending', 'part payment updates the total and marks payment pending');
  await db.query(`insert into public.payments (booking_id,amount_paise,method,recorded_by) values ('${bid}',200000,'cash','${STAFF}')`);
  b = (await rows('select amount_paid_paise, payment_status from public.bookings'))[0];
  ok(Number(b.amount_paid_paise) === 300000 && b.payment_status === 'paid', 'paying the full quote marks the booking paid');
  await db.query('update public.bookings set quoted_price_paise=350000');
  ok((await rows('select payment_status from public.bookings'))[0].payment_status === 'pending', 'raising the agreed price puts payment back to pending');
  await db.query('update public.bookings set quoted_price_paise=300000');
  ok((await rows('select payment_status from public.bookings'))[0].payment_status === 'paid', 'restoring the price marks it paid again');
  ok(await affected('update public.payments set amount_paise=1') <= 0, 'payments cannot be edited');
  ok(await affected('delete from public.payments') === 0, 'staff cannot delete payments');
  ok((await rows('select * from public.booking_items')).length === 1, 'staff reads booking items');
  ok(await hidden('select * from public.coupons'), 'staff cannot see coupons');
  ok(await fails("insert into public.coupons (code,discount_type,percent_off) values ('FREE','percent',100)"), 'staff cannot create coupons');
  ok(await affected("update public.reviews set published=true") === 0, 'staff cannot publish reviews');
  ok((await rows('select * from public.notifications')).length === 2, 'staff sees only their own notifications');
  ok(await affected('update public.notifications set read_at=now()') === 2, 'staff marks their notifications read');
  ok(await fails("update public.notifications set title='x'"), 'notification text is read-only');
});

// --- admin
await as('authenticated', ADMIN, async () => {
  ok(await affected("update public.packages set title='Live 2' where slug='live'") === 1, 'admin edits packages');
  ok(await affected("update public.site_settings set value='{\"revenueReliable\":true}' where key='accounting'") === 1, 'admin edits settings');
  ok(await affected(`update public.profiles set role='admin' where id='${STAFF}'`) === 1, 'admin changes another person\'s role');
  ok(await fails(`update public.profiles set active=false where id='${ADMIN}'`), 'admin cannot deactivate themselves');
  ok(!(await fails("insert into storage.objects (bucket_id,name) values ('media','x.webp')")), 'admin uploads images');
  const log = await rows("select action, entity, actor_email, details from public.audit_log order by id");
  ok(log.some(l => l.entity === 'bookings' && l.actor_email === 's@x.in' && JSON.stringify(l.details).includes('confirmed')), 'audit log records staff confirming the booking');
  ok(log.some(l => l.entity === 'profiles' && l.actor_email === 'a@x.in'), 'audit log records the role change by the admin');
  ok(log.some(l => l.action === 'export' && l.actor_email === 's@x.in'), 'audit log records explicit export event');
  ok(!JSON.stringify(log).includes('9876543210'), 'audit log never copies customer phone numbers');
  ok(await affected('delete from public.audit_log') <= 0, 'audit log entries cannot be deleted, even by admins');
  ok(log.some(l => l.entity === 'payments' && l.actor_email === 's@x.in'), 'audit log records payments');
  ok((await rows('select code from public.coupons')).length === 1, 'admin manages coupons');
  ok(await affected("update public.reviews set published=true where name='Hidden'") === 1, 'admin publishes a review');
  ok(await affected("update public.package_vehicles set price_paise=200000 where package_id=(select id from public.packages where slug='live')") === 1 && Number((await rows("select base_price_paise from public.packages where slug='live'"))[0].base_price_paise) === 200000, 'base price follows the lowest vehicle price');
  ok((await rows('select * from public.notifications')).length === 2, 'admin has their own notifications');
  ok(await affected('delete from public.payments') === 2, 'admin can delete a wrong payment');
  const after = (await rows('select amount_paid_paise, payment_status from public.bookings'))[0];
  ok(Number(after.amount_paid_paise) === 0 && after.payment_status === 'unpaid', 'deleting payments resets the total');
  ok(await affected(`update public.profiles set full_name='Admin Renamed' where id='${ADMIN}'`) === 1, 'admin renames themselves');
  ok(await fails(`update public.profiles set role='staff' where id='${ADMIN}'`), 'admin still cannot change their own role');
  const oldBus = (await rows("select id from public.vehicles where slug='old-bus'"))[0].id;
  await db.query(`insert into public.package_vehicles (package_id, vehicle_id) select id, '${oldBus}' from public.packages where slug='live'`);
  ok(await affected(`delete from public.vehicles where id='${oldBus}'`) === 1 && (await rows(`select * from public.package_vehicles where vehicle_id='${oldBus}'`)).length === 0, 'admin removes a vehicle and it leaves its packages');
  await db.query("update public.bookings set payment_status='failed'");
  ok((await rows('select payment_status from public.bookings'))[0].payment_status === 'failed', 'staff can mark a payment attempt failed');
});

// --- removing team members (the auth admin API deletes from auth.users, which cascades to profiles)
{
  const fresh = '44444444-4444-4444-4444-444444444444';
  await db.exec(`insert into auth.users values ('${fresh}','n@x.in'); insert into public.profiles (id,email,full_name,role) values ('${fresh}','n@x.in','New','staff');`);
  ok(!(await fails(`delete from auth.users where id='${fresh}'`)) && (await rows(`select * from public.profiles where id='${fresh}'`)).length === 0, 'a team member with no history is deleted completely');
  ok(await fails(`delete from auth.users where id='${STAFF}'`), 'a team member with notes on record cannot be deleted (the app switches them off instead)');
}

// --- triggers on public inserts (as the server would, with the secret key)
await as('service_role', null, async () => {
  await db.query(`insert into public.bookings (reference,idempotency_key,name,phone,package_slug,package_title,travel_date,passengers,pickup,vehicle,consent_at)
    values ('YT-261025-WXYZ',gen_random_uuid(),'Meena','9876500000','live','Live','2026-12-01',2,'Airport','sedan',now())`);
  const b = (await rows("select b.package_id, i.unit_price_paise, i.package_id as item_pkg from public.bookings b join public.booking_items i on i.booking_id = b.id where b.reference='YT-261025-WXYZ'"))[0];
  ok(b && b.package_id && b.item_pkg === b.package_id && Number(b.unit_price_paise) === 200000, 'new booking is linked to its package with the listed price as an item');
  ok((await rows("select * from public.notifications where title like '%YT-261025-WXYZ'")).length === 2, 'every active staff member is notified of a new booking');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
