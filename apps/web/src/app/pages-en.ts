import type { PagesMessages } from './pages-types';

const CONTACT = 'julien.dudek@gmail.com';

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
        q: 'What about my health data (sleep, steps, resting heart rate…)?',
        a: [
          'The tool only transfers activities: to my knowledge, COROS Training Hub only imports activities (FIT or TCX). Health data in your Garmin export is recognised and reported during the analysis. If you tick “Also extract my health data to CSV” before uploading your file, the tool converts it into readable CSV files (one per category: sleep, daily activity…) in a separate file, for your personal archive. Extraction happens on your device and is off by default. Nothing is modified or deleted: everything stays in your export and on your Garmin account.',
        ],
      },
      {
        q: 'What about Polar?',
        a: [
          'Polar is supported as a source: Polar → COROS and Polar → Garmin. Export your sessions from Polar Flow (a session’s Export menu, TCX or FIT format), put the files in a ZIP and drop it here. If a session is exported in several formats, it is counted once. The reverse (to Polar) does not exist: to my knowledge, Polar Flow does not import activity history, only routes. You can also drop Polar’s global export (JSON, sent by email from your account) as received: sessions are converted to TCX. This conversion is based on community examples and has not been validated on a recent export: check the first imported session.',
        ],
      },
      {
        q: 'Some activities are dropped as “unsupported sport”: what can I do?',
        a: [
          'A single unknown sport would make COROS reject the whole ZIP, so these activities are dropped, and the list (sports and files) is shown in the analysis. You can choose to treat them as an accepted sport (for example golf as walking) and run the analysis again. For an original FIT file, only the sport bytes are changed (the rest of the file is kept and the CRC recomputed); for a GPX or a Polar session, the sport is written into the converted FIT; an original TCX is not modified. The reclassification is reported. Your original file is never modified.',
        ],
      },
      {
        q: 'What about Strava?',
        a: [
          'Strava is supported as a source: Strava → COROS and Strava → Garmin. Request your account archive (Settings, My Account, Download or Delete Your Account), then drop the ZIP as received. The activity files in the export are often compressed (.gz): they are decompressed here. If the export contains activities.csv, the tool uses it to recover the sport of activities whose file does not state it. Manually entered activities have no file: they are counted in the report but cannot be transferred. The reverse (to Strava) does not exist in this tool. Strava menu labels may change, and the export format has not yet been validated on many accounts: check the first imported activity.',
        ],
      },
      {
        q: 'What about my GPX activities?',
        a: [
          'COROS only imports FIT or TCX files. GPX activities (for example those imported from Strava into Garmin) are therefore converted to FIT, with the track, altitude, heart rate and cadence when present. The sport is deduced from the file or its name (or, for Strava, from activities.csv) and kept: walking, hiking, swimming… Exception: a very short activity whose FIT would be smaller than COROS’s 20 KB minimum stays in TCX, which only knows Running, Biking and Other, rather than being dropped. The FIT we write has not yet been validated by real imports into COROS: check the first imported activity. Towards Garmin, GPX files are kept as they are.',
        ],
      },
      {
        q: 'Are my files modified?',
        a: [
          'No, apart from the GPX conversion described above. The .fit and .tcx files are copied as-is into the ZIPs: only their name changes (date and sport) for a readable listing. Your original Garmin export is never touched.',
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
          'COROS rejects ZIPs over 200 MB. The tool therefore splits your history into ZIPs of at most 180 MB (compressed size, the one COROS checks), in chronological order: a small history often fits in a single ZIP. Import them one at a time.',
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
          'It is an independent, free tool, not affiliated with Garmin, COROS, Polar or Strava. No account is needed and it never asks for any of your credentials.',
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
          'Like any website, the host (Netlify) delivering the tool’s pages may record usual technical information (IP address, date, requested page, browser type) for security and proper operation. These logs contain nothing of what you process in the tool and are not used for any other purpose.',
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
        p: [`Julien Dudek (J6N, me.byj6n.fr), in a personal capacity. Contact: ${CONTACT}.`],
      },
      {
        h: 'Hosting',
        p: [
          'Static site hosted by Netlify, Inc. (United States, netlify.com). No database or server function is used.',
        ],
      },
      {
        h: 'Non-affiliation and trademarks',
        p: [
          'This tool is independent and is not affiliated with, endorsed or sponsored by Garmin, COROS, Polar or Strava. “Garmin”, “COROS”, “Polar” and “Strava” are trademarks of their respective owners, used here only to describe the tool’s compatibility.',
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
          'The tool relies on open-source software (Angular, zip.js), on Garmin’s FIT SDK, used under its license, and on the design-j6n design system (MIT license, github.com/J-Dudek/design-j6n) with its self-hosted Sora and IBM Plex Mono fonts (SIL OFL 1.1 license).',
        ],
      },
      {
        h: 'Reporting a security issue',
        p: [`Write to ${CONTACT}. Please do not attach any real personal data.`],
      },
    ],
  },
};
