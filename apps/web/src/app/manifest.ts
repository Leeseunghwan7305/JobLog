import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'JobLog — 공고 링크로 전형까지 자동 정리',
    short_name: 'JobLog',
    description: '공고 링크만 붙여넣으면 AI가 전형까지 정리·추적해요.',
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
