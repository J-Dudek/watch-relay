import type { Messages } from './i18n';

export function formatBytes(bytes: number, m: Pick<Messages, 'units' | 'numberLocale'>): string {
  const units = m.units;
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toLocaleString(m.numberLocale, { maximumFractionDigits: i === 0 ? 0 : 1 })} ${units[i] ?? 'o'}`;
}

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
