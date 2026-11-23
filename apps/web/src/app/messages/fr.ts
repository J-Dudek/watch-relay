import type { RejectReason } from '@watch-relay/engine';

/** Source de vérité : le français. `en` doit avoir exactement la même forme (vérifié par le compilateur). */
export const fr = {
  htmlTitle: 'Migration Garmin ⇄ COROS – transfert d’activités, 100 % local',
  siteName: 'Migration Garmin ⇄ COROS',
  htmlDescription:
    'Prépare ton historique d’activités Garmin pour COROS, ou l’inverse. Tout se passe dans ton navigateur : aucune donnée n’est envoyée, aucun compte requis.',
  title: 'Migration Garmin → COROS',
  tagline: '100 % sur ton appareil : aucune donnée n’est envoyée, aucun compte requis.',
  direction: {
    label: 'Sens du transfert',
    toCoros: 'Garmin → COROS',
    toGarmin: 'COROS → Garmin',
  },
  stepsLabel: 'Étapes',
  steps: ['Export Garmin', 'Dépôt', 'Analyse', 'Import COROS'],
  languageSwitch: 'English',
  languageSwitchLabel: 'Switch to English',
  footer:
    'Outil indépendant, non affilié à Garmin ni à COROS. Les noms de marques ne sont utilisés qu’à titre descriptif.',
  loading: 'Chargement…',
  logoAlt: 'watch-relay',
  theme: { label: 'Apparence', auto: 'Auto', light: 'Clair', dark: 'Sombre' },
  skipLink: 'Aller au contenu',
  stepState: { done: '(terminée)', current: '(en cours)', todo: '(à venir)' },
  design: { before: 'Design', name: 'design-j6n', href: 'https://github.com/J-Dudek/design-j6n' },
  signature: { before: 'Conçu par', name: 'J6N', href: 'https://me.byj6n.fr' },
  back: 'Retour',
  restart: 'Recommencer',
  guide: {
    title: '1. Récupérer ton export Garmin',
    s1Before: 'Ouvre la page',
    s1Href: 'https://www.garmin.com/account/datamanagement/',
    s1Link: 'Gestion des données de ton compte Garmin',
    s1After: 'et connecte-toi.',
    s2Before: 'Choisis',
    s2Strong: '« Demander l’exportation de vos données »',
    s3Before: 'Garmin t’envoie un e-mail avec le lien de téléchargement. Cela peut prendre',
    s3Strong: 'de quelques minutes à quelques jours',
    s4Before: 'Télécharge le fichier',
    s4After: 'reçu, sans le décompresser.',
    noteBefore: 'L’import dans COROS se fait ensuite',
    noteStrong: 'depuis un ordinateur',
    noteAfter: '. Tu peux préparer les fichiers ici, même depuis un téléphone.',
    haveFile: 'J’ai mon fichier',
  },
  drop: {
    title: '2. Déposer le fichier',
    intro: 'Le fichier reste sur ton appareil : rien n’est envoyé sur Internet.',
    choose: 'Choisir le fichier ZIP Garmin',
    orDrag: 'ou le glisser-déposer ici',
    notZip: 'Ce fichier n’est pas un ZIP. Choisis l’archive reçue de Garmin, sans la décompresser.',
    tooLarge: (size: string, limit: string) =>
      `Ce fichier est trop volumineux (${size}). La limite est de ${limit}.`,
  },
  analyze: {
    title: '3. Analyse',
    analyzing: 'Analyse de',
    progress: 'Progression',
    processed: (n: number, phase: 'analyze' | 'write', bytes: string) =>
      `${String(n)} fichier(s) ${phase === 'analyze' ? 'analysé(s)' : 'écrit(s)'} · ${bytes} lus`,
    keepOpen: 'Garde cet onglet ouvert. Tu peux couper ton wifi : tout se passe sur ton appareil.',
    cancel: 'Annuler',
    ready: 'activité(s) prête(s)',
    rejected: 'écartée(s)',
    ignored: 'fichier(s) ignoré(s)',
    health: (n: number) =>
      `${String(n)} fichier(s) de données de santé détecté(s) (sommeil, suivi quotidien…). Ils ne sont pas inclus : cet outil ne transfère que les activités.`,
    nothing:
      'Aucune activité importable n’a été trouvée. Vérifie que tu as déposé l’export Garmin complet.',
    breakdown: 'Répartition par sport et par année',
    continue: 'Continuer',
  },
  errors: {
    ABORTED: 'Analyse annulée. Aucun fichier n’a été conservé.',
    INPUT_TOO_LARGE: 'Ce fichier est trop volumineux pour être traité ici.',
    INVALID_ARCHIVE:
      'Ce fichier n’est pas une archive ZIP lisible (abîmé ou incomplet ?). Télécharge de nouveau ton export Garmin.',
    LIMITS:
      'Cette archive dépasse les limites de sécurité (taille, nombre de fichiers ou imbrication). Elle n’a pas été traitée.',
    UNKNOWN: 'Le fichier n’a pas pu être traité.',
  },
  reject: {
    TOO_SMALL: {
      title: 'Fichiers trop petits',
      hint: 'COROS refuse les fichiers de moins de 20 Ko, considérés comme vides. Rien à faire.',
    },
    TOO_LARGE: {
      title: 'Fichiers trop volumineux',
      hint: 'COROS refuse les fichiers de plus de 200 Mo. Ces activités doivent être ajoutées autrement.',
    },
    TOO_MANY_POINTS: {
      title: 'Fichiers trop détaillés',
      hint: 'Ces fichiers dépassent le nombre de points d’enregistrement accepté par la plateforme.',
    },
    UNSUPPORTED_SPORT: {
      title: 'Sports non pris en charge',
      hint: 'COROS ferait échouer l’import du ZIP entier : on les écarte pour protéger les autres.',
    },
    DUPLICATE: {
      title: 'Doublons',
      hint: 'La même activité apparaissait plusieurs fois : la version la plus complète est conservée.',
    },
    CORRUPTED: {
      title: 'Fichiers illisibles',
      hint: 'Ces fichiers sont abîmés (téléchargement interrompu ?). Tu peux redemander un export à Garmin.',
    },
    OUT_OF_RANGE: {
      title: 'Hors de la période choisie',
      hint: 'Ces activités sont en dehors des dates demandées.',
    },
  } satisfies Record<RejectReason, { title: string; hint: string }>,
  import: {
    title: '4. Importer dans COROS',
    mobileBefore: 'Tu peux préparer les fichiers ici, mais',
    mobileStrong: 'l’import COROS se fait depuis un ordinateur',
    mobileShare:
      'Envoie les ZIP vers Fichiers ou Drive pour les récupérer ensuite sur ton ordinateur.',
    yourFiles: 'Tes fichiers',
    activities: (n: number) => `${String(n)} activité(s)`,
    download: 'Télécharger',
    shareTo: 'Envoyer vers…',
    imported: 'Importé',
    downloadAll: 'Tout télécharger',
    csv: 'Rapport (CSV)',
    csvFileName: 'rapport-import.csv',
    howTo: 'Importer dans COROS Training Hub',
    h1Before: 'Depuis un ordinateur, ouvre',
    h1Href: 'https://t.coros.com',
    h1Link: 't.coros.com',
    h1After: 'et connecte-toi.',
    h2Before: 'Va dans',
    h2A: 'Activity List',
    h2Mid: ', puis',
    h2B: 'Import Data',
    h3Before: 'Sélectionne un ZIP, lance l’import et attends la confirmation. Fais-le',
    h3Strong: 'un ZIP à la fois',
    h4: 'Coche « Importé » ci-dessus pour suivre ta progression.',
    progress: (done: number, total: number) =>
      `${String(done)} / ${String(total)} archive(s) importée(s)`,
    finish: 'Terminer',
  },
  pagesNav: {
    label: 'Informations',
    faq: 'FAQ',
    privacy: 'Confidentialité',
    legal: 'Mentions légales',
    backToTool: '← Retour à l’outil',
  },
  units: ['o', 'Ko', 'Mo', 'Go'],
  numberLocale: 'fr-FR',
};

