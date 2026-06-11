import type { Metadata } from 'next';
import { DM_Sans, Syne, Playfair_Display } from 'next/font/google';
import { connection } from 'next/server';
import './globals.css';
import { Providers } from './providers';
import { AnalyticsWrapper } from '@/components/shared/AnalyticsWrapper';

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
});

/** Logo/brand wordmark — distinctive, modern */
const syne = Syne({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-logo',
});

/** Headings — emotional, prestigious, legacy-feel */
const playfair = Playfair_Display({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800', '900'],
  style: ['normal', 'italic'],
  variable: '--font-heading',
});

export const metadata: Metadata = {
  title: {
    default: 'VoiceVault - AI Voice Memory System',
    template: '%s | VoiceVault',
  },
  icons: {
    icon: '/icon.png',
  },
  description:
    'One day, your voice will be the thing they miss most. Give your family a living memory that speaks back—preserve your voice, stories, and wisdom forever.',
  keywords: ['AI', 'voice cloning', 'memory preservation', 'family', 'chatbot'],
  authors: [{ name: 'VoiceVault Team' }],
  creator: 'VoiceVault',
  publisher: 'VoiceVault',
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'https://voicevault.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://voicevault.com',
    siteName: 'VoiceVault - Preserve Your Voice, Preserve Your Legacy',
    title: 'VoiceVault - Preserve Your Voice, Preserve Your Legacy',
    description:
      'One day, your voice will be the thing they miss most. Give your family a living memory that speaks back—forever.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'VoiceVault',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VoiceVault - Preserve Your Voice, Preserve Your Legacy',
    description:
      'One day, your voice will be the thing they miss most. Give your family a living memory that speaks back—forever.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  verification: {
    // Add verification codes when available
    // google: 'your-google-verification-code',
    // yandex: 'your-yandex-verification-code',
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  await connection();

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${dmSans.variable} ${syne.variable} ${playfair.variable} font-sans antialiased`} suppressHydrationWarning>
        <Providers>
          {children}
        </Providers>
        <AnalyticsWrapper />
      </body>
    </html>
  );
}
