import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VoiceVault',
    short_name: 'VoiceVault',
    description: 'Record your voice and stories once. Your family can ask questions and hear you answer.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#f7faf8',
    theme_color: '#0b8458',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
