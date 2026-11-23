export interface Section {
  readonly h: string;
  readonly p: readonly string[];
}
export interface PagesMessages {
  readonly faq: { title: string; items: readonly { q: string; a: readonly string[] }[] };
  readonly privacy: { title: string; sections: readonly Section[] };
  readonly legal: { title: string; sections: readonly Section[] };
}

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
          'Comme tout site web, le serveur qui livre les pages de l’outil peut enregistrer des informations techniques usuelles (adresse IP, date, page demandée, type de navigateur) à des fins de sécurité et de bon fonctionnement. Ces journaux ne contiennent rien de ce que tu traites dans l’outil, et ne sont pas utilisés à d’autres fins.',
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
        p: [`Julien Dudek, à titre personnel. Contact : ${CONTACT}.`],
      },
      {
        h: 'Hébergement',
        p: [
          'Site statique hébergé sur une instance Appwrite exploitée par l’éditeur. Aucune base de données ni fonction serveur n’est utilisée.',
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

export const PAGES_EN: PagesMessages = {
  faq: {
    title: 'Frequently asked questions',
    items: [
      {
        q: 'Can I also transfer from COROS to Garmin?',
        a: [
          'Yes. Choose “COROS → Garmin” on the first step. The tool reads the export from your COROS account (Activity List, Export Data), excludes files Garmin Connect rejects (FIT over 50 MB, TCX over 25 MB, 99,999 points or more), removes duplicates and sorts everything chronologically.',
          'Garmin does not import ZIPs: unzip the generated archive, then import the files from Garmin Connect on a computer. Garmin’s exact limits (files per import, accepted sports) are not all documented: if an import fails, retry with fewer files.',
        ],
      },
      {
        q: 'Is my data sent anywhere?',
        a: [
          'No. Your Garmin export is read and transformed directly in your browser. No file, activity or metadata is sent to a server.',
        ],
      },
      {
        q: 'How can I check?',
        a: [
          'Load the page, then turn off your wifi: all the processing still works. You can also open the Network tab of your browser’s developer tools during the analysis: no request is made.',
          'Technically, the page’s security policy (CSP) forbids any connection to another site, and an automated test checks on every release that no outgoing request happens during processing.',
        ],
      },
      {
        q: 'Are my files modified?',
        a: [
          'No. The .fit and .tcx files are copied as-is into the ZIPs: only their name changes (date and sport) for a readable listing. Your original Garmin export is never touched.',
        ],
      },
      {
        q: 'Why are some files excluded?',
        a: [
          'COROS rejects files under 20 KB (treated as empty) or over 200 MB, and importing a whole ZIP fails if it contains an unsupported sport. These files are excluded so the rest goes through. Duplicates (the same activity present several times) are merged too. The report details each case.',
        ],
      },
      {
        q: 'Why several ZIPs?',
        a: [
          'COROS rejects ZIPs over 200 MB. The tool therefore splits your history into ZIPs of at most 180 MB, in chronological order. Import them one at a time.',
        ],
      },
      {
        q: 'Can I import from my phone?',
        a: [
          'You can prepare the files from a phone, but importing into COROS Training Hub (t.coros.com) must be done from a computer: the COROS mobile app does not handle history import.',
        ],
      },
      {
        q: 'My export is several GB, is that a problem?',
        a: [
          'No, it is read as a stream and stored temporarily on your device. Processing can take a few minutes: keep the tab open. For safety, archives exceeding certain limits (size, number of files, nesting) are refused. On a phone, a very large export may run out of memory: use a computer instead.',
        ],
      },
      {
        q: 'How long does the Garmin export take to arrive?',
        a: [
          'From a few minutes to a few days, depending on Garmin. You receive an email with the download link.',
        ],
      },
      {
        q: 'Is the tool official? Is it free?',
        a: [
          'It is an independent, free tool, not affiliated with Garmin or COROS. No account is needed and it never asks for any of your credentials.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Privacy policy',
    sections: [
      {
        h: 'In short',
        p: [
          'This tool does not collect, transmit or store any personal data on a server. Everything happens in your browser.',
        ],
      },
      {
        h: 'Your activity files',
        p: [
          'The export file you choose is read locally. Extracted files and generated ZIPs are kept temporarily in your browser’s private storage (or in memory) for the duration of the session, then deleted when you click “Start over” or “Finish”, when the tab is closed (best effort) and, in any case, at the next launch: if the browser is killed abruptly, they may remain on your device until then. Nothing is sent over the Internet.',
        ],
      },
      {
        h: 'Cookies and trackers',
        p: [
          'No cookies, no trackers, no analytics, no fonts or resources loaded from a third-party site.',
          'Only one item is remembered in your browser: your language preference (French or English), which never leaves your device. It is not used to track you.',
        ],
      },
      {
        h: 'Hosting server logs',
        p: [
          'Like any website, the server delivering the tool’s pages may record usual technical information (IP address, date, requested page, browser type) for security and proper operation. These logs contain nothing of what you process in the tool and are not used for any other purpose.',
        ],
      },
      {
        h: 'Your rights',
        p: [
          `For any question about your data, or to exercise your rights (access, rectification, erasure) regarding hosting logs, write to ${CONTACT}.`,
        ],
      },
    ],
  },
  legal: {
    title: 'Legal notice',
    sections: [
      {
        h: 'Publisher',
        p: [`Julien Dudek, in a personal capacity. Contact: ${CONTACT}.`],
      },
      {
        h: 'Hosting',
        p: [
          'Static site hosted on an Appwrite instance operated by the publisher. No database or server function is used.',
        ],
      },
      {
        h: 'Non-affiliation and trademarks',
        p: [
          'This tool is independent and is not affiliated with, endorsed or sponsored by Garmin or COROS. “Garmin” and “COROS” are trademarks of their respective owners, used here only to describe the tool’s compatibility.',
        ],
      },
      {
        h: 'Liability',
        p: [
          'The tool is provided “as is”, without warranty. COROS import rules may change: a file prepared here may be rejected by COROS. Your original Garmin export is never modified; keep it until you have checked your import.',
        ],
      },
      {
        h: 'Third-party components',
        p: [
          'The tool relies on open-source software (Angular, zip.js) and on Garmin’s FIT SDK, used under its license.',
        ],
      },
      {
        h: 'Reporting a security issue',
        p: [`Write to ${CONTACT}. Please do not attach any real personal data.`],
      },
    ],
  },
};
