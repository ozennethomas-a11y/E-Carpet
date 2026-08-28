import { sql } from "./lib/_db.mjs";
import { publierSurReseaux } from "./lib/_socialPublish.mjs";

// Publie les posts programmés dont l'heure est passée. Vérifié toutes les
// heures : largement suffisant pour une programmation de réseaux sociaux (pas
// besoin de précision à la minute). Passé de 15 min à 1h le 2026-08-28 : le
// réveil de la base toutes les 15 minutes, 24h/24, empêchait la mise en veille
// automatique de Netlify DB et consommait à lui seul la quasi-totalité des
// crédits de calcul du mois (533 crédits sur 537 pour la base de données).
export default async () => {
  const dus = await sql()`
    select * from scheduled_posts
    where status = 'pending' and scheduled_for <= now()
  `;

  for (const post of dus) {
    const networks = Array.isArray(post.networks) ? post.networks : [];
    try {
      const resultats = await publierSurReseaux({
        caption: post.caption,
        imageUrl: post.image_url,
        videoUrl: post.video_url,
        networks,
      });
      const status = resultats.some((r) => r.ok) ? "published" : "failed";
      await sql()`
        update scheduled_posts
        set status = ${status}, result = ${JSON.stringify(resultats)}, published_at = now()
        where id = ${post.id}
      `;
      console.log(`[cron-social-publish] post ${post.id} → ${status}`);
    } catch (e) {
      await sql()`
        update scheduled_posts
        set status = 'failed', result = ${JSON.stringify({ error: String(e.message || e) })}, published_at = now()
        where id = ${post.id}
      `;
      console.error(`[cron-social-publish] échec post ${post.id}:`, e.message);
    }
  }

  return new Response(`${dus.length} post(s) traité(s)`);
};

export const config = { schedule: "0 * * * *" };
