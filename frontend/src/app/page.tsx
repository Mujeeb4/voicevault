import type { Metadata } from 'next';
import { LandingPage } from '@/components/home/LandingPage';
import { siteUrl } from '@/config/site';

export const metadata: Metadata = {
  alternates: { canonical: '/' },
};

// Structured data so search engines know the site and organization behind it
const structuredData = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'VoiceVault',
      url: siteUrl,
      logo: `${siteUrl}/logo.png`,
      email: 'info@voicevault.life',
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      name: 'VoiceVault',
      url: siteUrl,
      publisher: { '@id': `${siteUrl}/#organization` },
      inLanguage: 'en-US',
    },
    {
      '@type': 'WebApplication',
      name: 'VoiceVault',
      url: siteUrl,
      applicationCategory: 'LifestyleApplication',
      operatingSystem: 'Web',
      description:
        'Record your stories once. VoiceVault turns them into an AI that answers your family\'s questions in your own voice.',
      publisher: { '@id': `${siteUrl}/#organization` },
    },
  ],
};

export default function HomePage() {
  return (
    <>
      <script
        type="application/ld+json"
        // JSON-LD is data, not script; escape "<" so the content can't close the tag
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
      />
      <LandingPage />
    </>
  );
}
