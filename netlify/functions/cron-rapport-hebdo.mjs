import { executerTache } from "./lib/_taches.mjs";
import { collecterSnapshot, construireRapport, rendreHtml, resumePush, enregistrerRapport } from "./lib/_rapport.mjs";
import { sendEmail, emailConfigured } from "./lib/_email.mjs";
import { notifierTousLesAdmins } from "./lib/_push.mjs";

// Rapport hebdomadaire, lundi 8 h. Voir lib/_rapport.mjs pour le fond.
//
// Destinataire par variable d'environnement : l'adresse personnelle du
// propriétaire n'a pas à vivre dans un dépôt Git. À défaut, l'adresse de la
// boutique, qui est déjà celle utilisée comme expéditeur.
const DESTINATAIRE = process.env.ADMIN_EMAIL || "commande@e-carpet.shop";

export default async () => {
  return executerTache("rapport-hebdo", async () => {
    // Le rapport est ENREGISTRÉ avant d'être envoyé : si Brevo est en panne un
    // lundi, le back-office doit quand même pouvoir l'afficher. L'ordre
    // inverse perdrait le seul exemplaire à cause d'un incident chez un tiers.
    const rapport = construireRapport(await collecterSnapshot());
    await enregistrerRapport(rapport);

    // La notification part en premier et sans filet : notifierTousLesAdmins ne
    // lève pas quand VAPID manque ou qu'aucun appareil n'est abonné, elle se
    // contente de ne rien faire. On ne peut donc pas en tirer un signal de
    // succès — seul l'email est un canal dont l'échec est observable.
    await notifierTousLesAdmins({
      title: "Rapport hebdomadaire",
      body: resumePush(rapport),
      url: "/admin?section=accueil",
    }).catch((e) => console.error("[cron-rapport-hebdo] push:", e.message));

    const resume = `${rapport.anomalies.length} anomalie(s), ${rapport.actions.length} action(s)`;

    // Une clé absente n'est pas une panne : c'est une configuration. On le dit
    // dans le journal plutôt que de déclencher une alerte chaque lundi.
    if (!emailConfigured()) return `${resume} — email non configuré (BREVO_API_KEY absente)`;

    // Un échec d'envoi, en revanche, remonte : le rapport existe mais son
    // lecteur ne l'a pas reçu, et c'est exactement la panne silencieuse que le
    // journal des tâches sert à rendre visible.
    await sendEmail({
      to: DESTINATAIRE,
      subject: `Rapport E-Carpet · semaine du ${new Date(rapport.periode.debut).toLocaleDateString("fr-FR")}`,
      html: rendreHtml(rapport),
    });

    return resume;
  });
};

export const config = { schedule: "0 8 * * 1" };
