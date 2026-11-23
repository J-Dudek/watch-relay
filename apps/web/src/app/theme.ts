/**
 * Mode d'affichage : « auto » suit le système (`prefers-color-scheme`), sinon on force clair ou
 * sombre via `<html data-theme>`, attribut que design-j6n comprend. Le choix est mémorisé localement
 * (jamais envoyé nulle part).
 */
export type ThemeMode = 'auto' | 'light' | 'dark';
export const THEME_MODES: readonly ThemeMode[] = ['auto', 'light', 'dark'];
const STORAGE_KEY = 'watch-relay.theme';

/** Couleurs de fond de design-j6n (clair / sombre), pour la barre du navigateur mobile. */
const THEME_COLOR = { light: '#f7fbf8', dark: '#0f1410' } as const;

export function readTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'light' || v === 'dark' ? v : 'auto';
  } catch {
    return 'auto';
  }
}

export function applyTheme(mode: ThemeMode): void {
  const root = document.documentElement;
  if (mode === 'auto') root.removeAttribute('data-theme');
  else root.dataset['theme'] = mode;

  // Barre du navigateur : en auto, deux balises selon la préférence ; forcé, la même pour les deux.
  for (const meta of document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')) {
    const scheme = meta.media.includes('dark') ? 'dark' : 'light';
    meta.content = THEME_COLOR[mode === 'auto' ? scheme : mode];
  }
}

export function storeTheme(mode: ThemeMode): void {
  try {
    if (mode === 'auto') localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* stockage indisponible : le choix vaut pour la session */
  }
}
