import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "../i18n/LanguageContext";
import { LANGUAGES } from "../i18n/translations";
import { AMAZON_URL } from "../config";

export default function Navbar() {
  const { t, lang, setLang } = useLang();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const links = [
    { href: "#features", label: t.nav.features },
    { href: "#reviews", label: t.nav.reviews },
    { href: "#faq", label: t.nav.faq },
  ];

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="fixed top-4 left-4 right-4 z-50"
    >
      <nav
        className={`mx-auto flex max-w-6xl items-center justify-between rounded-2xl border px-5 py-3 transition-all duration-300 ${
          scrolled
            ? "border-white/10 bg-ink/80 backdrop-blur-xl shadow-2xl"
            : "border-transparent bg-transparent"
        }`}
      >
        <a href="#" className="cursor-pointer" aria-label="E-Carpet — retour en haut">
          <img src="/images/new/logo-grey.png" alt="E-Carpet" className="h-7 w-auto sm:h-8" />
        </a>

        <div className="hidden items-center gap-8 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="text-sm text-zinc-400 transition-colors duration-200 hover:text-white cursor-pointer">
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-full border border-white/10 bg-white/5 p-0.5">
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
            href={AMAZON_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden rounded-full bg-acid px-5 py-2.5 text-sm font-bold text-white transition-all duration-200 hover:shadow-[0_0_30px_-6px_rgba(224,106,59,0.7)] sm:inline-block cursor-pointer"
          >
            {t.nav.buy}
          </a>

          <button
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Menu"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white md:hidden cursor-pointer"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="mx-auto mt-2 max-w-6xl rounded-2xl border border-white/10 bg-ink/95 p-4 backdrop-blur-xl md:hidden"
          >
            {links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className="block rounded-xl px-4 py-3 text-zinc-300 transition-colors hover:bg-white/5 hover:text-white cursor-pointer"
              >
                {l.label}
              </a>
            ))}
            <a
              href={AMAZON_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 block rounded-xl bg-acid px-4 py-3 text-center font-bold text-white cursor-pointer"
            >
              {t.nav.buy}
            </a>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
