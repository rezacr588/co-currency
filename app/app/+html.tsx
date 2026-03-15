import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" dir="auto">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />

        {/* Theme */}
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#f5f7fb" media="(prefers-color-scheme: light)" />
        <meta name="color-scheme" content="dark light" />

        {/* Default SEO */}
        <title>CoAI - Your Personal Finance Copilot</title>
        <meta
          name="description"
          content="CoAI helps you understand your money, track across currencies, and take guided action on budgets, goals, and spending."
        />
        <meta name="keywords" content="coai, personal finance copilot, ai finance assistant, currency converter, budget tracker, savings goals, multi-currency wallet, expense tracker" />
        <meta name="author" content="Reza Zeraat" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta name="googlebot" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />

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
        <meta property="og:title" content="CoAI - Your Personal Finance Copilot" />
        <meta
          property="og:description"
          content="CoAI helps you understand your money, track across currencies, and take guided action on budgets, goals, and spending."
        />
        <meta property="og:url" content="https://coai.koyeb.app" />
        <meta property="og:image" content="https://coai.koyeb.app/assets/images/icon.png" />
        <meta property="og:image:alt" content="CoAI personal finance copilot" />

        {/* Twitter Card */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="CoAI - Your Personal Finance Copilot" />
        <meta
          name="twitter:description"
          content="CoAI helps you understand your money, track across currencies, and take guided action on budgets, goals, and spending."
        />
        <meta name="twitter:image" content="https://coai.koyeb.app/assets/images/icon.png" />
        <meta name="twitter:image:alt" content="CoAI personal finance copilot" />

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
                '@type': 'SoftwareApplication',
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
                  'Personal finance copilot with multi-currency wallet, budgets, goals, reports, and guided AI actions.',
                featureList:
                  'CoAI Home, Multi-Currency Wallet, Currency Converter, Budgets, Savings Goals, Reports & Analytics, Purchasing Power Protection',
              },
              {
                '@context': 'https://schema.org',
                '@type': 'Organization',
                name: 'CoAI',
                url: 'https://coai.koyeb.app',
                logo: 'https://coai.koyeb.app/assets/images/icon.png',
                sameAs: ['https://www.linkedin.com/in/reza-zeraat-6628781b3/'],
              },
              {
                '@context': 'https://schema.org',
                '@type': 'WebSite',
                name: 'CoAI',
                url: 'https://coai.koyeb.app',
                description:
                  'CoAI helps you understand your money, track across currencies, and take guided action on budgets, goals, and spending.',
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
