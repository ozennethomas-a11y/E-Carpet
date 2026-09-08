// Garde-fou contre les effets réels déclenchés depuis un environnement de test.
//
// Incident du 08/09/2026 : un test local du cron "demande d'avis" a envoyé un
// vrai email à un vrai client. Trois conditions réunies, toutes normales
// séparément : `netlify dev` charge le .env avec la vraie clé Brevo, la base
// de développement est un clone de la production (donc de vraies adresses), et
// sendEmail() n'avait aucune notion d'environnement.
//
// Ce module ferme cette classe d'erreur d'un coup, au seul endroit qui compte :
// juste avant l'appel sortant. Il protège les emails, les brouillons
// d'expédition Packlink et les publications sur les réseaux sociaux.

/**
 * Vrai uniquement si l'on a de bonnes raisons de croire qu'on tourne en
 * production réelle.
 *
 * Sens du repli volontairement asymétrique : on ne bloque que si un signal
 * POSITIF d'environnement de test est présent. Exiger au contraire une preuve
 * de production couperait tous les emails clients (confirmations de commande
 * comprises) le jour où Netlify cesserait d'exposer CONTEXT à l'exécution —
 * une panne silencieuse bien pire que le risque qu'on traite ici.
 */
export function envoisReelsAutorises() {
  if (process.env.NETLIFY_DEV === "true") return false; // `netlify dev` en local
  const contexte = process.env.CONTEXT;
  if (contexte && contexte !== "production") return false; // deploy-preview, branch-deploy
  return true;
}

/**
 * À appeler juste avant un envoi réel. Renvoie true si l'envoi doit être
 * abandonné, en le journalisant clairement pour que le test reste lisible.
 */
export function envoiBloque(canal, destinataire) {
  if (envoisReelsAutorises()) return false;
  console.log(
    `[garde-fou] ${canal} NON envoyé vers "${destinataire}" : environnement de test ` +
      `(CONTEXT=${process.env.CONTEXT || "absent"}, NETLIFY_DEV=${process.env.NETLIFY_DEV || "absent"}).`,
  );
  return true;
}
