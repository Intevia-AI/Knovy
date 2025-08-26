
"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

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
}

// Create a provider component
export const LanguageProvider: React.FC<LanguageProviderProps> = ({ children }) => {
  const [locale, setLocale] = useState('zh-TW'); // Default language
  const [translations, setTranslations] = useState<Record<string, string>>({});

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
        console.error('Error fetching translations:', error);
      }
    };

    fetchTranslations();
  }, [locale]);

  const t = (key: string): string => {
    return translations[key] || key;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

// Create a custom hook to use the language context
export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (context === undefined) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
