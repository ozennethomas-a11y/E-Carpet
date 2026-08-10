import { useState } from "react";
import { ARTICLES } from "../data/articles";

// Onglet « Blog » : vue d'ensemble de la file de publication.
//
// Un article daté dans le futur reste invisible sur le site jusqu'à sa date.
// C'est le mécanisme de publication hebdomadaire, et c'est aussi son angle mort :
// quand la file se vide, rien ne le signale. Ce panneau le signale.

const JOUR = 86400000;

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function joursRestants(iso) {
  return Math.ceil((new Date(iso) - new Date()) / JOUR);
}

function Apercu({ contenu }) {
  return (
    <div className="mt-4 flex flex-col gap-3 border-t border-white/10 pt-4">
      {contenu.map((bloc, i) => {
        if (bloc.type === "h2") {
          return <h4 key={i} className="font-display text-sm font-bold text-white">{bloc.text}</h4>;
        }
        if (bloc.type === "quote") {
          return (
            <blockquote key={i} className="border-l-2 border-acid pl-4 text-sm italic leading-relaxed text-zinc-300">
              {bloc.text}
            </blockquote>
          );
        }
        return <p key={i} className="text-sm leading-relaxed text-zinc-400">{bloc.text}</p>;
      })}
    </div>
  );
}

function Article({ article, programme }) {
  const [ouvert, setOuvert] = useState(false);
  const jours = programme ? joursRestants(article.date) : 0;

  return (
    <article className="rounded-2xl border border-white/10 bg-ink p-5">
      <div className="flex gap-4">
        <img
          src={article.cover}
          alt=""
          className="hidden size-20 shrink-0 rounded-xl object-cover sm:block"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className={programme ? "text-acid" : "text-zinc-500"}>
              {formatDate(article.date)}
            </span>
            {programme && (
              <span className="rounded-full bg-acid/15 px-2 py-0.5 text-acid">
                dans {jours} jour{jours > 1 ? "s" : ""}
              </span>
            )}
            <span className="text-zinc-600">· {article.readMinutes} min de lecture</span>
          </div>
          <h3 className="mt-1 font-display text-base font-bold text-white">{article.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-zinc-400">{article.excerpt}</p>

          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button
              onClick={() => setOuvert((v) => !v)}
              className="rounded-full border border-white/15 px-4 py-1.5 font-display text-xs font-bold text-zinc-300 transition-colors hover:text-white cursor-pointer"
            >
              {ouvert ? "Replier" : "Prévisualiser"}
            </button>
            {!programme && (
              <a
                href={`/blog/${article.slug}`}
                target="_blank"
                rel="noreferrer"
                className="text-xs text-zinc-500 underline underline-offset-4 transition-colors hover:text-white"
              >
                Voir en ligne
              </a>
            )}
            <span className="text-xs text-zinc-600">/blog/{article.slug}</span>
          </div>
        </div>
      </div>

      {ouvert && <Apercu contenu={article.content} />}
    </article>
  );
}

export default function BlogPanel() {
  const maintenant = new Date();
  const tries = [...ARTICLES].sort((a, b) => new Date(a.date) - new Date(b.date));
  const enLigne = tries.filter((a) => new Date(a.date) <= maintenant).reverse();
  const programmes = tries.filter((a) => new Date(a.date) > maintenant);

  const dernier = enLigne[0];
  const depuis = dernier ? Math.floor((maintenant - new Date(dernier.date)) / JOUR) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          ["Articles en ligne", enLigne.length],
          ["Programmés", programmes.length],
          ["Dernier publié", depuis === null ? "—" : `il y a ${depuis} j`],
        ].map(([label, valeur]) => (
          <div key={label} className="rounded-2xl border border-white/10 bg-slate-deep p-5">
            <div className="font-display text-3xl font-bold text-white">{valeur}</div>
            <div className="mt-1 text-xs text-zinc-500">{label}</div>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">À venir</h2>
        <p className="mt-1 text-xs leading-relaxed text-zinc-500">
          Ces articles sont déjà écrits et sortiront tout seuls à la date indiquée, sans
          redéploiement. Prévisualisez-les et dites-moi ce qui ne va pas : tant qu'ils ne sont pas
          sortis, tout est modifiable.
        </p>

        {programmes.length === 0 ? (
          <div className="mt-4 rounded-xl border border-acid/30 bg-acid/10 p-5 text-sm leading-relaxed">
            <p className="font-display font-bold text-white">La file est vide.</p>
            <p className="mt-2 text-zinc-300">
              Aucun article n'est programmé. Le blog ne publiera plus rien tant que de nouveaux
              articles n'auront pas été écrits et datés dans le futur.
              {depuis !== null && ` Le dernier est sorti il y a ${depuis} jours.`}
            </p>
          </div>
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {programmes.map((a) => (
              <Article key={a.slug} article={a} programme />
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-slate-deep p-5">
        <h2 className="font-display text-base font-bold text-white">En ligne</h2>
        <p className="mt-1 text-xs text-zinc-500">Du plus récent au plus ancien.</p>
        <div className="mt-4 flex flex-col gap-3">
          {enLigne.map((a) => (
            <Article key={a.slug} article={a} />
          ))}
        </div>
      </section>
    </div>
  );
}
