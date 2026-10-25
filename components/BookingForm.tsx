'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRef, useState, type ChangeEvent, type SubmitEvent, type ReactNode } from 'react';
import { AnimatePresence, m } from 'motion/react';
import { Icon } from '@/components/Icon';
import { PaymentMethods, payWithRazorpay } from '@/components/Razorpay';
import { motionTokens, transition } from '@/lib/motion';
import { bookingSchema, capacityError, fieldErrors, groupSizeError } from '@/lib/validation';
import { formatDate, formatPaise } from '@/lib/format';

/** prices: listed price per vehicle slug in paise, null = on request. payOnline: the listed price can be paid when booking. */
type PackageOption = {
  slug: string; title: string; vehicles: string[]; passengers: { min: number; max: number }; prices: Record<string, number | null>;
  priceUnit: string; payOnline: boolean;
};
type VehicleOption = { slug: string; name: string; passengers: number; examples: string };

type Values = {
  packageSlug: string; travelDate: string; passengers: string; pickup: string; vehicle: string;
  name: string; phone: string; email: string; requests: string; consent: boolean; website: string;
};

// Steps slide a short distance in the direction of travel and crossfade.
const stepVariants = {
  enter: (dir: number) => ({ opacity: 0, x: dir * 24 }),
  center: { opacity: 1, x: 0, transition: transition(motionTokens.normal) },
  exit: (dir: number) => ({ opacity: 0, x: dir * -24, transition: transition(motionTokens.fast) }),
};

const STEPS = [
  { title: 'Your trip', fields: ['packageSlug', 'travelDate', 'passengers', 'pickup', 'vehicle'] },
  { title: 'Your details', fields: ['name', 'phone', 'email', 'requests'] },
  { title: 'Review & send', fields: ['consent'] },
] as const;

