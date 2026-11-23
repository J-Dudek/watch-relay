# ADR 0003 — Pas d'envoi automatique vers COROS

- Statut : accepté
- Date : 2026-11-23

## Contexte

COROS ne propose pas d'API publique d'import d'historique. Automatiser l'import impliquerait de manipuler les identifiants COROS de l'utilisateur.

## Décision

L'application produit des ZIP conformes ; l'utilisateur les importe lui-même sur t.coros.com. Aucun identifiant n'est demandé ni stocké.

## Conséquences

- Un guide d'import pas à pas fait partie du produit (T3.9).
- L'import reste impossible depuis un mobile : message dédié (T3.10).
