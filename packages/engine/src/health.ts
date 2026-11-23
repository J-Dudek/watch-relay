/**
 * Reconnaissance (heuristique) des fichiers de santé d'un export, par leur chemin : les exports Garmin
 * rangent le bien-être sous un dossier « Wellness » et nomment les fichiers d'après leur contenu
 * (sommeil, stress, VFC, SpO2, résumés quotidiens…). Les noms exacts varient selon les versions
 * de l'export : à valider sur de vrais exports ; en cas de doute, le fichier reste « non activité ».
 */
const HEALTH_FOLDER = /(^|\/)[^/]*wellness[^/]*(\/|$)/i;
const HEALTH_NAME =
  /(sleep|hrv|stress|heart.?rate|resting|spo2|pulse.?ox|respiration|body.?battery|steps|hydration|health.?status|udsfile|wellness)/i;

export function isHealthPath(path: string): boolean {
  const name = path.split('/').pop() ?? path;
  if (!/\.(json|csv|fit)$/i.test(name)) return false;
  return HEALTH_FOLDER.test(path) || HEALTH_NAME.test(name);
}
