import { useLang } from "../i18n/LanguageContext";
import { navigate } from "../navigation";
import { Reveal } from "./ui";

export default function ReviewCta() {
  const { t } = useLang();

  return (
    <section className="relative px-4 pb-20 sm:pb-24">
      <Reveal className="flex justify-center">
        <button
          onClick={() => navigate("/avis")}
          className="inline-flex items-center gap-2 rounded-full border border-acid/40 bg-acid/10 px-6 py-3 font-display text-sm font-bold text-acid transition-colors duration-200 hover:bg-acid hover:text-white cursor-pointer"
        >
          {t.reviewForm.cta}
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
        </button>
      </Reveal>
    </section>
  );
}
