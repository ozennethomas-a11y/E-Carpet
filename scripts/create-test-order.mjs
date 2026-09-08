// Crée (ou recrée) une commande de test aux coordonnées de Thomas, dans la
// base pointée par NEON_DATABASE_URL — donc la branche de développement.
//
// Raison d'être : les tests locaux touchaient jusqu'ici de vraies commandes de
// vrais clients, la base de dev étant un clone de la production. Le 08/09/2026,
// un test du cron "demande d'avis" a ainsi envoyé un email à un client réel.
// Le garde-fou de lib/_env.mjs empêche désormais tout envoi depuis un
// environnement de test ; cette commande dédiée ajoute une seconde protection :
// même si un envoi passait, il arriverait chez le propriétaire.
//
// Usage : node --env-file=.env scripts/create-test-order.mjs
import fs from "node:fs";
import path from "node:path";
import { neon } from "@neondatabase/serverless";

const envPath = path.join(import.meta.dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const ligne of fs.readFileSync(envPath, "utf8").split("\n")) {
    const m = ligne.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const EMAIL = "ozenne.thomas@orange.fr";
const ORDER_NUMBER = 999001; // hors de la plage des vrais numéros

const sql = neon(process.env.NEON_DATABASE_URL);

// Garde-fou : ce script ne doit jamais tourner sur la production.
if (process.env.CONTEXT === "production") {
  console.error("Refus : ce script est réservé aux bases de développement.");
  process.exit(1);
}

const [produit] = await sql`select id, name, price_cents from products order by id limit 1`;
if (!produit) {
  console.error("Aucun produit en base, impossible de créer la commande de test.");
  process.exit(1);
}

// Client de test
let [client] = await sql`select id from customers where email = ${EMAIL}`;
if (!client) {
  [client] = await sql`
    insert into customers (email, first_name, last_name, phone)
    values (${EMAIL}, 'Thomas', 'Ozenne', '+33683546012')
    returning id
  `;
}

// On repart de zéro à chaque exécution, pour retrouver un état connu.
const anciennes = await sql`select id from orders where order_number = ${ORDER_NUMBER}`;
for (const o of anciennes) {
  await sql`delete from order_items where order_id = ${o.id}`;
  await sql`delete from orders where id = ${o.id}`;
}

const adresse = {
  firstName: "Thomas",
  lastName: "Ozenne",
  line1: "5 cour moderne",
  line2: "49 rue de Trévise",
  postalCode: "59000",
  city: "Lille",
  country: "FR",
  phone: "+33683546012",
  deliveryMode: "domicile",
};

// Expédiée il y a 8 jours : la commande est donc éligible à la relance "avis"
// (J+7), ce qui en fait le cas de test idéal pour ce cron.
const [commande] = await sql`
  insert into orders (order_number, customer_id, email, status, total_cents, shipping_address,
                      tracking_carrier, tracking_number, shipped_at, created_at)
  values (${ORDER_NUMBER}, ${client.id}, ${EMAIL}, 'expediee', ${produit.price_cents + 699},
          ${JSON.stringify(adresse)}::jsonb, 'Test', 'TEST-0001',
          now() - interval '8 days', now() - interval '10 days')
  returning id
`;

await sql`
  insert into order_items (order_id, product_id, name, unit_price_cents, quantity)
  values (${commande.id}, ${produit.id}, ${produit.name}, ${produit.price_cents}, 1)
`;

console.log(`Commande de test n°${ORDER_NUMBER} créée pour ${EMAIL} (expédiée il y a 8 jours).`);
console.log("Elle est éligible à la relance « demande d'avis » : idéale pour tester ce cron.");
