'use client';

import { useEffect, useState } from 'react';

export function initials(name: string, email: string) {
  return (name || email).split(/[\s@.]+/).filter(Boolean).slice(0, 2).map(s => s[0]!.toUpperCase()).join('');
}

/** Round profile photo, or initials when there isn't one. */
export function Avatar({ src, name, email, size = 36 }: { src?: string; name: string; email: string; size?: number }) {
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size > 60 ? 'var(--text-h4)' : undefined }} aria-hidden="true">
      {src ? <img src={src} alt="" width={size} height={size} /> : initials(name, email)}
    </span>
  );
}

/** File input that previews the chosen photo before it's uploaded. */
export function AvatarPicker({ current, name, email }: { current: string; name: string; email: string }) {
  const [preview, setPreview] = useState('');
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  return (
    <div className="avatar-picker">
      <Avatar src={preview || current} name={name} email={email} size={96} />
      <div className="field">
        <label className="label" htmlFor="photo">{current ? 'Choose a new photo' : 'Choose a photo'}</label>
        <input className="input" id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic" required
          onChange={e => { const f = e.currentTarget.files?.[0]; setPreview(f ? URL.createObjectURL(f) : ''); }} />
        <p className="hint">JPEG, PNG, WebP or HEIC, up to 5 MB. It is cropped to a square.</p>
      </div>
    </div>
  );
}
