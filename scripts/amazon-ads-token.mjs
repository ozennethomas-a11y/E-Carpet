#!/usr/bin/env node
/**
 * Obtenir un refresh token Amazon Ads, en local, sans que le secret sorte de ce Mac.
 *
 *   node scripts/amazon-ads-token.mjs
 *
 * Contrairement à la SP-API, Amazon Ads exige un vrai consentement via
 * navigateur (flux "authorization code"), pas une simple auto-autorisation.
 * Ce script ouvre la page Amazon, récupère le code de retour sur
 * http://localhost:8976, et l'échange contre un refresh token.
 *
 * Rien n'est écrit sur disque : les valeurs s'affichent une fois, à recopier
 * directement dans Netlify → Site configuration → Environment variables.
 */

import { createServer } from "node:http";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { spawn } from "node:child_process";

const PORT = 8976;
const REDIRECT = `http://localhost:${PORT}`;
const SCOPE = "advertising::campaign_management";

let clientId = process.env.AMAZON_ADS_CLIENT_ID_INPUT;
let clientSecret = process.env.AMAZON_ADS_CLIENT_SECRET_INPUT;

if (!clientId || !clientSecret) {
  const rl = createInterface({ input: stdin, output: stdout });
  clientId = (await rl.question("Client ID     : ")).trim();
  clientSecret = (await rl.question("Client Secret : ")).trim();
  rl.close();
}

if (!clientId || !clientSecret) {
  console.error("\nLes deux valeurs sont obligatoires. Relancez le script.");
  process.exit(1);
}

const authUrl =
  "https://www.amazon.com/ap/oa" +
  `?client_id=${encodeURIComponent(clientId)}` +
  `&scope=${encodeURIComponent(SCOPE)}` +
  `&response_type=code` +
  `&redirect_uri=${encodeURIComponent(REDIRECT)}`;

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
    console.log("\nOuverture de la page d'autorisation Amazon Ads…");
    console.log(`Si rien ne s'ouvre, collez ceci dans votre navigateur :\n\n${authUrl}\n`);
    spawn("open", [authUrl], { stdio: "ignore" }).on("error", () => {});
  });
});

const res = await fetch("https://api.amazon.com/auth/o2/token", {
  method: "POST",
  headers: { "content-type": "application/x-www-form-urlencoded" },
  body: new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: REDIRECT,
  }),
});

const json = await res.json();
if (!res.ok || !json.refresh_token) {
  console.error("\nÉchec de l'échange :", JSON.stringify(json, null, 2));
  process.exit(1);
}

console.log("\n────────────────────────────────────────────");
console.log("À recopier dans Netlify → Environment variables :\n");
console.log("AMAZON_ADS_CLIENT_ID");
console.log(clientId);
console.log("\nAMAZON_ADS_CLIENT_SECRET");
console.log(clientSecret);
console.log("\nAMAZON_ADS_REFRESH_TOKEN");
console.log(json.refresh_token);
console.log("\n────────────────────────────────────────────");
console.log("Il manquera ensuite AMAZON_ADS_PROFILE_ID : la fonction le trouve");
console.log("automatiquement une fois les trois valeurs ci-dessus en place.");
