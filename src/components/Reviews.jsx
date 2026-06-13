import { useRef } from "react";
import { motion } from "framer-motion";
import { useLang } from "../i18n/LanguageContext";
import { Kicker, Reveal, Stars } from "./ui";

function ReviewCard({ review, index }) {
  const tilt = [-2.5, 2, -1.5, 2.5, -2][index % 5];
  return (
    <motion.article
      initial={{ opacity: 0, y: 50, rotate: 0 }}
      whileInView={{ opacity: 1, y: 0, rotate: tilt }}
      whileHover={{ rotate: 0, scale: 1.03, zIndex: 10 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.55, delay: index * 0.08, ease: [0.21, 0.6, 0.35, 1] }}
      className="relative flex w-[300px] shrink-0 flex-col gap-4 rounded-3xl border border-white/10 bg-slate-deep p-6 shadow-2xl sm:w-[360px]"
    >
      <span aria-hidden="true" className="absolute -top-3 left-6 font-display text-6xl font-bold text-acid/15 select-none">“</span>
      <Stars rating={review.rating} />
      <p className="flex-1 text-sm leading-relaxed text-zinc-300">{review.text}</p>
      <footer className="flex items-center gap-3 border-t border-white/5 pt-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-acid/15 font-display text-sm font-bold text-acid">
          {review.name.charAt(0)}
        </div>
        <div>
          <div className="text-sm font-semibold text-white">{review.name} · {review.city}</div>
          <div className="text-xs text-zinc-500">{review.scooter}</div>
        </div>
      </footer>
    </motion.article>
  );
}

export default function Reviews() {
  const { t } = useLang();
  const trackRef = useRef(null);
  const containerRef = useRef(null);

  return (
    <section id="reviews" className="relative overflow-hidden pt-28 pb-12 sm:pt-36 sm:pb-16">
      <div className="mb-14 px-4 text-center">
        <Reveal><Kicker>{t.reviews.kicker}</Kicker></Reveal>
        <Reveal delay={0.1}>
          <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">
            {t.reviews.title}
          </h2>
        </Reveal>
      </div>

      {/* Draggable row of tilted cards */}
      <div ref={containerRef} className="relative px-4">
        <motion.div
          ref={trackRef}
          drag="x"
          dragConstraints={containerRef}
          dragElastic={0.08}
          className="flex w-max cursor-grab items-stretch gap-6 py-6 active:cursor-grabbing"
        >
          {t.reviews.items.map((r, i) => (
            <ReviewCard key={i} review={r} index={i} />
          ))}
        </motion.div>
        <div aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-0 w-24 bg-gradient-to-l from-ink to-transparent" />
      </div>

      <Reveal delay={0.2}>
        <p className="mt-4 flex items-center justify-center gap-2 text-center text-xs uppercase tracking-[0.2em] text-zinc-600">
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M8 8l-4 4 4 4M16 8l4 4-4 4" />
          </svg>
          Drag
        </p>
      </Reveal>
    </section>
  );
}
