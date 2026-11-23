// T4.17 : Lighthouse CI sur le build de production servi avec les vrais en-têtes de sécurité.
const PORT = 4301;
const url = `http://localhost:${PORT}/`;

const assertions = {
  'categories:performance': ['error', { minScore: 0.95 }],
  'categories:accessibility': ['error', { minScore: 1 }],
  'categories:best-practices': ['error', { minScore: 1 }],
  'categories:seo': ['error', { minScore: 0.95 }],
};

module.exports = {
  ci: {
    collect: {
      startServerCommand: `PORT=${PORT} node scripts/serve-dist.mjs apps/web/dist/web/browser`,
      startServerReadyPattern: 'Prévisualisation',
      // Une seule URL : la FAQ est une route par hash, Lighthouse la mesurerait à l'identique.
      url: [url],
      numberOfRuns: 3,
      settings: {
        chromeFlags: '--no-sandbox --headless=new',
      },
    },
    assert: { assertions },
    upload: { target: 'filesystem', outputDir: '.lighthouseci' },
  },
};
