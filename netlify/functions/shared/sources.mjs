// Shared between track.mjs and links.mjs so a saved link and a recorded visit
// always produce the exact same label — otherwise the dashboard would show two
// separate rows for the same campaign.
// (Subdirectory files are not deployed as functions by Netlify, only imported.)

export const SOURCE_NAMES = {
  tiktok: "TikTok",
  instagram: "Instagram",
  insta: "Instagram",
  ig: "Instagram",
  facebook: "Facebook",
  fb: "Facebook",
  youtube: "YouTube",
  snapchat: "Snapchat",
  pinterest: "Pinterest",
  amazon: "Amazon",
  google: "Google",
  linkedin: "LinkedIn",
  x: "X",
  twitter: "X",
  email: "E-mail",
  qrcode: "QR code",
  colis: "Colis",
  flyer: "Flyer",
};

export function prettySource(raw) {
  if (!raw) return "";
  const k = String(raw).toLowerCase();
  return SOURCE_NAMES[k] || raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function campaignLabelOf(source, campaign) {
  if (!source) return "";
  return campaign ? `${prettySource(source)} · ${campaign}` : prettySource(source);
}

// Keep tags predictable: lowercase, no spaces or accents.
export function slug(raw) {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}
