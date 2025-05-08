import { useLanguage } from "@/context/LanguageContext"; // Adjust path if needed
import { translations, TranslationKey } from "@/lib/translations"; // Adjust path if needed

export const useI18n = () => {
  const { language } = useLanguage();

  const t = (key: TranslationKey): string => {
    // Basic lookup, can be enhanced with fallback logic
    const langTranslations = translations[language];
    return langTranslations[key] || key; // Return key if translation is missing
  };

  return { t, language };
};
