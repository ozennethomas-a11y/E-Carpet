import { motion, useInView, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";
import { useLang } from "../i18n/LanguageContext";
import { Reveal } from "./ui";

function Counter({ to, suffix = "", decimals = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const mv = useMotionValue(0);
  const spring = useSpring(mv, { duration: 2000, bounce: 0 });
  const display = useTransform(spring, (v) => v.toFixed(decimals).replace(".", ",") + suffix);

  useEffect(() => {
    if (inView) mv.set(to);
  }, [inView, to, mv]);

  return <motion.span ref={ref}>{display}</motion.span>;
}

export default function Stats() {
  const { t } = useLang();

  const stats = [
    { value: <><span className="text-acid">+</span><Counter to={2000} /></>, label: t.stats.clients },
    { value: <><Counter to={4.9} decimals={1} /><span className="text-acid">/5</span></>, label: t.stats.rating },
    { value: <><Counter to={72} /><span className="text-acid">h</span></>, label: t.stats.delivery },
    { value: <><Counter to={30} /><span className="text-acid">j</span></>, label: t.stats.returns },
  ];

  return (
    <section className="relative overflow-hidden pt-10 pb-24">
      {/* Logo marquee band behind */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 opacity-[0.05]">
        <div className="flex w-max animate-marquee items-center gap-16">
          {Array.from({ length: 10 }).map((_, i) => (
            <img key={i} src="/images/new/logo-grey.png" alt="" className="h-20 w-auto sm:h-28" loading="lazy" />
          ))}
        </div>
      </div>

      <div className="relative mx-auto max-w-6xl px-4">
        <Reveal>
          <h2 className="mb-14 text-center font-display text-3xl font-bold tracking-tight text-white sm:text-4xl text-balance">
            {t.stats.title}
          </h2>
        </Reveal>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={i} delay={i * 0.1}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ duration: 0.25 }}
                className="rounded-3xl border border-white/10 bg-gradient-to-b from-white/[0.07] to-transparent p-8 text-center backdrop-blur-sm"
              >
                <div className="font-display text-4xl font-bold text-white sm:text-5xl">{s.value}</div>
                <div className="mt-2 text-sm text-zinc-500">{s.label}</div>
              </motion.div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
