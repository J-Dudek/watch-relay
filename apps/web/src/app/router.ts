import { Injectable, signal } from '@angular/core';

export type InfoPageId = 'faq' | 'privacy' | 'legal';
export type Route = 'home' | InfoPageId;

/** URL de chaque page : de vraies adresses (indexables), pas des fragments `#`. */
export const ROUTE_PATHS: Record<Route, string> = {
  home: '/',
  faq: '/faq',
  privacy: '/privacy',
  legal: '/legal',
};

export function routeFromPath(pathname: string): Route {
  const path = pathname.replace(/\/+$/, '') || '/';
  return (
    (Object.entries(ROUTE_PATHS).find(([, p]) => p === path)?.[0] as Route | undefined) ?? 'home'
  );
}

/**
 * Navigation minimale par History API, sans bibliothèque : changer de page ne recharge pas l'app,
 * donc un traitement en cours ou terminé (ProcessingService) survit à la consultation d'une page.
 */
@Injectable({ providedIn: 'root' })
export class Router {
  readonly route = signal<Route>(routeFromPath(location.pathname));

  constructor() {
    // Anciens liens `/#/faq` : ramenés à la vraie adresse.
    const legacy = /^#\/(faq|privacy|legal)$/.exec(location.hash)?.[1] as InfoPageId | undefined;
    if (legacy) {
      history.replaceState(null, '', ROUTE_PATHS[legacy]);
      this.route.set(legacy);
    }
    addEventListener('popstate', () => {
      this.route.set(routeFromPath(location.pathname));
    });
  }

  navigate(route: Route): void {
    if (route === this.route()) return;
    history.pushState(null, '', ROUTE_PATHS[route]);
    this.route.set(route);
  }

  /** Clic sur un lien interne : navigation sans rechargement, sauf clic modifié (nouvel onglet…). */
  link(event: MouseEvent, route: Route): void {
    if (event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    this.navigate(route);
  }
}
