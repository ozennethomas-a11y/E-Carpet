import { useState, useEffect, useRef } from "react";
import { LanguageProvider } from "./i18n/LanguageContext";
import { CartProvider } from "./cart";
import { translations } from "./i18n/translations";
import { applyPageMeta } from "./seo";
import { applyStructuredData } from "./structuredData";
import { ARTICLES } from "./data/articles";
import { LEGAL } from "./data/legal";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Problem from "./components/Problem";
import ParkingScene from "./components/ParkingScene";
import Unroll from "./components/Unroll";
import Lifestyle from "./components/Lifestyle";
import Stats from "./components/Stats";
import Reviews from "./components/Reviews";
import ReviewPage from "./components/ReviewPage";
import BlogPage from "./components/BlogPage";
import ArticlePage from "./components/ArticlePage";
import LegalPage from "./components/LegalPage";
import DashboardPage from "./components/DashboardPage";
import MailsPage from "./components/MailsPage";
import CartPage from "./components/CartPage";
import CheckoutPage from "./components/CheckoutPage";
import OrderConfirmedPage from "./components/OrderConfirmedPage";
import AccountPage from "./components/AccountPage";
import AffiliateLandingPage from "./components/AffiliateLandingPage";
import AffiliateApplyPage from "./components/AffiliateApplyPage";
import AffiliateSpacePage from "./components/AffiliateSpacePage";
import MadeIn from "./components/MadeIn";
import Faq from "./components/Faq";
import FinalCta from "./components/FinalCta";
import Footer from "./components/Footer";
import StickyCta from "./components/StickyCta";

function Landing() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <ParkingScene />
        <Unroll />
        <Lifestyle />
        <Stats />
        <Reviews />
        <MadeIn />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <StickyCta />
    </>
  );
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);

  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  const clean = path.replace(/\/$/, "");

  // Anonymous page-view beacon (no cookie, no persistent id). The dashboard
  // itself is never counted, so checking your stats doesn't inflate them.
  const firstHit = useRef(true);
  useEffect(() => {
    if (clean.startsWith("/admin")) return;
    // Campaign tags only travel on the landing hit, so they are counted once.
    const query = firstHit.current ? window.location.search : "";
    firstHit.current = false;

    fetch("/api/track", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        path: clean || "/",
        referrer: document.referrer || "",
        lang: navigator.language || "",
        query,
      }),
      keepalive: true,
    }).catch(() => {});

    // Tidy the address bar once the tag is recorded, so visitors never
    // share or bookmark a URL full of tracking parameters.
    if (query && /utm_|[?&](ref|source|c)=/.test(query)) {
      window.history.replaceState({}, "", window.location.pathname + window.location.hash);
    }
  }, [clean]);

  // Titre, description et canonique propres à chaque page. La canonique règle
  // les doublons créés par les liens tagués (37 pages signalées par Search Console).
  useEffect(() => {
    const DEFAULT = {
      title: "E-Carpet · Tapis premium pour trottinette électrique",
      description:
        "Le tapis de sol 100% silicone pour trottinettes électriques. Imperméable, antidérapant, bordure anti-débordement. 130 × 40 cm, compatible tous modèles.",
    };

    let meta = DEFAULT;
    if (clean === "/admin") {
      meta = { title: "Admin · E-Carpet", description: "Espace privé.", noindex: true };
    } else if (clean === "/avis") {
      meta = {
        title: "Laisser un avis · E-Carpet",
        description: "Vous roulez avec l'E-Carpet ? Partagez votre expérience avec nous.",
      };
    } else if (clean === "/blog") {
      meta = {
        title: "Conseils & astuces · Blog E-Carpet",
        description:
          "Protéger son sol, entretenir sa trottinette, gagner de la place : nos guides pour rouler propre.",
      };
    } else if (clean.startsWith("/blog/")) {
      const a = ARTICLES.find((x) => x.slug === clean.slice("/blog/".length));
      if (a) meta = { title: `${a.title} · E-Carpet`, description: a.excerpt };
    } else if (clean.startsWith("/legal/")) {
      const doc = LEGAL[clean.slice("/legal/".length)];
      if (doc) meta = { title: `${doc.title} · E-Carpet`, description: `${doc.title} du site e-carpet.shop.` };
    }
    applyPageMeta(clean || "/", meta);

    // Le JSON-LD reste en français : c'est la version canonique du site,
    // celle que Google indexe (le HTML statique est servi en `lang="fr"`).
    applyStructuredData(clean || "/", translations.fr.faq);
  }, [clean]);

  let page;
  if (clean === "/admin") page = <DashboardPage />;
  else if (clean === "/admin/mails") page = <MailsPage />;
  else if (clean === "/panier") page = <CartPage />;
  else if (clean === "/commande") page = <CheckoutPage />;
  else if (clean === "/commande-confirmee") page = <OrderConfirmedPage />;
  else if (clean === "/compte") page = <AccountPage />;
  else if (clean === "/influenceurs") page = <AffiliateLandingPage />;
  else if (clean === "/influenceurs/inscription") page = <AffiliateApplyPage />;
  else if (clean === "/influenceurs/espace") page = <AffiliateSpacePage />;
  else if (clean === "/avis") page = <ReviewPage />;
  else if (clean === "/blog") page = <BlogPage />;
  else if (clean.startsWith("/blog/")) page = <ArticlePage slug={clean.slice("/blog/".length)} />;
  else if (clean.startsWith("/legal/")) page = <LegalPage slug={clean.slice("/legal/".length)} />;
  else page = <Landing />;

  return (
    <LanguageProvider>
      <CartProvider>{page}</CartProvider>
    </LanguageProvider>
  );
}
