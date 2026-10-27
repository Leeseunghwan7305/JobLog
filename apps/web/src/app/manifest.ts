import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'JobLog — 구직 현황 추적',
    short_name: 'JobLog',
    description: '지원한 공고, 어디까지 왔는지 한 곳에서 추적한다.',
    start_url: '/',
    display: 'standalone',
    lang: 'ko',
    background_color: '#ffffff',
    theme_color: '#3858e9',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  };
}
