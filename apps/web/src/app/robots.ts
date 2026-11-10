import type { MetadataRoute } from 'next';

import { getSiteUrl } from '@/lib/site-url';

const siteUrl = getSiteUrl();

// 공개 페이지(랜딩·로그인·회사 정보)만 크롤 허용, 개인 데이터 라우트는 차단.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/login', '/company', '/company/', '/benchmark', '/privacy'],
      disallow: [
        '/applications/',
        '/calendar',
        '/profile',
        '/admin',
        '/auth/',
      ],
    },
    sitemap: `${siteUrl}/sitemap.xml`,
    host: siteUrl,
  };
}
