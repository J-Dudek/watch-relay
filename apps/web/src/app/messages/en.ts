import type { Base, Messages, PolarMessages, ReverseMessages, StravaMessages } from './fr';

const en: Base = {
  htmlTitle: 'watch-relay – activity migration for Garmin, COROS and Polar, 100% local',
  siteName: 'watch-relay',
  htmlDescription:
    'Prepare your activity history between Garmin, COROS and Polar. Everything happens in your browser: no data is sent, no account required.',
  tagline: '100% on your device: no data is sent, no account required.',
  direction: {
    label: 'Transfer direction',
    from: 'From',
    to: 'To',
    unavailable: 'unavailable',
    polarNote:
      'Polar Flow does not import activity history: Polar is only available as a source, like Strava.',
  },
  titleFor: (from: string, to: string) => `${from} → ${to} migration`,
  stepExport: (name: string) => `${name} export`,
  stepImport: (name: string) => `${name} import`,
  stepMiddle: ['Upload', 'Analysis'],
  stepsLabel: 'Steps',
  languageLabel: 'Language',
  footer:
    'Independent tool, not affiliated with Garmin, COROS, Polar or Strava. Brand names are used for descriptive purposes only.',
  loading: 'Loading…',
  logoAlt: 'watch-relay',
  theme: { label: 'Appearance', auto: 'Auto', light: 'Light', dark: 'Dark' },
  skipLink: 'Skip to content',
  stepState: { done: '(completed)', current: '(current)', todo: '(upcoming)' },
  design: { before: 'Design', name: 'design-j6n', href: 'https://design.byj6n.fr' },
  signature: { before: 'Made by', name: 'J6N', href: 'https://me.byj6n.fr' },
  back: 'Back',
  restart: 'Start over',
  guide: {
    title: '1. Get your Garmin export',
    s1Before: 'Open the',
    s1Href: 'https://www.garmin.com/account/datamanagement/',
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
    healthOption: 'Also extract my health data to CSV',
    healthHint:
      'Sleep, steps, resting heart rate… in a separate file that COROS cannot import. Sensitive data: it stays on your device.',
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
    health: (n: number) =>
      `${String(n)} health data file(s) detected (sleep, daily monitoring…). They are not included: this tool only transfers activities.`,
    sportsFound: 'Sports involved:',
    keptInstead: 'kept:',
    moreFiles: (n: number) =>
      `… and ${String(n)} more. The full list is in the CSV report, on the next step.`,
    stravaWithoutFile: (n: number) =>
      `${String(n)} Strava activity(ies) without a file (manual entries): they have no track to transfer and are not included.`,
    polarConverted: (n: number) =>
      `${String(n)} Polar session(s) (JSON from the global export) converted to FIT or TCX. Times and time zones come from the export: check the first imported session.`,
    gpxConverted: (n: number, fit: number) =>
      fit === n
        ? `${String(n)} GPX activity(ies) converted to FIT: COROS only imports FIT or TCX files, and FIT keeps the sport (walking, hiking…).`
        : fit === 0
          ? `${String(n)} GPX activity(ies) converted to TCX: COROS only imports FIT or TCX files (Walking or Hiking becomes “Other”, TCX has no other sport).`
          : `${String(n)} GPX activity(ies) converted: ${String(fit)} to FIT (sport kept) and ${String(n - fit)} to TCX, too short for a FIT that COROS accepts (the sport becomes Running, Biking or “Other”).`,
    healthExported: (rows: number, files: number) =>
      `Health data extracted: ${String(rows)} row(s) from ${String(files)} file(s), in a separate CSV (not importable into COROS).`,
    nothing: 'No importable activity was found. Make sure you uploaded the complete Garmin export.',
    breakdown: 'Breakdown by sport and by year',
    continue: 'Continue',
  },
  errors: {
    ABORTED: 'Analysis cancelled. No file was kept.',
    INPUT_TOO_LARGE: 'This file is too large to be processed here.',
    INVALID_ARCHIVE:
      'This file is not a readable ZIP archive (damaged or incomplete?). Download your Garmin export again.',
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
    TOO_MANY_POINTS: {
      title: 'Files too detailed',
      hint: 'These files exceed the number of recording points the platform accepts.',
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
    healthTitle: 'Your health data (CSV)',
    healthHint:
      'One CSV per category (sleep, daily activity…), for a personal archive: COROS cannot import them. This is sensitive data: do not share it.',
    healthFiles: (n: number) => `${String(n)} CSV file(s)`,
    activities: (n: number) => `${String(n)} activity(ies)`,
    download: 'Download',
    shareTo: 'Send to…',
    imported: 'Imported',
    downloadAll: 'Download all',
    csv: 'Report (CSV)',
    csvFileName: 'import-report.csv',
    howTo: 'Import into COROS Training Hub',
    h1Before: 'From a computer, open',
    h1Href: 'https://t.coros.com',
    h1Link: 't.coros.com',
    h1After: 'and sign in.',
    h2Before: 'Go to',
    h2A: 'Activity List',
    h2Mid: ', then',
    h2B: 'Import Data',
    h3Before: 'Select a ZIP, start the import and wait for the confirmation. Do it',
    h3Strong: 'one ZIP at a time',
    h4: 'Tick “Imported” above to track your progress.',
    progress: (done: number, total: number) =>
      `${String(done)} / ${String(total)} archive(s) imported`,
    finish: 'Finish',
  },
  pagesNav: {
    label: 'Information',
    faq: 'FAQ',
    privacy: 'Privacy',
    legal: 'Legal notice',
    backToTool: '← Back to the tool',
  },
  units: ['B', 'KB', 'MB', 'GB'],
  numberLocale: 'en-US',
};

const enReverse: ReverseMessages = {
  guide: {
    title: '1. Get your COROS export',
    s1Before: 'From a computer, open',
    s1Href: 'https://t.coros.com',
    s1Link: 'COROS Training Hub',
    s1After: 'and sign in.',
    s2Before: 'Go to',
    s2Strong: 'Activity List, then Export Data',
    s3Before: 'Enter your email and choose the format',
    s3Strong: 'FIT (recommended) or TCX',
    s4Before: 'Download the',
    s4After: 'file sent by email, without unzipping it.',
    noteBefore: 'Importing into Garmin Connect is then done',
    noteStrong: 'from a computer',
    noteAfter: '. You can prepare the files here, even from a phone.',
    haveFile: 'I have my file',
  },
  drop: {
    ...en.drop,
    choose: 'Choose the COROS ZIP file',
    notZip:
      'This file is not a ZIP. Choose the archive you received from COROS, without unzipping it.',
  },
  import: {
    ...en.import,
    title: '4. Import into Garmin Connect',
    mobileStrong: 'the Garmin Connect import must be done from a computer',
    howTo: 'Import into Garmin Connect',
    h1Before: 'From a computer, unzip the ZIP, then open',
    h1Href: 'https://connect.garmin.com',
    h1Link: 'connect.garmin.com',
    h1After: 'and sign in.',
    h2Before: 'Click the',
    h2A: 'cloud icon',
    h2Mid: 'at the top right, then',
    h2B: 'Import Data',
    h3Before:
      'Garmin does not accept ZIPs: select the unzipped files, in smaller groups if the import fails. Do it',
    h3Strong: 'one archive at a time',
  },
  reject: {
    ...en.reject,
    TOO_LARGE: {
      title: 'Files too large',
      hint: 'Garmin rejects FIT files over 50 MB and TCX files over 25 MB. These activities must be added another way.',
    },
    TOO_MANY_POINTS: {
      title: 'Files too detailed',
      hint: 'Garmin rejects files with 99,999 recording points or more. These activities must be added another way.',
    },
    CORRUPTED: {
      title: 'Unreadable files',
      hint: 'These files are damaged (interrupted download?). You can export again from COROS.',
    },
  },
};

/** Polar: source only (Polar Flow does not import activity history). */
const enPolar: PolarMessages = {
  guide: {
    title: '1. Get your Polar sessions',
    s1Before: 'From a computer, open',
    s1Href: 'https://flow.polar.com',
    s1Link: 'Polar Flow',
    s1After: 'and sign in.',
    s2Before: 'Open a session in the Diary, then the',
    s2Strong: 'Export',
    s3Before: 'Choose the format',
    s3Strong: 'TCX (or FIT)',
    s4Before: 'Repeat for each session, then put all the files in a single',
    s4After: 'file to upload here.',
    noteBefore: 'Polar also offers a global export of all your data (JSON):',
    noteStrong: 'drop the ZIP as received',
    noteAfter:
      ', sessions are converted (format not validated on a recent export). Polar Flow does not import history, so Polar is only a source.',
    haveFile: 'I have my file',
  },
  drop: {
    choose: 'Choose the Polar sessions ZIP',
    notZip: 'This file is not a ZIP. Put your exported sessions in a ZIP archive.',
  },
};

/** Strava: source only (full account export, files often gzipped). */
const enStrava: StravaMessages = {
  guide: {
    title: '1. Get your Strava export',
    s1Before: 'From a computer, open',
    s1Href: 'https://www.strava.com',
    s1Link: 'Strava',
    s1After: 'and sign in.',
    s2Before: 'Open your settings, then',
    s2Strong: 'My Account, Download or Delete Your Account',
    s3Before: 'Request your data archive:',
    s3Strong: 'Request Your Archive',
    s4Before: 'Download the',
    s4After: 'received by e-mail, without unzipping it, and drop it here.',
    noteBefore: 'The files in the export are often compressed (.gz):',
    noteStrong: 'drop the ZIP as received',
    noteAfter:
      ', they are decompressed here. Strava menu labels may change; Strava is only available as a source.',
    haveFile: 'I have my file',
  },
  drop: {
    choose: 'Choose the Strava export ZIP',
    notZip:
      'This file is not a ZIP. Choose the archive you received from Strava, without unzipping it.',
  },
};

export const MESSAGES_EN: Messages = {
  ...en,
  reverse: enReverse,
  polar: enPolar,
  strava: enStrava,
};
