#!/usr/bin/env node
// Database tasks for Supabase. Reads .env.local (see package.json scripts).
//
//   npm run db:migrate                       apply supabase/migrations/*.sql not yet applied
//   npm run db:seed                          load content/ (packages, vehicles, settings, blog) — never overwrites existing rows
//   npm run admin:create -- email "Name"     create the first admin and print a one-time password

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [cmd, ...args] = process.argv.slice(2);

function need(name) {
  const v = process.env[name];
  if (!v) { console.error(`Missing ${name}. Add it to .env.local (see .env.example).`); process.exit(1); }
  return v;
}

async function withDb(fn) {
  const client = new pg.Client({ connectionString: need('SUPABASE_DB_URL'), ssl: { rejectUnauthorized: false } });
  await client.connect();
  try { return await fn(client); } finally { await client.end(); }
}

// ---------------------------------------------------------------- migrate
async function migrate() {
  await withDb(async db => {
    await db.query('create table if not exists public._migrations (name text primary key, applied_at timestamptz not null default now())');
    await db.query('alter table public._migrations enable row level security'); // no policies: invisible to anon/authenticated
    const done = new Set((await db.query('select name from public._migrations')).rows.map(r => r.name));
    const dir = path.join(root, 'supabase', 'migrations');
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
    for (const f of files) {
      if (done.has(f)) continue;
      process.stdout.write(`applying ${f} … `);
      await db.query('begin');
      try {
        await db.query(fs.readFileSync(path.join(dir, f), 'utf8'));
        await db.query('insert into public._migrations (name) values ($1)', [f]);
        await db.query('commit');
        console.log('ok');
      } catch (e) {
        await db.query('rollback');
        console.log('FAILED');
        throw e;
      }
    }
    console.log('Migrations up to date.');
  });
}

// ---------------------------------------------------------------- seed

function readBlog() {
  const dir = path.join(root, 'content', 'blog');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).filter(f => f.endsWith('.md')).map(f => {
    const raw = fs.readFileSync(path.join(dir, f), 'utf8');
    const m = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
    const meta = {};
    for (const line of m[1].split('\n')) { const i = line.indexOf(':'); if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^"(.*)"$/, '$1'); }
    return { slug: f.replace(/\.md$/, ''), ...meta, body: m[2].trim() };
  });
}

