import { useLang } from "../i18n/LanguageContext";
import { navigate } from "../navigation";
import { getArticle, getPublishedArticles, formatDate } from "../data/articles";
import { BuyButton } from "./ui";
import SubPageHeader from "./SubPageHeader";
import Footer from "./Footer";

// Related articles: cheap internal-linking win. Picks up to 3 other published
// articles, deterministically (by slug) so the choice doesn't change on every
// render, and excludes the current one.
function getRelated(slug, max = 3) {
  return getPublishedArticles()
    .filter((a) => a.slug !== slug)
    .slice(0, max);
}

export default function ArticlePage({ slug }) {
  const { t } = useLang();
  const article = getArticle(slug);

  if (!article) {
    return (
      <>
        <SubPageHeader />
        <main className="flex min-h-svh flex-col items-center justify-center px-4 text-center">
          <h1 className="font-display text-3xl font-bold text-white">{t.blog.notFound}</h1>
          <a href="/blog" onClick={(e) => { e.preventDefault(); navigate("/blog"); }} className="mt-6 inline-flex items-center gap-2 rounded-full bg-acid px-6 py-3 font-display font-bold text-white cursor-pointer">
            {t.blog.backToBlog}
          </a>
        </main>
        <Footer />
      </>
    );
  }

  return (
    <>
      <SubPageHeader />
      <main className="px-4 pt-32 pb-20">
        <article className="mx-auto max-w-2xl">
          <a href="/blog" onClick={(e) => { e.preventDefault(); navigate("/blog"); }} className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/10 px-4 py-2 text-sm text-zinc-300 transition-colors hover:border-acid/40 hover:text-white cursor-pointer">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></svg>
            {t.blog.backToBlog}
          </a>

          <div className="mb-4 flex items-center gap-2 text-xs text-zinc-500">
            <span>{formatDate(article.date)}</span>
            <span>·</span>
            <span>{article.readMinutes} {t.blog.minRead}</span>
          </div>
          <h1 className="text-balance font-display text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl">{article.title}</h1>

          <div className="my-8 aspect-[16/9] overflow-hidden rounded-3xl border border-white/10">
            <img src={article.cover} alt={article.title} className="h-full w-full object-cover" />
          </div>

          <div className="flex flex-col gap-5">
            {article.content.map((block, i) => {
              if (block.type === "h2")
                return <h2 key={i} className="mt-4 font-display text-2xl font-bold text-white">{block.text}</h2>;
              if (block.type === "quote")
                return (
                  <blockquote key={i} className="border-l-2 border-acid pl-5 font-display text-lg italic text-zinc-200">
                    {block.text}
                  </blockquote>
                );
              return <p key={i} className="leading-relaxed text-zinc-300">{block.text}</p>;
            })}
          </div>

          {(() => {
            const related = getRelated(slug);
            if (!related.length) return null;
            return (
              <div className="mt-12">
                <h2 className="mb-5 font-display text-xl font-bold text-white">{t.blog.relatedTitle}</h2>
                <div className="grid gap-4 sm:grid-cols-3">
                  {related.map((a) => (
                    <a
                      key={a.slug}
                      href={`/blog/${a.slug}`}
                      onClick={(e) => {
                        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                        e.preventDefault();
                        navigate(`/blog/${a.slug}`);
                      }}
                      className="group flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-slate-deep text-left transition-colors duration-300 hover:border-acid/40 cursor-pointer"
                    >
                      <div className="aspect-[16/10] overflow-hidden">
                        <img src={a.cover} alt={a.title} loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                      </div>
                      <p className="p-4 font-display text-sm font-bold leading-snug text-white">{a.title}</p>
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}

          <div className="mt-12 rounded-3xl border border-white/10 bg-slate-deep p-8 text-center">
            <p className="mb-5 font-display text-xl font-bold text-white">{t.blog.ctaTitle}</p>
            <BuyButton sub={t.finalCta.guarantee}>{t.hero.cta}</BuyButton>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
