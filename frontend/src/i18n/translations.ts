export const translations = {
  en: {
    // Header
    appTitle: 'Currency Converter',
    appSubtitle: 'Real-time exchange rates powered by Frankfurter API',

    // Converter
    converterTitle: 'Currency Converter',
    amount: 'Amount',
    from: 'From',
    to: 'To',
    enterAmount: 'Enter an amount to see the conversion',
    failedToConvert: 'Failed to convert. Please try again.',

    // Rates Grid
    exchangeRates: 'Exchange Rates',
    updatedAt: 'Updated at',
    failedToLoadRates: 'Failed to load rates. Please try again.',
    showLess: 'Show Less',
    showAll: 'Show All',
    currencies: 'currencies',

    // Quick Convert
    quickConversions: 'Quick Conversions',
    failedToLoad: 'Failed to load',

    // Historical
    historicalRates: 'Historical Rates',

    // Footer
    footerText: 'Exchange rates provided by',
    ratesUpdatedDaily: 'Rates are updated daily',

    // Language
    language: 'Language',
    english: 'English',
    persian: 'فارسی',
  },
  fa: {
    // Header
    appTitle: 'مبدل ارز',
    appSubtitle: 'نرخ ارز لحظه‌ای با استفاده از Frankfurter API',

    // Converter
    converterTitle: 'مبدل ارز',
    amount: 'مبلغ',
    from: 'از',
    to: 'به',
    enterAmount: 'مبلغ را وارد کنید تا تبدیل را ببینید',
    failedToConvert: 'تبدیل ناموفق بود. لطفاً دوباره تلاش کنید.',

    // Rates Grid
    exchangeRates: 'نرخ ارزها',
    updatedAt: 'بروزرسانی در',
    failedToLoadRates: 'بارگذاری نرخ‌ها ناموفق بود. لطفاً دوباره تلاش کنید.',
    showLess: 'نمایش کمتر',
    showAll: 'نمایش همه',
    currencies: 'ارز',

    // Quick Convert
    quickConversions: 'تبدیل سریع',
    failedToLoad: 'بارگذاری ناموفق',

    // Historical
    historicalRates: 'نرخ‌های تاریخی',

    // Footer
    footerText: 'نرخ ارز ارائه شده توسط',
    ratesUpdatedDaily: 'نرخ‌ها روزانه بروزرسانی می‌شوند',

    // Language
    language: 'زبان',
    english: 'English',
    persian: 'فارسی',
  },
} as const;

export type Language = keyof typeof translations;
export type TranslationKey = keyof typeof translations.en;
