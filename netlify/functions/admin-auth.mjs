import {
  adminSessionCookieHeader,
  createAdminSession,
  getAdminSessionFromRequest,
  destroyAdminSession,
  checkLoginLock,
  recordLoginFailure,
  resetLoginAttempts,
  findAdminByName,
  recordLoginHistory,
  countAdmins,
  createAdmin,
  listAdmins,
} from "./lib/_adminAuth.mjs";
import { verifyTotp, generateSecret, otpauthUri } from "./lib/_totp.mjs";
import { constantTimeEqual, hashPassword, verifyPassword } from "./lib/_crypto.mjs";
import { sql } from "./lib/_db.mjs";
import { synchroniserAmazon } from "./stock.mjs";

// Amorçage : tant qu'aucun compte n'existe en base, le tout premier login
// avec les anciennes variables DASHBOARD_PASSWORD/ADMIN_TOTP_SECRET (déjà en
// place, jamais dans le dépôt git) crée automatiquement le compte
// propriétaire "Thomas" — mot de passe et code identiques à avant, aucun
// changement pour lui, et rien de secret n'est jamais écrit dans une migration.
async function bootstrapOwnerIfNeeded(name, password, totp) {
  if ((await countAdmins()) > 0) return null;
  const legacyPassword = process.env.DASHBOARD_PASSWORD;
  const legacyTotpSecret = process.env.ADMIN_TOTP_SECRET;
  if (!legacyPassword || !legacyTotpSecret) return null;
  if (!(await constantTimeEqual(password || "", legacyPassword))) return null;
  if (!(await verifyTotp(legacyTotpSecret, totp))) return null;

  const passwordHash = await hashPassword(legacyPassword);
  return createAdmin({ name: name || "Thomas", passwordHash, totpSecret: legacyTotpSecret, isOwner: true });
}

export default async (req, context) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  if (req.method === "POST" && action === "login") {
    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "requête invalide" }, { status: 400 });
    }
    const name = (body.name || "").trim();

    const lock = await checkLoginLock(name);
    if (lock.locked) {
      return Response.json(
        { error: `trop de tentatives, réessayez dans ${Math.ceil(lock.retryAfterSeconds / 60)} min` },
        { status: 429 },
      );
    }

    let admin = name ? await findAdminByName(name) : null;
    let bootstrapped = false;
    if (!admin) {
      admin = await bootstrapOwnerIfNeeded(name, body.password, body.totp).catch(() => null);
      bootstrapped = !!admin;
    }

    if (!admin) {
      await recordLoginFailure(name);
      return Response.json({ error: "nom ou mot de passe incorrect" }, { status: 401 });
    }

    // Amorçage : mot de passe et TOTP déjà vérifiés dans bootstrapOwnerIfNeeded
    // (contre les anciennes variables d'environnement), pas besoin de refaire
    // les deux contrôles ci-dessous.
    if (!bootstrapped) {
      if (!(await verifyPassword(body.password || "", admin.passwordHash))) {
        await recordLoginFailure(name);
        return Response.json({ error: "nom ou mot de passe incorrect" }, { status: 401 });
      }
      if (!(await verifyTotp(admin.totpSecret, body.totp))) {
        await recordLoginFailure(name);
        return Response.json({ error: "code de vérification incorrect" }, { status: 401 });
      }
    }

    await resetLoginAttempts(name);
    const token = await createAdminSession(admin.id);
    await recordLoginHistory(admin.id, req).catch((e) => console.error("[admin-auth] échec journal connexion:", e.message));

    // Synchronise le stock avec les ventes Amazon à chaque connexion (en plus
    // du cron toutes les 4h) : se fait en arrière-plan après la réponse, pour
    // ne pas ralentir la connexion — un admin voit ainsi des données à jour
    // sans avoir à cliquer "Synchroniser" manuellement.
    context.waitUntil(
      synchroniserAmazon().catch((e) => console.error("[admin-auth] échec synchro stock Amazon:", e.message)),
    );

    return Response.json({ ok: true }, { headers: { "Set-Cookie": adminSessionCookieHeader(token) } });
  }

  if (req.method === "POST" && action === "logout") {
    await destroyAdminSession(req);
    return Response.json({ ok: true }, { headers: { "Set-Cookie": adminSessionCookieHeader(null, { clear: true }) } });
  }

  if (req.method === "GET" && action === "me") {
    const admin = await getAdminSessionFromRequest(req);
    return Response.json({ connecte: !!admin, name: admin?.name, isOwner: !!admin?.isOwner });
  }

  // Historique des connexions : réservé au propriétaire, pour voir qui s'est
  // connecté au back-office et quand.
  if (req.method === "GET" && action === "history") {
    const admin = await getAdminSessionFromRequest(req);
    if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (!admin.isOwner) return Response.json({ error: "unauthorized" }, { status: 403 });

    const rows = await sql()`
      select h.id, h.ip, h.user_agent as "userAgent", h.created_at as "createdAt", a.name
      from admin_login_history h join admins a on a.id = h.admin_id
      order by h.created_at desc
      limit 200
    `;
    return Response.json({ history: rows });
  }

  // Liste des comptes existants : réservé au propriétaire.
  if (req.method === "GET" && action === "admins") {
    const admin = await getAdminSessionFromRequest(req);
    if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (!admin.isOwner) return Response.json({ error: "unauthorized" }, { status: 403 });
    return Response.json({ admins: await listAdmins() });
  }

  // Créer un nouvel accès (ex. Maria) : réservé au propriétaire. Le mot de
  // passe et le code TOTP sont générés côté serveur et renvoyés une seule
  // fois dans la réponse — jamais stockés en clair, jamais dans le dépôt.
  if (req.method === "POST" && action === "create-admin") {
    const owner = await getAdminSessionFromRequest(req);
    if (!owner) return Response.json({ error: "unauthorized" }, { status: 401 });
    if (!owner.isOwner) return Response.json({ error: "unauthorized" }, { status: 403 });

    let body;
    try {
      body = await req.json();
    } catch {
      return Response.json({ error: "requête invalide" }, { status: 400 });
    }
    const name = (body.name || "").trim();
    if (!name) return Response.json({ error: "nom manquant" }, { status: 400 });
    if (await findAdminByName(name)) return Response.json({ error: "ce nom existe déjà" }, { status: 409 });

    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const password = [...crypto.getRandomValues(new Uint8Array(14))].map((b) => alphabet[b % alphabet.length]).join("");
    const totpSecret = generateSecret();
    const passwordHash = await hashPassword(password);

    const created = await createAdmin({ name, passwordHash, totpSecret, isOwner: false });
    return Response.json({
      admin: created,
      password,
      totpSecret,
      otpauthUri: otpauthUri(totpSecret, { issuer: "E-Carpet Admin", account: name }),
    });
  }

  return Response.json({ error: "action inconnue" }, { status: 400 });
};

export const config = { path: "/api/admin-auth" };
