import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useLang } from "../i18n/LanguageContext";
import { Kicker } from "./ui";

const PHOTOS = [
  { src: "/images/new/wall-1.jpg", alt: "Trottinette garée sur l'E-Carpet devant un mur de briques", wide: true },
  { src: "/images/new/wall-3.jpg", alt: "Trottinette pliée sur le tapis E-Carpet", wide: false },
  { src: "/images/new/wall-2.jpg", alt: "Trottinette électrique sur son tapis, ambiance loft", wide: true },
  { src: "/images/new/wall-4.jpg", alt: "Vue trois-quarts de la trottinette sur l'E-Carpet", wide: false },
];

function Card({ photo, caption, progress, index }) {
  const innerY = useTransform(progress, [0, 1], ["-8%", "8%"]);
  return (
    <div
      className={`group relative shrink-0 overflow-hidden rounded-3xl border border-white/10 shadow-2xl ${
        photo.wide ? "aspect-[4/3] w-[320px] sm:w-[480px]" : "aspect-[3/4] w-[240px] sm:w-[320px]"
      }`}
    >
      <motion.img
        src={photo.src}
        alt={photo.alt}
        style={{ y: innerY, scale: 1.18 }}
        className="h-full w-full object-cover"
        loading="lazy"
        draggable="false"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink/60 via-transparent to-transparent" />
      <div className="absolute bottom-4 left-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-acid font-display text-xs font-bold text-white">
          {index + 1}
        </span>
        <span className="font-display text-sm font-semibold text-white drop-shadow">{caption}</span>
      </div>
    </div>
  );
}

export default function Lifestyle() {
  const { t } = useLang();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0.05, 0.95], ["3%", "-42%"]);

  return (
    <section ref={ref} className="relative h-[240vh]">
      <div className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden">
        <div className="mb-10 px-4 text-center">
          <Kicker>{t.lifestyle.kicker}</Kicker>
          <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {t.lifestyle.title}
          </h2>
        </div>

        <motion.div style={{ x }} className="flex w-max items-center gap-6 px-4">
          {PHOTOS.map((p, i) => (
            <Card key={i} photo={p} caption={t.lifestyle.captions[i]} progress={scrollYProgress} index={i} />
          ))}
        </motion.div>
      </div>
    </section>
  );
}
