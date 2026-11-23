# ADR 0001 — Traitement 100 % côté navigateur

- Statut : accepté
- Date : 2026-11-23

## Contexte

Un export Garmin contient des données de santé et de localisation. Plusieurs Go à transférer coûteraient cher en hébergement et créeraient une obligation de conformité (RGPD).

## Décision

Tout le traitement (lecture ZIP, analyse FIT/TCX, filtrage, production des ZIP) s'exécute dans un Web Worker du navigateur. Le site est statique ; aucune requête réseau n'est émise pendant le traitement (vérifié en e2e, T2.11).

## Conséquences

- Confidentialité vérifiable par l'utilisateur (onglet Réseau, mode hors ligne).
- Contraintes mémoire mobiles : streaming + OPFS obligatoires.
- Pas de télémétrie : le support repose sur les issues GitHub.
