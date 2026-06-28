import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useLang } from "../i18n/LanguageContext";
import { Kicker } from "./ui";

export default function ParkingScene() {
  const { t } = useLang();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  // Single photo: zooms in once, then settles and stays (always visible — no white-square fade)
  const imgScale = useTransform(scrollYProgress, [0, 0.3], [0.78, 1]);
  // Copper glow: comes in early and stays for the whole pinned scroll
  const glowOpacity = useTransform(scrollYProgress, [0.12, 0.3], [0, 1]);

  const descOpacity = useTransform(scrollYProgress, [0.14, 0.3], [0, 1]);
  const descY = useTransform(scrollYProgress, [0.14, 0.3], [24, 0]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.08, 0.95, 1], [0, 1, 1, 0]);

  return (
    <section ref={ref} className="relative h-[300vh]">
      <div className="sticky top-0 flex h-svh flex-col items-center justify-center overflow-hidden px-4">
        <motion.div style={{ opacity: titleOpacity }} className="relative z-10 mb-2 text-center">
          <Kicker>{t.parking.kicker}</Kicker>
          <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {t.parking.title}
          </h2>
        </motion.div>

        <div className="relative z-10 w-full max-w-xl">
          {/* Mat floats on the dark background, lit by a copper halo */}
          <div className="relative flex aspect-[3/2] items-center justify-center">
            {/* Copper accent glow (on-theme), comes in early and stays */}
            <motion.div
              aria-hidden="true"
              style={{ opacity: glowOpacity }}
              className="absolute left-1/2 top-1/2 h-[80%] w-[100%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-acid/45 blur-[90px]"
            />
            {/* Subtle ambient lift so edges read against pure black */}
            <div
              aria-hidden="true"
              className="absolute left-1/2 top-1/2 h-[50%] w-[66%] -translate-x-1/2 -translate-y-1/2 rounded-[50%] bg-white/[0.08] blur-3xl"
            />
            <motion.img
              src="/images/tapis-dessus-detoure.png"
              alt="Tapis E-Carpet vu de dessus"
              style={{ scale: imgScale }}
              className="relative w-full object-contain px-4 brightness-110 contrast-125 drop-shadow-[0_24px_40px_rgba(0,0,0,0.85)]"
              loading="lazy"
            />
          </div>

          {/* Description */}
          <motion.p
            style={{ opacity: descOpacity, y: descY }}
            className="mx-auto mt-2 max-w-lg text-balance text-center text-base leading-relaxed text-zinc-300 sm:text-lg"
          >
            {t.parking.desc}
          </motion.p>
        </div>
      </div>
    </section>
  );
}
