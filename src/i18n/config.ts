export const locales = ["en", "zh-Hans", "zh-Hant", "ja", "ru"] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = "en";
