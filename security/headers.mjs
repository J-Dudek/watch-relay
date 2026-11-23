// Source unique des en-têtes de sécurité (T2.6, T2.8).
// Consommée par : le post-build (meta CSP, _headers, Caddyfile), le serveur de prévisualisation,
// et les tests e2e. Toute modification se fait ici.

/** Directives CSP, dans l'ordre du PLAN T2.6. */
export const CSP_DIRECTIVES = {
  'default-src': ["'none'"],
  'script-src': ["'self'"],
  'style-src': ["'self'"],
  'img-src': ["'self'", 'data:'],
  'font-src': ["'self'"],
  'connect-src': ["'self'"],
  'worker-src': ["'self'", 'blob:'],
  'manifest-src': ["'self'"],
  'base-uri': ["'none'"],
  'form-action': ["'none'"],
  'frame-ancestors': ["'none'"],
  'object-src': ["'none'"],
  // Seules les politiques Trusted Types connues sont autorisées (cf. main.ts).
  'trusted-types': ['default', 'angular', 'angular#bundler'],
  'require-trusted-types-for': ["'script'"],
  'upgrade-insecure-requests': [],
};

/**
 * Directives écartées de la CSP livrée via <meta> :
 * - frame-ancestors : ignorée par les navigateurs (avertissement) ;
 * - upgrade-insecure-requests : WebKit réécrit même http://localhost en https:// et casse le
 *   développement local. Elle reste dans l'en-tête HTTP réel, avec HSTS, au-dessus de HTTPS.
 */
const META_UNSUPPORTED = new Set(['frame-ancestors', 'upgrade-insecure-requests']);

export function buildCsp({ meta = false, upgradeInsecure = true } = {}) {
  return Object.entries(CSP_DIRECTIVES)
    .filter(([name]) => !(meta && META_UNSUPPORTED.has(name)))
    .filter(([name]) => upgradeInsecure || name !== 'upgrade-insecure-requests')
    .map(([name, values]) => [name, ...values].join(' '))
    .join('; ');
}

// Wake Lock et Web Share sont utilisés par l'app ; tout le reste est désactivé.
const PERMISSIONS = [
  'accelerometer',
  'ambient-light-sensor',
  'autoplay',
  'bluetooth',
  'browsing-topics',
  'camera',
  'display-capture',
  'encrypted-media',
  'fullscreen',
  'geolocation',
  'gyroscope',
  'hid',
  'idle-detection',
  'magnetometer',
  'microphone',
  'midi',
  'payment',
  'picture-in-picture',
  'publickey-credentials-get',
  'serial',
  'usb',
  'xr-spatial-tracking',
];

export function buildPermissionsPolicy() {
  return [...PERMISSIONS.map((p) => `${p}=()`), 'screen-wake-lock=(self)', 'web-share=(self)'].join(
    ', ',
  );
}

export function buildHeaders({ upgradeInsecure = true } = {}) {
  return {
    'Content-Security-Policy': buildCsp({ upgradeInsecure }),
    'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': buildPermissionsPolicy(),
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin',
  };
}
