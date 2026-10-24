/* Shared behaviour for the design wireframes:
   icon sprite, mobile navigation drawer, filter chips, counters, demo state switcher. */
(function () {
  // ---------- Icon sprite (24x24, 2px stroke) ----------
  const icons = {
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
    whatsapp: '<path d="M3.5 20.5 5 16a8.5 8.5 0 1 1 3 3z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-2-1-1 .9a4 4 0 0 1-2.2-2.2l.9-1-1-2L9 9.5z" fill="currentColor" stroke="none"/>',
    'arrow-right': '<path d="M5 12h14M13 6l6 6-6 6"/>',
    'chevron-right': '<path d="m9 6 6 6-6 6"/>',
    'chevron-down': '<path d="m6 9 6 6 6-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    car: '<path d="M5 16h14M5 16v2M19 16v2M3 13l2-6h14l2 6v3H3z"/><circle cx="7.5" cy="13.5" r=".5" fill="currentColor"/><circle cx="16.5" cy="13.5" r=".5" fill="currentColor"/>',
    users: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14a6.5 6.5 0 0 1 3.5 6"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    'check-circle': '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 3 3 5-6"/>',
    'x-circle': '<circle cx="12" cy="12" r="9"/><path d="m9 9 6 6M15 9l-6 6"/>',
    alert: '<path d="M12 3 2 20h20z"/><path d="M12 10v4M12 17v.5"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    star: '<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
    shield: '<path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
    temple: '<path d="M12 2.5 9.5 6h5zM8 6h8l1.5 4h-11zM5 10h14v2H5zM6.5 12v8M17.5 12v8M10 20v-4h4v4M4 20.5h16"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4"/>',
    home: '<path d="M4 11 12 4l8 7v9h-5v-6H9v6H4z"/>',
    package: '<path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
    inbox: '<path d="M3.5 13 6 5h12l2.5 8v6h-17z"/><path d="M3.5 13H9l1 2h4l1-2h5.5"/>',
    clipboard: '<rect x="5" y="4.5" width="14" height="16.5" rx="2"/><path d="M9 4.5V3h6v1.5M8.5 11h7M8.5 15h5"/>',
    image: '<rect x="3.5" y="4.5" width="17" height="15" rx="2"/><circle cx="9" cy="10" r="1.8"/><path d="m4 18 5-5 4 4 3-3 4.5 4.5"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/>',
    file: '<path d="M6 3h8l5 5v13H6z"/><path d="M14 3v5h5M9 13h7M9 17h5"/>',
    rupee: '<path d="M7 4h11M7 8.5h11M7 4h3.5a4.5 4.5 0 0 1 0 9H7l8 7.5"/>',
    plane: '<path d="M10.5 13.5 3 11l1.5-1.5 7.5.5 4.5-5a1.8 1.8 0 0 1 2.5 2.5l-5 4.5.5 7.5L13 21l-2.5-7.5"/>',
    train: '<rect x="5.5" y="3" width="13" height="14" rx="3"/><path d="M5.5 11h13M9 21l1.5-4M15 21l-1.5-4"/><circle cx="9" cy="14" r=".6" fill="currentColor"/><circle cx="15" cy="14" r=".6" fill="currentColor"/>',
    copy: '<rect x="8.5" y="8.5" width="12" height="12" rx="2"/><path d="M15.5 8.5V5.5a2 2 0 0 0-2-2h-8a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h3"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    logout: '<path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/>',
    route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 0 0 0-6H9a3 3 0 0 1 0-6h6.5"/>',
    chart: '<path d="M4 20V4M4 20h16M8 16v-4M12 16V8M16 16v-6"/>',
    sparkle: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>',
    bell: '<path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/>',
    mail: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><path d="m4 6 8 6.5L20 6"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.5-4.5L4 8M4 4v4h4M4 13a8 8 0 0 0 14.5 4.5L20 16M20 20v-4h-4"/>',
  };
  const sprite = Object.entries(icons).map(([id, body]) =>
    `<symbol id="i-${id}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</symbol>`
  ).join('');
  document.body.insertAdjacentHTML('afterbegin', `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${sprite}</svg>`);

  // ---------- Mobile navigation drawer ----------
  const drawer = document.getElementById('drawer');
  const backdrop = document.querySelector('.drawer-backdrop');
  let lastTrigger = null;
  const focusable = () => drawer.querySelectorAll('a[href], button:not([disabled]), input, select, textarea');

  function openDrawer(trigger) {
    lastTrigger = trigger;
    drawer.classList.add('is-open');
    backdrop && backdrop.classList.add('is-open');
    drawer.removeAttribute('inert');
    document.body.classList.add('has-drawer');
    document.querySelectorAll('[aria-controls="drawer"]').forEach(b => b.setAttribute('aria-expanded', 'true'));
    focusable()[0]?.focus();
  }
  function closeDrawer() {
    drawer.classList.remove('is-open');
    backdrop && backdrop.classList.remove('is-open');
    drawer.setAttribute('inert', '');
    document.body.classList.remove('has-drawer');
    document.querySelectorAll('[aria-controls="drawer"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    lastTrigger?.focus();
  }
  if (drawer) {
    drawer.setAttribute('inert', '');
    document.querySelectorAll('[aria-controls="drawer"]').forEach(btn =>
      btn.addEventListener('click', () => (drawer.classList.contains('is-open') ? closeDrawer() : openDrawer(btn))));
    drawer.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closeDrawer));
    backdrop?.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => {
      if (!drawer.classList.contains('is-open')) return;
      if (e.key === 'Escape') closeDrawer();
      if (e.key === 'Tab') {
        const f = focusable(), first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    if (new URLSearchParams(location.search).has('menu')) openDrawer(document.querySelector('[aria-controls="drawer"]'));
  }

  // ---------- Toggle chips ----------
  document.querySelectorAll('.chip[aria-pressed]').forEach(chip =>
    chip.addEventListener('click', () => chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') !== 'true')));

  // ---------- Counters ----------
  document.querySelectorAll('.counter').forEach(c => {
    const out = c.querySelector('output');
    const min = +(c.dataset.min || 1), max = +(c.dataset.max || 50);
    c.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
      out.value = Math.min(max, Math.max(min, +out.value + (+b.dataset.step)));
    }));
  });

  // ---------- Demo state switcher: <div data-states> with [data-state="x"] children ----------
  document.querySelectorAll('[data-state-switch]').forEach(sw => {
    const target = document.querySelector(sw.dataset.stateSwitch);
    const show = name => {
      target.querySelectorAll(':scope > [data-state]').forEach(p => { p.hidden = p.dataset.state !== name; });
      sw.querySelectorAll('[data-show]').forEach(b => b.setAttribute('aria-pressed', b.dataset.show === name));
    };
    sw.querySelectorAll('[data-show]').forEach(b => b.addEventListener('click', () => show(b.dataset.show)));
    const initial = new URLSearchParams(location.search).get('state');
    show(initial && target.querySelector(`[data-state="${initial}"]`) ? initial : sw.querySelector('[data-show]').dataset.show);
  });

  // ---------- Copy booking reference ----------
  document.querySelectorAll('[data-copy]').forEach(b => b.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(b.dataset.copy); b.querySelector('span').textContent = 'Copied'; } catch (_) {}
  }));
})();
