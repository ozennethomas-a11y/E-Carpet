import { sql } from "./lib/_db.mjs";

// Fonction temporaire, ponctuelle : initialise le suivi des migrations
// (`_migrations_applied`, voir scripts/apply-migrations.mjs) en production,
// pour que le prochain déploiement (qui exécute désormais ce script au
// build) ne tente pas de rejouer tout l'historique. À supprimer juste après
// usage.
const SECRET = "a2d790f3981b3182752d3fed638f42e7";

const MIGRATIONS = [
  "20260812155841_create_ecommerce_schema",
  "20260812184248_short_lucky_pierre",
  "20260812211930_worried_infant_terrible",
  "20260812220148_lethal_cyclops",
  "20260813100033_fixed_thunderbolt",
  "20260813131119_bumpy_omega_flight",
  "20260813164649_real_abomination",
  "20260813171047_sour_thunderbolts",
  "20260813184614_stormy_exiles",
  "20260813220815_fair_tattoo",
  "20260813221757_cynical_polaris",
  "20260816181542_freezing_kate_bishop",
  "20260816182326_good_gorgon",
  "20260818180953_chief_plazm",
  "20260818181502_lazy_cable",
  "20260819094919_redundant_multiple_man",
  "20260819153317_narrow_justice",
  "20260819194242_seed_produit_ecarpet",
  "20260819201506_nappy_hex",
  "20260830180606_crazy_rick_jones",
  "20260830200936_bumpy_bloodaxe",
  "20260903192525_careful_romulus",
  "20260903195801_broken_stryfe",
  "20260903201455_sharp_rockslide",
];

export default async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  await sql()`create table if not exists _migrations_applied (name text primary key, applied_at timestamp default now())`;
  for (const nom of MIGRATIONS) {
    await sql()`insert into _migrations_applied (name) values (${nom}) on conflict do nothing`;
  }
  const rows = await sql()`select name from _migrations_applied order by name`;
  return Response.json({ ok: true, count: rows.length, names: rows.map((r) => r.name) });
};

export const config = { path: "/api/_migrate-once" };
