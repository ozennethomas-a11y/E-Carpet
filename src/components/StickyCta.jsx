import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "../i18n/LanguageContext";
import { AMAZON_URL } from "../config";
import { CartIcon } from "./ui";

export default function StickyCta() {
  const { t } = useLang();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const past = window.scrollY > window.innerHeight * 1.2;
      const nearEnd = window.scrollY + window.innerHeight > document.body.scrollHeight - 900;
      setVisible(past && !nearEnd);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ duration: 0.35, ease: [0.21, 0.6, 0.35, 1] }}
          className="fixed bottom-4 left-4 right-4 z-40 sm:left-auto sm:right-6 sm:bottom-6"
        >
          <a
            href={AMAZON_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-4 rounded-2xl border border-acid/30 bg-ink/90 px-5 py-3.5 shadow-2xl backdrop-blur-xl transition-colors duration-200 hover:border-acid/60 sm:justify-start cursor-pointer"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-acid text-white">
                <CartIcon className="h-5 w-5" />
              </span>
              <div>
                <div className="font-display text-sm font-bold text-white">{t.sticky.cta}</div>
                <div className="text-xs text-zinc-400">Amazon · {t.sticky.price}</div>
              </div>
            </div>
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-acid" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
            </svg>
          </a>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
