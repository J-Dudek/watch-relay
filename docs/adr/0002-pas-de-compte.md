# ADR 0002 — Aucun compte utilisateur

- Statut : accepté
- Date : 2026-11-23

## Contexte

L'application n'a aucune donnée à rattacher à une identité.

## Décision

Pas d'inscription, pas d'authentification, pas de cookie, pas de base de données, pas de fonction serveur. Hébergement statique uniquement.

## Conséquences

- Surface d'attaque réduite au site statique, aux fichiers déposés et à la chaîne d'approvisionnement.
- Pas de préférences synchronisées entre appareils (le stockage local suffit).
