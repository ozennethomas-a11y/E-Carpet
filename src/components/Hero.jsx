import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useLang } from "../i18n/LanguageContext";
import { AmazonButton, Stars } from "./ui";

export default function Hero() {
  const { t } = useLang();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const imgY = useTransform(scrollYProgress, [0, 1], [0, 120]);
  const textOpacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section ref={ref} className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden px-4 pt-28 pb-16">
      {/* Glow background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-1/3 h-[600px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-acid/[0.07] blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom,transparent_40%,#0a0a0b_85%)]" />
      </div>

      <motion.div style={{ opacity: textOpacity }} className="relative z-10 mx-auto max-w-4xl text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs text-zinc-300 backdrop-blur"
        >
          <Stars rating={5} className="h-3 w-3" />
          {t.hero.badge}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
          className="text-balance font-display text-5xl font-bold leading-[1.05] tracking-tight text-white sm:text-6xl lg:text-7xl"
        >
          {t.hero.title1}{" "}
          <span className="bg-gradient-to-r from-acid to-orange-300 bg-clip-text text-transparent">{t.hero.title2}</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mx-auto mt-6 max-w-xl text-balance text-base leading-relaxed text-zinc-400 sm:text-lg"
        >
          {t.hero.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.5 }}
          className="mt-8 flex flex-col items-center gap-4"
        >
          <div className="flex items-baseline gap-3 font-display">
            <span className="text-lg text-zinc-500 line-through">{t.hero.oldPrice}</span>
            <span className="text-4xl font-bold text-white">{t.hero.price}</span>
            <span className="rounded-full bg-acid/15 px-2.5 py-1 text-xs font-bold text-acid">-22%</span>
          </div>
          <AmazonButton sub={t.hero.ctaSub}>{t.hero.cta}</AmazonButton>
        </motion.div>
      </motion.div>

      {/* Product image with parallax */}
      <motion.div
        style={{ y: imgY }}
        initial={{ opacity: 0, y: 60, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.9, delay: 0.6, ease: [0.21, 0.6, 0.35, 1] }}
        className="relative z-10 mt-12 w-full max-w-3xl"
      >
        {/* Soft radial glow behind the floating product */}
        <div aria-hidden="true" className="absolute left-1/2 top-1/2 h-[80%] w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-acid/10 blur-[90px]" />
        <img
          src="/images/trottinette-detouree.png"
          alt="Trottinette électrique garée sur le tapis E-Carpet"
          className="relative w-full object-contain drop-shadow-[0_30px_60px_rgba(0,0,0,0.55)]"
          fetchPriority="high"
        />
        <div aria-hidden="true" className="absolute -bottom-2 left-1/2 h-12 w-3/5 -translate-x-1/2 rounded-[100%] bg-acid/20 blur-3xl" />
      </motion.div>

      {/* Scroll hint */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.4 }}
        className="relative z-10 mt-14 flex flex-col items-center gap-2 text-zinc-500"
      >
        <span className="text-xs uppercase tracking-[0.25em]">{t.hero.scroll}</span>
        <motion.div animate={{ y: [0, 8, 0] }} transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}>
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14m0 0l-6-6m6 6l6-6" />
          </svg>
        </motion.div>
      </motion.div>
    </section>
  );
}
