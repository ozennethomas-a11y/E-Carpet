#!/usr/bin/env node
/**
 * Génère le secret TOTP (double authentification) de l'admin, en local.
 *
 *   node scripts/generate-admin-totp.mjs
 *
 * Rien n'est écrit sur disque ni envoyé où que ce soit : le secret et son QR
 * code s'affichent une seule fois dans ce terminal (le QR code est dessiné en
 * ASCII, généré localement par la librairie open source `qrcode`, jamais via
 * un service en ligne). Scannez-le avec Google Authenticator (ou tout autre
 * app TOTP gratuite), puis recopiez le secret dans Netlify → Site
 * configuration → Environment variables sous le nom ADMIN_TOTP_SECRET.
 */

import QRCode from "qrcode";
import { generateSecret, otpauthUri } from "../netlify/functions/_totp.mjs";

const secret = generateSecret();
const uri = otpauthUri(secret, { issuer: "E-Carpet Admin", account: "admin" });

console.log("\nScannez ce QR code avec Google Authenticator (ou une autre app TOTP) :\n");
console.log(await QRCode.toString(uri, { type: "terminal", small: true }));

console.log("Si le scan ne marche pas (petit écran, terminal qui déforme les carrés),");
console.log("saisissez la clé à la main via « Saisir une clé de configuration » :\n");
console.log(`  ${secret}\n`);
console.log("Variable Netlify à créer :\n");
console.log(`  ADMIN_TOTP_SECRET=${secret}\n`);
console.log("Ce secret ne sera plus jamais affiché — notez-le avant de fermer ce terminal.\n");
