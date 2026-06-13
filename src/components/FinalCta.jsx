import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useLang } from "../i18n/LanguageContext";
import { AmazonButton, Reveal } from "./ui";

export default function FinalCta() {
  const { t } = useLang();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const bgScale = useTransform(scrollYProgress, [0, 1], [1.2, 1]);
  const bgY = useTransform(scrollYProgress, [0, 1], ["-8%", "8%"]);

  return (
    <section ref={ref} className="relative overflow-hidden">
      {/* Full-bleed background: scooter + boxes on the mat */}
      <div className="absolute inset-0">
        <motion.img
          src="/images/new/boxes-scooter.jpg"
          alt=""
          aria-hidden="true"
          style={{ scale: bgScale, y: bgY }}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-ink/70" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#0a0a0b_90%)]" />
      </div>

      <div className="relative mx-auto flex min-h-[60svh] max-w-4xl flex-col items-center justify-center px-4 py-24 text-center">
        <Reveal delay={0.1}>
          <h2 className="text-balance font-display text-5xl font-bold tracking-tight text-white sm:text-6xl">
            {t.finalCta.title1}{" "}
            <span className="bg-gradient-to-r from-acid to-orange-300 bg-clip-text text-transparent">{t.finalCta.title2}</span>
          </h2>
        </Reveal>
        <Reveal delay={0.2}>
          <p className="mt-6 max-w-md text-balance leading-relaxed text-zinc-300 sm:text-lg">{t.finalCta.text}</p>
        </Reveal>
        <Reveal delay={0.3}>
          <div className="mt-10">
            <AmazonButton sub={t.finalCta.guarantee}>{t.finalCta.cta}</AmazonButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
