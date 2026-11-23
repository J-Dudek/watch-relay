import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { registerServiceWorker } from './app/pwa';
import { applyTheme, readTheme } from './app/theme';
import { installTrustedTypesPolicy } from './app/trusted-types';

installTrustedTypesPolicy();
applyTheme(readTheme()); // avant le premier rendu : pas de flash du mauvais thème
registerServiceWorker();

bootstrapApplication(App, appConfig).catch((err: unknown) => {
  console.error(err);
});
