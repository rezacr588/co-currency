import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* Theme */}
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#f5f7fb" media="(prefers-color-scheme: light)" />
        <meta name="color-scheme" content="dark light" />

        {/* Default SEO */}
        <title>CoAI - See Where Your Money Really Goes</title>
        <meta
          name="description"
          content="Track spending across 160+ currencies, get AI-powered financial advice, and protect your purchasing power. Free forever."
        />
        <meta name="keywords" content="personal finance, currency converter, budget tracker, AI financial advisor, multi-currency wallet, savings goals, expense tracker" />
        <meta name="author" content="Reza Zeraat" />

        {/* Favicon & Icons */}
        <link rel="icon" href="/favicon.ico" sizes="48x48" />
        <link rel="apple-touch-icon" href="/assets/images/icon.png" />
        <link rel="manifest" href="/manifest.json" />

        {/* Apple Web App */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="CoAI" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* Open Graph */}
        <meta property="og:site_name" content="CoAI" />
        <meta property="og:type" content="website" />
        <meta property="og:locale" content="en_US" />
        <meta property="og:title" content="CoAI - See Where Your Money Really Goes" />
        <meta
          property="og:description"
          content="Track spending across 160+ currencies, get AI-powered financial advice, and protect your purchasing power. Free forever."
        />
        <meta property="og:url" content="https://coai.koyeb.app" />
        <meta property="og:image" content="https://coai.koyeb.app/assets/images/icon.png" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="CoAI - See Where Your Money Really Goes" />
        <meta
          name="twitter:description"
          content="Track spending across 160+ currencies, get AI-powered financial advice, and protect your purchasing power. Free forever."
        />
        <meta name="twitter:image" content="https://coai.koyeb.app/assets/images/icon.png" />

        {/* hreflang */}
        <link rel="alternate" hrefLang="en" href="https://coai.koyeb.app/" />
        <link rel="alternate" hrefLang="fa" href="https://coai.koyeb.app/" />
        <link rel="alternate" hrefLang="ar" href="https://coai.koyeb.app/" />
        <link rel="alternate" hrefLang="tr" href="https://coai.koyeb.app/" />
        <link rel="alternate" hrefLang="x-default" href="https://coai.koyeb.app/" />

        {/* Preconnect */}
        <link rel="preconnect" href="https://coai.koyeb.app" />
        <link rel="dns-prefetch" href="https://api.frankfurter.app" />

        {/* Structured Data */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify([
              {
                '@context': 'https://schema.org',
                '@type': 'WebApplication',
                name: 'CoAI',
                url: 'https://coai.koyeb.app',
                applicationCategory: 'FinanceApplication',
                operatingSystem: 'Web, iOS, Android',
                offers: {
                  '@type': 'Offer',
                  price: '0',
                  priceCurrency: 'USD',
                },
                author: {
                  '@type': 'Person',
                  name: 'Reza Zeraat',
                },
                description:
                  'AI-powered personal finance app with multi-currency wallet, budgets, goals, and reports.',
                featureList:
                  'Multi-Currency Wallet, Currency Converter, Budgets, Savings Goals, AI Receipt Parsing, Reports & Analytics, Real Value Protection',
                inLanguage: ['en', 'fa', 'ar', 'tr'],
              },
              {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'CoAI',
                url: 'https://coai.koyeb.app',
                logo: 'https://coai.koyeb.app/assets/images/icon.png',
              },
            ]),
          }}
        />

        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
