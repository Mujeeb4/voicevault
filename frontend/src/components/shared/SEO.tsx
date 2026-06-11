/**
 * SEO Components
 * Meta tags, Open Graph, Twitter Cards
 * Following .cursorrules patterns
 */

import Head from 'next/head';
import React from 'react';

interface SEOProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'profile';
  siteName?: string;
  twitterCard?: 'summary' | 'summary_large_image';
  noindex?: boolean;
  nofollow?: boolean;
}

const defaultTitle = 'VoiceVault - AI Voice Memory System';
const defaultDescription =
  'Create an AI version of yourself that your family and friends can chat with. Preserve your voice, personality, and memories forever.';
const defaultImage = '/og-image.png';
const defaultUrl = 'https://voicevault.com';

export const SEO: React.FC<SEOProps> = ({
  title = defaultTitle,
  description = defaultDescription,
  image = defaultImage,
  url = defaultUrl,
  type = 'website',
  siteName = 'VoiceVault',
  twitterCard = 'summary_large_image',
  noindex = false,
  nofollow = false,
}) => {
  const fullTitle = title === defaultTitle ? title : `${title} | ${siteName}`;
  const fullImage = image.startsWith('http') ? image : `${defaultUrl}${image}`;
  const fullUrl = url.startsWith('http') ? url : `${defaultUrl}${url}`;

  const robots = [
    noindex && 'noindex',
    nofollow && 'nofollow',
  ]
    .filter(Boolean)
    .join(', ') || 'index, follow';

  return (
    <Head>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={robots} />
      <link rel="canonical" href={fullUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:url" content={fullUrl} />
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={fullImage} />
      <meta property="og:site_name" content={siteName} />

      {/* Twitter */}
      <meta name="twitter:card" content={twitterCard} />
      <meta name="twitter:url" content={fullUrl} />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={fullImage} />

      {/* Additional Meta Tags */}
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#3b82f6" />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      <meta name="apple-mobile-web-app-title" content={siteName} />
    </Head>
  );
};

/**
 * JSON-LD Structured Data
 */
export const StructuredData: React.FC<{ data: object }> = ({ data }) => {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
};

/**
 * Organization Schema
 */
export const OrganizationSchema = () => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'VoiceVault',
    url: 'https://voicevault.com',
    logo: 'https://voicevault.com/logo.png',
    description: defaultDescription,
    sameAs: [
      // Add social media links
    ],
  };

  return <StructuredData data={schema} />;
};

/**
 * Website Schema
 */
export const WebsiteSchema = () => {
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: 'VoiceVault',
    url: 'https://voicevault.com',
    description: defaultDescription,
    potentialAction: {
      '@type': 'SearchAction',
      target: {
        '@type': 'EntryPoint',
        urlTemplate: 'https://voicevault.com/search?q={search_term_string}',
      },
      'query-input': 'required name=search_term_string',
    },
  };

  return <StructuredData data={schema} />;
};

