import type { MetadataRoute } from 'next';

import { getSiteUrl } from '@/lib/site-url';

const siteUrl = getSiteUrl();

// 공개 페이지만 노출. 나머지는 개인 데이터라 색인 대상이 아니다.
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${siteUrl}/login`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 1,
    },
  ];
}
