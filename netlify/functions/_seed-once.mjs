import { sql } from "./lib/_db.mjs";

// Fonction temporaire, ponctuelle : recopie en production les 13
// influenceurs déjà reçus, enregistrés fin août sur la branche de test
// (Neon dev) mais jamais recopiés vers la vraie base de production. À
// supprimer juste après usage.
const SECRET = "9b4f1e6c2a8d0731fbc5e924d61a08f7";

const INFLUENCEURS = [
  { name: "sftherider", platform: "Instagram/TikTok", followers: "21,1k", contact: "sfrider.officiel@gmail.com", offer: "-50%", status: "termine", publication: "Publié x2 (insta+tiktok)", on_site: true, next_action: "Proposer le programme d'affiliation" },
  { name: "ThomasOBad", platform: "TikTok", followers: "343k", contact: "thomasobadpro@gmail.com", offer: "Concours", status: "termine", publication: "Publié (prévu 9-15/02)", on_site: true, next_action: "Vérifier si la vidéo concours est sortie, proposer affiliation" },
  { name: "Simon Smith (geek_simon6)", platform: "TikTok/Insta/FB/YouTube", followers: "106k", contact: "simonsmith.influencer@gmail.com", offer: "Gratuit", status: "termine", publication: "Publié (co-autorship demandé)", on_site: true, next_action: "Vérifier la co-signature promise, proposer affiliation" },
  { name: "HK Trott", platform: "TikTok", followers: "24,9k", contact: "", offer: "Gratuit", status: "termine", publication: "Publié le 12/02", on_site: true, next_action: "Proposer affiliation" },
  { name: "elektryczne.duo", platform: "TikTok", followers: "2k", contact: "elektryczneduo@gmail.com", offer: "Gratuit", status: "termine", publication: "1ère publication faite, 2e en cours", on_site: false, next_action: "Relancer pour la 2e publication + proposer affiliation" },
  { name: "Medhi (mehdi.trot.sl13)", platform: "TikTok", followers: "29,3k", contact: "", offer: "Gratuit", status: "termine", publication: "Publié", on_site: false, next_action: "Ajouter en preuve sociale sur le site + proposer affiliation" },
  { name: "my_egret", platform: "Instagram", followers: "11k", contact: "marketing@my-egret.com", offer: "Concours", status: "termine", publication: "Publié le 31/01", on_site: false, next_action: "Ajouter en preuve sociale + proposer affiliation" },
  { name: "ehaltig (Nicolas)", platform: "TikTok", followers: "42k", contact: "", offer: "Gratuit", status: "termine", publication: "2 vidéos publiées, d'autres à venir", on_site: false, next_action: "Ajouter en preuve sociale, suivre les prochaines vidéos" },
  { name: "gooseman775", platform: "TikTok", followers: "2,4k", contact: "", offer: "-50%", status: "termine", publication: "Publié le 10/02", on_site: false, next_action: "Proposer affiliation" },
  { name: "kugoo012", platform: "TikTok", followers: "660", contact: "", offer: "-50%", status: "termine", publication: "Publié plusieurs fois", on_site: false, next_action: "Petite audience mais engagé — proposer affiliation" },
  { name: "el3ctricworld", platform: "Email", followers: "118k", contact: "fredo63@wanadoo.fr", offer: "Gratuit", status: "en_cours", publication: "En attente de publication", on_site: false, next_action: "Relancer — envoyé il y a plus d'un mois sans nouvelle" },
  { name: "TrottX", platform: "TikTok", followers: "1,6k", contact: "", offer: "-50%", status: "en_cours", publication: "En attente (relance prévue 24/02)", on_site: false, next_action: "Relancer selon la date prévue" },
  { name: "doudzi83", platform: "Instagram", followers: "52k", contact: "doudzi.pro@hotmail.com", offer: null, status: "termine", publication: "Déjà utilisé en preuve sociale sur le site (post Instagram réel)", on_site: true, next_action: "Proposer affiliation, comme les autres" },
];

export default async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("key") !== SECRET) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const [{ count }] = await sql()`select count(*)::int as count from influencer_contacts`;
  if (count > 0) {
    return Response.json({ error: `la table contient déjà ${count} ligne(s), abandon pour éviter les doublons` }, { status: 409 });
  }

  let inserted = 0;
  for (const i of INFLUENCEURS) {
    await sql()`
      insert into influencer_contacts (name, platform, followers, contact, offer, status, publication, on_site, next_action)
      values (${i.name}, ${i.platform}, ${i.followers}, ${i.contact}, ${i.offer}, ${i.status}, ${i.publication}, ${i.on_site}, ${i.next_action})
    `;
    inserted++;
  }
  return Response.json({ ok: true, inserted });
};

export const config = { path: "/api/_seed-once" };
