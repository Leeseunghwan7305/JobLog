import './globals.css';

import { GoogleAnalytics } from '@next/third-parties/google';
import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from '@vercel/speed-insights/next';
import type { Metadata, Viewport } from 'next';

import SupportWidget from '@/components/SupportWidget';

import Providers from './providers';

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
// GA4는 측정 ID가 설정된 경우에만 로드 (없으면 스크립트 자체를 넣지 않음)
const gaId = process.env.NEXT_PUBLIC_GA_ID;
const description =
  '지원한 공고, 어디까지 왔는지 한 곳에서 추적한다. 링크만 붙여넣으면 AI가 회사·직무·전형을 정리하고 서류부터 최종까지 상태를 관리한다.';

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: 'JobLog — 구직 현황 추적', template: '%s · JobLog' },
  description,
  applicationName: 'JobLog',
  keywords: ['구직', '취업', '채용', '지원 현황', '전형 관리', '채용 공고', 'JobLog'],
  authors: [{ name: 'JobLog' }],
  // 개인 데이터 앱이라 기본은 색인 금지. 공개 진입점(/login)에서만 덮어쓴다.
  robots: { index: false, follow: false },
  openGraph: {
    type: 'website',
    siteName: 'JobLog',
    title: 'JobLog — 구직 현황 추적',
    description: '지원한 공고, 어디까지 왔는지 한 곳에서.',
    url: '/',
    locale: 'ko_KR',
    // 공유 카드 이미지는 app/opengraph-image.tsx(파일 컨벤션)가 자동 주입한다.
  },
  twitter: {
    card: 'summary_large_image',
    title: 'JobLog — 구직 현황 추적',
    description: '지원한 공고, 어디까지 왔는지 한 곳에서.',
  },
};

export const viewport: Viewport = {
  themeColor: '#3858e9',
};

// 하이드레이션 전에 테마 클래스를 심어 깜빡임(FOUC)을 막는다.
const themeScript = `(function(){try{var t=localStorage.getItem('joblog_theme');var d=t==='dark'||(t!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;r.classList.toggle('dark',d);r.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`;

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers>
          {children}
          {/* 전역 "개발자에게 문의하기" 플로팅 버튼 (모든 페이지) */}
          <SupportWidget />
        </Providers>
        {/* Vercel 배포 시 트래픽·Web Vitals 수집 (그 외 환경에선 no-op) */}
        <Analytics />
        <SpeedInsights />
        {gaId && <GoogleAnalytics gaId={gaId} />}
      </body>
    </html>
  );
}
