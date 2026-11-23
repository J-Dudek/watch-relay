import { ChangeDetectionStrategy, Component, output } from '@angular/core';

@Component({
  selector: 'app-guide-step',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2>1. Récupérer ton export Garmin</h2>
    <ol class="steps">
      <li>
        Ouvre la page
        <a
          href="https://www.garmin.com/account/datamanagement/"
          target="_blank"
          rel="noopener noreferrer"
          >Gestion des données de ton compte Garmin</a
        >
        et connecte-toi.
      </li>
      <li>Choisis <strong>« Demander l’exportation de vos données »</strong>.</li>
      <li>
        Garmin t’envoie un e-mail avec le lien de téléchargement. Cela peut prendre
        <strong>de quelques minutes à quelques jours</strong>.
      </li>
      <li>Télécharge le fichier <code>.zip</code> reçu, sans le décompresser.</li>
    </ol>
    <p class="note">
      L’import dans COROS se fait ensuite <strong>depuis un ordinateur</strong>. Tu peux préparer
      les fichiers ici, même depuis un téléphone.
    </p>
    <div class="actions">
      <button type="button" class="btn btn-primary" (click)="next.emit()">J’ai mon fichier</button>
    </div>
  `,
})
export class GuideStep {
  readonly next = output();
}
