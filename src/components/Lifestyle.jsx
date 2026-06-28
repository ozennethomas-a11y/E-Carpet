import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { useLang } from "../i18n/LanguageContext";
import { INFLUENCERS } from "../data/influencers";
import { Kicker } from "./ui";

function PlatformIcon({ platform, className = "h-4 w-4" }) {
  if (platform === "instagram") {
    return (
      <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
        <path d="M12 2.2c3.2 0 3.6 0 4.9.1 1.2.1 1.8.2 2.2.4.6.2 1 .5 1.4.9.4.4.7.8.9 1.4.2.4.4 1 .4 2.2.1 1.3.1 1.7.1 4.9s0 3.6-.1 4.9c-.1 1.2-.2 1.8-.4 2.2-.2.6-.5 1-.9 1.4-.4.4-.8.7-1.4.9-.4.2-1 .4-2.2.4-1.3.1-1.7.1-4.9.1s-3.6 0-4.9-.1c-1.2-.1-1.8-.2-2.2-.4-.6-.2-1-.5-1.4-.9-.4-.4-.7-.8-.9-1.4-.2-.4-.4-1-.4-2.2C2.2 15.6 2.2 15.2 2.2 12s0-3.6.1-4.9c.1-1.2.2-1.8.4-2.2.2-.6.5-1 .9-1.4.4-.4.8-.7 1.4-.9.4-.2 1-.4 2.2-.4C8.4 2.2 8.8 2.2 12 2.2zm0 3.1a6.7 6.7 0 1 0 0 13.4 6.7 6.7 0 0 0 0-13.4zm0 11a4.3 4.3 0 1 1 0-8.6 4.3 4.3 0 0 1 0 8.6zm6.5-11.2a1.6 1.6 0 1 1-3.2 0 1.6 1.6 0 0 1 3.2 0z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

export default function Lifestyle() {
  const { t } = useLang();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });
  const x = useTransform(scrollYProgress, [0.05, 0.95], ["2%", "-62%"]);
  const progressW = useTransform(scrollYProgress, [0.05, 0.95], ["0%", "100%"]);

  return (
    <section ref={ref} className="relative h-[280vh]">
      <div className="sticky top-0 flex h-svh flex-col justify-center overflow-hidden">
        <div className="mb-10 px-4 text-center">
          <Kicker>{t.lifestyle.kicker}</Kicker>
          <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {t.lifestyle.title}
          </h2>
        </div>

        {/* Cards slide left as you scroll down */}
        <motion.div style={{ x }} className="flex w-max gap-5 px-4">
          {INFLUENCERS.map((inf) => (
            <a
              key={inf.handle}
              href={inf.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group relative aspect-[3/4] w-[260px] shrink-0 overflow-hidden rounded-3xl border border-white/10 shadow-2xl sm:w-[320px] cursor-pointer"
            >
              <img
                src={inf.image}
                alt={`${inf.name} avec son tapis E-Carpet`}
                loading="lazy"
                draggable="false"
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/20 to-transparent" />

              <div className="absolute left-1/2 top-1/2 flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-acid/90 text-white shadow-lg transition-transform duration-300 group-hover:scale-110">
                <svg viewBox="0 0 24 24" className="ml-0.5 h-6 w-6" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z" /></svg>
              </div>

              <div className="absolute inset-x-0 bottom-0 p-4">
                <div className="flex items-center gap-1.5 text-acid">
                  <PlatformIcon platform={inf.platform} />
                  <span className="font-display text-base font-bold text-white">{inf.name}</span>
                </div>
                <div className="mt-0.5 text-xs text-zinc-400">{inf.handle}</div>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur transition-colors group-hover:bg-acid">
                  {t.lifestyle.watch}
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M7 17 17 7M7 7h10v10" /></svg>
                </span>
              </div>
            </a>
          ))}
        </motion.div>

        <div className="mx-auto mt-10 h-1 w-48 overflow-hidden rounded-full bg-white/10">
          <motion.div style={{ width: progressW }} className="h-full rounded-full bg-acid" />
        </div>
      </div>
    </section>
  );
}
