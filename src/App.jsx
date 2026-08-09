import { useState, useEffect, useRef } from "react";
import { LanguageProvider } from "./i18n/LanguageContext";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Problem from "./components/Problem";
import ParkingScene from "./components/ParkingScene";
import Unroll from "./components/Unroll";
import Lifestyle from "./components/Lifestyle";
import Stats from "./components/Stats";
import Reviews from "./components/Reviews";
import ReviewCta from "./components/ReviewCta";
import ReviewPage from "./components/ReviewPage";
import BlogPage from "./components/BlogPage";
import ArticlePage from "./components/ArticlePage";
import LegalPage from "./components/LegalPage";
import DashboardPage from "./components/DashboardPage";
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
        <ReviewCta />
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
    if (clean === "/dashboard") return;
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

  let page;
  if (clean === "/dashboard") page = <DashboardPage />;
  else if (clean === "/avis") page = <ReviewPage />;
  else if (clean === "/blog") page = <BlogPage />;
  else if (clean.startsWith("/blog/")) page = <ArticlePage slug={clean.slice("/blog/".length)} />;
  else if (clean.startsWith("/legal/")) page = <LegalPage slug={clean.slice("/legal/".length)} />;
  else page = <Landing />;

  return <LanguageProvider>{page}</LanguageProvider>;
}
