// Script ponctuel : après la copie de données avec IDs explicites vers Neon,
// les séquences des colonnes `serial` n'avancent pas automatiquement. Sans ce
// correctif, la prochaine insertion (nouvelle commande, nouvelle session...)
// risquerait d'entrer en collision avec un ID déjà copié.
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const envPath = path.join(import.meta.dirname, "..", ".env");
for (const ligne of fs.readFileSync(envPath, "utf8").split("\n")) {
  const m = ligne.match(/^([A-Z_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const sql = neon(process.env.NEON_DATABASE_URL);

async function main() {
  const tables = await sql`
    select table_name from information_schema.tables
    where table_schema = 'public' and table_type = 'BASE TABLE'
  `;
  for (const { table_name } of tables) {
    const cols = await sql`
      select column_name from information_schema.columns
      where table_schema = 'public' and table_name = ${table_name} and column_name = 'id'
    `;
    if (cols.length === 0) continue;

    const [{ maxid }] = await sql.query(`select max(id) as maxid from "${table_name}"`);
    const seq = await sql.query(`select pg_get_serial_sequence($1, 'id') as seq`, [table_name]);
    const seqName = seq[0]?.seq;
    if (!seqName) continue;

    if (maxid === null) {
      await sql.query(`select setval($1, 1, false)`, [seqName]);
      console.log(`${table_name}: pas de ligne, séquence remise à 1 (prochaine insertion = 1)`);
    } else {
      await sql.query(`select setval($1, $2)`, [seqName, maxid]);
      console.log(`${table_name}: séquence positionnée après ${maxid}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
