// Inline SVG icons. Emoji would be simpler, but an older Android build can be
// missing the newer ones and would show empty boxes - these always render.
window.ICONS = (function () {
  function svg(body, stroke) {
    return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" fill="' +
      (stroke ? 'none' : 'currentColor') + '" stroke="' + (stroke ? 'currentColor' : 'none') +
      '" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' + body + '</svg>';
  }

  return {
    // mode cards
    flag:   svg('<path d="M5 21V4"/><path d="M5 5h13l-2.5 4L18 13H5z"/>', true),
    search: svg('<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>', true),
    globe:  svg('<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18"/>', true),
    brush:  svg('<path d="M4 20c3 0 4-1.4 4-4 0-1.4-1-2.5-2.4-2.5C4 13.5 3 15 3 17c0 1.6 0 3 1 3z"/><path d="M8.5 15.5 19 5a2.1 2.1 0 0 1 3 3L11.5 18.5"/>', true),
    blocks: svg('<rect x="3" y="3" width="8" height="8" rx="1.5"/><rect x="13" y="3" width="8" height="8" rx="1.5"/><rect x="3" y="13" width="8" height="8" rx="1.5"/><rect x="13" y="13" width="8" height="8" rx="1.5"/>', true),

    // buttons
    gear:   svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>', true),
    photos: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4 17 5-5 4 4 3-2 4 4"/>', true),
    undo:   svg('<path d="M4 9h9a5 5 0 0 1 0 10h-3"/><path d="m4 9 4-4M4 9l4 4"/>', true),
    trash:  svg('<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>', true),
    eye:    svg('<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>', true),
    check:  svg('<path d="m4 12.5 5 5 11-11"/>', true),
    back:   svg('<path d="M20 12H4M4 12l6-6M4 12l6 6"/>', true),

    // build-mode stamps
    fill:    svg('<rect x="3" y="4" width="18" height="16" rx="2"/>'),
    stripeH: svg('<rect x="3" y="10" width="18" height="5" rx="1"/>'),
    stripeV: svg('<rect x="9.5" y="3" width="5" height="18" rx="1"/>'),
    block:   svg('<rect x="3" y="3" width="9" height="18" rx="1"/>'),
    cross:   svg('<path d="M3 10h18v4H3z"/><path d="M9 3h4v18H9z"/>'),
    disc:    svg('<circle cx="12" cy="12" r="7.5"/>'),
    star:    svg('<path d="m12 3 2.6 6h6.4l-5.2 4 2 6.4L12 15.6 6.2 19.4l2-6.4L3 9h6.4z"/>'),
    moon:    svg('<path d="M16.5 12a6.5 6.5 0 0 1-8.8 6.1 7.5 7.5 0 0 0 0-12.2A6.5 6.5 0 0 1 16.5 12z"/>'),
  };
})();
