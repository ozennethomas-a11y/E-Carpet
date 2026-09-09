import { sql } from "./_db.mjs";
import { notifierTousLesAdmins } from "./_push.mjs";

// Journal des tâches planifiées.
//
// Problème résolu : les 4 crons écrivaient leurs échecs dans console.error
// uniquement. Une tâche qui meurt (identifiants expirés, API tierce en panne,
// erreur de code) ne se signalait donc nulle part, et pouvait rester morte des
// semaines — le stock ne se synchronise plus, les relances ne partent plus,
// sans aucun signe visible dans le back-office.
//
// Chaque exécution laisse maintenant une trace, et un échec déclenche une
// notification push (même canal que les alertes de commande).

// Cadence attendue de chaque tâche, en minutes. Sert à repérer une tâche
// SILENCIEUSE : une tâche qui ne tourne plus n'écrit aucune ligne d'erreur,
// c'est justement l'absence de ligne qui est le signal.
// Doit rester cohérent avec le `schedule` déclaré dans chaque fonction cron.
export const TACHES = {
  "amazon-stock-sync": { label: "Synchronisation stock Amazon", cadenceMinutes: 240 },
  "cart-reminder": { label: "Relance panier abandonné", cadenceMinutes: 60 },
  "review-request": { label: "Demande d'avis (J+7)", cadenceMinutes: 1440 },
  "social-publish": { label: "Publication réseaux sociaux", cadenceMinutes: 60 },
  // Hebdomadaire : 7 × 1440 minutes. La tolérance de 2,5× ne la déclarera donc
  // silencieuse qu'après plus de deux semaines sans exécution, ce qui est le
  // bon ordre de grandeur — un lundi manqué n'est pas encore une panne.
  "rapport-hebdo": { label: "Rapport hebdomadaire", cadenceMinutes: 10080 },
};

// Marge de tolérance avant de déclarer une tâche en retard : un cron peut être
// décalé de quelques minutes sans que ce soit anormal.
const TOLERANCE = 2.5;

async function journaliser(task, status, detail, durationMs) {
  try {
    await sql()`
      insert into cron_runs (task, status, detail, duration_ms)
      values (${task}, ${status}, ${detail ? String(detail).slice(0, 500) : null}, ${durationMs})
    `;
  } catch (e) {
    // Le journal ne doit jamais faire échouer la tâche elle-même.
    console.error(`[taches] échec journalisation ${task}:`, e.message);
  }
}

/**
 * Exécute le corps d'une tâche planifiée en le journalisant.
 * `fn` peut renvoyer une chaîne : elle est enregistrée comme détail
 * (ex. "3 relances envoyées"), ce qui rend le journal utile et pas seulement
 * binaire.
 */
export async function executerTache(task, fn) {
  const debut = Date.now();
  try {
    const detail = await fn();
    await journaliser(task, "ok", detail, Date.now() - debut);
    return new Response(typeof detail === "string" ? detail : "ok");
  } catch (e) {
    const message = e?.message || String(e);
    console.error(`[cron-${task}] échec:`, message);
    await journaliser(task, "erreur", message, Date.now() - debut);

    // Alerte immédiate : c'est tout l'intérêt du dispositif. Elle ne doit pas
    // masquer l'erreur d'origine si l'envoi échoue à son tour.
    await notifierTousLesAdmins({
      title: "Tâche automatique en échec",
      body: `${TACHES[task]?.label || task} : ${message}`.slice(0, 200),
    }).catch((err) => console.error("[taches] échec alerte:", err.message));

    return new Response(`erreur: ${message}`, { status: 500 });
  }
}

/** État de chaque tâche pour l'écran d'administration. */
export async function etatDesTaches() {
  const dernieres = await sql()`
    select distinct on (task) task, status, detail, duration_ms, started_at
    from cron_runs
    order by task, started_at desc
  `;
  const parTache = Object.fromEntries(dernieres.map((r) => [r.task, r]));

  return Object.entries(TACHES).map(([task, meta]) => {
    const derniere = parTache[task] || null;
    const minutesDepuis = derniere
      ? (Date.now() - new Date(derniere.started_at).getTime()) / 60000
      : null;

    // Trois états distincts, volontairement : une tâche jamais vue n'est pas
    // la même chose qu'une tâche qui a planté, ni qu'une tâche silencieuse.
    let etat = "ok";
    if (!derniere) etat = "jamais_executee";
    else if (derniere.status === "erreur") etat = "erreur";
    else if (minutesDepuis > meta.cadenceMinutes * TOLERANCE) etat = "en_retard";

    return {
      task,
      label: meta.label,
      cadenceMinutes: meta.cadenceMinutes,
      etat,
      derniereExecution: derniere?.started_at || null,
      dernierStatut: derniere?.status || null,
      detail: derniere?.detail || null,
      dureeMs: derniere?.duration_ms ?? null,
    };
  });
}
