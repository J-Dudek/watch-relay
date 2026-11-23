# watch-relay

Transforme l'export de données **Garmin** en archives ZIP prêtes à importer dans **COROS Training Hub**.

> **100 % dans votre navigateur.** Vos fichiers ne quittent jamais votre appareil : aucun serveur de
> traitement, aucun compte, aucun cookie, aucun tracker.

## Le problème

COROS ne sait importer l'historique que par `.fit`/`.tcx`, avec des contraintes strictes (fichier
≥ 20 Ko, ZIP ≤ 200 Mo, sports pris en charge uniquement, import depuis un ordinateur sur t.coros.com).
L'export Garmin, lui, est un gros ZIP (parfois plusieurs Go) contenant des ZIP imbriqués. watch-relay fait
le tri et le découpage à votre place.

## Comment ça marche

1. **Guide** : comment demander et récupérer votre export Garmin.
2. **Dépôt** : vous déposez le ZIP (jamais envoyé nulle part).
3. **Analyse** : lecture récursive des archives, détection des `.fit`/`.tcx`, application de règles
   (taille, sport, période, doublons) et rapport clair des fichiers écartés et pourquoi.
4. **Import** : téléchargement d'un ou plusieurs ZIP (≤ 180 Mo chacun, ordre chronologique, ex.
   `coros-import-01-2019-03_2021-07.zip`), puis guide d'import dans COROS. Rapport CSV en option.

Un fichier corrompu n'interrompt jamais le traitement des autres.

## Garanties

| Garantie               | Comment elle est tenue                                                                                  |
| ---------------------- | ------------------------------------------------------------------------------------------------------- |
| Zéro donnée sortante   | test e2e : aucune requête cross-origin ni non-GET pendant le traitement                                 |
| Sécurité du navigateur | CSP stricte, Trusted Types, HSTS, COOP/COEP, Permissions-Policy (voir `docs/security.md`)               |
| Archives hostiles      | extraction en streaming avec limites (ratio 100:1, profondeur 3, nombre et taille), zip slip neutralisé |
| Fichiers forgés        | CRC FIT vérifié, TCX sans DTD/entités (XXE, billion laughs), CSV protégé contre l'injection de formule  |
| Gros exports           | traitement dans un Web Worker, stockage temporaire OPFS (repli mémoire), annulation possible            |
| Pas de trace           | stockage temporaire vidé au démarrage et à « Recommencer »                                              |

## Structure

```
packages/engine   moteur TypeScript pur (ZIP, FIT/TCX, règles, découpage, rapport) – utilisable sous Node
apps/web          application Angular 22 (standalone, signals, zoneless) + Web Worker
security/         source unique des en-têtes HTTP
scripts/          post-build sécurité, serveur de prévisualisation, garde-fous (licences, signature…)
docs/             ADR, sécurité, dépendances
PLAN.md           plan de développement (phases, tâches, jalons)
```

## Démarrage

Prérequis : Node 22+.

```bash
npm ci
npm run build            # build de production + CSP injectée, _headers, Caddyfile.snippet
npm run serve:dist -w @watch-relay/web   # sert le build avec les vrais en-têtes sur http://localhost:4300
```

Pour le développement : `npm start -w @watch-relay/web`.

## Qualité

| Commande                 | Rôle                                                                                  |
| ------------------------ | ------------------------------------------------------------------------------------- |
| `npm run lint`           | ESLint (typescript-eslint strict) + Prettier                                          |
| `npm run typecheck`      | TypeScript strict                                                                     |
| `npm test`               | Vitest (moteur, dont tests de propriétés fast-check, et UI)                           |
| `npm run e2e`            | Playwright sur le build de production : Chromium, Firefox, WebKit, Pixel 7, iPhone 15 |
| `npm run check:licenses` | licences des dépendances runtime                                                      |
| `npm run sbom`           | SBOM CycloneDX                                                                        |

La CI (GitHub Actions) exécute lint, typecheck, tests, audit des dépendances, licences, SBOM, e2e et
CodeQL. Dependabot suit les dépendances.

## Données de test

Aucune donnée réelle dans le dépôt. Les fichiers `.fit` n'existent que sous `fixtures/` et sont
**synthétiques** (générés avec l'encodeur officiel). Un hook de pré-commit refuse tout `.fit` ailleurs.

## Contribuer

Commits en [Conventional Commits](https://www.conventionalcommits.org/) ; les hooks Husky lancent
Prettier, ESLint et commitlint. Aucune mention d'outil de génération dans les commits ni les PR
(vérifié par hook et en CI).

## État d'avancement

Fait : moteur (phase 1), application et parcours en 4 étapes, durcissement du site (phase 2, en grande
partie). Interface bilingue FR/EN (langue du navigateur, repli FR, sélecteur mémorisé). À venir : PWA hors ligne, FAQ et mentions légales, tests d'accessibilité et sur
appareils réels. Détails dans [`PLAN.md`](PLAN.md).

Limites connues : liste des sports COROS provisoire ; pas de délai maximal strict par fichier ; OPFS non
vérifié sur un vrai iPhone (repli mémoire possible sur très gros exports) ; en-têtes HTTP à confirmer sur
l'hébergement (voir `docs/security.md`).

## Sécurité

Signalement d'une faille : voir [`SECURITY.md`](SECURITY.md) (contact : julien.dudek@gmail.com).

## Avertissement

Projet indépendant, non affilié à Garmin ni à COROS. « Garmin » et « COROS » sont des marques de leurs
propriétaires respectifs.
