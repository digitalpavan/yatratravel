'use client';

import { useId, useRef, useState } from 'react';
import { Icon } from '@/components/Icon';
import type { UploadResult } from '@/app/admin/(panel)/media/actions';

type Option = { ref: string; label: string; thumb: string | null };

/** Chooses an image reference (asset id or uploaded "media:<uuid>") and can upload a new image in place. */
export function ImagePicker({ name, label, value, options, upload }: {
  name: string; label: string; value: string; options: Option[]; upload: (form: FormData) => Promise<UploadResult>;
}) {
  const [current, setCurrent] = useState(value);
  const [list, setList] = useState(options);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const altRef = useRef<HTMLInputElement>(null);
  const id = useId();
  const selected = list.find(o => o.ref === current);

  const doUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Choose a file first.'); return; }
    const fd = new FormData();
    fd.set('file', file);
    fd.set('alt', altRef.current?.value ?? '');
    setBusy(true); setError('');
    const res = await upload(fd);
    setBusy(false);
    if (!res.ok) { setError(res.error); return; }
    setList(l => [{ ref: res.ref, label: res.alt, thumb: res.src }, ...l]);
    setCurrent(res.ref);
    if (fileRef.current) fileRef.current.value = '';
    if (altRef.current) altRef.current.value = '';
  };

  return (
    <fieldset className="fieldset image-picker">
      <legend className="label">{label}</legend>
      <input type="hidden" name={name} value={current} />
      <div className="image-picker__row">
        <div className="image-picker__preview">
          {selected?.thumb ? <img src={selected.thumb} alt="" /> : <span>{current ? 'Photo pending' : 'No image'}</span>}
        </div>
        <div className="stack" style={{ flex: 1 }}>
          <label className="visually-hidden" htmlFor={`${id}-sel`}>{label}</label>
          <select className="select" id={`${id}-sel`} value={current} onChange={e => setCurrent(e.target.value)}>
            <option value="">No image</option>
            {list.map(o => <option key={o.ref} value={o.ref}>{o.label.slice(0, 90)}{o.thumb ? '' : ' (pending)'}</option>)}
          </select>
          <details>
            <summary className="link-button">Upload a new image</summary>
            <div className="stack mt-2">
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/avif" aria-label="Image file" />
              <input ref={altRef} className="input" placeholder="Describe the image, e.g. Srikalahasti temple gopuram" aria-label="Alt text" maxLength={200} />
              {error && <p className="error-msg" role="alert"><Icon name="alert" size={16} />{error}</p>}
              <div><button type="button" className={`btn btn--outline btn--sm${busy ? ' is-loading' : ''}`} onClick={doUpload} disabled={busy}>Upload</button></div>
              <p className="hint">At least 1200px wide. JPEG, PNG, WebP or AVIF up to 10 MB. Only upload photos you own or have a licence for.</p>
            </div>
          </details>
        </div>
      </div>
    </fieldset>
  );
}
