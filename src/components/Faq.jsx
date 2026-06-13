import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLang } from "../i18n/LanguageContext";
import { Kicker, Reveal } from "./ui";

function FaqItem({ item, open, onToggle }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-slate-deep">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left cursor-pointer"
      >
        <span className="font-display font-semibold text-white">{item.q}</span>
        <motion.span
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.2 }}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-acid/15 text-acid"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </motion.span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.21, 0.6, 0.35, 1] }}
          >
            <p className="px-6 pb-5 text-sm leading-relaxed text-zinc-400">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Faq() {
  const { t } = useLang();
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <section id="faq" className="relative px-4 pt-12 pb-28 sm:pt-16 sm:pb-36">
      <div className="mx-auto max-w-3xl">
        <div className="mb-14 text-center">
          <Reveal>
            <Kicker>{t.faq.kicker}</Kicker>
          </Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {t.faq.title}
            </h2>
          </Reveal>
        </div>
        <div className="flex flex-col gap-3">
          {t.faq.items.map((item, i) => (
            <Reveal key={i} delay={i * 0.06}>
              <FaqItem item={item} open={openIndex === i} onToggle={() => setOpenIndex(openIndex === i ? -1 : i)} />
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
