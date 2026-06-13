import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useLang } from "../i18n/LanguageContext";
import { Kicker, Reveal } from "./ui";

const ICONS = [
  <path d="M12 2l8 4v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-4z" key="i0" />,
  <path d="M12 2L2 8l10 6 10-6-10-6zM2 14l10 6 10-6" key="i1" />,
  <path d="M7 7h.01M12 7h.01M17 7h.01M7 12h.01M12 12h.01M17 12h.01M7 17h.01M12 17h.01M17 17h.01" key="i2" />,
  <path d="M3 9l6-6 12 12-6 6L3 9zM8 8l1.5 1.5M11 5l1.5 1.5M14 8l1.5 1.5" key="i3" />,
  <path d="M12 3s6 6.5 6 11a6 6 0 1 1-12 0c0-4.5 6-11 6-11z" key="i4" />,
  <path d="M12 2c1 4-4 5.5-4 10a4 4 0 0 0 8 0c0-2-1-3.5-2-4.5 0 1.5-1 2.5-2 2.5.5-2.5 0-6 0-8z" key="i5" />,
];

export default function Unroll() {
  const { t } = useLang();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "center center"] });

  // The rolled mat "unrolls": image reveals from left, roll rotates slightly
  const clip = useTransform(scrollYProgress, [0.1, 0.8], ["inset(0 100% 0 0 round 24px)", "inset(0 0% 0 0 round 24px)"]);
  const rollX = useTransform(scrollYProgress, [0.1, 0.8], ["-30%", "0%"]);
  const rollRotate = useTransform(scrollYProgress, [0.1, 0.8], [-12, 0]);

  return (
    <section id="features" ref={ref} className="relative overflow-hidden px-4 pt-28 pb-12 sm:pt-36 sm:pb-16">
      <div className="mx-auto max-w-6xl">
        {/* Intro row: text + unrolling mat */}
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <Reveal>
              <Kicker>{t.unroll.kicker}</Kicker>
            </Reveal>
            <Reveal delay={0.1}>
              <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
                {t.unroll.title}
              </h2>
            </Reveal>
            <Reveal delay={0.2}>
              <p className="mt-6 max-w-md leading-relaxed text-zinc-400 sm:text-lg">{t.unroll.text}</p>
            </Reveal>
          </div>

          <motion.div style={{ x: rollX, rotate: rollRotate }} className="relative">
            <motion.div style={{ clipPath: clip }} className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-zinc-100 to-zinc-300 shadow-2xl">
              <img
                src="/images/Enroule__sans_fond.png"
                alt="Tapis E-Carpet enroulé, prêt à dérouler"
                className="w-full origin-right scale-[1.12] object-cover"
                loading="lazy"
              />
            </motion.div>
            <div aria-hidden="true" className="absolute -bottom-6 left-1/2 h-12 w-2/3 -translate-x-1/2 rounded-[100%] bg-acid/15 blur-2xl" />
          </motion.div>
        </div>

        {/* Advantages grid */}
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {t.features.items.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.5, delay: (i % 3) * 0.08, ease: [0.21, 0.6, 0.35, 1] }}
              className="group flex items-start gap-4 rounded-2xl border border-white/10 bg-slate-deep p-5 transition-colors duration-300 hover:border-acid/40"
            >
              <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-acid/10 text-acid transition-colors duration-300 group-hover:bg-acid group-hover:text-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  {ICONS[i]}
                </svg>
              </span>
              <div>
                <h3 className="font-display font-bold text-white">{f.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{f.text}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
