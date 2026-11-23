import type { RejectReason } from '@watch-relay/engine';

export function formatBytes(bytes: number): string {
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: i === 0 ? 0 : 1 })} ${units[i] ?? 'o'}`;
}

/** Libellés en langage clair, chacun avec une action possible (T3.7). */
export const REJECT_MESSAGES: Record<RejectReason, { title: string; hint: string }> = {
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
};

export function isMobileDevice(): boolean {
  const nav = navigator as Navigator & { userAgentData?: { mobile: boolean } };
  if (nav.userAgentData) return nav.userAgentData.mobile;
  const ua = navigator.userAgent;
  const ipadOs = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  return /Android|iPhone|iPad|iPod/i.test(ua) || ipadOs;
}

export function download(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 60_000);
}
