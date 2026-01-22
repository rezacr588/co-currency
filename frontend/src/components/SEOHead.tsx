import { Helmet } from 'react-helmet-async';
import { useLanguage } from '../context/LanguageContext';

export function SEOHead() {
  const { language } = useLanguage();

  const titles: Record<string, string> = {
    en: 'CoFinance - Real-Time Currency Converter | Exchange Rates for USD, EUR, GBP & More',
    fa: 'کوفایننس - مبدل ارز لحظه‌ای | نرخ ارز دلار، یورو، پوند و بیشتر',
    ar: 'كوفايننس - محول العملات الفوري | أسعار صرف USD و EUR و GBP والمزيد',
    tr: 'CoFinance - Anlık Döviz Çevirici | USD, EUR, GBP ve Daha Fazlası',
  };

  const descriptions: Record<string, string> = {
    en: 'CoFinance - Free online currency converter with real-time exchange rates. Convert between USD, EUR, GBP, JPY, IRR and 160+ world currencies. Fast, accurate, and easy to use.',
    fa: 'کوفایننس - مبدل ارز آنلاین رایگان با نرخ ارز لحظه‌ای. تبدیل بین دلار، یورو، پوند، ین، ریال و بیش از ۱۶۰ ارز جهانی.',
    ar: 'كوفايننس - محول عملات مجاني مع أسعار صرف فورية. تحويل بين أكثر من 160 عملة عالمية.',
    tr: 'CoFinance - Anlık döviz kurları ile ücretsiz online döviz çevirici. 160+ dünya para birimi arasında dönüştürün.',
  };

  return (
    <Helmet>
      <html lang={language} dir={language === 'fa' || language === 'ar' ? 'rtl' : 'ltr'} />
      <title>{titles[language] || titles.en}</title>
      <meta name="description" content={descriptions[language] || descriptions.en} />
      <meta property="og:title" content={titles[language] || titles.en} />
      <meta property="og:description" content={descriptions[language] || descriptions.en} />
      <meta property="og:locale" content={language === 'fa' ? 'fa_IR' : language === 'ar' ? 'ar_SA' : language === 'tr' ? 'tr_TR' : 'en_US'} />
    </Helmet>
  );
}
