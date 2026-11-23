# Sécurité du site

Source unique des en-têtes : [`security/headers.mjs`](../security/headers.mjs).
Le post-build (`scripts/postbuild-security.mjs`) en dérive la `<meta>` CSP, `_headers` et `Caddyfile.snippet`.
Le serveur de prévisualisation (`scripts/serve-dist.mjs`) pose les mêmes en-têtes : les tests e2e visent
donc le build de production tel qu'il sera livré.

## Ce qui est appliqué et vérifié automatiquement (e2e, 5 profils navigateur)

| Tâche                             | Contrôle                                                                                                     | Test                                         |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------- |
| T2.6 CSP stricte du PLAN          | présence et contenu des directives, pas de `unsafe-*`, pas d'origine externe                                 | `security.spec.ts`                           |
| T2.6 pas de styles/scripts inline | `index.html` du build ne contient ni `<style>`, ni `<script>` inline, ni `on*=` ; le post-build échoue sinon | `security.spec.ts`, `postbuild-security.mjs` |
| T2.7 Trusted Types                | `innerHTML` et `new Worker('https://…')` lèvent `TypeError` (Chromium)                                       | `security.spec.ts`                           |
| T2.8 en-têtes                     | HSTS, nosniff, Referrer-Policy, Permissions-Policy, COOP, COEP, CORP                                         | `security.spec.ts`                           |
| T2.10 tout en `'self'`            | aucune requête vers une autre origine                                                                        | `nominal.spec.ts`                            |
| T2.11 zéro requête sortante       | aucune requête non-GET pendant le traitement                                                                 | `nominal.spec.ts`                            |
| T4.14 aucune violation CSP        | aucune `securitypolicyviolation` ni erreur Trusted Types sur le parcours                                     | `nominal.spec.ts`, `security.spec.ts`        |

## Choix et écarts par rapport au PLAN

- `trusted-types default angular angular#bundler` : liste blanche des politiques ; la politique `default`
  (`apps/web/src/app/trusted-types.ts`) n'accepte que des URL de script de même origine (nécessaire à
  `new Worker`) et refuse HTML et script dynamiques.
- Permissions-Policy : tout est désactivé **sauf** `screen-wake-lock` et `web-share`, que l'app utilise (T3.10, T3.11).
- `<base href>` supprimé de `index.html` : `base-uri 'none'` le bloquait. L'app est servie à la racine.
- zip.js tourne sans sous-workers (`useWebWorkers: false`) : on est déjà dans un worker et un `blob:` Worker
  serait bloqué par Trusted Types.
- La CSP livrée en `<meta>` omet `frame-ancestors` (ignorée en meta) et `upgrade-insecure-requests`
  (WebKit réécrit `http://localhost` en `https://`). Les deux restent dans l'en-tête HTTP réel.
- En local, le serveur de prévisualisation n'envoie pas `upgrade-insecure-requests`, pour la même raison.

## Hébergement (T2.9) — NON VÉRIFIÉ

Il n'est pas établi qu'Appwrite Sites permette de poser des en-têtes HTTP personnalisés. À vérifier sur
l'instance réelle. Si ce n'est pas possible :

1. Placer un reverse proxy (Caddy ou Traefik) devant l'instance et y inclure `dist/web/browser/Caddyfile.snippet`.
2. En dernier recours, la `<meta>` CSP couvre l'essentiel de la CSP, mais **pas** HSTS, COOP, COEP, CORP,
   X-Content-Type-Options, Referrer-Policy ni `frame-ancestors`.

Les objectifs « Mozilla Observatory A+ » et « securityheaders.com A+ » ne pourront être mesurés qu'une fois
le site déployé sur un vrai domaine HTTPS ; HSTS `preload` suppose en outre de soumettre le domaine à la liste.

## Stockage OPFS selon le navigateur (T1.16)

Mesuré par `storage.spec.ts` : OPFS actif sur Chromium, Firefox et Pixel 7. Sur le WebKit de Playwright
(Linux), `navigator.storage.getDirectory()` échoue : l'app bascule sur le repli mémoire et le parcours
fonctionne. **Le comportement sur un vrai Safari iOS reste à tester sur appareil** (T4.16, T4.20) ; en repli
mémoire, un export de plusieurs Go risque de faire planter l'onglet.

## Reste à faire (hors de ce lot)

T2.12 à T2.22 : dépendances, audit, CodeQL/Semgrep, SBOM, ZAP, ASVS, `SECURITY.md` et `security.txt`
(nécessitent une adresse de contact de divulgation à fournir), revue indépendante.
