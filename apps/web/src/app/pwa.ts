import { isDevMode } from '@angular/core';

/**
 * Enregistre le service worker (T3.16) : après la première visite, l'app fonctionne hors ligne.
 * Désactivé en développement (`ng serve` ne produit pas sw.js). Un échec n'est pas bloquant.
 */
export function registerServiceWorker(): void {
  if (isDevMode() || !('serviceWorker' in navigator)) return;
  addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch((err: unknown) => {
      console.warn('Service worker non enregistré', err);
    });
  });
}
