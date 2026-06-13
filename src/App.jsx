import { LanguageProvider } from "./i18n/LanguageContext";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Problem from "./components/Problem";
import ParkingScene from "./components/ParkingScene";
import Unroll from "./components/Unroll";
import Lifestyle from "./components/Lifestyle";
import Stats from "./components/Stats";
import Reviews from "./components/Reviews";
import MadeIn from "./components/MadeIn";
import Faq from "./components/Faq";
import FinalCta from "./components/FinalCta";
import Footer from "./components/Footer";
import StickyCta from "./components/StickyCta";

export default function App() {
  return (
    <LanguageProvider>
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
    </LanguageProvider>
  );
}
