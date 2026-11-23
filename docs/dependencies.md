# Dépendances runtime (T2.12)

Cible du PLAN : Angular + zip.js + fitsdk. Toute dépendance ajoutée doit être justifiée ici.

| Paquet                                             | Rôle                                                  | Licence                                                                |
| -------------------------------------------------- | ----------------------------------------------------- | ---------------------------------------------------------------------- |
| `@angular/{core,common,compiler,platform-browser}` | Framework UI (standalone, signals, zoneless)          | MIT                                                                    |
| `rxjs`, `tslib`                                    | Requis par Angular                                    | Apache-2.0, 0BSD                                                       |
| `@zip.js/zip.js`                                   | Lecture/écriture ZIP en streaming                     | BSD-3-Clause                                                           |
| `@garmin/fitsdk`                                   | Décodage FIT officiel (CRC, messages FILE_ID/SESSION) | Licence FIT Garmin (exception revue dans `scripts/check-licenses.mjs`) |

`zone.js` n'est pas utilisé (application zoneless). Le parsing TCX se fait sans bibliothèque XML
(regex + rejet de tout `<!DOCTYPE`/`<!ENTITY`).

## Contrôles automatiques

- `npm audit --audit-level=high` bloquant en CI (T2.13).
- `npm run check:licenses` : licences des dépendances de production (T2.17).
- `npm run sbom` : SBOM CycloneDX générée en CI et jointe à chaque build (T2.16).
- Dependabot (T2.14) et CodeQL (T2.15) : `.github/`.
