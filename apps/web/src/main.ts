import { bootstrapApplication } from '@angular/platform-browser';
import { appConfig } from './app/app.config';
import { App } from './app/app';
import { registerServiceWorker } from './app/pwa';
import { installTrustedTypesPolicy } from './app/trusted-types';

installTrustedTypesPolicy();
registerServiceWorker();

bootstrapApplication(App, appConfig).catch((err: unknown) => {
  console.error(err);
});
