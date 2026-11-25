import type { PagesMessages } from './pages-types';

const CONTACT = 'julien.dudek@gmail.com';

export const PAGES_FR: PagesMessages = {
  faq: {
    title: 'Questions fréquentes',
    items: [
      {
        q: 'Peut-on aussi transférer de COROS vers Garmin ?',
        a: [
          'Oui. Choisis « COROS → Garmin » sur la première étape. L’outil lit l’export de ton compte COROS (Activity List, Export Data), écarte les fichiers que Garmin Connect refuse (FIT de plus de 50 Mo, TCX de plus de 25 Mo, 99 999 points ou plus), retire les doublons et classe le tout dans l’ordre chronologique.',
          'Garmin n’importe pas de ZIP : décompresse l’archive produite puis importe les fichiers depuis Garmin Connect sur ordinateur. Les limites exactes de Garmin (nombre de fichiers par import, sports acceptés) ne sont pas toutes documentées : si un import échoue, réessaie avec moins de fichiers.',
        ],
      },
      {
        q: 'Mes données sont-elles envoyées quelque part ?',
        a: [
          'Non. Ton export Garmin est lu et transformé directement dans ton navigateur. Aucun fichier, aucune activité, aucune métadonnée n’est transmis à un serveur.',
        ],
      },
      {
        q: 'Comment le vérifier ?',
        a: [
          'Charge la page, puis coupe ton wifi : tout le traitement fonctionne quand même. Tu peux aussi ouvrir l’onglet Réseau des outils de développement de ton navigateur pendant l’analyse : aucune requête n’est émise.',
          'Techniquement, la politique de sécurité de la page (CSP) interdit toute connexion vers un autre site, et un test automatisé vérifie à chaque version qu’aucune requête sortante n’a lieu pendant le traitement.',
        ],
      },
      {
        q: 'Et mes données de santé (sommeil, pas, fréquence cardiaque au repos…) ?',
        a: [
          'L’outil ne transfère que les activités : à ma connaissance, COROS Training Hub n’importe que des activités (FIT ou TCX). Les données de santé de ton export Garmin sont reconnues et signalées à l’analyse. Si tu coches « Extraire aussi mes données de santé en CSV » avant de déposer ton fichier, l’outil les convertit en CSV lisibles (un par catégorie : sommeil, activité quotidienne…) dans un fichier à part, pour ton archive personnelle. L’extraction se fait sur ton appareil et n’est pas activée par défaut. Rien n’est modifié ni supprimé : tout reste dans ton export et sur ton compte Garmin.',
        ],
      },
      {
        q: 'Et Polar ?',
        a: [
          'Polar est pris en charge comme source : Polar → COROS et Polar → Garmin. Exporte tes séances depuis Polar Flow (menu Exporter d’une séance, format TCX ou FIT), regroupe les fichiers dans un ZIP et dépose-le ici. Si une séance est exportée en plusieurs formats, elle n’est comptée qu’une fois. L’inverse (vers Polar) n’existe pas : à ma connaissance, Polar Flow n’importe pas d’historique d’activités, seulement des itinéraires. Tu peux aussi déposer l’export global de Polar (JSON, par e-mail depuis ton compte) tel quel : les séances sont converties en TCX. Cette conversion est écrite d’après des exemples communautaires et n’a pas été validée sur un export récent : vérifie la première séance importée.',
        ],
      },
      {
        q: 'Certaines activités sont écartées « sport non pris en charge » : que faire ?',
        a: [
          'Un seul sport inconnu ferait échouer l’import du ZIP entier dans COROS : ces activités sont donc écartées, et la liste (sports et fichiers) s’affiche dans l’analyse. Tu peux choisir de les traiter comme un sport accepté (par exemple golf comme marche) puis relancer l’analyse. Pour un FIT d’origine, seuls les octets du sport sont corrigés (le reste du fichier est conservé et le CRC recalculé) ; pour un GPX ou une séance Polar, le sport est écrit dans le FIT converti ; un TCX d’origine n’est pas modifié. Le reclassement est signalé dans le rapport. Ton fichier d’origine n’est jamais modifié.',
        ],
      },
      {
        q: 'Et Strava ?',
        a: [
          'Strava est pris en charge comme source : Strava → COROS et Strava → Garmin. Demande l’archive de ton compte (Paramètres, Mon compte, Télécharger ou supprimer ton compte), puis dépose le ZIP reçu tel quel. Les fichiers d’activité de l’export sont souvent compressés (.gz) : ils sont décompressés ici. Si l’export contient activities.csv, l’outil s’en sert pour retrouver le sport des activités dont le fichier ne l’indique pas. Les activités saisies à la main n’ont pas de fichier : elles sont comptées dans le rapport mais ne peuvent pas être transférées. L’inverse (vers Strava) n’existe pas dans cet outil. Les intitulés des menus de Strava peuvent changer, et le format de l’export n’a pas encore été validé sur de nombreux comptes : vérifie la première activité importée.',
        ],
      },
      {
        q: 'Et mes activités au format GPX ?',
        a: [
          'COROS n’importe que des fichiers FIT ou TCX. Les activités GPX (par exemple celles importées de Strava dans Garmin) sont donc converties en FIT, avec la trace, l’altitude, la fréquence cardiaque et la cadence quand elles existent. Le sport est déduit du fichier ou de son nom (ou, pour Strava, de activities.csv) et conservé : marche, randonnée, natation… Exception : une activité très courte dont le FIT serait plus petit que les 20 Ko minimum de COROS reste en TCX, qui ne connaît que Course, Vélo et Autre, plutôt que d’être écartée. Le FIT produit n’a pas encore été validé par des imports réels dans COROS : vérifie la première activité importée. Vers Garmin, les GPX sont conservés tels quels.',
        ],
      },
      {
        q: 'Mes fichiers sont-ils modifiés ?',
        a: [
          'Non, sauf la conversion des GPX décrite ci-dessus. Les fichiers .fit et .tcx sont copiés tels quels dans les ZIP : seul leur nom change (date et sport), pour un classement lisible. Ton export Garmin d’origine n’est jamais touché.',
        ],
      },
      {
        q: 'Pourquoi certains fichiers sont-ils écartés ?',
        a: [
          'COROS refuse les fichiers de moins de 20 Ko (considérés comme vides) ou de plus de 200 Mo, et l’import d’un ZIP entier échoue s’il contient un sport non pris en charge. On écarte ces fichiers pour que le reste passe. Les doublons (même activité présente plusieurs fois) sont aussi fusionnés. Le rapport te détaille chaque cas.',
        ],
      },
      {
        q: 'Pourquoi plusieurs ZIP ?',
        a: [
          'COROS refuse les ZIP de plus de 200 Mo. L’outil découpe donc ton historique en ZIP d’au plus 180 Mo (taille compressée, celle que COROS contrôle), dans l’ordre chronologique : un petit historique tient souvent en un seul ZIP. Importe-les un par un.',
        ],
      },
      {
        q: 'Puis-je importer depuis mon téléphone ?',
        a: [
          'Tu peux préparer les fichiers depuis un téléphone, mais l’import dans COROS Training Hub (t.coros.com) se fait depuis un ordinateur : l’application mobile COROS ne gère pas l’import d’historique.',
        ],
      },
      {
        q: 'Mon export fait plusieurs Go, est-ce un problème ?',
        a: [
          'Non, il est lu en flux et stocké temporairement sur ton appareil. Le traitement peut prendre quelques minutes : garde l’onglet ouvert. Par sécurité, les archives qui dépassent certaines limites (taille, nombre de fichiers, imbrication) sont refusées. Sur un téléphone, un très gros export peut manquer de mémoire : privilégie alors un ordinateur.',
        ],
      },
      {
        q: 'Combien de temps l’export Garmin met-il à arriver ?',
        a: [
          'De quelques minutes à quelques jours, selon Garmin. Tu reçois un e-mail avec le lien de téléchargement.',
        ],
      },
      {
        q: 'L’outil est-il officiel ? Est-il gratuit ?',
        a: [
          'C’est un outil indépendant, gratuit, non affilié à Garmin, COROS, Polar ni Strava. Aucun compte n’est nécessaire et il n’a besoin d’aucun de tes identifiants.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Politique de confidentialité',
    sections: [
      {
        h: 'En résumé',
        p: [
          'Cet outil ne collecte, ne transmet et ne stocke aucune donnée personnelle sur un serveur. Tout se passe dans ton navigateur.',
        ],
      },
      {
        h: 'Tes fichiers d’activité',
        p: [
          'Le fichier d’export que tu choisis est lu localement. Les fichiers extraits et les ZIP générés sont conservés temporairement dans le stockage privé de ton navigateur (ou en mémoire) le temps de la session, puis supprimés quand tu cliques sur « Recommencer » ou « Terminer », à la fermeture de l’onglet (au mieux) et, en tout cas, au prochain lancement : si le navigateur est fermé brutalement, ils peuvent subsister jusque-là sur ton appareil. Rien n’est envoyé sur Internet.',
        ],
      },
      {
        h: 'Cookies et traceurs',
        p: [
          'Aucun cookie, aucun traceur, aucun outil de mesure d’audience, aucune police ni ressource chargée depuis un site tiers.',
          'Un seul élément est mémorisé dans ton navigateur : ta préférence de langue (français ou anglais), qui ne quitte jamais ton appareil. Elle n’est pas utilisée pour te suivre.',
        ],
      },
      {
        h: 'Journaux du serveur d’hébergement',
        p: [
          'Comme tout site web, l’hébergeur (Netlify) qui livre les pages de l’outil peut enregistrer des informations techniques usuelles (adresse IP, date, page demandée, type de navigateur) à des fins de sécurité et de bon fonctionnement. Ces journaux ne contiennent rien de ce que tu traites dans l’outil, et ne sont pas utilisés à d’autres fins.',
        ],
      },
      {
        h: 'Tes droits',
        p: [
          `Pour toute question sur tes données ou pour exercer tes droits (accès, rectification, effacement) concernant les journaux d’hébergement, écris à ${CONTACT}.`,
        ],
      },
    ],
  },
  legal: {
    title: 'Mentions légales',
    sections: [
      {
        h: 'Éditeur',
        p: [`Julien Dudek (J6N, me.byj6n.fr), à titre personnel. Contact : ${CONTACT}.`],
      },
      {
        h: 'Hébergement',
        p: [
          'Site statique hébergé par Netlify, Inc. (États-Unis, netlify.com). Aucune base de données ni fonction serveur n’est utilisée.',
        ],
      },
      {
        h: 'Non-affiliation et marques',
        p: [
          'Cet outil est indépendant et n’est affilié, approuvé ni parrainé par Garmin, COROS, Polar ni Strava. « Garmin », « COROS », « Polar » et « Strava » sont des marques de leurs propriétaires respectifs, utilisées ici uniquement pour décrire la compatibilité de l’outil.',
        ],
      },
      {
        h: 'Responsabilité',
        p: [
          'L’outil est fourni « en l’état », sans garantie. Les règles d’import de COROS peuvent évoluer : un fichier préparé ici peut être refusé par COROS. Ton export Garmin d’origine n’est jamais modifié ; conserve-le jusqu’à avoir vérifié ton import.',
        ],
      },
      {
        h: 'Composants tiers',
        p: [
          'L’outil s’appuie sur des logiciels libres (Angular, zip.js), sur le SDK FIT de Garmin, utilisé selon sa licence, et sur le système de design design-j6n (licence MIT, github.com/J-Dudek/design-j6n) avec ses polices auto-hébergées Sora et IBM Plex Mono (licence SIL OFL 1.1).',
        ],
      },
      {
        h: 'Signaler un problème de sécurité',
        p: [`Écris à ${CONTACT}. Merci de ne joindre aucune donnée personnelle réelle.`],
      },
    ],
  },
};
