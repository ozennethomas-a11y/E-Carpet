import { useState, useEffect } from "react";
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

  let page;
  if (clean === "/avis") page = <ReviewPage />;
  else if (clean === "/blog") page = <BlogPage />;
  else if (clean.startsWith("/blog/")) page = <ArticlePage slug={clean.slice("/blog/".length)} />;
  else if (clean.startsWith("/legal/")) page = <LegalPage slug={clean.slice("/legal/".length)} />;
  else page = <Landing />;

  return <LanguageProvider>{page}</LanguageProvider>;
}
