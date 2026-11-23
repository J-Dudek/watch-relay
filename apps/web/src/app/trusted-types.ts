/**
 * Politique Trusted Types « default » (T2.7), appliquée aux chaînes passées à un puits contrôlé
 * (notamment `new Worker(url)`). Elle n'autorise que des URL de script de même origine et
 * refuse toute création de HTML ou de script : aucune donnée issue d'un fichier ne peut y arriver.
 * Angular utilise ses propres politiques (`angular`, `angular#bundler`) pour son rendu.
 */
interface TrustedTypesApi {
  createPolicy(
    name: string,
    rules: {
      createHTML?: (input: string) => string;
      createScript?: (input: string) => string;
      createScriptURL?: (input: string) => string;
    },
  ): unknown;
}

export function installTrustedTypesPolicy(): void {
  const api = (globalThis as { trustedTypes?: TrustedTypesApi }).trustedTypes;
  if (!api) return; // navigateur sans Trusted Types : la CSP reste active
  api.createPolicy('default', {
    createHTML: () => {
      throw new TypeError('HTML dynamique interdit');
    },
    createScript: () => {
      throw new TypeError('Script dynamique interdit');
    },
    createScriptURL: (input) => {
      const url = new URL(input, location.href);
      if (url.protocol !== 'https:' && url.protocol !== 'http:')
        throw new TypeError('Schéma d’URL de script interdit');
      if (url.origin !== location.origin) throw new TypeError('URL de script externe interdite');
      return url.href;
    },
  });
}
