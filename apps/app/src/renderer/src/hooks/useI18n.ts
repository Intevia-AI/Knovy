/**
 * @fileoverview Internationalization Hook
 * @module useI18n
 * @description React hook for accessing translations and current language
 */

import { useLanguage } from "@/context/LanguageContext"; // Adjust path if needed
import { translations, TranslationKey } from "@/lib/translations"; // Adjust path if needed

/**
 * React hook for internationalization (i18n) functionality
 * 
 * @returns {Object} i18n utilities
 * @returns {function} t - Translation function that takes a key and returns the translated string
 * @returns {string} language - Current active language code
 * 
 * @example
 * ```tsx
 * const { t, language } = useI18n();
 * 
 * // Get a translated string
 * const greeting = t('greeting');
 * 
 * // Use in JSX
 * return (
 *   <div>
 *     <h1>{t('screenPreviewTitle')}</h1>
 *     <p>Current language: {language}</p>
 *   </div>
 * );
 * ```
 */
export const useI18n = () => {
  const { language } = useLanguage();

  /**
   * Translates a key to the current language
   * 
   * @param {TranslationKey} key - The translation key to look up
   * @returns {string} The translated string or the key itself if translation is missing
   */
  const t = (key: TranslationKey): string => {
    if (language === "original") {
      return key;
    }
    // Basic lookup, can be enhanced with fallback logic
    const langTranslations = translations[language as keyof typeof translations];
    return langTranslations?.[key] || key; // Return key if translation is missing
  };

  return { t, language };
};
