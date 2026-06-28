import { motion } from "framer-motion";
import { useLang } from "../i18n/LanguageContext";
import { navigate } from "../navigation";
import { getPublishedArticles, formatDate } from "../data/articles";
import { Kicker } from "./ui";
import SubPageHeader from "./SubPageHeader";
import Footer from "./Footer";

export default function BlogPage() {
  const { t } = useLang();
  const articles = getPublishedArticles();

  return (
    <>
      <SubPageHeader />
      <main className="px-4 pt-32 pb-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <Kicker>{t.blog.kicker}</Kicker>
            <h1 className="text-balance font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">{t.blog.title}</h1>
            <p className="mx-auto mt-4 max-w-xl text-balance leading-relaxed text-zinc-400">{t.blog.subtitle}</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {articles.map((a, i) => (
              <motion.button
                key={a.slug}
                onClick={() => navigate(`/blog/${a.slug}`)}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: (i % 2) * 0.08 }}
                className="group flex flex-col overflow-hidden rounded-3xl border border-white/10 bg-slate-deep text-left transition-colors duration-300 hover:border-acid/40 cursor-pointer"
              >
                <div className="aspect-[16/10] overflow-hidden">
                  <img src={a.cover} alt={a.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <div className="mb-3 flex items-center gap-2 text-xs text-zinc-500">
                    <span>{formatDate(a.date)}</span>
                    <span>·</span>
                    <span>{a.readMinutes} {t.blog.minRead}</span>
                  </div>
                  <h2 className="font-display text-xl font-bold leading-snug text-white">{a.title}</h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-zinc-400">{a.excerpt}</p>
                  <span className="mt-4 inline-flex items-center gap-2 font-display text-sm font-bold text-acid">
                    {t.blog.readMore}
                    <svg viewBox="0 0 24 24" className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                  </span>
                </div>
              </motion.button>
            ))}
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
