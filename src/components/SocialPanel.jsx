import { useEffect, useState, useCallback } from "react";
import { cachedFetch, invalidateCache } from "../lib/adminCache";
import InfluencersPanel from "./InfluencersPanel";

const RESEAUX = [
  { id: "facebook", label: "Facebook", couleur: "#1877F2" },
  { id: "instagram", label: "Instagram", couleur: "#E1306C" },
  { id: "tiktok", label: "TikTok", couleur: "#25F4EE" },
];

function formatDate(d) {
  return d ? new Date(d).toLocaleDateString("fr-FR") : "—";
}

function Bouton({ onClick, children, ton = "neutre", disabled }) {
  const styles = {
    principal: "bg-acid text-white",
    neutre: "border border-white/15 text-zinc-300 hover:text-white",
    danger: "border border-red-500/30 text-red-400 hover:bg-red-500/10",
  };
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-full px-4 py-1.5 font-display text-xs font-bold transition-colors cursor-pointer disabled:opacity-40 ${styles[ton]}`}
    >
      {children}
    </button>
  );
}

function connecter(reseau) {
  const action = reseau === "tiktok" ? "tiktok-start" : "meta-start";
  window.location.href = `/api/social-auth?action=${action}`;
}

function CarteReseau({ reseau, compte, onDeconnecter, occupe }) {
  const connecte = !!compte;
  return (
    <div className="rounded-xl border border-white/10 bg-ink p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full" style={{ background: reseau.couleur }} />
            <div className="font-display text-sm font-bold text-white">{reseau.label}</div>
          </div>
          {connecte ? (
            <div className="mt-0.5 text-xs text-zinc-500">
              Connecté à <strong className="text-zinc-300">{compte.accountName}</strong> · depuis le {formatDate(compte.connectedAt)}
            </div>
          ) : (
            <div className="mt-0.5 text-xs text-zinc-500">Non connecté</div>
          )}
        </div>
        {connecte ? (
          <Bouton ton="danger" disabled={occupe} onClick={() => onDeconnecter(reseau.id)}>
            Déconnecter
          </Bouton>
        ) : (
          <Bouton ton="principal" onClick={() => connecter(reseau.id)}>
            Connecter
          </Bouton>
        )}
      </div>
    </div>
  );
}

function fichierEnDataUrl(fichier) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(fichier);
  });
}

function Publier({ compteParReseau, onProgramme }) {
  const [caption, setCaption] = useState("");
  const [image, setImage] = useState(null); // { fichier, apercu }
  const [video, setVideo] = useState(null);
  const [selection, setSelection] = useState(new Set());
  const [envoi, setEnvoi] = useState(false);
  const [resultats, setResultats] = useState(null);
  const [erreur, setErreur] = useState("");
  const [programmerPour, setProgrammerPour] = useState(""); // vide = publication immédiate

  const connecteFacebookOuInstagram = compteParReseau.facebook || compteParReseau.instagram;
  const connecteTiktok = compteParReseau.tiktok;

  function basculer(id) {
    setSelection((s) => {
      const n = new Set(s);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }

  async function publier() {
    setErreur("");
    setResultats(null);
    if (!selection.size) return setErreur("Sélectionnez au moins un réseau.");
    if ((selection.has("facebook") || selection.has("instagram")) && !image) {
      return setErreur("Une image est requise pour Facebook/Instagram.");
    }
    if (selection.has("tiktok") && !video) {
      return setErreur("Une vidéo est requise pour TikTok.");
    }

    setEnvoi(true);
    try {
      let imageUrl = null;
      let videoUrl = null;

      if (image) {
        const dataUrl = await fichierEnDataUrl(image.fichier);
        const res = await fetch("/api/social-media", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        }).then((r) => r.json());
        if (res.error) throw new Error(res.error);
        imageUrl = res.url;
      }
      if (video) {
        const dataUrl = await fichierEnDataUrl(video.fichier);
        const res = await fetch("/api/social-media", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        }).then((r) => r.json());
        if (res.error) throw new Error(res.error);
        videoUrl = res.url;
      }

      if (programmerPour) {
        const res = await fetch("/api/social-schedule", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            caption,
            imageUrl,
            videoUrl,
            networks: [...selection],
            scheduledFor: new Date(programmerPour).toISOString(),
          }),
        }).then((r) => r.json());
        if (res.error) throw new Error(res.error);
        setCaption("");
        setImage(null);
        setVideo(null);
        setSelection(new Set());
        setProgrammerPour("");
        onProgramme?.();
        setResultats([{ network: "programmation", ok: true, note: "publication programmée avec succès" }]);
        return;
      }

      const res = await fetch("/api/social-publish", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caption, imageUrl, videoUrl, networks: [...selection] }),
      }).then((r) => r.json());
      if (res.error) throw new Error(res.error);
      setResultats(res.resultats);
    } catch (e) {
      setErreur(e.message || "Échec de la publication.");
    } finally {
      setEnvoi(false);
    }
  }

  if (!connecteFacebookOuInstagram && !connecteTiktok) {
    return (
      <div className="rounded-xl border border-white/10 bg-ink p-6 text-center">
        <p className="text-sm text-zinc-400">Connectez au moins un réseau (onglet "Général") avant de publier.</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-ink p-5">
      <div className="text-xs uppercase tracking-wider text-zinc-500">Légende</div>
      <textarea
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        rows={3}
        className="mt-2 w-full rounded-lg border border-white/15 bg-transparent p-3 text-sm text-white placeholder:text-zinc-500 focus:border-acid focus:outline-none"
        placeholder="Texte de la publication..."
      />

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Image (Facebook / Instagram)</div>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(e) => {
              const fichier = e.target.files?.[0];
              setImage(fichier ? { fichier, apercu: URL.createObjectURL(fichier) } : null);
            }}
            className="mt-2 block w-full text-xs text-zinc-400"
          />
          {image && <img src={image.apercu} alt="" className="mt-2 h-32 w-full rounded-lg object-cover" />}
        </div>
        <div>
          <div className="text-xs uppercase tracking-wider text-zinc-500">Vidéo (TikTok)</div>
          <input
            type="file"
            accept="video/mp4,video/quicktime"
            onChange={(e) => {
              const fichier = e.target.files?.[0];
              setVideo(fichier ? { fichier, apercu: URL.createObjectURL(fichier) } : null);
            }}
            className="mt-2 block w-full text-xs text-zinc-400"
          />
          {video && <video src={video.apercu} className="mt-2 h-32 w-full rounded-lg object-cover" controls />}
        </div>
      </div>

      <div className="mt-4 text-xs uppercase tracking-wider text-zinc-500">Publier sur</div>
      <div className="mt-2 flex flex-wrap gap-2">
        {RESEAUX.map((r) => {
          const connecte = !!compteParReseau[r.id];
          return (
            <button
              key={r.id}
              disabled={!connecte}
              onClick={() => basculer(r.id)}
              className={`rounded-full border px-4 py-1.5 font-display text-xs font-bold transition-colors disabled:opacity-30 ${
                selection.has(r.id) ? "border-acid bg-acid/10 text-acid" : "border-white/15 text-zinc-400 hover:text-white"
              }`}
            >
              {r.label}
              {!connecte && " (non connecté)"}
            </button>
          );
        })}
      </div>

      <div className="mt-4">
        <div className="text-xs uppercase tracking-wider text-zinc-500">Quand</div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <input
            type="datetime-local"
            value={programmerPour}
            min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
            onChange={(e) => setProgrammerPour(e.target.value)}
            className="rounded-lg border border-white/15 bg-transparent px-3 py-1.5 text-sm text-white focus:border-acid focus:outline-none"
          />
          {programmerPour && (
            <button onClick={() => setProgrammerPour("")} className="text-xs text-zinc-500 underline hover:text-white">
              annuler la programmation, publier maintenant
            </button>
          )}
        </div>
        <p className="mt-1 text-xs text-zinc-500">
          {programmerPour ? "La publication partira automatiquement à la date choisie." : "Laissez vide pour publier immédiatement."}
        </p>
      </div>

      {erreur && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{erreur}</p>}

      {resultats && (
        <div className="mt-4 space-y-2">
          {resultats.map((r) => (
            <p
              key={r.network}
              className={`rounded-xl border px-4 py-3 text-sm ${
                r.ok ? "border-acid/30 bg-acid/10 text-acid" : "border-red-400/30 bg-red-400/10 text-red-300"
              }`}
            >
              {r.network} : {r.ok ? "publié" + (r.note ? ` (${r.note})` : "") : `échec — ${r.error}`}
            </p>
          ))}
        </div>
      )}

      <div className="mt-5">
        <Bouton ton="principal" disabled={envoi} onClick={publier}>
          {envoi ? "Envoi..." : programmerPour ? "Programmer" : "Publier"}
        </Bouton>
      </div>
    </div>
  );
}

function statutLabel(statut) {
  if (statut === "published") return { texte: "publié", classe: "border-acid/30 bg-acid/10 text-acid" };
  if (statut === "failed") return { texte: "échec", classe: "border-red-400/30 bg-red-400/10 text-red-300" };
  return { texte: "en attente", classe: "border-white/15 bg-white/5 text-zinc-300" };
}

function Programmation() {
  const [posts, setPosts] = useState(null);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await cachedFetch("/api/social-schedule");
      if (data.error) return setErreur(data.error);
      setPosts(data.posts);
    } catch {
      setErreur("Impossible de charger les publications programmées.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function annuler(id) {
    setOccupe(true);
    try {
      await fetch(`/api/social-schedule?id=${id}`, { method: "DELETE" });
      invalidateCache("/api/social-schedule");
      await load();
    } finally {
      setOccupe(false);
    }
  }

  if (erreur) return <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{erreur}</p>;
  if (posts === null) return <p className="mt-6 text-sm text-zinc-500">Chargement...</p>;
  if (!posts.length) return <p className="mt-6 text-sm text-zinc-400">Aucune publication programmée pour l'instant.</p>;

  return (
    <div className="mt-6 space-y-3">
      {posts.map((p) => {
        const statut = statutLabel(p.status);
        return (
          <div key={p.id} className="rounded-xl border border-white/10 bg-ink p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  {(p.networks || []).map((n) => (
                    <span key={n} className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-zinc-300">
                      {n}
                    </span>
                  ))}
                  <span className={`rounded-full border px-2 py-0.5 text-xs ${statut.classe}`}>{statut.texte}</span>
                </div>
                <p className="mt-2 max-w-xl text-sm text-zinc-400">{p.caption || <em className="text-zinc-600">sans légende</em>}</p>
                <div className="mt-1 text-xs text-zinc-500">
                  Prévu le {new Date(p.scheduled_for).toLocaleString("fr-FR")}
                  {p.published_at && ` · traité le ${new Date(p.published_at).toLocaleString("fr-FR")}`}
                </div>
                {p.status === "failed" && p.result && (
                  <p className="mt-1 text-xs text-red-300">{JSON.stringify(p.result)}</p>
                )}
              </div>
              {p.status === "pending" && (
                <Bouton ton="danger" disabled={occupe} onClick={() => annuler(p.id)}>
                  Annuler
                </Bouton>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function campagneStatutClasse(statut) {
  if (statut === "ACTIVE") return "border-acid/30 bg-acid/10 text-acid";
  if (statut === "failed") return "border-red-400/30 bg-red-400/10 text-red-300";
  if (statut === "PAUSED") return "border-white/15 bg-white/5 text-zinc-300";
  return "border-white/15 bg-white/5 text-zinc-500";
}

function Publicites({ compteParReseau }) {
  const [campagnes, setCampagnes] = useState(null);
  const [erreur, setErreur] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [form, setForm] = useState({ network: "facebook", name: "", dailyBudget: "", postId: "" });

  const load = useCallback(async () => {
    try {
      const data = await cachedFetch("/api/social-ads");
      if (data.error) return setErreur(data.error);
      setCampagnes(data.campagnes);
    } catch {
      setErreur("Impossible de charger les campagnes.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function creer() {
    setErreur("");
    if (!form.name || !form.dailyBudget || !form.postId) {
      return setErreur("Nom, budget quotidien et identifiant de publication (postId) sont requis.");
    }
    setOccupe(true);
    try {
      const res = await fetch("/api/social-ads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          network: form.network,
          name: form.name,
          dailyBudgetCents: Math.round(Number(form.dailyBudget) * 100),
          postId: form.postId,
        }),
      }).then((r) => r.json());
      if (res.error && !res.campagne) throw new Error(res.error);
      if (res.error) setErreur(`Créée en base mais échec côté Meta : ${res.error}`);
      setForm({ network: "facebook", name: "", dailyBudget: "", postId: "" });
      invalidateCache("/api/social-ads");
      await load();
    } catch (e) {
      setErreur(e.message || "Échec de la création.");
    } finally {
      setOccupe(false);
    }
  }

  async function basculerStatut(campagne) {
    setOccupe(true);
    try {
      await fetch("/api/social-ads", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: campagne.id, action: campagne.status === "ACTIVE" ? "pause" : "activer" }),
      });
      invalidateCache("/api/social-ads");
      await load();
    } finally {
      setOccupe(false);
    }
  }

  const connecteFacebook = !!compteParReseau.facebook;

  return (
    <div className="mt-6 space-y-6">
      {!connecteFacebook ? (
        <div className="rounded-xl border border-white/10 bg-ink p-6 text-center">
          <p className="text-sm text-zinc-400">Connectez Facebook (onglet "Général") pour gérer les publicités Facebook/Instagram.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-white/10 bg-ink p-5">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Nouvelle campagne (mise en avant d'une publication)</div>
          <p className="mt-1 text-xs text-zinc-500">
            Publiez d'abord un post (onglet "Publier"), récupérez son identifiant dans le résultat de publication, puis créez la
            campagne ici. Elle est créée en pause côté Meta — à vérifier et activer manuellement dans Meta Ads Manager.
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <select
              value={form.network}
              onChange={(e) => setForm((f) => ({ ...f, network: e.target.value }))}
              className="rounded-lg border border-white/15 bg-ink px-3 py-2 text-sm text-white focus:border-acid focus:outline-none"
            >
              <option value="facebook">Facebook</option>
              <option value="instagram">Instagram</option>
            </select>
            <input
              type="text"
              placeholder="Nom de la campagne"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-acid focus:outline-none"
            />
            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="Budget quotidien (€)"
              value={form.dailyBudget}
              onChange={(e) => setForm((f) => ({ ...f, dailyBudget: e.target.value }))}
              className="rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-acid focus:outline-none"
            />
            <input
              type="text"
              placeholder="Identifiant de la publication (postId)"
              value={form.postId}
              onChange={(e) => setForm((f) => ({ ...f, postId: e.target.value }))}
              className="rounded-lg border border-white/15 bg-transparent px-3 py-2 text-sm text-white placeholder:text-zinc-500 focus:border-acid focus:outline-none"
            />
          </div>
          {erreur && <p className="mt-3 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{erreur}</p>}
          <div className="mt-4">
            <Bouton ton="principal" disabled={occupe} onClick={creer}>
              {occupe ? "Création..." : "Créer la campagne"}
            </Bouton>
          </div>
        </div>
      )}

      {campagnes === null ? (
        <p className="text-sm text-zinc-500">Chargement...</p>
      ) : !campagnes.length ? (
        <p className="text-sm text-zinc-400">Aucune campagne pour l'instant.</p>
      ) : (
        <div className="space-y-3">
          {campagnes.map((c) => (
            <div key={c.id} className="rounded-xl border border-white/10 bg-ink p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full border border-white/15 px-2 py-0.5 text-xs text-zinc-300">{c.network}</span>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${campagneStatutClasse(c.status)}`}>{c.status}</span>
                  </div>
                  <div className="mt-2 font-display text-sm font-bold text-white">{c.name}</div>
                  <div className="mt-1 text-xs text-zinc-500">
                    Budget quotidien : <span className="chiffre">{(c.daily_budget_cents / 100).toFixed(2)} €</span> · créée le {new Date(c.created_at).toLocaleDateString("fr-FR")}
                  </div>
                  {c.error && <p className="mt-1 text-xs text-red-300">{c.error}</p>}
                </div>
                {(c.status === "ACTIVE" || c.status === "PAUSED") && (
                  <Bouton ton={c.status === "ACTIVE" ? "danger" : "principal"} disabled={occupe} onClick={() => basculerStatut(c)}>
                    {c.status === "ACTIVE" ? "Mettre en pause" : "Activer"}
                  </Bouton>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DetailReseau({ reseau, compte, onDeconnecter, occupe }) {
  if (!compte) {
    return (
      <div className="rounded-xl border border-white/10 bg-ink p-6 text-center">
        <p className="text-sm text-zinc-400">Aucun compte {reseau.label} connecté pour l'instant.</p>
        <div className="mt-4">
          <Bouton ton="principal" onClick={() => connecter(reseau.id)}>
            Connecter {reseau.label}
          </Bouton>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-white/10 bg-ink p-5">
      <div className="text-xs uppercase tracking-wider text-zinc-500">Compte connecté</div>
      <div className="mt-1 font-display text-lg font-bold text-white">{compte.accountName}</div>
      <div className="mt-1 text-xs text-zinc-500">Identifiant : {compte.accountId}</div>
      <div className="mt-1 text-xs text-zinc-500">Connecté depuis le {formatDate(compte.connectedAt)}</div>
      {compte.expiresAt && <div className="mt-1 text-xs text-zinc-500">Jeton valable jusqu'au {formatDate(compte.expiresAt)}</div>}
      <div className="mt-4 flex gap-2">
        <Bouton ton="neutre" onClick={() => connecter(reseau.id)}>
          Reconnecter
        </Bouton>
        <Bouton ton="danger" disabled={occupe} onClick={() => onDeconnecter(reseau.id)}>
          Déconnecter
        </Bouton>
      </div>
      <p className="mt-6 text-xs leading-relaxed text-zinc-500">
        Publiez du contenu depuis l'onglet "Publier" et gérez les campagnes depuis l'onglet "Publicités".
      </p>
    </div>
  );
}

export default function SocialPanel() {
  const [comptes, setComptes] = useState(null);
  const [error, setError] = useState("");
  const [occupe, setOccupe] = useState(false);
  const [sousOnglet, setSousOnglet] = useState("general");
  const [message, setMessage] = useState(null); // { type: 'ok' | 'erreur', texte }
  const [refreshProgrammation, setRefreshProgrammation] = useState(0);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await cachedFetch("/api/social-auth?action=status");
      if (data.error) return setError(data.error);
      setComptes(data.accounts);
    } catch {
      setError("Impossible de charger les comptes réseaux sociaux.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Le retour d'OAuth (Meta/TikTok) redirige vers /admin avec un paramètre de
  // résultat : on l'affiche une fois puis on nettoie l'URL.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connecte = params.get("social_connecte");
    const erreur = params.get("social_erreur");
    if (connecte) setMessage({ type: "ok", texte: `Connecté avec succès : ${connecte.split(",").join(", ")}.` });
    if (erreur) setMessage({ type: "erreur", texte: erreur });
    if (connecte || erreur) {
      params.delete("social_connecte");
      params.delete("social_erreur");
      const reste = params.toString();
      window.history.replaceState({}, "", `/admin${reste ? `?${reste}` : ""}`);
    }
  }, []);

  async function deconnecter(network) {
    setOccupe(true);
    try {
      await fetch("/api/social-auth?action=disconnect", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ network }),
      });
      invalidateCache("/api/social-auth?action=status");
      await load();
    } finally {
      setOccupe(false);
    }
  }

  const compteParReseau = Object.fromEntries((comptes || []).map((c) => [c.network, c]));

  return (
    <div>
      <div className="flex flex-wrap gap-2 border-b border-white/10 pb-3">
        {[
          { id: "general", label: "Général" },
          { id: "influenceurs", label: "Influenceurs" },
          { id: "publier", label: "Publier" },
          { id: "programmation", label: "Programmation" },
          { id: "publicites", label: "Publicités" },
          ...RESEAUX,
        ].map((o) => (
          <button
            key={o.id}
            onClick={() => setSousOnglet(o.id)}
            className={`rounded-full px-4 py-1.5 font-display text-xs font-bold transition-colors ${
              sousOnglet === o.id ? "bg-acid text-white" : "border border-white/15 text-zinc-400 hover:text-white"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {message && (
        <p
          className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
            message.type === "ok" ? "border-acid/30 bg-acid/10 text-acid" : "border-red-400/30 bg-red-400/10 text-red-300"
          }`}
        >
          {message.texte}
        </p>
      )}
      {error && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-300">{error}</p>}

      {comptes === null && !error ? (
        <p className="mt-6 text-sm text-zinc-500">Chargement...</p>
      ) : sousOnglet === "general" ? (
        <div className="mt-6">
          <p className="text-sm text-zinc-400">
            Connectez vos comptes pour préparer l'automatisation des publications et des publicités. Chaque réseau se
            gère depuis son propre onglet.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {RESEAUX.map((r) => (
              <CarteReseau key={r.id} reseau={r} compte={compteParReseau[r.id]} onDeconnecter={deconnecter} occupe={occupe} />
            ))}
          </div>
        </div>
      ) : sousOnglet === "influenceurs" ? (
        <InfluencersPanel />
      ) : sousOnglet === "publier" ? (
        <div className="mt-6">
          <Publier compteParReseau={compteParReseau} onProgramme={() => setRefreshProgrammation((n) => n + 1)} />
        </div>
      ) : sousOnglet === "programmation" ? (
        <Programmation key={refreshProgrammation} />
      ) : sousOnglet === "publicites" ? (
        <Publicites compteParReseau={compteParReseau} />
      ) : (
        <div className="mt-6">
          <DetailReseau
            reseau={RESEAUX.find((r) => r.id === sousOnglet)}
            compte={compteParReseau[sousOnglet]}
            onDeconnecter={deconnecter}
            occupe={occupe}
          />
        </div>
      )}
    </div>
  );
}