async function seed() {
  const services = JSON.parse(fs.readFileSync(path.join(root, 'content/seed/services.json'), 'utf8'));
  const site = JSON.parse(fs.readFileSync(path.join(root, 'content/site.json'), 'utf8'));
  const testimonials = JSON.parse(fs.readFileSync(path.join(root, 'content/testimonials.json'), 'utf8')).items;
  const defaults = JSON.parse(fs.readFileSync(path.join(root, "content/seed/settings.json"), "utf8"));

  await withDb(async db => {
    await db.query('begin');
    try {
      for (const [i, { slug, name, detail, distance, image }] of defaults.destinations.entries()) {
        await db.query('insert into public.destinations (slug, name, detail, distance, image, sort) values ($1,$2,$3,$4,$5,$6) on conflict do nothing', [slug, name, detail, distance, image, i]);
      }
      const vehicleIds = {};
      for (const [i, v] of services.vehicles.entries()) {
        const r = await db.query(`insert into public.vehicles (slug, name, examples, passengers, luggage, ac, image, best_for, features, verified, sort)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) on conflict (slug) do update set slug = excluded.slug returning id`,
          [v.slug, v.name, v.examples, v.passengers, v.luggage, v.ac, v.image, v.bestFor, v.features, v.verified, i]);
        vehicleIds[v.slug] = r.rows[0].id;
        await db.query('insert into public.vehicle_internal (vehicle_id) values ($1) on conflict do nothing', [r.rows[0].id]);
      }
      for (const p of services.packages) {
        const r = await db.query(`insert into public.packages (slug, title, category, destinations, duration_days, duration_label, summary, overview, image, gallery,
            passengers_min, passengers_max, price_unit, inclusions, exclusions, faqs, popularity, featured, published)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19)
          on conflict (slug) do nothing returning id`,
          [p.slug, p.title, p.category, p.destinations, p.durationDays, p.durationLabel, p.summary, p.overview, p.image, p.gallery,
            p.passengers.min, p.passengers.max, p.priceUnit, p.inclusions, p.exclusions, JSON.stringify(p.faqs),
            p.popularity, ['temple-tour', 'transfer', 'package'].includes(p.category), p.published]);
        if (!r.rows[0]) continue; // already seeded: leave the admin's edits alone
        for (const vs of p.vehicles) {
          const rupees = p.prices?.[vs];
          await db.query('insert into public.package_vehicles (package_id, vehicle_id, price_paise) values ($1,$2,$3) on conflict do nothing',
            [r.rows[0].id, vehicleIds[vs], typeof rupees === 'number' ? Math.round(rupees * 100) : null]);
        }
        for (const [i, d] of p.itinerary.entries()) {
          await db.query('insert into public.itinerary_days (package_id, day, title, stops) values ($1,$2,$3,$4) on conflict do nothing',
            [r.rows[0].id, i + 1, d.title, JSON.stringify(d.stops)]);
        }
      }
      const settings = [
        ['brand', { name: site.name, tagline: site.tagline, story: site.story, serviceArea: site.serviceArea, googleReviewsUrl: site.googleReviewsUrl, verified: site.verified }, true],
        ['contact', { phone: site.phone, phoneDisplay: site.phoneDisplay, whatsapp: site.whatsapp, email: site.email, address: site.address, mapsUrl: site.mapsUrl, mapsEmbedUrl: site.mapsEmbedUrl, hours: site.hours }, true],
        ["hero", defaults.hero, true],
        ["home", defaults.home, true],
        ["seo", defaults.seo, true],
        ['accounting', { revenueReliable: false }, false],
      ];
      for (const [key, value, isPublic] of settings) {
        await db.query('insert into public.site_settings (key, value, is_public) values ($1,$2,$3) on conflict do nothing', [key, JSON.stringify(value), isPublic]);
      }
      if ((await db.query('select 1 from public.reviews limit 1')).rows.length === 0) {
        for (const [i, t] of testimonials.entries()) {
          await db.query('insert into public.reviews (quote, name, city, package_label, published, sort) values ($1,$2,$3,$4,true,$5)',
            [t.quote, t.name, t.city ?? '', t.package ?? '', i]);
        }
      }
      for (const b of readBlog()) {
        await db.query(`insert into public.blog_posts (slug, title, description, body, image, image_alt, category, tags, published, published_at)
          values ($1,$2,$3,$4,$5,$6,$7,$8,true,$9) on conflict (slug) do nothing`,
          [b.slug, b.title, b.description, b.body, b.image, b.imageAlt ?? '', b.category ?? 'Travel guide', (b.tags ?? '').split(',').map(t => t.trim()).filter(Boolean), b.date]);
      }
      await db.query('commit');
      console.log('Seed complete (existing rows left unchanged).');
    } catch (e) {
      await db.query('rollback');
      throw e;
    }
  });
}

// ---------------------------------------------------------------- first admin
async function createAdmin() {
  const [email, fullName = ''] = args;
  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { console.error('Usage: npm run admin:create -- you@example.com "Your Name"'); process.exit(1); }
  const url = need('NEXT_PUBLIC_SUPABASE_URL');
  const key = need('SUPABASE_SECRET_KEY');
  const password = crypto.randomBytes(18).toString('base64url');
  const res = await fetch(`${url}/auth/v1/admin/users`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: fullName } }),
  });
  const body = await res.json();
  if (!res.ok) { console.error('Could not create user:', body.msg || body.message || body.error_description || body); process.exit(1); }
  await withDb(db => db.query(
    `insert into public.profiles (id, email, full_name, role) values ($1,$2,$3,'admin')
     on conflict (id) do update set role = 'admin', active = true`, [body.id, email, fullName]));
  console.log(`\nAdmin created: ${email}\nOne-time password: ${password}\n\nSign in at /admin/login and change it straight away under "My account".\n`);
}

const tasks = { migrate, seed, 'create-admin': createAdmin };
if (!tasks[cmd]) { console.error(`Unknown command "${cmd}". Use: ${Object.keys(tasks).join(', ')}`); process.exit(1); }
tasks[cmd]().catch(e => { console.error(e.message); process.exit(1); });
