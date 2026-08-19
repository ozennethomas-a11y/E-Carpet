// TOTP (RFC 6238) sans dépendance externe, compatible Google Authenticator.
// HMAC-SHA1 via l'API Web Crypto native (disponible dans les Netlify Functions),
// encodage base32 fait à la main (RFC 4648).

import { constantTimeEqual } from "./_crypto.mjs";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes) {
  let bits = "";
  for (const b of bytes) bits += b.toString(2).padStart(8, "0");
  let out = "";
  for (let i = 0; i < bits.length; i += 5) {
    const chunk = bits.slice(i, i + 5).padEnd(5, "0");
    out += BASE32_ALPHABET[parseInt(chunk, 2)];
  }
  return out;
}

export function base32Decode(str) {
  const clean = str.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = "";
  for (const c of clean) bits += BASE32_ALPHABET.indexOf(c).toString(2).padStart(5, "0");
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(bytes);
}

export function generateSecret(byteLength = 20) {
  const bytes = crypto.getRandomValues(new Uint8Array(byteLength));
  return base32Encode(bytes);
}

export function otpauthUri(secretBase32, { issuer, account }) {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({ secret: secretBase32, issuer, algorithm: "SHA1", digits: "6", period: "30" });
  return `otpauth://totp/${label}?${params.toString()}`;
}

async function hotp(secretBytes, counter) {
  const counterBytes = new Uint8Array(8);
  let c = BigInt(counter);
  for (let i = 7; i >= 0; i--) {
    counterBytes[i] = Number(c & 0xffn);
    c >>= 8n;
  }

  const key = await crypto.subtle.importKey("raw", secretBytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", key, counterBytes));

  const offset = sig[sig.length - 1] & 0x0f;
  const binCode =
    ((sig[offset] & 0x7f) << 24) | ((sig[offset + 1] & 0xff) << 16) | ((sig[offset + 2] & 0xff) << 8) | (sig[offset + 3] & 0xff);

  return String(binCode % 1_000_000).padStart(6, "0");
}

// window: nombre de pas de 30s tolérés avant/après l'heure courante, pour
// absorber un léger décalage d'horloge entre le téléphone et le serveur.
export async function verifyTotp(secretBase32, code, { window = 1, step = 30, at = Date.now() } = {}) {
  if (!/^\d{6}$/.test(String(code || ""))) return false;
  const secretBytes = base32Decode(secretBase32);
  const counter = Math.floor(at / 1000 / step);

  for (let delta = -window; delta <= window; delta++) {
    const expected = await hotp(secretBytes, counter + delta);
    if (await constantTimeEqual(expected, code)) return true;
  }
  return false;
}
