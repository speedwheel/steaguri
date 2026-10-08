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

    // atlas
    compass:  svg('<circle cx="12" cy="12" r="9"/><path d="m15.6 8.4-2.2 5-5 2.2 2.2-5z"/>', true),
    pin:      svg('<path d="M12 21.5s-6.8-6.4-6.8-11.6a6.8 6.8 0 0 1 13.6 0c0 5.2-6.8 11.6-6.8 11.6z"/><circle cx="12" cy="9.9" r="2.5"/>', true),
    regions:  svg('<path d="M4.5 6.5 11 3.5l8.5 3v11l-7 3-8-3z"/><path d="M11 3.5 12.5 11l7-1.5M12.5 11l-8 1.5M12.5 11v9.5"/>', true),
    mountain: svg('<path d="m2 20 7.2-12.5 4.3 7.2 2.7-4.2L22 20z"/><path d="m7.2 11 2 1.6 1.8-1.4"/>', true),
    river:    svg('<path d="M7 2.5c3.5 3 -3.5 6.5 0 9.5s-3.5 6.5 0 9.5"/><path d="M15 2.5c3.5 3 -3.5 6.5 0 9.5s-3.5 6.5 0 9.5"/>', true),
    water:    svg('<path d="M2 8.5c2.5-2.2 4.5-2.2 7 0s4.5 2.2 7 0 4.5-2.2 6 0"/><path d="M2 14c2.5-2.2 4.5-2.2 7 0s4.5 2.2 7 0 4.5-2.2 6 0"/><path d="M2 19.5c2.5-2.2 4.5-2.2 7 0s4.5 2.2 7 0 4.5-2.2 6 0"/>', true),
    plus:     svg('<path d="M12 5v14M5 12h14"/>', true),
    minus:    svg('<path d="M5 12h14"/>', true),
    target:   svg('<circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>', true),

    // maths
    calc:      svg('<path d="M6.5 3.5v6M3.5 6.5h6M14.5 6.5h6M4.4 15.4l4.2 4.2M8.6 15.4l-4.2 4.2M14.5 15.8h6M14.5 19.2h6"/>', true),
    plusminus: svg('<path d="M8 3.5v9M3.5 8h9M12.5 18h8"/><path d="m18.5 4-12.5 16" opacity=".35"/>', true),
    times:     svg('<path d="m4 4 7 7M11 4l-7 7M13.5 17.5h7"/><circle cx="17" cy="14" r=".6"/><circle cx="17" cy="21" r=".6"/>', true),
    numline:   svg('<path d="M2.5 17.5h19M5 15v5M12 15v5M19 15v5"/><path d="M5 12.5c1.4-5 5.6-5 7 0M12 12.5c1.4-5 5.6-5 7 0"/>', true),
    clock:     svg('<circle cx="12" cy="12" r="9"/><path d="M12 6.8V12l3.6 2.2"/>', true),
    coin:      svg('<rect x="2.5" y="5.5" width="13" height="9" rx="1.8"/><circle cx="9" cy="10" r="1.8"/><circle cx="16.5" cy="15.5" r="5"/><path d="M16.5 13.2v4.6"/>', true),
    // logic
    bulb:    svg('<path d="M9.5 18.5h5M10.5 21.5h3"/><path d="M12 2.5a6.2 6.2 0 0 0-3.7 11.2c.7.5 1.1 1.3 1.1 2.1v.2h5.2v-.2c0-.8.4-1.6 1.1-2.1A6.2 6.2 0 0 0 12 2.5z"/>', true),
    pattern: svg('<circle cx="4.5" cy="12" r="2.8"/><rect x="9.2" y="9.2" width="5.6" height="5.6" rx="1"/><circle cx="19.5" cy="12" r="2.8"/>', true),
    odd:     svg('<circle cx="7" cy="7" r="3.3"/><circle cx="17" cy="7" r="3.3"/><circle cx="7" cy="17" r="3.3"/><rect x="13.6" y="13.6" width="6.8" height="6.8" rx="1.2"/>', true),
    grid3:   svg('<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>', true),
    robot:   svg('<rect x="4.5" y="8" width="15" height="11.5" rx="3"/><path d="M12 8V4.8"/><circle cx="12" cy="3.6" r="1.2"/><path d="M9.3 12.6v1.4M14.7 12.6v1.4M2 12.5v3M22 12.5v3"/>', true),
    backspace: svg('<path d="M8.5 5h11A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-11L2.5 12z"/><path d="m11.5 9.5 5 5M16.5 9.5l-5 5"/>', true),

    // buttons
    gear:   svg('<circle cx="12" cy="12" r="3.2"/><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1"/>', true),
    photos: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="m4 17 5-5 4 4 3-2 4 4"/>', true),
    undo:   svg('<path d="M4 9h9a5 5 0 0 1 0 10h-3"/><path d="m4 9 4-4M4 9l4 4"/>', true),
    trash:  svg('<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>', true),
    eye:    svg('<path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12z"/><circle cx="12" cy="12" r="2.8"/>', true),
    check:  svg('<path d="m4 12.5 5 5 11-11"/>', true),
    back:   svg('<path d="M20 12H4M4 12l6-6M4 12l6 6"/>', true),

    flame:  svg('<path d="M12 2.5c.6 3.3-1.2 4.6-2.6 6.1C7.7 10.4 6 12 6 14.6A6 6 0 0 0 18 15c0-3.4-2.2-5-3.4-6.6-.5.9-1.2 1.4-2 1.7.6-2.9.4-5.6-.6-7.6z"/>'),
    trophy: svg('<path d="M7 4h10v5a5 5 0 0 1-10 0zM4 5h3v3a3 3 0 0 1-3-3zM20 5h-3v3a3 3 0 0 0 3-3zM10 14h4v3h-4zM8 19h8v2H8z"/>'),
    heart:  svg('<path d="M12 20s-7.5-4.6-7.5-9.6A4.4 4.4 0 0 1 12 7.4a4.4 4.4 0 0 1 7.5 3C19.5 15.4 12 20 12 20z"/>'),
    bolt:   svg('<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z"/>'),

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
