import { Injectable, computed, signal } from '@angular/core';
import type { RejectReason } from '@watch-relay/engine';
import { PAGES_EN, PAGES_FR } from './pages-content';

export type Locale = 'fr' | 'en';
export const LOCALES: readonly Locale[] = ['fr', 'en'];
const STORAGE_KEY = 'watch-relay.lang';

/** Source de vérité : le français. `en` doit avoir exactement la même forme (vérifié par le compilateur). */
const fr = {
  htmlTitle: 'Migration Garmin vers COROS',
  htmlDescription:
    'Prépare ton historique d’activités Garmin pour l’importer dans COROS. Tout se passe dans ton navigateur : aucune donnée n’est envoyée.',
  title: 'Migration Garmin → COROS',
  tagline: '100 % sur ton appareil : aucune donnée n’est envoyée, aucun compte requis.',
  stepsLabel: 'Étapes',
  steps: ['Export Garmin', 'Dépôt', 'Analyse', 'Import COROS'],
  languageSwitch: 'English',
  languageSwitchLabel: 'Switch to English',
  footer:
    'Outil indépendant, non affilié à Garmin ni à COROS. Les noms de marques ne sont utilisés qu’à titre descriptif.',
  back: 'Retour',
  restart: 'Recommencer',
  guide: {
    title: '1. Récupérer ton export Garmin',
    s1Before: 'Ouvre la page',
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
    nothing:
      'Aucune activité importable n’a été trouvée. Vérifie que tu as déposé l’export Garmin complet.',
    breakdown: 'Répartition par sport et par année',
    continue: 'Continuer',
  },
  errors: {
    ABORTED: 'Analyse annulée. Aucun fichier n’a été conservé.',
    INPUT_TOO_LARGE: 'Ce fichier est trop volumineux pour être traité ici.',
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
    h1After: 'et connecte-toi.',
    h2Before: 'Va dans',
    h2Mid: ', puis',
    h3Before: 'Sélectionne un ZIP, lance l’import et attends la confirmation. Fais-le',
    h3Strong: 'un ZIP à la fois',
    h4: 'Coche « Importé » ci-dessus pour suivre ta progression.',
    progress: (done: number, total: number) =>
      `${String(done)} / ${String(total)} archive(s) importée(s)`,
    finish: 'Terminer',
  },
  pages: PAGES_FR,
  units: ['o', 'Ko', 'Mo', 'Go'],
  numberLocale: 'fr-FR',
};

export type Messages = typeof fr;

