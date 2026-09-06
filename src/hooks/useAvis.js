import { useEffect, useState } from "react";
import { useLang } from "../i18n/LanguageContext";

// Combine les avis "maison" (traductions, mis en veille possible depuis
// l'admin) et les avis de visiteurs approuvés — même source pour le
// carrousel (Reviews.jsx) et la moyenne affichée (Stats.jsx), pour que le
// chiffre montré corresponde exactement à ce que le visiteur peut lire.
export function useAvis() {
  const { t } = useLang();
  const [moderation, setModeration] = useState({ masques: [], avis: [] });

  useEffect(() => {
    fetch("/api/avis?public=1")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setModeration(d))
      .catch(() => {});
  }, []);

  const items = [
    ...t.reviews.items.filter((_, i) => !moderation.masques.includes(`base-${i}`)),
    ...moderation.avis,
  ];

  // Moyenne/nombre affichés en note globale : uniquement les VRAIS avis de
  // visiteurs (moderation.avis) — les avis "maison" du carrousel sont des
  // exemples de mise en page, jamais présentés comme des avis réels dans les
  // statistiques (voir structuredData.js pour la même règle côté SEO).
  const realCount = moderation.avis.length;
  const realAverage = realCount ? moderation.avis.reduce((s, r) => s + (r.rating || 0), 0) / realCount : 0;

  return { items, realCount, realAverage };
}