export function BookingForm({ packages, vehicles, initial, today, whatsappNumber, onlinePayment }: {
  packages: PackageOption[]; vehicles: VehicleOption[]; initial: Partial<Values>; today: string; whatsappNumber: string;
  /** Razorpay is configured: trips with a listed price are paid when booking. */
  onlinePayment: boolean;
}) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [values, setValues] = useState<Values>({
    packageSlug: '', travelDate: '', passengers: '2', pickup: '', vehicle: 'any',
    name: '', phone: '', email: '', requests: '', consent: false, website: '', ...initial,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'paying' | 'redirecting' | 'error'>('idle');
  const [serverError, setServerError] = useState('');
  const idempotencyKey = useRef<string | null>(null);
  // Set when the server reports a newer price than this page was built with ("package:vehicle" → paise).
  const [priceUpdates, setPriceUpdates] = useState<Record<string, number | null>>({});
  const headingRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  // Set when the step changes; the new step's heading takes focus as soon as it mounts.
  const focusHeading = useRef(false);

  const pkg = packages.find(p => p.slug === values.packageSlug);
  const offered = vehicles.filter(v => !pkg || pkg.vehicles.includes(v.slug));
  const vehicle = vehicles.find(v => v.slug === values.vehicle);
  const priceKey = `${values.packageSlug}:${values.vehicle}`;
  const listedPricePaise = !pkg || values.vehicle === 'any' ? null : priceKey in priceUpdates ? priceUpdates[priceKey] : (pkg.prices[values.vehicle] ?? null);
  const payNow = onlinePayment && !!pkg?.payOnline && listedPricePaise !== null;
  const priceOf = (slug: string) => {
    const key = `${values.packageSlug}:${slug}`;
    return pkg ? (key in priceUpdates ? priceUpdates[key] : (pkg.prices[slug] ?? null)) : null;
  };

  const set = (name: keyof Values) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value;
    setValues(v => {
      const next = { ...v, [name]: value };
      // If the package doesn't offer the chosen vehicle, fall back to "Suggest for me".
      if (name === 'packageSlug') {
        const p = packages.find(x => x.slug === value);
        if (p && next.vehicle !== 'any' && !p.vehicles.includes(next.vehicle)) next.vehicle = 'any';
      }
      return next;
    });
    if (errors[name]) setErrors(({ [name]: _, ...rest }) => rest);
  };

  const validate = (upTo: number) => {
    const result = bookingSchema.safeParse({ ...values, idempotencyKey: crypto.randomUUID(), consent: values.consent || undefined });
    const all = result.success ? {} : fieldErrors(result.error);
    const group = groupSizeError(pkg, Number(values.passengers));
    if (group) all.passengers ??= group;
    const capacity = capacityError(vehicle, Number(values.passengers));
    if (capacity) all.vehicle ??= capacity;
    const fields = STEPS.slice(0, upTo + 1).flatMap(s => s.fields) as string[];
    return Object.fromEntries(Object.entries(all).filter(([k]) => fields.includes(k)));
  };

  const goTo = (n: number) => { setDirection(n > step ? 1 : -1); focusHeading.current = true; setStep(n); };

  const next = () => {
    const errs = validate(step);
    setErrors(errs);
    if (Object.keys(errs).length) { setTimeout(() => summaryRef.current?.focus()); return; }
    goTo(step + 1);
  };

  const submit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (step < STEPS.length - 1) return next();
    if (status === 'submitting' || status === 'paying' || status === 'redirecting') return; // guards against double submission
    const errs = validate(STEPS.length - 1);
    setErrors(errs);
    if (Object.keys(errs).length) {
      const firstStep = STEPS.findIndex(s => s.fields.some(f => errs[f]));
      if (firstStep !== step) goTo(firstStep);
      setTimeout(() => summaryRef.current?.focus());
      return;
    }

    setStatus('submitting');
    setServerError('');
    idempotencyKey.current ??= crypto.randomUUID(); // reused on retry, so the server never creates a duplicate
    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...values, passengers: Number(values.passengers), listedPricePaise, idempotencyKey: idempotencyKey.current }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.url) {
        // The booking is saved. Pay now if checkout opened; either way the booking page shows where things stand,
        // with a "Pay now" button if the payment didn't go through.
        if (data.checkout) {
          setStatus('paying');
          const token = new URL(data.url, window.location.origin).searchParams.get('t') ?? '';
          await payWithRazorpay(data.checkout, { reference: data.reference, token });
        }
        setStatus('redirecting');
        router.push(data.url);
        return;
      }
      if (res.status === 409 && 'listedPricePaise' in data) {
        // The price changed since this page loaded: show the new one on the review step and let them send again.
        setPriceUpdates(u => ({ ...u, [priceKey]: data.listedPricePaise }));
        if (step !== STEPS.length - 1) goTo(STEPS.length - 1);
      }
      if (res.status === 422 && data.fields) {
        setErrors(data.fields);
        const firstStep = STEPS.findIndex(s => s.fields.some(f => data.fields[f]));
        if (firstStep >= 0 && firstStep !== step) goTo(firstStep);
      }
      setServerError(data.error || 'Something went wrong. Please try again.');
      setStatus('error');
    } catch {
      setServerError("We couldn't reach our server. Check your connection and try again. Your details are still here.");
      setStatus('error');
    }
    setTimeout(() => summaryRef.current?.focus());
  };

  const whatsappFallback = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(
    // Trip basics only: the chat itself identifies the sender, and addresses are shared in the conversation, not in a URL.
    `Booking request\nPackage: ${pkg?.title ?? '-'}\nDate: ${values.travelDate || '-'}\nTravellers: ${values.passengers}\nVehicle: ${vehicle?.name ?? 'Suggest for me'}`,
  )}`;

  const errorList = Object.entries(errors);
  const busy = status === 'submitting' || status === 'paying' || status === 'redirecting';
  const price = formatPaise(listedPricePaise);

  return (
    <form className="card form-card booking-form" onSubmit={submit} noValidate aria-describedby="booking-note">
      {/* Progress */}
      <ol className="progress-steps" aria-label="Booking progress">
        {STEPS.map((s, i) => (
          <li key={s.title} className={i < step ? 'is-done' : undefined} aria-current={i === step ? 'step' : undefined}>
            <span className="progress-steps__num">{i < step ? <Icon name="check" size={14} /> : i + 1}</span>
            <span className="progress-steps__label">{s.title}</span>
          </li>
        ))}
      </ol>
      <div className="progress-bar" aria-hidden="true"><m.span initial={false} animate={{ scaleX: (step + 1) / STEPS.length }} transition={transition(motionTokens.slow)} style={{ originX: 0 }} /></div>

      {(errorList.length > 0 || serverError) && (
        <div className="alert alert--error" role="alert" tabIndex={-1} ref={summaryRef}>
          <Icon name="alert" />
          <div>
            <strong>{serverError || `Please fix ${errorList.length === 1 ? 'this' : `these ${errorList.length} things`} to continue`}</strong>
            {errorList.length > 0 && (
              <ul className="error-summary">
                {errorList.map(([field, msg]) => <li key={field}><a href={`#f-${field}`}>{msg}</a></li>)}
              </ul>
            )}
            {status === 'error' && !errorList.length && (
              <div className="flex flex-wrap gap-2 mt-4">
                <button type="submit" className="btn btn--secondary btn--sm"><Icon name="refresh" />Try again</button>
                <a className="btn btn--whatsapp btn--sm" href={whatsappFallback} target="_blank" rel="noopener"><Icon name="whatsapp" />Send on WhatsApp instead</a>
              </div>
            )}
          </div>
        </div>
      )}

      <AnimatePresence mode="wait" initial={false} custom={direction}>
      <m.div className="form-step" key={step} custom={direction} variants={stepVariants} initial="enter" animate="center" exit="exit">
        {/* Move focus to the new step's heading so keyboard and screen-reader users land in the right place. */}
        <h2 className="form-step__title" tabIndex={-1} ref={el => { headingRef.current = el; if (el && focusHeading.current) { focusHeading.current = false; el.focus(); } }}>
          <span className="visually-hidden">Step {step + 1} of {STEPS.length}: </span>{STEPS[step].title}
        </h2>

        {step === 0 && (
          <div className="form-grid form-grid--2">
            <Field id="packageSlug" label="Package or service" required error={errors.packageSlug} className="span-2">
              <select className="select" id="f-packageSlug" value={values.packageSlug} onChange={set('packageSlug')} {...invalid(errors.packageSlug, 'packageSlug')}>
                <option value="">Choose a package…</option>
                {packages.map(p => <option key={p.slug} value={p.slug}>{p.title}</option>)}
              </select>
            </Field>
            <Field id="travelDate" label="Travel date" required error={errors.travelDate}>
              <input className="input" id="f-travelDate" type="date" min={today} value={values.travelDate} onChange={set('travelDate')} {...invalid(errors.travelDate, 'travelDate')} />
            </Field>
            <Field id="passengers" label="Number of travellers" required error={errors.passengers} hint="Including children">
              <input className="input" id="f-passengers" type="number" inputMode="numeric" min={pkg?.passengers.min ?? 1} max={pkg?.passengers.max ?? 50} value={values.passengers} onChange={set('passengers')} {...invalid(errors.passengers, 'passengers')} />
            </Field>
            <Field id="pickup" label="Pickup location" required error={errors.pickup} className="span-2" hint="Hotel, railway station, airport or address in Tirupati">
              <input className="input" id="f-pickup" value={values.pickup} onChange={set('pickup')} autoComplete="street-address" {...invalid(errors.pickup, 'pickup')} />
            </Field>
            <fieldset className="fieldset span-2" aria-describedby={errors.vehicle ? 'f-vehicle-err' : undefined}>
              <legend className="label">Vehicle preference</legend>
              <div className="option-cards option-cards--3" id="f-vehicle">
                <VehicleChoice value="any" title="Suggest for me" meta="We'll match the vehicle to your group" checked={values.vehicle === 'any'} onChange={set('vehicle')} />
                {offered.map(v => {
                  const p = priceOf(v.slug);
                  return (
                    <VehicleChoice key={v.slug} value={v.slug} title={v.name} meta={`Up to ${v.passengers} · ${v.examples}`} checked={values.vehicle === v.slug} onChange={set('vehicle')}
                      price={pkg ? (p === null ? 'Price on request' : formatPaise(p)!) : undefined} warn={Number(values.passengers) > v.passengers} />
                  );
                })}
              </div>
              {errors.vehicle && <p className="error-msg" id="f-vehicle-err"><Icon name="alert" size={16} />{errors.vehicle}</p>}
            </fieldset>
            {pkg && (
              <div className="price-total span-2" aria-live="polite">
                {price ? <>
                  <span className="price-total__label">{payNow ? 'Total to pay' : 'Listed price'}</span>
                  <strong className="price-total__amount">{price}</strong>
                  <span className="price-total__meta">{vehicle?.name}{pkg.priceUnit && ` · ${pkg.priceUnit}`}</span>
                </> : <span className="price-total__meta">
                  {values.vehicle === 'any' ? 'Choose a vehicle to see the price.' : "This trip is priced on request. We'll confirm the price with you."}
                </span>}
              </div>
            )}
          </div>
        )}

        {step === 1 && (
          <div className="form-grid form-grid--2">
            <Field id="name" label="Your name" required error={errors.name}>
              <input className="input" id="f-name" value={values.name} onChange={set('name')} autoComplete="name" {...invalid(errors.name, 'name')} />
            </Field>
            <Field id="phone" label="Mobile number" required error={errors.phone} hint="We'll send updates to this number on WhatsApp">
              <div className="input-group">
                <span className="input-group__addon">+91</span>
                <input className="input" id="f-phone" type="tel" inputMode="tel" value={values.phone} onChange={set('phone')} autoComplete="tel-national" {...invalid(errors.phone, 'phone')} />
              </div>
            </Field>
            <Field id="email" label="Email" required error={errors.email} className="span-2" hint="Your booking confirmation and invoice are emailed here">
              <input className="input" id="f-email" type="email" value={values.email} onChange={set('email')} autoComplete="email" {...invalid(errors.email, 'email')} />
            </Field>
            <Field id="requests" label="Special requests" optional error={errors.requests} className="span-2" hint="Elderly travellers, extra stops, darshan slot time, train or flight number…">
              <textarea className="textarea" id="f-requests" value={values.requests} onChange={set('requests')} maxLength={1000} {...invalid(errors.requests, 'requests')} />
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="stack">
            <dl className="review">
              <Row label="Package" value={pkg?.title} onEdit={() => goTo(0)} />
              <Row label="Travel date" value={values.travelDate ? formatDate(values.travelDate) : undefined} onEdit={() => goTo(0)} />
              <Row label="Travellers" value={values.passengers} onEdit={() => goTo(0)} />
              <Row label="Pickup" value={values.pickup} onEdit={() => goTo(0)} />
              <Row label="Vehicle" value={vehicle ? vehicle.name : 'Suggest for me'} onEdit={() => goTo(0)} />
              <Row label={payNow ? 'Total to pay' : 'Listed price'} onEdit={() => goTo(0)}
                value={payNow ? `${price}${pkg?.priceUnit ? ` (${pkg.priceUnit})` : ''}` : price ? `${price} (we confirm the final price with you)` : 'Confirmed with you on request'} />
              <Row label="Name" value={values.name} onEdit={() => goTo(1)} />
              <Row label="Mobile" value={values.phone ? `+91 ${values.phone}` : undefined} onEdit={() => goTo(1)} />
              <Row label="Email" value={values.email} onEdit={() => goTo(1)} />
              {values.requests && <Row label="Requests" value={values.requests} onEdit={() => goTo(1)} />}
            </dl>
            <div className={`field${errors.consent ? ' is-invalid' : ''}`}>
              <label className="check" htmlFor="f-consent">
                <input id="f-consent" type="checkbox" checked={values.consent} onChange={set('consent')} aria-invalid={!!errors.consent} aria-describedby={errors.consent ? 'f-consent-err' : undefined} />
                <span>I agree that Yatra Travels may store these details and contact me by phone or WhatsApp about this request, as described in the <Link href="/privacy" target="_blank">privacy policy</Link>.</span>
              </label>
              {errors.consent && <p className="error-msg" id="f-consent-err"><Icon name="alert" size={16} />{errors.consent}</p>}
            </div>
          </div>
        )}

        {/* Honeypot for bots; hidden from people and assistive technology. */}
        <div className="hp" aria-hidden="true">
          <label htmlFor="f-website">Website</label>
          <input id="f-website" tabIndex={-1} autoComplete="off" value={values.website} onChange={set('website')} />
        </div>
      </m.div>
      </AnimatePresence>

      <div className="form-actions">
        {step > 0 && <button type="button" className="btn btn--ghost" onClick={() => goTo(step - 1)} disabled={busy}>Back</button>}
        <button type="submit" className={`btn btn--primary btn--lg${busy ? ' is-loading' : ''}`} aria-busy={busy} disabled={busy}>
          {step < STEPS.length - 1 ? <>Continue <Icon name="arrow-right" /></>
            : status === 'paying' ? 'Complete payment in the window…'
            : busy ? (payNow ? 'Opening payment…' : 'Sending…')
            : payNow ? `Pay ${price} & book` : 'Send booking request'}
        </button>
      </div>
      {payNow && step === STEPS.length - 1 && <PaymentMethods />}
      <p className="text-sm text-muted" id="booking-note">
        {payNow
          ? "You'll get a booking reference straight away and pay securely by UPI (scan the QR code with any UPI app), card or netbanking. If we can't provide your vehicle on that date, we refund you in full."
          : "This is a request, not a confirmed booking. Nothing is charged now. We'll check availability and confirm the price with you by phone or WhatsApp."}
      </p>
    </form>
  );
}

