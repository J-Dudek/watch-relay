import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { I18n } from './i18n';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Charge les textes de la langue active avant le premier rendu.
    provideAppInitializer(() => inject(I18n).init()),
  ],
};
