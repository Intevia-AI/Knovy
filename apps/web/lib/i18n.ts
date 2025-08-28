import "server-only";

const dictionaries = {
  en: () => import("../public/locales/en.json").then((module) => module.default),
  "zh-TW": () => import("../public/locales/zh-TW.json").then((module) => module.default),
};

export const getDictionary = async (locale: string) => {
  // Fallback to 'en' if the locale is not supported
  const loader = dictionaries[locale as keyof typeof dictionaries] || dictionaries.en;
  return loader();
};
