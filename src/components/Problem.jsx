import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useLang } from "../i18n/LanguageContext";
import { Kicker, Reveal } from "./ui";

export default function Problem() {
  const { t } = useLang();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const x1 = useTransform(scrollYProgress, [0, 1], [-60, 60]);
  const imgScale = useTransform(scrollYProgress, [0, 1], [1.2, 1]);
  const imgY = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);

  return (
    <section ref={ref} className="relative overflow-hidden px-4 pt-28 pb-8 sm:pt-36 sm:pb-10">
      <div className="mx-auto max-w-3xl text-center">
        <Reveal>
          <Kicker>{t.problem.kicker}</Kicker>
        </Reveal>
        <Reveal delay={0.1}>
          <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {t.problem.title}
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mx-auto mt-6 max-w-xl text-balance leading-relaxed text-zinc-400 sm:text-lg">
            {t.problem.text}
          </p>
        </Reveal>

        {/* Dirty scooter — parallax zoom */}
        <Reveal delay={0.3} className="relative mx-auto mt-12 max-w-2xl">
          <div className="relative aspect-[3/2] overflow-hidden rounded-3xl border border-white/10 shadow-2xl">
            <motion.video
              src="/images/video/probleme.mp4"
              style={{ scale: imgScale, y: imgY }}
              className="h-full w-full object-cover object-center"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
              aria-label="Trottinette sale qui goutte sur un parquet : boue, feuilles et eau"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
          </div>
          {/* Drip dots */}
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-3 left-1/2 flex -translate-x-1/2 gap-3">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={{ y: [0, 14], opacity: [0.8, 0] }}
                transition={{ repeat: Infinity, duration: 1.6, delay: i * 0.4, ease: "easeIn" }}
                className="h-2 w-2 rounded-full bg-acid/60"
              />
            ))}
          </div>
        </Reveal>

        <motion.p
          style={{ x: x1 }}
          className="mt-12 font-display text-2xl font-bold text-acid sm:text-3xl"
        >
          {t.problem.punch}
        </motion.p>
      </div>

      {/* Tire track decorations */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-8 flex justify-center gap-2 opacity-[0.06]">
        {Array.from({ length: 24 }).map((_, i) => (
          <div key={i} className="h-3 w-8 -skew-x-12 rounded-sm bg-white" />
        ))}
      </div>
    </section>
  );
}
