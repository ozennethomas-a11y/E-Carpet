#!/usr/bin/env node
/**
 * Obtenir un refresh token Google Ads, en local, sans que le secret sorte de ce Mac.
 *
 *   node scripts/google-ads-token.mjs
 *
 * Le script demande le Client ID et le Client Secret de votre client OAuth
 * "Application de bureau", ouvre la page d'autorisation Google, puis récupère
 * le code de retour sur http://localhost:8975 et l'échange contre un refresh token.
 *
 * Rien n'est écrit sur disque : les valeurs s'affichent une fois, à recopier
 * directement dans Netlify → Site configuration → Environment variables.
 */

import { createServer } from "node:http";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { spawn } from "node:child_process";

const PORT = 8975;
const REDIRECT = `http://localhost:${PORT}`;
const SCOPE = "https://www.googleapis.com/auth/adwords";

const rl = createInterface({ input: stdin, output: stdout });
const clientId = (await rl.question("Client ID     : ")).trim();
const clientSecret = (await rl.question("Client Secret : ")).trim();
rl.close();

if (!clientId || !clientSecret) {
  console.error("\nLes deux valeurs sont obligatoires. Relancez le script.");
  process.exit(1);
}

const authUrl =
  "https://accounts.google.com/o/oauth2/v2/auth" +
  `?client_id=${encodeURIComponent(clientId)}` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}` +
  `&response_type=code&scope=${encodeURIComponent(SCOPE)}` +
  "&access_type=offline&prompt=consent";

// On attend le retour de Google sur un petit serveur local.
const code = await new Promise((resolve, reject) => {
  const server = createServer((req, res) => {
    const url = new URL(req.url, REDIRECT);
    const received = url.searchParams.get("code");
    const error = url.searchParams.get("error");
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(
      `<body style="font-family:system-ui;background:#0a0a0b;color:#fff;display:grid;place-items:center;height:100vh;margin:0">
         <p>${received ? "C'est bon. Revenez dans le terminal." : "Autorisation refusée."}</p>
       </body>`,
    );
    server.close();
    received ? resolve(received) : reject(new Error(error || "aucun code reçu"));
  });
  server.listen(PORT, () => {
    console.log("\nOuverture de la page d'autorisation Google…");
    console.log(`Si rien ne s'ouvre, collez ceci dans votre navigateur :\n\n${authUrl}\n`);
    spawn("open", [authUrl], { stdio: "ignore" }).on("error", () => {});
  });
});

const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT,
    grant_type: "authorization_code",
  }),
});

const json = await res.json();
if (!res.ok || !json.refresh_token) {
  console.error("\nÉchec de l'échange :", JSON.stringify(json, null, 2));
  console.error(
    "\nSi refresh_token est absent, révoquez l'accès sur https://myaccount.google.com/permissions puis relancez.",
  );
  process.exit(1);
}

console.log("\n────────────────────────────────────────────");
console.log("À recopier dans Netlify → Environment variables :\n");
console.log("GOOGLE_ADS_CLIENT_ID");
console.log(clientId);
console.log("\nGOOGLE_ADS_CLIENT_SECRET");
console.log(clientSecret);
console.log("\nGOOGLE_ADS_REFRESH_TOKEN");
console.log(json.refresh_token);
console.log("\n────────────────────────────────────────────");
console.log("Ce token n'expire pas. Ne le partagez avec personne.");
