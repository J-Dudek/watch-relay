# Politique de sécurité

## Signaler une vulnérabilité

Merci de **ne pas** ouvrir d'issue publique pour une faille de sécurité.
Écrivez à **julien.dudek@gmail.com** (français ou anglais) avec :

- une description du problème et de son impact ;
- les étapes pour le reproduire (idéalement avec un fichier de test **synthétique**, jamais vos vraies données) ;
- la version ou le commit concerné.

Engagements : accusé de réception sous 7 jours, point d'étape sous 30 jours, correction ou
réponse motivée sous 90 jours. Le même contact est publié dans `/.well-known/security.txt` (RFC 9116).

## Périmètre

watch-relay est une application **100 % côté navigateur** : aucune donnée utilisateur n'est envoyée
à un serveur. Les sujets les plus pertinents :

- contournement des limites de lecture des archives (zip bomb, zip slip, ZIP imbriqués) ;
- exécution de code ou injection via un fichier FIT/TCX/ZIP forgé (XXE, injection de formule CSV…) ;
- contournement de la CSP / Trusted Types, ou toute requête sortante pendant le traitement ;
- fuite de données hors du navigateur.

Hors périmètre : vulnérabilités des services tiers (Garmin, COROS), attaques nécessitant un
poste déjà compromis, déni de service par un fichier de plusieurs Go sur un appareil limité
(les limites sont documentées dans `docs/security.md`).

## Versions prises en charge

Seule la dernière version déployée est corrigée.
