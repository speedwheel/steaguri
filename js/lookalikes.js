// Flags that are genuinely easy to mix up. Hard levels pull their wrong
// answers from the target's group first - that is what makes them hard.
window.LOOKALIKES = [
  ['RO', 'TD', 'MD', 'AD'],                          // vertical blue-yellow-red
  ['NL', 'LU', 'RU', 'PY', 'HR'],                    // red-white-blue bands
  ['ID', 'MC', 'PL', 'SG'],                          // red + white halves
  ['IE', 'IT', 'CI', 'IN', 'NE', 'MX'],              // green-white-orange verticals
  ['AU', 'NZ', 'FJ', 'TV'],                          // blue ensign + stars
  ['NO', 'IS', 'DK', 'FI', 'SE'],                    // nordic crosses
  ['SI', 'SK', 'RS', 'RU', 'CZ'],                    // slavic tricolours
  ['TR', 'TN', 'DZ', 'PK', 'MR'],                    // crescent + star
  ['AT', 'LV', 'PE', 'CA', 'LB'],                    // red-white-red bands
  ['CO', 'EC', 'VE'],                                // yellow-blue-red
  ['SN', 'ML', 'GN', 'CM'],                          // pan-African verticals
  ['GH', 'ET', 'BO', 'LT', 'MM'],                    // green-yellow-red bands
  ['AR', 'UY', 'SV', 'NI', 'HN', 'GT'],              // blue-white-blue
  ['EG', 'IQ', 'YE', 'SY', 'SD'],                    // pan-Arab bands
  ['JO', 'PS', 'KW', 'AE', 'EH'],                    // pan-Arab + triangle
  ['CL', 'CU', 'PR', 'TG', 'LR'],                    // stripes + star canton
  ['US', 'LR', 'MY'],                                // many stripes
  ['JP', 'BD', 'PW'],                                // single disc
  ['CN', 'VN', 'MA', 'TN'],                          // red + yellow/red star
  ['HU', 'BG', 'IR', 'TJ', 'IT'],                    // green-white-red
  ['GR', 'UY', 'IL'],                                // blue-white stripes
  ['PH', 'CZ', 'CU', 'SS'],                          // hoist triangle
  ['BE', 'DE', 'UG'],                                // black-yellow-red
  ['CH', 'DK', 'TO', 'GE'],                          // plain cross
  ['ES', 'PT', 'BT'],                                // crest on colour bands
  ['ZA', 'SS', 'MW', 'KE'],                          // multi-band African
];

// cc -> array of confusable cc's (excluding itself).
window.LOOKALIKE_MAP = (function () {
  var map = {};
  window.LOOKALIKES.forEach(function (group) {
    group.forEach(function (cc) {
      map[cc] = map[cc] || [];
      group.forEach(function (other) {
        if (other !== cc && map[cc].indexOf(other) === -1) map[cc].push(other);
      });
    });
  });
  return map;
})();
