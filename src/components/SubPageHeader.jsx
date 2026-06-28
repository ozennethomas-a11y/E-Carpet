import { useLang } from "../i18n/LanguageContext";
import { LANGUAGES } from "../i18n/translations";
import { navigate } from "../navigation";

export default function SubPageHeader() {
  const { t, lang, setLang } = useLang();
  return (
    <header className="fixed top-4 left-4 right-4 z-50">
      <nav className="mx-auto flex max-w-6xl items-center justify-between rounded-2xl border border-white/10 bg-ink/80 px-5 py-3 backdrop-blur-xl shadow-2xl">
        <a href="/" onClick={(e) => { e.preventDefault(); navigate("/"); }} className="cursor-pointer" aria-label="E-Carpet · retour à l'accueil">
          <img src="/images/new/logo-grey.png" alt="E-Carpet" className="h-7 w-auto sm:h-8" />
        </a>
        <div className="flex items-center gap-3">
          <div className="hidden rounded-full border border-white/10 bg-white/5 p-0.5 sm:flex">
            {LANGUAGES.map((l) => (
              <button
                key={l.code}
                onClick={() => setLang(l.code)}
                aria-label={`Langue ${l.label}`}
                className={`rounded-full px-2 py-1 text-[11px] font-semibold transition-colors duration-200 cursor-pointer ${
                  lang === l.code ? "bg-acid text-white" : "text-zinc-400 hover:text-white"
                }`}
              >
                {l.label}
              </button>
            ))}
          </div>
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); navigate("/"); }}
            className="flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:text-white cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
            {t.reviewForm.back}
          </a>
        </div>
      </nav>
    </header>
  );
}
