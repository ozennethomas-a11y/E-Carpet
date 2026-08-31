// Script ponctuel de migration : applique le schéma (migrations Drizzle) sur
// la nouvelle base Neon, puis copie toutes les données depuis la production
// Netlify DB. Usage : node scripts/migrate-to-neon.mjs
// Nécessite NEON_DATABASE_URL (.env) et PROD_DATABASE_URL (passé en argument
// ou variable d'env temporaire — jamais commité).
import fs from "node:fs";
import path from "node:path";
import pg from "pg";

// Pas de dépendance dotenv pour ce script ponctuel : lecture manuelle du .env.
const envPath = path.join(import.meta.dirname, "..", ".env");
for (const ligne of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = ligne.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const NEON_URL = process.env.NEON_DATABASE_URL;
const PROD_URL = process.env.PROD_DATABASE_URL;

if (!NEON_URL) throw new Error("NEON_DATABASE_URL manquant dans .env");
if (!PROD_URL) throw new Error("PROD_DATABASE_URL manquant (variable d'environnement temporaire)");

const MIGRATIONS_DIR = path.join(import.meta.dirname, "..", "netlify", "database", "migrations");

async function appliquerSchema(client) {
  const dossiers = fs.readdirSync(MIGRATIONS_DIR).filter((d) => fs.statSync(path.join(MIGRATIONS_DIR, d)).isDirectory()).sort();
  for (const dossier of dossiers) {
    const sqlPath = path.join(MIGRATIONS_DIR, dossier, "migration.sql");
    if (!fs.existsSync(sqlPath)) continue;
    const sql = fs.readFileSync(sqlPath, "utf8");
    console.log(`→ migration ${dossier}`);
    await client.query(sql);
  }
}

// Trie les tables pour que toute table référencée par une clé étrangère soit
// copiée avant celle qui la référence (Neon n'autorise pas de désactiver les
// contraintes via session_replication_role, contrairement à un compte admin
// Postgres classique).
async function listerTablesOrdreDependances(client) {
  const { rows: toutes } = await client.query(`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
    order by table_name
  `);
  const { rows: deps } = await client.query(`
    select tc.table_name as dependante, ccu.table_name as referencee
    from information_schema.table_constraints tc
    join information_schema.constraint_column_usage ccu on tc.constraint_name = ccu.constraint_name
    where tc.constraint_type = 'FOREIGN KEY' and tc.table_name <> ccu.table_name
  `);

  const restantes = new Set(toutes.map((r) => r.table_name));
  const ordre = [];
  while (restantes.size > 0) {
    const prete = [...restantes].find(
      (t) => !deps.some((d) => d.dependante === t && restantes.has(d.referencee)),
    );
    if (!prete) {
      // Cycle (rare) : on prend ce qui reste, l'ordre exact n'a alors plus
      // d'importance pour ce sous-ensemble.
      ordre.push(...restantes);
      break;
    }
    ordre.push(prete);
    restantes.delete(prete);
  }
  return ordre;
}

async function copierDonnees(source, cible) {
  const tables = await listerTablesOrdreDependances(source);
  // Vide la cible avant de copier, pour que le script soit rejouable en cas
  // d'échec en cours de route sans provoquer d'erreurs de clé dupliquée.
  for (const table of [...tables].reverse()) {
    await cible.query(`truncate table "${table}" cascade`);
  }
  for (const table of tables) {
    const { rows } = await source.query(`select * from "${table}"`);
    if (rows.length === 0) {
      console.log(`  ${table}: 0 ligne`);
      continue;
    }
    const colonnes = Object.keys(rows[0]);
    const colsSql = colonnes.map((c) => `"${c}"`).join(", ");
    for (const row of rows) {
      // Les colonnes json/jsonb reviennent déjà parsées en objet JS depuis
      // `pg` : il faut les re-sérialiser explicitement pour l'insertion,
      // sinon le driver produit un JSON mal formé pour certaines valeurs.
      const valeurs = colonnes.map((c) => {
        const v = row[c];
        if (v !== null && typeof v === "object" && !(v instanceof Date)) return JSON.stringify(v);
        return v;
      });
      const placeholders = colonnes.map((_, i) => `$${i + 1}`).join(", ");
      await cible.query(`insert into "${table}" (${colsSql}) values (${placeholders})`, valeurs);
    }
    console.log(`  ${table}: ${rows.length} lignes copiées`);
  }
}

async function main() {
  const source = new pg.Client({ connectionString: PROD_URL });
  const cible = new pg.Client({ connectionString: NEON_URL });
  await source.connect();
  await cible.connect();

  if (!process.env.SKIP_SCHEMA) {
    console.log("Application du schéma sur Neon...");
    await appliquerSchema(cible);
  }

  console.log("Copie des données...");
  await copierDonnees(source, cible);

  console.log("Terminé.");
  await source.end();
  await cible.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
