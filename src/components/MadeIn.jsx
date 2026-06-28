import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useLang } from "../i18n/LanguageContext";
import { Kicker, Reveal } from "./ui";

export default function MadeIn() {
  const { t } = useLang();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const lilleY = useTransform(scrollYProgress, [0, 1], ["-4%", "4%"]);
  // Rider rides across to the right as the user scrolls
  const riderX = useTransform(scrollYProgress, [0, 1], ["-25vw", "85vw"]);
  const riderBob = useTransform(scrollYProgress, [0, 0.25, 0.5, 0.75, 1], [0, -10, 0, -10, 0]);

  return (
    <section ref={ref} className="relative overflow-hidden px-4 pt-12 pb-12 sm:pt-16 sm:pb-16">
      <div className="mx-auto max-w-6xl">
        <div className="mb-14 text-center">
          <Reveal><Kicker>{t.madein.kicker}</Kicker></Reveal>
          <Reveal delay={0.1}>
            <h2 className="mx-auto max-w-2xl text-balance font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
              {t.madein.title}
            </h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mx-auto mt-5 max-w-xl text-balance leading-relaxed text-zinc-400">{t.madein.text}</p>
          </Reveal>
        </div>

        {/* Lille image (smaller) + reassurance points side by side */}
        <div className="grid items-stretch gap-5 lg:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
              <motion.img
                src="/images/new/lille.jpg"
                alt="Place du Vieux-Lille au lever du soleil, avec une trottinette au premier plan"
                style={{ y: lilleY, scale: 1.1 }}
                className="h-full w-full object-cover object-[55%_85%]"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/60 to-transparent" />
              <span className="absolute bottom-4 left-5 flex items-center gap-2 font-display text-lg font-bold text-white">
                <svg viewBox="0 0 24 24" className="h-5 w-5 text-acid" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="3" />
                </svg>
                Lille, France
              </span>
            </div>
          </Reveal>

          {/* Reassurance points stacked next to the image */}
          <div className="flex flex-col justify-center gap-4">
            {t.delivery.points.map((p, i) => (
              <Reveal key={i} delay={0.1 + i * 0.1}>
                <div className="flex items-center gap-4 rounded-2xl border border-white/10 bg-slate-deep px-5 py-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-acid/15 text-acid">
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M20 6L9 17l-5-5" />
                    </svg>
                  </span>
                  <span className="font-display font-semibold text-white">{p}</span>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </div>

      {/* Delivery rider — rides across to the right on scroll */}
      <div className="relative mt-10 h-40 w-full sm:h-56">
        {/* Road line */}
        <div aria-hidden="true" className="absolute bottom-7 left-0 right-0 h-px bg-white/10" />
        <div
          aria-hidden="true"
          className="absolute bottom-7 left-0 right-0 h-px opacity-60"
          style={{ background: "repeating-linear-gradient(90deg, transparent 0 16px, rgba(224,106,59,0.5) 16px 40px)" }}
        />
        <motion.div
          style={{ x: riderX, y: riderBob }}
          className="pointer-events-none absolute bottom-3 left-0 w-36 sm:w-52"
        >
          <img
            src="/images/new/livreur.png"
            alt="Livreur E-Carpet livrant des colis à trottinette électrique"
            className="w-full -scale-x-100 drop-shadow-[0_20px_40px_rgba(0,0,0,0.6)]"
            loading="lazy"
          />
        </motion.div>
      </div>
    </section>
  );
}
