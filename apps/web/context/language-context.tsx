"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

// Define the shape of the context
interface LanguageContextType {
  locale: string;
  setLocale: (locale: string) => void;
  t: (key: string) => string;
}

// Create the context with a default value
const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Define the props for the provider
interface LanguageProviderProps {
  children: ReactNode;
  initialLocale: string;
  initialTranslations: Record<string, string>;
}

// Create a provider component
export const LanguageProvider: React.FC<LanguageProviderProps> = ({
  children,
  initialLocale,
  initialTranslations,
}) => {
  const [locale, setLocale] = useState(initialLocale);
  const [translations, setTranslations] = useState(initialTranslations);

  useEffect(() => {
    const fetchTranslations = async () => {
      try {
        const response = await fetch(`/locales/${locale}.json`);
        if (!response.ok) {
          console.error(`Failed to load ${locale}.json`);
          return;
        }
        const data = await response.json();
        setTranslations(data);
      } catch (error) {
        console.error("Error fetching translations:", error);
      }
    };

    if (locale !== initialLocale) {
      fetchTranslations();
    }
  }, [locale, initialLocale]);

  useEffect(() => {
    const savedLocale = localStorage.getItem("locale");
    if (savedLocale && savedLocale !== locale) {
      setLocale(savedLocale);
    } else if (!savedLocale) {
      const browserLang = navigator.language;
      const newLocale = browserLang.startsWith("zh") ? "zh-TW" : "en";
      if (newLocale !== locale) {
        setLocale(newLocale);
      }
    }
  }, []); // Runs once on client-side

  const handleSetLocale = (newLocale: string) => {
    localStorage.setItem("locale", newLocale);
    setLocale(newLocale);
  };

  const t = (key: string): string => {
    return translations[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale: handleSetLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Create a custom hook to use the language context
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
