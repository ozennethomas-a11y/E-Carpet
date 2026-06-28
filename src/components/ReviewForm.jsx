import { useState } from "react";
import { useLang } from "../i18n/LanguageContext";
import { Kicker, Reveal } from "./ui";

const FORM_NAME = "avis";

function encode(data) {
  return Object.keys(data)
    .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(data[k]))
    .join("&");
}

export default function ReviewForm() {
  const { t } = useLang();
  const f = t.reviewForm;
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [form, setForm] = useState({ name: "", city: "", scooter: "", rating: "5", message: "", "bot-field": "" });

  const update = (e) => setForm((s) => ({ ...s, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    if (form["bot-field"]) return; // honeypot
    setStatus("sending");
    try {
      await fetch("/", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: encode({ "form-name": FORM_NAME, ...form }),
      });
      setStatus("sent");
      setForm({ name: "", city: "", scooter: "", rating: "5", message: "", "bot-field": "" });
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="relative px-4 py-24 sm:py-28">
      <div className="mx-auto max-w-xl">
        <div className="mb-10 text-center">
          <Reveal><Kicker>{f.kicker}</Kicker></Reveal>
          <Reveal delay={0.1}>
            <h2 className="text-balance font-display text-4xl font-bold tracking-tight text-white sm:text-5xl">{f.title}</h2>
          </Reveal>
          <Reveal delay={0.2}>
            <p className="mx-auto mt-4 max-w-md text-balance leading-relaxed text-zinc-400">{f.subtitle}</p>
          </Reveal>
        </div>

        <Reveal delay={0.15}>
          {status === "sent" ? (
            <div className="rounded-3xl border border-acid/30 bg-acid/10 p-8 text-center">
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-acid text-white">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5" /></svg>
              </div>
              <p className="font-display text-lg font-bold text-white">{f.successTitle}</p>
              <p className="mt-1 text-sm text-zinc-400">{f.successText}</p>
            </div>
          ) : (
            <form
              name={FORM_NAME}
              method="POST"
              data-netlify="true"
              netlify-honeypot="bot-field"
              onSubmit={onSubmit}
              className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-slate-deep p-6 sm:p-8"
            >
              <input type="hidden" name="form-name" value={FORM_NAME} />
              <p className="hidden">
                <label>{f.botField}<input name="bot-field" value={form["bot-field"]} onChange={update} /></label>
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-zinc-400">{f.name}</span>
                  <input name="name" value={form.name} onChange={update} required autoComplete="name"
                    className="rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-acid/60" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-zinc-400">{f.city}</span>
                  <input name="city" value={form.city} onChange={update} autoComplete="address-level2"
                    className="rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-acid/60" />
                </label>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-zinc-400">{f.scooter}</span>
                  <input name="scooter" value={form.scooter} onChange={update}
                    className="rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-acid/60" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-zinc-400">{f.rating}</span>
                  <select name="rating" value={form.rating} onChange={update}
                    className="cursor-pointer rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-acid/60">
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>{"★".repeat(n)}{"☆".repeat(5 - n)} ({n}/5)</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-zinc-400">{f.message}</span>
                <textarea name="message" value={form.message} onChange={update} required rows={4}
                  className="resize-none rounded-xl border border-white/10 bg-ink/60 px-4 py-3 text-sm text-white outline-none transition-colors focus:border-acid/60" />
              </label>

              {status === "error" && <p className="text-sm text-red-400">{f.error}</p>}

              <button
                type="submit"
                disabled={status === "sending"}
                className="mt-1 inline-flex items-center justify-center gap-2 rounded-full bg-acid px-7 py-3.5 font-display font-bold text-white transition-shadow duration-300 hover:shadow-[0_0_40px_-8px_rgba(224,106,59,0.7)] disabled:opacity-60 cursor-pointer"
              >
                {status === "sending" ? f.sending : f.submit}
              </button>
              <p className="text-center text-xs text-zinc-600">{f.note}</p>
            </form>
          )}
        </Reveal>
      </div>
    </section>
  );
}
