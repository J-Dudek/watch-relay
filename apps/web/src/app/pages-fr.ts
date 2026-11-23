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
        q: 'Mes fichiers sont-ils modifiés ?',
        a: [
          'Non. Les fichiers .fit et .tcx sont copiés tels quels dans les ZIP : seul leur nom change (date et sport), pour un classement lisible. Ton export Garmin d’origine n’est jamais touché.',
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
          'COROS refuse les ZIP de plus de 200 Mo. L’outil découpe donc ton historique en ZIP d’au plus 180 Mo, dans l’ordre chronologique. Importe-les un par un.',
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
          'C’est un outil indépendant, gratuit, non affilié à Garmin ni à COROS. Aucun compte n’est nécessaire et il n’a besoin d’aucun de tes identifiants.',
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
          'Cet outil est indépendant et n’est affilié, approuvé ni parrainé par Garmin ni par COROS. « Garmin » et « COROS » sont des marques de leurs propriétaires respectifs, utilisées ici uniquement pour décrire la compatibilité de l’outil.',
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
          'L’outil s’appuie sur des logiciels libres (Angular, zip.js) et sur le SDK FIT de Garmin, utilisé selon sa licence.',
        ],
      },
      {
        h: 'Signaler un problème de sécurité',
        p: [`Écris à ${CONTACT}. Merci de ne joindre aucune donnée personnelle réelle.`],
      },
    ],
  },
};
