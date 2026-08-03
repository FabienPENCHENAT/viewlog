import { createContext, useContext, useEffect, useMemo, useState } from "react";
import fr from "./fr.js";
import en from "./en.js";

// i18n maison, volontairement minimale (FR/EN uniquement).
// - un dictionnaire plat par langue (voir fr.js / en.js)
// - t(key, vars) avec interpolation {var}
// - locale exposée pour le formatage nombres/dates

const STORAGE_KEY = "viewlog:lang";

// Convention US pour l'anglais : mois/jour et 12 h (« 08/03 3:16 PM »), là où le
// français donne « 03/08 15:16 ». Une seule convention par langue dans toute
// l'app, sinon la même date s'afficherait de deux façons selon l'écran.
const LOCALES = { fr: "fr-FR", en: "en-US" };

const DICT = { fr, en };

function detectLang() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "fr" || stored === "en") return stored;
  } catch {
    /* localStorage indisponible */
  }
  const nav = typeof navigator !== "undefined" ? navigator.language || "" : "";
  return nav.toLowerCase().startsWith("fr") ? "fr" : "en";
}

function interpolate(str, vars) {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? String(vars[k]) : `{${k}}`));
}

const I18nContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(detectLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* ignore */
    }
  }, [lang]);

  const value = useMemo(() => {
    const table = DICT[lang] || DICT.en;
    return {
      lang,
      setLang: setLangState,
      locale: LOCALES[lang] || LOCALES.en,
      t: (key, vars) => interpolate(table[key] ?? key, vars),
    };
  }, [lang]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within <LangProvider>");
  return ctx;
}