function invalid(error: string | undefined, id: string) {
  return error ? { 'aria-invalid': true, 'aria-describedby': `f-${id}-err` } : {};
}

function Field({ id, label, required, optional, hint, error, className = '', children }: {
  id: string; label: string; required?: boolean; optional?: boolean; hint?: string; error?: string; className?: string; children: ReactNode;
}) {
  return (
    <div className={`field ${className}${error ? ' is-invalid' : ''}`}>
      <label className="label" htmlFor={`f-${id}`}>
        {label} {required && <span className="req" aria-hidden="true">*</span>}{optional && <span className="opt">(optional)</span>}
      </label>
      {children}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p className="error-msg" id={`f-${id}-err`}><Icon name="alert" size={16} />{error}</p>}
    </div>
  );
}

function VehicleChoice({ value, title, meta, price, checked, onChange, warn }: {
  value: string; title: string; meta: string; price?: string; checked: boolean; onChange: (e: ChangeEvent<HTMLInputElement>) => void; warn?: boolean;
}) {
  return (
    <label className="option-card">
      <input type="radio" name="vehicle" value={value} checked={checked} onChange={onChange} />
      <span className="option-card__tick" />
      <span className="option-card__title">{title}</span>
      <span className="option-card__meta">{meta}</span>
      {price && <span className="option-card__price">{price}</span>}
      {warn && <span className="option-card__warn">Too small for your group</span>}
    </label>
  );
}

function Row({ label, value, onEdit }: { label: string; value?: string; onEdit: () => void }) {
  return (
    <div className="review__row">
      <dt>{label}</dt>
      <dd>{value || <span className="text-muted">Not given</span>}</dd>
      <button type="button" className="link-button" onClick={onEdit} aria-label={`Edit ${label.toLowerCase()}`}>Edit</button>
    </div>
  );
}
