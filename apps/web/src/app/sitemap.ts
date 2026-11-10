import type { MetadataRoute } from 'next';

import { POPULAR_COMPANIES } from '@/lib/companies';
import { getSiteUrl } from '@/lib/site-url';

const siteUrl = getSiteUrl();

// 공개 페이지만 노출. 개인 데이터 라우트는 색인 대상이 아니다.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${siteUrl}/`, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${siteUrl}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${siteUrl}/company`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${siteUrl}/benchmark`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
  ];
  // 회사 정보 페이지(검색 유입용) — 지표 검증된 인기 회사.
  const companyPages: MetadataRoute.Sitemap = POPULAR_COMPANIES.map((name) => ({
    url: `${siteUrl}/company/${encodeURIComponent(name)}`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));
  return [...staticPages, ...companyPages];
}
