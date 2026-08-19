import { sql } from "./_db.mjs";

export async function findOrCreateCustomer(email) {
  const normalized = email.trim().toLowerCase();
  const [existing] = await sql()`select id, email, first_name, last_name from customers where email = ${normalized}`;
  if (existing) return existing;
  const [created] = await sql()`
    insert into customers (email) values (${normalized})
    on conflict (email) do update set email = excluded.email
    returning id, email, first_name, last_name
  `;
  return created;
}
