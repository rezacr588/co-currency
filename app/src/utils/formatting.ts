// Regional number and date formatting utilities

// Persian/Farsi numerals
const PERSIAN_NUMERALS = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];

// Arabic numerals (Eastern Arabic)
const ARABIC_NUMERALS = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

export type LocaleCode = 'en' | 'fa' | 'ar' | 'tr';

/**
 * Convert western numerals to Persian numerals
 */
export function toPersianNumerals(num: string | number): string {
  const str = String(num);
  return str.replace(/[0-9]/g, (d) => PERSIAN_NUMERALS[parseInt(d, 10)]);
}

/**
 * Convert western numerals to Arabic numerals
 */
export function toArabicNumerals(num: string | number): string {
  const str = String(num);
  return str.replace(/[0-9]/g, (d) => ARABIC_NUMERALS[parseInt(d, 10)]);
}

/**
 * Convert to locale-specific numerals
 */
export function toLocalizedNumerals(num: string | number, locale: LocaleCode): string {
  switch (locale) {
    case 'fa':
      return toPersianNumerals(num);
    case 'ar':
      return toArabicNumerals(num);
    default:
      return String(num);
  }
}

/**
 * Format number with locale-specific formatting
 */
export function formatNumber(
  num: number,
  locale: LocaleCode,
  options: Intl.NumberFormatOptions = {}
): string {
  // Map our locale codes to Intl locale strings
  const localeMap: Record<LocaleCode, string> = {
    en: 'en-US',
    fa: 'fa-IR',
    ar: 'ar-SA',
    tr: 'tr-TR',
  };

  const intlLocale = localeMap[locale];

  try {
    const formatted = new Intl.NumberFormat(intlLocale, options).format(num);

    // For Persian and Arabic, ensure we use the correct numerals
    // (some environments may not have proper locale support)
    if (locale === 'fa') {
      return toPersianNumerals(formatted.replace(/[٠-٩]/g, (d) => {
        const arabicIndex = d.charCodeAt(0) - '٠'.charCodeAt(0);
        return String(arabicIndex);
      }));
    }
    if (locale === 'ar') {
      return toArabicNumerals(formatted.replace(/[۰-۹]/g, (d) => {
        const persianIndex = d.charCodeAt(0) - '۰'.charCodeAt(0);
        return String(persianIndex);
      }));
    }

    return formatted;
  } catch (error) {
    // Fallback to basic formatting
    const formatted = num.toLocaleString('en-US', options);
    return toLocalizedNumerals(formatted, locale);
  }
}

/**
 * Format currency with locale-specific formatting
 */
export function formatCurrency(
  amount: number,
  currencyCode: string,
  locale: LocaleCode
): string {
  return formatNumber(amount, locale, {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/**
 * Format percentage with locale-specific formatting
 */
export function formatPercent(
  value: number,
  locale: LocaleCode,
  decimals = 0
): string {
  return formatNumber(value, locale, {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format compact number (e.g., 1.2K, 3.5M)
 */
export function formatCompact(num: number, locale: LocaleCode): string {
  return formatNumber(num, locale, {
    notation: 'compact',
    compactDisplay: 'short',
  });
}

/**
 * Decimal separator for locale
 */
export function getDecimalSeparator(locale: LocaleCode): string {
  const separators: Record<LocaleCode, string> = {
    en: '.',
    fa: '٫', // Arabic decimal separator (also used in Persian)
    ar: '٫',
    tr: ',',
  };
  return separators[locale];
}

/**
 * Thousands separator for locale
 */
export function getThousandsSeparator(locale: LocaleCode): string {
  const separators: Record<LocaleCode, string> = {
    en: ',',
    fa: '٬', // Arabic thousands separator
    ar: '٬',
    tr: '.',
  };
  return separators[locale];
}

/**
 * Parse localized number string back to number
 */
export function parseLocalizedNumber(str: string, locale: LocaleCode): number {
  let normalized = str;

  // Convert locale-specific numerals back to western
  if (locale === 'fa') {
    normalized = normalized.replace(/[۰-۹]/g, (d) => {
      return String(d.charCodeAt(0) - '۰'.charCodeAt(0));
    });
  } else if (locale === 'ar') {
    normalized = normalized.replace(/[٠-٩]/g, (d) => {
      return String(d.charCodeAt(0) - '٠'.charCodeAt(0));
    });
  }

  // Replace locale-specific separators
  const decimalSep = getDecimalSeparator(locale);
  const thousandsSep = getThousandsSeparator(locale);

  normalized = normalized.replace(new RegExp(`\\${thousandsSep}`, 'g'), '');
  normalized = normalized.replace(decimalSep, '.');

  return parseFloat(normalized);
}

/**
 * Get text direction for locale
 */
export function getTextDirection(locale: LocaleCode): 'ltr' | 'rtl' {
  return locale === 'fa' || locale === 'ar' ? 'rtl' : 'ltr';
}

/**
 * Check if locale is RTL
 */
export function isRTL(locale: LocaleCode): boolean {
  return locale === 'fa' || locale === 'ar';
}
