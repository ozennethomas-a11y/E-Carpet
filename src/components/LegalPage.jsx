import { useLang } from "../i18n/LanguageContext";
import { navigate } from "../navigation";
import { LEGAL } from "../data/legal";
import SubPageHeader from "./SubPageHeader";
import Footer from "./Footer";

export default function LegalPage({ slug }) {
  const { t } = useLang();
  const doc = LEGAL[slug];

  return (
    <>
      <SubPageHeader />
      <main className="px-4 pt-32 pb-20">
        <div className="mx-auto max-w-2xl">
          <button
            onClick={() => (window.history.length > 1 ? window.history.back() : navigate("/"))}
            className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-acid/40 hover:text-white cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
            {t.reviewForm.back}
          </button>

          {!doc ? (
            <h1 className="font-display text-3xl font-bold text-white">{t.blog.notFound}</h1>
          ) : (
            <>
              <h1 className="font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">{doc.title}</h1>
              <p className="mt-3 text-sm text-zinc-500">Dernière mise à jour : {doc.updated}</p>
              <div className="mt-8 flex flex-col gap-4">
                {doc.blocks.map((b, i) =>
                  b.type === "h2" ? (
                    <h2 key={i} className="mt-4 font-display text-xl font-bold text-white">{b.text}</h2>
                  ) : (
                    <p key={i} className="text-sm leading-relaxed text-zinc-400">{b.text}</p>
                  )
                )}
              </div>
            </>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
