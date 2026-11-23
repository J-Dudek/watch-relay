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
