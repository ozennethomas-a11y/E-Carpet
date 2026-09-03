import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from "@simplewebauthn/server";
import { randomToken } from "./lib/_auth.mjs";
import {
  adminSessionCookieHeader,
  createAdminSession,
  getAdminSessionFromRequest,
  recordLoginHistory,
  deconnecterTousLesAppareils,
} from "./lib/_adminAuth.mjs";
import {
  rpID,
  expectedOrigin,
  sauverChallenge,
  lireEtConsommerChallenge,
  credentialsPourAdmin,
  enregistrerCredential,
  credentialParId,
  majCompteur,
  supprimerCredential,
  premierCredentialPourAdmin,
} from "./lib/_webauthn.mjs";
import { synchroniserAmazon } from "./stock.mjs";
import { notifierAlerteConnexion } from "./lib/_push.mjs";

export default async (req, context) => {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");

  // --- Activer Face ID sur cet appareil : réservé à un admin déjà connecté
  // (mot de passe + TOTP), pour ne pas permettre d'ajouter une clé sans
  // preuve d'identité préalable. ---
  if (req.method === "GET" && action === "register-options") {
    const admin = await getAdminSessionFromRequest(req);
    if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });

    const dejaEnregistrees = await credentialsPourAdmin(admin.id);
    const options = await generateRegistrationOptions({
      rpName: "E-Carpet Admin",
      rpID: rpID(),
      userName: admin.name,
      userDisplayName: admin.name,
      attestationType: "none",
      excludeCredentials: dejaEnregistrees.map((c) => ({ id: c.credentialId })),
      authenticatorSelection: { residentKey: "required", userVerification: "required", authenticatorAttachment: "platform" },
    });
    await sauverChallenge(`register:${admin.id}`, options.challenge);
    return Response.json({ options });
  }

  if (req.method === "POST" && action === "register-verify") {
    const admin = await getAdminSessionFromRequest(req);
    if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });

    const { response, deviceName } = await req.json().catch(() => ({}));
    const saved = await lireEtConsommerChallenge(`register:${admin.id}`);
    if (!saved) return Response.json({ error: "session d'enregistrement expirée, réessayez" }, { status: 400 });

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: saved.challenge,
        expectedOrigin: expectedOrigin(),
        expectedRPID: rpID(),
      });
    } catch (e) {
      return Response.json({ error: e.message || "vérification échouée" }, { status: 400 });
    }
    if (!verification.verified) return Response.json({ error: "vérification échouée" }, { status: 400 });

    const { credential } = verification.registrationInfo;
    try {
      await enregistrerCredential(
        admin.id,
        { credentialID: credential.id, credentialPublicKey: credential.publicKey, counter: credential.counter },
        deviceName || "Cet appareil",
      );
    } catch (e) {
      return Response.json({ error: e.message || "échec de l'enregistrement" }, { status: 400 });
    }
    return Response.json({ ok: true });
  }

  if (req.method === "GET" && action === "list") {
    const admin = await getAdminSessionFromRequest(req);
    if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
    return Response.json({ credentials: await credentialsPourAdmin(admin.id) });
  }

  if (req.method === "POST" && action === "delete") {
    const admin = await getAdminSessionFromRequest(req);
    if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });
    const { id } = await req.json().catch(() => ({}));
    if (!id) return Response.json({ error: "id manquant" }, { status: 400 });
    await supprimerCredential(admin.id, id);
    return Response.json({ ok: true });
  }

  // --- Connexion par Face ID : pas de session préalable (c'est l'écran de
  // connexion). On ne sait pas encore qui se connecte — le navigateur
  // propose lui-même les clés disponibles pour ce site (clé "discoverable"),
  // et on retrouve l'admin via l'identifiant de la clé utilisée. ---
  if (req.method === "GET" && action === "login-options") {
    const options = await generateAuthenticationOptions({ rpID: rpID(), userVerification: "required" });
    const state = randomToken();
    await sauverChallenge(`login:${state}`, options.challenge);
    return Response.json({ options, state });
  }

  if (req.method === "POST" && action === "login-verify") {
    const { response, state } = await req.json().catch(() => ({}));
    if (!response || !state) return Response.json({ error: "requête invalide" }, { status: 400 });

    const saved = await lireEtConsommerChallenge(`login:${state}`);
    if (!saved) return Response.json({ error: "session de connexion expirée, réessayez" }, { status: 400 });

    const cred = await credentialParId(response.id);
    if (!cred) return Response.json({ error: "clé Face ID inconnue" }, { status: 401 });

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: saved.challenge,
        expectedOrigin: expectedOrigin(),
        expectedRPID: rpID(),
        credential: { id: cred.credentialId, publicKey: cred.publicKey, counter: cred.counter },
      });
    } catch (e) {
      return Response.json({ error: e.message || "vérification échouée" }, { status: 400 });
    }
    if (!verification.verified) return Response.json({ error: "vérification échouée" }, { status: 401 });

    await majCompteur(cred.id, verification.authenticationInfo.newCounter);
    const token = await createAdminSession(cred.adminId);
    await recordLoginHistory(cred.adminId, req).catch((e) => console.error("[webauthn] échec journal connexion:", e.message));

    const ipConnexion = req.headers.get("x-nf-client-connection-ip") || req.headers.get("x-forwarded-for") || "IP inconnue";
    context.waitUntil(
      notifierAlerteConnexion({
        title: "Connexion à l'admin E-Carpet",
        body: `${cred.name} vient de se connecter (Face ID, ${cred.deviceName || "appareil"}) depuis ${ipConnexion}.`,
      }).catch((e) => console.error("[webauthn] échec alerte connexion:", e.message)),
    );

    context.waitUntil(
      synchroniserAmazon().catch((e) => console.error("[webauthn] échec synchro stock Amazon:", e.message)),
    );
    return Response.json({ ok: true }, { headers: { "Set-Cookie": adminSessionCookieHeader(token) } });
  }

  // --- Déconnexion d'urgence de tous les appareils : action la plus
  // sensible du back-office (tout le monde est éjecté). Restreinte à une
  // preuve cryptographique en direct — pas juste "être connecté" — et
  // scopée à la toute première clé Face ID jamais enregistrée par cet
  // admin, pour qu'un seul appareil physique précis puisse la déclencher. ---
  if (req.method === "GET" && action === "logout-all-options") {
    const admin = await getAdminSessionFromRequest(req);
    if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });

    const premier = await premierCredentialPourAdmin(admin.id);
    if (!premier) {
      return Response.json(
        { error: "aucune clé Face ID enregistrée — cette action nécessite d'avoir activé Face ID sur au moins un appareil" },
        { status: 400 },
      );
    }

    const options = await generateAuthenticationOptions({
      rpID: rpID(),
      userVerification: "required",
      allowCredentials: [{ id: premier.credentialId }],
    });
    await sauverChallenge(`logout-all:${admin.id}`, options.challenge);
    return Response.json({ options });
  }

  if (req.method === "POST" && action === "logout-all-verify") {
    const admin = await getAdminSessionFromRequest(req);
    if (!admin) return Response.json({ error: "unauthorized" }, { status: 401 });

    const { response } = await req.json().catch(() => ({}));
    const saved = await lireEtConsommerChallenge(`logout-all:${admin.id}`);
    if (!saved) return Response.json({ error: "session expirée, réessayez" }, { status: 400 });

    const premier = await premierCredentialPourAdmin(admin.id);
    if (!premier || premier.credentialId !== response?.id) {
      return Response.json({ error: "seule la toute première clé Face ID enregistrée peut déclencher cette action" }, { status: 403 });
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: saved.challenge,
        expectedOrigin: expectedOrigin(),
        expectedRPID: rpID(),
        credential: { id: premier.credentialId, publicKey: premier.publicKey, counter: premier.counter },
      });
    } catch (e) {
      return Response.json({ error: e.message || "vérification échouée" }, { status: 400 });
    }
    if (!verification.verified) return Response.json({ error: "vérification échouée" }, { status: 401 });

    await majCompteur(premier.id, verification.authenticationInfo.newCounter);
    const nb = await deconnecterTousLesAppareils();
    return Response.json({ ok: true, nb }, { headers: { "Set-Cookie": adminSessionCookieHeader(null, { clear: true }) } });
  }

  return Response.json({ error: "action inconnue" }, { status: 400 });
};

export const config = { path: "/api/webauthn" };