const en: Messages = {
  htmlTitle: 'Garmin to COROS migration',
  htmlDescription:
    'Prepare your Garmin activity history for import into COROS. Everything happens in your browser: no data is sent anywhere.',
  title: 'Garmin → COROS migration',
  tagline: '100% on your device: no data is sent, no account required.',
  stepsLabel: 'Steps',
  steps: ['Garmin export', 'Upload', 'Analysis', 'COROS import'],
  languageSwitch: 'Français',
  languageSwitchLabel: 'Passer en français',
  footer:
    'Independent tool, not affiliated with Garmin or COROS. Brand names are used for descriptive purposes only.',
  back: 'Back',
  restart: 'Start over',
  guide: {
    title: '1. Get your Garmin export',
    s1Before: 'Open the',
    s1Link: 'Data Management page of your Garmin account',
    s1After: 'and sign in.',
    s2Before: 'Choose',
    s2Strong: '“Request Data Export”',
    s3Before: 'Garmin emails you a download link. This can take',
    s3Strong: 'from a few minutes to a few days',
    s4Before: 'Download the',
    s4After: 'file you received, without unzipping it.',
    noteBefore: 'Importing into COROS is then done',
    noteStrong: 'from a computer',
    noteAfter: '. You can prepare the files here, even from a phone.',
    haveFile: 'I have my file',
  },
  drop: {
    title: '2. Upload the file',
    intro: 'The file stays on your device: nothing is sent over the Internet.',
    choose: 'Choose the Garmin ZIP file',
    orDrag: 'or drag and drop it here',
    notZip:
      'This file is not a ZIP. Choose the archive you received from Garmin, without unzipping it.',
    tooLarge: (size: string, limit: string) =>
      `This file is too large (${size}). The limit is ${limit}.`,
  },
  analyze: {
    title: '3. Analysis',
    analyzing: 'Analyzing',
    progress: 'Progress',
    processed: (n: number, phase: 'analyze' | 'write', bytes: string) =>
      `${String(n)} file(s) ${phase === 'analyze' ? 'analyzed' : 'written'} · ${bytes} read`,
    keepOpen: 'Keep this tab open. You can turn off your wifi: everything happens on your device.',
    cancel: 'Cancel',
    ready: 'activity(ies) ready',
    rejected: 'excluded',
    ignored: 'file(s) ignored',
    nothing: 'No importable activity was found. Make sure you uploaded the complete Garmin export.',
    breakdown: 'Breakdown by sport and by year',
    continue: 'Continue',
  },
  errors: {
    ABORTED: 'Analysis cancelled. No file was kept.',
    INPUT_TOO_LARGE: 'This file is too large to be processed here.',
    LIMITS:
      'This archive exceeds the safety limits (size, number of files or nesting). It was not processed.',
    UNKNOWN: 'The file could not be processed.',
  },
  reject: {
    TOO_SMALL: {
      title: 'Files too small',
      hint: 'COROS rejects files under 20 KB, treated as empty. Nothing to do.',
    },
    TOO_LARGE: {
      title: 'Files too large',
      hint: 'COROS rejects files over 200 MB. These activities must be added another way.',
    },
    UNSUPPORTED_SPORT: {
      title: 'Unsupported sports',
      hint: 'COROS would fail the whole ZIP import: they are excluded to protect the others.',
    },
    DUPLICATE: {
      title: 'Duplicates',
      hint: 'The same activity appeared several times: the most complete version is kept.',
    },
    CORRUPTED: {
      title: 'Unreadable files',
      hint: 'These files are damaged (interrupted download?). You can ask Garmin for a new export.',
    },
    OUT_OF_RANGE: {
      title: 'Outside the chosen period',
      hint: 'These activities fall outside the requested dates.',
    },
  },
  import: {
    title: '4. Import into COROS',
    mobileBefore: 'You can prepare the files here, but',
    mobileStrong: 'the COROS import must be done from a computer',
    mobileShare: 'Send the ZIPs to Files or Drive so you can pick them up on your computer.',
    yourFiles: 'Your files',
    activities: (n: number) => `${String(n)} activity(ies)`,
    download: 'Download',
    shareTo: 'Send to…',
    imported: 'Imported',
    downloadAll: 'Download all',
    csv: 'Report (CSV)',
    csvFileName: 'import-report.csv',
    howTo: 'Import into COROS Training Hub',
    h1Before: 'From a computer, open',
    h1After: 'and sign in.',
    h2Before: 'Go to',
    h2Mid: ', then',
    h3Before: 'Select a ZIP, start the import and wait for the confirmation. Do it',
    h3Strong: 'one ZIP at a time',
    h4: 'Tick “Imported” above to track your progress.',
    progress: (done: number, total: number) =>
      `${String(done)} / ${String(total)} archive(s) imported`,
    finish: 'Finish',
  },
  pages: PAGES_EN,
  units: ['B', 'KB', 'MB', 'GB'],
  numberLocale: 'en-US',
};

const DICTIONARIES: Record<Locale, Messages> = { fr, en };

/** FR par défaut ; EN si la première langue du navigateur est l'anglais. */
export function detectLocale(languages: readonly string[]): Locale {
  const first = languages[0]?.toLowerCase() ?? '';
  return first.startsWith('en') ? 'en' : 'fr';
}

function readStored(): Locale | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'fr' || v === 'en' ? v : null;
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class I18n {
  readonly locale = signal<Locale>(readStored() ?? detectLocale(navigator.languages));
  readonly t = computed(() => DICTIONARIES[this.locale()]);

  set(locale: Locale): void {
    this.locale.set(locale);
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      /* stockage indisponible : le choix vaut pour la session */
    }
    this.applyToDocument();
  }

  toggle(): void {
    this.set(this.locale() === 'fr' ? 'en' : 'fr');
  }

  /** Met à jour <html lang>, le titre et la description. */
  applyToDocument(): void {
    const t = this.t();
    document.documentElement.lang = this.locale();
    document.title = t.htmlTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', t.htmlDescription);
  }
}
