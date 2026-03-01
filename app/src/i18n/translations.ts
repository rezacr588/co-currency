import { en } from './en';
import { fa } from './fa';
import { ar } from './ar';
import { tr } from './tr';

export const translations = {
  en,
  fa,
  ar,
  tr,
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;
