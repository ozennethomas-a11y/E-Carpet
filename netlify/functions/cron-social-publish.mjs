import { sql } from "./_db.mjs";
import { publierSurReseaux } from "./_socialPublish.mjs";

// Publie les posts programmés dont l'heure est passée. Vérifié toutes les
// 15 minutes : suffisant pour une programmation de réseaux sociaux (pas besoin
// de précision à la minute), et cohérent avec la fréquence des autres cron.
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

export const config = { schedule: "*/15 * * * *" };
