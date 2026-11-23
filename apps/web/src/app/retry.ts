/** Réessaie un chargement de chunk qui échoue (réseau instable, service worker en cours d'activation). */
export async function withRetry<T>(load: () => Promise<T>, tries = 3, delayMs = 300): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await load();
    } catch (error) {
      if (attempt >= tries) throw error;
      await new Promise((resolve) => setTimeout(resolve, delayMs * attempt));
    }
  }
}
