// Applique au build les migrations en attente sur NEON_DATABASE_URL.
//
// Nécessaire depuis le passage à Neon en direct le 2026-08-31
// (netlify/functions/lib/_db.mjs) : l'ancien mécanisme d'auto-application au
// déploiement était propre à l'extension "Netlify DB", abandonnée ce
// jour-là — sans cette étape, les migrations générées depuis ne sont plus
// jamais appliquées en production (constaté le 03/09/2026 : plusieurs
// tables absentes en prod alors que présentes dans le code, rattrapées
// manuellement une fois avant de mettre en place ce script).
//
// Suivi maison (table `_migrations_applied`) plutôt que `drizzle-orm/migrator` :
// ce dossier ne suit pas le format attendu par drizzle-kit (pas de
// meta/_journal.json, un dossier par migration). Au tout premier lancement,
// la table est vide : on marque alors comme "déjà appliquées" toutes les
// migrations déjà présentes dans le dépôt à cet instant (leurs tables
// existent déjà en prod, via l'ancien mécanisme ou l'application manuelle du
// 03/09/2026) — seules les migrations ajoutées après ce point seront
// réellement exécutées automatiquement.
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const url = process.env.NEON_DATABASE_URL;
if (!url) {
  console.log("[migrations] NEON_DATABASE_URL absente, étape ignorée (ex. build sans base configurée).");
  process.exit(0);
}

const sql = neon(url);
const dir = path.join(import.meta.dirname, "..", "netlify", "database", "migrations");
const dossiers = fs
  .readdirSync(dir, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .sort();

await sql`create table if not exists _migrations_applied (name text primary key, applied_at timestamp default now())`;

const { rows } = { rows: await sql`select name from _migrations_applied` };
const dejaAppliquees = new Set(rows.map((r) => r.name));

if (dejaAppliquees.size === 0) {
  console.log(`[migrations] premier lancement : ${dossiers.length} migration(s) existante(s) marquée(s) comme déjà appliquée(s).`);
  for (const nom of dossiers) {
    await sql`insert into _migrations_applied (name) values (${nom}) on conflict do nothing`;
  }
  process.exit(0);
}

const enAttente = dossiers.filter((nom) => !dejaAppliquees.has(nom));
if (enAttente.length === 0) {
  console.log("[migrations] à jour, rien à appliquer.");
  process.exit(0);
}

for (const nom of enAttente) {
  const fichier = path.join(dir, nom, "migration.sql");
  const contenu = fs.readFileSync(fichier, "utf8");
  const statements = contenu.split("--> statement-breakpoint").map((s) => s.trim()).filter(Boolean);
  console.log(`[migrations] application de ${nom} (${statements.length} instruction(s))…`);
  for (const statement of statements) {
    await sql.query(statement);
  }
  await sql`insert into _migrations_applied (name) values (${nom}) on conflict do nothing`;
}
console.log(`[migrations] ${enAttente.length} migration(s) appliquée(s).`);
