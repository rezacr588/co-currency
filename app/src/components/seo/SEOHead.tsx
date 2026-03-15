import Head from 'expo-router/head';

const BASE_URL = 'https://coai.koyeb.app';
const SITE_NAME = 'CoAI';
const DEFAULT_ROBOTS = 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1';

interface SEOHeadProps {
  title: string;
  description: string;
  canonicalPath: string;
  ogImage?: string;
  ogImageAlt?: string;
  ogType?: string;
  keywords?: string[];
  locale?: string;
  robots?: string;
  noIndex?: boolean;
  jsonLd?: Record<string, unknown> | Record<string, unknown>[];
}

export function SEOHead({
  title,
  description,
  canonicalPath,
  ogImage,
  ogImageAlt,
  ogType = 'website',
  keywords,
  locale = 'en_US',
  robots,
  noIndex = false,
  jsonLd,
}: SEOHeadProps) {
  const fullTitle = `${title} | ${SITE_NAME}`;
  const canonicalUrl = `${BASE_URL}${canonicalPath}`;
  const image = ogImage || `${BASE_URL}/assets/images/icon.png`;
  const resolvedRobots = noIndex ? 'noindex, nofollow' : robots || DEFAULT_ROBOTS;

  return (
    <Head>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      {keywords && keywords.length > 0 ? (
        <meta name="keywords" content={keywords.join(', ')} />
      ) : null}

      <meta name="robots" content={resolvedRobots} />
      <meta name="googlebot" content={resolvedRobots} />

      {/* Open Graph */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={image} />
      {ogImageAlt ? <meta property="og:image:alt" content={ogImageAlt} /> : null}
      <meta property="og:type" content={ogType} />
      <meta property="og:site_name" content={SITE_NAME} />
      <meta property="og:locale" content={locale} />

      {/* Twitter Card */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      {ogImageAlt ? <meta name="twitter:image:alt" content={ogImageAlt} /> : null}

      {/* Structured Data */}
      {jsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      )}
    </Head>
  );
}
