import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useLang } from "../i18n/LanguageContext";
import { Kicker } from "./ui";

export default function ParkingScene() {
  const { t } = useLang();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  // Single photo: zooms in once, then settles and stays (always visible — no white-square fade)
  const imgScale = useTransform(scrollYProgress, [0, 0.4], [0.78, 1]);
  const glowOpacity = useTransform(scrollYProgress, [0.3, 0.6], [0, 1]);

  const descOpacity = useTransform(scrollYProgress, [0.18, 0.38], [0, 1]);
  const descY = useTransform(scrollYProgress, [0.18, 0.38], [24, 0]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.08, 0.92, 1], [0, 1, 1, 0]);

  return (
    <section ref={ref} className="relative h-[200vh]">
      <div className="sticky top-0 flex h-svh flex-col items-center justify-center overflow-hidden px-4">
        <motion.div style={{ opacity: titleOpacity }} className="relative z-10 mb-8 text-center">
          <Kicker>{t.parking.kicker}</Kicker>
          <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {t.parking.title}
          </h2>
        </motion.div>

        <div className="relative z-10 w-full max-w-2xl">
          {/* Celebration glow */}
          <motion.div
            aria-hidden="true"
            style={{ opacity: glowOpacity }}
            className="absolute -inset-10 rounded-[3rem] bg-acid/15 blur-3xl"
          />

          {/* Mat top view — zooms in on scroll */}
          <div className="relative aspect-[4/3] overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-white to-zinc-200 shadow-2xl">
            <motion.img
              src="/images/Photo_produit_fond_blanc.png"
              alt="Tapis E-Carpet vu de dessus"
              style={{ scale: imgScale }}
              className="absolute inset-0 h-full w-full object-contain p-6"
              loading="lazy"
            />
          </div>

          {/* Description */}
          <motion.p
            style={{ opacity: descOpacity, y: descY }}
            className="mx-auto mt-8 max-w-lg text-balance text-center text-base leading-relaxed text-zinc-300 sm:text-lg"
          >
            {t.parking.desc}
          </motion.p>
        </div>
      </div>
    </section>
  );
}
