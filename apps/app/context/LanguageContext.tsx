"use client"
import React, {
  createContext,
  useState,
  useContext,
  ReactNode,
  useEffect,
} from "react";
import { SupportedLanguage } from "@/lib/translations"; // Adjust path if needed

interface LanguageContextType {
  language: SupportedLanguage;
  setLanguage: (language: SupportedLanguage) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined,
);

export const LanguageProvider: React.FC<{ children: ReactNode }> = ({
  children,
}) => {
  const [language, setLanguageState] = useState<SupportedLanguage>("zh-TW"); // Default language
  const [isLoading, setIsLoading] = useState(true); // State to track loading

  // Load settings on component mount
  useEffect(() => {
    const loadInitialLanguage = async () => {
      if (window.electronAPI) {
        try {
          const settings = await window.electronAPI.getSettings();
          if (settings && settings.language) {
            setLanguageState(settings.language as SupportedLanguage);
          }
        } catch (error) {
          console.error("Failed to load language setting:", error);
          // Keep default language if loading fails
        }
      }
      setIsLoading(false); // Mark loading as complete
    };
    loadInitialLanguage();
  }, []);

  // Modified setLanguage to also save settings
  const setLanguage = async (newLanguage: SupportedLanguage) => {
    setLanguageState(newLanguage);
    if (window.electronAPI) {
      try {
        await window.electronAPI.setSettings({ language: newLanguage });
      } catch (error) {
        console.error("Failed to save language setting:", error);
      }
    }
  };

  // Don't render children until settings are loaded to prevent flash of default language
  if (isLoading) {
    return null; // Or a loading indicator
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = (): LanguageContextType => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
};
