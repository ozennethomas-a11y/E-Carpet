import { createContext, useContext, useState, useEffect } from "react";
import { translations } from "./translations";

const LanguageContext = createContext(null);

function detectLanguage() {
  const saved = localStorage.getItem("ecarpet-lang");
  if (saved && translations[saved]) return saved;
  const nav = (navigator.language || "fr").slice(0, 2);
  return translations[nav] ? nav : "fr";
}

export function LanguageProvider({ children }) {
  const [lang, setLang] = useState(detectLanguage);

  useEffect(() => {
    localStorage.setItem("ecarpet-lang", lang);
    document.documentElement.lang = lang;
  }, [lang]);

  const t = translations[lang];
  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