export type Base = typeof fr;
/** Textes qui dépendent du sens du transfert. */
export type FlowMessages = Pick<Base, 'title' | 'steps' | 'guide' | 'drop' | 'import' | 'reject'>;
export type Messages = Base & { readonly reverse: FlowMessages };

const frReverse: FlowMessages = {
  title: 'Migration COROS → Garmin',
  steps: ['Export COROS', 'Dépôt', 'Analyse', 'Import Garmin'],
  guide: {
    title: '1. Récupérer ton export COROS',
    s1Before: 'Depuis un ordinateur, ouvre',
    s1Href: 'https://t.coros.com',
    s1Link: 'COROS Training Hub',
    s1After: 'et connecte-toi.',
    s2Before: 'Va dans',
    s2Strong: 'Activity List, puis Export Data',
    s3Before: 'Saisis ton e-mail et choisis le format',
    s3Strong: 'FIT (recommandé) ou TCX',
    s4Before: 'Télécharge le fichier',
    s4After: 'reçu par e-mail, sans le décompresser.',
    noteBefore: 'L’import dans Garmin Connect se fait ensuite',
    noteStrong: 'depuis un ordinateur',
    noteAfter: '. Tu peux préparer les fichiers ici, même depuis un téléphone.',
    haveFile: 'J’ai mon fichier',
  },
  drop: {
    ...fr.drop,
    choose: 'Choisir le fichier ZIP COROS',
    notZip: 'Ce fichier n’est pas un ZIP. Choisis l’archive reçue de COROS, sans la décompresser.',
  },
  import: {
    ...fr.import,
    title: '4. Importer dans Garmin Connect',
    mobileStrong: 'l’import Garmin Connect se fait depuis un ordinateur',
    howTo: 'Importer dans Garmin Connect',
    h1Before: 'Depuis un ordinateur, décompresse le ZIP, puis ouvre',
    h1Href: 'https://connect.garmin.com',
    h1Link: 'connect.garmin.com',
    h1After: 'et connecte-toi.',
    h2Before: 'Clique sur l’icône',
    h2A: 'nuage',
    h2Mid: 'en haut à droite, puis',
    h2B: 'Importer des données',
    h3Before:
      'Garmin n’accepte pas les ZIP : sélectionne les fichiers décompressés, par petits groupes si l’import échoue. Fais-le',
    h3Strong: 'une archive à la fois',
  },
  reject: {
    ...fr.reject,
    TOO_LARGE: {
      title: 'Fichiers trop volumineux',
      hint: 'Garmin refuse les fichiers FIT de plus de 50 Mo et TCX de plus de 25 Mo. Ces activités doivent être ajoutées autrement.',
    },
    TOO_MANY_POINTS: {
      title: 'Fichiers trop détaillés',
      hint: 'Garmin refuse les fichiers de 99 999 points d’enregistrement ou plus. Ces activités doivent être ajoutées autrement.',
    },
    CORRUPTED: {
      title: 'Fichiers illisibles',
      hint: 'Ces fichiers sont abîmés (téléchargement interrompu ?). Tu peux refaire un export depuis COROS.',
    },
  },
};

export const MESSAGES_FR: Messages = { ...fr, reverse: frReverse };
