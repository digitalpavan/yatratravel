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
  insert into public.package_vehicles (package_id,vehicle_id,price) select p.id, v.id, 2500 from public.packages p, public.vehicles v where v.slug='sedan';
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

// --- anon (public website)
await as('anon', null, async () => {
  ok((await rows('select slug from public.packages')).map(r => r.slug).join() === 'live', 'anon sees only published packages');
  ok((await rows('select * from public.package_vehicles')).length === 1, 'anon sees prices of published packages only');
  ok((await rows('select slug from public.vehicles')).map(r => r.slug).join() === 'sedan', 'anon sees only active vehicles');
  ok((await rows('select * from public.vehicle_internal')).length === 0, 'anon cannot read fleet details / pricing rules');
  ok((await rows('select * from public.bookings')).length === 0, 'anon cannot read bookings');
  ok((await rows('select * from public.enquiries')).length === 0, 'anon cannot read enquiries');
  ok((await rows('select * from public.profiles')).length === 0, 'anon cannot read staff profiles');
  ok((await rows('select * from public.audit_log')).length === 0, 'anon cannot read the audit log');
  ok((await rows("select key from public.site_settings")).map(r => r.key).join() === 'contact', 'anon sees public settings only (not accounting)');
  ok(await fails(`insert into public.bookings (reference,idempotency_key,name,phone,package_slug,package_title,travel_date,passengers,pickup,vehicle,consent_at) values ('YT-261024-ZZZZ',gen_random_uuid(),'x','9876543210','live','Live','2026-11-01',1,'x','sedan',now())`), 'anon cannot insert bookings directly');
  ok(await affected("update public.packages set title='hacked'") === 0, 'anon cannot edit packages');
  ok(await fails("select public.log_event('x','y',null,'{}')"), 'anon cannot write audit events');
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
  ok(await affected("update public.bookings set status='confirmed'") === 1, 'staff confirms a booking');
  ok(await fails("update public.bookings set status='requested'"), 'status cannot move backwards (trigger)');
  ok(await fails("update public.bookings set reference='YT-000000-AAAA'"), 'booking reference is read-only');
  const bid = (await rows('select id from public.bookings'))[0].id;
  ok(!(await fails(`insert into public.booking_notes (booking_id, body, author_id) values ('${bid}','called', '${STAFF}')`)), 'staff adds a note as themselves');
  ok(await fails(`insert into public.booking_notes (booking_id, body, author_id) values ('${bid}','spoof', '${ADMIN}')`), 'staff cannot post a note as someone else');
  ok(await affected("update public.booking_notes set body='edited'") === 0, 'notes cannot be edited');
  ok(await affected("update public.packages set title='x'") === 0, 'staff cannot edit packages');
  ok(await fails("insert into public.packages (slug,title,category) values ('n','N','cab')"), 'staff cannot create packages');
  ok(await affected("update public.vehicles set passengers=9") === 0, 'staff cannot edit vehicles');
  ok(await affected("update public.site_settings set value='{}'") === 0, 'staff cannot edit website content');
  ok(await affected(`update public.profiles set role='admin' where id='${STAFF}'`) <= 0 && (await rows(`select role from public.profiles where id='${STAFF}'`))[0].role === 'staff', 'staff cannot promote themselves');
  ok(await affected(`update public.profiles set role='staff' where id='${ADMIN}'`) <= 0, 'staff cannot demote an admin');
  ok((await rows('select * from public.audit_log')).length === 0, 'staff cannot read the audit log');
  const vid = (await rows("select id from public.vehicles where slug='sedan'"))[0].id;
  ok(!(await fails(`insert into public.vehicle_blocks (vehicle_id,start_date,end_date) values ('${vid}','2026-11-01','2026-11-02')`)), 'staff blocks vehicle dates');
  ok((await rows('select * from public.vehicle_internal')).length === 1, 'staff can view fleet details');
  ok(await fails("insert into storage.objects (bucket_id,name) values ('media','x.webp')"), 'staff cannot upload images');
  ok(!(await fails("select public.log_event('export','bookings',null,'{}')")), 'staff can log an event as themselves');
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
  ok(await affected('delete from public.audit_log') === 0, 'audit log entries cannot be deleted, even by admins');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
