'use client';

import { useState } from 'react';

type Stop = { name: string; note?: string };
type Day = { day: number; title: string; stops: Stop[] };

/** Day-by-day itinerary builder. Serialises to a hidden JSON field. */
export function ItineraryEditor({ name, initial }: { name: string; initial: Day[] }) {
  const [days, setDays] = useState<Day[]>(initial.length ? initial : []);
  const update = (fn: (d: Day[]) => Day[]) => setDays(d => fn(structuredClone(d)).map((x, i) => ({ ...x, day: i + 1 })));
  return (
    <div className="list-editor">
      <input type="hidden" name={name} value={JSON.stringify(days.map(d => ({ ...d, stops: d.stops.filter(s => s.name.trim()).map(s => (s.note?.trim() ? s : { name: s.name })) })))} />
      {days.map((d, di) => (
        <fieldset className="list-editor__item" key={di}>
          <legend className="label">Day {di + 1}</legend>
          <div className="flex gap-2 items-center">
            <label className="visually-hidden" htmlFor={`day-${di}`}>Day {di + 1} title</label>
            <input className="input" id={`day-${di}`} value={d.title} placeholder="e.g. Arrival and Tirumala" onChange={e => update(x => { x[di].title = e.target.value; return x; })} />
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => update(x => x.filter((_, i) => i !== di))} aria-label={`Remove day ${di + 1}`}>Remove day</button>
          </div>
          <ol className="list-editor__stops">
            {d.stops.map((s, si) => (
              <li key={si}>
                <input className="input" aria-label={`Day ${di + 1} stop ${si + 1}`} value={s.name} placeholder="Stop or temple" onChange={e => update(x => { x[di].stops[si].name = e.target.value; return x; })} />
                <input className="input" aria-label={`Day ${di + 1} stop ${si + 1} note`} value={s.note ?? ''} placeholder="Note (optional)" onChange={e => update(x => { x[di].stops[si].note = e.target.value; return x; })} />
                <span className="list-editor__btns">
                  <button type="button" className="icon-btn" disabled={si === 0} aria-label="Move stop up" onClick={() => update(x => { const st = x[di].stops; [st[si - 1], st[si]] = [st[si], st[si - 1]]; return x; })}>↑</button>
                  <button type="button" className="icon-btn" aria-label="Remove stop" onClick={() => update(x => { x[di].stops.splice(si, 1); return x; })}>✕</button>
                </span>
              </li>
            ))}
          </ol>
          <button type="button" className="btn btn--ghost btn--sm" onClick={() => update(x => { x[di].stops.push({ name: '' }); return x; })}>+ Add stop</button>
        </fieldset>
      ))}
      <button type="button" className="btn btn--outline btn--sm" onClick={() => update(x => [...x, { day: x.length + 1, title: '', stops: [{ name: '' }] }])}>+ Add day</button>
    </div>
  );
}

/** Generic repeater for small records (FAQs, testimonials). */
export function RecordListEditor<T extends Record<string, string>>({ name, initial, fields, addLabel }: {
  name: string; initial: T[]; fields: { key: keyof T & string; label: string; multiline?: boolean; required?: boolean }[]; addLabel: string;
}) {
  const [items, setItems] = useState<T[]>(initial);
  const blank = () => Object.fromEntries(fields.map(f => [f.key, ''])) as T;
  const clean = items.filter(it => fields.some(f => it[f.key]?.trim())).map(it => Object.fromEntries(Object.entries(it).filter(([, v]) => v?.trim())));
  return (
    <div className="list-editor">
      <input type="hidden" name={name} value={JSON.stringify(clean)} />
      {items.map((it, i) => (
        <fieldset className="list-editor__item" key={i}>
          <legend className="label">#{i + 1}</legend>
          {fields.map(f => (
            <div className="field" key={f.key}>
              <label className="label" htmlFor={`${name}-${i}-${f.key}`}>{f.label}{!f.required && <span className="opt"> (optional)</span>}</label>
              {f.multiline
                ? <textarea className="textarea" id={`${name}-${i}-${f.key}`} value={it[f.key]} onChange={e => setItems(x => x.map((y, j) => (j === i ? { ...y, [f.key]: e.target.value } : y)))} />
                : <input className="input" id={`${name}-${i}-${f.key}`} value={it[f.key]} onChange={e => setItems(x => x.map((y, j) => (j === i ? { ...y, [f.key]: e.target.value } : y)))} />}
            </div>
          ))}
          <div className="flex gap-2">
            <button type="button" className="btn btn--ghost btn--sm" disabled={i === 0} onClick={() => setItems(x => { const y = [...x]; [y[i - 1], y[i]] = [y[i], y[i - 1]]; return y; })}>Move up</button>
            <button type="button" className="btn btn--ghost btn--sm" onClick={() => setItems(x => x.filter((_, j) => j !== i))}>Remove</button>
          </div>
        </fieldset>
      ))}
      <button type="button" className="btn btn--outline btn--sm" onClick={() => setItems(x => [...x, blank()])}>+ {addLabel}</button>
    </div>
  );
}

/** Text input with a live character count, e.g. for SEO titles and descriptions. */
export function CountedInput({ id, name, label, max, defaultValue, multiline, hint }: { id: string; name: string; label: string; max: number; defaultValue: string; multiline?: boolean; hint?: string }) {
  const [len, setLen] = useState(defaultValue.length);
  const props = { id, name, defaultValue, maxLength: max, onChange: (e: { target: { value: string } }) => setLen(e.target.value.length), 'aria-describedby': `${id}-count` };
  return (
    <div className="field">
      <label className="label" htmlFor={id}>{label}</label>
      {multiline ? <textarea className="textarea" style={{ minHeight: 80 }} {...props} /> : <input className="input" {...props} />}
      <p className="hint" id={`${id}-count`}>{hint ? `${hint} · ` : ''}{len}/{max}</p>
    </div>
  );
}
