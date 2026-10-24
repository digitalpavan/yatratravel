'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, type SubmitEvent } from 'react';
import { m } from 'motion/react';
import { Icon } from '@/components/Icon';
import { SuccessIcon } from '@/components/SuccessIcon';
import { motionTokens, transition } from '@/lib/motion';
import { enquirySchema, fieldErrors } from '@/lib/validation';
import { todayInIndia } from '@/lib/format';

type Source = 'contact' | 'package' | 'darshan' | 'vehicles';

/** Short enquiry form used on the contact, package, darshan and vehicles pages. */
export function EnquiryForm({ source, packageSlug, packageTitle, whatsappNumber, title = 'Send an enquiry', messagePlaceholder }: {
  source: Source; packageSlug?: string; packageTitle?: string; whatsappNumber: string; title?: string; messagePlaceholder?: string;
}) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<'idle' | 'submitting' | 'sent' | 'error'>('idle');
  const [serverError, setServerError] = useState('');
  const key = useRef<string | null>(null);
  const successRef = useRef<HTMLDivElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const uid = `enq-${source}`;
  // Set after mount: these pages are static, so a build-time date would go stale.
  const [today, setToday] = useState<string>();
  useEffect(() => setToday(todayInIndia()), []);

  const submit = async (e: SubmitEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (status === 'submitting') return;
    const form = new FormData(e.currentTarget);
    const payload = {
      name: String(form.get('name') ?? ''),
      phone: String(form.get('phone') ?? ''),
      email: String(form.get('email') ?? ''),
      travelDate: String(form.get('travelDate') ?? ''),
      message: String(form.get('message') ?? ''),
      consent: form.get('consent') === 'on' || undefined,
      website: String(form.get('website') ?? ''),
      packageSlug,
      source,
      idempotencyKey: (key.current ??= crypto.randomUUID()),
    };
    const check = enquirySchema.safeParse(payload);
    if (!check.success) {
      setErrors(fieldErrors(check.error));
      setTimeout(() => errorRef.current?.focus());
      return;
    }
    setErrors({});
    setStatus('submitting');
    try {
      const res = await fetch('/api/enquiries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setStatus('sent');
        setTimeout(() => successRef.current?.focus());
        return;
      }
      if (data.fields) setErrors(data.fields);
      setServerError(data.error || 'Something went wrong. Please try again.');
    } catch {
      setServerError("We couldn't reach our server. Please try again, or message us on WhatsApp.");
    }
    setStatus('error');
    setTimeout(() => errorRef.current?.focus());
  };

  if (status === 'sent') {
    return (
      <m.div className="card card--pad success-reveal" tabIndex={-1} ref={successRef} role="status"
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={transition(motionTokens.slow)}>
        <SuccessIcon size={32} />
        <h3>Thank you. We've received your message.</h3>
        <p className="text-muted">We'll reply by phone or WhatsApp. For anything urgent, message us directly.</p>
        <a className="btn btn--whatsapp mt-4" href={`https://wa.me/${whatsappNumber}`} target="_blank" rel="noopener"><Icon name="whatsapp" />Open WhatsApp</a>
      </m.div>
    );
  }

  const err = (f: string) => errors[f] && <p className="error-msg" id={`${uid}-${f}-err`}><Icon name="alert" size={16} />{errors[f]}</p>;
  const aria = (f: string) => (errors[f] ? { 'aria-invalid': true, 'aria-describedby': `${uid}-${f}-err` } : {});

  return (
    <form className="card form-card enquiry-form" onSubmit={submit} noValidate id="enquiry">
      <div>
        <h3>{title}</h3>
        {packageTitle && <p className="text-sm text-muted mt-2">About: <strong>{packageTitle}</strong></p>}
      </div>
      {(Object.keys(errors).length > 0 || serverError) && (
        <div className="alert alert--error" role="alert" tabIndex={-1} ref={errorRef}>
          <Icon name="alert" />
          <div><strong>{serverError || 'Please check the highlighted fields'}</strong></div>
        </div>
      )}
      <div className="form-grid form-grid--2">
        <div className={`field${errors.name ? ' is-invalid' : ''}`}>
          <label className="label" htmlFor={`${uid}-name`}>Name <span className="req" aria-hidden="true">*</span></label>
          <input className="input" id={`${uid}-name`} name="name" autoComplete="name" {...aria('name')} />
          {err('name')}
        </div>
        <div className={`field${errors.phone ? ' is-invalid' : ''}`}>
          <label className="label" htmlFor={`${uid}-phone`}>Mobile number <span className="req" aria-hidden="true">*</span></label>
          <input className="input" id={`${uid}-phone`} name="phone" type="tel" inputMode="tel" autoComplete="tel-national" {...aria('phone')} />
          {err('phone')}
        </div>
        <div className={`field${errors.email ? ' is-invalid' : ''}`}>
          <label className="label" htmlFor={`${uid}-email`}>Email <span className="opt">(optional)</span></label>
          <input className="input" id={`${uid}-email`} name="email" type="email" autoComplete="email" {...aria('email')} />
          {err('email')}
        </div>
        <div className={`field${errors.travelDate ? ' is-invalid' : ''}`}>
          <label className="label" htmlFor={`${uid}-date`}>Travel date <span className="opt">(optional)</span></label>
          <input className="input" id={`${uid}-date`} name="travelDate" type="date" min={today} {...aria('travelDate')} />
          {err('travelDate')}
        </div>
        <div className={`field span-2${errors.message ? ' is-invalid' : ''}`}>
          <label className="label" htmlFor={`${uid}-message`}>Your message <span className="req" aria-hidden="true">*</span></label>
          <textarea className="textarea" id={`${uid}-message`} name="message" maxLength={1500} placeholder={messagePlaceholder ?? 'Number of travellers, places you want to visit, questions…'} {...aria('message')} />
          {err('message')}
        </div>
        <div className={`field span-2${errors.consent ? ' is-invalid' : ''}`}>
          <label className="check" htmlFor={`${uid}-consent`}>
            <input id={`${uid}-consent`} name="consent" type="checkbox" {...aria('consent')} />
            <span>I agree that Yatra Travels may contact me about this enquiry. See the <Link href="/privacy">privacy policy</Link>.</span>
          </label>
          {err('consent')}
        </div>
        <div className="hp" aria-hidden="true"><label htmlFor={`${uid}-website`}>Website</label><input id={`${uid}-website`} name="website" tabIndex={-1} autoComplete="off" /></div>
      </div>
      <div className="flex flex-wrap gap-3 items-center">
        <button type="submit" className={`btn btn--primary${status === 'submitting' ? ' is-loading' : ''}`} disabled={status === 'submitting'} aria-busy={status === 'submitting'}>
          Send enquiry
        </button>
        <a className="btn btn--whatsapp" href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(packageTitle ? `Enquiry about ${packageTitle}` : 'Hello Yatra Travels')}`} target="_blank" rel="noopener">
          <Icon name="whatsapp" />Or WhatsApp us
        </a>
      </div>
    </form>
  );
}
