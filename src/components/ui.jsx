import { motion } from "framer-motion";
import { AMAZON_URL } from "../config";

export function AmazonButton({ children, className = "", sub }) {
  return (
    <div className={`flex flex-col items-center gap-2 ${className}`}>
      <motion.a
        href={AMAZON_URL}
        target="_blank"
        rel="noopener noreferrer"
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        className="group inline-flex items-center gap-3 rounded-full bg-acid px-8 py-4 font-display text-base font-700 font-bold text-white shadow-[0_0_40px_-8px_rgba(224,106,59,0.6)] transition-shadow duration-300 hover:shadow-[0_0_60px_-8px_rgba(224,106,59,0.85)] cursor-pointer"
      >
        <CartIcon className="h-5 w-5" />
        {children}
        <ArrowIcon className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" />
      </motion.a>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </div>
  );
}

export function Kicker({ children }) {
  return (
    <span className="mb-4 inline-block rounded-full border border-acid/30 bg-acid/10 px-4 py-1.5 font-display text-xs font-medium uppercase tracking-[0.2em] text-acid">
      {children}
    </span>
  );
}

export function Reveal({ children, delay = 0, y = 40, className = "" }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease: [0.21, 0.6, 0.35, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function Stars({ rating, className = "h-4 w-4" }) {
  return (
    <div className="flex gap-0.5" aria-label={`${rating}/5`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <svg key={i} viewBox="0 0 20 20" className={`${className} ${i <= rating ? "fill-acid" : "fill-zinc-700"}`} aria-hidden="true">
          <path d="M10 1.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8L10 14.9l-5.3 2.7 1-5.8L1.5 7.7l5.9-.9L10 1.5z" />
        </svg>
      ))}
    </div>
  );
}

export function CartIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </svg>
  );
}

export function ArrowIcon({ className }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}
