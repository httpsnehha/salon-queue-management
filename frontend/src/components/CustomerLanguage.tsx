import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type CustomerLanguage = "en" | "gu";
type LanguageContextValue = { language: CustomerLanguage; toggleLanguage: () => void };
const LanguageContext = createContext<LanguageContextValue | null>(null);

export function CustomerLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<CustomerLanguage>(() => {
    try { return localStorage.getItem("salon-customer-language") === "gu" ? "gu" : "en"; }
    catch { return "en"; }
  });
  useEffect(() => {
    try { localStorage.setItem("salon-customer-language", language); } catch { /* Language still works for this visit. */ }
  }, [language]);
  return <LanguageContext.Provider value={{ language, toggleLanguage: () => setLanguage((current) => current === "en" ? "gu" : "en") }}>{children}</LanguageContext.Provider>;
}
export function useCustomerLanguage() {
  const value = useContext(LanguageContext);
  if (!value) throw new Error("CustomerLanguageProvider is missing.");
  return value;
}
export function LanguageToggle() {
  const { language, toggleLanguage } = useCustomerLanguage();
  return <button
    type="button"
    className="min-h-10 rounded-full border border-rosewood/25 bg-white px-4 py-2 text-sm font-semibold text-rosewood hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rosewood"
    onClick={toggleLanguage}
    aria-label={language === "en" ? "Switch to Gujarati" : "Switch to English"}
  >{language === "en" ? "ગુજરાતી" : "English"}</button>;
}
export function customerText(language: CustomerLanguage, english: string, gujarati: string) {
  return language === "gu" ? gujarati : english;
}
