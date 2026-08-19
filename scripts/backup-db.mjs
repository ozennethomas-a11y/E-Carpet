#!/usr/bin/env node
/**
 * Sauvegarde mensuelle locale de la base (toutes les tables, en JSON), sur ce
 * Mac uniquement — indépendante de Netlify/Neon, pour couvrir le cas d'un
 * compte suspendu/supprimé par erreur, en plus du point-in-time recovery déjà
 * fourni par Neon.
 *
 * Ne fait rien si le dernier backup a moins de 30 jours (appelé à chaque
 * connexion via un LaunchAgent, voir scripts/install-backup-schedule.sh).
 * Ne garde que les 2 derniers backups mensuels — le plus ancien est supprimé
 * à chaque nouvelle sauvegarde, pour ne jamais accumuler d'espace disque.
 *
 *   node scripts/backup-db.mjs           (respecte le délai de 30 jours)
 *   node scripts/backup-db.mjs --force   (sauvegarde immédiatement)
 */

import { execFileSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";

const BACKUP_DIR = path.join(homedir(), "E-Carpet-Backups");
const MAX_BACKUPS = 2;
const MIN_INTERVAL_DAYS = 30;
const FORCE = process.argv.includes("--force");

function dernierBackup() {
  if (!existsSync(BACKUP_DIR)) return null;
  const dossiers = readdirSync(BACKUP_DIR).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d));
  if (!dossiers.length) return null;
  dossiers.sort();
  return dossiers[dossiers.length - 1];
}

const dernier = dernierBackup();
if (!FORCE && dernier) {
  const joursEcoules = (Date.now() - new Date(dernier).getTime()) / (1000 * 60 * 60 * 24);
  if (joursEcoules < MIN_INTERVAL_DAYS) {
    console.log(`[backup] dernier backup il y a ${Math.floor(joursEcoules)} jour(s), pas encore ${MIN_INTERVAL_DAYS} — rien à faire.`);
    process.exit(0);
  }
}

const dateDuJour = new Date().toISOString().slice(0, 10);
const dossierCible = path.join(BACKUP_DIR, dateDuJour);
mkdirSync(dossierCible, { recursive: true });

function requete(sql) {
  const out = execFileSync("npx", ["netlify", "database", "connect", "--json", "--query", sql], {
    cwd: new URL("..", import.meta.url).pathname,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200,
  });
  return JSON.parse(out);
}

console.log(`[backup] sauvegarde en cours vers ${dossierCible}`);

const tables = requete(
  "select table_name from information_schema.tables where table_schema='public' order by table_name",
).map((r) => r.table_name);

for (const table of tables) {
  const lignes = requete(`select * from ${table}`);
  writeFileSync(path.join(dossierCible, `${table}.json`), JSON.stringify(lignes, null, 2));
  console.log(`[backup]   ${table} : ${lignes.length} ligne(s)`);
}

// Ménage : ne garde que les MAX_BACKUPS dossiers les plus récents.
const tous = readdirSync(BACKUP_DIR)
  .filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d))
  .sort();
for (const ancien of tous.slice(0, Math.max(0, tous.length - MAX_BACKUPS))) {
  rmSync(path.join(BACKUP_DIR, ancien), { recursive: true, force: true });
  console.log(`[backup] ancien backup supprimé : ${ancien}`);
}

console.log(`[backup] terminé — ${tables.length} table(s) sauvegardée(s) dans ${dossierCible}`);
